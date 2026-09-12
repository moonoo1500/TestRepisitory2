import * as THREE from 'three';
import { Entity } from './Entity.js';
import { BUILDINGS } from '../data/defs.js';
import { createBuildingModel, animateBuilding } from '../models/Models.js';
import { dist, angleLerp, rand } from '../core/util.js';

/* =========================================================
   Постройка: возведение, производство, оборона, ауры
   ========================================================= */
const _near = [];

export class Building extends Entity {
  constructor(game, typeId, faction, tx, tz) {
    super(game, BUILDINGS[typeId], faction);
    this.typeId = typeId;
    this.kind = 'building';
    this.tx = tx; this.tz = tz;
    this.size = this.def.size;
    this.sight = this.def.sight;
    const [wx, wz] = game.map.toWorld(tx, tz);
    this.x = wx; this.z = wz;
    this.y = game.map.heightAt(wx, wz);
    this.radius = this.size * game.map.tile * 0.5;

    this.constructing = true;
    this.buildProgress = 0;
    this.hp = this.maxHp * 0.15;

    this.queue = [];
    this.progress = 0;
    this.rally = { x: wx, z: wz + this.size * game.map.tile * 0.6 + 2, set: false };
    this.cooldown = 0;
    this.target = null;
    this.heading = 0;
    this.spawnPoint = { x: wx, z: wz + (this.size * game.map.tile) / 2 + 1.6 };

    this.model = createBuildingModel(typeId, faction);
    this.modelGroup = this.model.group;
    // выравниваем по рельефу
    this.object.position.set(wx, this.y - 0.15, wz);
    this.object.add(this.modelGroup);
    if (this.model.parts.doors) this.model.parts.doors.userData.baseDoorY = this.model.parts.doors.position.y;

    this.buildScaffold = this.createScaffold();
    this.object.add(this.buildScaffold);

    this.powerOut = Math.max(0, this.def.power || 0);
    this.powerIn = Math.max(0, -(this.def.power || 0));
    this.spawnAnim = 0;
    this.modelGroup.scale.setScalar(0.02);
    this.flashTimer = 0;
  }

  createScaffold() {
    const g = new THREE.Group();
    const s = this.size * this.game.map.tile * 0.55;
    const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 0.12), mat);
      post.position.set(Math.cos(a) * s, 2.1, Math.sin(a) * s);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(s * 2.1, 0.1, 0.1), mat);
    beam.position.y = 4.2; g.add(beam);
    const beam2 = beam.clone(); beam2.rotation.y = Math.PI / 2; g.add(beam2);
    g.renderOrder = 5;
    return g;
  }

  get unpowered() { return this.game.powerRatio(this.faction) < 1; }

  update(dt) {
    const pf = this.game.powerFactor(this.faction);

    // --- возведение ---
    if (this.constructing) {
      this.buildProgress += (dt / this.def.buildTime) * pf;
      const r = Math.max(0.15, Math.min(1, this.buildProgress));
      this.hp = this.maxHp * (0.15 + 0.85 * r);
      this.modelGroup.scale.setScalar(0.02 + 0.98 * r);
      this.buildScaffold.visible = true;
      this.buildScaffold.children.forEach((c, i) => { c.position.y = 2.1 * r; c.scale.y = r; });
      if (Math.random() < dt * 6) {
        this.game.fx.sparks(this.x + rand(this.radius, -this.radius), this.y + 1 + r * 2, this.z + rand(this.radius, -this.radius), 0x66e0ff, 2);
      }
      if (this.buildProgress >= 1) {
        this.buildProgress = 1;
        this.constructing = false;
        this.buildScaffold.visible = false;
        this.hp = this.maxHp;
        this.modelGroup.scale.setScalar(1);
        this.game.onBuildingComplete(this);
      }
      return;
    }

    this.spawnAnim = Math.min(1, this.spawnAnim + dt * 3);

    // --- производство ---
    if (this.queue.length && this.def.produces) {
      const q = this.queue[0];
      this.progress += (dt / q.buildTime) * pf;
      if (this.progress >= 1) {
        this.progress = 0;
        this.queue.shift();
        this.game.spawnUnit(q.id, this.faction, this.spawnPoint.x, this.spawnPoint.z, this);
        this.game.onUnitProduced(this, q.id);
      }
    }

    // --- оборона ---
    if (this.def.weapon) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      const w = this.def.weapon;
      if (this.unpowered) {
        this.cooldown = Math.max(this.cooldown, 1 / w.rate);
      }
      this.acquire(w.range);
      if (this.target && !this.target.dead) {
        const d = dist(this.x, this.z, this.target.x, this.target.z);
        if (d <= w.range) {
          this.heading = angleLerp(this.heading, Math.atan2(this.target.x - this.x, this.target.z - this.z), Math.min(1, dt * 5));
          if (this.cooldown <= 0) this.fire(this.target, w);
        }
      }
    }

    // --- аура ---
    if (this.def.aura) {
      const a = this.def.aura;
      const list = this.game.getFriendlyNear(this.faction, this.x, this.z, a.radius, _near);
      for (const e of list) { e.regen = Math.max(e.regen || 0, a.regen); }
      if (Math.random() < dt * 2) {
        const ang = rand(Math.PI * 2), r = rand(a.radius, 0);
        this.game.fx.spawn(this.x + Math.cos(ang) * r, this.y + 0.3, this.z + Math.sin(ang) * r, {
          vy: 1.6, color: 0x5cff9d, size: 0.9, life: 1.2, drag: 0.4, grav: -0.4,
        });
      }
    }

    this.flashTimer = Math.max(0, this.flashTimer - dt);
    animateBuilding(this.typeId, this.model, dt, {
      unpowered: this.unpowered,
      producing: this.queue.length > 0,
      baseDoorY: this.model.parts.doors?.userData.baseDoorY,
    });
  }

  acquire(range) {
    if (this.target && !this.target.dead && dist(this.x, this.z, this.target.x, this.target.z) <= range * 1.05 && this.target.visible) return;
    const w = this.def.weapon;
    const list = this.game.getEnemiesNear(this.faction, this.x, this.z, range, _near);
    let best = null, bd = Infinity;
    for (const e of list) {
      if (!e.visible) continue;
      if (e.def.flying && !w.airCapable) continue;
      const d = dist(this.x, this.z, e.x, e.z);
      if (d < bd) { bd = d; best = e; }
    }
    this.target = best;
  }

  fire(target, w) {
    this.cooldown = 1 / w.rate;
    const sx = this.x, sy = this.y + (this.typeId === 'tesla' ? 3.0 : 1.4), sz = this.z;
    if (w.beam) {
      // цепная молния
      let from = { x: sx, y: sy, z: sz };
      let cur = target;
      const hit = new Set();
      for (let i = 0; i < (w.chain || 1); i++) {
        if (!cur || cur.dead) break;
        hit.add(cur.id);
        this.game.fx.beam(from.x, from.y, from.z, cur.x, cur.y + 1, cur.z, 0xc79bff, 0.18, 0.14 - i * 0.02);
        cur.damage(w.dmg * (1 - i * 0.22), this, w.type);
        this.game.fx.sparks(cur.x, cur.y + 1, cur.z, 0xd9b8ff, 8);
        const next = this.game.getEnemiesNear(this.faction, cur.x, cur.z, 7, _near)
          .filter((e) => !hit.has(e.id) && e.visible)
          .sort((a, b) => dist(cur.x, cur.z, a.x, a.z) - dist(cur.x, cur.z, b.x, b.z))[0];
        from = { x: cur.x, y: cur.y + 1, z: cur.z };
        cur = next;
      }
      this.game.audio.shoot('laser', this.game.cameraRig.distanceTo(this.x, sy, this.z));
      this.game.shake(0.1, 0.12);
    } else {
      this.game.spawnProjectile({ x: sx, y: sy, z: sz, target, source: this, weapon: w, dmgType: w.type });
      this.game.fx.muzzle(sx, sy, sz, (target.x - sx), (target.z - sz));
      this.game.audio.shoot(w.type, this.game.cameraRig.distanceTo(this.x, sy, this.z));
    }
  }

  enqueue(unitId, def) {
    if (this.queue.length >= 5) return false;
    this.queue.push({ id: unitId, buildTime: def.buildTime, def });
    return true;
  }

  setRally(x, z) {
    this.rally.set = true;
    this.rally.x = x; this.rally.z = z;
  }

  die(killer) {
    if (this.dead) return;
    this.dead = true;
    const scale = this.size >= 3 ? 2.6 : 1.5;
    this.game.fx.explosion(this.x, this.y + 1.2, this.z, scale, this.game.factionColor(this.faction));
    this.game.fx.explosion(this.x + rand(2, -2), this.y + 0.6, this.z + rand(2, -2), scale * 0.7, 0xffaa44);
    this.game.audio.explosion(this.game.cameraRig.distanceTo(this.x, this.y, this.z));
    this.game.shake(0.85, 0.6);
    this.game.stats.buildingsDestroyed[this.faction]++;
    if (killer && killer.faction !== this.faction) this.game.stats.kills[killer.faction] += 0;
    this.game.removeEntity(this, killer);
  }

  /** Точки периметра для высадки юнитов */
  spawnSlot(i) {
    const a = (i * 0.9) + Math.PI * 0.5;
    const r = this.radius + 2.2;
    return { x: this.x + Math.cos(a) * r, z: this.z + Math.sin(a) * r };
  }
}
