import * as THREE from 'three';
import { Entity } from './Entity.js';
import { UNITS, dmgMult } from '../data/defs.js';
import { createUnitModel, animateUnit } from '../models/Models.js';
import { angleLerp, clamp, dist, rand } from '../core/util.js';

/* =========================================================
   Юнит: движение по маршруту, локальное расталкивание,
   захват цели, стрельба, добыча кристаллов
   ========================================================= */
const _v = new THREE.Vector3();
const _near = [];

export class Unit extends Entity {
  constructor(game, typeId, faction, x, z) {
    super(game, UNITS[typeId], faction);
    this.typeId = typeId;
    this.kind = 'unit';
    this.x = x; this.z = z;
    this.y = this.def.flying ? (this.def.flyHeight || 4) : game.map.heightAt(x, z);
    this.vx = 0; this.vz = 0;
    this.heading = rand(Math.PI * 2);
    this.desiredHeading = this.heading;
    this.speed = this.def.speed;
    this.radius = this.def.radius;
    this.sight = this.def.sight;

    this.state = 'idle';
    this.orders = [];
    this.path = null;
    this.pathIndex = 0;
    this.repathTimer = 0;
    this.chaseTimer = 0;
    this.destX = x; this.destZ = z;
    this.moving = false;
    this.turnRate = 0;
    this.accel = 0;
    this.stuckTimer = 0;
    this.lastX = x; this.lastZ = z;

    this.target = null;
    this.cooldown = 0;
    this.firing = 0;
    this.attackPoint = null;
    this.holdGround = false;
    this.patrol = null;
    this.patrolIdx = 0;

    this.harvest = { node: null, carrying: 0, phase: 'seek', timer: 0 };
    this.repairTarget = null;

    // визуал
    this.model = createUnitModel(typeId, faction);
    this.modelGroup = this.model.group;
    this.object.add(this.modelGroup);
    this.object.position.set(x, this.y, z);
    if (this.def.flying) {
      this.shadowBlob = null;
    }
    this.dustTimer = 0;
    this.deathTimer = 0;
    this.spawnAnim = 0;
    this.modelGroup.scale.setScalar(0.01);
  }

  /* ================= ПРИКАЗЫ ================= */
  clearOrders() {
    this.orders.length = 0;
    this.path = null;
    this.target = null;
    this.attackPoint = null;
    this.patrol = null;
    this.harvest.node = null;
    this.harvest.phase = 'seek';
    this.state = 'idle';
    this.moving = false;
  }

  orderMove(x, z, opts = {}) {
    if (!opts.keep) this.clearOrders();
    this.orders.push({ type: 'move', x, z });
    this.holdGround = false;
    this.computePath(x, z);
    this.state = 'move';
  }

  orderAttack(target) {
    this.clearOrders();
    this.target = target;
    this.state = 'attack';
  }

  orderAttackMove(x, z) {
    this.clearOrders();
    this.orders.push({ type: 'attackmove', x, z });
    this.attackPoint = { x, z };
    this.computePath(x, z);
    this.state = 'move';
    this.holdGround = false;
  }

  orderStop() {
    this.clearOrders();
    this.holdGround = true;
    this.state = 'idle';
  }

  orderHold() {
    this.clearOrders();
    this.holdGround = true;
    this.state = 'hold';
    this.game.emit('unit-hold', this);
  }

  orderPatrol(points) {
    if (!points || points.length < 2) return;
    this.clearOrders();
    this.patrol = points.slice();
    this.patrolIdx = 0;
    this.nextPatrolPoint();
  }

  nextPatrolPoint() {
    if (!this.patrol) return;
    const p = this.patrol[this.patrolIdx % this.patrol.length];
    this.patrolIdx++;
    this.orders.push({ type: 'patrol', x: p.x, z: p.z });
    this.computePath(p.x, p.z);
    this.state = 'move';
  }

  orderHarvest(node) {
    this.clearOrders();
    this.harvest.node = node;
    this.harvest.phase = 'toNode';
    this.state = 'harvest';
    this.computePath(node.x, node.z);
  }

  computePath(x, z) {
    this.destX = x; this.destZ = z;
    const p = this.game.pathfinder.findWorldPath(this.x, this.z, x, z, this.def.flying);
    if (p && p.length) {
      this.path = p;
      this.pathIndex = 0;
      this.moving = true;
    } else {
      // прямой рывок, если рядом
      this.path = [{ x, z, y: this.def.flying ? this.y : this.game.map.heightAt(x, z) }];
      this.pathIndex = 0;
      this.moving = true;
    }
  }

  /* ================= ОБНОВЛЕНИЕ ================= */
  update(dt) {
    this.spawnAnim = Math.min(1, this.spawnAnim + dt * 2.4);
    const s = this.spawnAnim;
    this.modelGroup.scale.setScalar(0.01 + 0.99 * (s < 1 ? s * s * (3 - 2 * s) : 1));

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.firing = Math.max(0, this.firing - dt * 4);
    if (this.regen) this.heal(this.regen * dt);

    switch (this.state) {
      case 'move': this.updateMove(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'harvest': this.updateHarvest(dt); break;
      case 'hold':
      case 'idle': this.updateIdle(dt); break;
    }

    this.applyMovement(dt);
    this.applyVisual(dt);
  }

  updateIdle(dt) {
    this.moving = false;
    if (this.def.weapon && !this.holdGround) this.acquireTarget(this.sight);
    else if (this.def.weapon && this.holdGround) this.acquireTarget(this.def.weapon.range);
  }

  updateMove(dt) {
    // авто-захват по дороге
    if (this.def.weapon) {
      const isAttackMove = this.orders[0]?.type === 'attackmove';
      if (isAttackMove || !this.holdGround) {
        this.acquireTarget(isAttackMove ? this.sight * 1.1 : this.def.weapon.range * 0.85);
        if (this.target) { this.state = 'attack'; return; }
      }
    }
    if (!this.path || this.pathIndex >= this.path.length) { this.arrive(); return; }
    const wp = this.path[this.pathIndex];
    const d = dist(this.x, this.z, wp.x, wp.z);
    if (d < 1.05) { this.pathIndex++; return; }
    this.steer(wp.x, wp.z, dt);

    // пересчёт, если путь заблокирован новой постройкой
    this.repathTimer -= dt;
    if (this.repathTimer <= 0) {
      this.repathTimer = 0.9;
      const [tx, tz] = this.game.map.toTile(this.x, this.z);
      if (!this.game.map.isWalkable(tx, tz, this.def.flying) && !this.def.flying) {
        this.computePath(this.destX, this.destZ);
      }
    }
  }

  arrive() {
    this.path = null;
    this.moving = false;
    const o = this.orders.shift();
    if (!o) { this.state = 'idle'; return; }
    if (o.type === 'attackmove') { this.state = 'idle'; return; }
    if (o.type === 'patrol') { this.nextPatrolPoint(); return; }
    this.state = 'idle';
  }

  updateAttack(dt) {
    const t = this.target;
    if (!t || t.dead) {
      this.target = null;
      if (this.orders.length && this.orders[0].type === 'attackmove') { this.state = 'move'; return; }
      this.state = this.orders.length ? 'move' : 'idle';
      return;
    }
    const w = this.def.weapon;
    const d = dist(this.x, this.z, t.x, t.z);
    if (d > w.range * 0.94) {
      if (!this.holdGround) {
        this.chaseTimer = (this.chaseTimer || 0) - dt;
        const stale = !this.path || this.pathIndex >= this.path.length
          || dist(this.x, this.z, this.destX, this.destZ) < 1.2;
        // не чаще 2 раз в секунду: иначе недостижимая цель роняет FPS
        if (stale && this.chaseTimer <= 0) {
          this.chaseTimer = 0.5;
          this.computePath(t.x, t.z);
        }
        this.updateMove(dt);
        this.state = 'attack';
        return;
      }
    } else {
      this.path = null;
      this.moving = false;
      this.aimAt(t, dt);
      if (this.cooldown <= 0) this.fire(t);
    }
    // доворот корпуса
    this.desiredHeading = Math.atan2(t.x - this.x, t.z - this.z);
  }

  aimAt(t, dt) {
    this.desiredHeading = Math.atan2(t.x - this.x, t.z - this.z);
  }

  acquireTarget(radius) {
    if (!this.def.weapon || this.target && !this.target.dead) return;
    const w = this.def.weapon;
    const list = this.game.getEnemiesNear(this.faction, this.x, this.z, radius, _near);
    let best = null, bestScore = Infinity;
    for (const e of list) {
      if (!e.visible) continue;
      if (e.def.flying && !w.airCapable && !this.def.flying) {
        // наземные без ПВО не стреляют по воздуху
        if (w.type !== 'missile' && w.type !== 'laser') continue;
      }
      const d = dist(this.x, this.z, e.x, e.z);
      const prio = (e.kind === 'unit' ? 0 : 40) + (e.def.weapon ? 0 : 20);
      const score = d + prio;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) {
      this.target = best;
      if (this.state === 'idle' || this.state === 'hold') this.state = 'attack';
    }
  }

  fire(target) {
    const w = this.def.weapon;
    this.cooldown = 1 / w.rate;
    this.firing = 1;
    const dx = target.x - this.x, dz = target.z - this.z;
    const len = Math.hypot(dx, dz) || 1;
    const sx = this.x + (dx / len) * (this.radius + 0.5);
    const sz = this.z + (dz / len) * (this.radius + 0.5);
    const sy = this.y + (this.typeId === 'bastion' ? 1.3 : this.typeId === 'mortar' ? 2.2 : this.typeId === 'guardian' ? 2.1 : this.def.flying ? -0.2 : 1.25);
    this.game.spawnProjectile({
      x: sx, y: sy, z: sz,
      target, source: this, weapon: w,
      dmgType: w.type,
    });
    this.game.audio.shoot(w.type, this.game.cameraRig.distanceTo(this.x, this.y, this.z));
    this.game.shake(this.def.weapon.splash ? 0.14 : 0.05, 0.12);
  }

  /* ================= ДОБЫЧА ================= */
  updateHarvest(dt) {
    const H = this.harvest;
    const def = this.def.harvest;
    if (!H.node || H.node.amount <= 0) {
      // ищем новую жилу
      const node = this.game.findNearestNode(this.x, this.z);
      if (!node) { this.state = 'idle'; this.orders.length = 0; return; }
      H.node = node;
      H.phase = 'toNode';
      this.computePath(node.x, node.z);
    }
    switch (H.phase) {
      case 'toNode': {
        if (!this.path || this.pathIndex >= this.path.length) {
          const d = dist(this.x, this.z, H.node.x, H.node.z);
          if (d < def.seek) { H.phase = 'mining'; H.timer = 0; this.moving = false; this.path = null; }
          else this.computePath(H.node.x, H.node.z);
        } else {
          const wp = this.path[this.pathIndex];
          if (dist(this.x, this.z, wp.x, wp.z) < 1.05) this.pathIndex++;
          else this.steer(wp.x, wp.z, dt);
        }
        if (dist(this.x, this.z, H.node.x, H.node.z) < def.seek) { H.phase = 'mining'; H.timer = 0; this.moving = false; this.path = null; }
        break;
      }
      case 'mining': {
        this.moving = false;
        this.desiredHeading = Math.atan2(H.node.x - this.x, H.node.z - this.z);
        H.timer += dt * this.game.powerFactor(this.faction);
        if (Math.random() < dt * 8) {
          this.game.fx.sparks(H.node.x, H.node.y + 1, H.node.z, 0x8be9ff, 3);
        }
        if (H.timer >= 1) {
          H.timer = 0;
          const take = Math.min(def.rate, def.capacity - H.carrying, H.node.amount);
          H.carrying += take;
          H.node.amount -= take;
          this.game.onCrystalMined(this.faction, 0);
          if (H.carrying >= def.capacity || H.node.amount <= 0) {
            H.phase = 'toDrop';
            const drop = this.game.nearestDropoff(this.faction, this.x, this.z);
            if (!drop) { this.state = 'idle'; return; }
            this.computePath(drop.x, drop.z + (this.game.map.size ? 0 : 0) + 0);
            this.harvest.drop = drop;
          }
        }
        break;
      }
      case 'toDrop': {
        const drop = this.harvest.drop;
        if (!drop || drop.dead) { H.phase = 'toNode'; this.path = null; break; }
        const d = dist(this.x, this.z, drop.x, drop.z);
        const reach = (drop.def.size * this.game.map.tile) / 2 + 2.2;
        if (d < reach) { H.phase = 'deposit'; H.timer = 0; this.moving = false; this.path = null; }
        else {
          if (!this.path || this.pathIndex >= this.path.length) this.computePath(drop.x, drop.z);
          else {
            const wp = this.path[this.pathIndex];
            if (dist(this.x, this.z, wp.x, wp.z) < 1.05) this.pathIndex++;
            else this.steer(wp.x, wp.z, dt);
          }
        }
        break;
      }
      case 'deposit': {
        this.moving = false;
        H.timer += dt * 1.4 * this.game.powerFactor(this.faction);
        if (H.timer >= 1) {
          H.timer = 0;
          this.game.onCrystalMined(this.faction, H.carrying);
          H.carrying = 0;
          H.phase = 'toNode';
          this.computePath(H.node.x, H.node.z);
        }
        break;
      }
    }
  }

  /* ================= ДВИЖЕНИЕ ================= */
  steer(tx, tz, dt) {
    let dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;

    // расталкивание с соседями
    let pushX = 0, pushZ = 0;
    if (!this.def.flying) {
      const near = this.game.unitHash.query(this.x, this.z, this.radius * 3.2, _near);
      for (const o of near) {
        if (o === this || o.dead || o.def.flying) continue;
        const ox = this.x - o.x, oz = this.z - o.z;
        const od = Math.hypot(ox, oz);
        const min = this.radius + o.radius;
        if (od < min && od > 0.0001) {
          const f = (min - od) / min;
          pushX += (ox / od) * f * 2.6;
          pushZ += (oz / od) * f * 2.6;
        }
      }
      // мягкое отталкивание от непроходимых клеток
      const probe = 0.9;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const px = this.x + Math.cos(ang) * probe * (this.radius + 0.6);
        const pz = this.z + Math.sin(ang) * probe * (this.radius + 0.6);
        const [tx2, tz2] = this.game.map.toTile(px, pz);
        if (!this.game.map.isWalkable(tx2, tz2)) {
          pushX -= Math.cos(ang) * 0.8;
          pushZ -= Math.sin(ang) * 0.8;
        }
      }
    }

    const sp = this.speed * this.game.powerFactor(this.faction);
    const ax = (dx * sp + pushX - this.vx) * 7;
    const az = (dz * sp + pushZ - this.vz) * 7;
    this.vx += clamp(ax, -30, 30) * dt;
    this.vz += clamp(az, -30, 30) * dt;
    this.moving = true;
    this.desiredHeading = Math.atan2(dx + pushX * 0.4, dz + pushZ * 0.4);
  }

  applyMovement(dt) {
    const maxSpd = this.speed * this.game.powerFactor(this.faction);
    const spd = Math.hypot(this.vx, this.vz);
    if (spd > maxSpd) { this.vx *= maxSpd / spd; this.vz *= maxSpd / spd; }
    if (!this.moving) {
      const dmp = Math.exp(-6 * dt);
      this.vx *= dmp; this.vz *= dmp;
    }
    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;

    if (!this.def.flying) {
      const [ctx2, ctz2] = this.game.map.toTile(this.x, this.z);
      // если юнита замуровали своей же постройкой — разрешаем выбраться
      const trapped = !this.game.map.isWalkable(ctx2, ctz2);
      const [tx, tz] = this.game.map.toTile(nx, nz);
      if (trapped || this.game.map.isWalkable(tx, tz)) {
        this.x = nx; this.z = nz;
        this.stuckTimer = 0;
      } else {
        // скользящее движение по осям
        const [tx1] = this.game.map.toTile(nx, this.z);
        const [, tz1] = this.game.map.toTile(this.x, nz);
        if (this.game.map.isWalkable(tx1, this.game.map.toTile(this.x, this.z)[1])) this.x = nx;
        else this.vx *= -0.3;
        if (this.game.map.isWalkable(this.game.map.toTile(this.x, this.z)[0], tz1)) this.z = nz;
        else this.vz *= -0.3;
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.1) {
          this.stuckTimer = 0;
          if (this.state === 'move' || this.state === 'harvest') this.computePath(this.destX, this.destZ);
        }
      }
      const h = this.game.map.heightAt(this.x, this.z);
      this.y += (h - this.y) * Math.min(1, dt * 12);
      // пыль под ногами
      if (spd > 1.4) {
        this.dustTimer -= dt;
        if (this.dustTimer <= 0) {
          this.dustTimer = 0.16;
          this.game.fx.dust(this.x, this.y + 0.1, this.z, this.typeId === 'bastion' ? 3 : 1);
        }
      }
    } else {
      this.x = nx; this.z = nz;
      const targetY = (this.def.flyHeight || 4) + Math.sin(this.game.time * 1.6 + this.id) * 0.25;
      this.y += (targetY - this.y) * Math.min(1, dt * 3);
    }

    const prev = this.heading;
    this.heading = angleLerp(this.heading, this.desiredHeading, Math.min(1, dt * 9));
    this.turnRate = (this.heading - prev) / Math.max(dt, 0.0001);
    this.accel = Math.hypot(this.vx, this.vz) / maxSpd;
  }

  applyVisual(dt) {
    this.object.position.set(this.x, this.y, this.z);
    this.modelGroup.rotation.y = this.heading;
    // наклон корпуса на склоне
    if (!this.def.flying) {
      const m = this.game.map;
      const hx = m.heightAt(this.x + 1, this.z) - m.heightAt(this.x - 1, this.z);
      const hz = m.heightAt(this.x, this.z + 1) - m.heightAt(this.x, this.z - 1);
      this.modelGroup.rotation.z += (-hx * 0.09 - this.modelGroup.rotation.z) * Math.min(1, dt * 5);
      this.modelGroup.rotation.x += (hz * 0.09 - this.modelGroup.rotation.x) * Math.min(1, dt * 5);
    }
    animateUnit(this.typeId, this.model, {
      moving: this.moving && Math.hypot(this.vx, this.vz) > 0.6,
      turnRate: this.turnRate,
      accel: this.accel,
      speedPx: Math.hypot(this.vx, this.vz),
      cargoRatio: this.harvest.carrying / (this.def.harvest?.capacity || 1),
      harvesting: this.harvest.phase === 'mining',
      firing: this.firing > 0.1,
    }, dt);
  }

  /** Мировая точка выстрела (для снарядов и эффектов) */
  muzzlePoint() {
    const a = this.heading;
    const r = this.radius + 0.6;
    return {
      x: this.x - Math.sin(a) * r,
      y: this.y + (this.def.flying ? 0 : 1.3),
      z: this.z - Math.cos(a) * r,
    };
  }

  die(killer) {
    if (this.dead) return;
    this.dead = true;
    this.game.fx.explosion(this.x, this.y + 0.6, this.z, this.def.radius * 0.8, this.game.factionColor(this.faction));
    this.game.audio.explosion(this.game.cameraRig.distanceTo(this.x, this.y, this.z));
    this.game.shake(0.3, 0.28);
    this.game.stats.losses[this.faction]++;
    if (killer && killer.faction !== this.faction) this.game.stats.kills[killer.faction]++;
    this.game.removeEntity(this, killer);
  }

  select(v) {
    this.selected = v;
  }

  get cargoRatio() { return this.harvest.carrying / this.def.harvest.capacity; }
}
