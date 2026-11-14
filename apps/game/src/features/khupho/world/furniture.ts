import * as THREE from 'three';
import type { Builder } from './builder';

const PI = Math.PI;
export const cl = (b: Builder, x: number, y: number, z: number, yaw: number, fn: () => void) => { b.push(x, y, z, yaw); fn(); b.pop(); };

/** 3-seat sofa. origin = footprint centre, front = +z */
export function sofa(b: Builder, x: number, y: number, z: number, yaw: number, color = '#6f7a86', w = 1.9) {
  cl(b, x, y, z, yaw, () => {
    const f = 'cloth:' + color, d = 0.85;
    b.box(-w / 2, 0.08, -d / 2, w, 0.3, d, f); b.box(-w / 2, 0.38, -d / 2, w, 0.5, 0.2, f);
    b.box(-w / 2, 0.08, -d / 2, 0.2, 0.55, d, f); b.box(w / 2 - 0.2, 0.08, -d / 2, 0.2, 0.55, d, f);
    for (let i = 0; i < 3; i++) b.box(-w / 2 + 0.2 + i * (w - 0.4) / 3 + 0.01, 0.38, -d / 2 + 0.2, (w - 0.4) / 3 - 0.02, 0.12, d - 0.22, f);
    for (const sx of [-w / 2 + 0.05, w / 2 - 0.25]) b.box(sx, 0, -d / 2 + 0.05, 0.2, 0.08, 0.2, 'woodF:#4a3020'), b.box(sx, 0, d / 2 - 0.25, 0.2, 0.08, 0.2, 'woodF:#4a3020');
    b.box(-w / 2 + 0.3, 0.5, -d / 2 + 0.2, 0.4, 0.4, 0.12, 'cloth:#d8b45a');
    b.col(-w / 2, 0, -d / 2, w, 0.9, d); b.contact(0, 0, w, d, y);
  });
}
export function coffeeTable(b: Builder, x: number, y: number, z: number, yaw: number, w = 0.9, d = 0.5) {
  cl(b, x, y, z, yaw, () => {
    b.box(-w / 2, 0.38, -d / 2, w, 0.04, d, 'woodF:#5a3a24'); b.box(-w / 2 + 0.04, 0.4, -d / 2 + 0.04, w - 0.08, 0.005, d - 0.08, 'glass');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - 0.05) - 0.025, 0, sz * (d / 2 - 0.05) - 0.025, 0.05, 0.38, 0.05, 'woodF:#4a3020');
    b.box(-w / 2 + 0.05, 0.14, -d / 2 + 0.05, w - 0.1, 0.02, d - 0.1, 'woodF:#4a3020');
    b.cyl(0.1, 0.42, 0, 0.05, 0.1, 'g:#e8e3d6', 10); b.cyl(-0.2, 0.42, 0.05, 0.04, 0.07, 'g:#3a6ea5', 10);
    b.col(-w / 2, 0, -d / 2, w, 0.42, d); b.contact(0, 0, w, d, y);
  });
}
export function bed(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.6, l = 2.0, blanket = '#6c8fb0') {
  cl(b, x, y, z, yaw, () => { // head at -z
    b.box(-w / 2 - 0.04, 0.12, -l / 2, w + 0.08, 0.22, l, 'woodF:#6a4a30');
    b.box(-w / 2, 0.34, -l / 2 + 0.03, w, 0.2, l - 0.06, 'cloth:#f1eee6');
    b.box(-w / 2 - 0.04, 0.0, -l / 2 - 0.08, w + 0.08, 1.0, 0.08, 'woodF:#6a4a30');
    for (const sx of [-w / 4, w / 4]) b.box(sx - 0.3, 0.54, -l / 2 + 0.1, 0.6, 0.14, 0.38, 'cloth:#fbfaf6');
    b.box(-w / 2 - 0.01, 0.52, -l / 2 + 0.55, w + 0.02, 0.07, l - 0.6, 'cloth:' + blanket);
    b.box(-w / 2 - 0.01, 0.3, -l / 2 + 0.55, w + 0.02, 0.24, 0.05, 'cloth:' + blanket);
    b.box(-w / 2, 0.52, 0.2, w, 0.075, 0.35, 'cloth:#e9e3d2');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - 0.03) - 0.03, 0, sz * (l / 2 - 0.05) - 0.03, 0.06, 0.12, 0.06, 'woodF:#4a3020');
    b.col(-w / 2 - 0.05, 0, -l / 2 - 0.08, w + 0.1, 0.65, l + 0.08); b.contact(0, 0, w + 0.2, l + 0.2, y);
  });
}
export function nightstand(b: Builder, x: number, y: number, z: number, yaw: number) {
  cl(b, x, y, z, yaw, () => {
    b.box(-0.2, 0, -0.18, 0.4, 0.5, 0.36, 'woodF:#7a5535'); b.box(-0.17, 0.28, 0.18, 0.34, 0.16, 0.012, 'woodP:#8a6340'); b.box(-0.17, 0.08, 0.18, 0.34, 0.16, 0.012, 'woodP:#8a6340');
    b.box(-0.03, 0.34, 0.2, 0.06, 0.02, 0.02, 'm:#c9a24b');
    b.cyl(0.06, 0.5, 0, 0.07, 0.03, 'm:#8b6b3a', 10); b.cyl(0.06, 0.53, 0, 0.012, 0.22, 'm:#8b6b3a', 6); b.cyl(0.06, 0.74, 0, 0.1, 0.16, 'emit:#ffd9a0', 12, 0.07);
    b.col(-0.2, 0, -0.18, 0.4, 0.5, 0.36);
  });
}
export function wardrobe(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.7, d = 0.58, hgt = 2.2) {
  cl(b, x, y, z, yaw, () => {
    b.box(-w / 2, 0, -d / 2, w, hgt, d, 'woodF:#a67c52', { pz: null });
    const n = Math.max(2, Math.round(w / 0.55)), dw = w / n;
    for (let i = 0; i < n; i++) { b.box(-w / 2 + i * dw + 0.012, 0.05, d / 2 - 0.004, dw - 0.024, hgt - 0.1, 0.02, 'woodP:#b48a5c'); b.box(-w / 2 + i * dw + (i % 2 ? 0.06 : dw - 0.08), hgt * 0.5, d / 2 + 0.016, 0.02, 0.2, 0.02, 'm:#c8c8c8'); }
    b.col(-w / 2, 0, -d / 2, w, hgt, d); b.contact(0, 0.05, w, d, y);
  });
}
export function desk(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.2, withPc = true) {
  cl(b, x, y, z, yaw, () => { // user sits at +z side looking -z
    const d = 0.6;
    b.box(-w / 2, 0.72, -d / 2, w, 0.035, d, 'woodF:#8f6b47');
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.03) - 0.03, 0, -d / 2 + 0.03, 0.06, 0.72, d - 0.06, 'woodF:#7a5a3a');
    b.box(-w / 2 + 0.1, 0.52, -d / 2 + 0.04, w - 0.2, 0.2, d - 0.1, 'woodF:#7a5a3a', { pz: null });
    if (withPc) {
      b.box(-0.22, 0.755, -0.12, 0.44, 0.27, 0.025, 'r:#0e0e10'); b.box(-0.2, 0.775, -0.108, 0.4, 0.23, 0.003, 'emit:#6aa8ff'); b.box(-0.04, 0.755, -0.12, 0.08, 0.1, 0.06, 'r:#0e0e10');
      b.box(-0.18, 0.755, 0.08, 0.36, 0.012, 0.13, 'r:#222'); b.box(0.25, 0.755, 0.12, 0.06, 0.02, 0.1, 'r:#222');
    }
    b.box(-w / 2 + 0.05, 0.755, -d / 2 + 0.05, 0.14, 0.2, 0.2, 'g:#d8d2c0');
    b.col(-w / 2, 0, -d / 2, w, 0.8, d);
    // chair
    b.cyl(0, 0.05, 0.62, 0.22, 0.02, 'r:#2a2a2a', 5); b.cyl(0, 0.07, 0.62, 0.025, 0.36, 'm:#333', 6); b.box(-0.22, 0.43, 0.42, 0.44, 0.07, 0.42, 'cloth:#3d4a5c'); b.box(-0.21, 0.5, 0.78, 0.42, 0.5, 0.07, 'cloth:#3d4a5c');
    b.contact(0, 0.2, w, d + 0.6, y);
  });
}
export function bookshelf(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.2, hgt = 2.0) {
  cl(b, x, y, z, yaw, () => {
    const d = 0.3;
    b.box(-w / 2, 0, -d / 2, 0.03, hgt, d, 'woodF:#7a5a3a'); b.box(w / 2 - 0.03, 0, -d / 2, 0.03, hgt, d, 'woodF:#7a5a3a'); b.box(-w / 2, 0, -d / 2, w, hgt, 0.02, 'woodF:#6a4a2a');
    const cols = ['#a63a2e', '#2e5ea6', '#d8b44a', '#3a7a4a', '#eee', '#7a3a8a', '#333', '#c76d2b'];
    for (let i = 0; i <= 5; i++) {
      const yy = i * (hgt - 0.03) / 5; b.box(-w / 2, yy, -d / 2, w, 0.03, d, 'woodF:#7a5a3a');
      if (i < 5) { let xx = -w / 2 + 0.05; let s = i * 7 + 3; while (xx < w / 2 - 0.1) { s = (s * 31 + 11) % 97; const bw = 0.025 + (s % 5) * 0.008, bh = 0.18 + (s % 7) * 0.02; b.box(xx, yy + 0.03, -d / 2 + 0.04, bw, bh, d - 0.08, 'r:' + cols[s % cols.length]); xx += bw + 0.004; } }
    }
    b.col(-w / 2, 0, -d / 2, w, hgt, d);
  });
}
export function tvCabinet(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.5) {
  cl(b, x, y, z, yaw, () => {
    const d = 0.4;
    b.box(-w / 2, 0.08, -d / 2, w, 0.4, d, 'woodF:#4b3322'); b.box(-w / 2 + 0.03, 0.1, d / 2 - 0.002, w / 2 - 0.05, 0.36, 0.012, 'woodP:#5c4029'); b.box(0.02, 0.1, d / 2 - 0.002, w / 2 - 0.05, 0.36, 0.012, 'woodP:#5c4029');
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.05) - 0.02, 0, -d / 2 + 0.04, 0.04, 0.08, 0.04, 'm:#222'), b.box(sx * (w / 2 - 0.05) - 0.02, 0, d / 2 - 0.08, 0.04, 0.08, 0.04, 'm:#222');
    b.box(-0.45, 0.48, 0.0, 0.3, 0.04, 0.2, 'r:#1a1a1a'); b.box(0.3, 0.48, 0.0, 0.2, 0.05, 0.14, 'r:#202020');
    b.col(-w / 2, 0, -d / 2, w, 0.5, d); b.contact(0, 0, w, d, y);
  });
}
export function altarTable(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.1, tall = true) {
  cl(b, x, y, z, yaw, () => { // tall lacquered cabinet altar, front +z
    const d = 0.48;
    b.box(-w / 2, 0, -d / 2, w, 0.85, d, 'woodF:#6e2418'); b.box(-w / 2 - 0.03, 0.85, -d / 2 - 0.02, w + 0.06, 0.05, d + 0.06, 'woodF:#4e180f');
    for (let i = 0; i < 2; i++) b.box(-w / 2 + 0.05 + i * (w / 2), 0.07, d / 2 - 0.003, w / 2 - 0.1, 0.7, 0.014, 'woodP:#8a3426'), b.box(-w / 2 + 0.1 + i * (w / 2), 0.12, d / 2 + 0.01, w / 2 - 0.2, 0.6, 0.004, 'emit:#d4a02a');
    if (tall) {
      b.box(-w / 2, 0.9, -d / 2, w, 0.9, 0.04, 'woodF:#6e2418'); b.box(-w / 2, 0.9, -d / 2, 0.04, 0.9, d, 'woodF:#6e2418'); b.box(w / 2 - 0.04, 0.9, -d / 2, 0.04, 0.9, d, 'woodF:#6e2418');
      b.box(-w / 2, 1.8, -d / 2, w, 0.05, d, 'woodF:#4e180f');
      b.box(-0.2, 1.05, -d / 2 + 0.05, 0.4, 0.55, 0.012, 'g:#1a1a1a'); b.box(-0.17, 1.08, -d / 2 + 0.06, 0.34, 0.49, 0.004, 'r:#9a8f80');
      b.box(-0.2, 1.62, -d / 2 + 0.05, 0.4, 0.04, 0.02, 'emit:#ff2a1a');
      b.box(-w / 2 + 0.06, 0.9, 0.0, 0.05, 0.3, 0.05, 'emit:#ff4020', {}); b.box(w / 2 - 0.11, 0.9, 0.0, 0.05, 0.3, 0.05, 'emit:#ff4020');
    }
    b.cyl(0.32, 0.9, 0.05, 0.07, 0.03, 'm:#c9a24b', 12); b.cyl(-0.32, 0.9, 0.05, 0.07, 0.03, 'm:#c9a24b', 12);
    b.cyl(0.0, 0.9, 0.1, 0.1, 0.12, 'g:#e9e1c8', 14, 0.12);
    b.cyl(0, 1.02, 0.1, 0.1, 0.02, 'g:#d8442a', 10);
    for (let i = 0; i < 4; i++) b.cyl(-0.16 + i * 0.1, 1.04, 0.1, 0.045, 0.06, ['g:#e8b02a', 'g:#d8442a', 'g:#79a63a', 'g:#e8b02a'][i], 8);
    b.col(-w / 2, 0, -d / 2, w, tall ? 1.8 : 0.9, d); b.contact(0, 0, w, d, y);
  });
}
export function counter(b: Builder, x: number, y: number, z: number, yaw: number, len: number, depth = 0.6, hgt = 0.86, top = 'tile:#3b3b3d', body = 'woodF:#cfc7b8') {
  cl(b, x, y, z, yaw, () => { // front = +z, centered on length
    b.box(-len / 2, 0.08, -depth / 2, len, hgt - 0.08, depth, body, { py: null });
    b.box(-len / 2, 0, -depth / 2 + 0.05, len, 0.08, depth - 0.1, 'r:#222');
    b.box(-len / 2 - 0.01, hgt, -depth / 2 - 0.01, len + 0.02, 0.035, depth + 0.04, top);
    for (let i = 0; i < Math.floor(len / 0.5); i++) { b.box(-len / 2 + i * 0.5 + 0.02, 0.1, depth / 2 - 0.002, 0.46, hgt - 0.14, 0.014, 'woodP:#ddd5c4'); b.box(-len / 2 + i * 0.5 + 0.2, hgt - 0.14, depth / 2 + 0.01, 0.1, 0.014, 0.014, 'm:#aaa'); }
    b.col(-len / 2, 0, -depth / 2, len, hgt + 0.04, depth);
  });
}
export function sinkUnit(b: Builder, x: number, y: number, z: number, yaw: number) {
  cl(b, x, y, z, yaw, () => {
    b.box(-0.3, 0.88, -0.2, 0.6, 0.008, 0.4, 'm:#cfd3d6'); b.box(-0.27, 0.8, -0.17, 0.54, 0.08, 0.34, 'r:#1f1f20', { py: 'm:#aab0b4' });
    b.box(-0.27, 0.8, 0.17, 0.0, 0, 0, 'm:#000');
    b.box(0.3, 0.88, -0.2, 0.3, 0.008, 0.4, 'm:#cfd3d6');
    for (let i = 0; i < 4; i++) b.box(0.32 + i * 0.065, 0.89, -0.15, 0.012, 0.01, 0.3, 'm:#cfd3d6');
  });
}
export function diningTable(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.2, d = 0.72, chairs = 4) {
  cl(b, x, y, z, yaw, () => {
    b.box(-w / 2, 0.72, -d / 2, w, 0.04, d, 'woodF:#7f5a3a'); b.box(-w / 2 + 0.01, 0.76, -d / 2 + 0.01, w - 0.02, 0.003, d - 0.02, 'r:#f0e6cf');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (w / 2 - 0.06) - 0.03, 0, sz * (d / 2 - 0.06) - 0.03, 0.06, 0.72, 0.06, 'woodF:#6a4a2e');
    // mâm cơm
    b.cyl(0, 0.762, 0, 0.27, 0.02, 'm:#b8bcc0', 20);
    const dish = ['g:#f1ede2', 'g:#e8e1d0'];
    b.cyl(0.0, 0.782, 0.0, 0.1, 0.06, 'g:#e9e5da', 14); b.cyl(0, 0.84, 0, 0.09, 0.012, 'g:#f6f4ee', 14);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; b.cyl(Math.cos(a) * 0.18, 0.782, Math.sin(a) * 0.18, 0.065, 0.03, dish[i % 2], 12); b.cyl(Math.cos(a) * 0.18, 0.81, Math.sin(a) * 0.18, 0.055, 0.008, ['g:#8aa84a', 'g:#c4622d', 'g:#d9b45a', 'g:#a33a2a'][i], 10); }
    for (let i = 0; i < 4; i++) { const sx = i < 2 ? -0.4 : 0.4, sz = i % 2 ? 0.2 : -0.2; b.cyl(sx, 0.762, sz, 0.055, 0.045, 'g:#f4f2ea', 10, 0.07); b.box(sx - 0.1, 0.765, sz + 0.1, 0.2, 0.005, 0.01, 'woodP:#b8905f'); }
    b.col(-w / 2, 0, -d / 2, w, 0.8, d); b.contact(0, 0, w, d, y);
    const ch = (cx: number, cz: number, ry: number) => cl(b, cx, 0, cz, ry, () => {
      b.box(-0.2, 0.44, -0.2, 0.4, 0.04, 0.4, 'cloth:#8a3a2a'); b.box(-0.2, 0.48, -0.2, 0.4, 0.46, 0.04, 'woodF:#6a4a2e');
      for (const a of [-1, 1]) for (const c of [-1, 1]) b.box(a * 0.17 - 0.015, 0, c * 0.17 - 0.015, 0.03, 0.44, 0.03, 'woodF:#6a4a2e');
      b.col(-0.2, 0, -0.2, 0.4, 0.5, 0.4);
    });
    if (chairs >= 2) { ch(0, d / 2 + 0.3, PI); ch(0, -d / 2 - 0.3, 0); }
    if (chairs >= 4) { ch(w / 2 + 0.28, 0, -PI / 2); ch(-w / 2 - 0.28, 0, PI / 2); }
  });
}
export function stool(b: Builder, x: number, y: number, z: number, color = '#d9382a') {
  b.cyl(x, y + 0.2, z, 0.17, 0.035, 'g:' + color, 14);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; b.cyl(x + Math.cos(a) * 0.13, y, z + Math.sin(a) * 0.13, 0.018, 0.2, 'g:' + color, 6, 0.015); }
  b.box(x - 0.1, y + 0.1, z - 0.003, 0.2, 0.012, 0.012, 'g:' + color); b.box(x - 0.003, y + 0.1, z - 0.1, 0.012, 0.012, 0.2, 'g:' + color);
  b.col(x - 0.17, y, z - 0.17, 0.34, 0.42, 0.34);
}
export function lowTable(b: Builder, x: number, y: number, z: number, color = '#3a7bd5', r = 0.32) {
  b.cyl(x, y + 0.42, z, r, 0.03, 'g:' + color, 18);
  b.cyl(x, y, z, 0.03, 0.42, 'm:#888', 8); b.cyl(x, y, z, 0.2, 0.02, 'g:' + color, 12);
  b.col(x - r, y, z - r, r * 2, 0.46, r * 2);
}
export function plasticChair(b: Builder, x: number, y: number, z: number, yaw: number, color = '#e8553a') {
  cl(b, x, y, z, yaw, () => {
    b.box(-0.21, 0.42, -0.21, 0.42, 0.035, 0.4, 'g:' + color); b.box(-0.21, 0.45, -0.22, 0.42, 0.4, 0.035, 'g:' + color);
    for (const a of [-1, 1]) for (const c of [-1, 1]) b.box(a * 0.18 - 0.015, 0, c * 0.17 - 0.015, 0.03, 0.42, 0.03, 'm:#b6b9bb');
    b.col(-0.21, 0, -0.21, 0.42, 0.5, 0.42);
  });
}
export function motorbikeLegacy(b: Builder, x: number, y: number, z: number, yaw: number, color = '#c92f2a', stand = true) {
  cl(b, x, y, z, yaw, () => { // front = +z
    const wheel = (zz: number) => { b.push(0, 0.3, zz, 0, 0, PI / 2); b.cyl(0, -0.04, 0, 0.3, 0.08, 'r:#161616', 18); b.cyl(0, -0.045, 0, 0.17, 0.09, 'm:#9a9da0', 14); b.cyl(0, -0.05, 0, 0.05, 0.1, 'm:#555', 8); b.pop(); };
    wheel(0.55); wheel(-0.55);
    b.box(-0.05, 0.28, -0.05, 0.1, 0.1, 0.1, 'm:#777');
    // body
    b.box(-0.17, 0.32, -0.3, 0.34, 0.2, 0.62, 'g:' + color); b.box(-0.15, 0.5, -0.38, 0.3, 0.12, 0.66, 'r:#222'); b.box(-0.14, 0.62, -0.38, 0.28, 0.05, 0.6, 'r:#1b1b1b');
    b.box(-0.16, 0.2, 0.28, 0.32, 0.5, 0.26, 'g:' + color); b.box(-0.2, 0.34, -0.55, 0.4, 0.28, 0.2, 'g:' + color);
    b.box(-0.06, 0.62, 0.38, 0.12, 0.5, 0.12, 'm:#666'); b.box(-0.4, 1.02, 0.36, 0.8, 0.04, 0.06, 'm:#222');
    b.box(-0.1, 0.86, 0.34, 0.2, 0.18, 0.12, 'g:' + color); b.box(-0.08, 0.92, 0.46, 0.16, 0.12, 0.05, 'emit:#fff4d0');
    for (const s of [-1, 1]) { b.box(s * 0.42 - 0.01, 1.04, 0.36, 0.02, 0.2, 0.02, 'm:#333'); b.box(s * 0.42 - 0.06, 1.24, 0.34, 0.12, 0.07, 0.03, 'm:#888'); b.box(s * 0.36 - 0.02, 1.02, 0.36, 0.08, 0.04, 0.08, 'r:#111'); }
    b.box(-0.03, 0.72, -0.62, 0.06, 0.08, 0.03, 'g:#e9e3d6'); b.box(-0.12, 0.3, -0.66, 0.24, 0.08, 0.06, 'emit:#ff2a1a');
    b.box(-0.04, 0.12, -0.2, 0.08, 0.14, 0.5, 'm:#ccc'); b.box(-0.18, 0.1, -0.1, 0.36, 0.04, 0.2, 'm:#555');
    if (stand) b.col(-0.22, 0, -0.85, 0.44, 1.0, 1.7);
    b.contact(0, 0, 0.6, 1.9, y);
  });
}
export function shelfUnit(b: Builder, x: number, y: number, z: number, yaw: number, len: number, hgt = 1.9, seed = 1) {
  cl(b, x, y, z, yaw, () => { // front +z, goods face +z
    const d = 0.38;
    b.box(-len / 2, 0, -d / 2, len, hgt, 0.03, 'm:#8a9199'); b.box(-len / 2, 0, -d / 2, 0.03, hgt, d, 'm:#8a9199'); b.box(len / 2 - 0.03, 0, -d / 2, 0.03, hgt, d, 'm:#8a9199');
    const cols = ['#d6362a', '#2f6fc0', '#f2c230', '#2f9a52', '#f4f0e6', '#e87a2a', '#7a3a9a', '#1d1d1d', '#e84a8a'];
    let s = seed * 13;
    for (let i = 0; i < 6; i++) {
      const yy = 0.12 + i * (hgt - 0.14) / 6; b.box(-len / 2, yy, -d / 2, len, 0.02, d, 'm:#8a9199');
      let xx = -len / 2 + 0.05;
      while (xx < len / 2 - 0.12) {
        s = (s * 1103515245 + 12345) & 0x7fffffff; const w = 0.07 + (s % 10) * 0.012, hh = 0.1 + ((s >> 4) % 6) * 0.025, c = cols[(s >> 8) % cols.length];
        if (i === 0 && (s >> 3) % 3 === 0) { b.cyl(xx + w / 2, yy + 0.02, 0.0, w / 2, hh * 1.4, 'g:' + c, 8); } else b.box(xx, yy + 0.02, -0.02, w, hh, d - 0.14, 'g:' + c);
        xx += w + 0.012;
      }
    }
    b.col(-len / 2, 0, -d / 2, len, hgt, d);
  });
}
export function drinkFridge(b: Builder, x: number, y: number, z: number, yaw: number, w = 0.72, hgt = 1.9) {
  cl(b, x, y, z, yaw, () => {
    const d = 0.6;
    b.box(-w / 2, 0, -d / 2, w, hgt, d, 'g:#d9d9d6', { pz: null });
    b.box(-w / 2 + 0.03, 0.1, d / 2 - 0.01, w - 0.06, hgt - 0.3, 0.01, 'glass'); b.box(-w / 2 + 0.03, 0.1, -d / 2 + 0.04, w - 0.06, hgt - 0.3, 0.01, 'emit:#e8f6ff');
    for (let i = 0; i < 5; i++) { b.box(-w / 2 + 0.04, 0.2 + i * 0.32, -0.2, w - 0.08, 0.012, 0.48, 'm:#ccc'); const cs = ['g:#d62828', 'g:#2a8f3c', 'g:#f0a020', 'g:#2a6fd0']; for (let j = 0; j < 6; j++) b.cyl(-w / 2 + 0.1 + j * 0.1, 0.212 + i * 0.32, -0.02 + (j % 2) * 0.1, 0.03, 0.18, cs[(i + j) % 4], 8); }
    b.box(-w / 2, hgt - 0.18, d / 2 - 0.01, w, 0.18, 0.012, 'emit:#e83a2a');
    b.col(-w / 2, 0, -d / 2, w, hgt, d); b.contact(0, 0, w, d, y);
  });
}
export function chestFreezer(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.1) {
  cl(b, x, y, z, yaw, () => {
    b.box(-w / 2, 0.06, -0.3, w, 0.8, 0.6, 'g:#e8ecee'); b.box(-w / 2 + 0.03, 0.86, -0.28, w - 0.06, 0.03, 0.56, 'glass'); b.box(-w / 2, 0.85, -0.3, w, 0.03, 0.04, 'm:#999'); b.box(-w / 2, 0.85, 0.26, w, 0.03, 0.04, 'm:#999');
    b.box(-w / 2 + 0.1, 0.5, 0.0, w - 0.2, 0.34, 0.1, 'g:#e84a8a'); b.box(-w / 2, 0.06, 0.28, w, 0.3, 0.02, 'g:#2a6ec8');
    b.col(-w / 2, 0, -0.3, w, 0.9, 0.6); b.contact(0, 0, w, 0.6, y);
  });
}
export function waterHeater(b: Builder, x: number, y: number, z: number, nrm: number) {
  cl(b, x, y, z, nrm, () => { b.cyl(0, 0, 0.18, 0.17, 0.5, 'g:#eef0f2', 16); b.cyl(0, 0.0, 0.18, 0.12, 0.04, 'g:#cfd3d6', 12); b.box(-0.05, 0.1, 0.35, 0.1, 0.04, 0.01, 'emit:#ff5a2a'); b.box(-0.2, 0.44, 0.0, 0.4, 0.06, 0.03, 'm:#aaa'); });
}
export function toilet(b: Builder, x: number, y: number, z: number, yaw: number) {
  cl(b, x, y, z, yaw, () => { // back at -z, front +z
    const w = 'g:#f7f7f5';
    b.box(-0.2, 0.0, -0.36, 0.4, 0.18, 0.52, w, { py: null }); b.cyl(0, 0.14, 0.02, 0.2, 0.2, w, 18, 0.22);
    b.box(-0.2, 0.34, -0.36, 0.4, 0.4, 0.17, w); b.box(-0.19, 0.74, -0.37, 0.38, 0.05, 0.19, w);
    b.cyl(0, 0.35, 0.05, 0.19, 0.025, 'g:#ececea', 18); b.cyl(0, 0.0, 0.0, 0.0, 0.0, 'g:#fff', 3);
    b.box(0.12, 0.76, -0.3, 0.05, 0.02, 0.05, 'm:#bbb'); b.box(-0.3, 0.45, -0.34, 0.05, 0.35, 0.02, 'r:#e2ddd0');
    b.col(-0.22, 0, -0.38, 0.44, 0.8, 0.6); b.box(0.22, 0.18, -0.1, 0.014, 0.014, 0.28, 'm:#ccc');
  });
}
export function basin(b: Builder, x: number, y: number, z: number, yaw: number) {
  cl(b, x, y, z, yaw, () => { // against wall at -z
    b.box(-0.27, 0.78, -0.22, 0.54, 0.1, 0.44, 'g:#f7f7f5'); b.box(-0.22, 0.86, -0.17, 0.44, 0.03, 0.34, 'g:#e9eaea', { py: 'g:#dfe3e4' });
    b.box(-0.05, 0.0, -0.2, 0.1, 0.78, 0.1, 'g:#f1f1ef'); b.col(-0.28, 0, -0.23, 0.56, 0.9, 0.46);
    b.box(-0.3, 1.2, -0.23, 0.6, 0.8, 0.02, 'm:#cfd3d6'); b.box(-0.28, 1.22, -0.215, 0.56, 0.76, 0.004, 'm:#dbeaf0');
  });
}
export function framePic(b: Builder, x: number, y: number, z: number, yaw: number, w = 0.5, h = 0.35, seed = 1) {
  cl(b, x, y, z, yaw, () => {
    const pal = ['#d99a4a', '#4a8fb0', '#8ab05a', '#c75a4a', '#7a6aa8'];
    b.box(-w / 2, 0, 0, w, h, 0.03, 'woodF:#4a3020'); b.box(-w / 2 + 0.03, 0.03, 0.03, w - 0.06, h - 0.06, 0.004, 'r:#efe6d0');
    b.box(-w / 2 + 0.03, 0.03, 0.034, w - 0.06, (h - 0.06) * 0.4, 0.002, 'r:' + pal[seed % 5]); b.box(-w / 2 + 0.03, 0.03 + (h - 0.06) * 0.4, 0.034, w - 0.06, (h - 0.06) * 0.35, 0.002, 'r:' + pal[(seed + 2) % 5]);
    b.cyl(w * 0.2, h * 0.7, 0.036, h * 0.12, 0.002, 'g:#f3e08a', 10);
  });
}
export function calendar(b: Builder, x: number, y: number, z: number, yaw: number) {
  cl(b, x, y, z, yaw, () => { b.box(-0.17, 0, 0, 0.34, 0.6, 0.01, 'r:#c8201e'); b.box(-0.15, 0.22, 0.012, 0.3, 0.26, 0.002, 'r:#e8d8a8'); b.box(-0.15, 0.04, 0.012, 0.3, 0.14, 0.002, 'r:#f6efe0'); b.box(-0.02, 0.58, 0.0, 0.04, 0.04, 0.02, 'm:#c9a24b'); });
}
export function plant(b: Builder, x: number, y: number, z: number, sc = 1, seed = 1, kind: 'green' | 'dark' = 'green') {
  b.cyl(x, y, z, 0.15 * sc, 0.32 * sc, 'g:#c8b9a0', 12, 0.19 * sc); b.leaves(x, y + 0.7 * sc, z, 0.4 * sc, 16, 'leaf:' + kind, seed, 1);
  b.col(x - 0.18 * sc, y, z - 0.18 * sc, 0.36 * sc, 0.5, 0.36 * sc);
}
export function shoeRack(b: Builder, x: number, y: number, z: number, yaw: number, w = 0.8) {
  cl(b, x, y, z, yaw, () => {
    b.box(-w / 2, 0, -0.15, w, 0.9, 0.3, 'woodF:#a4825c', { pz: null });
    for (let i = 0; i < 3; i++) { b.box(-w / 2, 0.05 + i * 0.28, -0.15, w, 0.02, 0.3, 'woodP:#8a6a44'); b.box(-w / 2 + 0.05, 0.07 + i * 0.28, -0.06, 0.24, 0.07, 0.12, 'r:#2a2a2a'); b.box(0.05, 0.07 + i * 0.28, -0.06, 0.22, 0.06, 0.1, 'r:#e8e0d0'); }
    b.col(-w / 2, 0, -0.15, w, 0.9, 0.3);
  });
}
export function rug(b: Builder, x: number, y: number, z: number, w: number, d: number, color = '#8a3a30') {
  b.box(x - w / 2, y + 0.002, z - d / 2, w, 0.012, d, 'cloth:' + color, { ny: null }); b.box(x - w / 2 + 0.06, y + 0.014, z - d / 2 + 0.06, w - 0.12, 0.002, d - 0.12, 'cloth:#d9c9a0', { ny: null });
}
export function barberChair(b: Builder, x: number, y: number, z: number, yaw: number) {
  cl(b, x, y, z, yaw, () => {
    b.cyl(0, 0, 0, 0.25, 0.04, 'm:#2a2a2a', 14); b.cyl(0, 0.04, 0, 0.05, 0.3, 'm:#c9ccd0', 8);
    b.box(-0.27, 0.34, -0.25, 0.54, 0.12, 0.5, 'g:#7a1f1f'); b.box(-0.27, 0.46, -0.3, 0.54, 0.62, 0.12, 'g:#7a1f1f'); b.box(-0.38, 0.5, -0.2, 0.1, 0.07, 0.4, 'm:#2a2a2a'); b.box(0.28, 0.5, -0.2, 0.1, 0.07, 0.4, 'm:#2a2a2a');
    b.box(-0.2, 0.12, 0.2, 0.4, 0.04, 0.2, 'm:#2a2a2a'); b.col(-0.4, 0, -0.32, 0.8, 1.0, 0.8);
  });
}
export function mirrorWall(b: Builder, x: number, y: number, z: number, yaw: number, w = 1.2, h = 0.9) {
  cl(b, x, y, z, yaw, () => { b.box(-w / 2 - 0.03, 0, 0, w + 0.06, h + 0.06, 0.03, 'woodF:#3a2a1e'); b.box(-w / 2, 0.03, 0.03, w, h, 0.006, 'm:#cfdde4'); });
}

/** motorbike (xe máy): eased tank/seat/cowls, spoked-looking wheels with tyre + rim + hub, chrome exhaust & mirrors */
export function motorbike(b: Builder, x: number, y: number, z: number, yaw: number, color = '#c92f2a', stand = true) {
  cl(b, x, y, z, yaw, () => { // front = +z
    const tyre = 'r:#151515', rim = 'm:#a9adb1', chrome = 'm:#c4c8cc', plastic = 'g:' + color;
    const wheel = (zz: number) => {
      b.geo(tyre, new THREE.TorusGeometry(0.255, 0.074, 10, 28), 0, 0.335, zz, 0, Math.PI / 2, 0);
      b.geo(rim, new THREE.CylinderGeometry(0.18, 0.18, 0.1, 22), 0, 0.335, zz, 0, 0, Math.PI / 2);
      b.geo('m:#666', new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), 0, 0.335, zz, 0, 0, Math.PI / 2);
    };
    wheel(0.56); wheel(-0.52);
    for (const sx of [-0.07, 0.07]) { // telescopic fork + rear shocks
      b.geo('m:#b9bdc2', new THREE.CylinderGeometry(0.013, 0.013, 0.5, 8), sx, 0.62, 0.52, -0.28, 0, 0);
      b.geo('m:#2a2b2d', new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), sx, 0.78, 0.46, -0.28, 0, 0);
      b.geo('m:#9aa0a6', new THREE.CylinderGeometry(0.016, 0.016, 0.32, 8), sx * 2.3, 0.5, -0.45, 0.35, 0, 0);
    }
    b.rb(plastic, -0.12, 0.8, 0.36, 0.24, 0.2, 0.2, 0.06);                         // headset cowl
    b.rb('r:#17181a', -0.16, 0.24, -0.02, 0.32, 0.03, 0.42, 0.012);                // floorboard
    b.rb('m:#2b2d30', -0.11, 0.2, -0.28, 0.22, 0.2, 0.46, 0.05);                   // frame/engine block
    b.geo('m:#3a3c40', new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14), 0, 0.27, -0.2, 0, 0, Math.PI / 2);
    b.rb(plastic, -0.14, 0.26, 0.2, 0.28, 0.46, 0.12, 0.05);                       // leg shield
    b.rb(plastic, -0.13, 0.44, -0.04, 0.26, 0.16, 0.34, 0.07);                     // tank
    b.rb('r:#1a1a1c', -0.12, 0.56, -0.36, 0.24, 0.07, 0.42, 0.03);                 // seat
    b.rb(plastic, -0.12, 0.44, -0.66, 0.24, 0.1, 0.24, 0.04);                      // rear cowl
    b.rb(plastic, -0.11, 0.62, 0.42, 0.22, 0.04, 0.26, 0.015);                     // front fender
    b.rb(plastic, -0.1, 0.62, -0.84, 0.2, 0.04, 0.36, 0.015);                      // rear fender
    b.rb('emit:#fff4d0', -0.07, 0.5, 0.5, 0.14, 0.08, 0.05, 0.025);               // headlamp
    b.rb('emit:#ff2a1a', -0.09, 0.47, -0.9, 0.18, 0.04, 0.02, 0.01);              // tail lamp
    b.rb('g:#f3f1ea', -0.08, 0.34, -0.9, 0.16, 0.12, 0.012, 0.004);               // number plate
    b.geo('m:#262626', new THREE.CylinderGeometry(0.011, 0.011, 0.56, 6), 0, 0.92, 0.24, 0, 0, Math.PI / 2); // handlebar
    for (const s of [-1, 1]) {
      b.geo(chrome, new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), s * 0.3, 0.98, 0.26, 0, 0, Math.PI / 2);
      b.geo('r:#1d1d1d', new THREE.SphereGeometry(0.035, 8, 6), s * 0.36, 1.02, 0.22);
      b.geo('g:#c9d3d8', new THREE.SphereGeometry(0.028, 8, 6), s * 0.36, 1.02, 0.25);
    }
    b.geo(chrome, new THREE.CylinderGeometry(0.035, 0.04, 0.6, 10), 0.13, 0.2, -0.3, Math.PI / 2, 0, 0); // exhaust
    b.geo(chrome, new THREE.CylinderGeometry(0.042, 0.042, 0.02, 12), 0.13, 0.2, -0.61, Math.PI / 2, 0, 0);
    b.contact(0, 0, 0.6, 1.9, y);
    if (stand) b.col(-0.22, 0, -0.85, 0.44, 1.0, 1.7);
  });
}
