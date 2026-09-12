import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { HUD } from './ui/HUD.js';
import { MAP_PRESETS, DIFFICULTY } from './data/defs.js';

/* =========================================================
   Точка входа: экран запуска, игровой цикл, resize
   ========================================================= */
const canvas = document.getElementById('scene');
const game = new Game(canvas);

let input = null;
let hud = null;
let chosen = { diff: 1, map: 0 };

/* ---------- экран запуска ---------- */
document.querySelectorAll('.diff').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.diff').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    chosen.diff = +b.dataset.diff;
  };
});
document.querySelectorAll('.mapsel').forEach((b, i) => {
  if (i === 0) b.classList.add('active');
  b.onclick = () => {
    document.querySelectorAll('.mapsel').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    chosen.map = +b.dataset.map;
  };
});

document.getElementById('btn-start').onclick = () => startGame();
document.getElementById('btn-restart').onclick = () => {
  document.getElementById('screen-end').classList.add('hidden');
  startGame();
};
game.on('restart', () => startGame());

async function startGame() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('screen-start').classList.add('hidden');
  document.getElementById('screen-end').classList.add('hidden');

  game.audio.init();
  game.audio.resume();
  game.audio.startAmbient();

  await new Promise((r) => requestAnimationFrame(() => r()));
  game.newGame(chosen.diff, chosen.map);

  if (!input) {
    input = new Input(game, {
      canvas,
      selBox: document.getElementById('selection-box'),
      placementHud: document.getElementById('placement-hud'),
    });
    hud = new HUD(game, input);
    input.enabled = true;
    bindMinimapCamera();
  } else {
    // перепривязываем миникарту под новую карту
    const mm = document.getElementById('minimap');
    mm.onmousedown = (e) => input.onMinimap(e);
  }
  hud.renderCommandCard();
  hud.renderSelection();
  await game.setupComposer();
  document.getElementById('loading').classList.add('hidden');
}

function bindMinimapCamera() {
  const mm = document.getElementById('minimap');
  mm.addEventListener('contextmenu', (e) => e.preventDefault());
}

/* ---------- игровой цикл ---------- */
let last = performance.now();
let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game.running) { game.render?.(); return; }
  game.update(dt);
  game.render();
  hud?.update(dt);

  // авто-подстройка качества
  fpsAcc += dt; fpsCount++; fpsTimer += dt;
  if (fpsTimer > 2) {
    const fps = fpsCount / fpsAcc;
    if (fps < 26 && game.renderer.getPixelRatio() > 1) {
      game.renderer.setPixelRatio(1);
      game.composer?.setPixelRatio?.(1);
    }
    fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
  }
}
requestAnimationFrame(loop);

/* ---------- resize ---------- */
let resizeT;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => game.resize(), 80);
});

/* ---------- PWA: офлайн-режим (только в production, чтобы не ломать HMR) ---------- */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker не зарегистрирован:', err);
    });
  });
}

/* ---------- отладка ---------- */
window.__game = game;
document.getElementById('loading').classList.add('hidden');
