import type { Col, Surf } from './builder';
import { clamp } from './util';

const CELL = 4;
const key = (ix: number, iz: number) => (ix + 600) * 2048 + (iz + 600);

export class Physics {
  cols: Col[] = [];
  private grid = new Map<number, Col[]>();
  private sgrid = new Map<number, Surf[]>();
  bounds = { x0: -64, x1: 64, z0: -58, z1: 58 };

  addCol(c: Col) {
    this.cols.push(c);
    for (let ix = Math.floor(c.x0 / CELL); ix <= Math.floor(c.x1 / CELL); ix++)
      for (let iz = Math.floor(c.z0 / CELL); iz <= Math.floor(c.z1 / CELL); iz++) {
        const k = key(ix, iz); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(c);
      }
  }
  addSurf(s: Surf) {
    for (let ix = Math.floor(s.x0 / CELL); ix <= Math.floor(s.x1 / CELL); ix++)
      for (let iz = Math.floor(s.z0 / CELL); iz <= Math.floor(s.z1 / CELL); iz++) {
        const k = key(ix, iz); let a = this.sgrid.get(k); if (!a) { a = []; this.sgrid.set(k, a); } a.push(s);
      }
  }
  static height(s: Surf, x: number, z: number) {
    if (!s.ramp) return s.y0;
    const r = s.ramp;
    const t = clamp(((x - r.px) * r.dx + (z - r.pz) * r.dz) / r.l2, 0, 1);
    return s.y0 + (s.y1 - s.y0) * t;
  }
  floorAt(x: number, z: number, y: number, step = 0.5): { y: number; kind: string } {
    let best = 0, kind = 'concrete';
    const a = this.sgrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (a) for (const s of a) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      const h = Physics.height(s, x, z);
      if (h <= y + step && h >= best) { best = h; kind = s.kind; }
    }
    return { y: best, kind };
  }
  private near(x0: number, z0: number, x1: number, z1: number): Col[] {
    const out: Col[] = [], seen = new Set<Col>();
    for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++)
      for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const a = this.grid.get(key(ix, iz)); if (!a) continue;
        for (const c of a) if (!seen.has(c)) { seen.add(c); out.push(c); }
      }
    return out;
  }
  collide(p: { x: number; z: number }, feet: number, r: number, hgt = 1.7) {
    for (let it = 0; it < 3; it++) {
      const cs = this.near(p.x - r, p.z - r, p.x + r, p.z + r);
      for (const c of cs) {
        if (!c.enabled || c.tag === 'glass' && false) continue;
        if (feet + 0.32 >= c.y1 || feet + hgt <= c.y0) continue;
        const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
        const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else {
          const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr, t, b);
          if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r;
        }
      }
    }
    p.x = clamp(p.x, this.bounds.x0, this.bounds.x1); p.z = clamp(p.z, this.bounds.z0, this.bounds.z1);
  }
  /** is the segment blocked by an enabled solid collider (glass ignored) */
  blocked(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz), n = Math.ceil(len / 2) + 1;
    const seen = new Set<Col>();
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = ax + dx * t, pz = az + dz * t;
      const cs = this.near(px - 1, pz - 1, px + 1, pz + 1);
      for (const c of cs) {
        if (seen.has(c)) continue; seen.add(c);
        if (!c.enabled || c.tag === 'glass') continue;
        let t0 = 0, t1 = 1;
        const sl = (o: number, d: number, lo: number, hi: number) => {
          if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
          let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1;
        };
        if (sl(ax, dx, c.x0, c.x1) && sl(ay, dy, c.y0, c.y1) && sl(az, dz, c.z0, c.z1)) return true;
      }
    }
    return false;
  }
}
