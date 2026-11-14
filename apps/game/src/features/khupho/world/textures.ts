import * as THREE from 'three';
import { fbm, hash2, smoothstep, tnoise, mulberry32, clamp, hexToRgb } from './util';

/** albedo (sRGB) + height (bump) + roughness (absolute, 0..1). Materials use roughness maps directly. */
export interface TexSet { map: THREE.Texture; bump?: THREE.Texture; rough?: THREE.Texture; normal?: THREE.Texture; sx: number; sy: number }
export const texCfg = { aniso: 8 };

function mkTex(c: HTMLCanvasElement, srgb: boolean, sx: number, sy: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = texCfg.aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / sx, 1 / sy);
  t.needsUpdate = true;
  return t;
}
function canvas(w: number, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/** domain-warped fbm: organic, tileable variation (warp shifts stay small so lattice wraps cleanly) */
export function warp(u: number, v: number, fx: number, fy: number, seed: number, a = 0.1): number {
  const qx = fbm(u, v, fx, fy, 3, seed), qy = fbm(u + 0.37, v + 0.71, fx, fy, 3, seed + 3);
  return fbm(u + a * (qx - 0.5), v + a * (qy - 0.5), fx, fy, 5, seed + 7);
}

type PixFn = (u: number, v: number, o: number[], x: number, y: number) => void;
/** o = [r, g, b, height, roughness], all 0..1. v grows upward. */
function gen(size: number, sx: number, sy: number, fn: PixFn, post?: (c: CanvasRenderingContext2D, b: CanvasRenderingContext2D, S: number) => void, bump = true): TexSet {
  const c = canvas(size), b = canvas(size), rc = canvas(size);
  const cx = c.getContext('2d')!, bx = b.getContext('2d')!, rx = rc.getContext('2d')!;
  const id = cx.createImageData(size, size), bd = bx.createImageData(size, size), rd = rx.createImageData(size, size);
  const o = [0, 0, 0, 0.5, 0.8];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    o[0] = 0; o[1] = 0; o[2] = 0; o[3] = 0.5; o[4] = 0.8;
    fn(x / size, 1 - y / size, o, x, y);
    const i = (y * size + x) * 4;
    id.data[i] = clamp(o[0], 0, 1) * 255; id.data[i + 1] = clamp(o[1], 0, 1) * 255; id.data[i + 2] = clamp(o[2], 0, 1) * 255; id.data[i + 3] = 255;
    const h = clamp(o[3], 0, 1) * 255;
    bd.data[i] = bd.data[i + 1] = bd.data[i + 2] = h; bd.data[i + 3] = 255;
    const rr = clamp(o[4], 0, 1) * 255;
    rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = rr; rd.data[i + 3] = 255;
  }
  cx.putImageData(id, 0, 0); bx.putImageData(bd, 0, 0); rx.putImageData(rd, 0, 0);
  post?.(cx, bx, size);
  return { map: mkTex(c, true, sx, sy), bump: bump ? mkTex(b, false, sx, sy) : undefined, rough: mkTex(rc, false, sx, sy), sx, sy };
}

function crack(cx: CanvasRenderingContext2D, bx: CanvasRenderingContext2D, S: number, r: () => number, n: number, a = 0.5) {
  for (let k = 0; k < n; k++) {
    let x = r() * S, y = r() * S, ang = r() * Math.PI * 2;
    const len = 20 + r() * 80;
    cx.beginPath(); bx.beginPath(); cx.moveTo(x, y); bx.moveTo(x, y);
    for (let i = 0; i < len; i += 4) {
      ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * 4; y += Math.sin(ang) * 4;
      cx.lineTo(x, y); bx.lineTo(x, y);
    }
    cx.strokeStyle = `rgba(40,35,30,${a})`; cx.lineWidth = 1 + r() * 0.8; cx.stroke();
    bx.strokeStyle = 'rgba(0,0,0,0.9)'; bx.lineWidth = 1.5; bx.stroke();
  }
}

// ---------- plaster: trowel marks, damp, mould, peeled paint over grey base coat ----------
export function plasterTex(exterior: boolean, seed = 1): TexSet {
  const S = exterior ? 1024 : 512, sz = exterior ? 3.3 : 2.2;
  const grime = exterior ? 1 : 0.2;
  return gen(S, sz, sz, (u, v, o, x, y) => {
    const n1 = warp(u, v, 3, 3, seed, 0.12), n2 = fbm(u, v, 40, 40, 2, seed + 9);
    const trowel = tnoise(u, v, 5, 70, seed + 21) * 0.6 + tnoise(u, v, 11, 150, seed + 22) * 0.4;
    const grain = hash2(x, y, seed);
    let L = 0.93 + (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.05 + (trowel - 0.5) * 0.035 + (grain - 0.5) * 0.03;
    let r = 1, g = 1, b = 1;
    const streak = tnoise(u, v, 22, 2, seed + 3) * (0.55 + 0.45 * tnoise(u, v, 4, 3, seed + 4));
    const drip = smoothstep(0.55, 0.85, streak) * grime * (0.2 + 0.8 * smoothstep(0.3, 1, v));
    L -= drip * 0.28; b -= drip * 0.06;
    const damp = smoothstep(0.22, 0, v) * (0.4 + 0.8 * fbm(u, v, 9, 5, 3, seed + 7)) * grime;
    L -= damp * 0.25; r -= damp * 0.08; b -= damp * 0.12;
    const mold = smoothstep(0.62, 0.8, fbm(u, v, 14, 14, 3, seed + 11)) * smoothstep(0.35, 0.05, v) * grime;
    L -= mold * 0.22; r -= mold * 0.1; b -= mold * 0.16;
    const p = fbm(u, v, 5, 5, 4, seed + 31), lim = 0.73 + (1 - grime) * 0.2;
    const peel = smoothstep(lim, lim + 0.05, p);
    L = L * (1 - peel) + (0.6 + grain * 0.08) * peel;
    o[0] = L * r; o[1] = L * g; o[2] = L * b;
    o[3] = 0.5 + (n2 - 0.5) * 0.5 + (grain - 0.5) * 0.2 + (trowel - 0.5) * 0.25 - peel * 0.35 + drip * 0.1;
    o[4] = 0.9 + (n2 - 0.5) * 0.08 + mold * 0.05 + peel * 0.05 + drip * 0.03;
  }, (cx, bx, S2) => crack(cx, bx, S2, mulberry32(seed * 99), exterior ? 7 : 3, 0.38));
}

// ---------- glazed / cement tiles (grout recessed, dirt pooled in joints) ----------
export function tilesTex(n: number, size: number, opts: { grout?: number; vary?: number; veins?: number; groutL?: number; dirt?: number; seed?: number; res?: number; gloss?: number }): TexSet {
  const S = opts.res ?? 512, g = opts.grout ?? 4, vary = opts.vary ?? 0.06, veins = opts.veins ?? 0, gl = opts.groutL ?? 0.62, dirt = opts.dirt ?? 0.1, seed = opts.seed ?? 3, gloss = opts.gloss ?? 0.3;
  const cs = S / n;
  return gen(S, size, size, (u, v, o, x, y) => {
    const ix = Math.floor(x / cs), iy = Math.floor(y / cs), fx = x - ix * cs, fy = y - iy * cs;
    const d = Math.min(fx, cs - fx, fy, cs - fy);
    const dn = fbm(u, v, 12, 12, 3, seed + 5);
    const cr = hash2(x, y, seed + 2);
    if (d < g / 2) {
      const L = gl * (0.8 + 0.4 * dn) - dirt * 0.35;
      o[0] = L * 0.97; o[1] = L * 0.96; o[2] = L * 0.92; o[3] = 0.1 + (cr - 0.5) * 0.15; o[4] = 0.85 + (dn - 0.5) * 0.1; return;
    }
    let L = 0.95 + (hash2(ix, iy, seed) - 0.5) * vary + (hash2(x, y, seed + 1) - 0.5) * 0.025;
    if (veins > 0) { const vn = 1 - Math.abs(2 * fbm(u + ix * 0.13, v + iy * 0.29, 3, 3, 4, seed + ix * 7 + iy * 13) - 1); L -= smoothstep(0.86, 0.99, vn) * veins; }
    L -= (dn - 0.5) * dirt;
    L -= smoothstep(0.985, 1, tnoise(u, v, 90, 90, seed + 8)) * 0.05; // fine crazing
    const pil = Math.sin(Math.PI * fx / cs) * Math.sin(Math.PI * fy / cs);
    const edge = smoothstep(g / 2, g / 2 + 3, d);
    o[0] = L; o[1] = L * 0.995; o[2] = L * 0.98;
    o[3] = (0.55 + 0.35 * pil) * edge + 0.1 * (1 - edge) + (dn - 0.5) * 0.1;
    o[4] = gloss + (dn - 0.5) * 0.12 + dirt * 0.3 + (hash2(ix, iy, seed + 4) - 0.5) * 0.05;
  });
}

// ---------- gạch bông (hand-pressed patterned cement tile) ----------
export function gachBongTex(): TexSet {
  const S = 512, n = 8, c = S / n;
  const cv = canvas(S), cx = cv.getContext('2d')!;
  const bv = canvas(S), bx = bv.getContext('2d')!;
  const rv = canvas(S), rxc = rv.getContext('2d')!;
  cx.fillStyle = '#e6dabc'; cx.fillRect(0, 0, S, S);
  bx.fillStyle = '#9a9a9a'; bx.fillRect(0, 0, S, S);
  rxc.fillStyle = 'rgb(92,92,92)'; rxc.fillRect(0, 0, S, S);
  const GR = '#1f5c52', TC = '#b0522d', CR = '#eadfc3', YL = '#d9a441';
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    cx.save(); cx.translate(ix * c, iy * c);
    const alt = (ix + iy) % 2 === 0;
    const A = alt ? GR : TC, B = alt ? TC : GR;
    cx.fillStyle = CR; cx.fillRect(0, 0, c, c);
    cx.strokeStyle = A; cx.lineWidth = c * 0.07; cx.strokeRect(c * 0.07, c * 0.07, c * 0.86, c * 0.86);
    cx.strokeStyle = YL; cx.lineWidth = c * 0.025; cx.strokeRect(c * 0.16, c * 0.16, c * 0.68, c * 0.68);
    for (const [px, py] of [[0, 0], [c, 0], [0, c], [c, c]]) {
      cx.fillStyle = B; cx.beginPath(); cx.arc(px, py, c * 0.3, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = CR; cx.lineWidth = c * 0.03; cx.beginPath(); cx.arc(px, py, c * 0.21, 0, Math.PI * 2); cx.stroke();
    }
    cx.translate(c / 2, c / 2);
    for (let k = 0; k < 4; k++) {
      cx.rotate(Math.PI / 2); cx.fillStyle = A; cx.beginPath(); cx.ellipse(0, -c * 0.19, c * 0.075, c * 0.17, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = B; cx.beginPath(); cx.arc(c * 0.17, -c * 0.17, c * 0.04, 0, Math.PI * 2); cx.fill();
    }
    cx.fillStyle = YL; cx.beginPath(); cx.arc(0, 0, c * 0.06, 0, Math.PI * 2); cx.fill();
    cx.restore();
    bx.fillStyle = '#c4c4c4'; bx.fillRect(ix * c + 2, iy * c + 2, c - 4, c - 4);
  }
  const id = cx.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S, v = y / S;
    const w = 0.94 + (hash2(x, y, 4) - 0.5) * 0.08 - (fbm(u, v, 6, 6, 4, 8) - 0.5) * 0.22;
    const tint = (fbm(u, v, 10, 10, 3, 3) - 0.5) * 0.1;
    id.data[i] *= w + tint; id.data[i + 1] *= w; id.data[i + 2] *= w - tint * 1.5;
  }
  cx.putImageData(id, 0, 0);
  cx.strokeStyle = 'rgba(95,88,76,0.85)'; cx.lineWidth = 2;
  for (let k = 0; k <= n; k++) { cx.beginPath(); cx.moveTo(k * c, 0); cx.lineTo(k * c, S); cx.stroke(); cx.beginPath(); cx.moveTo(0, k * c); cx.lineTo(S, k * c); cx.stroke(); }
  bx.strokeStyle = '#222'; bx.lineWidth = 3;
  for (let k = 0; k <= n; k++) { bx.beginPath(); bx.moveTo(k * c, 0); bx.lineTo(k * c, S); bx.stroke(); bx.beginPath(); bx.moveTo(0, k * c); bx.lineTo(S, k * c); bx.stroke(); }
  rxc.strokeStyle = 'rgb(225,225,225)'; rxc.lineWidth = 3;
  for (let k = 0; k <= n; k++) { rxc.beginPath(); rxc.moveTo(k * c, 0); rxc.lineTo(k * c, S); rxc.stroke(); rxc.beginPath(); rxc.moveTo(0, k * c); rxc.lineTo(S, k * c); rxc.stroke(); }
  crack(cx, bx, S, mulberry32(12), 4, 0.3);
  return { map: mkTex(cv, true, 1.6, 1.6), bump: mkTex(bv, false, 1.6, 1.6), rough: mkTex(rv, false, 1.6, 1.6), sx: 1.6, sy: 1.6 };
}

// ---------- fired clay brick with recessed sandy mortar, soot and chips ----------
export function brickTex(): TexSet {
  const S = 512, sx = 1.1, sy = 0.9;
  return gen(S, sx, sy, (u, v, o, x, y) => {
    const um = u * sx, vm = v * sy, row = Math.floor(vm / 0.075 + 1e-6);
    const off = (row % 2) * 0.11;
    const ub = (um + off) % 0.22, col = ((Math.floor((um + off) / 0.22) % 5) + 5) % 5, vb = vm - row * 0.075;
    const n = warp(u, v, 14, 14, 5, 0.15), gr = hash2(x, y, 2), chip = hash2(Math.floor(x / 9), Math.floor(y / 9), 61);
    if (ub < 0.011 || vb < 0.011) {
      const L = 0.66 + (gr - 0.5) * 0.12 + (n - 0.5) * 0.12;
      o[0] = L; o[1] = L * 0.97; o[2] = L * 0.9; o[3] = 0.1 + gr * 0.12; o[4] = 0.94 + (gr - 0.5) * 0.04; return;
    }
    const hb = hash2(col, row % 12, 77);
    let L = 0.6 + hb * 0.28 + (n - 0.5) * 0.3 + (gr - 0.5) * 0.12;
    if (chip > 0.975) L *= 0.55;
    L -= smoothstep(0.6, 1.0, v) * 0.15; // soot climbing from below the eaves
    const edge = smoothstep(0.011, 0.02, Math.min(ub, vb));
    o[0] = L * 0.92; o[1] = L * 0.52 + hb * 0.04; o[2] = L * 0.38;
    o[3] = 0.55 + 0.35 * edge * (0.7 + n * 0.5) + (gr - 0.5) * 0.15;
    o[4] = 0.8 + (n - 0.5) * 0.15 + (chip > 0.975 ? 0.1 : 0);
  });
}

// ---------- ngói âm dương: alternating concave/convex clay roof tiles ----------
export function roofTileTex(): TexSet {
  const S = 512;
  return gen(S, 1, 1, (u, v, o, x, y) => {
    const col = Math.floor(u * 6), fu = u * 6 - col;
    const rv = v * 5 + (col % 2) * 0.5, row = Math.floor(rv), fv = rv - row;
    const th = hash2(col, row, 91), th2 = hash2(col, row, 3);
    const pan = Math.sin(fu * Math.PI);
    const overlap = smoothstep(0.0, 0.18, fv) * smoothstep(1.0, 0.82, fv);
    const prof = Math.pow(pan, 0.6) * (0.55 + 0.45 * overlap);
    let L = 0.5 + 0.38 * prof + (th - 0.5) * 0.12 + (hash2(x, y, 1) - 0.5) * 0.07;
    L *= 0.7 + 0.3 * smoothstep(0, 0.14, fv);
    let r = 0.78, g = 0.31, b = 0.17;
    if (th2 > 0.86) { r = 0.82; g = 0.46; b = 0.3; } else if (th2 < 0.1) { r = 0.55; g = 0.25; b = 0.16; }
    const fade = warp(u, v, 5, 5, 4, 0.2) - 0.5;
    r *= 1 + fade * 0.25; g *= 1 + fade * 0.2; b *= 1 + fade * 0.2;
    const moss = smoothstep(0.58, 0.74, fbm(u, v, 7, 7, 4, 5)) * (0.4 + 0.6 * (1 - fv)) * (0.5 + 0.5 * (1 - pan));
    r = r * (1 - moss * 0.6) + 0.2 * moss; g = g * (1 - moss * 0.6) + 0.27 * moss; b = b * (1 - moss * 0.6) + 0.1 * moss;
    o[0] = L * r * 1.35; o[1] = L * g * 1.35; o[2] = L * b * 1.35;
    o[3] = 0.25 + 0.55 * pan * smoothstep(0, 0.2, fv) + (hash2(x, y, 9) - 0.5) * 0.1;
    o[4] = 0.7 + moss * 0.25 + (th - 0.5) * 0.1;
  });
}

// ---------- asphalt: aggregate, polished wheel tracks, oil, cracks ----------
export function asphaltTex(): TexSet {
  const S = 1024, sz = 4;
  return gen(S, sz, sz, (u, v, o, x, y) => {
    const n = warp(u, v, 6, 6, 3, 0.2), n2 = fbm(u, v, 3, 3, 3, 12), gr = hash2(x, y, 1), agg = hash2(x, y, 7);
    let L = 0.18 + (n - 0.5) * 0.09 + (gr - 0.5) * 0.07;
    const trk = Math.exp(-Math.pow((u - 0.25) / 0.05, 2)) + Math.exp(-Math.pow((u - 0.75) / 0.05, 2));
    L -= trk * 0.025;
    const patch = smoothstep(0.62, 0.66, n2); L *= 1 - patch * 0.22;
    const oil = smoothstep(0.7, 0.9, fbm(u, v, 5, 5, 3, 21)) * 0.05; L -= oil;
    const aggL = agg > 0.982 ? 0.2 + 0.2 * hash2(x, y, 8) : 0;
    L += aggL;
    o[0] = L; o[1] = L; o[2] = L * 1.03;
    o[3] = 0.5 + (gr - 0.5) * 0.7 + (n - 0.5) * 0.25 + aggL * 0.8;
    o[4] = 0.88 - trk * 0.22 - oil * 1.5 + (agg > 0.982 ? -0.15 : 0) + (n - 0.5) * 0.05;
  }, (cx, bx, S2) => crack(cx, bx, S2, mulberry32(5), 14, 0.55));
}

// ---------- board-marked concrete: formwork seams, pores, water staining ----------
export function concreteTex(): TexSet {
  const S = 512, sz = 2;
  return gen(S, sz, sz, (u, v, o, x, y) => {
    const n = warp(u, v, 5, 5, 4, 0.12), gr = hash2(x, y, 3);
    const pu = (u * 4) % 1, pv = (v * 4) % 1;
    const seam = Math.min(pu, 1 - pu, pv, 1 - pv) < 0.006 ? 1 : 0;
    const pore = hash2(x >> 1, y >> 1, 5) > 0.992 ? 1 : 0;
    const moss = smoothstep(0.64, 0.8, fbm(u, v, 8, 8, 3, 9)) * 0.5;
    const stain = smoothstep(0.55, 0.8, fbm(u, v, 2, 3, 3, 14)) * 0.08;
    const L = 0.66 + (n - 0.5) * 0.24 + (gr - 0.5) * 0.08 - seam * 0.14 - pore * 0.28 - stain;
    o[0] = L - moss * 0.3; o[1] = L - moss * 0.08; o[2] = L - moss * 0.35;
    o[3] = 0.5 + (n - 0.5) * 0.5 + (gr - 0.5) * 0.25 - pore * 0.4 - seam * 0.2;
    o[4] = 0.9 + (gr - 0.5) * 0.06 + pore * 0.05 + moss * 0.05;
    const e = Math.min(u, 1 - u, v, 1 - v);
    if (e < 0.004) { o[0] *= 0.45; o[1] *= 0.45; o[2] *= 0.45; o[3] = 0.05; }
  }, (cx, bx, S2) => crack(cx, bx, S2, mulberry32(8), 5, 0.45));
}

// ---------- wood planks: fibres, rings, knots, butt joints, varnish variation ----------
export function woodTex(boards: number, seed = 2): TexSet {
  const S = 512;
  return gen(S, 1, 1, (u, v, o, x, y) => {
    const rv = v * boards, row = Math.floor(rv), fv = rv - row;
    const j = hash2(row, 4, seed), seg = u > j ? 1 : 0;
    const id = hash2(row, seg, seed + 9);
    const grainY = tnoise(u, v + id, 2, 80, seed + 2);
    const fib = tnoise(u, v, 40, 80, seed + 6) * 0.3;
    const ring = 0.5 + 0.5 * Math.sin((grainY * 9 + fib * 4) * Math.PI);
    let L = 0.56 + id * 0.24 + (ring - 0.5) * 0.16 + (grainY - 0.5) * 0.12 + (hash2(x, y, 4) - 0.5) * 0.03;
    const kd = Math.hypot((u - (0.2 + id * 0.6)) * 3, (fv - 0.5) * 0.9);
    const knot = smoothstep(0.12, 0.05, kd) * (hash2(row, 3, seed) > 0.6 ? 1 : 0);
    L *= 1 - knot * 0.35;
    let h = 0.6 + (grainY - 0.5) * 0.2 - fib * 0.2;
    if (boards > 1 && (fv < 0.035 || fv > 0.965)) { L *= 0.35; h = 0.05; }
    if (Math.abs(u - j) < 0.003) { L *= 0.5; h = 0.1; }
    o[0] = L; o[1] = L * 0.76; o[2] = L * 0.52; o[3] = h;
    o[4] = 0.5 + (ring - 0.5) * 0.1 + (hash2(row, seg, seed + 3) - 0.5) * 0.2 + fib * 0.1;
  });
}

// ---------- tôn (corrugated sheet): ridges, dents, rust bloom and runoff streaks ----------
export function corrugatedTex(): TexSet {
  const S = 512, sx = 0.76, sy = 1.2;
  return gen(S, sx, sy, (u, v, o, x, y) => {
    const ph = Math.cos(u * 10 * Math.PI * 2);
    const dent = (warp(u, v, 3, 3, 8, 0.2) - 0.5) * 0.12;
    const L = 0.74 + 0.2 * ph + dent + (hash2(x, y, 6) - 0.5) * 0.05;
    const rust = smoothstep(0.5, 0.85, fbm(u, v, 10, 3, 4, 3)) * (0.5 + 0.5 * (1 - v));
    const streak = smoothstep(0.65, 0.9, tnoise(u, v, 20, 1, 4)) * 0.4 * (1 - v * 0.5);
    const k = clamp(rust + streak, 0, 1);
    o[0] = L * (1 - k * 0.2) + k * 0.14; o[1] = L * (1 - k * 0.5) + k * 0.05; o[2] = L * (1 - k * 0.8);
    o[3] = 0.5 + 0.5 * ph + dent;
    o[4] = 0.42 + k * 0.45 + (1 - ph) * 0.04;
  });
}

export function shutterTex(): TexSet {
  const S = 512, sx = 0.5, sy = 0.48;
  return gen(S, sx, sy, (u, v, o, x, y) => {
    const sv = v * 8, fv = sv - Math.floor(sv);
    let L = 0.72 + 0.18 * Math.sin(fv * Math.PI) + (hash2(x, y, 2) - 0.5) * 0.04 - (fbm(u, v, 8, 8, 3, 2) - 0.5) * 0.2;
    let h = 0.4 + 0.5 * Math.sin(fv * Math.PI);
    if (fv < 0.07) { L *= 0.4; h = 0; }
    const uu = u * 12.5 - Math.floor(u * 12.5);
    if (fv > 0.42 && fv < 0.62 && uu > 0.2 && uu < 0.8) { L *= 0.25; h = 0; }
    o[0] = L; o[1] = L; o[2] = L; o[3] = h;
    o[4] = 0.55 + (fbm(u, v, 6, 6, 3, 2) - 0.5) * 0.25;
  });
}

export function fabricTex(): TexSet {
  const S = 256, sz = 0.3;
  return gen(S, sz, sz, (u, v, o, x, y) => {
    const w = Math.sin(u * Math.PI * 2 * 24) * Math.sin(v * Math.PI * 2 * 24);
    const fib = hash2(x, y, 3) - 0.5;
    const L = 0.82 + w * 0.08 + fib * 0.1 + (fbm(u, v, 4, 4, 2, 1) - 0.5) * 0.15;
    o[0] = L; o[1] = L; o[2] = L; o[3] = 0.5 + w * 0.3;
    o[4] = 0.95 + fib * 0.05;
  });
}

export function brushedTex(): TexSet {
  const S = 256, sz = 0.6;
  return gen(S, sz, sz, (u, v, o) => {
    const br = tnoise(u, v, 2, 120, 2);
    const L = 0.72 + (br - 0.5) * 0.25 + (fbm(u, v, 3, 3, 3, 4) - 0.5) * 0.15;
    o[0] = L; o[1] = L; o[2] = L; o[3] = 0.5 + (br - 0.5) * 0.3; o[4] = 0.32 + (br - 0.5) * 0.12;
  });
}

// ---------- ốp đá (split-face stone cladding) ----------
export function stoneTex(): TexSet {
  const S = 512, sx = 0.9, sy = 0.9;
  return gen(S, sx, sy, (u, v, o, x, y) => {
    const row = Math.floor(v * 3), fv = v * 3 - row;
    const off = hash2(row, 1, 7) * 2, uu = u * 2 + off, bi = Math.floor(uu), fu = uu - bi;
    const tone = hash2(bi, row, 13), gr = hash2(x, y, 2), n = warp(u, v, 8, 8, 9, 0.2);
    const edgeD = Math.min(fu, 1 - fu, fv, 1 - fv);
    if (edgeD < 0.03) { const L = 0.36 + (gr - 0.5) * 0.08; o[0] = L; o[1] = L * 0.98; o[2] = L * 0.94; o[3] = 0.04; o[4] = 0.95; return; }
    const L = 0.74 + (tone - 0.5) * 0.22 + (n - 0.5) * 0.18 + (gr - 0.5) * 0.08;
    const spark = hash2(x, y, 44) > 0.995 ? 0.25 : 0;
    o[0] = L * (0.97 + tone * 0.06); o[1] = L * 0.96; o[2] = L * 0.9;
    o[3] = 0.6 + (n - 0.5) * 0.4 + (gr - 0.5) * 0.3 - (edgeD < 0.05 ? 0.2 : 0);
    o[4] = 0.5 + (tone - 0.5) * 0.3 + (n - 0.5) * 0.2 + spark;
  });
}

// ---------- terrazzo: polished chips in cream matrix ----------
const TERR = ['#8c8a84', '#4d4b47', '#c98f86', '#7f9b7a', '#e9e4d6', '#b08a5c', '#6d7f8c'].map(hexToRgb);
export function terrazzoTex(): TexSet {
  const S = 512, sx = 1.2, sy = 1.2, cells = 40, cs = S / cells;
  return gen(S, sx, sy, (u, v, o, x, y) => {
    const cxI = Math.floor(x / cs), cyI = Math.floor(y / cs);
    let col = -1;
    for (let dy = -1; dy <= 1 && col < 0; dy++) for (let dx = -1; dx <= 1 && col < 0; dx++) {
      const ix = cxI + dx, iy = cyI + dy, wx = ((ix % cells) + cells) % cells, wy = ((iy % cells) + cells) % cells;
      const jx = (ix + hash2(wx, wy, 1)) * cs, jy = (iy + hash2(wx, wy, 2)) * cs, rad = cs * (0.18 + hash2(wx, wy, 3) * 0.3);
      if (hash2(wx, wy, 4) < 0.55 && Math.hypot(x - jx, y - jy) < rad) col = Math.floor(hash2(wx, wy, 5) * TERR.length);
    }
    const base = 0.9 + (warp(u, v, 4, 4, 17, 0.2) - 0.5) * 0.08 + (hash2(x, y, 18) - 0.5) * 0.03;
    if (col >= 0) {
      const c = TERR[col];
      o[0] = c[0] / 255 * 0.95; o[1] = c[1] / 255 * 0.95; o[2] = c[2] / 255 * 0.95; o[3] = 0.75; o[4] = 0.18 + (hash2(x, y, 19) - 0.5) * 0.05;
    } else {
      o[0] = base * 0.94; o[1] = base * 0.93; o[2] = base * 0.9; o[3] = 0.45 + (hash2(x, y, 20) - 0.5) * 0.1; o[4] = 0.3 + (warp(u, v, 3, 3, 21, 0.1) - 0.5) * 0.1;
    }
  });
}

// ---------- shared micro-variation: keeps uniform solid surfaces from looking like CG plastic ----------
let _micro: TexSet | null = null;
export function microTex(): TexSet {
  if (_micro) return _micro;
  _micro = gen(256, 0.6, 0.6, (u, v, o, x, y) => {
    const n = tnoise(u, v, 16, 16, 31) * 0.6 + hash2(x, y, 33) * 0.4;
    const big = warp(u, v, 3, 3, 35, 0.2);
    o[0] = 1; o[1] = 1; o[2] = 1;
    o[3] = 0.5 + (n - 0.5) * 0.7 + (big - 0.5) * 0.4;
    o[4] = 0.8 + (n - 0.5) * 0.12 + (big - 0.5) * 0.1;
  });
  return _micro;
}

// ---------- foliage cards: pointed leaves with midrib, lateral veins, light and age ----------
export function leafCardTex(kind: 'green' | 'dark' | 'bougain' | 'banyan', seed = 1): THREE.CanvasTexture {
  const S = 256, c = canvas(S), cx = c.getContext('2d')!, r = mulberry32(seed * 31 + kind.length);
  cx.clearRect(0, 0, S, S);
  const greens = kind === 'dark' ? ['#2b5a26', '#32672b', '#254b21', '#3b7430'] : kind === 'banyan' ? ['#3f7a2e', '#4a8a33', '#356b27', '#58993c'] : ['#4c8f35', '#5da23f', '#3d7d2d', '#6fb04a'];
  const leaf = (x: number, y: number, a: number, l: number, col: string) => {
    const w = l * (0.28 + r() * 0.1);
    cx.save(); cx.translate(x, y); cx.rotate(a);
    cx.fillStyle = col; cx.beginPath(); cx.moveTo(0, -l); cx.quadraticCurveTo(w * 1.05, -l * 0.25, w * 0.35, l * 0.55); cx.quadraticCurveTo(0, l * 1.02, -w * 0.35, l * 0.55); cx.quadraticCurveTo(-w * 1.05, -l * 0.25, 0, -l); cx.fill();
    cx.fillStyle = 'rgba(190,230,140,0.18)'; cx.beginPath(); cx.moveTo(0, -l); cx.quadraticCurveTo(w * 0.9, -l * 0.25, w * 0.3, l * 0.5); cx.lineTo(0, l * 0.3); cx.closePath(); cx.fill();
    cx.strokeStyle = 'rgba(215,240,170,0.45)'; cx.lineWidth = Math.max(1, l * 0.06); cx.beginPath(); cx.moveTo(0, -l * 0.92); cx.lineTo(0, l * 0.85); cx.stroke();
    cx.lineWidth = 0.8; cx.strokeStyle = 'rgba(200,230,160,0.22)';
    for (let i = -3; i <= 3; i++) { const yy = i * l * 0.22; cx.beginPath(); cx.moveTo(0, yy); cx.lineTo(w * 0.8, yy - l * 0.18); cx.moveTo(0, yy); cx.lineTo(-w * 0.8, yy - l * 0.18); cx.stroke(); }
    if (r() < 0.08) { cx.fillStyle = 'rgba(150,110,40,0.7)'; cx.beginPath(); cx.arc(0, -l * 0.8, l * 0.12, 0, 6.283); cx.fill(); }
    cx.restore();
  };
  const n = kind === 'bougain' ? 40 : 96;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.42;
    leaf(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, r() * Math.PI * 2, 14 + r() * 14, greens[Math.floor(r() * greens.length)]);
  }
  if (kind === 'bougain') {
    const pinks = ['#d41e6c', '#e8408a', '#f06ca8', '#c2185b', '#f48fb1'];
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.44, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
      cx.save(); cx.translate(x, y); cx.rotate(r() * 6.28); cx.fillStyle = pinks[Math.floor(r() * pinks.length)];
      cx.beginPath(); cx.ellipse(0, 0, 4 + r() * 3, 6 + r() * 3, 0, 0, Math.PI * 2); cx.fill(); cx.restore();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function aoStripTex(): THREE.CanvasTexture {
  const c = canvas(4, 64), cx = c.getContext('2d')!;
  for (let y = 0; y < 64; y++) { const a = Math.pow(1 - y / 63, 2.2) * 0.5; cx.fillStyle = `rgba(0,0,0,${a})`; cx.fillRect(0, y, 4, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
export function contactTex(): THREE.CanvasTexture {
  const S = 64, c = canvas(S), cx = c.getContext('2d')!, id = cx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = Math.max(0, Math.abs(x - S / 2 + 0.5) - S * 0.28), dy = Math.max(0, Math.abs(y - S / 2 + 0.5) - S * 0.28);
    const d = Math.hypot(dx, dy) / (S * 0.22);
    const a = Math.pow(1 - smoothstep(0, 1, d), 1.6) * 0.62;
    const i = (y * S + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 0; id.data[i + 3] = a * 255;
  }
  cx.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
export function glowTex(): THREE.CanvasTexture {
  const S = 128, c = canvas(S), cx = c.getContext('2d')!;
  const g = cx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export function signTex(lines: string[], bg: string, fg: string, w = 512, h = 128, opts: { border?: string; font?: string; sub?: string; round?: boolean } = {}): THREE.CanvasTexture {
  const c = canvas(w, h), cx = c.getContext('2d')!;
  cx.fillStyle = bg; cx.fillRect(0, 0, w, h);
  const g = cx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  cx.fillStyle = g; cx.fillRect(0, 0, w, h);
  if (opts.border) { cx.strokeStyle = opts.border; cx.lineWidth = h * 0.05; cx.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
  cx.fillStyle = fg; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((t, i) => {
    const fs = (n === 1 ? h * 0.52 : i === 0 ? h * 0.42 : h * 0.26);
    cx.font = `${i === 0 ? '800' : '600'} ${fs}px ${opts.font ?? 'Arial, Helvetica, sans-serif'}`;
    const y = n === 1 ? h / 2 : i === 0 ? h * 0.36 : h * 0.7;
    let s = fs; while (cx.measureText(t).width > w * 0.92 && s > 8) { s -= 2; cx.font = `${i === 0 ? '800' : '600'} ${s}px ${opts.font ?? 'Arial, Helvetica, sans-serif'}`; }
    cx.fillText(t, w / 2, y);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}


// ---------- scanned PBR sets (Poly Haven, CC0): albedo normalised so paint colour stays in the material key ----------
const urls = import.meta.glob('../assets/tex/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const loader = new THREE.TextureLoader();
function load(file: string, srgb: boolean, sx: number, sy: number): THREE.Texture | undefined {
  const u = urls[`../assets/tex/${file}.jpg`]; if (!u) return undefined;
  const t = loader.load(u);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = texCfg.aniso; t.repeat.set(1 / sx, 1 / sy);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** sx, sy: metres covered by one tile of the scan */
export function realTex(key: string, sx: number, sy = sx): TexSet {
  return { map: load(key + '_d', true, sx, sy)!, normal: load(key + '_n', false, sx, sy), rough: load(key + '_r', false, sx, sy), sx, sy };
}
