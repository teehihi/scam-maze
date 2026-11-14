import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { vnoise } from './textures';

export function rbox(w: number, h: number, d: number, r = 0.01, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, parent?: THREE.Object3D, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent?.add(m);
  return m;
}

/** lathe from [radius, y] pairs */
export function lathe(pts: [number, number][], seg = 40) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.computeVertexNormals();
  return g;
}

export function tube(points: THREE.Vector3[], radius: number, seg = 64, radial = 8) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4), seg, radius, radial, false);
}

/** Rescale UVs so textures keep physical size (unit = metres / tile) */
export function worldUV(geo: THREE.BufferGeometry, sx: number, sy: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}

/** Wall slab facing +Z in local space, uv locked to metres */
export function wallPiece(x0: number, x1: number, y0: number, y1: number, tile = 1.6) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, 1);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
  return g;
}

/** Cloth draped over a box top (mattress) — returns geometry in box-local coords */
export function drapedCloth(opts: {
  w: number; l: number; segW: number; segL: number;
  hw: number; hl: number; top: number; z0: number;
  wrinkle: number; seed: number; fold?: number; lump?: number;
}) {
  const { w, l, segW, segL, hw, hl, top, z0, wrinkle, seed } = opts;
  const g = new THREE.PlaneGeometry(w, l, segW, segL);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i) + z0;
    let y = top + 0.012;
    const n1 = vnoise(x * 4 + 3, z * 4, seed) - 0.5;
    const n2 = vnoise(x * 11, z * 9 + 7, seed + 3) - 0.5;
    const ridge = Math.sin(x * 9 + z * 6 + n1 * 4) * Math.sin(z * 4 - x * 2);
    let wr = (n1 * 0.6 + n2 * 0.25 + ridge * 0.25 + 0.45) * wrinkle;
    if (opts.lump) wr += Math.max(0, vnoise(x * 2.2, z * 2.2, seed + 9) - 0.45) * opts.lump;
    // fold-over near the head end (the thrown-back duvet)
    if (opts.fold && z < z0 - l / 2 + opts.fold) {
      const k = 1 - (z - (z0 - l / 2)) / opts.fold;
      y += Math.sin(k * Math.PI * 0.9) * 0.07;
      wr += 0.02 * k;
    }
    // drape over sides
    const ox = Math.abs(x) - hw, oz = z - hl;
    if (ox > 0) {
      const s = Math.sign(x);
      x = s * (hw + 0.025 * (1 - Math.exp(-ox * 20)));
      y -= ox * 0.98;
      wr *= 0.5;
      x += s * Math.sin(z * 25 + n1) * 0.008 * Math.min(1, ox * 6);
    }
    if (oz > 0) {
      z = hl + 0.025 * (1 - Math.exp(-oz * 20));
      y -= oz * 0.98;
      z += Math.sin(x * 22 + n2 * 3) * 0.01 * Math.min(1, oz * 5);
    }
    p.setXYZ(i, x, y + wr, z - z0);
  }
  g.translate(0, 0, z0);
  g.computeVertexNormals();
  return g;
}

/** Fabric hanging over a horizontal bar along X (chair back, hook) */
export function drapeOverBar(w: number, frontLen: number, backLen: number, r: number, seed: number, flare = 0.04) {
  const segW = 28, segL = 50;
  const total = frontLen + backLen + Math.PI * r;
  const g = new THREE.PlaneGeometry(w, total, segW, segL);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const s = p.getY(i) + total / 2 - frontLen; // s<0 front side, then arc, then back
    let y: number, z: number;
    const arc = Math.PI * r;
    if (s < 0) { y = s; z = r; }
    else if (s <= arc) { const a = s / r; y = Math.sin(a) * r; z = Math.cos(a) * r; }
    else { y = -(s - arc); z = -r; }
    const hang = Math.max(0, -y);
    const n = vnoise(x * 8, y * 6, seed) - 0.5;
    const folds = Math.sin(x * 26 + n * 3) * 0.012 * Math.min(1, hang * 3);
    z += Math.sign(z || 1) * (folds + hang * flare * (0.5 + n));
    const xx = x * (1 + hang * 0.15) + n * 0.02 * hang;
    p.setXYZ(i, xx, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Pleated curtain panel (hangs from y=0 down to -h) */
export function curtain(w: number, h: number, pleats: number, depth: number, seed: number) {
  const g = new THREE.PlaneGeometry(w, h, 90, 40);
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = (x / w + 0.5);
    const t = -y / h;
    const n = vnoise(u * 6, t * 3, seed) - 0.5;
    const z = Math.sin(u * pleats * Math.PI * 2 + n * 1.5) * depth * (0.85 + t * 0.35) + n * 0.02;
    p.setXYZ(i, x * (1 + t * 0.06), y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Soft pillow via a squashed superellipsoid with a head dent */
export function pillow(w: number, h: number, d: number, dent = 0.3, seed = 1) {
  const g = new THREE.SphereGeometry(1, 48, 24);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.45);
    const sz = Math.sign(z) * Math.pow(Math.abs(z), 0.45);
    const edge = Math.max(Math.abs(sx), Math.abs(sz));
    const thick = 1 - Math.pow(edge, 6) * 0.85;
    y = y * thick;
    x = sx; z = sz;
    const dd = Math.exp(-((x * x) / 0.25 + (z * z) / 0.35) * 2);
    if (y > 0) y -= dd * dent;
    y += (vnoise(x * 3, z * 3, seed) - 0.5) * 0.12;
    p.setXYZ(i, x * w / 2, y * h / 2, z * d / 2);
  }
  g.computeVertexNormals();
  return g;
}

/** Paper sheet with slight curl */
export function paper(w: number, l: number, curl = 0.01, seed = 1) {
  const g = new THREE.PlaneGeometry(w, l, 12, 16);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = (Math.pow(Math.abs(z) / (l / 2), 2) * curl) + (Math.pow(Math.abs(x) / (w / 2), 3) * curl * 0.4) + (vnoise(x * 20, z * 20, seed) - 0.5) * 0.002;
    p.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}
