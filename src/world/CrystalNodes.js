import * as THREE from 'three';

/* =========================================================
   Кристальные жилы: инстанс-меши + свечение, скрываются туманом
   ========================================================= */
export class CrystalNodes {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'crystals';
    const nodes = game.map.nodes;
    this.nodes = nodes;
    const n = Math.max(1, nodes.length);

    const shardGeo = new THREE.ConeGeometry(0.42, 1.6, 5);
    shardGeo.translate(0, 0.8, 0);
    this.shardMat = new THREE.MeshStandardMaterial({
      color: 0x2b6f8f, emissive: 0x6fd8ff, emissiveIntensity: 1.5,
      roughness: 0.18, metalness: 0.55, transparent: true, opacity: 0.92, flatShading: true,
    });
    this.shards = new THREE.InstancedMesh(shardGeo, this.shardMat, n * 3);
    this.shards.castShadow = true;
    this.shards.frustumCulled = false;
    this.group.add(this.shards);

    const baseGeo = new THREE.IcosahedronGeometry(0.55, 0);
    this.baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4a55, roughness: 0.9, flatShading: true });
    this.bases = new THREE.InstancedMesh(baseGeo, this.baseMat, n);
    this.bases.castShadow = true;
    this.group.add(this.bases);

    // мягкое свечение под жилой
    const glowGeo = new THREE.CircleGeometry(1.5, 18);
    glowGeo.rotateX(-Math.PI / 2);
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x66e0ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.glows = new THREE.InstancedMesh(glowGeo, this.glowMat, n);
    this.glows.frustumCulled = false;
    this.group.add(this.glows);

    this.dummy = new THREE.Object3D();
    this.count = nodes.length;
    this.time = 0;
    this.update(0, true);
  }

  update(dt, force = false) {
    this.time += dt;
    const fog = this.game.fog;
    let si = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const known = fog.isExplored(n.x, n.z);
      const visible = fog.isVisible(n.x, n.z);
      const alive = n.amount > 0 && known;
      const ratio = n.amount / n.maxAmount;

      this.dummy.position.set(n.x, n.y - 0.1, n.z);
      this.dummy.rotation.set(0, n.seed, 0);
      this.dummy.scale.setScalar(alive ? 0.6 + ratio * 0.6 : 0.0001);
      this.dummy.updateMatrix();
      this.bases.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(n.x, n.y - 0.2, n.z);
      this.dummy.scale.setScalar(alive ? (0.7 + ratio * 0.8) * (1 + Math.sin(this.time * 2 + n.seed) * 0.06) : 0.0001);
      this.dummy.updateMatrix();
      this.glows.setMatrixAt(i, this.dummy.matrix);

      for (let k = 0; k < 3; k++) {
        const a = n.seed + (k / 3) * Math.PI * 2;
        const r = 0.42;
        this.dummy.position.set(n.x + Math.cos(a) * r, n.y - 0.1, n.z + Math.sin(a) * r);
        const bob = Math.sin(this.time * 1.6 + n.seed + k) * 0.07;
        this.dummy.rotation.set(Math.cos(a) * 0.22, a, Math.sin(a) * 0.22);
        const s = alive ? (0.5 + ratio * 0.75) * (0.85 + k * 0.16) : 0.0001;
        this.dummy.scale.set(s, s * (1 + bob), s);
        this.dummy.updateMatrix();
        this.shards.setMatrixAt(si++, this.dummy.matrix);
      }
    }
    this.bases.instanceMatrix.needsUpdate = true;
    this.glows.instanceMatrix.needsUpdate = true;
    this.shards.instanceMatrix.needsUpdate = true;
    this.shardMat.emissiveIntensity = 1.2 + Math.sin(this.time * 2.2) * 0.35;
  }
}
