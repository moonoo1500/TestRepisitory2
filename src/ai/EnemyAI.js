import { BUILDINGS, UNITS, DIFFICULTY } from '../data/defs.js';
import { dist, rand, randInt } from '../core/util.js';

/* =========================================================
   ИИ противника: экономика, экспансия, оборона, волны атак
   ========================================================= */
const MAX_BUILDINGS = 20;
const MAX_DEFENSE = 6;

/** Порядок развития: энергия -> пехота -> техника -> авиация -> экспериментальное */
const BUILD_PLAN = [
  { id: 'reactor', count: 1 },
  { id: 'barracks', count: 1 },
  { id: 'turret', count: 2 },
  { id: 'reactor', count: 2 },
  { id: 'factory', count: 1 },
  { id: 'barracks', count: 2 },
  { id: 'pylon', count: 1 },
  { id: 'reactor', count: 3 },
  { id: 'airpad', count: 1 },
  { id: 'factory', count: 2 },
  { id: 'turret', count: 4 },
  { id: 'techlab', count: 1 },
  { id: 'reactor', count: 4 },
  { id: 'tesla', count: 2 },
];

export class EnemyAI {
  constructor(game, difficulty) {
    this.game = game;
    this.faction = 'enemy';
    this.diff = DIFFICULTY[difficulty];
    this.timer = 0;
    this.think = 1.4;
    this.planIdx = 0;
    this.waveTimer = this.diff.waveTime * 1.55;
    this.waveNumber = 0;
    this.harvesterTarget = 6 + difficulty * 3;
    this.armyGoal = 6 + difficulty * 4;
    this.state = 'eco';
    this.lastAttack = 0;
    this.scoutTimer = 90;
    this.defenseTriggered = 0;
  }

  get me() { return this.game.players.enemy; }

  update(dt) {
    this.timer += dt;
    this.waveTimer -= dt;
    this.scoutTimer -= dt;

    if (this.timer < this.think) return;
    this.timer = 0;

    this.manageEconomy();
    this.manageBuild();
    this.manageArmy();
    this.manageAttack();
  }

  /* ---------- добыча ---------- */
  manageEconomy() {
    const harvesters = this.me.units.filter((u) => u.typeId === 'harvester');
    const idle = harvesters.filter((u) => u.state === 'idle');
    for (const h of idle) {
      const node = this.game.findNearestNode(h.x, h.z);
      if (node) h.orderHarvest(node);
    }
    // добираем сборщиков
    const ccs = this.me.buildings.filter((b) => b.typeId === 'command' && !b.constructing);
    if (harvesters.length < this.harvesterTarget && ccs.length) {
      const cc = ccs[0];
      if (cc.queue.length < 2 && this.me.crystal >= UNITS.harvester.cost.crystal) {
        this.game.tryProduce(cc, 'harvester');
      }
    }
  }

  /* ---------- строительство ---------- */
  manageBuild() {
    const counts = {};
    for (const b of this.me.buildings) counts[b.typeId] = (counts[b.typeId] || 0) + 1;

    const totalBuildings = this.me.buildings.filter((b) => !b.dead).length;
    const army = this.me.units.filter((u) => u.def.weapon).length;

    // энергия прежде всего
    const power = this.me.power, used = this.me.powerUsed;
    const needPower = used + 30 > power;

    if (needPower && this.me.crystal >= BUILDINGS.reactor.cost.crystal) {
      this.place('reactor');
      return;
    }

    // упираемся в лимит армии — ставим ещё один командный центр (экспансия)
    if (this.me.pop + 2 >= this.me.popCap && this.me.crystal >= BUILDINGS.command.cost.crystal && totalBuildings < MAX_BUILDINGS) {
      if (this.place('command')) return;
    }

    // не раздуваем базу бесконечно — дальше всё в армию
    if (totalBuildings >= MAX_BUILDINGS) return;

    // следующий по плану
    while (this.planIdx < BUILD_PLAN.length) {
      const step = BUILD_PLAN[this.planIdx];
      const have = counts[step.id] || 0;
      if (have < step.count) {
        const def = BUILDINGS[step.id];
        const reqOk = !def.requires || def.requires.every((r) => (counts[r] || 0) > 0);
        if (!reqOk) { this.planIdx++; continue; }
        if (this.me.crystal < def.cost.crystal) return;
        if (this.place(step.id)) { counts[step.id] = have + 1; return; }
        this.planIdx++;
        return;
      }
      this.planIdx++;
    }

    // план выполнен: достраиваем только то, что реально нужно
    const defense = (counts.turret || 0) + (counts.tesla || 0);
    if (this.me.crystal > 450) {
      if (needPower) this.place('reactor');
      else if (defense < MAX_DEFENSE && totalBuildings < MAX_BUILDINGS) this.place('turret');
      else if ((counts.barracks || 0) < 3) this.place('barracks');
      // иначе копим на армию
    }
  }

  place(typeId) {
    const def = BUILDINGS[typeId];
    const base = this.me.buildings[0] || this.me.buildings.find((b) => !b.dead);
    if (!base) return false;
    const map = this.game.map;
    for (let attempt = 0; attempt < 90; attempt++) {
      const ang = rand(Math.PI * 2);
      const r = typeId === 'turret' || typeId === 'tesla' ? rand(16, 8) : rand(22, 9);
      const wx = base.x + Math.cos(ang) * r;
      const wz = base.z + Math.sin(ang) * r;
      const [tx, tz] = map.toTile(wx, wz);
      if (!map.canPlace(tx, tz, def.size)) continue;
      // не ставить вплотную к другим своим постройкам (кроме обороны)
      if (def.size >= 3) {
        let tooClose = false;
        for (const b of this.me.buildings) {
          if (b.dead) continue;
          if (dist(wx, wz, b.x, b.z) < (b.size + def.size) * map.tile * 0.42) { tooClose = true; break; }
        }
        if (tooClose) continue;
      }
      this.game.spawnBuilding(typeId, this.faction, tx, tz);
      this.me.crystal -= def.cost.crystal;
      return true;
    }
    return false;
  }

  /* ---------- производство армии ---------- */
  manageArmy() {
    const counts = {};
    for (const b of this.me.buildings) if (!b.constructing && b.dead === false) counts[b.typeId] = (counts[b.typeId] || 0) + 1;

    const prods = this.me.buildings.filter((b) => !b.constructing && b.def.produces);
    const army = this.me.units.filter((u) => u.def.weapon);
    const needMore = army.length < this.armyGoal + this.waveNumber * 2;

    for (const b of prods) {
      if (b.queue.length >= 2) continue;
      const options = b.def.produces.filter((u) => {
        const d = UNITS[u];
        if (this.me.crystal < d.cost.crystal) return false;
        if (this.me.pop + d.pop > this.me.popCap) return false;
        return true;
      });
      if (!options.length) continue;
      // приоритет: против воздуха если есть авиация игрока, иначе микс
      const playerAir = this.game.players.player.units.some((u) => u.def.flying && u.visible);
      let choice;
      if (playerAir && options.includes('lancer') && Math.random() < 0.5) choice = 'lancer';
      else choice = options[randInt(options.length)];
      if (needMore || b.typeId === 'barracks') this.game.tryProduce(b, choice);
    }
  }

  /* ---------- атака ---------- */
  manageAttack() {
    const army = this.me.units.filter((u) => u.def.weapon && !u.dead);
    const strong = army.length >= this.armyGoal || this.waveTimer <= 0;

    // оборона базы
    const threatened = this.me.buildings.some((b) =>
      !b.dead && this.game.getEnemiesNear('enemy', b.x, b.z, 26, []).length > 0,
    );
    if (threatened) {
      const threat = this.game.players.player.units.find((u) => u.visible && u.def.weapon);
      if (threat) {
        for (const u of army) {
          if (dist(u.x, u.z, threat.x, threat.z) < 60) u.orderAttackMove(threat.x, threat.z);
        }
        this.defenseTriggered = 12;
        return;
      }
    }

    if (!strong || army.length < 2) return;
    if (this.waveTimer > 0 && army.length < this.armyGoal) return;

    // цель: ближайшее видимое здание игрока, иначе его база
    const targets = this.game.players.player.buildings.filter((b) => !b.dead);
    if (!targets.length) return;
    const rally = army.reduce((acc, u) => ({ x: acc.x + u.x / army.length, z: acc.z + u.z / army.length }), { x: 0, z: 0 });
    targets.sort((a, b) => dist(rally.x, rally.z, a.x, a.z) - dist(rally.x, rally.z, b.x, b.z));
    const target = targets[Math.random() < 0.7 ? 0 : randInt(targets.length)];

    this.waveNumber++;
    this.waveTimer = this.diff.waveTime * rand(1.15, 0.85);
    this.armyGoal = Math.min(26, this.armyGoal + 2);
    for (const u of army) u.orderAttackMove(target.x, target.z);

    if (this.game.cameraRig.distanceTo(target.x, 0, target.z) < 200) {
      this.game.log(`Разведка: волна ${this.waveNumber} движется к вам`, 'bad');
      this.game.audio.alarm();
    }
    this.game.emit('ai-wave', { number: this.waveNumber, size: army.length });
  }
}
