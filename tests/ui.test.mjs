import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './stubs.js';

/* =========================================================
   Смоук-тест интерфейса и ввода: эти модули работают только
   с DOM, поэтому проверяем их на псевдо-DOM с настоящим 2D-канвасом
   ========================================================= */
const dom = installDom({ width: 1600, height: 900 });
const THREE = await import('three');
const { Game } = await import('../src/core/Game.js');
const { Input } = await import('../src/core/Input.js');
const { HUD } = await import('../src/ui/HUD.js');
const { UNITS, BUILDINGS, BUILD_ORDER } = await import('../src/data/defs.js');

Game.prototype.initRenderer = function () {
  this.renderer = {
    setPixelRatio() {}, setSize() {}, render() {}, getPixelRatio: () => 1,
    shadowMap: { enabled: false, type: 0 }, toneMapping: 0, toneMappingExposure: 1,
  };
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.FogExp2(0x0b1a26, 0.0042);
  this.camera = new THREE.PerspectiveCamera(52, 1600 / 900, 0.5, 900);
  this.camera.updateMatrixWorld();
  this.bloomEnabled = false;
  this.composer = null;
};
Game.prototype.setupComposer = async function () { this.composer = null; };

function makeSession() {
  const game = new Game(null);
  game.newGame(1, 0);
  const input = new Input(game, {
    canvas: dom.get('scene'),
    selBox: dom.get('selection-box'),
    placementHud: dom.get('placement-hud'),
  });
  input.enabled = true;
  const hud = new HUD(game, input);
  for (let i = 0; i < 30; i++) game.update(1 / 30);
  return { game, input, hud };
}

const mouseEvent = (x, y, extra = {}) => ({
  clientX: x, clientY: y, button: 0, shiftKey: false, ctrlKey: false, altKey: false,
  preventDefault() {}, ...extra,
});

test('интерфейс: HUD создаётся и обновляется без падений', () => {
  const { game, input, hud } = makeSession();
  hud.renderCommandCard();
  hud.renderSelection();
  hud.update(0.2);
  hud.pushLog('Проверка лога', 'good');
  hud.pushToast('ТЕСТ', 'подзаголовок');
  hud.showDefTooltip(BUILDINGS.reactor);
  hud.showEntityTooltip(game.players.player.units[0]);
  hud.moveTooltip();
  hud.setOrderMode('attack');
  hud.setOrderMode(null);
  hud.fillHelp();
  for (let i = 0; i < 60; i++) { game.update(1 / 30); hud.update(1 / 30); }
  assert.ok(true);
});

test('ввод: выбор кликом, рамкой и двойным кликом', () => {
  const { game, input, hud } = makeSession();
  const unit = game.players.player.units[0];
  // наводим камеру точно на юнита, чтобы проекция попала в цель
  game.cameraRig.focus(unit.x, unit.z, true);
  game.cameraRig.update(0.016);
  const p = input.project(unit);
  assert.ok(p, 'юнит не спроецировался на экран');

  input.clickSelect(mouseEvent(p.x, p.y));
  assert.equal(game.selected.size, 1, 'клик не выделил юнита');
  assert.ok(game.selected.has(unit));

  input.boxSelect(p.x - 60, p.y - 60, p.x + 60, p.y + 60, false);
  assert.ok(game.selected.size >= 1, 'рамка никого не выделила');

  input.clickSelect(mouseEvent(5, 5));
  assert.equal(game.selected.size, 0, 'клик в пустоту должен снимать выделение');

  game.selectAllOfType('harvester');
  assert.ok(game.selected.size >= 4, 'двойной клик по типу не выделил всех сборщиков');
  game.selectArmy();
  hud.renderSelection();
});

test('ввод: приказ на движение создаёт маршрут и метку', () => {
  const { game, input } = makeSession();
  const units = game.players.player.units.slice(0, 3);
  game.setSelection(units);
  const before = units.map((u) => ({ x: u.x, z: u.z }));
  input.rightClick(mouseEvent(800, 450));
  assert.ok(units.every((u) => u.state === 'move' || u.state === 'idle'), 'приказ не выдан');
  assert.ok(units.some((u) => u.path && u.path.length > 0), 'маршрут не построен');
  for (let i = 0; i < 120; i++) game.update(1 / 30);
  const moved = units.some((u, i) => Math.hypot(u.x - before[i].x, u.z - before[i].z) > 1.5);
  assert.ok(moved, 'юниты не сдвинулись после приказа');
});

test('ввод: горячие клавиши — стоп, удержание, атака, патруль, группы', () => {
  const { game, input } = makeSession();
  const units = game.players.player.units.slice(0, 3);
  game.setSelection(units);

  input.onKey({ key: 's', ctrlKey: false, preventDefault() {} }, true);
  assert.ok(units.every((u) => u.state === 'idle'), 'S не остановил юнитов');

  input.onKey({ key: 'h', ctrlKey: false, preventDefault() {} }, true);
  assert.ok(units.every((u) => u.state === 'hold'), 'H не перевёл в удержание');

  input.onKey({ key: 'a', ctrlKey: false, preventDefault() {} }, true);
  assert.equal(input.pendingOrder, 'attack', 'A не включил режим атаки');
  input.onKey({ key: 'Escape', ctrlKey: false, preventDefault() {} }, true);
  assert.equal(input.pendingOrder, null, 'Esc не отменил режим атаки');

  input.onKey({ key: 'p', ctrlKey: false, preventDefault() {} }, true);
  assert.equal(input.pendingOrder, 'patrol');
  input.patrolPoints = [];
  input.pendingOrder = null;

  // группы управления
  input.onKey({ key: '1', ctrlKey: true, preventDefault() {} }, true);
  assert.equal(game.controlGroups[1].length, units.length, 'группа 1 не сохранена');
  game.selectNone();
  input.onKey({ key: '1', ctrlKey: false, preventDefault() {} }, true);
  assert.equal(game.selected.size, units.length, 'группа 1 не вызвана');

  // стрелки двигают камеру, а A/S не перехватываются камерой
  const camBefore = { x: game.cameraRig.goal.x, z: game.cameraRig.goal.z };
  input.onKey({ key: 'ArrowUp', preventDefault() {} }, true);
  for (let i = 0; i < 40; i++) game.cameraRig.update(1 / 30);
  input.onKey({ key: 'ArrowUp', preventDefault() {} }, false);
  const camAfter = { x: game.cameraRig.goal.x, z: game.cameraRig.goal.z };
  assert.ok(Math.hypot(camAfter.x - camBefore.x, camAfter.z - camBefore.z) > 1, 'стрелки не двигают камеру');
  assert.equal(game.cameraRig.keys['a'], undefined, 'камера не должна перехватывать A (атака)');
  assert.equal(game.cameraRig.keys['s'], undefined, 'камера не должна перехватывать S (стоп)');

  // край экрана тоже панорамирует
  input.onMoveGlobal({ clientX: 2, clientY: 400 });
  assert.equal(game.cameraRig.edgePan.x, -1, 'левый край экрана не включает панораму');
  input.onMoveGlobal({ clientX: 800, clientY: 400 });
  assert.equal(game.cameraRig.edgePan.x, 0, 'панорама от края не выключается');

  // зум
  const dBefore = game.cameraRig.distanceGoal;
  game.cameraRig.zoom(0.2);
  assert.ok(game.cameraRig.distanceGoal > dBefore, 'колесо не увеличивает дистанцию');
  game.cameraRig.zoom(-0.4);
  assert.ok(game.cameraRig.distanceGoal < dBefore + 0.001, 'зум не работает в обратную сторону');
});

test('ввод: размещение постройки — призрак, валидация, отмена', () => {
  const { game, input, hud } = makeSession();
  const cc = game.players.player.buildings[0];
  game.cameraRig.focus(cc.x, cc.z, true);
  game.cameraRig.update(0.016);
  game.players.player.crystal = 5000;

  input.mouse.x = 800; input.mouse.y = 450;
  input.startPlacement('reactor');
  assert.ok(game.placement, 'режим размещения не включился');
  assert.equal(game.placement.typeId, 'reactor');
  input.updatePlacement();
  assert.ok(game.placement.ghost, 'призрак не создан');
  const crystalBefore = game.players.player.crystal;

  if (game.placement.valid) {
    input.confirmPlacement();
    assert.equal(game.placement, null, 'режим размещения не снят после установки');
    assert.ok(game.players.player.crystal < crystalBefore, 'кристаллы не списаны');
    assert.equal(game.players.player.buildings.length, 2, 'постройка не появилась');
  } else {
    // если точка занята — проверяем хотя бы отказ
    input.confirmPlacement();
    assert.equal(game.players.player.buildings.length, 1, 'постройка поставлена на невалидное место');
    input.cancelPlacement();
    assert.equal(game.placement, null);
  }

  // отмена по Esc
  input.startPlacement('wall');
  input.onKey({ key: 'Escape', ctrlKey: false, preventDefault() {} }, true);
  assert.equal(game.placement, null, 'Esc не отменил размещение');
});

test('ввод: карточка строительства перечисляет всё дерево построек', () => {
  const { game, input, hud } = makeSession();
  hud.buildMode = true;
  hud.renderCommandCard();
  assert.equal(hud.el.ccGrid.children.length, BUILD_ORDER.length, 'в меню строительства не все постройки');
  hud.buildMode = false;
});

test('ввод: производство через карточку команд ставит юнита в очередь', () => {
  const { game, input, hud } = makeSession();
  const cc = game.players.player.buildings[0];
  game.players.player.crystal = 5000;
  game.setSelection([cc]);
  hud.renderCommandCard();
  const btns = hud.el.ccGrid.children;
  assert.ok(btns.length >= 2, 'карточка команд командного центра пуста');
  // первая кнопка — производство сборщика
  const before = cc.queue.length;
  btns[0].onclick();
  assert.equal(cc.queue.length, before + 1, 'клик по кнопке производства не сработал');
});

test('миникарта: клики переносят камеру и отдают приказы', () => {
  const { game, input } = makeSession();
  const mm = dom.get('minimap');
  const units = game.players.player.units.slice(0, 2);
  game.setSelection(units);
  const before = { x: game.cameraRig.goal.x, z: game.cameraRig.goal.z };
  input.onMinimap({ button: 0, shiftKey: false, clientX: 10, clientY: 10, target: mm });
  const after = { x: game.cameraRig.goal.x, z: game.cameraRig.goal.z };
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 5, 'клик по миникарте не перенёс камеру');

  input.onMinimap({ button: 2, shiftKey: false, clientX: 200, clientY: 60, target: mm });
  assert.ok(units.every((u) => u.state === 'move'), 'ПКМ по миникарте не отдал приказ');
});

test('экран результатов: статистика выводится и матч перезапускается', () => {
  const { game, hud } = makeSession();
  let payload = null;
  game.on('game-over', (d) => { payload = d; });
  for (const e of [...game.players.enemy.buildings, ...game.players.enemy.units]) e.damage(99999, null, 'cannon');
  for (let i = 0; i < 10; i++) game.update(1 / 30);
  assert.ok(payload, 'событие завершения не пришло');
  hud.showEnd(payload);
  assert.ok(payload.time >= 0);
  assert.equal(typeof payload.stats.kills.player, 'number');
  assert.equal(typeof payload.stats.losses.player, 'number');
});

/* =========================================================
   Тач-управление и направление камеры
   ========================================================= */
test('камера: экранные оси панорамы не инвертированы', () => {
  const { game } = makeSession();
  const rig = game.cameraRig;
  rig.yaw = rig.yawGoal = Math.PI;   // детерминированный угол для проверки осей
  game.cameraRig.focus(0, 0, true);
  game.cameraRig.update(0.016);
  // при yaw=PI камера смотрит в +Z => ArrowUp должна увеличивать goal.z
  game.cameraRig.keys['arrowup'] = true;
  for (let i = 0; i < 30; i++) rig.update(1 / 30);
  rig.keys['arrowup'] = false;
  assert.ok(rig.goal.z > 1, 'ArrowUp ведёт камеру не «от зрителя»');
  // ArrowRight при yaw=PI => screen-right = -X
  rig.focus(0, 0, true); rig.update(0.016);
  rig.keys['arrowright'] = true;
  for (let i = 0; i < 30; i++) rig.update(1 / 30);
  rig.keys['arrowright'] = false;
  assert.ok(rig.goal.x < -1, 'ArrowRight ведёт не вправо по экрану');
});

test('ввод: тач-тап выбирает юнита', () => {
  const { game, input } = makeSession();
  const unit = game.players.player.units[0];
  game.cameraRig.focus(unit.x, unit.z, true);
  game.cameraRig.update(0.016);
  const p = input.project(unit);
  assert.ok(p);

  input.onTouchStart({ preventDefault() {}, touches: [{ identifier: 1, clientX: p.x, clientY: p.y }] });
  input.onTouchEnd({ preventDefault() {}, touches: [], changedTouches: [] });
  assert.equal(game.selected.size, 1, 'тап не выделил юнита');
});

test('ввод: панорама одним пальцем и щипок для зума', () => {
  const { game, input } = makeSession();
  const before = { x: game.cameraRig.goal.x, z: game.cameraRig.goal.z };
  input.onTouchStart({ preventDefault() {}, touches: [{ identifier: 1, clientX: 400, clientY: 300 }] });
  for (let i = 0; i < 20; i++) {
    input.onTouchMove({ preventDefault() {}, touches: [{ identifier: 1, clientX: 400 + i * 8, clientY: 300 }] });
  }
  input.onTouchEnd({ preventDefault() {}, touches: [], changedTouches: [] });
  const after = { x: game.cameraRig.goal.x, z: game.cameraRig.goal.z };
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 1, 'панорама тачем не сдвинула камеру');

  // щипок
  const d0 = game.cameraRig.distanceGoal;
  input.onTouchStart({ preventDefault() {}, touches: [
    { identifier: 1, clientX: 380, clientY: 300 },
    { identifier: 2, clientX: 420, clientY: 300 },
  ] });
  input.onTouchMove({ preventDefault() {}, touches: [
    { identifier: 1, clientX: 340, clientY: 300 },
    { identifier: 2, clientX: 460, clientY: 300 },
  ] });
  input.onTouchEnd({ preventDefault() {}, touches: [], changedTouches: [] });
  assert.ok(game.cameraRig.distanceGoal < d0, 'раскрывающий щипок должен приближать (zoom in)');
});
