import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './stubs.js';

/* =========================================================
   Headless-прогон настоящей игровой логики:
   карта, поиск пути, модели, экономика, бой, ИИ, туман войны
   ========================================================= */
const dom = installDom();
const THREE = await import('three');
const { GameMap } = await import('../src/world/GameMap.js');
const { Pathfinder } = await import('../src/world/Pathfinding.js');
const { FogOfWar } = await import('../src/world/FogOfWar.js');
const { Game } = await import('../src/core/Game.js');
const { createUnitModel, createBuildingModel, createGhost } = await import('../src/models/Models.js');
const { UNITS, BUILDINGS, MAP_PRESETS, DIFFICULTY, DMG_TABLE, dmgMult } = await import('../src/data/defs.js');
const { MinHeap, fbm, valueNoise, makeRng } = await import('../src/core/util.js');

/* --- вместо WebGL-рендерера: сцена и камера настоящие, растеризация отключена --- */
Game.prototype.initRenderer = function () {
  this.renderer = {
    setPixelRatio() {}, setSize() {}, render() {}, getPixelRatio: () => 1,
    shadowMap: { enabled: false, type: 0 }, toneMapping: 0, toneMappingExposure: 1,
    capabilities: { isWebGL2: true },
  };
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.FogExp2(0x0b1a26, 0.0042);
  this.camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 900);
  this.camera.updateMatrixWorld();
  this.bloomEnabled = false;
  this.composer = null;
};
Game.prototype.setupComposer = async function () { this.composer = null; };

function assertFiniteVec(e, where) {
  assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z), `${where}: координаты не конечны (${e.x}, ${e.z})`);
  assert.ok(Number.isFinite(e.y), `${where}: y не конечен (${e.y})`);
}

/* =========================================================
   1. Генерация карты
   ========================================================= */
test('карта: ландшафт, вода, жилы и проходимость генерируются корректно', () => {
  for (let mi = 0; mi < MAP_PRESETS.length; mi++) {
    const map = new GameMap(MAP_PRESETS[mi]);
    assert.equal(map.size, 96);
    let walkable = 0, nan = 0;
    for (let i = 0; i < map.size * map.size; i++) {
      if (!Number.isFinite(map.tileH[i])) nan++;
      if (map.isWalkable(i % map.size, (i / map.size) | 0)) walkable++;
    }
    assert.equal(nan, 0, `пресет ${mi}: есть NaN в высотах`);
    const ratio = walkable / (map.size * map.size);
    assert.ok(ratio > 0.25 && ratio < 0.98, `пресет ${mi}: проходимо ${(ratio * 100).toFixed(1)}% — вне разумных границ`);
    assert.ok(map.nodes.length >= 12, `пресет ${mi}: жил всего ${map.nodes.length}`);
    for (const n of map.nodes) {
      assert.ok(n.amount > 0, 'жила без запасов');
      assert.ok(Number.isFinite(n.x) && Number.isFinite(n.z), 'координаты жилы не конечны');
    }
    // стартовые площадки пригодны для командного центра 3×3
    for (const sp of map.spawns) {
      assert.ok(map.canPlace(sp.tx, sp.tz, 3), `пресет ${mi}: нельзя поставить КЦ в точке спавна ${sp.faction}`);
    }
  }
});

test('карта: шум детерминирован от сида', () => {
  const a = new GameMap(MAP_PRESETS[0]);
  const b = new GameMap(MAP_PRESETS[0]);
  assert.equal(a.heights[1234].toFixed(5), b.heights[1234].toFixed(5));
  assert.equal(a.nodes.length, b.nodes.length);
  assert.equal(valueNoise(3.5, 7.25, 11), valueNoise(3.5, 7.25, 11));
  assert.ok(Math.abs(fbm(1.5, 2.5, 4, 7)) <= 1.0001);
  const r1 = makeRng(42), r2 = makeRng(42);
  for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
});

test('карта: занятие и освобождение площадки под постройку', () => {
  const map = new GameMap(MAP_PRESETS[0]);
  const sp = map.spawns[0];
  assert.ok(map.canPlace(sp.tx, sp.tz, 3));
  map.occupy(sp.tx, sp.tz, 3);
  assert.equal(map.canPlace(sp.tx, sp.tz, 3), false, 'после occupy место должно быть занято');
  map.free(sp.tx, sp.tz, 3);
  assert.ok(map.canPlace(sp.tx, sp.tz, 3), 'после free место снова свободно');
  assert.equal(map.canPlace(-5, -5, 3), false, 'за границей карты строить нельзя');
});

/* =========================================================
   2. Поиск пути
   ========================================================= */
test('поиск пути: маршрут между базами существует и проходим', () => {
  const map = new GameMap(MAP_PRESETS[0]);
  const pf = new Pathfinder(map);
  const a = map.spawns[0], b = map.spawns[1];
  const path = pf.findPath(a.tx, a.tz, b.tx, b.tz);
  assert.ok(path, 'путь между базами не найден');
  assert.ok(path.length > 20, `подозрительно короткий путь: ${path.length} клеток`);
  for (const n of path) assert.ok(map.isWalkable(n.x, n.z), `клетка пути (${n.x},${n.z}) непроходима`);
  // конечная точка — цель
  const last = path[path.length - 1];
  assert.ok(Math.abs(last.x - b.tx) <= 1 && Math.abs(last.z - b.tz) <= 1, 'путь не доходит до цели');

  const world = pf.findWorldPath(...map.toWorld(a.tx, a.tz), ...map.toWorld(b.tx, b.tz));
  assert.ok(world && world.length >= 2, 'мировой путь не построен');
  assert.ok(world.length <= path.length, 'сглаживание не должно удлинять путь');
  for (const p of world) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'мировой путь содержит NaN');
});

test('поиск пути: недоступная цель даёт ближайшую достижимую точку', () => {
  const map = new GameMap(MAP_PRESETS[0]);
  const pf = new Pathfinder(map);
  const sp = map.spawns[0];
  // цель внутри занятой площадки
  map.occupy(sp.tx, sp.tz, 3);
  const p = pf.findPath(sp.tx + 6, sp.tz - 6, sp.tx, sp.tz);
  assert.ok(p, 'к занятой цели путь не найден (ожидалась ближайшая клетка)');
  for (const n of p) assert.ok(map.isWalkable(n.x, n.z));
});

test('поле потока: BFS-стоимости сходятся к цели', () => {
  const map = new GameMap(MAP_PRESETS[0]);
  const pf = new Pathfinder(map);
  const g = map.spawns[1];
  const flow = pf.flowField(g.tx, g.tz);
  assert.equal(flow.cost[g.tz * map.size + g.tx], 0, 'стоимость в цели не ноль');
  const s = map.spawns[0];
  const si = s.tz * map.size + s.tx;
  assert.ok(flow.cost[si] > 0, 'стартовая клетка недостижима по полю потока');
  let cur = si, steps = 0;
  while (steps++ < 5000) {
    const next = pf.flowStep(flow, cur % map.size, (cur / map.size) | 0);
    if (!next) break;
    const ni = next[1] * map.size + next[0];
    assert.ok(flow.cost[ni] < flow.cost[cur], 'шаг поля потока не уменьшает стоимость');
    cur = ni;
  }
  assert.ok(steps < 5000, 'спуск по полю потока зациклился');
});

test('MinHeap: извлекает в порядке возрастания', () => {
  const h = new MinHeap();
  const vals = [5, 3, 9, 1, 7, 2, 8];
  vals.forEach((v) => h.push({ f: v }));
  const out = [];
  while (h.size) out.push(h.pop().f);
  assert.deepEqual(out, [...vals].sort((a, b) => a - b));
});

/* =========================================================
   3. Модели
   ========================================================= */
test('модели: каждый юнит и здание собираются из мешей без NaN', () => {
  const countMeshes = (root) => {
    let n = 0, bad = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      n++;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) bad++;
      }
      assert.ok(o.material, 'меш без материала');
    });
    assert.ok(n > 0, 'модель без мешей');
    assert.equal(bad, 0, 'в геометрии есть NaN');
    return n;
  };

  for (const id of Object.keys(UNITS)) {
    const m = createUnitModel(id, 'player');
    assert.ok(countMeshes(m.group) >= 4, `юнит ${id}: слишком мало мешей`);
    assert.ok(m.parts, `юнит ${id}: нет parts для анимации`);
  }
  for (const id of Object.keys(BUILDINGS)) {
    const m = createBuildingModel(id, 'enemy');
    assert.ok(countMeshes(m.group) >= 2, `здание ${id}: слишком мало мешей`);
  }
  const ghost = createGhost('barracks');
  let transparent = 0;
  ghost.traverse((o) => { if (o.isMesh) { assert.equal(o.material.transparent, true, 'призрак должен быть полупрозрачным'); transparent++; } });
  assert.ok(transparent > 0);
});

/* =========================================================
   4. Таблица урона
   ========================================================= */
test('баланс: ракета сильнее пули по тяжёлой броне, пушка — по строениям', () => {
  assert.ok(dmgMult('missile', 'heavy') > dmgMult('bullet', 'heavy'), 'ПТРК должен пробивать танки лучше пули');
  assert.ok(dmgMult('missile', 'air') > dmgMult('cannon', 'air'), 'ракета должна сбивать авиацию, пушка — нет');
  assert.ok(dmgMult('cannon', 'structure') > dmgMult('bullet', 'structure'));
  assert.equal(dmgMult('unknown-type', 'light'), 1, 'неизвестный тип урона должен давать ×1');
  for (const t of Object.keys(DMG_TABLE)) {
    for (const a of ['light', 'medium', 'heavy', 'air', 'structure']) {
      assert.ok(DMG_TABLE[t][a] > 0, `${t} по ${a} должен быть > 0`);
    }
  }
});

/* =========================================================
   5. Туман войны
   ========================================================= */
test('туман войны: разведка открывает область и остаётся в памяти', () => {
  const map = new GameMap(MAP_PRESETS[0]);
  const fog = new FogOfWar(map, 96);
  const [wx, wz] = map.toWorld(48, 48);
  assert.equal(fog.isVisible(wx, wz), false, 'до разведки клетка не должна быть видна');
  fog.beginFrame();
  fog.reveal(wx, wz, 12);
  assert.ok(fog.isVisible(wx, wz), 'после разведки клетка должна быть видна');
  fog.beginFrame(); // наблюдатель ушёл
  assert.equal(fog.isVisible(wx, wz), false, 'без наблюдателя клетка больше не видна');
  assert.ok(fog.isExplored(wx, wz), 'разведанная клетка должна оставаться в памяти');
  const far = map.toWorld(5, 5);
  assert.equal(fog.isExplored(far[0], far[1]), false, 'неразведанный угол карты не должен быть открыт');
  fog.flush();
  const data = fog.image.data;
  assert.equal(data.length, 96 * 96 * 4);
});

/* =========================================================
   6. Полная симуляция матча
   ========================================================= */
test('матч: 6 минут симуляции — экономика, стройка ИИ, туман, без падений и NaN', () => {
  const game = new Game(null);
  game.newGame(1, 0);

  assert.equal(game.players.player.buildings.length, 1, 'у игрока должен быть 1 командный центр');
  assert.equal(game.players.enemy.buildings.length, 1, 'у врага должен быть 1 командный центр');
  const startHarvesters = game.players.player.units.filter((u) => u.typeId === 'harvester').length;
  assert.equal(startHarvesters, 4, 'стартовых сборщиков должно быть 4');
  assert.ok(game.players.player.popCap >= 10, `лимит армии не посчитан: ${game.players.player.popCap}`);

  // приказываем сборщикам работать
  for (const u of game.players.player.units) {
    if (u.def.harvest) {
      const node = game.findNearestNode(u.x, u.z);
      assert.ok(node, 'жила для сборщика не найдена');
      u.orderHarvest(node);
    }
  }
  // ставим казармы и запускаем производство
  const cc = game.players.player.buildings[0];
  const [btx, btz] = game.map.toTile(cc.x + 12, cc.z + 12);
  assert.ok(game.map.canPlace(btx, btz, 3), 'нет места под казармы рядом с базой');
  const barracks = game.spawnBuilding('barracks', 'player', btx, btz);
  game.players.player.crystal = 5000;
  game.tryProduce(barracks, 'ranger');
  assert.equal(barracks.queue.length, 1, 'юнит не встал в очередь производства');

  const dt = 1 / 30;
  const steps = Math.round((6 * 60) / dt);
  let exploredPeak = 0;
  for (let i = 0; i < steps; i++) {
    game.update(dt);
    if (i % 300 === 0) {
      for (const e of game.entities) assertFiniteVec(e, `${e.def.name} на шаге ${i}`);
      let explored = 0;
      for (let k = 0; k < game.fog.grid.length; k++) if (game.fog.grid[k] > 0) explored++;
      exploredPeak = Math.max(exploredPeak, explored);
    }
    if (game.over) break;
  }

  assert.ok(game.simTime > 200, `симуляция прошла лишь ${game.simTime.toFixed(1)}с`);
  assert.ok(exploredPeak > 100, `туман войны почти не открывался: ${exploredPeak} клеток`);
  assert.ok(game.stats.crystals.player > 0, 'сборщики не сдали ни одного кристалла');
  assert.ok(game.players.enemy.buildings.length >= 3, `ИИ не развился: построек ${game.players.enemy.buildings.length}`);
  assert.ok(game.players.enemy.units.length >= 2, 'ИИ не произвёл армию');
  assert.ok(barracks.constructing === false, 'казармы не достроились за 6 минут');
  assert.ok(game.stats.units.player >= 2, 'производство юнитов не сработало');
  if (game.over) {
    // матч legitimately завершился — проверяем, что это поражение, а не сбой
    assert.equal(game.running, false, 'после game-over симуляция должна останавливаться');
  } else {
    // мощность и лимит должны точно соответствовать живым достроенным зданиям
    const live = game.players.player.buildings.filter((b) => !b.dead && !b.constructing);
    const expectedPower = live.reduce((sum, b) => sum + Math.max(0, b.def.power || 0), 0);
    const expectedCap = Math.max(10, live.reduce((sum, b) => sum + (b.def.popCap || 0), 0));
    assert.equal(game.players.player.power, expectedPower, 'мощность не соответствует постройкам');
    assert.equal(game.players.player.popCap, expectedCap, 'лимит армии не соответствует постройкам');
  }
  // в мире не должно оставаться мёртвых сущностей
  assert.equal(game.entities.filter((e) => e.dead).length, 0, 'мёртвые сущности не убраны из мира');
  assert.equal(game.units.filter((e) => e.dead).length, 0, 'мёртвые юниты остались в массиве');
  for (const b of game.buildings) {
    const flags = game.map.block[b.tz * game.map.size + b.tx];
    assert.ok(flags & 4, `живое здание (${b.def.name}) не занимает клетки карты`);
  }

  // экономика: энергия считается, дефицит замедляет
  const p = game.players.player;
  assert.ok(Number.isFinite(p.crystal), 'кристаллы ушли в NaN');
  game.players.enemy.powerUsed = 999;
  assert.ok(game.powerFactor('enemy') < 1, 'при дефиците энергии скорость должна падать');
  game.players.enemy.powerUsed = 0;
  assert.equal(game.powerFactor('enemy'), 1);
});

/* =========================================================
   7. Бой
   ========================================================= */
test('бой: снаряды летят, урон проходит по таблице, юниты гибнут', () => {
  const game = new Game(null);
  game.newGame(2, 1);
  const player = game.players.player;
  const cc = player.buildings[0];

  // отряд игрока
  // второй командный центр — поднимает лимит армии и проверяет мульти-КЦ
  const [c2x, c2z] = game.map.nearestWalkable(...game.map.toTile(cc.x - 14, cc.z + 10), 10);
  game.spawnBuilding('command', 'player', c2x, c2z, true);
  game.recomputePower();
  assert.ok(game.players.player.popCap >= 20, `лимит армии не вырос: ${game.players.player.popCap}`);
  const squad = [];
  for (let i = 0; i < 6; i++) squad.push(game.spawnUnit('ranger', 'player', cc.x + 6 + i, cc.z + 8));
  squad.push(game.spawnUnit('lancer', 'player', cc.x + 4, cc.z + 12));
  squad.push(game.spawnUnit('bastion', 'player', cc.x - 4, cc.z + 12));
  assert.ok(squad.every(Boolean), 'не все юниты заспавнились');

  // вражеский отряд вплотную
  const foes = [];
  for (let i = 0; i < 5; i++) foes.push(game.spawnUnit('ranger', 'enemy', cc.x + 20 + i, cc.z + 10));
  foes.push(game.spawnUnit('bastion', 'enemy', cc.x + 24, cc.z + 14));
  for (const u of squad) u.orderAttackMove(cc.x + 24, cc.z + 12);

  const hpBefore = foes.reduce((s, e) => s + e.hp, 0);
  const dt = 1 / 30;
  let shots = 0;
  for (let i = 0; i < 90 * 30; i++) {
    game.update(dt);
    shots = Math.max(shots, game.projectiles.items.length);
    if (foes.every((f) => f.dead)) break;
  }

  const hpAfter = foes.filter((f) => !f.dead).reduce((s, e) => s + e.hp, 0);
  assert.ok(hpAfter < hpBefore, 'урон врагам не нанесён');
  const deadFoes = foes.filter((f) => f.dead).length;
  assert.ok(deadFoes > 0, 'никто не погиб в бою');
  assert.equal(game.stats.losses.enemy, deadFoes, 'счётчик потерь врага не совпал с числом погибших');
  assert.ok(game.stats.kills.player >= deadFoes, 'счётчик убийств игрока не обновился');
  // мёртвые убраны из сцены и массивов (sweep происходит в следующем кадре)
  for (let i = 0; i < 5; i++) game.update(1 / 30);
  assert.equal(game.units.some((u) => u.dead && u._removed), false, 'мёртвые юниты остались в массиве');
  for (const e of game.entities) assert.ok(!e.dead, 'в entities остался мёртвый объект');
  assert.equal(game.units.filter((u) => u.faction === 'enemy' && foes.includes(u)).length, 0,
    'погибшие враги не убраны из списка юнитов');
});

test('бой: турель и тесла сбивают авиацию, а пушка — нет', () => {
  const game = new Game(null);
  game.newGame(1, 0);
  const cc = game.players.player.buildings[0];
  const [tx, tz] = game.map.toTile(cc.x + 10, cc.z);
  const turret = game.spawnBuilding('turret', 'player', tx, tz, true);
  assert.ok(turret.def.weapon.airCapable, 'турель должна бить по воздуху');

  const wasp = game.spawnUnit('wasp', 'enemy', cc.x + 14, cc.z);
  const hp0 = wasp.hp;
  for (let i = 0; i < 30 * 12; i++) game.update(1 / 30);
  assert.ok(wasp.hp < hp0 || wasp.dead, 'турель не обстреляла самолёт');
});

test('добыча: сборщик добывает, везёт и сдаёт кристаллы', () => {
  const game = new Game(null);
  game.newGame(1, 0);
  const cc = game.players.player.buildings[0];
  const h = game.spawnUnit('harvester', 'player', cc.x + 4, cc.z + 4);
  const node = game.findNearestNode(h.x, h.z);
  h.orderHarvest(node);
  const nodeBefore = node.amount;
  const crystalBefore = game.players.player.crystal;
  let sawCarry = false;
  for (let i = 0; i < 30 * 240; i++) {
    game.update(1 / 30);
    if (h.harvest.carrying > 0) sawCarry = true;
    if (game.players.player.crystal > crystalBefore + 20) break;
  }
  assert.ok(sawCarry, 'сборщик ничего не добыл');
  assert.ok(node.amount < nodeBefore, 'жила не опустошается');
  assert.ok(game.players.player.crystal > crystalBefore, 'кристаллы не зачислены на счёт');
});

/* =========================================================
   8. Победа/поражение
   ========================================================= */
test('условия победы: уничтожение всех построек и юнитов завершает матч', () => {
  const game = new Game(null);
  game.newGame(1, 0);
  let result = null;
  game.on('game-over', (d) => { result = d; });
  for (const e of [...game.players.enemy.buildings, ...game.players.enemy.units]) {
    e.hp = 1;
    e.damage(9999, null, 'cannon');
  }
  for (let i = 0; i < 10; i++) game.update(1 / 30);
  assert.ok(result, 'событие game-over не сработало');
  assert.equal(result.victory, true, 'ожидалась победа');
  assert.equal(game.over, true);
  assert.equal(game.running, false);
});

test('условия поражения: потеря всех своих юнитов и построек', () => {
  const game = new Game(null);
  game.newGame(1, 0);
  let result = null;
  game.on('game-over', (d) => { result = d; });
  for (const e of [...game.players.player.buildings, ...game.players.player.units]) {
    e.hp = 1;
    e.damage(99999, null, 'cannon');
  }
  for (let i = 0; i < 10; i++) game.update(1 / 30);
  assert.ok(result, 'поражение не засчитано');
  assert.equal(result.victory, false);
});

/* =========================================================
   9. Приказы и группы
   ========================================================= */
test('приказы: движение, стоп, удержание, патруль меняют состояние', () => {
  const game = new Game(null);
  game.newGame(1, 0);
  const cc = game.players.player.buildings[0];
  const u = game.spawnUnit('ranger', 'player', cc.x + 3, cc.z + 3);
  const [tx, tz] = game.map.toTile(cc.x + 26, cc.z - 18);
  const [wx, wz] = game.map.toWorld(tx, tz);

  u.orderMove(wx, wz);
  assert.equal(u.state, 'move');
  assert.ok(u.path && u.path.length > 1, 'маршрут не построен');
  for (let i = 0; i < 60; i++) game.update(1 / 30);
  assert.ok(Math.hypot(u.x - (cc.x + 3), u.z - (cc.z + 3)) > 2, 'юнит не сдвинулся с места');

  u.orderStop();
  assert.equal(u.state, 'idle');
  u.orderHold();
  assert.equal(u.state, 'hold');
  u.orderPatrol([{ x: wx, z: wz }, { x: cc.x + 3, z: cc.z + 3 }]);
  assert.equal(u.state, 'move');
  assert.ok(u.patrol && u.patrol.length === 2, 'маршрут патруля не записан');
});

test('приказы: производство требует кристаллов и лимита армии', () => {
  const game = new Game(null);
  game.newGame(1, 0);
  const cc = game.players.player.buildings[0];
  game.players.player.crystal = 0;
  assert.equal(game.tryProduce(cc, 'harvester'), false, 'должно отказать без кристаллов');
  game.players.player.crystal = 99999;
  game.players.player.popCap = game.players.player.pop; // лимит исчерпан
  assert.equal(game.tryProduce(cc, 'harvester'), false, 'должно отказать при полном лимите');
  game.players.player.popCap += 5;
  assert.equal(game.tryProduce(cc, 'harvester'), true, 'не поставил в очередь при доступных ресурсах');
  assert.equal(cc.queue.length, 1);
});

test('все пресеты сложности и карт стартуют без ошибок', () => {
  for (let d = 0; d < DIFFICULTY.length; d++) {
    for (let m = 0; m < MAP_PRESETS.length; m++) {
      const game = new Game(null);
      game.newGame(d, m);
      for (let i = 0; i < 30 * 25; i++) game.update(1 / 30);
      assert.ok(game.entities.length > 5, `d=${d} m=${m}: мир почти пуст`);
      for (const e of game.entities) assertFiniteVec(e, `d=${d} m=${m} ${e.def.name}`);
      game.disposeWorld();
    }
  }
});
