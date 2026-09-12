/* Пространственный хеш для быстрых запросов «кто рядом» */
export class SpatialHash {
  constructor(cell = 4) {
    this.cell = cell;
    this.buckets = new Map();
  }
  key(x, z) {
    return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
  }
  clear() { this.buckets.clear(); }
  insert(o) {
    const k = this.key(o.x, o.z);
    let b = this.buckets.get(k);
    if (!b) { b = []; this.buckets.set(k, b); }
    b.push(o);
  }
  /** Все объекты в радиусе r от (x,z) */
  query(x, z, r, out = []) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    const r2 = r * r;
    for (let zz = z0; zz <= z1; zz++) {
      for (let xx = x0; xx <= x1; xx++) {
        const b = this.buckets.get(`${xx},${zz}`);
        if (!b) continue;
        for (let i = 0; i < b.length; i++) {
          const o = b[i];
          if (o.dead) continue;
          const dx = o.x - x, dz = o.z - z;
          if (dx * dx + dz * dz <= r2) out.push(o);
        }
      }
    }
    return out;
  }
}
