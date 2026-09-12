import * as THREE from 'three';
import { TILE } from '../data/defs.js';

/* =========================================================
   Ландшафт: сетка с вершинными цветами + туман войны в шейдере
   ========================================================= */
const C_SAND = new THREE.Color('#c8b48a');
const C_GRASS = new THREE.Color('#4c7a4e');
const C_GRASS2 = new THREE.Color('#6d9455');
const C_ROCK = new THREE.Color('#6b6a68');
const C_ROCK_D = new THREE.Color('#494845');
const C_SNOW = new THREE.Color('#dfe9f0');
const C_DIRT = new THREE.Color('#8a7554');

export class Terrain {
  constructor(map, fogTexture) {
    this.map = map;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    this.buildMesh();
    this.buildWater();
    this.buildDecor();
    this.buildGrid();
    this.fogTexture = fogTexture;
    this.uniforms = {
      uFogTex: { value: fogTexture },
      uMapSize: { value: map.worldSize },
      uGrid: { value: new THREE.Vector2(TILE, 1) },
      uGridOn: { value: 0.0 },
      uTime: { value: 0 },
      uNight: { value: 0 },
    };
    this.applyShader();
  }

  buildMesh() {
    const S = this.map.size;
    const geo = new THREE.PlaneGeometry(this.map.worldSize, this.map.worldSize, S, S);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const H = this.map.heights;
    const W = S + 1;
    const wl = this.map.waterLevel;
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = i % W, z = (i / W) | 0;
      const h = H[z * W + x];
      pos.setY(i, h);

      const hn = H[Math.max(0, z - 1) * W + x], hs = H[Math.min(S, z + 1) * W + x];
      const he = H[z * W + Math.min(S, x + 1)], hw = H[z * W + Math.max(0, x - 1)];
      const slope = Math.hypot(he - hw, hs - hn) / (2 * TILE);

      const m = this.map.moisture[Math.min(S - 1, z) * S + Math.min(S - 1, x)] ?? 0.5;
      if (h < wl + 0.6) c.copy(C_SAND);
      else if (h < wl + 2.2) c.copy(C_SAND).lerp(C_GRASS, (h - wl - 0.6) / 1.6);
      else if (slope > 0.62) c.copy(C_ROCK_D).lerp(C_ROCK, Math.min(1, (slope - 0.62) * 2));
      else if (h > 8.5) c.copy(C_ROCK).lerp(C_SNOW, Math.min(1, (h - 8.5) / 4));
      else {
        c.copy(C_GRASS).lerp(C_GRASS2, m);
        if (m < 0.4) c.lerp(C_DIRT, (0.4 - m) * 1.1);
      }
      // лёгкая вариация, чтобы не было «пластиково»
      const n = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;
      c.offsetHSL(0, 0, (n - 0.5) * 0.045);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.94, metalness: 0.02, flatShading: false,
    });
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'ground';
    this.group.add(this.mesh);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(this.map.worldSize, this.map.worldSize, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d3a52, transparent: true, opacity: 0.82,
      roughness: 0.12, metalness: 0.55, emissive: 0x05202e, emissiveIntensity: 0.6,
    });
    this.waterMat = mat;
    const m = new THREE.Mesh(geo, mat);
    m.position.y = this.map.waterLevel;
    m.name = 'water';
    this.water = m;
    this.group.add(m);
  }

  buildDecor() {
    const map = this.map;
    const trees = map.decor.filter((d) => d.kind === 'tree');
    const rocks = map.decor.filter((d) => d.kind === 'rock');

    // деревья: конус + ствол
    const treeGeo = new THREE.ConeGeometry(0.85, 2.6, 6);
    treeGeo.translate(0, 1.9, 0);
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.4, 5);
    trunkGeo.translate(0, 0.7, 0);
    const merged = mergeGeos([trunkGeo, treeGeo]);
    const tMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9 });
    const tMesh = new THREE.InstancedMesh(merged, tMat, Math.max(1, trees.length));
    tMesh.castShadow = true; tMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    trees.forEach((d, i) => {
      dummy.position.set(d.x, d.y - 0.1, d.z);
      dummy.rotation.set(0, d.r, 0);
      dummy.scale.setScalar(d.s * 0.9);
      dummy.updateMatrix();
      tMesh.setMatrixAt(i, dummy.matrix);
    });
    tMesh.count = trees.length;
    tMesh.instanceMatrix.needsUpdate = true;
    this.group.add(tMesh);

    const rockGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const rMat = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 1, flatShading: true });
    const rMesh = new THREE.InstancedMesh(rockGeo, rMat, Math.max(1, rocks.length));
    rMesh.castShadow = true; rMesh.receiveShadow = true;
    rocks.forEach((d, i) => {
      dummy.position.set(d.x, d.y + 0.05, d.z);
      dummy.rotation.set(d.r, d.r * 2, d.r * 0.5);
      dummy.scale.set(d.s * 0.7, d.s * 0.5, d.s * 0.7);
      dummy.updateMatrix();
      rMesh.setMatrixAt(i, dummy.matrix);
    });
    rMesh.count = rocks.length;
    rMesh.instanceMatrix.needsUpdate = true;
    this.group.add(rMesh);
  }

  /** Координатная сетка, включается при строительстве */
  buildGrid() {
    const S = this.map.size;
    const size = this.map.worldSize;
    const pts = [];
    for (let i = 0; i <= S; i++) {
      const p = i * TILE - size / 2;
      pts.push(-size / 2, 0, p, size / 2, 0, p);
      pts.push(p, 0, -size / 2, p, 0, size / 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.0 });
    this.gridLines = new THREE.LineSegments(geo, mat);
    this.gridLines.position.y = 0.12;
    this.gridLines.visible = false;
    this.group.add(this.gridLines);
  }

  showGrid(v) {
    this.gridLines.visible = v;
    this.gridLines.material.opacity = v ? 0.14 : 0;
  }

  /** Внедряем сэмплинг тумана войны в PBR-шейдер ландшафта */
  applyShader() {
    const mat = this.material;
    const self = this;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFogTex = self.uniforms.uFogTex;
      shader.uniforms.uMapSize = self.uniforms.uMapSize;
      shader.uniforms.uTime = self.uniforms.uTime;
      shader.uniforms.uNight = self.uniforms.uNight;
      self.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldXZ;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xyz;');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWorldXZ;
          uniform sampler2D uFogTex;
          uniform float uMapSize;
          uniform float uTime;
          uniform float uNight;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 fuv = (vWorldXZ.xz / uMapSize) + 0.5;
            float fogv = texture2D(uFogTex, vec2(fuv.x, 1.0 - fuv.y)).r;
            float unseen = mix(0.055, 0.16, uNight * 0.4);
            float k = mix(unseen, 1.0, smoothstep(0.02, 0.55, fogv));
            diffuseColor.rgb *= k;
            // холодный «сканирующий» оттенок в неизведанной зоне
            diffuseColor.rgb += vec3(0.005, 0.02, 0.035) * (1.0 - k) * 6.0;
            // мягкая волна на границе видимости
            float edge = smoothstep(0.35, 0.6, fogv) * (1.0 - smoothstep(0.6, 0.95, fogv));
            diffuseColor.rgb += vec3(0.0, 0.28, 0.34) * edge * 0.22 * (0.6 + 0.4 * sin(uTime * 2.0));
          }`);
    };
    mat.customProgramCacheKey = () => 'dominion-terrain';
  }

  update(dt, time) {
    this.uniforms.uTime.value = time;
    if (this.water) {
      this.water.position.y = this.map.waterLevel + Math.sin(time * 0.6) * 0.06;
    }
  }
}

/** Склейка геометрий без BufferGeometryUtils */
function mergeGeos(geos) {
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : 0; }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  const palette = [new THREE.Color('#4a3524'), new THREE.Color('#2f6b3a')];
  geos.forEach((g, gi) => {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
      nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i);
      const c = palette[gi % palette.length];
      col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b;
    }
    const gi2 = g.index;
    for (let i = 0; i < gi2.count; i++) idx[io + i] = gi2.getX(i) + vo;
    vo += p.count; io += gi2.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
