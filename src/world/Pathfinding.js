import { MinHeap } from '../core/util.js';

/* =========================================================
   Поиск пути: A* для одиночек + поле потока для групп
   ========================================================= */
export class Pathfinder {
  constructor(map) {
    this.map = map;
    this.S = map.size;
    this.N = this.S * this.S;
    this.gScore = new Float32Array(this.N);
    this.cameFrom = new Int32Array(this.N);
    this.stamp = new Int32Array(this.N);
    this.gen = 0;
    this.heap = new MinHeap();
    this.flowCache = new Map();   // ключ -> {cost:Int32Array, gen}
    this.flowVersion = -1;
    this.stats = { paths: 0, nodes: 0 };

    // смещения соседей (8 направлений, стоимость)
    this.dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
    ];
  }

  invalidateFlows() { this.flowVersion++; }

  idx(tx, tz) { return tz * this.S + tx; }

  /** A* -> массив клеток [{x,z}] без стартовой */
  findPath(sx, sz, gx, gz, flyer = false, maxNodes = 26000) {
    const S = this.S;
    if (!this.map.inBounds(sx, sz) || !this.map.inBounds(gx, gz)) return null;
    if (sx === gx && sz === gz) return [];

    // старт из-под постройки/преграды: сначала выбираемся на свободную клетку
    let escape = null;
    if (!this.map.isWalkable(sx, sz, flyer)) {
      escape = this.map.nearestWalkable(sx, sz, 5);
      if (!escape) return null;
      [sx, sz] = escape;
      if (sx === gx && sz === gz) return [{ x: sx, z: sz }];
    }

    // цель недостижима -> ищем ближайшую к ней
    if (!this.map.isWalkable(gx, gz, flyer)) {
      const alt = this.map.nearestWalkable(gx, gz, 8);
      if (!alt) return null;
      [gx, gz] = alt;
      if (sx === gx && sz === gz) return escape ? [{ x: sx, z: sz }] : [];
    }

    const gen = ++this.gen;
    const { gScore, cameFrom, stamp, heap } = this;
    heap.a.length = 0;

    const start = this.idx(sx, sz), goal = this.idx(gx, gz);
    gScore[start] = 0; stamp[start] = gen; cameFrom[start] = -1;
    heap.push({ i: start, f: this.heur(sx, sz, gx, gz) });

    let visited = 0, found = false, best = start, bestF = Infinity;
    const blockedFlags = flyer ? 16 : 0; // CLIFF_BLOCK = 16

    while (heap.size && visited < maxNodes) {
      const cur = heap.pop();
      if (stamp[cur.i] !== gen) continue;
      const cx = cur.i % S, cz = (cur.i / S) | 0;
      if (cur.i === goal) { found = true; best = cur.i; break; }
      const cf = cur.f;
      if (cf < bestF) { bestF = cf; best = cur.i; }
      visited++;

      for (let d = 0; d < 8; d++) {
        const nx = cx + this.dirs[d][0], nz = cz + this.dirs[d][1];
        if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
        const ni = nz * S + nx;
        const b = this.map.block[ni];
        if (b & (blockedFlags | (flyer ? 0 : 31))) continue;
        // не срезать углы через непроходимые диагонали
        if (d >= 4) {
          const b1 = this.map.block[cz * S + nx], b2 = this.map.block[nz * S + cx];
          const mask = flyer ? 16 : 31;
          if ((b1 & mask) && (b2 & mask)) continue;
        }
        const ng = gScore[cur.i] + this.dirs[d][2] * (1 + this.terrainCost(ni));
        if (stamp[ni] === gen && ng >= gScore[ni]) continue;
        gScore[ni] = ng; stamp[ni] = gen; cameFrom[ni] = cur.i;
        heap.push({ i: ni, f: ng + this.heur(nx, nz, gx, gz) });
      }
    }
    this.stats.paths++; this.stats.nodes += visited;

    const target = found ? goal : best;
    if (!found && target === start) return null;

    const path = [];
    let c = target;
    while (c !== -1 && c !== start) {
      path.push({ x: c % S, z: (c / S) | 0 });
      c = cameFrom[c];
    }
    path.reverse();
    if (escape) path.unshift({ x: escape[0], z: escape[1] });
    return path;
  }

  terrainCost(i) {
    const h = this.map.tileH[i];
    const wl = this.map.waterLevel;
    if (h - wl < 1.2) return 0.45;      // мелководье/пляж — вязко
    const m = this.map.moisture[i];
    return m > 0.7 ? 0.25 : 0;          // густая растительность
  }

  heur(ax, az, bx, bz) {
    const dx = Math.abs(ax - bx), dz = Math.abs(az - bz);
    return (dx + dz) + (1.4142 - 2) * Math.min(dx, dz);
  }

  /**
   * Поле потока к цели (BFS с эвристикой по проходимости).
   * Возвращает Int32Array длин — юниты идут к соседу с меньшим значением.
   */
  flowField(gx, gz, flyer = false) {
    const key = `${gx},${gz},${flyer ? 1 : 0},${this.flowVersion}`;
    const cached = this.flowCache.get(key);
    if (cached) return cached;

    const S = this.S;
    const cost = new Int32Array(this.N).fill(-1);
    const queue = new Int32Array(this.N);
    let head = 0, tail = 0;
    const mask = flyer ? 16 : 31;
    if (this.map.block[gz * S + gx] & mask) {
      const alt = this.map.nearestWalkable(gx, gz, 8);
      if (alt) { gx = alt[0]; gz = alt[1]; }
    }
    const gi = gz * S + gx;
    cost[gi] = 0; queue[tail++] = gi;
    while (head < tail) {
      const i = queue[head++];
      const cx = i % S, cz = (i / S) | 0;
      const c = cost[i] + 1;
      for (let d = 0; d < 8; d++) {
        const nx = cx + this.dirs[d][0], nz = cz + this.dirs[d][1];
        if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
        const ni = nz * S + nx;
        if (cost[ni] !== -1) continue;
        if (this.map.block[ni] & mask) continue;
        cost[ni] = d >= 4 ? c + 1 : c;
        queue[tail++] = ni;
      }
    }
    const res = { cost };
    if (this.flowCache.size > 40) {
      const oldest = this.flowCache.keys().next().value;
      this.flowCache.delete(oldest);
    }
    this.flowCache.set(key, res);
    return res;
  }

  /** Следующая клетка по полю потока */
  flowStep(flow, tx, tz) {
    if (!flow) return null;
    const S = this.S;
    const i = tz * S + tx;
    if (flow.cost[i] < 0) return null;
    let bestI = i, bestC = flow.cost[i];
    for (let d = 0; d < 8; d++) {
      const nx = tx + this.dirs[d][0], nz = tz + this.dirs[d][1];
      if (nx < 0 || nz < 0 || nx >= S || nz >= S) continue;
      const ni = nz * S + nx;
      const c = flow.cost[ni];
      if (c >= 0 && c < bestC) { bestC = c; bestI = ni; }
    }
    if (bestI === i) return null;
    return [bestI % S, (bestI / S) | 0];
  }

  /**
   * Сглаживание маршрута (string pulling).
   * Lookahead ограничен, иначе на длинных путях сложность уходит в O(n^3).
   */
  smooth(path, flyer = false, lookahead = 14) {
    if (!path || path.length < 3) return path;
    const out = [path[0]];
    let i = 0;
    const last = path.length - 1;
    while (i < last) {
      const maxJ = Math.min(last, i + lookahead);
      let j = maxJ;
      while (j > i + 1 && !this.lineClear(path[i], path[j], flyer)) j--;
      out.push(path[j]);
      i = j;
    }
    return out;
  }

  lineClear(a, b, flyer = false) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const steps = Math.ceil(Math.hypot(dx, dz) * 2);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = Math.round(a.x + dx * t), z = Math.round(a.z + dz * t);
      if (!this.map.isWalkable(x, z, flyer)) return false;
    }
    return true;
  }

  /** Путь в мировых координатах с учётом высоты */
  findWorldPath(wx, wz, tx, tz, flyer = false) {
    const [sx, sz] = this.map.toTile(wx, wz);
    const [gx, gz] = this.map.toTile(tx, tz);
    const p = this.findPath(sx, sz, gx, gz, flyer);
    if (!p) return null;
    const sm = this.smooth(p, flyer);
    return sm.map((n) => {
      const [x, z] = this.map.toWorld(n.x, n.z);
      return { x, z, y: flyer ? 0 : this.map.heightAt(x, z) };
    });
  }
}
