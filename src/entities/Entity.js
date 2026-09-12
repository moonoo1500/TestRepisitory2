import * as THREE from 'three';
import { FACTIONS } from '../data/defs.js';

/* =========================================================
   Базовая сущность: здоровье, принадлежность, полоска HP,
   кольцо выделения
   ========================================================= */
const BAR_BG = new THREE.MeshBasicMaterial({ color: 0x0a0f14, transparent: true, opacity: 0.85, depthTest: false });
const BAR_FILL_MAT = new THREE.MeshBasicMaterial({ color: 0x4dff88, transparent: true, depthTest: false });
const SHIELD_MAT = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9, depthTest: false });
const BAR_GEO = new THREE.PlaneGeometry(1, 1);
const RING_GEO = new THREE.RingGeometry(0.86, 1.0, 28);
RING_GEO.rotateX(-Math.PI / 2);

export let NEXT_ID = 1;

export class Entity {
  constructor(game, def, faction) {
    this.game = game;
    this.id = NEXT_ID++;
    this.def = def;
    this.faction = faction;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.armor = def.armorVal || 0;
    this.dead = false;
    this.visible = true;       // виден ли игроку (туман войны)
    this.object = new THREE.Group();
    this.object.userData.entity = this;
    this.selected = false;
    this.hovered = false;
    this.regen = 0;
    this.buildProgress = 1;    // <1 пока строится
    this.constructing = false;
    this._barVisible = false;
    this.createOverlays();
  }

  createOverlays() {
    const isB = !!this.def.size;
    const s = isB ? this.def.size * 1.9 : this.def.radius * 2.6;

    this.ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({
      color: FACTIONS[this.faction].color, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide,
    }));
    this.ring.scale.setScalar(s);
    this.ring.position.y = 0.12;
    this.ring.renderOrder = 30;
    this.ring.visible = false;
    this.object.add(this.ring);

    // рамка выделения (квадрат со скосами)
    this.selBox = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false, side: THREE.DoubleSide,
    }));
    this.selBox.scale.setScalar(s * 1.12);
    this.selBox.position.y = 0.14;
    this.selBox.renderOrder = 31;
    this.selBox.visible = false;
    this.object.add(this.selBox);

    // полоска HP
    this.barGroup = new THREE.Group();
    const w = isB ? this.def.size * 2.1 : Math.max(1.5, this.def.radius * 2.4);
    const h = isB ? 0.34 : 0.26;
    this.barBg = new THREE.Mesh(BAR_GEO, BAR_BG);
    this.barBg.scale.set(w + 0.12, h + 0.1, 1);
    this.barBg.renderOrder = 32;
    this.barFill = new THREE.Mesh(BAR_GEO, BAR_FILL_MAT);
    this.barFill.scale.set(w, h, 1);
    this.barFill.position.z = 0.01;
    this.barFill.renderOrder = 33;
    this.barGroup.add(this.barBg, this.barFill);
    this.barGroup.position.y = (isB ? 3.4 : 2.6);
    this.barGroup.visible = false;
    this.object.add(this.barGroup);
    this.barWidth = w;
  }

  get hpRatio() { return Math.max(0, this.hp / this.maxHp); }

  damage(amount, source, type = 'bullet') {
    if (this.dead) return 0;
    const dealt = Math.max(1, amount - this.armor * 0.35);
    this.hp -= dealt;
    this._barVisible = true;
    this.game.onEntityDamaged(this, dealt, source, type);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(source);
    }
    return dealt;
  }

  heal(amount) {
    if (this.dead || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  die(killer) { this.game.removeEntity(this, killer); }

  /** Обновление оверлеев: полоска и рамки */
  updateOverlays(camera, force = false) {
    const show = this.selected || this.hovered || force;
    this.ring.visible = show;
    if (this.selected) {
      this.ring.material.opacity = 0.95;
      this.ring.material.color.setHex(0xffffff);
    } else {
      this.ring.material.opacity = 0.7;
      this.ring.material.color.setHex(FACTIONS[this.faction].color);
    }
    this.selBox.visible = this.hovered && !this.selected;

    const needBar = this.visible && (this.selected || this.hp < this.maxHp || this.constructing);
    if (needBar !== this._barVisible) {
      this.barGroup.visible = needBar;
      this._barVisible = needBar;
    }
    if (needBar) {
      const r = this.hpRatio;
      this.barFill.scale.x = Math.max(0.001, this.barWidth * r);
      this.barFill.position.x = -(this.barWidth * (1 - r)) / 2;
      const col = r > 0.6 ? 0x4dff88 : r > 0.3 ? 0xffc24d : 0xff4d5e;
      if (this.barFill.material.color.getHex() !== col) this.barFill.material = matFor(col);
      if (this.constructing) {
        this.barFill.material = matFor(0x00e5ff);
        this.barFill.scale.x = Math.max(0.001, this.barWidth * this.buildProgress);
        this.barFill.position.x = -(this.barWidth * (1 - this.buildProgress)) / 2;
      }
      this.barGroup.quaternion.copy(camera.quaternion);
    }
  }
}

const _matCache = new Map();
function matFor(hex) {
  let m = _matCache.get(hex);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, depthTest: false }); _matCache.set(hex, m); }
  return m;
}

export { BAR_GEO, RING_GEO, SHIELD_MAT };
