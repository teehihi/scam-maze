import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder } from './builder';
import { House, type HouseSpec, type Ground } from './house';
import type { Ctx } from './types';
import { mulberry32 } from './util';
import * as F from './furniture';
import { makeSign } from './facade';
import { mat } from './materials';

const MOD = [
  ['#e7d8b5', '#f4f1ea', '#6b8a8f'], ['#c9dfd2', '#f2f0e8', '#b5533c'], ['#f0cdb8', '#f6f2ea', '#2f5d62'], ['#cfd8e8', '#f1efe9', '#c9a24b'],
  ['#e9e2d0', '#f5f2ea', '#6b4a3a'], ['#d9c4a8', '#f3efe6', '#4a6a7a'], ['#bfd8d2', '#f2f1ea', '#a8503c'], ['#e6bfae', '#f6f1e8', '#44625a'],
];
let hid = 0;
function spec(o: Partial<HouseSpec> & { W: number; floors: number }): HouseSpec {
  const seed = ++hid * 3 + 1, pal = MOD[seed % MOD.length];
  const style = o.style ?? 'modern';
  const base: HouseSpec = {
    id: 'h' + hid, no: String(8 + hid * 2 + (hid % 3)), W: o.W, D: 15, floors: o.floors, style, ground: 'living',
    color: style === 'french' ? '#e3c25a' : style === 'cap4' ? '#d8cdb0' : pal[0], trim: style === 'french' ? '#f6f2e6' : pal[1], accent: style === 'french' ? '#5a7a55' : pal[2],
    roof: style === 'modern' ? 'flat' : 'tile', yard: style === 'cap4' ? 2.6 : 0, seed, well: false,
  };
  const r = { ...base, ...o } as HouseSpec;
  if (r.style === 'modern' && r.D >= 14.5 && o.well === undefined) r.well = true;
  if (r.style === 'cap4') { r.floors = 1; r.roof = 'tile'; }
  return r;
}

export function buildNeighborhood(ctx: Ctx) {
  const NB = new Builder();
  const r = mulberry32(2024);
  // ---------------- ground, street, sidewalks ----------------
  NB.box(-220, -0.6, -220, 440, 0.55, 440, 'conc:#7d7a70', { ny: null });
  NB.box(-70, -0.3, -3.6, 140, 0.3, 7.2, 'asph');
  NB.surf(-70, -3.6, 70, 3.6, 0, 'concrete');
  const walk = (x0: number, x1: number, z0: number, z1: number) => {
    NB.box(x0, -0.1, z0, x1 - x0, 0.25, z1 - z0, 'paver:#c2bcae', { ny: null, nx: null, px: null });
    NB.surf(x0, z0, x1, z1, 0.15, 'concrete');
  };
  walk(-70, 8.5, 3.6, 6.0); walk(11.5, 70, 3.6, 6.0); walk(-70, 70, -6.0, -3.6);
  NB.box(-70, -0.1, 3.5, 78.5, 0.25, 0.1, 'conc:#b8b4a8'); NB.box(11.5, -0.1, 3.5, 58.5, 0.25, 0.1, 'conc:#b8b4a8'); NB.box(-70, -0.1, -3.6, 140, 0.25, 0.1, 'conc:#b8b4a8');
  // alley + courtyard
  NB.box(8.5, -0.2, 3.6, 3, 0.22, 49, 'conc:#9a968c'); NB.surf(8.5, 3.6, 11.5, 52, 0.02, 'concrete');
  NB.box(-4.6, -0.2, 40.5, 28.2, 0.22, 12.5, 'paver:#b3ada0'); NB.surf(-4.6, 40.5, 23.6, 53, 0.02, 'concrete');
  NB.box(9.55, -0.0, 6, 0.9, 0.025, 36, 'm:#3a3b3d'); // drain channel
  for (let z = 6.3; z < 42; z += 0.5) NB.box(9.62, 0.026, z, 0.76, 0.006, 0.08, 'r:#161617');
  // lane markings
  for (let x = -68; x < 68; x += 4.5) NB.box(x, 0.004, -0.06, 2.4, 0.004, 0.12, 'r:#e3dfd0');
  for (const z of [-3.35, 3.35]) NB.box(-70, 0.004, z, 140, 0.004, 0.1, 'r:#d8d4c4');
  for (let x = -60; x < 60; x += 14) { NB.box(x, 0.003, 3.0, 1.0, 0.01, 0.4, 'm:#2a2a2c'); for (let i = 0; i < 6; i++) NB.box(x + 0.08 + i * 0.15, 0.012, 3.02, 0.05, 0.004, 0.36, 'r:#101011'); }
  // patched road cracks / puddle-stains
  for (let i = 0; i < 9; i++) NB.box(-50 + i * 13 + r() * 5, 0.0035, -2.8 + r() * 5.6, 1.5 + r() * 2, 0.003, 0.8 + r(), 'r:#26272a');

  // silt & grit that rain pushes against kerbs, alley edges and wall bases (broken, never a clean line)
  const silt = (x0: number, x1: number, z: number, along: 'x' | 'z', y: number, w0: number, col: string) => {
    for (let p = x0; p < x1;) {
      const len = 0.8 + r() * 4.5, w = w0 * (0.4 + r() * 0.9);
      if (r() < 0.8) { if (along === 'x') NB.box(p, y, z - (r() * 0.05), len, 0.004, w, 'dirt:' + col, { ny: null }); else NB.box(z, y, p, w, 0.004, len, 'dirt:' + col, { ny: null }); }
      p += len + r() * 3;
    }
  };
  silt(-68, 66, -3.58, 'x', 0.002, 0.34, '#6d655a'); silt(-68, 66, 3.25, 'x', 0.002, 0.34, '#6d655a');
  silt(6.5, 42, 8.52, 'z', 0.024, 0.22, '#7a7266'); silt(6.5, 42, 11.25, 'z', 0.024, 0.22, '#7a7266');
  silt(-68, 8.4, 3.75, 'x', 0.152, 0.3, '#7a7266'); silt(11.6, 66, 3.75, 'x', 0.152, 0.3, '#7a7266'); silt(-68, 66, -5.75, 'x', 0.152, 0.3, '#7a7266');
  // wet patches on the road and alley (dark, glossy glaze that reflects the sky; more after rain)
  for (const [px, pz, pw, pd] of [[-38, -1.2, 3.2, 1.4], [-6, 1.6, 2.4, 1.0], [22, -2.2, 4.0, 1.6], [44, 1.2, 2.8, 1.2], [-52, 2.0, 2.0, 0.9]]) NB.box(px, 0.003, pz, pw, 0.001, pd, 'puddle');
  for (let z = 9; z < 40; z += 7) NB.box(9.9, 0.0225, z, 1.2, 0.001, 1.0, 'puddle');
  // ---------------- houses ----------------
  const placed: House[] = [];
  const place = (s: HouseSpec, x: number, z: number, rot: number) => { placed.push(new House(s, { x, z, rot }, ctx)); };
  const frontRow = (list: HouseSpec[], startX: number, dir: 1 | -1, side: 'S' | 'N') => {
    let cur = startX;
    for (const s of list) {
      const yd = s.yard;
      if (side === 'S') { const x0 = dir < 0 ? cur - s.W : cur; place(s, x0, 6 + yd, 0); cur += dir * s.W; }
      else { const xr = dir < 0 ? cur : cur + s.W; place(s, xr, -6 - yd, Math.PI); cur += dir * s.W; }
    }
    return cur;
  };
  const sw: HouseSpec[] = [
    spec({ W: 4.4, floors: 3, ground: 'living', D: 15, well: true, cage: [2], flag: true, gb: true, solar: false, sign: ['Nhà 4B'] }),
    spec({ W: 4.0, floors: 2, style: 'french', ground: 'grocery', D: 14, sign: ['TẠP HÓA BÀ NĂM', 'Bia · Nước ngọt · Gạo · Mì tôm'], signBg: '#1f6b3a', signFg: '#fff6c0', shutterColor: '#b9b29d' }),
    spec({ W: 5.2, floors: 1, style: 'cap4', ground: 'living', D: 13, gb: true }),
    spec({ W: 3.8, floors: 3, ground: 'cafe', D: 15, well: true, solar: true, cage: [1, 2], sign: ['CÀ PHÊ CÓC', 'Cà phê phin · Trà đá · Sinh tố'], signBg: '#4a2c1c', signFg: '#ffd37a', shutterColor: '#7f8c8d' }),
    spec({ W: 4.6, floors: 2, ground: 'pho', D: 14, sign: ['PHỞ BÒ GIA TRUYỀN', 'Phở tái · Phở chín · Quẩy'], signBg: '#b3191a', signFg: '#ffe8a0', shutterColor: '#a9a28f', flag: true }),
  ];
  let ex = frontRow(sw, 8.5, -1, 'S');
  const lightFill = (n: number, from: number, dir: 1 | -1, side: 'S' | 'N') => {
    const ws = [4.2, 3.8, 4.6, 4.0, 4.4, 3.9, 4.5, 4.2, 4.0, 4.3, 3.7, 4.4];
    const list: HouseSpec[] = [];
    for (let i = 0; i < n; i++) {
      const st = i % 4 === 1 ? 'french' : 'modern';
      list.push(spec({ W: ws[(i * 5 + (side === 'N' ? 3 : 0)) % ws.length], floors: 2 + ((i + (side === 'N' ? 1 : 0)) % 3), style: st, lite: true, D: 14, ground: (['living', 'grocery', 'garage', 'cafe', 'repair'] as Ground[])[(i + hid) % 5], sign: i % 3 === 0 ? ['TẠP HÓA', 'Mở cửa cả ngày'] : undefined, cage: i % 2 ? [1] : undefined, flag: i % 4 === 2 }));
    }
    return frontRow(list, from, dir, side);
  };
  lightFill(6, ex, -1, 'S');
  frontRow([
    spec({ W: 4.2, floors: 4, ground: 'living', D: 15, well: true, flag: true, cage: [3] }),
    spec({ W: 3.9, floors: 2, style: 'french', ground: 'repair', D: 14, sign: ['SỬA XE MÁY ANH BA', 'Vá · Thay nhớt · Rửa xe'], signBg: '#1d3f7a', signFg: '#ffffff', shutterColor: '#7f8c8d' }),
    spec({ W: 4.8, floors: 3, ground: 'garage', D: 15, well: true, solar: true }),
  ], 11.5, 1, 'S');
  lightFill(5, 11.5 + 4.2 + 3.9 + 4.8, 1, 'S');
  const nx = frontRow([
    spec({ W: 4.2, floors: 3, ground: 'hair', D: 14, sign: ['CẮT TÓC NAM', 'Gội đầu · Cạo mặt · Uốn tóc'], signBg: '#0f3d6b', signFg: '#ffffff', shutterColor: '#b7b2a5', cage: [2] }),
    spec({ W: 4.0, floors: 2, style: 'french', ground: 'living', D: 14 }),
    spec({ W: 5.2, floors: 1, style: 'cap4', ground: 'living', D: 13, yard: 2.4 }),
    spec({ W: 4.4, floors: 3, ground: 'garage', D: 15, well: true, flag: true }),
    spec({ W: 4.0, floors: 3, ground: 'grocery', D: 14, sign: ['TẠP HÓA 24/7', 'Đại lý vé số · Thẻ cào'], signBg: '#e5b012', signFg: '#7a1010', shutterColor: '#8f9aa3', cage: [1, 2] }),
    spec({ W: 4.6, floors: 2, ground: 'living', D: 14, solar: true }),
  ], 34, -1, 'N');
  lightFill(6, nx, -1, 'N');
  lightFill(5, 34, 1, 'N');
  // alley houses
  const alleyW: HouseSpec[] = [
    spec({ W: 3.8, floors: 2, ground: 'living', D: 13 }), spec({ W: 4.2, floors: 3, ground: 'grocery', D: 13, sign: ['TẠP HÓA HẺM', 'Gần nhà ai cũng quen'], signBg: '#2a6d4a', signFg: '#fff3c0', shutterColor: '#a8a28f' }),
    spec({ W: 4.4, floors: 1, style: 'cap4', ground: 'living', D: 13, yard: 2.0 }), spec({ W: 4.0, floors: 3, ground: 'living', D: 13, cage: [2] }),
  ];
  const alleyE: HouseSpec[] = [
    spec({ W: 4.0, floors: 3, ground: 'living', D: 13, flag: true }), spec({ W: 3.8, floors: 2, style: 'french', ground: 'living', D: 13 }),
    spec({ W: 4.4, floors: 2, ground: 'cafe', D: 13, sign: ['QUÁN TRÀ ĐÁ', 'Trà đá · Nước mía · Hạt dưa'], signBg: '#2d5f2d', signFg: '#fff3a0', shutterColor: '#8f9aa3' }), spec({ W: 4.0, floors: 3, ground: 'living', D: 13, solar: true }),
  ];
  let cz = 24;
  for (const s of alleyW) { place(s, 8.5 - s.yard, cz, -Math.PI / 2); cz += s.W; }
  cz = 24;
  for (const s of alleyE) { cz += s.W; place(s, 11.5 + s.yard, cz, Math.PI / 2); }

  // ---------------- street furniture ----------------
  // street trees
  const tree = (x: number, z: number, s = 1, seed = 1) => {
    NB.lathe('woodP:#5b4634', [[0.26 * s, 0], [0.17 * s, 0.3 * s], [0.12 * s, 1.6 * s], [0.09 * s, 2.8 * s], [0.05 * s, 3.5 * s]], x, 0.15, z, 10); NB.col(x - 0.18, 0.15, z - 0.18, 0.36, 3, 0.36);
    for (let i = 0; i < 5; i++) { const an = i * 1.26 + r() * 0.6, tl = 0.55 + r() * 0.35, ln = 2.0 * s; NB.geo('woodP:#5b4634', new THREE.CylinderGeometry(0.05 * s, 0.11 * s, ln, 6), x + Math.cos(an) * 0.2 * s, 0.15 + 2.6 * s, z + Math.sin(an) * 0.2 * s, Math.sin(an) * tl * 0.85, 0, -Math.cos(an) * tl * 0.85); }
    for (let i = 0; i < 7; i++) NB.leaves(x + (r() - 0.5) * 3.2 * s, 4.3 * s + r() * 1.3, z + (r() - 0.5) * 2.6 * s, 1.5 * s, 40, i % 3 ? 'leaf:green' : 'leaf:dark', seed * 10 + i, 1.35);
  };
  [-46, -33, -20, -7, 6, 20, 46, 58].forEach((x, i) => tree(x, -4.1, 1, i + 1));
  [-40, -16, 36].forEach((x, i) => tree(x, 3.95, 0.85, 20 + i));
  // banyan in the courtyard
  const bx = 3.2, bz = 46.5;
  NB.cyl(bx, 0.02, bz, 0.55, 5.2, 'woodP:#5a4a3c', 10, 0.38); NB.col(bx - 0.6, 0.02, bz - 0.6, 1.2, 4.5, 1.2);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; NB.cyl(bx + Math.cos(a) * 0.7, 0.02, bz + Math.sin(a) * 0.7, 0.12, 3.4, 'woodP:#6a5a48', 6, 0.05); }
  for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = 1 + r() * 4; NB.leaves(bx + Math.cos(a) * d, 5.6 + r() * 2, bz + Math.sin(a) * d, 2.4, 50, 'leaf:banyan', 200 + i, 1.5); }
  for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 1.5 + r() * 3.5; NB.cyl(bx + Math.cos(a) * d, 2.4 + r(), bz + Math.sin(a) * d, 0.012, 3 + r() * 1.5, 'woodP:#5a4a3c', 4); }
  NB.cyl(bx, 0.02, bz, 1.4, 0.4, 'conc:#9a968c', 14); // base ring
  // shrine (miếu nhỏ) at the courtyard end
  const sx = 14.0, sz = 50.6;
  NB.box(sx - 1.1, 0, sz - 0.6, 2.2, 0.35, 1.5, 'conc:#a8a396'); NB.box(sx - 0.9, 0.35, sz - 0.4, 1.8, 1.4, 1.1, 'px:#c9b27a');
  NB.box(sx - 0.45, 0.35, sz + 0.6 - 0.02, 0.9, 1.1, 0.02, 'r:#2a1510'); NB.box(sx - 0.38, 0.5, sz + 0.5, 0.76, 0.3, 0.1, 'woodF:#6e2418');
  NB.quad('roof', [sx - 1.25, 1.65, sz + 0.95], [sx + 1.25, 1.65, sz + 0.95], [sx + 1.1, 2.4, sz + 0.1], [sx - 1.1, 2.4, sz + 0.1]);
  NB.quad('roof', [sx + 1.25, 1.65, sz - 0.65], [sx - 1.25, 1.65, sz - 0.65], [sx - 1.1, 2.4, sz + 0.1], [sx + 1.1, 2.4, sz + 0.1]);
  NB.box(sx - 1.2, 1.6, sz - 0.65, 2.4, 0.08, 1.6, 'px:#7a2418', { py: null });
  NB.col(sx - 1.1, 0, sz - 0.6, 2.2, 2.4, 1.5);
  for (let i = 0; i < 3; i++) NB.cyl(sx - 0.3 + i * 0.3, 0.85, sz + 0.62, 0.04, 0.22, 'g:#e8b02a', 8, 0.05);
  NB.box(sx - 1.4, 0.0, sz + 1.0, 0.4, 0.5, 0.4, 'conc:#a8a396'); NB.cyl(sx - 1.2, 0.5, sz + 1.2, 0.12, 0.2, 'm:#c9a24b', 10);
  // courtyard walls
  const wallBox = (x: number, z: number, w: number, d: number, hgt = 2.3) => { NB.box(x, 0, z, w, hgt, d, 'px:#d8cfb8'); NB.col(x, 0, z, w, hgt, d); };
  wallBox(-4.8, 40.4, 0.25, 13); wallBox(23.6, 40.4, 0.25, 13); wallBox(-4.8, 52.9, 28.7, 0.25);
  for (let i = 0; i < 16; i++) NB.leaves(-4.6 + i * 1.8, 2.2, 52.6, 0.7, 10, 'leaf:' + (i % 3 === 0 ? 'bougain' : 'dark'), 300 + i, 1.2);
  for (let i = 0; i < 6; i++) NB.leaves(-4.5, 2.1, 41 + i * 2, 0.6, 8, 'leaf:green', 340 + i, 1.1);
  // wall behind alley houses: close the gap between alley house rows and the courtyard
  wallBox(8.4, 40.3, 0.1, 0.1, 0.01);

  // poles & wires
  const wires: THREE.BufferGeometry[] = [];
  const wire = (a: THREE.Vector3, b: THREE.Vector3, sag = 0.5, rad = 0.011) => {
    const m = a.clone().lerp(b, 0.5); m.y -= sag;
    wires.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m.clone().setY(m.y - sag * 0.0), b), 14, rad, 4, false));
  };
  const polesX = [-54, -36, -18, 0, 18, 36, 54], polePos: THREE.Vector3[] = [];
  polesX.forEach((x, i) => {
    const z = 3.95;
    NB.cyl(x, 0, z, 0.14, 8.6, 'conc:#9a968c', 8, 0.1); NB.col(x - 0.14, 0, z - 0.14, 0.28, 3, 0.28);
    NB.box(x - 0.04, 7.9, z - 1.0, 0.08, 0.1, 2.0, 'woodF:#5a4a3a'); NB.box(x - 0.04, 7.1, z - 0.7, 0.08, 0.1, 1.4, 'woodF:#5a4a3a');
    for (const dz of [-0.9, -0.3, 0.3, 0.9]) NB.cyl(x, 8.0, z + dz, 0.025, 0.1, 'g:#d8d4c8', 6);
    polePos.push(new THREE.Vector3(x, 8.0, z));
    // street lamp arm
    NB.box(x - 0.03, 7.5, z - 1.7, 0.06, 0.06, 1.7, 'm:#555'); NB.box(x - 0.2, 7.42, z - 2.1, 0.4, 0.06, 0.6, 'm:#444'); NB.box(x - 0.15, 7.38, z - 2.0, 0.3, 0.03, 0.4, 'emit:#ffd9a0');
    ctx.lamps.push(new THREE.Vector3(x, 7.2, z - 1.9));
    if (i % 3 === 1) { NB.cyl(x + 0.3, 5.4, z, 0.22, 0.6, 'm:#7a7f84', 12); NB.cyl(x - 0.3, 5.4, z, 0.22, 0.6, 'm:#7a7f84', 12); NB.box(x - 0.5, 5.1, z - 0.2, 1.0, 0.1, 0.4, 'm:#555'); }
    for (let k = 0; k < 3; k++) NB.box(x - 0.03, 2.0 + k * 0.9, z + 0.1, 0.06, 0.4, 0.04, 'r:#222'); // boxes/clamps
    // fibre-optic junction box
    NB.box(x + 0.12, 3.2, z - 0.1, 0.3, 0.5, 0.2, 'g:#3a4a3a');
  });
  for (let i = 0; i < polePos.length - 1; i++) {
    const a = polePos[i], b = polePos[i + 1];
    for (let k = 0; k < 6; k++) { const dz = (k - 2.5) * 0.35; wire(a.clone().add(new THREE.Vector3(0, -k * 0.15 - (k > 3 ? 0.7 : 0), dz)), b.clone().add(new THREE.Vector3(0, -k * 0.15 - (k > 3 ? 0.7 : 0), dz)), 0.45 + r() * 0.3); }
    for (let k = 0; k < 5; k++) { const p0 = a.clone().add(new THREE.Vector3(0, -2.4 - r(), -0.2)); const p1 = b.clone().add(new THREE.Vector3(0, -2.4 - r(), 0.2)); wire(p0, p1, 0.6 + r() * 0.5, 0.016); }
  }
  // service drops from poles to house facades (the characteristic tangle)
  const addDrops = (h: House) => {
    const sideSouth = h.rot === 0, wz = sideSouth ? 5.8 : -5.8, top = h.F(h.n - 1) + 2.2;
    const fx = h.wp(h.W * 0.5, 0, 0).x;
    const pole = polePos.reduce((p, q) => (Math.abs(q.x - fx) < Math.abs(p.x - fx) ? q : p));
    for (let k = 0; k < 2; k++) {
      const tgt = new THREE.Vector3(fx + (k - 0.5) * 1.4, Math.min(top, 6 + k * 1.5 + r()), wz);
      wire(pole.clone().add(new THREE.Vector3(0, -0.2 - k * 0.5, 0)), tgt, 0.7 + r() * 0.5, 0.009);
    }
  };
  placed.filter((h) => (h.rot === 0 || Math.abs(h.rot - Math.PI) < 0.01)).forEach(addDrops);
  // hanging bulbs along the alley
  for (const z of [9, 15, 21, 27, 33, 39, 44]) {
    NB.cyl(10 + (z % 2 ? 0.2 : -0.2), 4.9, z, 0.004, 1.2, 'r:#111', 4); NB.cyl(10 + (z % 2 ? 0.2 : -0.2), 4.78, z, 0.09, 0.12, 'emit:#ffe2a8', 10, 0.04);
    ctx.lamps.push(new THREE.Vector3(10, 4.7, z));
  }
  // alley wire clutter
  for (let z = 7; z < 40; z += 2.6) for (let k = 0; k < 2; k++) {
    wire(new THREE.Vector3(8.5, 3.6 + r() * 3.5, z + r()), new THREE.Vector3(11.5, 3.6 + r() * 3.5, z + r()), 0.25 + r() * 0.25, 0.008);
  }
  for (let z = 8; z < 40; z += 6) wire(new THREE.Vector3(10, 6.6, z), new THREE.Vector3(10, 6.8, z + 6), 0.5, 0.01);
  if (wires.length) {
    const g = mergeGeometries(wires.map((w) => { const q = w.toNonIndexed(); q.deleteAttribute('uv'); return q; }), false)!;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.7 }));
    m.castShadow = true; ctx.root.add(m);
  }

  // parked motorbikes & seating in front of the houses
  const cols = ['#c92f2a', '#2a5aa0', '#222222', '#e8e6e0', '#3a7a4a', '#d8a92a', '#7a2a2a'];
  for (const h of placed.filter((q) => !q.spec.lite && (q.rot === 0 || Math.abs(q.rot - Math.PI) < 0.01))) {
    const south = h.rot === 0, sgn = south ? 1 : -1, z = sgn * 4.9;
    const x0 = south ? h.ox : h.ox - h.W;
    const shops = ['grocery', 'cafe', 'pho', 'repair', 'hair'].includes(h.spec.ground);
    const nb = shops ? 1 + Math.floor(r() * 2) : Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) F.motorbike(NB, x0 + 0.8 + i * 1.0 + r() * 0.3, 0.15, z + sgn * (h.yardD > 0 ? 0 : r() * 0.2), south ? Math.PI : 0, cols[Math.floor(r() * cols.length)]);
    if (h.spec.ground === 'cafe' || h.spec.ground === 'pho') {
      const cx = x0 + h.W / 2;
      for (let i = 0; i < 2; i++) { const tx = cx - 1 + i * 1.5, tz = sgn * 4.5; F.lowTable(NB, tx, 0.15, tz, i ? '#e8b02a' : '#3b78d6'); F.stool(NB, tx - 0.5, 0.15, tz, '#d9382a'); F.stool(NB, tx + 0.5, 0.15, tz, '#2a9fd6'); F.stool(NB, tx, 0.15, tz + sgn * 0.5, '#e8c02a'); }
    }
    if (h.spec.ground === 'repair') { for (let i = 0; i < 4; i++) NB.cyl(x0 + 0.5, 0.15 + i * 0.2, sgn * 5.35, 0.3, 0.2, 'r:#1a1a1a', 14); F.motorbike(NB, x0 + 2.2, 0.15, sgn * 4.6, south ? Math.PI * 0.8 : Math.PI * 1.8, '#3a3a3e'); }
    if (h.spec.ground === 'grocery') { NB.box(x0 + h.W - 0.8, 0.15, sgn * 5.0 - 0.4, 0.8, 0.9, 0.8, 'g:#e8ecee'); NB.col(x0 + h.W - 0.8, 0.15, sgn * 5.0 - 0.4, 0.8, 0.9, 0.8); for (let i = 0; i < 5; i++) NB.cyl(x0 + 0.5 + i * 0.3, 0.15, sgn * 5.4, 0.12, 0.7, ['g:#2f6fc0', 'g:#d6362a', 'g:#2f9a52', 'g:#f2c230', 'g:#e87a2a'][i], 8); }
    // bins
    if (r() < 0.5) { NB.cyl(x0 + h.W - 0.4, 0.15, sgn * 3.95, 0.25, 0.75, 'g:#2f6a45', 12); NB.col(x0 + h.W - 0.65, 0.15, sgn * 3.95 - 0.25, 0.5, 0.75, 0.5); }
  }
  // alley props
  for (let z = 8; z < 40; z += 2.7) {
    const side = Math.floor(z * 3) % 2 ? 8.72 : 11.28;
    if (r() < 0.65) { NB.cyl(side, 0.02, z + r(), 0.2, 0.35, ['g:#b5532e', 'g:#d8d0c0', 'g:#3d6a8a'][Math.floor(r() * 3)], 10, 0.24); NB.leaves(side, 0.7, z, 0.4, 14, 'leaf:' + (r() < 0.4 ? 'dark' : 'green'), Math.floor(r() * 999)); NB.col(side - 0.22, 0.02, z - 0.2, 0.44, 0.5, 0.44); }
  }
  F.motorbike(NB, 9.0, 0.02, 14.5, 0, '#c92f2a'); F.motorbike(NB, 11.05, 0.02, 20, Math.PI, '#2a5aa0'); F.motorbike(NB, 9.0, 0.02, 31.4, 0.02, '#e8e6e0');
  for (let i = 0; i < 3; i++) F.stool(NB, 10.7 + (i % 2) * 0.1, 0.02, 37 + i * 0.6, ['#d9382a', '#2a9fd6', '#e8c02a'][i]);
  F.lowTable(NB, 17.5, 0.02, 47.5, '#3b78d6'); F.stool(NB, 17.0, 0.02, 47.5, '#d9382a'); F.stool(NB, 18.0, 0.02, 47.5, '#2a9fd6'); F.stool(NB, 17.5, 0.02, 48.1, '#e8c02a');
  F.lowTable(NB, 19.2, 0.02, 45.5, '#e8b02a'); F.stool(NB, 19.2, 0.02, 46.1, '#2a9fd6'); F.stool(NB, 18.6, 0.02, 45.5, '#d9382a');
  // tea stall kettle + ice bucket
  NB.box(20.2, 0.02, 44.7, 1.4, 0.8, 0.6, 'woodF:#7a5a3a'); NB.col(20.2, 0.02, 44.7, 1.4, 0.9, 0.6); NB.cyl(20.6, 0.82, 45.0, 0.12, 0.2, 'm:#b8bcc0', 12); NB.cyl(21.0, 0.82, 45.0, 0.16, 0.3, 'g:#2a9fd6', 12);
  NB.quad('cloth:#d03a2a', [19.8, 2.4, 44.1], [21.8, 2.4, 44.1], [21.8, 2.1, 46.1], [19.8, 2.1, 46.1]);
  NB.cyl(19.8, 0.02, 44.1, 0.03, 2.4, 'm:#777', 6); NB.cyl(21.8, 0.02, 44.1, 0.03, 2.4, 'm:#777', 6);
  // bánh mì cart
  const cart = (x: number, z: number, yaw: number) => {
    NB.push(x, 0.15, z, yaw);
    NB.box(-0.7, 0.4, -0.4, 1.4, 0.55, 0.8, 'woodF:#c4a070'); NB.box(-0.7, 0.95, -0.4, 1.4, 0.7, 0.8, 'glass'); NB.box(-0.72, 0.95, -0.42, 1.44, 0.04, 0.84, 'm:#9aa0a5'); NB.box(-0.72, 1.65, -0.42, 1.44, 0.04, 0.84, 'm:#9aa0a5');
    for (let i = 0; i < 7; i++) NB.cyl(-0.55 + i * 0.18, 1.0, 0.0, 0.07, 0.25, 'g:#d9a55a', 8, 0.05);
    for (const s of [-1, 1]) { NB.push(s * 0.62, 0.0, 0, 0, 0, Math.PI / 2); NB.cyl(0.0, -0.02, 0, 0.3, 0.05, 'r:#1b1b1b', 14); NB.pop(); }
    NB.cyl(0.4, 1.65, 0.0, 0.025, 1.0, 'm:#888', 6); NB.cyl(0.4, 2.35, 0.0, 1.0, 0.3, 'cloth:#d03a2a', 14, 0.05);
    NB.col(-0.75, 0, -0.45, 1.5, 1.7, 0.9); NB.pop();
  };
  // The cart near the spawn is the authored banh mi cart (streetProps.ts); only the far one is procedural.
  cart(24.5, 4.7, Math.PI * 0.9);
  // drain covers & manholes on the road
  for (let x = -60; x < 60; x += 17) { NB.cyl(x + 3, 0.0, -2.7, 0.35, 0.012, 'm:#4a4a4e', 16); NB.cyl(x - 4, 0.0, 2.6, 0.35, 0.012, 'm:#4a4a4e', 16); }
  // street name signs
  const nameSign = (x: number, z: number, lines: string[], yaw: number) => {
    NB.cyl(x, 0.15, z, 0.035, 2.6, 'm:#666', 6); makeSign({ group: ctx.root, ctx } as unknown as House, lines, '#1b5fb0', '#ffffff', x, 2.55, z + (yaw === 0 ? 0.05 : -0.05), 0.9, 0.3, yaw, { res: 512, glow: 0.2 });
  };
  nameSign(7.6, 3.9, ['ĐƯỜNG HOA PHƯỢNG'], 0); nameSign(12.4, 3.9, ['HẺM 12'], 0);
  void mat;
  NB.build(ctx.root);
  for (const c of NB.cols) ctx.phys.addCol(c);
  for (const s of NB.surfs) ctx.phys.addSurf(s);
  // distant skyline
  const sky = new Builder();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, d = 140 + r() * 80, w = 14 + r() * 20, hgt = 25 + r() * 70;
    sky.box(Math.cos(a) * d * 1.3, 0, Math.sin(a) * d * 0.9, w, hgt, w, 'px:' + ['#b9b4a6', '#a9aeb0', '#c8bfae', '#9da3a8'][i % 4], { ny: null });
    for (let k = 0; k < Math.floor(hgt / 6); k++) sky.box(Math.cos(a) * d * 1.3 + 1, 5 + k * 6, Math.sin(a) * d * 0.9 - 0.05, w - 2, 2.2, 0.1, 'emit:#ffd79a');
  }
  sky.build(ctx.root, { shadows: false });
  return placed;
}
