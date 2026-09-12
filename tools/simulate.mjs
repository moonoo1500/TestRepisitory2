/* =========================================================
   Автоплеер для проверки баланса.
   Запуск: node tools/simulate.mjs [сложность] [карта]
   Играет «средний» игрок: добыча, стройка по билд-ордеру,
   производство армии и атака при 14+ боевых юнитах.
   ========================================================= */
import { installDom } from '../tests/stubs.js';
installDom();
const THREE = await import('three');
const { Game } = await import('../src/core/Game.js');
const { BUILDINGS, UNITS, DIFFICULTY, MAP_PRESETS } = await import('../src/data/defs.js');

Game.prototype.initRenderer = function () {
  this.renderer = {
    setPixelRatio() {}, setSize() {}, render() {}, getPixelRatio: () => 1,
    shadowMap: { enabled: false, type: 0 }, toneMapping: 0, toneMappingExposure: 1,
  };
  this.scene = new THREE.Scene();
  this.scene.fog = new THREE.FogExp2(0x0b1a26, 0.0042);
  this.camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 900);
  this.camera.updateMatrixWorld();
  this.bloomEnabled = false;
  this.composer = null;
};
Game.prototype.setupComposer = async function () { this.composer = null; };

function play(diff, mapIdx, maxMinutes = 16) {
  const game = new Game(null);
  game.newGame(diff, mapIdx);
  const plan = ['reactor', 'barracks', 'reactor', 'turret', 'factory', 'reactor', 'turret', 'airpad', 'reactor', 'tesla', 'techlab'];
  let pi = 0;
  const dt = 1 / 30;
  const steps = Math.round((60 * maxMinutes) / dt);

  for (let i = 0; i < steps && !game.over; i++) {
    if (i % 30 === 0) {
      const p = game.players.player;
      const cc = p.buildings.find((b) => b.typeId === 'command' && !b.constructing);

      for (const h of p.units.filter((u) => u.typeId === 'harvester')) {
        if (h.state === 'idle' || h.state === 'hold') {
          const n = game.findNearestNode(h.x, h.z);
          if (n) h.orderHarvest(n);
        }
      }
      const hs = p.units.filter((u) => u.typeId === 'harvester').length;
      if (hs < 12 && cc && cc.queue.length < 2 && p.crystal >= 60) game.tryProduce(cc, 'harvester');

      if (pi < plan.length && p.crystal >= BUILDINGS[plan[pi]].cost.crystal + 60) {
        const id = plan[pi];
        const base = cc || p.buildings[0];
        if (base) {
          for (let a = 0; a < 150; a++) {
            const ang = Math.random() * Math.PI * 2;
            const r = 9 + Math.random() * 16;
            const [tx, tz] = game.map.toTile(base.x + Math.cos(ang) * r, base.z + Math.sin(ang) * r);
            if (game.map.canPlace(tx, tz, BUILDINGS[id].size)) {
              p.crystal -= BUILDINGS[id].cost.crystal;
              game.spawnBuilding(id, 'player', tx, tz);
              pi++;
              break;
            }
          }
        }
      }

      for (const b of p.buildings) {
        if (b.constructing || !b.def.produces || b.typeId === 'command' || b.queue.length >= 2) continue;
        const opts = b.def.produces.filter((u) => p.crystal >= UNITS[u].cost.crystal && p.pop + UNITS[u].pop <= p.popCap);
        if (opts.length) game.tryProduce(b, opts[(Math.random() * opts.length) | 0]);
      }

      const army = p.units.filter((u) => u.def.weapon);
      const foe = game.players.enemy.buildings.filter((b) => !b.dead);
      if (army.length >= 14 && foe.length) {
        foe.sort((a, b) => Math.hypot(a.x - army[0].x, a.z - army[0].z) - Math.hypot(b.x - army[0].x, b.z - army[0].z));
        const t = foe[0];
        for (const u of army) if (u.state !== 'attack') u.orderAttackMove(t.x, t.z);
      }
    }
    game.update(dt);
  }

  const p = game.players.player, e = game.players.enemy;
  return {
    сложность: DIFFICULTY[diff].name,
    карта: MAP_PRESETS[mapIdx].name,
    время: `${Math.round(game.simTime / 60)}м${Math.round(game.simTime % 60)}с`,
    итог: !game.over ? 'не закончилась' : (e.buildings.length === 0 && e.units.length === 0 ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'),
    игрок: `${p.buildings.length} зд. / ${p.units.length} юн.`,
    враг: `${e.buildings.length} зд. / ${e.units.length} юн.`,
    убийств: game.stats.kills.player,
    потерь: game.stats.losses.player,
    кристаллов: Math.round(game.stats.crystals.player),
  };
}

const only = process.argv[2] !== undefined ? [+process.argv[2]] : [0, 1, 2];
for (const d of only) {
  const r = play(d, d % 3);
  console.log(JSON.stringify(r));
}
