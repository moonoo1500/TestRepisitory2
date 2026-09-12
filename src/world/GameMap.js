import * as THREE from 'three';
import { MAP_SIZE, TILE } from '../data/defs.js';
import { fbm, clamp, lerp, makeRng } from '../core/util.js';

/* =========================================================
   Карта: процедурный ландшафт, вода, жилы, проходимость
   ========================================================= */
const WATER_BLOCK = 1;
const STEEP_BLOCK = 2;
const BUILD_BLOCK = 4;
const NODE_BLOCK = 8;
const CLIFF_BLOCK = 16;

export class GameMap {
  /**
   * @param {object} preset  { seed, roughness, water, crystals, islands, craters }
   */
  constructor(preset) {
    this.size = MAP_SIZE;
    this.tile = TILE;
    this.worldSize = MAP_SIZE * TILE;
    this.half = this.worldSize / 2;

    const rng = makeRng(preset.seed);
    this.rng = rng;
    const S = this.size;

    // --- поле высот (S+1 вершин на сторону) ---
    this.heights = new Float32Array((S + 1) * (S + 1));
    const sc = preset.islands ? 0.022 : 0.016;
    for (let z = 0; z <= S; z++) {
      for (let x = 0; x <= S; x++) {
        let h = fbm(x * sc, z * sc, 5, preset.seed, 2.1, 0.5) * 7.0 * preset.roughness;
        h += fbm(x * sc * 3.3, z * sc * 3.3, 3, preset.seed + 91, 2.0, 0.5) * 1.4 * preset.roughness;
        // пологая чаша к краям, чтобы армия не уходила в никуда
        const cx = (x / S - 0.5) * 2, cz = (z / S - 0.5) * 2;
        const edge = Math.max(Math.abs(cx), Math.abs(cz));
        if (preset.islands) {
          const islandMask = 1 - clamp((edge - 0.55) / 0.45, 0, 1);
          h = h * islandMask - (1 - islandMask) * 9;
        } else {
          h -= Math.pow(clamp((edge - 0.72) / 0.28, 0, 1), 2) * 12;
        }
        this.heights[z * (S + 1) + x] = h;
      }
    }

    // --- кратеры ---
    if (preset.craters) {
      for (let i = 0; i < preset.craters; i++) {
        const cx = lerp(S * 0.15, S * 0.85, rng());
        const cz = lerp(S * 0.15, S * 0.85, rng());
        const r = lerp(4, 11, rng());
        for (let z = Math.max(0, Math.floor(cz - r - 2)); z <= Math.min(S, Math.ceil(cz + r + 2)); z++) {
          for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(S, Math.ceil(cx + r + 2)); x++) {
            const d = Math.hypot(x - cx, z - cz) / r;
            if (d < 1.35) {
              const k = this.heights[z * (S + 1) + x];
              const shape = d < 1 ? -Math.cos(d * Math.PI * 0.5) * 3.2 : (1.35 - d) * 3.0;
              this.heights[z * (S + 1) + x] = k + shape;
            }
          }
        }
      }
    }

    // --- вода: уровень по процентили высот (доля воды предсказуема) ---
    this.presetSeed = preset.seed;
    this.waterLevel = this.heightQuantile(preset.waterFrac ?? 0.1);

    // --- стартовые площадки: выравниваем и поднимаем над водой ---
    this.spawns = [
      { tx: Math.floor(S * 0.14), tz: Math.floor(S * 0.86), faction: 'player' },
      { tx: Math.floor(S * 0.86), tz: Math.floor(S * 0.14), faction: 'enemy' },
    ];
    for (const sp of this.spawns) this.flatten(sp.tx, sp.tz, 10, 0.9, this.waterLevel + 2.2);

    // --- тайлы и проходимость ---
    this.block = new Uint8Array(S * S);
    this.tileH = new Float32Array(S * S);
    this.moisture = new Float32Array(S * S);
    this.computeBlocks(preset.seed);

    // --- guarantees: базы должны быть связаны сушей ---
    this.ensureConnected();

    // --- кристаллические жилы ---
    this.nodes = [];
    this.generateNodes(preset.crystals);
    this.relocateOrphanNodes();

    // --- декор ---
    this.decor = [];
    this.generateDecor();

    this.version = 0;
  }

  flatten(cx, cz, radius, strength = 1, minHeight = null) {
    const S = this.size;
    let avg = 0, n = 0;
    for (let z = Math.max(0, cz - radius); z <= Math.min(S, cz + radius); z++)
      for (let x = Math.max(0, cx - radius); x <= Math.min(S, cx + radius); x++) { avg += this.heights[z * (S + 1) + x]; n++; }
    avg /= n;
    if (minHeight !== null) avg = Math.max(avg, minHeight);
    for (let z = Math.max(0, cz - radius); z <= Math.min(S, cz + radius); z++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(S, cx + radius); x++) {
        const d = Math.hypot(x - cx, z - cz) / radius;
        if (d > 1) continue;
        const k = (1 - d * d) * strength;
        const idx = z * (S + 1) + x;
        this.heights[idx] = lerp(this.heights[idx], avg + 0.1, k);
      }
    }
  }

  /** Квантиль распределения высот — используется как уровень воды */
  heightQuantile(q) {
    const S = this.size;
    const sample = [];
    for (let z = 0; z <= S; z += 2) for (let x = 0; x <= S; x += 2) sample.push(this.heights[z * (S + 1) + x]);
    sample.sort((a, b) => a - b);
    return sample[Math.floor(clamp(q, 0, 0.99) * (sample.length - 1))];
  }

  /** Пересчёт проходимости по текущим высотам */
  computeBlocks(seed) {
    const S = this.size;
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const i = z * S + x;
        const h = this.heightAtTile(x, z);
        this.tileH[i] = h;
        this.moisture[i] = (fbm(x * 0.06, z * 0.06, 3, seed + 555) + 1) * 0.5;
        let b = 0;
        if (h < this.waterLevel + 0.35) b |= WATER_BLOCK;
        const hr = this.heightAtTile(x + 1, z), hl = this.heightAtTile(x - 1, z);
        const hu = this.heightAtTile(x, z - 1), hd = this.heightAtTile(x, z + 1);
        const slope = Math.max(Math.abs(hr - hl), Math.abs(hu - hd)) / (2 * TILE);
        if (slope > 0.55 && h > this.waterLevel) b |= STEEP_BLOCK;
        if (slope > 0.85) b |= CLIFF_BLOCK;
        this.block[i] = b;
      }
    }
  }

  /** BFS по проходимым клеткам; возвращает Uint8Array достижимости */
  floodFrom(tx, tz) {
    const S = this.size;
    const seen = new Uint8Array(S * S);
    const start = this.nearestWalkable(tx, tz, 14);
    if (!start) return seen;
    const q = [start[1] * S + start[0]];
    seen[q[0]] = 1;
    let head = 0;
    while (head < q.length) {
      const i = q[head++];
      const cx = i % S, cz = (i / S) | 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
          const ni = nz * S + nx;
          if (seen[ni] || !this.isWalkable(nx, nz)) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
    }
    return seen;
  }

  /** Прокладывает пологий «перешеек» между двумя точками */
  carveBridge(a, b) {
    const S = this.size;
    const steps = Math.ceil(Math.hypot(b.tx - a.tx, b.tz - a.tz) * 2);
    const R = 3;
    const floor = this.waterLevel + 2.4;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = lerp(a.tx, b.tx, t), cz = lerp(a.tz, b.tz, t);
      // локальная средняя высота вокруг точки маршрута
      let sum = 0, n = 0;
      for (let dz = -5; dz <= 5; dz++) {
        for (let dx = -5; dx <= 5; dx++) {
          const x = Math.round(cx + dx), z = Math.round(cz + dz);
          if (x < 0 || z < 0 || x > S || z > S) continue;
          sum += this.heights[z * (S + 1) + x]; n++;
        }
      }
      const goal = Math.max(floor, sum / Math.max(1, n));
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          const x = Math.round(cx + dx), z = Math.round(cz + dz);
          if (x < 1 || z < 1 || x > S - 1 || z > S - 1) continue;
          const d = Math.hypot(dx, dz);
          if (d > R) continue;
          const k = clamp((1 - d / (R + 0.6)) * 1.5, 0, 1);
          const idx = z * (S + 1) + x;
          this.heights[idx] = lerp(this.heights[idx], goal, k);
        }
      }
    }
    // сглаживающие проходы, чтобы убрать крутые откосы
    const W = S + 1;
    const copy = Float32Array.from(this.heights);
    for (let pass = 0; pass < 4; pass++) {
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = Math.round(lerp(a.tx, b.tx, t)), cz = Math.round(lerp(a.tz, b.tz, t));
        for (let dz = -R; dz <= R; dz++) {
          for (let dx = -R; dx <= R; dx++) {
            const x = cx + dx, z = cz + dz;
            if (x < 1 || z < 1 || x > S - 1 || z > S - 1) continue;
            if (Math.hypot(dx, dz) > R) continue;
            let sum = 0, n = 0;
            for (let oz = -1; oz <= 1; oz++) {
              for (let ox = -1; ox <= 1; ox++) {
                sum += copy[(z + oz) * W + (x + ox)]; n++;
              }
            }
            const idx = z * W + x;
            const avg = sum / n;
            this.heights[idx] = Math.max(lerp(copy[idx], avg, 0.75), floor * 0.9);
          }
        }
      }
    }
  }

  /** Гарантирует, что обе базы в одной связной области */
  ensureConnected() {
    const S = this.size;
    const a = this.spawns[0], b = this.spawns[1];
    for (let attempt = 0; attempt < 4; attempt++) {
      const comp = this.floodFrom(a.tx, a.tz);
      if (comp[b.tz * S + b.tx]) { this.mainComponent = comp; return true; }
      this.carveBridge(a, b);
      this.computeBlocks(this.presetSeed);
      for (const sp of this.spawns) this.flatten(sp.tx, sp.tz, 8, 0.9, this.waterLevel + 2.2);
      this.computeBlocks(this.presetSeed);
    }
    this.mainComponent = this.floodFrom(a.tx, a.tz);
    return false;
  }

  /** Переносит жилы, до которых нельзя дойти пешком, на доступные клетки */
  relocateOrphanNodes() {
    const S = this.size;
    const comp = this.mainComponent || this.floodFrom(this.spawns[0].tx, this.spawns[0].tz);
    const free = [];
    for (let i = 0; i < comp.length; i++) if (comp[i] && this.block[i] === 0) free.push(i);
    if (!free.length) return;
    for (const n of this.nodes) {
      if (comp[n.tz * S + n.tx]) continue;
      this.block[n.tz * S + n.tx] &= ~NODE_BLOCK;
      for (let tries = 0; tries < 60; tries++) {
        const i = free[(this.rng() * free.length) | 0];
        const tx = i % S, tz = (i / S) | 0;
        if (this.block[i] !== 0) continue;
        this.block[i] |= NODE_BLOCK;
        n.tx = tx; n.tz = tz;
        n.x = (tx + 0.5) * this.tile - this.half;
        n.z = (tz + 0.5) * this.tile - this.half;
        n.y = this.heightAtTile(tx, tz);
        break;
      }
    }
  }

  generateNodes(count) {
    const S = this.size;
    // возле каждой базы + по карте
    const anchors = [
      [this.spawns[0].tx + 7, this.spawns[0].tz - 5],
      [this.spawns[1].tx - 7, this.spawns[1].tz + 5],
    ];
    for (let i = 0; i < count; i++) {
      let ax, az;
      if (i < anchors.length) { [ax, az] = anchors[i]; }
      else {
        const a = this.rng() * Math.PI * 2, r = 0.12 + this.rng() * 0.36;
        ax = S / 2 + Math.cos(a) * r * S;
        az = S / 2 + Math.sin(a) * r * S;
      }
      const amount = i < 2 ? 3000 : Math.floor(lerp(1100, 2600, this.rng()));
      this.addCluster(ax, az, amount);
    }
    // мелкие разбросанные
    for (let i = 0; i < 10; i++) {
      const ax = lerp(S * 0.1, S * 0.9, this.rng()), az = lerp(S * 0.1, S * 0.9, this.rng());
      this.addCluster(ax, az, Math.floor(lerp(450, 900, this.rng())), 2);
    }
  }

  addCluster(cx, cz, amount, n = 0) {
    const S = this.size;
    n = n || 3 + Math.floor(this.rng() * 3);
    let placed = 0, guard = 0;
    const crystals = [];
    while (placed < n && guard++ < 200) {
      const x = Math.round(cx + (this.rng() - 0.5) * 7);
      const z = Math.round(cz + (this.rng() - 0.5) * 7);
      if (x < 2 || z < 2 || x > S - 3 || z > S - 3) continue;
      if (this.block[z * S + x] & (WATER_BLOCK | STEEP_BLOCK | CLIFF_BLOCK)) continue;
      if (this.block[z * S + x] & NODE_BLOCK) continue;
      this.block[z * S + x] |= NODE_BLOCK;
      crystals.push({ x, z });
      placed++;
    }
    if (!placed) return;
    const per = Math.floor(amount / placed);
    for (const c of crystals) {
      this.nodes.push({
        id: `node-${this.nodes.length}`,
        tx: c.x, tz: c.z,
        x: (c.x + 0.5) * this.tile - this.half,
        z: (c.z + 0.5) * this.tile - this.half,
        y: this.heightAtTile(c.x, c.z),
        amount: per,
        maxAmount: per,
        seed: this.rng() * 100,
      });
    }
  }

  generateDecor() {
    const S = this.size;
    const n = 420;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(this.rng() * S), z = Math.floor(this.rng() * S);
      if (this.block[z * S + x]) continue;
      if (this.moisture[z * S + x] < 0.42) continue;
      const h = this.tileH[z * S + x];
      this.decor.push({
        x: (x + this.rng()) * this.tile - this.half,
        z: (z + this.rng()) * this.tile - this.half,
        y: h, s: 0.6 + this.rng() * 1.1, r: this.rng() * Math.PI * 2,
        kind: this.moisture[z * S + x] > 0.62 ? 'tree' : 'rock',
      });
    }
  }

  /* ---------- выборки ---------- */
  heightAtTile(x, z) {
    const S = this.size;
    x = clamp(x, 0, S); z = clamp(z, 0, S);
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const W = S + 1;
    const h00 = this.heights[zi * W + xi], h10 = this.heights[zi * W + Math.min(S, xi + 1)];
    const h01 = this.heights[Math.min(S, zi + 1) * W + xi], h11 = this.heights[Math.min(S, zi + 1) * W + Math.min(S, xi + 1)];
    return lerp(lerp(h00, h10, xf), lerp(h01, h11, xf), zf);
  }

  /** Мировые координаты -> высота (билинейно) */
  heightAt(wx, wz) {
    const tx = (wx + this.half) / this.tile, tz = (wz + this.half) / this.tile;
    return this.heightAtTile(tx, tz);
  }

  inBounds(tx, tz) { return tx >= 0 && tz >= 0 && tx < this.size && tz < this.size; }
  toTile(wx, wz) { return [Math.floor((wx + this.half) / this.tile), Math.floor((wz + this.half) / this.tile)]; }
  toWorld(tx, tz) { return [(tx + 0.5) * this.tile - this.half, (tz + 0.5) * this.tile - this.half]; }

  isWalkable(tx, tz, flyer = false) {
    if (!this.inBounds(tx, tz)) return false;
    const b = this.block[tz * this.size + tx];
    if (flyer) return !(b & CLIFF_BLOCK);
    return (b & (WATER_BLOCK | STEEP_BLOCK | BUILD_BLOCK | NODE_BLOCK | CLIFF_BLOCK)) === 0;
  }

  isBuildable(tx, tz) {
    if (!this.inBounds(tx, tz)) return false;
    return (this.block[tz * this.size + tx] & (WATER_BLOCK | STEEP_BLOCK | CLIFF_BLOCK | BUILD_BLOCK | NODE_BLOCK)) === 0;
  }

  /** Свободна ли площадка size×size с центром (tx,tz) */
  canPlace(tx, tz, size, ignoreNodes = false) {
    const o = Math.floor(size / 2);
    for (let z = tz - o; z < tz - o + size; z++) {
      for (let x = tx - o; x < tx - o + size; x++) {
        if (!this.inBounds(x, z)) return false;
        const b = this.block[z * this.size + x];
        if (b & (WATER_BLOCK | BUILD_BLOCK | CLIFF_BLOCK)) return false;
        if (b & STEEP_BLOCK) return false;
        if (!ignoreNodes && (b & NODE_BLOCK)) return false;
      }
    }
    return true;
  }

  occupy(tx, tz, size, flag = BUILD_BLOCK) {
    const o = Math.floor(size / 2);
    for (let z = tz - o; z < tz - o + size; z++)
      for (let x = tx - o; x < tx - o + size; x++)
        if (this.inBounds(x, z)) this.block[z * this.size + x] |= flag;
    this.version++;
  }

  free(tx, tz, size, flag = BUILD_BLOCK) {
    const o = Math.floor(size / 2);
    for (let z = tz - o; z < tz - o + size; z++)
      for (let x = tx - o; x < tx - o + size; x++)
        if (this.inBounds(x, z)) this.block[z * this.size + x] &= ~flag;
    this.version++;
  }

  /** Ближайшая проходимая клетка */
  nearestWalkable(tx, tz, maxR = 12) {
    if (this.isWalkable(tx, tz)) return [tx, tz];
    for (let r = 1; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.isWalkable(tx + dx, tz + dz)) return [tx + dx, tz + dz];
        }
      }
    }
    return null;
  }

  /** Свободные клетки в кольце вокруг цели (для облепления) */
  ringFree(tx, tz, radius, flyer = false) {
    const out = [];
    const r0 = Math.ceil(radius / this.tile);
    for (let dz = -r0 - 1; dz <= r0 + 1; dz++) {
      for (let dx = -r0 - 1; dx <= r0 + 1; dx++) {
        const d = Math.hypot(dx, dz);
        if (d < r0 - 0.4) continue;
        if (this.isWalkable(tx + dx, tz + dz, flyer)) out.push([tx + dx, tz + dz]);
      }
    }
    return out;
  }
}

export { WATER_BLOCK, STEEP_BLOCK, BUILD_BLOCK, NODE_BLOCK };
