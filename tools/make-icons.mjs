/* =========================================================
   Генератор иконок приложения (PWA + Android-адаптивная).
   Запуск: node tools/make-icons.mjs
   Ничего не скачивает — рисует @napi-rs/canvas.
   ========================================================= */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

/** Ромб Альянса Вегой — тот же знак, что в логотипе интерфейса */
function draw(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  const pad = maskable ? size * 0.2 : size * 0.08;
  const s = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;

  // фон
  const bg = g.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#07111c');
  bg.addColorStop(1, '#04070d');
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  // тонкая рамка-скос
  g.strokeStyle = 'rgba(0,229,255,0.22)';
  g.lineWidth = Math.max(1, size * 0.006);
  g.strokeRect(pad * 0.5, pad * 0.5, size - pad, size - pad);

  // свечение
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.62);
  glow.addColorStop(0, 'rgba(0,229,255,0.55)');
  glow.addColorStop(1, 'rgba(0,229,255,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, cy, s * 0.62, 0, Math.PI * 2);
  g.fill();

  // ромб
  const r = s * 0.36;
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#9df3ff');
  grad.addColorStop(0.5, '#00e5ff');
  grad.addColorStop(1, '#0077a8');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r, cy);
  g.lineTo(cx, cy + r);
  g.lineTo(cx - r, cy);
  g.closePath();
  g.fill();

  // внутренняя грань
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = Math.max(1, size * 0.008);
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx, cy + r);
  g.moveTo(cx - r, cy);
  g.lineTo(cx + r, cy);
  g.stroke();

  return c;
}

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'icon-36.png', size: 36 },
  { file: 'icon-48.png', size: 48 },
  { file: 'icon-72.png', size: 72 },
  { file: 'icon-96.png', size: 96 },
  { file: 'icon-144.png', size: 144 },
];

for (const t of targets) {
  const png = draw(t.size, { maskable: t.maskable }).toBuffer('image/png');
  writeFileSync(join(outDir, t.file), png);
  console.log(`${t.file.padEnd(24)} ${t.size}×${t.size}  ${(png.length / 1024).toFixed(1)} КБ`);
}
