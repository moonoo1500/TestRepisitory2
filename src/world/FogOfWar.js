import * as THREE from 'three';

/* =========================================================
   Туман войны: 3 состояния (неизведано / разведано / видно)
   Текстура подаётся в шейдер ландшафта и в миникарту
   ========================================================= */
const UNSEEN = 0, EXPLORED = 1, VISIBLE = 2;
const LEVEL_VALUE = [0.0, 0.34, 1.0];

export class FogOfWar {
  constructor(map, res = 96) {
    this.map = map;
    this.res = res;
    this.grid = new Uint8Array(res * res);
    this.canvas = document.createElement('canvas');
    this.canvas.width = res; this.canvas.height = res;
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(res, res);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.NoColorSpace;
    this.timer = 0;
    this.dirty = true;
  }

  reset() { this.grid.fill(UNSEEN); this.dirty = true; this.flush(); }

  /** Проявить круг обзора */
  reveal(wx, wz, radius) {
    const res = this.res, S = this.map.worldSize;
    const cx = ((wx + S / 2) / S) * res;
    const cz = ((wz + S / 2) / S) * res;
    const r = (radius / S) * res;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(res - 1, Math.ceil(cx + r));
    const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(res - 1, Math.ceil(cz + r));
    for (let z = z0; z <= z1; z++) {
      const dz = z + 0.5 - cz;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        const i = z * res + x;
        // ВАЖНО: только повышаем уровень. Понижение «видно -> разведано»
        // делает beginFrame(), иначе перекрывающиеся зоны обзора гасят друг друга.
        const v = d2 < r2 * 0.82 ? VISIBLE : EXPLORED;
        if (v > this.grid[i]) this.grid[i] = v;
      }
    }
    this.dirty = true;
  }

  /** Полный кадр: сбрасываем «видно», затем все наблюдатели */
  beginFrame() {
    const g = this.grid;
    for (let i = 0; i < g.length; i++) if (g[i] === VISIBLE) g[i] = EXPLORED;
  }

  isExplored(wx, wz) {
    const res = this.res, S = this.map.worldSize;
    const x = Math.floor(((wx + S / 2) / S) * res), z = Math.floor(((wz + S / 2) / S) * res);
    if (x < 0 || z < 0 || x >= res || z >= res) return false;
    return this.grid[z * res + x] !== UNSEEN;
  }

  isVisible(wx, wz) {
    const res = this.res, S = this.map.worldSize;
    const x = Math.floor(((wx + S / 2) / S) * res), z = Math.floor(((wz + S / 2) / S) * res);
    if (x < 0 || z < 0 || x >= res || z >= res) return false;
    return this.grid[z * res + x] === VISIBLE;
  }

  update(dt, observers) {
    this.timer += dt;
    if (this.timer < 0.16 && !this.dirty) return;
    this.timer = 0;
    this.beginFrame();
    for (const o of observers) {
      if (o.dead || !o.visible) continue;
      this.reveal(o.x, o.z, o.sight || 8);
    }
    this.flush();
  }

  flush() {
    const d = this.image.data;
    const g = this.grid, n = this.res * this.res;
    for (let i = 0; i < n; i++) {
      const v = Math.round(LEVEL_VALUE[g[i]] * 255);
      d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.texture.needsUpdate = true;
    this.dirty = false;
  }
}

export { UNSEEN, EXPLORED, VISIBLE };
