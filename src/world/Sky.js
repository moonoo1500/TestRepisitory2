import * as THREE from 'three';
import { clamp } from '../core/util.js';

/* =========================================================
   Небо, солнце, цикл дня и ночи
   ========================================================= */
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uNight;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.75));
  float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sd, 90.0) * 2.6;
  col += uSunColor * pow(sd, 8.0) * 0.22;
  // звёзды
  float st = 0.0;
  if (uNight > 0.05) {
    vec3 p = normalize(vDir) * 130.0;
    float n = fract(sin(dot(floor(p.xy * 1.7 + p.z), vec2(12.9898, 78.233))) * 43758.5453);
    st = smoothstep(0.995, 1.0, n) * uNight * smoothstep(0.05, 0.35, vDir.y);
  }
  col += vec3(st);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene, map) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.uniforms = {
      uTop: { value: new THREE.Color(0x2b6ea8) },
      uHorizon: { value: new THREE.Color(0xb9d8e8) },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.3) },
      uNight: { value: 0 },
    };
    const skyGeo = new THREE.SphereGeometry(600, 32, 20);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.renderOrder = -100;
    this.group.add(this.sky);

    // солнце (визуальный диск)
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(14, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2cf, fog: false }),
    );
    this.group.add(this.sunDisc);

    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const d = 70;
    this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 420;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9fc9e8, 0x2a2418, 0.85);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x334455, 0.35);
    scene.add(this.ambient);

    // облака — плоские спрайты
    this.clouds = new THREE.Group();
    const cGeo = new THREE.PlaneGeometry(60, 26);
    const cMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Mesh(cGeo, cMat.clone());
      c.rotation.x = -Math.PI / 2;
      c.position.set((Math.random() - 0.5) * 500, 90 + Math.random() * 40, (Math.random() - 0.5) * 500);
      c.scale.set(1 + Math.random() * 1.6, 1 + Math.random(), 1);
      c.material.opacity = 0.1 + Math.random() * 0.16;
      this.clouds.add(c);
    }
    this.group.add(this.clouds);

    this.night = 0;
    this._col = new THREE.Color();
    this.update(0.2);
  }

  /** phase: 0..1 (0 = полночь, 0.25 = рассвет, 0.5 = полдень, 0.75 = закат) */
  update(phase) {
    const ang = phase * Math.PI * 2 - Math.PI / 2;
    const sx = Math.cos(ang) * 0.7;
    const sy = Math.sin(ang);
    const sz = 0.35;
    const dir = this.uniforms.uSunDir.value.set(sx, sy, sz).normalize();
    this.sun.position.copy(dir).multiplyScalar(180);
    this.sunDisc.position.copy(dir).multiplyScalar(460);
    this.sunDisc.visible = sy > -0.08;

    const dayK = clamp((sy + 0.14) / 0.42, 0, 1);
    this.night = 1 - dayK;

    // цвета неба
    const noon = new THREE.Color(0x2a72b4), dusk = new THREE.Color(0x24384f), night = new THREE.Color(0x04070f);
    const hNoon = new THREE.Color(0xc8dfee), hDusk = new THREE.Color(0xe0803c), hNight = new THREE.Color(0x0a1420);
    if (dayK > 0.5) {
      const k = (dayK - 0.5) * 2;
      this.uniforms.uTop.value.copy(dusk).lerp(noon, k);
      this.uniforms.uHorizon.value.copy(hDusk).lerp(hNoon, k);
    } else {
      const k = dayK * 2;
      this.uniforms.uTop.value.copy(night).lerp(dusk, k);
      this.uniforms.uHorizon.value.copy(hNight).lerp(hDusk, k);
    }
    this.uniforms.uSunColor.value.setHex(dayK > 0.35 ? 0xfff2d6 : 0xff9a4d);
    this.sunDisc.material.color.copy(this.uniforms.uSunColor.value);

    this.sun.intensity = 0.12 + dayK * 2.4;
    this.sun.color.setHex(dayK > 0.35 ? 0xfff1da : 0xffa463);
    this.hemi.intensity = 0.18 + dayK * 0.8;
    this.ambient.intensity = 0.16 + dayK * 0.3;

    if (this.scene.fog) {
      this.scene.fog.color.copy(this.uniforms.uHorizon.value).lerp(night, this.night * 0.7);
      this.scene.fog.density = 0.0032 + this.night * 0.0022;
    }
    this.renderer_bg = null;

    for (const c of this.clouds.children) {
      c.material.opacity = (0.1 + 0.14) * (0.25 + dayK * 0.75);
      c.material.color.copy(this.uniforms.uHorizon.value).lerp(new THREE.Color(0xffffff), 0.6);
    }
    this.time = (this.time || 0) + 0.016;
  }

  followTarget(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.uniforms.uSunDir.value.x * 180, this.uniforms.uSunDir.value.y * 180, z + this.uniforms.uSunDir.value.z * 180);
    this.sky.position.set(x, 0, z);
  }

  dispose() {
    this.skyGeo?.dispose?.();
    this.skyMat.dispose();
  }
}
