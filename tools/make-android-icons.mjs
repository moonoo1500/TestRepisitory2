// Брендирует иконки Android-проекта (заменяет дефолт Capacitor).
// Пишет в android/app/src/main/res/mipmap-<density>/.
// Запуск: node tools/make-android-icons.mjs
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');

const DENS = [
  ['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4],
];

function base(size, { transparent = false, padFrac = 0.08 } = {}) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  if (!transparent) {
    const bg = g.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, '#07111c');
    bg.addColorStop(1, '#04070d');
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(0,229,255,0.22)';
    g.lineWidth = Math.max(1, size * 0.01);
    g.strokeRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92);
  }
  const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.6);
  glow.addColorStop(0, 'rgba(0,229,255,0.5)');
  glow.addColorStop(1, 'rgba(0,229,255,0)');
  g.fillStyle = glow;
  g.beginPath(); g.arc(size / 2, size / 2, size * 0.6, 0, Math.PI * 2); g.fill();

  const r = size * (0.5 - padFrac);
  const cx = size / 2, cy = size / 2;
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#9df3ff');
  grad.addColorStop(0.5, '#00e5ff');
  grad.addColorStop(1, '#0077a8');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = Math.max(1, size * 0.012);
  g.beginPath();
  g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
  g.moveTo(cx - r, cy); g.lineTo(cx + r, cy);
  g.stroke();
  return c;
}

for (const [name, mult] of DENS) {
  const dir = join(res, `mipmap-${name}`);
  const std = Math.round(48 * mult);
  const fg = Math.round(108 * mult);
  writeFileSync(join(dir, 'ic_launcher.png'), base(std).toBuffer('image/png'));
  writeFileSync(join(dir, 'ic_launcher_round.png'), base(std).toBuffer('image/png'));
  // передний план адаптивной иконки: прозрачный фон, ромб в safe-зоне
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), base(fg, { transparent: true, padFrac: 0.22 }).toBuffer('image/png'));
  console.log(`mipmap-${name}: ic_launcher ${std}px, foreground ${fg}px`);
}
console.log('иконки Android обновлены');
