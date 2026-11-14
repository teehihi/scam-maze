import * as THREE from 'three';
import { tr } from './strings';
import type { House } from './house';
import { subtract } from './house';
import type { Open } from './builder';
import { hingeDoor, shutter, hit } from './devices';
import { signTex } from './textures';
import { mat } from './materials';
import { mulberry32 } from './util';

export function makeSign(h: House, lines: string[], bg: string, fg: string, x: number, y: number, z: number, w: number, hg: number, yaw: number, opts: { border?: string; res?: number; glow?: number } = {}) {
  const res = opts.res ?? 512;
  const tex = signTex(lines, bg, fg, res, Math.round(res * hg / w), { border: opts.border });
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.05, roughness: 0.6 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, hg), m);
  mesh.position.set(x, y, z); mesh.rotation.y = yaw; mesh.castShadow = false; h.group.add(mesh);
  const glow = opts.glow ?? 0.9;
  h.ctx.dyn.push(() => { m.emissiveIntensity = 0.04 + h.ctx.env.night * glow; });
  return mesh;
}

function fixedPane(h: House, a: number, b: number, y0: number, y1: number, z: number, fr = 'm:#e4e6e8') {
  const B = h.b, f = 0.045;
  B.box(a, y0, z - 0.02, b - a, f, 0.04, fr); B.box(a, y1 - f, z - 0.02, b - a, f, 0.04, fr);
  B.box(a, y0, z - 0.02, f, y1 - y0, 0.04, fr); B.box(b - f, y0, z - 0.02, f, y1 - y0, 0.04, fr);
  B.box(a + f, y0 + f, z - 0.003, b - a - 2 * f, y1 - y0 - 2 * f, 0.006, 'glass');
}

export function railing(h: House, x0: number, x1: number, z: number, y: number, hg = 1.0, m = 'm:#2b2e31') {
  const B = h.b;
  B.box(x0, y + hg - 0.05, z - 0.03, x1 - x0, 0.05, 0.06, 'm:#3a3d41'); B.box(x0, y + 0.08, z - 0.015, x1 - x0, 0.03, 0.03, m);
  for (let x = x0 + 0.05; x < x1 - 0.02; x += 0.115) B.box(x, y + 0.1, z - 0.008, 0.016, hg - 0.15, 0.016, m);
}

export function buildFacade(h: House, lite: boolean) {
  const B = h.b, { W, t, n } = h, sp = h.spec, ext = h.ext, trim = 'px:' + sp.trim, acc = 'px:' + sp.accent;
  const r = mulberry32(sp.seed * 31 + 5);
  const shops = ['garage', 'grocery', 'cafe', 'pho', 'repair', 'hair'].includes(sp.ground);
  const BD = 1.15; // balcony depth
  const top = h.F(n - 1) + h.CH;
  if (lite) {
    B.box(0, 0, 0, t, top, t, ext); B.box(W - t, 0, 0, t, top, t, ext);
  }
  for (let k = 0; k < n; k++) {
    const y0 = h.F(k), y1 = y0 + h.CH, opens: Open[] = [];
    const inner = lite ? 'pi:#34302c' : h.paintAt(k, W / 2, t + 0.4, 'pi:#efe9db');
    const x0 = lite ? 0 : t, x1 = lite ? W : W - t;
    if (k === 0) {
      if (shops) {
        opens.push({ a: 0.35, b: W - 0.35, y0, y1: y0 + 2.7 });
      } else if (sp.style === 'cap4') {
        opens.push({ a: 0.6, b: 1.6, y0, y1: y0 + 2.2 });
        const wa = 2.1;
        if (W >= 5) { opens.push({ a: wa, b: wa + 1.2, y0: y0 + 0.95, y1: y0 + 2.2, solid: true }); opens.push({ a: wa + 1.6, b: W - 0.5, y0: y0 + 0.95, y1: y0 + 2.2, solid: true }); }
        else opens.push({ a: wa, b: W - 0.5, y0: y0 + 0.95, y1: y0 + 2.2, solid: true });
      } else {
        opens.push({ a: 0.45, b: 1.45, y0, y1: y0 + 2.25 });
        opens.push({ a: 1.95, b: W - 0.5, y0: y0 + 0.9, y1: y0 + 2.2, solid: true });
      }
    } else if (sp.style === 'french') {
      opens.push({ a: 0.5, b: 1.55, y0: y0 + 0.05, y1: y0 + 2.5 }); opens.push({ a: W - 1.55, b: W - 0.5, y0: y0 + 0.05, y1: y0 + 2.5 });
    } else {
      opens.push({ a: 0.5, b: W - 0.5, y0, y1: y0 + 2.5 });
    }
    B.wallX(x0, x1, 0, t, y0, y1, ext, inner, opens, trim, { aoP: !lite, skirt: lite ? undefined : 'woodP:#e9e4d8' });
    // ---- fill the openings
    for (const o of opens) {
      const w = o.b - o.a, glassy = o.solid;
      if (!glassy) B.surf(o.a, 0, o.b, t, o.y0, 'tile');
      if (k === 0 && !glassy) {
        if (shops) {
          h.casing('x', 0, t, o.a, o.b, y0, o.y1, trim, 'woodP:#efeae0');
          const sh = shutter(h, { x0: o.a, x1: o.b, y0, y1: o.y1, c: 0, th: t, color: sp.shutterColor ?? ['#8f9aa3', '#b8b2a2', '#7f8c8d', '#9aa59a'][sp.seed % 4], open: lite ? false : true });
          h.devices['shutter'] = sh;
          B.box(o.a - 0.05, o.y1, t, w + 0.1, 0.28, 0.28, 'pi:#c9c6bd');
        } else {
          h.casing('x', 0, t, o.a, o.b, y0, o.y1, trim, 'woodP:#efeae0');
          if (lite) B.box(o.a, y0, 0.05, w, 2.2, 0.04, 'woodF:#7a5535');
          else {
            h.devices['door'] = hingeDoor(h, { axis: 'x', c: 0, th: t, a: o.a, b: o.b, y: y0, hgt: o.y1 - y0, hinge: 'a', swing: 1, mat: sp.style === 'cap4' ? 'woodF:#6e4a2d' : 'woodF:#7f5a3a', label: tr('noun.frontDoor'), sound: 'door' });
          }
        }
      } else if (glassy) {
        h.casing('x', 0, t, o.a, o.b, o.y0, o.y1, trim, 'woodP:#efeae0', true);
        if (lite) fixedPane(h, o.a, o.b, o.y0, o.y1, t / 2);
        else h.windowFrame('x', 0, t, o.a, o.b, o.y0, o.y1, 2, false, k === 0, trim);
        if (k === 0) {
          if (!lite) { /* grille drawn in windowFrame on pz side; add exterior grille */ }
          const gz = -0.05;
          for (let x = o.a + 0.06; x < o.b; x += 0.12) B.box(x, o.y0, gz, 0.014, o.y1 - o.y0, 0.014, 'm:#33363a');
          for (const yy of [o.y0 + 0.02, (o.y0 + o.y1) / 2, o.y1 - 0.04]) B.box(o.a, yy, gz - 0.004, w, 0.02, 0.022, 'm:#33363a');
        }
      } else {
        // upper-floor glazing
        h.casing('x', 0, t, o.a, o.b, o.y0, o.y1, trim, 'woodP:#efeae0');
        if (sp.style === 'french') {
          if (lite) fixedPane(h, o.a, o.b, o.y0, o.y1, t / 2);
          else {
            hingeDoor(h, { axis: 'x', c: 0, th: t, a: o.a, b: o.a + w / 2, y: o.y0, hgt: o.y1 - o.y0, hinge: 'a', swing: -1, glass: true, label: tr('noun.bigWindow'), noCol: false, frame: 'woodP:#f4f1ea' });
            hingeDoor(h, { axis: 'x', c: 0, th: t, a: o.a + w / 2, b: o.b, y: o.y0, hgt: o.y1 - o.y0, hinge: 'b', swing: -1, glass: true, label: tr('noun.bigWindow'), frame: 'woodP:#f4f1ea' });
          }
          // wrought-iron balconette + louvre shutters
          railing(h, o.a - 0.05, o.b + 0.05, -0.3, y0, 0.95, 'm:#1f2326');
          B.box(o.a - 0.05, y0 + 0.0, -0.3, 0.03, 0.95, 0.3, 'm:#1f2326'); B.box(o.b + 0.02, y0, -0.3, 0.03, 0.95, 0.3, 'm:#1f2326');
          B.box(o.a - 0.07, y0 - 0.06, -0.33, w + 0.14, 0.07, 0.34, 'px:' + sp.trim);
          for (const sx of [o.a - 0.4, o.b + 0.02]) {
            B.box(sx, o.y0, -0.045, 0.38, o.y1 - o.y0, 0.03, 'woodP:#4e6b4d');
            for (let yy = o.y0 + 0.15; yy < o.y1 - 0.1; yy += 0.11) B.box(sx + 0.03, yy, -0.062, 0.32, 0.02, 0.02, 'woodP:#3e573e');
          }
        } else {
          // modern: central double door + fixed side panes
          const cw = Math.min(1.5, w - 0.8), ca = o.a + (w - cw) / 2;
          if (lite) fixedPane(h, o.a, o.b, o.y0, o.y1, t / 2);
          else {
            fixedPane(h, o.a, ca, o.y0, o.y1, t / 2); fixedPane(h, ca + cw, o.b, o.y0, o.y1, t / 2);
            hingeDoor(h, { axis: 'x', c: 0, th: t, a: ca, b: ca + cw / 2, y: o.y0, hgt: 2.35, hinge: 'a', swing: -1, glass: true, label: tr('noun.balconyDoor'), frame: 'm:#e9eaec' });
            hingeDoor(h, { axis: 'x', c: 0, th: t, a: ca + cw / 2, b: ca + cw, y: o.y0, hgt: 2.35, hinge: 'b', swing: -1, glass: true, label: tr('noun.balconyDoor'), frame: 'm:#e9eaec' });
            B.box(ca, o.y0 + 2.35, t / 2 - 0.02, cw, 0.15, 0.04, 'm:#e9eaec'); B.box(ca, o.y0 + 2.35 + 0.0, t / 2 - 0.0, cw, 0.15, 0.006, 'glass');
          }
        }
      }
      // lite houses & shops: curtains/darkness behind windows is the dark mass
    }
    // ---- mái hắt: cast-concrete canopy over each opening, drip lip, floor-line cornice, ốp đá plinth
    if (!lite) for (const o of opens) {
      if (sp.style === 'french' && !o.solid) continue;
      const ow = o.b - o.a;
      B.box(o.a - 0.14, o.y1, -0.52, ow + 0.28, 0.1, 0.56, 'conc:#cdc7b8', { ny: null });
      B.box(o.a - 0.14, o.y1 - 0.02, -0.56, ow + 0.28, 0.035, 0.05, 'conc:#b9b3a3');
    }
    if (!lite && k >= 1) B.box(-0.07, y1 - 0.06, -0.14, W + 0.14, 0.12, 0.14, 'px:' + sp.trim);
    if (!lite && k === 0 && !shops && sp.style === 'modern') {
      B.box(0, 0, -0.035, 0.45, 0.95, 0.035, 'stone:#cfc7b6');
      B.box(1.45, 0, -0.035, W - 1.45, 0.95, 0.035, 'stone:#cfc7b6');
    }
    // ---- balcony / slab edge
    if (k >= 1 && sp.style !== 'french') {
      B.box(0, y0 - 0.22, -BD, W, 0.2, BD, ext, { ny: 'pi:#f3f0e8', py: null, nz: trim, nx: ext, px: ext, pz: null });
      B.box(0.0, y0 - 0.02, -BD, W, 0.02, BD, 'tile:#b8b1a2', { ny: null, nx: null, px: null, nz: null, pz: null });
      B.surf(0.1, -BD, W - 0.1, 0.0, y0, 'tile');
      B.col(0, y0, -BD - 0.05, W, 1.1, 0.1, 'rail');
      B.col(0, y0, -BD, 0.1, 1.1, BD, 'rail'); B.col(W - 0.1, y0, -BD, 0.1, 1.1, BD, 'rail');
      const caged = sp.cage?.includes(k);
      if (caged) {
        const m = 'm:#2c2f33', hgt = h.CH - 0.15;
        for (let x = 0.05; x < W; x += 0.13) B.box(x, y0, -BD, 0.018, hgt, 0.018, m);
        for (const zz of [-BD * 0.3, -BD * 0.65]) { B.box(0, y0, -BD + 0.0, 0.018, hgt, 0.018, m); void zz; }
        for (const yy of [y0 + 0.5, y0 + 1.1, y0 + 1.7, y0 + 2.3, y0 + hgt - 0.03]) B.box(0, yy, -BD, W, 0.025, 0.025, m);
        for (const sx of [0, W - 0.02]) for (let z = -BD + 0.15; z < 0; z += 0.15) B.box(sx, y0, z, 0.018, hgt, 0.018, m);
        for (const sx of [0, W - 0.02]) for (const yy of [y0 + 0.6, y0 + 1.4, y0 + 2.2, y0 + hgt - 0.03]) B.box(sx, yy, -BD, 0.02, 0.025, BD, m);
        B.box(0, y0 + hgt - 0.02, -BD, W, 0.025, BD, 'm:#2c2f33', { py: 'tole:#8d97a0' });
        // tell the player gate door is hanging open (decor): small latch
        B.box(W - 0.4, y0 + 1.0, -BD - 0.01, 0.2, 0.05, 0.03, 'm:#777');
      } else {
        railing(h, 0.02, W - 0.02, -BD + 0.02, y0, 1.0);
        B.box(0, y0, -BD, 0.12, 0.95, BD, acc, { py: 'px:' + sp.trim });
        B.box(W - 0.12, y0, -BD, 0.12, 0.95, BD, acc, { py: 'px:' + sp.trim });
      }
      balconyProps(h, k, y0, r, !!caged);
    }
    if (k >= 1 && sp.style === 'french') {
      B.box(0, y0 - 0.22, -0.0, W, 0.22, 0.12, trim, { nz: trim });
    } else if (k >= 1) {
      void 0;
    }
  }
  // decorative strips
  if (sp.style === 'modern') {
    B.box(0.0, h.F(0) + 0.0, -0.07, 0.4, top - h.F(0) + 0.15, 0.07, acc, { py: acc });
    B.box(W - 0.4, h.F(0), -0.07, 0.0, 0, 0, acc);
  }
  if (sp.style === 'french') {
    B.box(-0.03, h.F(0), -0.03, 0.22, top - h.F(0), 0.03, 'px:' + sp.trim); B.box(W - 0.19, h.F(0), -0.03, 0.22, top - h.F(0), 0.03, 'px:' + sp.trim);
    for (let k = 1; k < n; k++) B.box(-0.03, h.F(k) - 0.26, -0.04, W + 0.06, 0.1, 0.05, 'px:' + sp.trim);
  }
  // shop / house signage & number plate
  const f0 = h.F(0);
  if (sp.sign && shops) {
    const signW = W - 0.5;
    makeSign(h, sp.sign, sp.signBg ?? '#c4161c', sp.signFg ?? '#ffe45c', W / 2, f0 + 3.08, -0.075 - 0.0, signW, 0.55, Math.PI, { border: '#fff3c4' });
    B.box(0.22, f0 + 2.78, -0.1, signW + 0.06, 0.6, 0.1, 'm:#2b2b2b', { nz: null });
  } else if (sp.sign) {
    makeSign(h, sp.sign, '#f3efe4', '#26457a', W - 0.45, f0 + 1.75, -0.012, 0.34, 0.22, Math.PI, { glow: 0.2 });
  }
  makeSign(h, [`SỐ ${sp.no}`], '#1d4f9c', '#ffffff', shops ? 0.2 : (sp.style === 'cap4' ? 1.9 : 1.75), f0 + 1.55, -0.014, 0.26, 0.15, Math.PI, { glow: 0.3, res: 256 });
  // front step (tam cấp)
  B.box(0.2, 0, -0.38, W - 0.4, 0.2, 0.38, 'conc', { py: 'tile:#bdb6a8' });
  B.surf(0.2, -0.38, W - 0.2, 0, 0.2, 'concrete');
}

function balconyProps(h: House, k: number, y0: number, r: () => number, caged: boolean) {
  const B = h.b, { W } = h, BD = 1.15;
  // AC outdoor unit
  if (r() < 0.7) {
    const x = r() < 0.5 ? 0.25 : W - 1.1;
    B.box(x, y0 + 0.02, -BD + 0.15, 0.85, 0.6, 0.32, 'g:#e5e6e3');
    B.cyl(x + 0.3, y0 + 0.32, -BD + 0.15 - 0.002, 0.2, 0.01, 'm:#444', 16);
    B.box(x + 0.62, y0 + 0.1, -BD + 0.15 - 0.002, 0.15, 0.4, 0.004, 'm:#9a9d9f');
    B.col(x, y0, -BD + 0.15, 0.85, 0.6, 0.32, 'prop');
  }
  // potted plants
  const np = 2 + Math.floor(r() * 3);
  for (let i = 0; i < np; i++) {
    const x = 0.3 + r() * (W - 0.6), z = -BD + 0.2 + r() * 0.25;
    B.cyl(x, y0, z, 0.13, 0.28, ['g:#b5532e', 'g:#d8d0c0', 'g:#3d6a8a'][Math.floor(r() * 3)], 12, 0.15);
    B.leaves(x, y0 + 0.55, z, 0.32, 14, 'leaf:' + (r() < 0.5 ? 'green' : 'dark'), Math.floor(r() * 9999));
  }
  // bougainvillea draping over the rail
  if (!caged && r() < 0.55) {
    const x0 = r() * (W - 1.5);
    for (let i = 0; i < 6; i++) B.leaves(x0 + i * 0.25, y0 + 0.95 + Math.sin(i) * 0.1, -BD + 0.05, 0.28, 6, 'leaf:bougain', Math.floor(r() * 9999), 1.1);
  }
  // laundry on a rod
  if (r() < 0.5) {
    const z = -BD + 0.35, yy = y0 + 2.25, x0 = 0.3 + r() * 0.3, x1 = W - 0.4;
    B.box(x0, yy, z, x1 - x0, 0.02, 0.02, 'm:#999');
    const cols = ['#d9534f', '#4a7ccf', '#f0c84a', '#6fbf73', '#e8e1d4', '#c47bd0'];
    for (let x = x0 + 0.05; x < x1 - 0.3; x += 0.38 + r() * 0.2) {
      const w = 0.28 + r() * 0.15, hh = 0.5 + r() * 0.35, c = cols[Math.floor(r() * cols.length)];
      B.quad('laundry:' + c, [x, yy - hh, z], [x + w, yy - hh, z], [x + w, yy, z], [x, yy, z], [0, 0, 1, 0, 1, 1, 0, 1]);
    }
  }
  void k;
}

export function buildRoof(h: House) {
  const B = h.b, { W, D, t, n } = h, sp = h.spec, ext = h.ext, Fn = h.F(n);
  const BD = 1.15, r = mulberry32(sp.seed * 17 + 3);
  if (sp.lite) {
    B.box(0, Fn - 0.2, 0, W, 0.2, D, ext);
  }
  if (h.flat) {
    // roof extension over the top balcony + parapet
    if (sp.style !== 'french') B.box(0, Fn - 0.22, -BD, W, 0.22, BD, ext, { ny: 'pi:#f3f0e8', nz: 'px:' + sp.trim, py: 'conc' });
    const ph = 0.9;
    const coping = 'conc';
    const z0 = -BD;
    B.box(0, Fn, z0, W, ph, 0.12, ext, { py: coping }); B.col(0, Fn, z0, W, ph, 0.12, 'wall');
    B.box(0, Fn, z0, 0.15, ph, D - z0, ext, { py: coping }); B.col(0, Fn, z0, 0.15, ph, D - z0, 'wall');
    B.box(W - 0.15, Fn, z0, 0.15, ph, D - z0, ext, { py: coping }); B.col(W - 0.15, Fn, z0, 0.15, ph, D - z0, 'wall');
    B.box(0, Fn, D - 0.15, W, ph, 0.15, ext, { py: coping }); B.col(0, Fn, D - 0.15, W, ph, 0.15, 'wall');
    B.box(-0.04, Fn + ph, z0 - 0.04, W + 0.08, 0.06, 0.2, 'px:' + sp.trim);
    // decorative balusters on front parapet for french/modern
    if (sp.style === 'modern') B.box(0.4, Fn + 0.12, z0 - 0.015, W - 0.8, 0.56, 0.015, 'px:' + sp.accent);
    if (sp.lite) {
      B.box(0, Fn - 0.02, 0, W, 0.02, D, 'paver:#b9684a', { ny: null });
      return;
    }
    // roof deck covering & surfaces
    const tum = { x0: h.xs - 0.1, x1: W - t, z0: h.zs - 1.1, z1: h.zE + h.ph };
    const holes = [tum];
    if (h.hasWell) holes.push({ x0: h.xs - h.ph, x1: W - t, z0: h.zE, z1: h.wz1 + h.ph });
    for (const q of subtract({ x0: t, x1: W - t, z0: z0 + 0.12, z1: D - 0.15 }, holes)) {
      if (q.x1 - q.x0 < 0.02 || q.z1 - q.z0 < 0.02) continue;
      B.box(q.x0, Fn - 0.018, q.z0, q.x1 - q.x0, 0.018, q.z1 - q.z0, 'paver:#b9684a', { ny: null, nx: null, px: null, nz: null, pz: null });
      B.surf(q.x0, q.z0, q.x1, q.z1, Fn, 'concrete');
    }
    // stair head (tum)
    const th = 2.55, tx0 = tum.x0, tx1 = W, tz0 = tum.z0, tz1 = tum.z1;
    B.box(tx0, Fn, tz0, 0.1, th, tz1 - tz0, ext); B.col(tx0, Fn, tz0, 0.1, th, tz1 - tz0, 'wall');
    B.box(tx1 - 0.2, Fn, tz0, 0.2, th, tz1 - tz0, ext); B.col(tx1 - 0.2, Fn, tz0, 0.2, th, tz1 - tz0, 'wall');
    B.box(tz1 > 0 ? tx0 : 0, Fn, tz1 - h.ph, tx1 - tx0, th, h.ph, ext, { nz: 'pi:#efe9db' }); B.col(tx0, Fn, tz1 - h.ph, tx1 - tx0, th, h.ph, 'wall');
    const dA = h.xs + 0.5, dB = h.xs + 1.5;
    B.wallX(tx0, tx1 - 0.2, tz0, 0.1, Fn, Fn + th, ext, 'pi:#efe9db', [{ a: dA, b: dB, y0: Fn, y1: Fn + 2.1 }], 'woodP:#efeae0');
    h.casing('x', tz0, 0.1, dA, dB, Fn, Fn + 2.1, 'px:' + sp.trim, 'woodP:#efeae0');
    B.surf(dA, tz0, dB, tz0 + 0.1, Fn, 'concrete');
    hingeDoor(h, { axis: 'x', c: tz0, th: 0.1, a: dA, b: dB, y: Fn, hgt: 2.1, hinge: 'a', swing: -1, mat: 'woodF:#5f7d91', label: tr('noun.roofDoor'), sound: 'door' });
    B.box(tx0 - 0.15, Fn + th, tz0 - 0.2, tx1 - tx0 + 0.3, 0.14, tz1 - tz0 + 0.4, ext, { py: 'tole:#a9503a', ny: 'pi:#f3f0e8' });
    B.surf(h.xs, tum.z0 + 0.1, W - t, h.zs, Fn, 'concrete');
    // well parapet + grille
    if (h.hasWell) {
      const wz1 = h.wz1;
      B.box(h.xs - h.ph, Fn, h.zE, h.ph, 0.9, wz1 - h.zE + h.ph, ext, { py: 'conc' }); B.col(h.xs - h.ph, Fn, h.zE, h.ph, 0.9, wz1 - h.zE + h.ph, 'wall');
      B.box(h.xs - h.ph, Fn, wz1, W - t - h.xs + h.ph, 0.9, h.ph, ext, { py: 'conc' }); B.col(h.xs - h.ph, Fn, wz1, W - t - h.xs + h.ph, 0.9, h.ph, 'wall');
      for (let x = h.xs; x < W - t; x += 0.12) B.box(x, Fn + 0.88, h.zE, 0.015, 0.015, wz1 - h.zE, 'm:#2b2e31');
      B.col(h.xs, Fn, h.zE, W - t - h.xs, 0.9, wz1 - h.zE, 'wall');
    }
    roofProps(h, r);
  } else {
    // tile gable roof, ridge along z
    const rise = W * 0.3, yE = Fn - 0.05, yR = Fn + rise + 0.05, ox = 0.14, z0 = -0.65, z1 = D + 0.45, L = z1 - z0;
    void L;
    const tile = 'roof', under = 'pi:#ece5d3';
    B.quad(tile, [-ox, yE, z0], [-ox, yE, z1], [W / 2, yR, z1], [W / 2, yR, z0]);
    B.quad(tile, [W + ox, yE, z1], [W + ox, yE, z0], [W / 2, yR, z0], [W / 2, yR, z1]);
    B.quad(under, [-ox, yE - 0.1, z1], [-ox, yE - 0.1, z0], [W / 2, yR - 0.1, z0], [W / 2, yR - 0.1, z1]);
    B.quad(under, [W + ox, yE - 0.1, z0], [W + ox, yE - 0.1, z1], [W / 2, yR - 0.1, z1], [W / 2, yR - 0.1, z0]);
    B.box(W / 2 - 0.11, yR - 0.04, z0, 0.22, 0.1, z1 - z0, 'px:#9c5532');
    // eave boards
    B.push(-ox, yE - 0.1, 0, 0, 0, 0);
    B.pop();
    B.box(-ox - 0.02, yE - 0.14, z0, 0.04, 0.14, z1 - z0, 'px:' + sp.trim); B.box(W + ox - 0.02, yE - 0.14, z0, 0.04, 0.14, z1 - z0, 'px:' + sp.trim);
    // gables
    B.quad(ext, [0, Fn, 0.0], [W, Fn, 0.0], [W / 2, Fn + rise, 0.0], [W / 2, Fn + rise, 0.0], [0, 0, W, 0, W / 2, rise, W / 2, rise]);
    B.quad(ext, [W, Fn, D], [0, Fn, D], [W / 2, Fn + rise, D], [W / 2, Fn + rise, D], [0, 0, W, 0, W / 2, rise, W / 2, rise]);
    B.box(W / 2 - 0.25, Fn + rise * 0.38, -0.04, 0.5, 0.3, 0.04, 'woodP:#4e6b4d');
    for (let i = 0; i < 4; i++) B.box(W / 2 - 0.22, Fn + rise * 0.38 + 0.04 + i * 0.07, -0.06, 0.44, 0.02, 0.02, 'woodP:#3b523a');
    B.box(0, Fn - 0.2, -0.0, W, 0.04, 0.0, ext);
    if (sp.lite) B.box(0, Fn - 0.2, 0, W, 0.2, D, ext);
  }
}

/** lived-in facade hardware: PVC downpipe with clamps, electric meter box + conduit, AC condensers, wall-mounted cable clips */
function facadeHardware(h: House, r: () => number) {
  const B = h.b, { W } = h, Fn = h.F(h.n), sp = h.spec;
  if (sp.lite) return;
  const px = r() < 0.5 ? 0.16 : W - 0.16;
  B.cyl(px, 0.05, -0.05, 0.036, Fn - 0.15, 'g:#e4e0d4', 12);
  B.cyl(px, 0.05, -0.05, 0.05, 0.09, 'g:#e4e0d4', 12);
  for (let y = 0.5; y < Fn - 0.3; y += 1.15) B.box(px - 0.05, y, -0.09, 0.1, 0.03, 0.05, 'g:#cfcabc');
  // meter box with sealed window and conduit up the wall
  const mx = px < 1 ? W - 0.62 : 0.34;
  if (r() < 0.9) {
    B.rb('g:#c8cbcd', mx, 1.45, -0.13, 0.32, 0.44, 0.12, 0.012);
    B.box(mx + 0.04, 1.62, -0.135, 0.24, 0.17, 0.006, 'glass'); B.box(mx + 0.07, 1.67, -0.133, 0.18, 0.07, 0.004, 'r:#d9d6c8');
    for (let i = 0; i < 5; i++) B.box(mx + 0.08 + i * 0.03, 1.685, -0.138, 0.016, 0.03, 0.002, 'r:#222');
    B.box(mx + 0.13, 1.89, -0.09, 0.05, Fn - 2.0, 0.05, 'r:#26282b');
    B.box(mx + 0.13, 1.35, -0.09, 0.05, 0.1, 0.05, 'r:#26282b');
  }
  for (let k = 1; k < h.n; k++) {
    if (r() < 0.55) continue;
    const cx = 0.25 + r() * Math.max(0.1, W - 1.5), y = h.F(k);
    B.rb('g:#dcdfe1', cx, y + 0.02, -0.62, 0.82, 0.58, 0.3, 0.025);
    B.box(cx + 0.06, y + 0.06, -0.625, 0.4, 0.5, 0.012, 'r:#1d1e20');
    for (let i = 0; i < 7; i++) B.box(cx + 0.06, y + 0.1 + i * 0.062, -0.632, 0.4, 0.008, 0.008, 'm:#8e9296');
    B.box(cx + 0.52, y + 0.07, -0.625, 0.24, 0.46, 0.01, 'g:#c9cdd0');
    B.box(cx + 0.06, y - 0.01, -0.58, 0.05, 0.03, 0.2, 'm:#555'); B.box(cx + 0.7, y - 0.01, -0.58, 0.05, 0.03, 0.2, 'm:#555');
    B.col(cx, y, -0.62, 0.82, 0.6, 0.3, 'prop');
  }
}

function roofProps(h: House, r: () => number) {
  facadeHardware(h, r);
  const B = h.b, { W, D, t } = h, Fn = h.F(h.n), sp = h.spec;
  // water tanks above the WC
  const tz = D - 1.0;
  B.box(h.xw + 0.1, Fn, D - 2.05, 1.6, 0.55, 1.9, 'conc'); B.col(h.xw + 0.1, Fn, D - 2.05, 1.6, 1.8, 1.9, 'prop');
  const tanks = W > 4.1 ? 2 : 1;
  for (let i = 0; i < tanks; i++) {
    const cx = h.xw + 0.5 + i * 0.85, cz = tz - 0.35;
    B.cyl(cx, Fn + 0.55, cz, 0.38, 1.25, 'm:#c9ced4', 18); B.cyl(cx, Fn + 1.8, cz, 0.38, 0.14, 'm:#c9ced4', 18, 0.12);
    B.cyl(cx, Fn + 0.95, cz, 0.385, 0.09, 'g:#2a5aa0', 18);
  }
  B.box(h.xw + 0.1, Fn + 0.55, D - 0.5, 0.03, 0.03, 0.4, 'm:#222');
  if (sp.solar) {
    B.push(t + 0.3, Fn, D - 1.8, 0, -0.55); B.box(0, 0, 0, 1.3, 0.06, 1.7, 'g:#1d2a44', { py: 'glass' }); B.pop();
    B.cyl(t + 0.3, Fn + 0.9, D - 0.6, 0.17, 1.4, 'm:#d5d9de', 14); B.col(t + 0.2, Fn, D - 2.0, 1.5, 1.2, 1.9, 'prop');
    B.push(t + 0.2, Fn + 0.9, D - 0.6, Math.PI / 2, 0, 0); B.pop();
  }
  // clothes lines
  const lz = Math.min(h.zE + 0.6, D - 3.2), cols = ['#d9534f', '#4a7ccf', '#f0c84a', '#6fbf73', '#eee8da', '#d98cc4', '#5ab4c9'];
  const lx0 = t + 0.15, lx1 = h.xs - 0.35;
  for (const dz of [0, 0.7]) {
    const z = lz + dz;
    B.box(lx0, Fn, z, 0.05, 1.95, 0.05, 'm:#777'); B.box(lx1, Fn, z, 0.05, 1.95, 0.05, 'm:#777'); B.box(lx0, Fn + 1.92, z + 0.015, lx1 - lx0, 0.012, 0.012, 'm:#bbb');
    for (let x = lx0 + 0.1; x < lx1 - 0.35; x += 0.36 + r() * 0.18) {
      const w = 0.3 + r() * 0.14, hh = 0.55 + r() * 0.45, c = cols[Math.floor(r() * cols.length)];
      B.quad('laundry:' + c, [x, Fn + 1.92 - hh, z + 0.02], [x + w, Fn + 1.92 - hh, z + 0.02], [x + w, Fn + 1.92, z + 0.02], [x, Fn + 1.92, z + 0.02], [0, 0, 1, 0, 1, 1, 0, 1]);
    }
  }
  // planters / vegetables in foam boxes, pots along the front parapet
  for (let i = 0; i < 4; i++) {
    const x = 0.45 + i * ((W - 1.2) / 3), z = -0.7;
    if (i % 2 === 0) { B.box(x, Fn, z, 0.6, 0.25, 0.4, 'g:#f1f0ea'); B.box(x + 0.02, Fn + 0.22, z + 0.02, 0.56, 0.04, 0.36, 'r:#4a3624'); B.leaves(x + 0.3, Fn + 0.42, z + 0.2, 0.26, 9, 'leaf:green', 40 + i, 0.9); }
    else { B.cyl(x + 0.2, Fn, z + 0.2, 0.2, 0.42, 'g:#b5532e', 14, 0.24); B.leaves(x + 0.2, Fn + 0.85, z + 0.2, 0.45, 20, 'leaf:' + (i === 1 ? 'bougain' : 'dark'), 70 + i, 1.1); }
    B.col(x, Fn, z, 0.6, 0.4, 0.4, 'prop');
  }
  // antenna / satellite dish on the stair-head roof
  const ax = h.xs + 0.4, az = h.zs - 0.5, ay = Fn + 2.7;
  B.box(ax, ay, az, 0.04, 1.9, 0.04, 'm:#888'); for (let i = 0; i < 4; i++) B.box(ax - 0.35 + (i % 2) * 0.05, ay + 0.9 + i * 0.28, az, 0.7 - i * 0.12, 0.015, 0.015, 'm:#999');
  B.push(h.xs + 1.2, Fn + 2.75, h.zs + 0.6, 0.5, 0.5); B.cyl(0, 0, 0, 0.32, 0.12, 'g:#e8e8e4', 16, 0.05); B.pop();
  if (sp.flag) {
    const fx = 0.3, fz = -BDf + 0.1;
    B.box(fx, Fn, fz, 0.035, 3.0, 0.035, 'm:#9a9a9a');
    B.quad('flag', [fx + 0.035, Fn + 1.6, fz], [fx + 1.15, Fn + 1.6, fz], [fx + 1.15, Fn + 2.4, fz], [fx + 0.035, Fn + 2.4, fz], [0, 0, 1, 0, 1, 1, 0, 1]);
    B.quad('flag', [fx + 1.15, Fn + 1.6, fz], [fx + 0.035, Fn + 1.6, fz], [fx + 0.035, Fn + 2.4, fz], [fx + 1.15, Fn + 2.4, fz], [1, 0, 0, 0, 0, 1, 1, 1]);
  }
  void hit;
}
const BDf = 1.15;

export function buildYard(h: House) {
  const B = h.b, { W } = h, y = h.yardD, sp = h.spec;
  if (y <= 0) return;
  B.box(0, 0, -y, W, 0.17, y, 'paver:#b5b0a5', { ny: null, nx: null, px: null, nz: null, pz: null });
  B.surf(0, -y, W, 0, 0.17, 'concrete');
  const post = (x: number) => { B.box(x, 0, -y - 0.1, 0.18, 1.7, 0.18, 'px:' + sp.trim); B.box(x - 0.02, 1.7, -y - 0.12, 0.22, 0.08, 0.22, 'px:' + sp.color); };
  post(0); post(W - 0.18);
  const ga = W / 2 - 0.65, gb = W / 2 + 0.65;
  for (const [a, b] of [[0.18, ga], [gb, W - 0.18]]) {
    B.box(a, 0, -y - 0.06, b - a, 0.6, 0.12, 'px:' + sp.color); B.col(a, 0, -y - 0.06, b - a, 1.6, 0.12, 'fence');
    for (let x = a + 0.05; x < b - 0.03; x += 0.13) B.box(x, 0.6, -y - 0.012, 0.018, 0.9, 0.018, 'm:#2a2d30');
    B.box(a, 0.55, -y - 0.03, b - a, 0.04, 0.05, 'm:#2a2d30'); B.box(a, 1.46, -y - 0.03, b - a, 0.04, 0.05, 'm:#2a2d30');
  }
  hingeDoor(h, { axis: 'x', c: -y - 0.06, th: 0.12, a: ga, b: W / 2, y: 0.02, hgt: 1.4, hinge: 'a', swing: 1, glass: true, bars: true, frame: 'm:#2a2d30', label: tr('noun.gate'), open: false });
  hingeDoor(h, { axis: 'x', c: -y - 0.06, th: 0.12, a: W / 2, b: gb, y: 0.02, hgt: 1.4, hinge: 'b', swing: 1, glass: true, bars: true, frame: 'm:#2a2d30', label: tr('noun.gate') });
  for (const x of [0, W - 0.12]) { B.box(x, 0, -y, 0.12, 1.3, y, 'px:' + sp.color); B.col(x, 0, -y, 0.12, 1.3, y, 'fence'); }
  // plants & a shrimp-pot of orchids
  B.cyl(W - 0.7, 0.17, -y + 0.6, 0.3, 0.45, 'g:#a9532f', 14, 0.34); B.leaves(W - 0.7, 1.15, -y + 0.6, 0.7, 34, 'leaf:green', sp.seed + 5, 1.2);
  B.cyl(0.55, 0.17, -y + 0.5, 0.22, 0.35, 'g:#d8d0c0', 14, 0.25); B.leaves(0.55, 0.95, -y + 0.5, 0.5, 18, 'leaf:dark', sp.seed + 8, 1);
  B.col(W - 1.0, 0.17, -y + 0.3, 0.6, 1.0, 0.6, 'prop'); B.col(0.3, 0.17, -y + 0.3, 0.5, 0.7, 0.5, 'prop');
  void mat;
}
