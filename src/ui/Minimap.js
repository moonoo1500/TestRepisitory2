import { clamp } from '../core/util.js';

/* =========================================================
   Миникарта: террейн, туман, юниты, рамка камеры
   ========================================================= */
export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.timer = 0;
    this.base = document.createElement('canvas');
    this.base.width = this.size; this.base.height = this.size;
    this.renderBase();
    this.ping = [];
  }

  /** Статичный слой ландшафта */
  renderBase() {
    const g = this.base.getContext('2d');
    const map = this.game.map;
    const S = map.size;
    const img = g.createImageData(this.size, this.size);
    for (let py = 0; py < this.size; py++) {
      for (let px = 0; px < this.size; px++) {
        const tx = Math.floor((px / this.size) * S);
        const tz = Math.floor((py / this.size) * S);
        const i = tz * S + tx;
        const h = map.tileH[i];
        const wl = map.waterLevel;
        let r, gr, b;
        if (h < wl) { const k = clamp((wl - h) / 6, 0, 1); r = 12; gr = 40 - k * 12; b = 66 + k * 20; }
        else if (h < wl + 1.4) { r = 176; gr = 156; b = 112; }
        else if (h > 8.5) { r = 200; gr = 210; b = 218; }
        else {
          const m = map.moisture[i];
          r = 58 + m * 30; gr = 96 + m * 34; b = 56 + m * 14;
          if (map.block[i] & 2) { r = 96; gr = 92; b = 88; }
        }
        const o = (py * this.size + px) * 4;
        img.data[o] = r; img.data[o + 1] = gr; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  toMap(px, py) {
    const map = this.game.map;
    return {
      x: (px / this.size) * map.worldSize - map.worldSize / 2,
      z: (py / this.size) * map.worldSize - map.worldSize / 2,
    };
  }

  toPixel(wx, wz) {
    const map = this.game.map;
    return {
      x: ((wx + map.worldSize / 2) / map.worldSize) * this.size,
      y: ((wz + map.worldSize / 2) / map.worldSize) * this.size,
    };
  }

  addPing(wx, wz, color = '#00e5ff') {
    this.ping.push({ x: wx, z: wz, t: 0, color });
  }

  update(dt) {
    this.timer += dt;
    for (let i = this.ping.length - 1; i >= 0; i--) {
      this.ping[i].t += dt;
      if (this.ping[i].t > 1.1) this.ping.splice(i, 1);
    }
    if (this.timer < 0.06) return;
    this.timer = 0;
    this.draw();
  }

  draw() {
    const ctx = this.ctx, g = this.game, size = this.size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.base, 0, 0);

    // туман войны поверх ландшафта
    const fog = g.fog;
    if (fog) {
      if (!this._fogCanvas || this._fogCanvas.width !== fog.res) {
        this._fogCanvas = document.createElement('canvas');
        this._fogCanvas.width = fog.res; this._fogCanvas.height = fog.res;
        this._fogCtx = this._fogCanvas.getContext('2d');
        this._fogImg = this._fogCtx.createImageData(fog.res, fog.res);
      }
      const fc = this._fogCanvas;
      const fctx = this._fogCtx;
      const img = this._fogImg;
      for (let i = 0; i < fog.grid.length; i++) {
        const v = fog.grid[i];
        img.data[i * 4] = 2; img.data[i * 4 + 1] = 6; img.data[i * 4 + 2] = 12;
        img.data[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 130 : 232;
      }
      fctx.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fc, 0, 0, size, size);
      ctx.restore();
    }

    // жилы
    ctx.fillStyle = '#b47cff';
    for (const n of g.map.nodes) {
      if (n.amount <= 0) continue;
      const p = this.toPixel(n.x, n.z);
      if (!g.fog.isExplored(n.x, n.z)) continue;
      const s = 1.6 + 1.8 * (n.amount / n.maxAmount);
      ctx.globalAlpha = g.fog.isVisible(n.x, n.z) ? 1 : 0.45;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // постройки и юниты
    for (const e of g.entities) {
      if (e.dead || !e.visible) continue;
      const p = this.toPixel(e.x, e.z);
      const col = e.faction === 'player' ? '#35d0ff' : '#ff5566';
      ctx.fillStyle = col;
      if (e.kind === 'building') {
        const s = Math.max(3, e.size * 2.4);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        if (e.constructing) {
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x - s / 2 - 1, p.y - s / 2 - 1, s + 2, s + 2);
        }
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, e.selected ? 2.4 : 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // рамка камеры
    const rig = g.cameraRig;
    const cam = g.camera;
    const w = innerWidth, h = innerHeight;
    const pts = [
      [-1, -1], [1, -1], [1, 1], [-1, 1],
    ].map(([x, y]) => {
      const wp = rig.screenToWorld(x, y, g.map.heightAt(rig.target.x, rig.target.z));
      return wp ? this.toPixel(wp.x, wp.z) : null;
    }).filter(Boolean);
    if (pts.length === 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
    }

    // пинги
    for (const pi of this.ping) {
      const p = this.toPixel(pi.x, pi.z);
      const k = pi.t / 1.1;
      ctx.strokeStyle = pi.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + k * 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // рамка
    ctx.strokeStyle = 'rgba(0,229,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }
}
