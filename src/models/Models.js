import * as THREE from 'three';
import { UNITS, BUILDINGS, FACTIONS } from '../data/defs.js';

/* =========================================================
   Процедурные low-poly модели юнитов и построек.
   Каждая модель возвращает { group, parts, update(dt, ctx) }
   ========================================================= */

const GEO = {}; // кэш геометрий
function geo(key, make) { return (GEO[key] ||= make()); }

const MAT = { cache: new Map() };
function mat(key, opts) {
  if (!MAT.cache.has(key)) MAT.cache.set(key, new THREE.MeshStandardMaterial(opts));
  return MAT.cache.get(key);
}

const metal = (color, rough = 0.55, metal2 = 0.75) =>
  mat(`m${color}${rough}${metal2}`, { color, roughness: rough, metalness: metal2, flatShading: true });
const dark = (c = 0x2a2f36) => mat(`d${c}`, { color: c, roughness: 0.85, metalness: 0.3, flatShading: true });
function glow(color, intensity = 2.2) {
  return mat(`g${color}${intensity}`, {
    color: 0x05070a, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0,
  });
}

function box(w, h, d, key) {
  return geo(key || `b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
}
function cyl(rt, rb, h, seg = 8, key) {
  return geo(key || `c${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}
function sphere(r, w = 8, h = 6, key) {
  return geo(key || `s${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
}
function cone(r, h, seg = 6, key) {
  return geo(key || `cn${r}_${h}_${seg}`, () => new THREE.ConeGeometry(r, h, seg));
}
function torus(r, t, key) {
  return geo(key || `t${r}_${t}`, () => new THREE.TorusGeometry(r, t, 6, 20));
}

function M(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function factionColors(faction) {
  const f = FACTIONS[faction] || FACTIONS.player;
  return { main: f.color, emissive: f.emissive };
}

/* =========================================================
   ЮНИТЫ
   ========================================================= */
export function createUnitModel(typeId, faction) {
  const { main, emissive } = factionColors(faction);
  const armorM = metal(main, 0.45, 0.8);
  const trim = metal(0x30363e, 0.6, 0.6);
  const lamp = glow(emissive, 3.0);
  const parts = { anim: 0, rotor: null, legs: [], turret: null, barrel: null, glow: [], cargo: null, wings: null };
  const g = new THREE.Group();

  switch (typeId) {
    /* ---------- Сборщик: шестиногий грузовой дрон ---------- */
    case 'harvester': {
      const body = new THREE.Group();
      body.add(M(box(1.25, 0.5, 1.5), armorM, 0, 0.72, 0));
      body.add(M(box(1.35, 0.14, 0.9), trim, 0, 1.0, 0.15));
      // кабина
      body.add(M(sphere(0.3, 8, 6), glow(emissive, 1.6), 0, 0.98, -0.5));
      // контейнер с кристаллами
      const cargo = new THREE.Group();
      cargo.add(M(box(0.9, 0.42, 0.85), metal(0x1c2530, 0.7, 0.4), 0, 0, 0));
      const shards = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const s = M(cone(0.1, 0.34, 4), glow(0x8be9ff, 2.4));
        s.position.set((i - 2) * 0.17, 0.3, (i % 2 ? 0.12 : -0.1));
        s.rotation.z = (i - 2) * 0.16;
        shards.add(s);
      }
      cargo.add(shards);
      cargo.position.set(0, 1.32, 0.2);
      parts.cargo = { group: cargo, shards };
      body.add(cargo);
      // манипулятор
      const arm = new THREE.Group();
      arm.add(M(box(0.12, 0.9, 0.12), trim, 0, -0.45, 0));
      arm.add(M(box(0.2, 0.16, 0.3), armorM, 0, -0.92, 0.1));
      arm.position.set(0, 1.0, -0.85);
      arm.rotation.x = 0.5;
      parts.arm = arm;
      body.add(arm);
      // ноги-колёса
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const row = Math.floor(i / 2) - 1;
        const leg = new THREE.Group();
        leg.add(M(cyl(0.07, 0.07, 0.5, 6), trim, 0, -0.25, 0));
        leg.add(M(cyl(0.19, 0.19, 0.14, 8), dark(0x16191d), 0, -0.5, 0));
        leg.children[1].rotation.z = Math.PI / 2;
        leg.position.set(side * 0.66, 0.62, row * 0.62);
        parts.legs.push(leg);
        body.add(leg);
      }
      g.add(body);
      parts.body = body;
      parts.bobBase = 0;
      break;
    }

    /* ---------- Пехота: рейнджер ---------- */
    case 'ranger': {
      const torso = new THREE.Group();
      torso.add(M(box(0.62, 0.55, 0.42), armorM, 0, 1.22, 0));
      torso.add(M(box(0.7, 0.16, 0.46), trim, 0, 0.98, 0));
      torso.add(M(box(0.2, 0.22, 0.1), lamp, 0, 1.28, -0.22));
      parts.glow.push(torso.children[2]);
      const head = new THREE.Group();
      head.add(M(box(0.34, 0.3, 0.34), metal(0x3b434d, 0.4, 0.8), 0, 0, 0));
      head.add(M(box(0.28, 0.09, 0.06), glow(emissive, 3.4), 0, 0.02, -0.18));
      head.position.set(0, 1.66, 0);
      parts.head = head;
      torso.add(head);
      // наплечники
      torso.add(M(box(0.16, 0.24, 0.4), trim, -0.38, 1.3, 0));
      torso.add(M(box(0.16, 0.24, 0.4), trim, 0.38, 1.3, 0));
      // оружие
      const gun = new THREE.Group();
      gun.add(M(box(0.14, 0.16, 0.85), metal(0x22262c, 0.6, 0.7), 0, 0, -0.3));
      gun.add(M(cyl(0.045, 0.05, 0.5, 8), dark(0x111417), 0, 0.02, -0.85));
      gun.children[1].rotation.x = Math.PI / 2;
      gun.add(M(box(0.06, 0.06, 0.12), glow(emissive, 2), 0, 0.09, -0.55));
      gun.position.set(0.3, 1.24, -0.15);
      parts.weapon = gun;
      torso.add(gun);
      // ноги
      for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.add(M(box(0.2, 0.45, 0.22), trim, 0, -0.22, 0));
        leg.add(M(box(0.22, 0.42, 0.24), armorM, 0, -0.64, 0));
        leg.add(M(box(0.26, 0.14, 0.4), dark(0x16191d), 0, -0.88, -0.06));
        leg.position.set(side * 0.19, 0.94, 0);
        parts.legs.push(leg);
        g.add(leg);
      }
      g.add(torso);
      parts.torso = torso;
      break;
    }

    /* ---------- Ракетчик ---------- */
    case 'lancer': {
      const torso = new THREE.Group();
      torso.add(M(box(0.66, 0.58, 0.44), armorM, 0, 1.24, 0));
      torso.add(M(box(0.72, 0.16, 0.48), trim, 0, 0.99, 0));
      const head = new THREE.Group();
      head.add(M(box(0.32, 0.28, 0.32), metal(0x3b434d, 0.4, 0.8), 0, 0, 0));
      head.add(M(cyl(0.05, 0.05, 0.3, 6), trim, 0.1, 0.24, 0));
      head.add(M(box(0.26, 0.08, 0.06), glow(emissive, 3.4), 0, 0.02, -0.17));
      head.position.set(0, 1.66, 0.02);
      parts.head = head;
      torso.add(head);
      // ракетные блоки на плечах
      for (const side of [-1, 1]) {
        const pod = new THREE.Group();
        pod.add(M(box(0.3, 0.34, 0.62), metal(0x262c34, 0.6, 0.6), 0, 0, 0));
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            pod.add(M(cyl(0.06, 0.06, 0.7, 6), dark(0x0e1114), (i - 0.5) * 0.14, (j - 0.5) * 0.15, -0.05));
            pod.children[pod.children.length - 1].rotation.x = Math.PI / 2;
          }
        }
        pod.position.set(side * 0.5, 1.5, -0.05);
        pod.rotation.x = -0.12;
        parts.glow.push(pod);
        torso.add(pod);
      }
      const gun = new THREE.Group();
      gun.add(M(box(0.12, 0.14, 0.6), metal(0x22262c, 0.6, 0.7), 0, 0, -0.2));
      gun.position.set(0.28, 1.22, -0.1);
      parts.weapon = gun;
      torso.add(gun);
      for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.add(M(box(0.22, 0.46, 0.24), trim, 0, -0.22, 0));
        leg.add(M(box(0.24, 0.44, 0.26), armorM, 0, -0.65, 0));
        leg.add(M(box(0.28, 0.14, 0.42), dark(0x16191d), 0, -0.9, -0.06));
        leg.position.set(side * 0.2, 0.96, 0);
        parts.legs.push(leg);
        g.add(leg);
      }
      g.add(torso);
      parts.torso = torso;
      break;
    }

    /* ---------- Танк «Бастион» ---------- */
    case 'bastion': {
      const hull = new THREE.Group();
      hull.add(M(box(2.3, 0.62, 3.1), armorM, 0, 0.62, 0));
      hull.add(M(box(2.4, 0.2, 1.2), trim, 0, 0.42, -1.0));
      const skirtL = M(box(0.24, 0.4, 3.2), dark(0x1b1f24), -1.16, 0.44, 0);
      const skirtR = M(box(0.24, 0.4, 3.2), dark(0x1b1f24), 1.16, 0.44, 0);
      hull.add(skirtL, skirtR);
      // гусеницы
      for (const side of [-1, 1]) {
        const track = M(box(0.42, 0.56, 3.3), dark(0x101317), side * 1.12, 0.32, 0);
        hull.add(track);
        const wheelGrp = new THREE.Group();
        for (let i = -1; i <= 1; i++) {
          const w = M(cyl(0.3, 0.3, 0.34, 8), metal(0x2b3138, 0.7, 0.5), 0, 0, i * 1.0);
          w.rotation.z = Math.PI / 2;
          wheelGrp.add(w);
        }
        wheelGrp.position.set(side * 1.12, 0.32, 0);
        parts.legs.push(wheelGrp);
        hull.add(wheelGrp);
      }
      g.add(hull);
      // башня
      const turret = new THREE.Group();
      turret.add(M(cyl(0.95, 1.05, 0.55, 8), armorM, 0, 0, 0));
      turret.add(M(box(1.1, 0.28, 1.5), metal(0x39414a, 0.5, 0.7), 0, 0.3, 0.2));
      const barrel = new THREE.Group();
      const br = M(cyl(0.13, 0.16, 2.5, 8), metal(0x20252b, 0.55, 0.85), 0, 0, -1.5);
      br.rotation.x = Math.PI / 2;
      barrel.add(br);
      const muzzle = M(cyl(0.2, 0.2, 0.3, 8), dark(0x15181c), 0, 0, -2.7);
      muzzle.rotation.x = Math.PI / 2;
      barrel.add(muzzle);
      barrel.position.set(0, 0.12, -0.3);
      parts.barrel = barrel;
      turret.add(barrel);
      turret.add(M(box(0.3, 0.14, 0.14), glow(emissive, 2.4), 0.45, 0.42, 0.2));
      turret.position.set(0, 1.18, 0.15);
      parts.turret = turret;
      g.add(turret);
      break;
    }

    /* ---------- Мортира ---------- */
    case 'mortar': {
      const base = new THREE.Group();
      base.add(M(box(1.9, 0.5, 2.4), armorM, 0, 0.66, 0));
      base.add(M(box(2.0, 0.22, 0.9), trim, 0, 0.44, 0.7));
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) - 1;
        const w = M(cyl(0.36, 0.36, 0.26, 10), dark(0x14181c), side * 1.0, 0.36, row * 0.9);
        w.rotation.z = Math.PI / 2;
        base.add(w);
      }
      // опоры
      for (const side of [-1, 1]) {
        const sup = M(box(0.14, 0.1, 1.6), metal(0x2f353c, 0.7, 0.5), side * 0.85, 0.24, -0.9);
        base.add(sup);
      }
      g.add(base);
      const turret = new THREE.Group();
      turret.add(M(cyl(0.7, 0.85, 0.4, 8), metal(0x3a424b, 0.5, 0.7), 0, 0, 0));
      const tube = new THREE.Group();
      const t = M(cyl(0.26, 0.3, 2.2, 8), armorM, 0, 0.9, -0.5);
      t.rotation.x = -0.6;
      tube.add(t);
      const t2 = M(cyl(0.2, 0.26, 0.5, 8), dark(0x15181c), 0, 1.72, -1.03);
      t2.rotation.x = -0.6;
      tube.add(t2);
      parts.barrel = tube;
      turret.add(tube);
      turret.position.set(0, 1.05, 0.1);
      parts.turret = turret;
      g.add(turret);
      break;
    }

    /* ---------- «Оса» ---------- */
    case 'wasp': {
      const body = new THREE.Group();
      body.add(M(cone(0.42, 1.9, 6), armorM, 0, 0, -0.3));
      body.children[0].rotation.x = -Math.PI / 2;
      body.add(M(box(0.5, 0.36, 1.5), armorM, 0, 0, 0.35));
      body.add(M(sphere(0.28, 8, 6), glow(emissive, 2.2), 0, 0.05, -0.75));
      // крылья
      const wings = new THREE.Group();
      for (const side of [-1, 1]) {
        const w = M(box(1.5, 0.08, 0.5), metal(0x39424c, 0.5, 0.7), side * 0.9, 0.05, 0.25);
        w.rotation.z = side * 0.12;
        wings.add(w);
        const eng = M(cyl(0.16, 0.16, 0.6, 8), dark(0x181c21), side * 1.1, 0, 0.4);
        eng.rotation.x = Math.PI / 2;
        wings.add(eng);
        const flame = M(cyl(0.13, 0.02, 0.5, 8), glow(0x66e0ff, 3.0), side * 1.1, 0, 0.75);
        flame.rotation.x = Math.PI / 2;
        parts.glow.push(flame);
        wings.add(flame);
      }
      parts.wings = wings;
      body.add(wings);
      // хвост
      body.add(M(box(0.08, 0.6, 0.5), trim, 0, 0.32, 1.0));
      body.add(M(box(0.7, 0.08, 0.4), trim, 0, 0.1, 1.05));
      // пушки
      for (const side of [-1, 1]) {
        const c = M(cyl(0.05, 0.05, 0.7, 6), dark(0x111417), side * 0.3, -0.2, -0.5);
        c.rotation.x = Math.PI / 2;
        body.add(c);
      }
      parts.body = body;
      parts.legs.push(body);
      g.add(body);
      break;
    }

    /* ---------- «Серафим» ---------- */
    case 'seraph': {
      const body = new THREE.Group();
      body.add(M(box(1.1, 0.55, 2.6), armorM, 0, 0, 0));
      body.add(M(cone(0.55, 1.2, 6), armorM, 0, 0, -1.7));
      body.children[1].rotation.x = -Math.PI / 2;
      body.add(M(sphere(0.32, 8, 6), glow(emissive, 2.2), 0, 0.1, -1.1));
      const wings = new THREE.Group();
      for (const side of [-1, 1]) {
        const w = M(box(2.2, 0.1, 1.0), metal(0x39424c, 0.5, 0.7), side * 1.5, 0, 0.1);
        w.rotation.z = side * 0.06;
        wings.add(w);
        const eng = M(cyl(0.22, 0.22, 0.9, 8), dark(0x181c21), side * 1.2, -0.05, 0.6);
        eng.rotation.x = Math.PI / 2;
        wings.add(eng);
        const flame = M(cyl(0.18, 0.02, 0.7, 8), glow(0x66e0ff, 3.0), side * 1.2, -0.05, 1.1);
        flame.rotation.x = Math.PI / 2;
        parts.glow.push(flame);
        wings.add(flame);
        // бомбы
        for (let i = 0; i < 2; i++) {
          const b = M(sphere(0.16, 6, 5), glow(0xffb020, 1.2), side * 1.5, -0.32, -0.2 + i * 0.7);
          b.scale.set(1, 1, 1.6);
          wings.add(b);
        }
      }
      parts.wings = wings;
      body.add(wings);
      body.add(M(box(0.08, 0.8, 0.7), trim, 0, 0.45, 1.25));
      parts.body = body;
      parts.legs.push(body);
      g.add(body);
      break;
    }

    /* ---------- «Хранитель» ---------- */
    case 'guardian': {
      const torso = new THREE.Group();
      torso.add(M(box(1.5, 0.9, 1.0), armorM, 0, 2.0, 0));
      torso.add(M(box(1.7, 0.24, 1.1), trim, 0, 1.6, 0));
      torso.add(M(box(0.9, 0.5, 0.2), glow(emissive, 1.8), 0, 2.05, -0.52));
      parts.glow.push(torso.children[2]);
      const head = new THREE.Group();
      head.add(M(box(0.6, 0.45, 0.5), metal(0x3b434d, 0.4, 0.8), 0, 0, 0));
      head.add(M(box(0.44, 0.14, 0.08), glow(emissive, 4.0), 0, 0.04, -0.26));
      head.add(M(cyl(0.06, 0.06, 0.6, 6), trim, 0, 0.5, 0.1));
      head.position.set(0, 2.68, 0);
      parts.head = head;
      torso.add(head);
      // ионный излучатель
      const emitter = new THREE.Group();
      emitter.add(M(cyl(0.26, 0.34, 1.6, 8), metal(0x262c34, 0.5, 0.8), 0, 0, -0.6));
      emitter.children[0].rotation.x = Math.PI / 2;
      const ring1 = M(torus(0.42, 0.07), glow(emissive, 2.6), 0, 0, -1.3);
      const ring2 = M(torus(0.32, 0.06), glow(emissive, 2.6), 0, 0, -1.0);
      emitter.add(ring1, ring2);
      parts.rings = [ring1, ring2];
      emitter.position.set(0.55, 2.05, -0.4);
      parts.weapon = emitter;
      torso.add(emitter);
      // руки
      torso.add(M(box(0.28, 0.9, 0.3), trim, -0.95, 1.95, 0));
      // ноги-поршни
      for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.add(M(box(0.42, 0.7, 0.46), trim, 0, -0.35, 0));
        leg.add(M(box(0.5, 0.75, 0.54), armorM, 0, -1.05, 0));
        leg.add(M(box(0.6, 0.24, 0.8), dark(0x16191d), 0, -1.5, -0.08));
        leg.add(M(box(0.2, 0.3, 0.2), glow(emissive, 1.4), 0, -1.3, 0.2));
        leg.position.set(side * 0.5, 1.6, 0);
        parts.legs.push(leg);
        g.add(leg);
      }
      g.add(torso);
      parts.torso = torso;
      break;
    }
  }
  return { group: g, parts };
}

/* =========================================================
   ПОСТРОЙКИ
   ========================================================= */
export function createBuildingModel(typeId, faction) {
  const { main, emissive } = factionColors(faction);
  const armorM = metal(main, 0.5, 0.7);
  const wall = metal(0x39414a, 0.65, 0.55);
  const trim = metal(0x2b3138, 0.7, 0.5);
  const lamp = glow(emissive, 2.6);
  const parts = { anim: 0, glow: [], rotors: [], doors: null, core: null };
  const g = new THREE.Group();

  switch (typeId) {
    case 'command': {
      g.add(M(cyl(2.5, 3.0, 0.5, 8), trim, 0, 0.25, 0));
      g.add(M(cyl(2.1, 2.5, 1.6, 8), armorM, 0, 1.3, 0));
      g.add(M(box(3.6, 0.9, 3.6), wall, 0, 0.7, 0));
      const dome = M(sphere(1.5, 12, 8), metal(0x1b3040, 0.15, 0.9), 0, 2.6, 0);
      dome.scale.y = 0.75;
      g.add(dome);
      const ring = M(torus(2.3, 0.11), glow(emissive, 2.2), 0, 2.3, 0);
      ring.rotation.x = Math.PI / 2;
      parts.rotors.push({ mesh: ring, speed: 0.5, axis: 'y' });
      g.add(ring);
      const ring2 = M(torus(1.7, 0.08), glow(emissive, 2.6), 0, 2.9, 0);
      ring2.rotation.set(Math.PI / 2.4, 0, 0.3);
      parts.rotors.push({ mesh: ring2, speed: -0.8, axis: 'z' });
      g.add(ring2);
      const core = M(sphere(0.55, 10, 8), glow(emissive, 3.2), 0, 2.55, 0);
      parts.core = core; parts.glow.push(core);
      g.add(core);
      // посадочные огни
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const l = M(box(0.16, 0.12, 0.16), glow(i % 2 ? emissive : 0xffffff, 1.8), Math.cos(a) * 2.7, 0.55, Math.sin(a) * 2.7);
        parts.glow.push(l);
        g.add(l);
      }
      g.add(M(cyl(0.14, 0.14, 2.4, 6), trim, 2.2, 1.6, -2.2));
      g.add(M(sphere(0.16, 6, 5), glow(0xff4d5e, 2.4), 2.2, 2.85, -2.2));
      break;
    }
    case 'barracks': {
      g.add(M(box(4.6, 0.4, 4.6), trim, 0, 0.2, 0));
      g.add(M(box(4.0, 1.9, 3.6), wall, 0, 1.15, 0));
      g.add(M(box(4.2, 0.3, 3.8), armorM, 0, 2.2, 0));
      // ворота
      const door = M(box(1.6, 1.5, 0.16), metal(0x20262d, 0.6, 0.6), 0, 0.95, -1.82);
      parts.doors = door;
      g.add(door);
      for (const s of [-1, 1]) {
        g.add(M(box(0.2, 1.6, 0.2), armorM, s * 0.95, 0.95, -1.86));
        const l = M(box(0.1, 1.3, 0.06), glow(emissive, 2.4), s * 0.95, 0.95, -1.95);
        parts.glow.push(l); g.add(l);
      }
      g.add(M(box(1.2, 0.7, 1.0), wall, -1.2, 2.6, 0.6));
      g.add(M(cyl(0.07, 0.07, 1.6, 6), trim, 1.5, 3.0, 1.2));
      g.add(M(sphere(0.13, 6, 5), glow(0xff4d5e, 2.2), 1.5, 3.85, 1.2));
      break;
    }
    case 'factory': {
      g.add(M(box(5.0, 0.4, 5.0), trim, 0, 0.2, 0));
      g.add(M(box(4.6, 2.4, 4.2), wall, 0, 1.4, 0));
      g.add(M(box(4.8, 0.34, 4.4), armorM, 0, 2.75, 0));
      // пила крыши
      for (let i = -1; i <= 1; i++) {
        const r = M(box(1.3, 0.5, 3.6), metal(0x2f373f, 0.7, 0.5), i * 1.5, 3.1, 0);
        r.rotation.z = 0.22;
        g.add(r);
      }
      const chimney = M(cyl(0.34, 0.42, 2.6, 8), metal(0x343b43, 0.8, 0.4), 1.9, 3.9, 1.6);
      g.add(chimney);
      g.add(M(cyl(0.36, 0.36, 0.2, 8), glow(0xff8a3d, 1.6), 1.9, 5.2, 1.6));
      // кран
      const crane = new THREE.Group();
      crane.add(M(box(0.18, 2.2, 0.18), trim, 0, 1.1, 0));
      crane.add(M(box(3.4, 0.16, 0.16), trim, 0.9, 2.2, 0));
      crane.add(M(box(0.1, 0.8, 0.1), trim, 2.3, 1.8, 0));
      crane.position.set(-1.6, 2.9, -1.4);
      parts.rotors.push({ mesh: crane, speed: 0.25, axis: 'y' });
      g.add(crane);
      const door = M(box(2.4, 1.9, 0.18), metal(0x1c2128, 0.6, 0.6), 0, 1.15, -2.12);
      parts.doors = door; g.add(door);
      for (const s of [-1, 1]) {
        const l = M(box(0.12, 1.7, 0.08), glow(emissive, 2.2), s * 1.3, 1.15, -2.22);
        parts.glow.push(l); g.add(l);
      }
      break;
    }
    case 'airpad': {
      g.add(M(cyl(3.0, 3.0, 0.35, 12), metal(0x2c333b, 0.8, 0.35), 0, 0.18, 0));
      g.add(M(torus(2.4, 0.07), glow(emissive, 2.0), 0, 0.38, 0).rotateX(Math.PI / 2));
      const padRing = g.children[g.children.length - 1];
      parts.rotors.push({ mesh: padRing, speed: 0, axis: 'y' });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const l = M(box(0.24, 0.12, 0.24), glow(emissive, 2.4), Math.cos(a) * 2.75, 0.42, Math.sin(a) * 2.75);
        parts.glow.push(l); g.add(l);
      }
      const tower = new THREE.Group();
      tower.add(M(cyl(0.4, 0.5, 2.6, 8), wall, 0, 1.3, 0));
      tower.add(M(cyl(0.75, 0.55, 0.7, 8), metal(0x22303c, 0.2, 0.9), 0, 2.9, 0));
      tower.add(M(sphere(0.14, 6, 5), glow(0xff4d5e, 2.6), 0, 3.4, 0));
      tower.position.set(2.6, 0, 2.0);
      g.add(tower);
      break;
    }
    case 'techlab': {
      g.add(M(cyl(2.2, 2.6, 0.5, 6), trim, 0, 0.25, 0));
      g.add(M(cyl(1.8, 2.1, 2.0, 6), wall, 0, 1.5, 0));
      const dome = M(sphere(1.7, 12, 8), metal(0x241b40, 0.2, 0.85), 0, 2.6, 0);
      dome.scale.y = 0.8;
      g.add(dome);
      const core = M(sphere(0.6, 10, 8), glow(0xb47cff, 3.0), 0, 2.7, 0);
      parts.core = core; parts.glow.push(core);
      g.add(core);
      for (let i = 0; i < 3; i++) {
        const r = M(torus(1.1 + i * 0.35, 0.05), glow(0xb47cff, 2.4), 0, 2.7, 0);
        r.rotation.set(Math.PI / 2 + i * 0.5, i * 0.7, 0);
        parts.rotors.push({ mesh: r, speed: 0.6 + i * 0.35, axis: i % 2 ? 'z' : 'x' });
        g.add(r);
      }
      break;
    }
    case 'reactor': {
      g.add(M(cyl(1.5, 1.7, 0.4, 8), trim, 0, 0.2, 0));
      g.add(M(cyl(1.15, 1.3, 2.1, 8), wall, 0, 1.3, 0));
      const core = M(cyl(0.75, 0.75, 2.4, 8), glow(0xffc24d, 2.6), 0, 1.5, 0);
      parts.core = core; parts.glow.push(core);
      g.add(core);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        g.add(M(box(0.22, 1.9, 0.5), armorM, Math.cos(a) * 1.35, 1.2, Math.sin(a) * 1.35).rotateY(-a));
      }
      const ring = M(torus(1.4, 0.09), glow(0xffc24d, 2.0), 0, 2.3, 0);
      ring.rotation.x = Math.PI / 2;
      parts.rotors.push({ mesh: ring, speed: 1.2, axis: 'y' });
      g.add(ring);
      g.add(M(cyl(0.09, 0.09, 1.2, 6), trim, 0, 2.9, 0));
      break;
    }
    case 'turret': {
      g.add(M(cyl(1.2, 1.4, 0.35, 8), trim, 0, 0.18, 0));
      g.add(M(cyl(0.95, 1.0, 0.55, 8), wall, 0, 0.55, 0));
      const head = new THREE.Group();
      head.add(M(box(1.3, 0.62, 1.3), armorM, 0, 0, 0));
      head.add(M(box(1.0, 0.2, 0.9), trim, 0, 0.36, 0));
      for (const s of [-1, 1]) {
        const b = M(cyl(0.09, 0.11, 1.7, 8), metal(0x1d2228, 0.55, 0.85), s * 0.26, 0.05, -1.0);
        b.rotation.x = Math.PI / 2;
        head.add(b);
      }
      head.add(M(box(0.16, 0.16, 0.16), glow(emissive, 2.6), 0.4, 0.4, 0.4));
      head.position.set(0, 1.1, 0);
      parts.turret = head;
      g.add(head);
      break;
    }
    case 'tesla': {
      g.add(M(cyl(1.1, 1.3, 0.4, 8), trim, 0, 0.2, 0));
      g.add(M(cyl(0.5, 0.8, 2.4, 8), wall, 0, 1.4, 0));
      for (let i = 0; i < 3; i++) {
        g.add(M(torus(0.7 - i * 0.12, 0.05), metal(0x8b6bd6, 0.4, 0.8), 0, 1.0 + i * 0.7, 0).rotateX(Math.PI / 2));
      }
      const orb = M(sphere(0.42, 10, 8), glow(0xc79bff, 3.2), 0, 3.0, 0);
      parts.core = orb; parts.glow.push(orb);
      g.add(orb);
      const cage = M(torus(0.6, 0.04), glow(0xc79bff, 1.8), 0, 3.0, 0);
      parts.rotors.push({ mesh: cage, speed: 1.6, axis: 'x' });
      g.add(cage);
      const cage2 = M(torus(0.6, 0.04), glow(0xc79bff, 1.8), 0, 3.0, 0);
      cage2.rotation.y = Math.PI / 2;
      parts.rotors.push({ mesh: cage2, speed: -1.3, axis: 'z' });
      g.add(cage2);
      break;
    }
    case 'pylon': {
      g.add(M(cyl(1.0, 1.2, 0.35, 6), trim, 0, 0.18, 0));
      g.add(M(box(1.1, 0.8, 1.1), wall, 0, 0.7, 0));
      const crystal = M(cone(0.55, 2.2, 6), glow(0x5cff9d, 2.6), 0, 2.2, 0);
      parts.core = crystal; parts.glow.push(crystal);
      g.add(crystal);
      const cr2 = M(cone(0.4, 0.9, 6), glow(0x5cff9d, 2.0), 0, 0.95, 0);
      cr2.rotation.x = Math.PI;
      g.add(cr2);
      for (let i = 0; i < 2; i++) {
        const r = M(torus(1.0 - i * 0.2, 0.045), glow(0x5cff9d, 1.8), 0, 1.7 + i * 0.9, 0);
        r.rotation.x = Math.PI / 2 + i * 0.4;
        parts.rotors.push({ mesh: r, speed: 0.7 + i * 0.5, axis: i ? 'z' : 'y' });
        g.add(r);
      }
      break;
    }
    case 'wall': {
      g.add(M(box(1.95, 1.9, 1.95), wall, 0, 0.95, 0));
      g.add(M(box(2.05, 0.2, 2.05), trim, 0, 1.95, 0));
      g.add(M(box(2.05, 0.2, 2.05), trim, 0, 0.1, 0));
      const l = M(box(0.5, 0.1, 0.08), glow(emissive, 1.6), 0, 1.5, -1.0);
      parts.glow.push(l); g.add(l);
      break;
    }
  }
  return { group: g, parts };
}

/* =========================================================
   Универсальная анимация модели
   ========================================================= */
export function animateUnit(typeId, model, ctx, dt) {
  const p = model.parts;
  p.anim += dt;
  const def = UNITS[typeId];
  const moving = ctx.moving ? 1 : 0;

  if (def.flying) {
    const body = p.body;
    if (body) {
      // парение + крен при повороте
      body.position.y = Math.sin(p.anim * 2.4) * 0.12;
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -ctx.turnRate * 0.5, 0.12);
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, ctx.accel * 0.18, 0.1);
    }
    for (const fl of p.glow) {
      const s = 0.7 + Math.sin(p.anim * 26 + fl.id) * 0.12 + moving * 0.5;
      fl.scale.set(1, 1, s);
    }
    return;
  }

  if (p.legs.length && typeId !== 'bastion' && typeId !== 'mortar') {
    const speed = moving ? 7.5 : 0;
    const amp = moving ? 0.62 : 0;
    p.legs.forEach((leg, i) => {
      const ph = p.anim * speed + (i % 2 ? Math.PI : 0);
      leg.rotation.x = Math.sin(ph) * amp;
      if (leg.children[1]) leg.children[1].rotation.x = Math.abs(Math.sin(ph)) * 0.3 * amp;
    });
    if (p.torso) {
      p.torso.position.y = Math.abs(Math.sin(p.anim * speed)) * 0.055 * moving;
      p.torso.rotation.z = Math.sin(p.anim * speed * 0.5) * 0.03 * moving;
    }
  }

  if (typeId === 'bastion' || typeId === 'mortar') {
    for (const wg of p.legs) {
      wg.children.forEach((w) => { w.rotation.x -= dt * ctx.speedPx * 1.6; });
    }
  }

  if (typeId === 'harvester') {
    if (p.cargo) {
      p.cargo.group.position.y = 1.32 + Math.sin(p.anim * 3) * 0.03;
      p.cargo.shards.rotation.y += dt * 0.8;
      const full = ctx.cargoRatio || 0;
      p.cargo.shards.scale.setScalar(0.25 + full * 0.85);
    }
    if (p.arm) p.arm.rotation.x = 0.5 + Math.sin(p.anim * (ctx.harvesting ? 6 : 1.2)) * (ctx.harvesting ? 0.5 : 0.08);
  }

  if (p.rings) {
    p.rings.forEach((r, i) => {
      r.rotation.z += dt * (i ? -2.4 : 1.8) * (1 + (ctx.firing ? 3 : 0));
      const s = 1 + Math.sin(p.anim * 5) * 0.06 + (ctx.firing ? 0.25 : 0);
      r.scale.setScalar(s);
    });
  }
}

export function animateBuilding(typeId, model, dt, state = {}) {
  const p = model.parts;
  p.anim = (p.anim || 0) + dt;
  for (const r of p.rotors) {
    if (r.axis === 'y') r.mesh.rotation.y += dt * r.speed * (state.unpowered ? 0.25 : 1);
    else if (r.axis === 'x') r.mesh.rotation.x += dt * r.speed * (state.unpowered ? 0.25 : 1);
    else r.mesh.rotation.z += dt * r.speed * (state.unpowered ? 0.25 : 1);
  }
  if (p.core) {
    const k = state.unpowered ? 0.35 : 1;
    const s = (1 + Math.sin(p.anim * 3) * 0.05) * k;
    p.core.scale.setScalar(s);
    if (p.core.material.emissiveIntensity !== undefined) {
      p.core.material.emissiveIntensity = (state.unpowered ? 0.6 : 2.6) + Math.sin(p.anim * 4) * 0.4;
    }
  }
  if (p.doors) {
    const target = state.producing ? 1 : 0;
    p.doors.position.y = THREE.MathUtils.lerp(p.doors.position.y, state.baseDoorY ?? p.doors.position.y, 0.1);
    p.doors.userData.open = THREE.MathUtils.lerp(p.doors.userData.open ?? 0, target, 0.08);
    p.doors.scale.y = 1 - p.doors.userData.open * 0.85;
    p.doors.position.y = (state.baseDoorY ?? 1) - p.doors.userData.open * 0.6;
  }
  for (const l of p.glow) {
    if (l.material?.emissiveIntensity !== undefined && state.unpowered) {
      l.material = l.material;
    }
  }
}

/** Полупрозрачный «призрак» для размещения построек */
export function createGhost(typeId) {
  const { group } = createBuildingModel(typeId, 'player');
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false; o.receiveShadow = false;
      o.material = new THREE.MeshBasicMaterial({
        color: 0x00ff88, transparent: true, opacity: 0.42, depthWrite: false,
      });
    }
  });
  return group;
}
