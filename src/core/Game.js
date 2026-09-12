import * as THREE from 'three';
import { GameMap } from '../world/GameMap.js';
import { Terrain } from '../world/Terrain.js';
import { FogOfWar } from '../world/FogOfWar.js';
import { CrystalNodes } from '../world/CrystalNodes.js';
import { Pathfinder } from '../world/Pathfinding.js';
import { Sky } from '../world/Sky.js';
import { Unit } from '../entities/Unit.js';
import { Building } from '../entities/Building.js';
import { ProjectileManager } from '../entities/Projectile.js';
import { Effects } from '../fx/Effects.js';
import { SpatialHash } from './SpatialHash.js';
import { CameraRig } from './CameraRig.js';
import { GameAudio } from './Audio.js';
import { Minimap } from '../ui/Minimap.js';
import { EnemyAI } from '../ai/EnemyAI.js';
import { UNITS, BUILDINGS, FACTIONS, MAP_PRESETS, DIFFICULTY, TILE } from '../data/defs.js';
import { clamp, dist } from './util.js';

/* =========================================================
   Игровой оркестратор
   ========================================================= */
const DAY_LENGTH = 420; // секунд на полный цикл

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.simTime = 0;
    this.speed = 1;
    this.paused = false;
    this.running = false;
    this.over = false;
    this.listeners = new Map();
    this.audio = new GameAudio();

    this.initRenderer();
    this.events = { log: [], toast: [] };
    this.stats = this.freshStats();
  }

  /* ================= ИНИЦИАЛИЗАЦИЯ ================= */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b1a26, 0.0042);

    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 900);
    this.camera.position.set(0, 50, 60);

    // постобработка (свечение) — подключаем лениво
    this.bloomEnabled = true;
    this.composer = null;
  }

  async setupComposer() {
    if (this.composer || !this.bloomEnabled) return;
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
      ]);
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.7, 0.82);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloomPass = bloom;
    } catch (e) {
      console.warn('Bloom недоступен:', e);
      this.bloomEnabled = false;
    }
  }

  freshStats() {
    return {
      // kills[f] — сколько чужих юнитов уничтожила фракция f
      kills: { player: 0, enemy: 0 },
      // losses[f] — сколько юнитов фракции f уничтожено
      losses: { player: 0, enemy: 0 },
      buildingsDestroyed: { player: 0, enemy: 0 },
      crystals: { player: 0, enemy: 0 },
      units: { player: 0, enemy: 0 },
    };
  }

  /* ================= НОВАЯ ИГРА ================= */
  newGame(difficulty = 1, mapIndex = 0) {
    this.disposeWorld();
    this.difficulty = difficulty;
    this.mapPreset = MAP_PRESETS[mapIndex];
    this.map = new GameMap(this.mapPreset);
    this.pathfinder = new Pathfinder(this.map);
    this.fog = new FogOfWar(this.map, 96);
    this.terrain = new Terrain(this.map, this.fog.texture);
    this.scene.add(this.terrain.group);
    this.crystalNodes = new CrystalNodes(this);
    this.scene.add(this.crystalNodes.group);
    this.sky = new Sky(this.scene, this.map);
    this.fx = new Effects(this.scene);
    this.projectiles = new ProjectileManager(this.scene);
    this.cameraRig = new CameraRig(this.camera, this.map);
    this.unitHash = new SpatialHash(5);
    this.entityHash = new SpatialHash(8);

    this.entities = [];
    this.units = [];
    this.buildings = [];
    this.players = {
      player: this.freshPlayer('player'),
      enemy: this.freshPlayer('enemy'),
    };
    this.stats = this.freshStats();
    this.time = 0; this.simTime = 0; this.over = false; this.running = true;
    this.dayPhase = 0.18;
    this.selected = new Set();
    this.controlGroups = {};
    this.placement = null;
    this.crystalRateWindow = [];
    this.depositLog = { player: [], enemy: [] };

    // стартовые базы
    const pSpawn = this.map.spawns[0], eSpawn = this.map.spawns[1];
    this.spawnBuilding('command', 'player', pSpawn.tx, pSpawn.tz, true);
    this.spawnBuilding('command', 'enemy', eSpawn.tx, eSpawn.tz, true);
    this.recomputePower();
    for (let i = 0; i < 4; i++) {
      const s = this.buildings[0].spawnSlot(i);
      this.spawnUnit('harvester', 'player', s.x, s.z);
    }
    // стартовая армия врага
    const d = DIFFICULTY[difficulty];
    for (let i = 0; i < d.startUnits; i++) {
      const s = this.buildings[1].spawnSlot(i);
      this.spawnUnit('ranger', 'enemy', s.x, s.z);
    }
    this.spawnUnit('harvester', 'enemy', this.buildings[1].x + 6, this.buildings[1].z + 6);
    this.spawnUnit('harvester', 'enemy', this.buildings[1].x - 6, this.buildings[1].z + 6);

    this.cameraRig.focus(this.buildings[0].x, this.buildings[0].z, true);
    this.cameraRig.yawGoal = this.cameraRig.yaw = Math.atan2(
      this.buildings[1].x - this.buildings[0].x, this.buildings[1].z - this.buildings[0].z,
    ) + Math.PI;

    this.ai = new EnemyAI(this, difficulty);
    this.minimap = new Minimap(this, document.getElementById('minimap'));

    this.emit('new-game', { difficulty, map: this.mapPreset });
    this.toast('ОПЕРАЦИЯ НАЧАТА', this.mapPreset.name);
    this.log('Командный центр развёрнут. Начинайте добычу.', 'good');
  }

  freshPlayer(id) {
    return {
      id, crystal: 600, popCap: 0, pop: 0,
      power: 0, powerUsed: 0,
      buildings: [], units: [],
      rallyDefault: null,
    };
  }

  disposeWorld() {
    if (this.terrain) {
      this.scene.remove(this.terrain.group);
      this.terrain.group.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); });
    }
    if (this.sky) { this.scene.remove(this.sky.group); this.sky.dispose(); }
    if (this.crystalNodes) {
      this.scene.remove(this.crystalNodes.group);
      this.crystalNodes.group.traverse((o) => { o.geometry?.dispose?.(); });
      this.crystalNodes = null;
    }
    if (this.fx) this.fx.clear();
    if (this.projectiles) this.projectiles.clear();
    for (const e of this.entities || []) {
      this.scene.remove(e.object);
      e.object.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry?.dispose?.(); });
    }
    this.entities = []; this.units = []; this.buildings = [];
  }

  /* ================= СПАВН ================= */
  spawnUnit(typeId, faction, x, z, from = null) {
    const p = this.players[faction];
    if (p.pop + UNITS[typeId].pop > p.popCap && faction === 'player') {
      // переполнение — не производим
      return null;
    }
    const spot = this.map.nearestWalkable(...this.map.toTile(x, z), 6) || this.map.toTile(x, z);
    const [wx, wz] = this.map.toWorld(spot[0], spot[1]);
    const u = new Unit(this, typeId, faction, wx, wz);
    this.addEntity(u);
    p.units.push(u);
    p.pop += u.def.pop;
    this.stats.units[faction]++;
    if (from && from.rally.set) u.orderMove(from.rally.x, from.rally.z);
    return u;
  }

  /** Занята ли площадка стоящими на ней юнитами */
  areaHasUnits(tx, tz, size) {
    const o = Math.floor(size / 2);
    const x0 = (tx - o) * this.map.tile - this.map.half;
    const z0 = (tz - o) * this.map.tile - this.map.half;
    const w = size * this.map.tile;
    for (const u of this.units) {
      if (u.dead || u.def.flying) continue;
      if (u.x > x0 - 0.6 && u.x < x0 + w + 0.6 && u.z > z0 - 0.6 && u.z < z0 + w + 0.6) return true;
    }
    return false;
  }

  spawnBuilding(typeId, faction, tx, tz, instant = false) {
    const b = new Building(this, typeId, faction, tx, tz);
    this.map.occupy(tx, tz, b.size);
    this.pathfinder.invalidateFlows();
    this.addEntity(b);
    this.players[faction].buildings.push(b);
    if (instant) {
      b.constructing = false;
      b.buildProgress = 1;
      b.hp = b.maxHp;
      b.modelGroup.scale.setScalar(1);
      b.buildScaffold.visible = false;
    }
    return b;
  }

  addEntity(e) {
    this.entities.push(e);
    if (e.kind === 'unit') this.units.push(e);
    else this.buildings.push(e);
    this.scene.add(e.object);
  }

  removeEntity(e, killer) {
    if (e._removed) return;
    e._removed = true;
    e.dead = true;
    if (e.kind === 'building') {
      this.map.free(e.tx, e.tz, e.size);
      this.pathfinder.invalidateFlows();
    }
    this.scene.remove(e.object);
    if (this.selected.has(e)) this.selected.delete(e);
    // чистим ссылки у других
    for (const u of this.units) {
      if (u.target === e) u.target = null;
      if (u.harvest?.drop === e) u.harvest.drop = null;
    }
  }

  /** Уборка мёртвых из массивов — раз в кадр */
  sweep() {
    if (this.entities.some((e) => e._removed)) {
      this.entities = this.entities.filter((e) => !e._removed);
      this.units = this.units.filter((e) => !e._removed);
      this.buildings = this.buildings.filter((e) => !e._removed);
      for (const f of ['player', 'enemy']) {
        const p = this.players[f];
        const before = p.units.length;
        p.units = p.units.filter((e) => !e._removed);
        p.buildings = p.buildings.filter((e) => !e._removed);
        p.pop = p.units.reduce((s, u) => s + u.def.pop, 0);
      }
    }
  }

  /* ================= ЭКОНОМИКА ================= */
  recomputePower() {
    for (const f of ['player', 'enemy']) {
      const p = this.players[f];
      let power = 0, used = 0, popCap = 0;
      for (const b of p.buildings) {
        if (b.dead || b.constructing) continue;
        if (b.def.power > 0) power += b.def.power;
        else used += -b.def.power;
        popCap += b.def.popCap || 0;
      }
      p.power = power; p.powerUsed = used; p.popCap = Math.max(10, popCap);
    }
  }

  powerRatio(faction) {
    const p = this.players[faction];
    if (p.powerUsed <= 0) return 1;
    return clamp(p.power / p.powerUsed, 0, 1);
  }

  powerFactor(faction) {
    const r = this.powerRatio(faction);
    return r >= 1 ? 1 : 0.42 + 0.58 * r;
  }

  onCrystalMined(faction, amount) {
    if (!amount) return;
    this.players[faction].crystal += amount;
    this.stats.crystals[faction] += amount;
    this.depositLog[faction].push({ t: this.simTime, amount });
  }

  crystalRate(faction) {
    const log = this.depositLog[faction];
    const now = this.simTime;
    while (log.length && now - log[0].t > 12) log.shift();
    const span = Math.min(12, Math.max(1, now - (log[0]?.t ?? now)));
    const sum = log.reduce((s, d) => s + d.amount, 0);
    return sum / span;
  }

  tryProduce(building, unitId) {
    const def = UNITS[unitId];
    const p = this.players[building.faction];
    if (p.crystal < def.cost.crystal) { this.audio.error(); this.log('Недостаточно кристаллов', 'warn'); return false; }
    if (p.power < p.powerUsed + def.cost.energy) { /* энергия не блокирует, только замедляет */ }
    if (p.pop + def.pop > p.popCap) {
      this.audio.error();
      this.log('Лимит армии исчерпан — нужен ещё один командный центр', 'warn');
      return false;
    }
    if (!building.enqueue(unitId, def)) { this.audio.error(); return false; }
    p.crystal -= def.cost.crystal;
    this.audio.click();
    return true;
  }

  /* ================= БОЙ ================= */
  spawnProjectile(cfg) {
    cfg.game = this;
    const w = cfg.weapon;
    if (w.beam) {
      // мгновенный луч (юниты)
      const color = 0x8be9ff;
      this.fx.beam(cfg.x, cfg.y, cfg.z, cfg.target.x, cfg.target.y + 0.9, cfg.target.z, color, 0.12, 0.1);
      const m = this.damageMult(w.type, cfg.target.def.armor);
      cfg.target.damage(w.dmg * m, cfg.source, w.type);
      this.fx.sparks(cfg.target.x, cfg.target.y + 0.9, cfg.target.z, color, 7);
      return;
    }
    this.projectiles.spawn(cfg);
  }

  damageMult(type, armor) {
    const T = {
      bullet: { light: 1.0, medium: 0.85, heavy: 0.6, air: 0.75, structure: 0.9 },
      cannon: { light: 1.15, medium: 1.0, heavy: 1.1, air: 0.35, structure: 1.3 },
      missile: { light: 0.9, medium: 1.1, heavy: 1.2, air: 1.6, structure: 1.0 },
      laser: { light: 1.0, medium: 1.0, heavy: 0.95, air: 1.2, structure: 1.15 },
      bomb: { light: 1.4, medium: 1.2, heavy: 1.0, air: 0.5, structure: 1.5 },
    };
    return T[type]?.[armor] ?? 1;
  }

  onEntityDamaged(e, amount, source, type) {
    // всплывающие числа только для игрока и только рядом с камерой
    if (this.cameraRig.distanceTo(e.x, e.y || 1, e.z) < 90 && Math.random() < 0.4) {
      this.fx.text(e.x, (e.y || 1) + 2.2, e.z, `-${Math.round(amount)}`, e.faction === 'player' ? '#ff7b8a' : '#ffd36a', 12);
    }
    if (e.faction === 'player' && source && source.faction === 'enemy') {
      this.flashDamage();
    }
    this.emit('damage', { entity: e, amount });
  }

  flashDamage() {
    const el = document.getElementById('fog-flash');
    if (!el) return;
    el.classList.add('on');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => el.classList.remove('on'), 90);
  }

  /** Без аллокаций: фильтруем прямо в переданном массиве */
  getEnemiesNear(faction, x, z, r, out) {
    const res = this.entityHash.query(x, z, r, out);
    let n = 0;
    for (let i = 0; i < res.length; i++) {
      const e = res[i];
      if (e.faction !== faction && !e.dead) res[n++] = e;
    }
    res.length = n;
    return res;
  }

  getFriendlyNear(faction, x, z, r, out) {
    const res = this.entityHash.query(x, z, r, out);
    let n = 0;
    for (let i = 0; i < res.length; i++) {
      const e = res[i];
      if (e.faction === faction && !e.dead) res[n++] = e;
    }
    res.length = n;
    return res;
  }

  factionColor(f) { return FACTIONS[f].color; }

  findNearestNode(x, z) {
    let best = null, bd = Infinity;
    for (const n of this.map.nodes) {
      if (n.amount <= 0) continue;
      const d = dist(x, z, n.x, n.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  nearestDropoff(faction, x, z) {
    let best = null, bd = Infinity;
    for (const b of this.players[faction].buildings) {
      if (b.dead || b.constructing || !b.def.dropoff) continue;
      const d = dist(x, z, b.x, b.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  /* ================= ВЫДЕЛЕНИЕ ================= */
  selectNone() {
    for (const e of this.selected) e.selected = false;
    this.selected.clear();
    this.emit('selection', []);
  }

  addToSelection(e) {
    if (this.selected.size >= 60) return;
    e.selected = true;
    this.selected.add(e);
    this.emit('selection', [...this.selected]);
  }

  setSelection(list) {
    this.selectNone();
    for (const e of list) this.addToSelection(e);
    if (list.length) this.audio.select();
  }

  selectAllOfType(typeId) {
    const list = this.units.filter((u) => u.faction === 'player' && u.typeId === typeId && u.visible);
    this.setSelection(list.slice(0, 60));
  }

  selectArmy() {
    const list = this.units.filter((u) => u.faction === 'player' && u.def.weapon);
    this.setSelection(list.slice(0, 60));
  }

  /* ================= ЦИКЛ ================= */
  update(dtRaw) {
    if (!this.running || this.paused) { this.render(); return; }
    const dt = Math.min(dtRaw, 0.05) * this.speed;
    this.time += dtRaw;
    this.simTime += dt;
    this.dayPhase = (this.dayPhase + dt / DAY_LENGTH) % 1;

    // туман войны: наблюдатели игрока
    const observers = this.units.filter((u) => u.faction === 'player');
    for (const b of this.players.player.buildings) if (!b.dead && !b.constructing) observers.push(b);

    this.fog.update(dt, observers);

    // видимость вражеских сущностей для игрока
    for (const e of this.entities) {
      if (e.faction === 'player') { e.visible = true; e.object.visible = true; continue; }
      const vis = this.fog.isVisible(e.x, e.z);
      e.visible = vis;
      e.object.visible = vis;
    }

    // ауры обнуляем каждый кадр
    for (const u of this.units) u.regen = 0;

    // хеши
    this.unitHash.clear();
    this.entityHash.clear();
    for (const u of this.units) this.unitHash.insert(u);
    for (const e of this.entities) this.entityHash.insert(e);

    // пассивный доход
    for (const f of ['player', 'enemy']) {
      this.players[f].crystal += 0.55 * (f === 'enemy' ? DIFFICULTY[this.difficulty].income : 1) * dt;
    }

    // сущности
    for (const e of this.entities) {
      if (e._removed || e.dead) continue;
      e.update(dt);
    }
    this.projectiles.update(dt);
    this.recomputePower();
    this.sweep();

    this.ai?.update(dt);

    this.crystalNodes.update(dt);
    this.terrain.update(dt, this.time);
    this.sky.update(this.dayPhase);
    this.sky.followTarget(this.cameraRig.target.x, this.cameraRig.target.z);
    if (this.terrain.uniforms) this.terrain.uniforms.uNight.value = this.sky.night;

    this.cameraRig.update(dtRaw);
    this.fx.update(dtRaw, this.camera);
    this.minimap?.update(dt);

    // оверлеи
    for (const e of this.entities) {
      if (!e.object.visible) continue;
      e.updateOverlays(this.camera, this.selected.has(e));
    }

    this.checkVictory();
    this.emit('tick', { dt });
  }

  render() {
    if (this.composer && this.bloomEnabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  checkVictory() {
    if (this.over) return;
    const pAlive = this.players.player.buildings.some((b) => !b.dead) || this.players.player.units.some((u) => !u.dead);
    const eAlive = this.players.enemy.buildings.some((b) => !b.dead) || this.players.enemy.units.some((u) => !u.dead);
    if (!eAlive) this.endGame(true);
    else if (!pAlive) this.endGame(false);
  }

  endGame(victory) {
    this.over = true;
    this.running = false;
    if (victory) { this.audio.victory(); this.toast('ПОБЕДА', 'Ядро противника уничтожено'); }
    else { this.audio.defeat(); this.toast('ПОРАЖЕНИЕ', 'Ваша база пала', true); }
    this.emit('game-over', {
      victory,
      time: this.simTime,
      stats: this.stats,
      crystals: Math.floor(this.stats.crystals.player),
      units: this.stats.units.player,
    });
  }

  shake(a, d) { this.cameraRig?.shake(a, d); }

  /* ================= СОБЫТИЯ / ЛОГ ================= */
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
  }
  emit(name, data) {
    const l = this.listeners.get(name);
    if (l) for (const f of l) f(data);
  }
  log(msg, kind = '') { this.emit('log', { msg, kind }); }
  toast(title, sub = '', red = false) { this.emit('toast', { title, sub, red }); }

  onBuildingComplete(b) {
    if (b.faction === 'player') {
      this.audio.build();
      this.log(`${b.def.name} построен`, 'good');
    }
    this.emit('building-complete', b);
  }

  onUnitProduced(b, unitId) {
    if (b.faction === 'player') {
      this.audio.ready();
      this.log(`${UNITS[unitId].name} готов`, '');
    }
    this.emit('unit-produced', { building: b, unitId });
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer?.setSize(innerWidth, innerHeight);
  }
}

export { TILE };
