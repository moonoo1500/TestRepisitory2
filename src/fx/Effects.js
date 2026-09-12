import * as THREE from 'three';
import { rand, TAU } from '../core/util.js';

/* =========================================================
   Эффекты: частицы (один буфер), ударные волны, лучи, дым,
   вспышки выстрелов, следы, всплывающий текст
   ========================================================= */
const MAX_P = 4000;

const VERT = `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (340.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.06, d);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.count = 0;
    this.pos = new Float32Array(MAX_P * 3);
    this.vel = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 3);
    this.size = new Float32Array(MAX_P);
    this.alpha = new Float32Array(MAX_P);
    this.life = new Float32Array(MAX_P);
    this.maxLife = new Float32Array(MAX_P);
    this.drag = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.grow = new Float32Array(MAX_P);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);

    // ударные волны
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.6, 1.0, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringGeo = ringGeo;
    // лучи
    this.beams = [];
    this.beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
    this.beamGeo.translate(0, 0.5, 0);
    // текстовые метки
    this.labelLayer = document.getElementById('world-labels');
    this.labels = [];
    this._tmp = new THREE.Vector3();
  }

  /* ---------- частицы ---------- */
  spawn(x, y, z, opt = {}) {
    if (this.count >= MAX_P) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = opt.vx || 0; this.vel[i * 3 + 1] = opt.vy || 0; this.vel[i * 3 + 2] = opt.vz || 0;
    const c = opt.color ?? 0xffaa44;
    _c.setHex(c);
    this.col[i * 3] = _c.r; this.col[i * 3 + 1] = _c.g; this.col[i * 3 + 2] = _c.b;
    this.size[i] = opt.size ?? 1.2;
    this.alpha[i] = opt.alpha ?? 1;
    this.life[i] = opt.life ?? 0.8;
    this.maxLife[i] = this.life[i];
    this.drag[i] = opt.drag ?? 1.6;
    this.grav[i] = opt.grav ?? 0;
    this.grow[i] = opt.grow ?? 0;
  }

  burst(x, y, z, n, opt = {}) {
    const speed = opt.speed ?? 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const e = opt.flat ? 0.1 : (Math.random() - 0.35) * 1.4;
      const s = speed * rand(1.0, 0.35);
      this.spawn(x, y, z, {
        vx: Math.cos(a) * s * Math.cos(e),
        vy: Math.sin(e) * s * (opt.up ?? 1) + (opt.vy0 ?? 0),
        vz: Math.sin(a) * s * Math.cos(e),
        color: opt.color ?? 0xffaa44,
        size: (opt.size ?? 1.1) * rand(1.25, 0.6),
        life: (opt.life ?? 0.7) * rand(1.2, 0.65),
        drag: opt.drag ?? 2.2,
        grav: opt.grav ?? 6,
        grow: opt.grow ?? 0,
        alpha: opt.alpha ?? 1,
      });
    }
  }

  explosion(x, y, z, scale = 1, color = 0xff8833) {
    this.burst(x, y, z, Math.floor(26 * scale), { speed: 9 * scale, color, size: 1.5 * scale, life: 0.75, grav: 4 });
    this.burst(x, y, z, Math.floor(12 * scale), { speed: 4 * scale, color: 0xffe6a0, size: 2.2 * scale, life: 0.4, grav: -1, drag: 3.4 });
    // дым
    for (let i = 0; i < Math.floor(10 * scale); i++) {
      this.spawn(x + rand(0.5, -0.5), y + rand(0.6, 0), z + rand(0.5, -0.5), {
        vx: rand(1.2, -1.2), vy: rand(2.6, 0.8), vz: rand(1.2, -1.2),
        color: 0x3a3a3a, size: 3.2 * scale, life: rand(2.0, 1.2), drag: 1.1, grav: -0.6, grow: 2.2, alpha: 0.45,
      });
    }
    this.ring(x, y + 0.15, z, 6 * scale, color);
    this.flash(x, y + 0.5, z, 5 * scale, color, 0.18);
  }

  muzzle(x, y, z, dirX, dirZ, color = 0xffd07a) {
    for (let i = 0; i < 6; i++) {
      this.spawn(x, y, z, {
        vx: dirX * rand(9, 3) + rand(1, -1), vy: rand(1.5, -0.4), vz: dirZ * rand(9, 3) + rand(1, -1),
        color, size: rand(1.0, 0.5), life: rand(0.22, 0.09), drag: 6, grav: 0,
      });
    }
    this.flash(x, y, z, 1.4, color, 0.09);
  }

  dust(x, y, z, n = 2) {
    for (let i = 0; i < n; i++) {
      this.spawn(x + rand(0.4, -0.4), y + 0.05, z + rand(0.4, -0.4), {
        vx: rand(1.1, -1.1), vy: rand(1.1, 0.2), vz: rand(1.1, -1.1),
        color: 0x9c8a6a, size: rand(1.5, 0.8), life: rand(0.9, 0.45), drag: 2.4, grav: 0.6, grow: 0.8, alpha: 0.4,
      });
    }
  }

  sparks(x, y, z, color = 0x66e0ff, n = 10) {
    this.burst(x, y, z, n, { speed: 7, color, size: 0.85, life: 0.5, grav: 9, drag: 1.6 });
  }

  /* ---------- ударная волна ---------- */
  ring(x, y, z, maxScale = 6, color = 0xffaa44) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.position.set(x, y, z);
    m.renderOrder = 21;
    this.scene.add(m);
    this.rings.push({ m, t: 0, dur: 0.55, maxScale });
  }

  /* ---------- вспышка ---------- */
  flash(x, y, z, scale = 3, color = 0xffffff, dur = 0.14) {
    const m = new THREE.Mesh(
      this.geoSphere || (this.geoSphere = new THREE.SphereGeometry(1, 10, 8)),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.position.set(x, y, z);
    m.scale.setScalar(scale * 0.4);
    this.scene.add(m);
    this.rings.push({ m, t: 0, dur, maxScale: scale, isFlash: true });
  }

  /* ---------- луч ---------- */
  beam(x1, y1, z1, x2, y2, z2, color = 0x66e0ff, life = 0.12, width = 0.12) {
    const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    m.position.set(x1, y1, z1);
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    m.scale.set(width, len, width);
    m.lookAt(x2, y2, z2);
    m.rotateX(Math.PI / 2);
    m.renderOrder = 21;
    this.scene.add(m);
    this.beams.push({ m, t: 0, dur: life });
  }

  /* ---------- всплывающий текст ---------- */
  text(x, y, z, str, color = '#ffdd66', size = 13) {
    if (this.labels.length > 46) return;
    const el = document.createElement('div');
    el.className = 'wlabel';
    el.textContent = str;
    el.style.color = color;
    el.style.fontSize = `${size}px`;
    el.style.borderLeftColor = color;
    this.labelLayer.appendChild(el);
    this.labels.push({ el, x, y, z, t: 0, dur: 1.05, vy: 2.2 });
  }

  update(dt, camera) {
    // частицы
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        const last = --n;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[last * 3 + k];
            this.vel[i * 3 + k] = this.vel[last * 3 + k];
            this.col[i * 3 + k] = this.col[last * 3 + k];
          }
          this.size[i] = this.size[last]; this.alpha[i] = this.alpha[last];
          this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
          this.drag[i] = this.drag[last]; this.grav[i] = this.grav[last]; this.grow[i] = this.grow[last];
        }
        i--;
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 1.6);
      if (this.grow[i]) this.size[i] += this.grow[i] * dt;
    }
    this.count = n;
    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;

    // волны/вспышки
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
      if (r.isFlash) {
        r.m.scale.setScalar(r.maxScale * (0.3 + k * 0.9));
        r.m.material.opacity = 0.9 * (1 - k);
      } else {
        r.m.scale.setScalar(1 + k * r.maxScale);
        r.m.material.opacity = 0.85 * (1 - k) * (1 - k);
      }
    }
    // лучи
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      const k = b.t / b.dur;
      if (k >= 1) { this.scene.remove(b.m); b.m.material.dispose(); this.beams.splice(i, 1); continue; }
      b.m.material.opacity = 0.9 * (1 - k);
      b.m.scale.x = b.m.scale.z = Math.max(0.02, b.m.scale.x * (1 - k * 0.6));
    }
    // текстовые метки
    if (this.labels.length) {
      const w = window.innerWidth, h = window.innerHeight;
      for (let i = this.labels.length - 1; i >= 0; i--) {
        const L = this.labels[i];
        L.t += dt; L.y += L.vy * dt; L.vy *= 0.94;
        if (L.t >= L.dur) { L.el.remove(); this.labels.splice(i, 1); continue; }
        this._tmp.set(L.x, L.y, L.z).project(camera);
        if (this._tmp.z > 1) { L.el.style.display = 'none'; continue; }
        L.el.style.display = '';
        L.el.style.left = `${(this._tmp.x * 0.5 + 0.5) * w}px`;
        L.el.style.top = `${(-this._tmp.y * 0.5 + 0.5) * h}px`;
        L.el.style.opacity = String(1 - L.t / L.dur);
      }
    }
  }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
    for (const r of this.rings) { this.scene.remove(r.m); r.m.material.dispose(); }
    this.rings.length = 0;
    for (const b of this.beams) { this.scene.remove(b.m); b.m.material.dispose(); }
    this.beams.length = 0;
    for (const l of this.labels) l.el.remove();
    this.labels.length = 0;
  }
}

const _c = new THREE.Color();
