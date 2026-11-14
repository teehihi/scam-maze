import * as THREE from 'three';
import { mat } from './materials';
import { mulberry32 } from './util';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
export type Faces = Partial<Record<FaceKey, string | null>>;
export interface Col { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; enabled: boolean; tag?: string }
export interface Surf { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; ramp?: { px: number; pz: number; dx: number; dz: number; l2: number }; kind: string }
export interface Open { a: number; b: number; y0: number; y1: number; solid?: boolean }
type V3 = [number, number, number];

class Bucket { pos: number[] = []; nor: number[] = []; uv: number[] = []; idx: number[] = []; }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();

export class Builder {
  buckets = new Map<string, Bucket>();
  cols: Col[] = [];
  surfs: Surf[] = [];
  M = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];

  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    this.stack.push(this.M.clone());
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    this.M.multiply(m);
    return this;
  }
  pop() { this.M.copy(this.stack.pop()!); return this; }

  private bucket(key: string) { let b = this.buckets.get(key); if (!b) { b = new Bucket(); this.buckets.set(key, b); } return b; }

  /** add a quad with vertices in current local space. uvs in meters (auto if undefined) */
  quad(key: string, p0: V3, p1: V3, p2: V3, p3: V3, uvs?: number[], flip = false) {
    const b = this.bucket(key);
    _a.set(...p0).applyMatrix4(this.M); _b.set(...p1).applyMatrix4(this.M); _c.set(...p2).applyMatrix4(this.M); _d.set(...p3).applyMatrix4(this.M);
    _n.crossVectors(_c.clone().sub(_a), _d.clone().sub(_b)).normalize();
    if (flip) _n.negate();
    let uu = uvs;
    if (!uu) { const w = _a.distanceTo(_b), h = _a.distanceTo(_d); uu = [0, 0, w, 0, w, h, 0, h]; }
    const base = b.pos.length / 3;
    for (const [i, p] of [_a, _b, _c, _d].entries()) { b.pos.push(p.x, p.y, p.z); b.nor.push(_n.x, _n.y, _n.z); b.uv.push(uu[i * 2], uu[i * 2 + 1]); }
    if (flip) b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2); else b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, m: string, f: Faces = {}) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const x1 = x + w, y1 = y + h, z1 = z + d;
    const get = (k: FaceKey) => (k in f ? f[k] : m);
    const faces: [FaceKey, V3[], number][] = [
      ['px', [[x1, y, z1], [x1, y, z], [x1, y1, z], [x1, y1, z1]], 0],
      ['nx', [[x, y, z], [x, y, z1], [x, y1, z1], [x, y1, z]], 0],
      ['py', [[x, y1, z1], [x1, y1, z1], [x1, y1, z], [x, y1, z]], 1],
      ['ny', [[x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]], 1],
      ['pz', [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], 2],
      ['nz', [[x1, y, z], [x, y, z], [x, y1, z], [x1, y1, z]], 2],
    ];
    for (const [k, vs, ax] of faces) {
      const key = get(k); if (!key) continue;
      const b = this.bucket(key);
      const base = b.pos.length / 3;
      _n.set(k[1] === 'x' ? 1 : 0, k[1] === 'y' ? 1 : 0, k[1] === 'z' ? 1 : 0);
      if (k[0] === 'n') _n.negate();
      _n.transformDirection(this.M);
      const an = Math.abs(_n.x) > 0.7 ? 0 : Math.abs(_n.y) > 0.7 ? 1 : 2;
      void ax;
      for (const p of vs) {
        _a.set(p[0], p[1], p[2]).applyMatrix4(this.M);
        b.pos.push(_a.x, _a.y, _a.z); b.nor.push(_n.x, _n.y, _n.z);
        if (an === 0) b.uv.push(_a.z, _a.y); else if (an === 1) b.uv.push(_a.x, _a.z); else b.uv.push(_a.x, _a.y);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  cyl(cx: number, y: number, cz: number, r: number, h: number, m: string, seg = 12, rTop = r, caps = true) {
    const b = this.bucket(m), base = b.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      _n.set(c, (r - rTop) / Math.max(h, 1e-3), s).normalize().transformDirection(this.M);
      for (let j = 0; j < 2; j++) {
        const rr = j ? rTop : r;
        _a.set(cx + c * rr, y + j * h, cz + s * rr).applyMatrix4(this.M);
        b.pos.push(_a.x, _a.y, _a.z); b.nor.push(_n.x, _n.y, _n.z); b.uv.push((i / seg) * Math.PI * 2 * r, y + j * h);
      }
    }
    for (let i = 0; i < seg; i++) { const k = base + i * 2; b.idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    if (!caps) return;
    for (let j = 0; j < 2; j++) {
      const rr = j ? rTop : r; if (rr <= 0) continue;
      const cb = b.pos.length / 3;
      _n.set(0, j ? 1 : -1, 0).transformDirection(this.M);
      _a.set(cx, y + j * h, cz).applyMatrix4(this.M); b.pos.push(_a.x, _a.y, _a.z); b.nor.push(_n.x, _n.y, _n.z); b.uv.push(cx, cz);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        _a.set(cx + Math.cos(a) * rr, y + j * h, cz + Math.sin(a) * rr).applyMatrix4(this.M);
        b.pos.push(_a.x, _a.y, _a.z); b.nor.push(_n.x, _n.y, _n.z); b.uv.push(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr);
      }
      for (let i = 0; i < seg; i++) { if (j) b.idx.push(cb, cb + 2 + i, cb + 1 + i); else b.idx.push(cb, cb + 1 + i, cb + 2 + i); }
    }
  }

  /** random foliage cards */
  leaves(cx: number, cy: number, cz: number, rad: number, count: number, m: string, seed = 1, size = 1) {
    const r = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
      const s = (0.55 + r() * 0.6) * rad * size, a = r() * Math.PI * 2, tilt = (r() - 0.5) * 1.6;
      const ux = Math.cos(a) * s, uz = Math.sin(a) * s, vy = Math.cos(tilt) * s, vx = Math.sin(tilt) * s * Math.sin(a), vz = -Math.sin(tilt) * s * Math.cos(a);
      const px = cx + x * rad, py = cy + y * rad * 0.85, pz = cz + z * rad;
      this.quad(m, [px - ux / 2 - vx / 2, py - vy / 2, pz - uz / 2 - vz / 2], [px + ux / 2 - vx / 2, py - vy / 2, pz + uz / 2 - vz / 2], [px + ux / 2 + vx / 2, py + vy / 2, pz + uz / 2 + vz / 2], [px - ux / 2 + vx / 2, py + vy / 2, pz - uz / 2 + vz / 2], [0, 0, 1, 0, 1, 1, 0, 1]);
    }
  }

  /** any BufferGeometry, placed by local offset/euler inside the current transform (no collider) */
  geo(key: string, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const b = this.bucket(key);
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const m = this.M.clone().multiply(local), nm = new THREE.Matrix3().getNormalMatrix(m);
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv as THREE.BufferAttribute | undefined;
    const base = b.pos.length / 3, v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); b.pos.push(v.x, v.y, v.z);
      if (nor) { n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); b.nor.push(n.x, n.y, n.z); } else b.nor.push(0, 1, 0);
      if (uv) b.uv.push(uv.getX(i), uv.getY(i)); else b.uv.push(0, 0);
    }
    const ix = g.index;
    if (ix) for (let i = 0; i < ix.count; i++) b.idx.push(base + ix.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  }
  /** rounded box (x,y,z = minimum corner): cushions, fuel tanks, cabinets with eased edges */
  rb(key: string, x: number, y: number, z: number, w: number, h: number, d: number, r = 0.02) {
    const rr = Math.max(1e-3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
    const g = new RoundedBoxGeometry(w, h, d, 2, rr);
    this.geo(key, g, x + w / 2, y + h / 2, z + d / 2); g.dispose();
  }
  /** surface of revolution; pts = [radius, height] from bottom to top */
  lathe(key: string, pts: [number, number][], x = 0, y = 0, z = 0, seg = 16, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
    this.geo(key, g, x, y, z, rx, ry, rz); g.dispose();
  }

  // ---------- physics records ----------
  col(x: number, y: number, z: number, w: number, h: number, d: number, tag?: string): Col {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < 8; i++) {
      _a.set(x + (i & 1) * w, y + ((i >> 1) & 1) * h, z + ((i >> 2) & 1) * d).applyMatrix4(this.M);
      x0 = Math.min(x0, _a.x); x1 = Math.max(x1, _a.x); y0 = Math.min(y0, _a.y); y1 = Math.max(y1, _a.y); z0 = Math.min(z0, _a.z); z1 = Math.max(z1, _a.z);
    }
    const c: Col = { x0, x1, y0, y1, z0, z1, enabled: true, tag };
    this.cols.push(c); return c;
  }
  /** furniture helper: visual box + collider */
  cbox(x: number, y: number, z: number, w: number, h: number, d: number, m: string, f: Faces = {}) { this.box(x, y, z, w, h, d, m, f); return this.col(x, y, z, w, h, d); }

  surf(x0: number, z0: number, x1: number, z1: number, y: number, kind = 'tile', ramp?: { p0: [number, number]; p1: [number, number]; y1: number }) {
    _a.set(x0, 0, z0).applyMatrix4(this.M); _b.set(x1, 0, z1).applyMatrix4(this.M);
    const s: Surf = { x0: Math.min(_a.x, _b.x), x1: Math.max(_a.x, _b.x), z0: Math.min(_a.z, _b.z), z1: Math.max(_a.z, _b.z), y0: y, y1: y, kind };
    if (ramp) {
      _c.set(ramp.p0[0], 0, ramp.p0[1]).applyMatrix4(this.M); _d.set(ramp.p1[0], 0, ramp.p1[1]).applyMatrix4(this.M);
      const dx = _d.x - _c.x, dz = _d.z - _c.z;
      s.ramp = { px: _c.x, pz: _c.z, dx, dz, l2: dx * dx + dz * dz }; s.y1 = ramp.y1;
    }
    this.surfs.push(s); return s;
  }

  // ---------- walls with openings ----------
  private aoQuadZ(x0: number, x1: number, zf: number, up: boolean, y: number, hgt: number, normalSign: 1 | -1) {
    // strip on a plane z = zf facing normalSign; up=true: dark at bottom (y), fading upward; else dark at top (y+hgt)
    const ya = y, yb = y + hgt, vz = zf + normalSign * 0.004;
    const v0 = up ? 1 : 0, v1 = up ? 0 : 1;
    if (normalSign > 0) this.quad('ao', [x0, ya, vz], [x1, ya, vz], [x1, yb, vz], [x0, yb, vz], [0, v0, 1, v0, 1, v1, 0, v1]);
    else this.quad('ao', [x1, ya, vz], [x0, ya, vz], [x0, yb, vz], [x1, yb, vz], [0, v0, 1, v0, 1, v1, 0, v1]);
  }
  private aoQuadX(z0: number, z1: number, xf: number, up: boolean, y: number, hgt: number, normalSign: 1 | -1) {
    const ya = y, yb = y + hgt, vx = xf + normalSign * 0.004;
    const v0 = up ? 1 : 0, v1 = up ? 0 : 1;
    if (normalSign > 0) this.quad('ao', [vx, ya, z1], [vx, ya, z0], [vx, yb, z0], [vx, yb, z1], [0, v0, 1, v0, 1, v1, 0, v1]);
    else this.quad('ao', [vx, ya, z0], [vx, ya, z1], [vx, yb, z1], [vx, yb, z0], [0, v0, 1, v0, 1, v1, 0, v1]);
  }


  /** skirting board with stepped cap + two-step crown cornice along an x-running wall face at z=zf, sign = outward direction */
  private trimX(a: number, b: number, zf: number, sg: 1 | -1, y0: number, y1: number, skirt: string) {
    const L = b - a, z = (d: number, t: number) => (sg > 0 ? zf + d : zf - d - t);
    this.box(a, y0, z(0, 0.02), L, 0.12, 0.02, skirt);
    this.box(a, y0 + 0.12, z(0, 0.012), L, 0.016, 0.012, skirt);
    this.box(a, y0 + 0.136, z(0, 0.006), L, 0.01, 0.006, skirt);
    const cr = 'pi:#f4f1ea';
    this.box(a, y1 - 0.085, z(0, 0.022), L, 0.03, 0.022, cr);
    this.box(a, y1 - 0.055, z(0, 0.045), L, 0.055, 0.045, cr, { ny: cr });
    this.box(a, y1 - 0.1, z(0, 0.008), L, 0.015, 0.008, cr);
  }
  private trimZ(a: number, b: number, xf: number, sg: 1 | -1, y0: number, y1: number, skirt: string) {
    const L = b - a, x = (d: number, t: number) => (sg > 0 ? xf + d : xf - d - t);
    this.box(x(0, 0.02), y0, a, 0.02, 0.12, L, skirt);
    this.box(x(0, 0.012), y0 + 0.12, a, 0.012, 0.016, L, skirt);
    this.box(x(0, 0.006), y0 + 0.136, a, 0.006, 0.01, L, skirt);
    const cr = 'pi:#f4f1ea';
    this.box(x(0, 0.022), y1 - 0.085, a, 0.022, 0.03, L, cr);
    this.box(x(0, 0.045), y1 - 0.055, a, 0.045, 0.055, L, cr);
    this.box(x(0, 0.008), y1 - 0.1, a, 0.008, 0.015, L, cr);
  }

  /** wall running along x, occupying z..z+th. */
  wallX(x0: number, x1: number, z: number, th: number, y0: number, y1: number, mNz: string, mPz: string, opens: Open[] = [], reveal = mPz, o: { aoN?: boolean; aoP?: boolean; col?: boolean; skirt?: string } = {}) {
    const os = [...opens].sort((p, q) => p.a - q.a);
    let cur = x0;
    const solid = (a: number, b: number) => {
      if (b - a < 1e-4) return;
      this.box(a, y0, z, b - a, y1 - y0, th, mPz, { nz: mNz, pz: mPz, px: reveal, nx: reveal, py: null, ny: null });
      if (o.col !== false) this.col(a, y0, z, b - a, y1 - y0, th, 'wall');
      if (o.aoN) { this.aoQuadZ(a, b, z, true, y0, 0.45, -1); this.aoQuadZ(a, b, z, false, y1 - 0.3, 0.3, -1); if (o.skirt) this.trimX(a, b, z, -1, y0, y1, o.skirt); }
      if (o.aoP) { this.aoQuadZ(a, b, z + th, true, y0, 0.45, 1); this.aoQuadZ(a, b, z + th, false, y1 - 0.3, 0.3, 1); if (o.skirt) this.trimX(a, b, z + th, 1, y0, y1, o.skirt); }
    };
    for (const op of os) {
      solid(cur, op.a);
      if (op.y0 > y0) {
        this.box(op.a, y0, z, op.b - op.a, op.y0 - y0, th, mPz, { nz: mNz, pz: mPz, py: reveal, px: null, nx: null, ny: null });
        if (o.col !== false) this.col(op.a, y0, z, op.b - op.a, op.y0 - y0, th, 'wall');
      }
      if (op.y1 < y1) {
        this.box(op.a, op.y1, z, op.b - op.a, y1 - op.y1, th, mPz, { nz: mNz, pz: mPz, ny: reveal, px: null, nx: null, py: null });
        if (o.col !== false) this.col(op.a, op.y1, z, op.b - op.a, y1 - op.y1, th, 'wall');
      }
      if (op.solid && o.col !== false) this.col(op.a, op.y0, z, op.b - op.a, op.y1 - op.y0, th, 'glass');
      cur = op.b;
    }
    solid(cur, x1);
  }

  /** wall running along z, occupying x..x+th. */
  wallZ(z0: number, z1: number, x: number, th: number, y0: number, y1: number, mNx: string, mPx: string, opens: Open[] = [], reveal = mPx, o: { aoN?: boolean; aoP?: boolean; col?: boolean; skirt?: string } = {}) {
    const os = [...opens].sort((p, q) => p.a - q.a);
    let cur = z0;
    const solid = (a: number, b: number) => {
      if (b - a < 1e-4) return;
      this.box(x, y0, a, th, y1 - y0, b - a, mPx, { nx: mNx, px: mPx, pz: reveal, nz: reveal, py: null, ny: null });
      if (o.col !== false) this.col(x, y0, a, th, y1 - y0, b - a, 'wall');
      if (o.aoN) { this.aoQuadX(a, b, x, true, y0, 0.45, -1); this.aoQuadX(a, b, x, false, y1 - 0.3, 0.3, -1); if (o.skirt) this.trimZ(a, b, x, -1, y0, y1, o.skirt); }
      if (o.aoP) { this.aoQuadX(a, b, x + th, true, y0, 0.45, 1); this.aoQuadX(a, b, x + th, false, y1 - 0.3, 0.3, 1); if (o.skirt) this.trimZ(a, b, x + th, 1, y0, y1, o.skirt); }
    };
    for (const op of os) {
      solid(cur, op.a);
      if (op.y0 > y0) {
        this.box(x, y0, op.a, th, op.y0 - y0, op.b - op.a, mPx, { nx: mNx, px: mPx, py: reveal, pz: null, nz: null, ny: null });
        if (o.col !== false) this.col(x, y0, op.a, th, op.y0 - y0, op.b - op.a, 'wall');
      }
      if (op.y1 < y1) {
        this.box(x, op.y1, op.a, th, y1 - op.y1, op.b - op.a, mPx, { nx: mNx, px: mPx, ny: reveal, pz: null, nz: null, py: null });
        if (o.col !== false) this.col(x, op.y1, op.a, th, y1 - op.y1, op.b - op.a, 'wall');
      }
      if (op.solid && o.col !== false) this.col(x, op.y0, op.a, th, op.y1 - op.y0, op.b - op.a, 'glass');
      cur = op.b;
    }
    solid(cur, z1);
  }

  /** soft contact shadow on the floor under furniture */
  contact(cx: number, cz: number, w: number, d: number, y: number) {
    const e = 0.22;
    this.quad('contact', [cx - w / 2 - e, y + 0.004, cz + d / 2 + e], [cx + w / 2 + e, y + 0.004, cz + d / 2 + e], [cx + w / 2 + e, y + 0.004, cz - d / 2 - e], [cx - w / 2 - e, y + 0.004, cz - d / 2 - e], [0, 0, 1, 0, 1, 1, 0, 1]);
  }

  build(parent: THREE.Object3D, opts: { shadows?: boolean } = {}): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.buckets.forEach((b, key) => {
      if (!b.idx.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(new THREE.BufferAttribute(b.idx.length > 65000 ? new Uint32Array(b.idx) : new Uint16Array(b.idx), 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat(key));
      const decal = key === 'ao' || key === 'contact', glass = key === 'glass';
      m.castShadow = opts.shadows !== false && !decal && !glass && !key.startsWith('laundry');
      m.receiveShadow = !decal && !glass;
      if (decal) m.renderOrder = 2; if (glass) m.renderOrder = 3;
      m.matrixAutoUpdate = false;
      parent.add(m); out.push(m);
    });
    return out;
  }
}

/** Build a small standalone mesh group (for animated parts). origin at local 0,0,0 */
export function makeGroup(fn: (b: Builder) => void): THREE.Group {
  const b = new Builder(); fn(b);
  const g = new THREE.Group();
  b.build(g);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.matrixAutoUpdate = true; } });
  return g;
}
