import * as THREE from 'three';
import { dmgMult } from '../data/defs.js';
import { dist } from '../core/util.js';

/* =========================================================
   Снаряды: пули, ракеты, плазма, навесная траектория
   ========================================================= */
const COLORS = {
  bullet: 0xffe28a,
  cannon: 0xffb04d,
  missile: 0xff8a5c,
  laser: 0x8be9ff,
  bomb: 0xffd07a,
};

export class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geo = new THREE.SphereGeometry(0.14, 6, 5);
    this.geoMissile = new THREE.ConeGeometry(0.14, 0.6, 6);
    this.geoMissile.rotateX(-Math.PI / 2);
    this.pool = [];
  }

  spawn(cfg) {
    const w = cfg.weapon;
    let mesh = this.pool.pop();
    const color = COLORS[cfg.dmgType] || 0xffffff;
    if (w.beam) {
      // мгновенный луч
      cfg.game.fx.beam(cfg.x, cfg.y, cfg.z, cfg.target.x, cfg.target.y + 0.8, cfg.target.z, color, 0.1, 0.09);
      this.hit(cfg);
      return;
    }
    if (!mesh) {
      mesh = new THREE.Mesh(w.type === 'missile' || w.type === 'bomb' ? this.geoMissile : this.geo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false }));
    }
    mesh.material.color.setHex(color);
    mesh.visible = true;
    mesh.scale.setScalar(w.type === 'cannon' ? 1.5 : w.type === 'bomb' ? 1.8 : 1);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    this.scene.add(mesh);
    this.items.push({
      mesh, x: cfg.x, y: cfg.y, z: cfg.z,
      tx: cfg.target.x, ty: (cfg.target.y || 0) + 0.8, tz: cfg.target.z,
      target: cfg.target, source: cfg.source, weapon: w,
      speed: w.speed, life: 4, arc: !!w.arc, t: 0,
      sx: cfg.x, sy: cfg.y, sz: cfg.z, game: cfg.game, trail: 0,
    });
  }

  hit(p) {
    const w = p.weapon;
    const g = p.game;
    const mult = dmgMult(p.weapon.type, p.target.def.armor);
    if (w.splash) {
      const list = g.getEnemiesNear(p.source.faction, p.tx, p.tz, w.splash, []);
      for (const e of list) {
        const d = dist(p.tx, p.tz, e.x, e.z);
        const falloff = 1 - (d / w.splash) * 0.6;
        const m = dmgMult(w.type, e.def.armor);
        e.damage(w.dmg * falloff * m, p.source, w.type);
      }
      g.fx.explosion(p.tx, p.ty, p.tz, Math.min(2.2, 0.7 + w.splash * 0.28), 0xff9a3d);
      g.audio.explosion(g.cameraRig.distanceTo(p.tx, p.ty, p.tz));
      g.shake(w.splash > 3 ? 0.45 : 0.22, 0.25);
    } else {
      const dmg = w.dmg * mult;
      p.target.damage(dmg, p.source, w.type);
      g.fx.sparks(p.tx, p.ty, p.tz, COLORS[w.type] || 0xffe28a, 6);
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      p.t += dt;
      // наведение на движущуюся цель
      if (p.target && !p.target.dead) {
        p.tx = p.target.x; p.tz = p.target.z; p.ty = (p.target.y || 0) + (p.target.def.flying ? 0 : 0.9);
      }
      const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z;
      const d = Math.hypot(dx, dy, dz);
      const step = p.speed * dt;
      if (d <= step || p.life <= 0) {
        this.hit(p);
        this.recycle(p, i);
        continue;
      }
      const k = step / d;
      p.x += dx * k; p.y += dy * k; p.z += dz * k;
      if (p.arc) {
        const prog = 1 - d / Math.max(1, Math.hypot(p.tx - p.sx, p.tz - p.sz));
        p.y += Math.sin(prog * Math.PI) * 2.4 * dt * 8;
      }
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.weapon.type === 'missile' || p.weapon.type === 'bomb') {
        p.mesh.lookAt(p.tx, p.ty, p.tz);
      }
      // след
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = 0.02;
        const col = p.weapon.type === 'missile' ? 0xffb066 : p.weapon.type === 'bomb' ? 0xffd07a : 0x9fe8ff;
        p.game.fx.spawn(p.x, p.y, p.z, {
          vx: 0, vy: 0.2, vz: 0, color: col, size: 0.6, life: 0.28, drag: 3, grav: 0, alpha: 0.7,
        });
      }
    }
  }

  recycle(p, i) {
    this.scene.remove(p.mesh);
    p.mesh.visible = false;
    if (this.pool.length < 120) this.pool.push(p.mesh);
    this.items.splice(i, 1);
  }

  clear() {
    for (const p of this.items) { this.scene.remove(p.mesh); if (this.pool.length < 120) this.pool.push(p.mesh); }
    this.items.length = 0;
  }
}
