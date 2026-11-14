import * as THREE from 'three';

/* ---------- deterministic noise ---------- */
export function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number, seed = 0, px = 0, py = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const wx = (n: number) => (px ? ((n % px) + px) % px : n);
  const wy = (n: number) => (py ? ((n % py) + py) % py : n);
  const a = hash2(wx(xi), wy(yi), seed), b = hash2(wx(xi + 1), wy(yi), seed);
  const c = hash2(wx(xi), wy(yi + 1), seed), d = hash2(wx(xi + 1), wy(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed = 0, oct = 4, px = 0, py = 0) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, seed + i * 17, px * f, py * f);
    n += amp; amp *= 0.5; f *= 2;
  }
  return s / n;
}

/* ---------- canvas helpers ---------- */
export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTex(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  t.anisotropy = opts.aniso ?? 8;
  t.needsUpdate = true;
  return t;
}

/** Build a normal map canvas from a heightfield */
export function normalFromHeight(hf: Float32Array, w: number, h: number, strength = 2) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = hf[y * w + ((x - 1 + w) % w)], r = hf[y * w + ((x + 1) % w)];
      const u = hf[((y - 1 + h) % h) * w + x], d = hf[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

type PBR = { map: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture };

function grayCanvas(vals: Float32Array, w: number, h: number) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, vals[i] * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------- floor: worn oak laminate planks ---------- */
export function floorPlanks(): PBR {
  const W = 1024, H = 1024;
  const planks = 6;
  const pw = W / planks;
  const col = canvas(W, H);
  const ctx = col.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const hf = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  const r = rng(11);
  const joints: number[] = [];
  const tone: number[][] = [];
  for (let i = 0; i < planks; i++) {
    joints.push(r() * H);
    tone.push([0.85 + r() * 0.3, 0.85 + r() * 0.3]);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const pi = Math.floor(x / pw);
      const lx = x - pi * pw;
      const jy = joints[pi];
      const seg = ((y - jy + H) % H) < H / 2 ? 0 : 1;
      const t = tone[pi][seg];
      const sd = pi * 13 + seg * 7;
      const warp = fbm(x / 60, y / 400, sd, 3) * 18;
      const grain = Math.sin((lx + warp) * 0.55 + fbm(x / 9, y / 120, sd + 3, 2) * 4) * 0.5 + 0.5;
      const fine = fbm(x / 2, y / 40, sd + 9, 2);
      const knotN = fbm(x / 30, y / 30, sd + 21, 2);
      let v = 0.55 + grain * 0.18 + fine * 0.18 - (knotN > 0.72 ? (knotN - 0.72) * 2 : 0);
      v *= t;
      // wear: lighter in the center traffic path
      const wear = fbm(x / 220, y / 220, 99, 2);
      let R = 152 * v + 8, G = 112 * v + 4, B = 76 * v;
      R += wear * 10; G += wear * 8; B += wear * 4;
      // grooves
      const edgeX = Math.min(lx, pw - lx);
      const dj = Math.min(Math.abs(y - jy), Math.abs(y - jy - H / 2), Math.abs(y - jy + H / 2), Math.abs(y - jy - H), Math.abs(y - jy + H));
      let groove = 1;
      if (edgeX < 2.2) groove = 0.35 + edgeX * 0.25;
      if (dj < 1.6) groove = Math.min(groove, 0.4 + dj * 0.3);
      R *= groove; G *= groove; B *= groove;
      const i = (y * W + x) * 4;
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255;
      hf[y * W + x] = groove * 0.8 + grain * 0.06 + fine * 0.05;
      rough[y * W + x] = 0.42 + fine * 0.18 + (1 - groove) * 0.4 - wear * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: toTex(col),
    normalMap: toTex(normalFromHeight(hf, W, H, 3), { srgb: false }),
    roughnessMap: toTex(grayCanvas(rough, W, H), { srgb: false }),
  };
}

/* ---------- painted plaster wall, slightly aged ---------- */
export function plaster(base: [number, number, number] = [222, 214, 199], seed = 3): PBR {
  const W = 512, H = 512;
  const col = canvas(W, H);
  const ctx = col.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const hf = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = fbm(x / 64, y / 64, seed, 4, 8, 8);
      const f = fbm(x / 4, y / 4, seed + 5, 3, 128, 128);
      const v = 0.94 + (m - 0.5) * 0.08 + (f - 0.5) * 0.04;
      const i = (y * W + x) * 4;
      img.data[i] = base[0] * v; img.data[i + 1] = base[1] * v; img.data[i + 2] = base[2] * v; img.data[i + 3] = 255;
      hf[y * W + x] = f * 0.6 + m * 0.4;
      rough[y * W + x] = 0.82 + f * 0.12;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: toTex(col),
    normalMap: toTex(normalFromHeight(hf, W, H, 1.2), { srgb: false }),
    roughnessMap: toTex(grayCanvas(rough, W, H), { srgb: false }),
  };
}

/* ---------- desk veneer (birch ply top) ---------- */
export function deskWood(): PBR {
  const W = 1024, H = 512;
  const col = canvas(W, H);
  const ctx = col.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const hf = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const warp = fbm(x / 300, y / 40, 41, 3) * 30;
      const g = Math.sin((y + warp) * 0.35 + fbm(x / 80, y / 8, 42, 2) * 3) * 0.5 + 0.5;
      const fine = fbm(x / 30, y / 1.5, 43, 2);
      const v = 0.8 + g * 0.12 + fine * 0.12;
      // a coffee ring stain + pen marks around the usual work zone
      const dx = x - 690, dy = y - 300;
      const ring = Math.abs(Math.hypot(dx, dy) - 34);
      const stain = ring < 3 ? 0.88 + ring * 0.03 : 1;
      const i = (y * W + x) * 4;
      img.data[i] = 196 * v * stain; img.data[i + 1] = 160 * v * stain; img.data[i + 2] = 118 * v * stain; img.data[i + 3] = 255;
      hf[y * W + x] = g * 0.3 + fine * 0.2;
      rough[y * W + x] = 0.38 + fine * 0.2 + (stain < 1 ? 0.15 : 0);
    }
  }
  ctx.putImageData(img, 0, 0);
  // faint scratches
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#3a2a1a';
  const r = rng(77);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, l = 10 + r() * 60, a = (r() - 0.5) * 0.6;
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return {
    map: toTex(col),
    normalMap: toTex(normalFromHeight(hf, W, H, 1.5), { srgb: false }),
    roughnessMap: toTex(grayCanvas(rough, W, H), { srgb: false }),
  };
}

/* ---------- dark wood (nightstand, shelf) ---------- */
export function darkWood(seed = 5): PBR {
  const W = 512, H = 512;
  const col = canvas(W, H);
  const ctx = col.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const warp = fbm(x / 50, y / 200, seed, 3, 0, 0) * 25;
      const g = Math.sin((x + warp) * 0.4) * 0.5 + 0.5;
      const fine = fbm(x / 1.5, y / 25, seed + 2, 2);
      const v = 0.7 + g * 0.18 + fine * 0.2;
      const i = (y * W + x) * 4;
      img.data[i] = 104 * v; img.data[i + 1] = 70 * v; img.data[i + 2] = 46 * v; img.data[i + 3] = 255;
      hf[y * W + x] = g * 0.4 + fine * 0.3;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTex(col), normalMap: toTex(normalFromHeight(hf, W, H, 1.2), { srgb: false }) };
}

/* ---------- woven fabric normal (linen/cotton) ---------- */
export function fabric(seed = 1, freq = 0.9, rugged = 0.35): PBR {
  const W = 256, H = 256;
  const hf = new Float32Array(W * H);
  const col = canvas(W, H);
  const ctx = col.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x / 6, y / 6, seed, 2, 43, 43);
      const sx = Math.sin(x * freq * Math.PI / 2 * 1.0);
      const sy = Math.sin(y * freq * Math.PI / 2 * 1.0);
      const weave = (Math.floor(x * freq / 2) + Math.floor(y * freq / 2)) % 2 ? sx * sx : sy * sy;
      const slub = fbm(x / 40, y / 2, seed + 7, 2, 7, 128);
      hf[y * W + x] = weave * 0.6 + n * rugged + slub * 0.2;
      const v = 0.9 + weave * 0.05 + (n - 0.5) * 0.1 + (slub - 0.5) * 0.1;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * Math.min(1, v); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTex(col), normalMap: toTex(normalFromHeight(hf, W, H, 1.6), { srgb: false }) };
}

/* ---------- knit throw (chunky) ---------- */
export function knit(): PBR {
  const W = 256, H = 256;
  const hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = (x % 32) - 16, cy = (y % 24);
    const side = cx < 0 ? -1 : 1;
    const v = Math.abs(cx) / 16;
    const lean = cy / 24 - v * 0.6 * side * side;
    const loop = Math.sin(lean * Math.PI) * Math.sin(v * Math.PI);
    hf[y * W + x] = Math.max(0, loop) + fbm(x / 3, y / 3, 3, 2, 85, 85) * 0.15;
  }
  const c = grayCanvas(hf, W, H);
  return { map: toTex(c), normalMap: toTex(normalFromHeight(hf, W, H, 3), { srgb: false }) };
}

/* ---------- rug: faded, low-pile ---------- */
export function rug(): PBR {
  const W = 512, H = 768;
  const col = canvas(W, H);
  const ctx = col.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bx = Math.min(x, W - x), by = Math.min(y, H - y);
    const b = Math.min(bx, by);
    let c: [number, number, number] = [150, 72, 52];
    if (b < 26) c = [44, 46, 66];
    else if (b < 34) c = [196, 170, 130];
    else if (b < 58) c = [120, 56, 44];
    else {
      const px = (x - W / 2) / 60, py = (y - H / 2) / 60;
      const d = Math.abs(px) + Math.abs(py);
      const m = (Math.floor(d * 1.2) % 2);
      const dia = Math.abs((Math.abs(px) % 1.6) - 0.8) + Math.abs((Math.abs(py) % 1.6) - 0.8);
      if (dia < 0.3) c = [196, 168, 122];
      else if (m) c = [140, 66, 50]; else c = [160, 82, 58];
      if (d < 0.9) c = [52, 58, 82];
    }
    const pile = fbm(x / 1.3, y / 1.3, 9, 2);
    const fade = 0.8 + fbm(x / 120, y / 120, 10, 3) * 0.3;
    const v = (0.82 + pile * 0.3) * fade;
    const i = (y * W + x) * 4;
    img.data[i] = c[0] * v; img.data[i + 1] = c[1] * v; img.data[i + 2] = c[2] * v; img.data[i + 3] = 255;
    hf[y * W + x] = pile;
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTex(col), normalMap: toTex(normalFromHeight(hf, W, H, 2.5), { srgb: false }) };
}

/* ---------- brushed metal ---------- */
export function brushed(): THREE.Texture {
  const W = 256, H = 256;
  const v = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) v[y * W + x] = 0.35 + fbm(x / 80, y / 0.7, 4, 3, 3, 0) * 0.3;
  return toTex(grayCanvas(v, W, H), { srgb: false });
}

/* ---------- ceramic speckle ---------- */
export function speckle(base: string, dots: string, seed = 2): THREE.Texture {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const r = rng(seed);
  ctx.fillStyle = dots;
  for (let i = 0; i < 500; i++) { ctx.globalAlpha = 0.2 + r() * 0.6; ctx.beginPath(); ctx.arc(r() * 256, r() * 256, r() * 1.3, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  return toTex(c);
}

/* ---------- handwriting helper ---------- */
export const HAND = "'Patrick Hand','Segoe Print','Bradley Hand','Comic Sans MS','Chalkboard SE','Marker Felt',cursive";
export function handText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, seed = 1, slant = -0.03) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px ${HAND}`;
  ctx.translate(x, y);
  ctx.rotate(slant);
  let cx = 0;
  for (const ch of text) {
    ctx.save();
    ctx.translate(cx, (r() - 0.5) * size * 0.08);
    ctx.rotate((r() - 0.5) * 0.08);
    ctx.globalAlpha = 0.82 + r() * 0.18;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += ctx.measureText(ch).width * (0.93 + r() * 0.1);
  }
  ctx.restore();
}

function paperBase(ctx: CanvasRenderingContext2D, w: number, h: number, tint = [246, 242, 232], seed = 1) {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / 3, y / 3, seed, 2) * 0.05 + fbm(x / 90, y / 90, seed + 1, 2) * 0.05;
    const v = 0.95 + n;
    const i = (y * w + x) * 4;
    img.data[i] = tint[0] * v; img.data[i + 1] = tint[1] * v; img.data[i + 2] = tint[2] * v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- the note on the desk (torn notebook page) ---------- */
export function noteTexture(): THREE.Texture {
  const W = 600, H = 800;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  paperBase(ctx, W, H, [244, 241, 228], 21);
  // ruled lines + margin
  ctx.strokeStyle = 'rgba(110,150,200,0.45)'; ctx.lineWidth = 2;
  for (let y = 110; y < H; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(210,90,90,0.4)';
  ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(70, H); ctx.stroke();
  // torn top edge
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.globalCompositeOperation = 'destination-out';
  const r = rng(5);
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 6 + r() * 14);
  ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const ink = '#1d2a55';
  handText(ctx, 'T7 — đi chợ:', 90, 150, 34, ink, 2);
  handText(ctx, 'trứng, giấy ăn, nước rửa bát', 110, 200, 30, ink, 3);
  handText(ctx, 'tiền nhà trước mùng 5 !!', 90, 262, 32, '#3a2a2a', 4, -0.05);
  handText(ctx, 'Northgate Bank — tổng đài', 90, 370, 33, ink, 6, -0.02);
  handText(ctx, '(chép từ tờ HD mở tài khoản)', 110, 414, 26, ink, 7, -0.02);
  handText(ctx, '1800 6268', 150, 482, 50, ink, 8, -0.025);
  // underline scribble
  ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(140, 496); ctx.quadraticCurveTo(260, 506, 380, 492); ctx.stroke();
  ctx.globalAlpha = 1;
  handText(ctx, 'gọi mẹ CN', 90, 590, 32, ink, 9, 0.02);
  // crossed out line
  handText(ctx, 'sửa vòi nước?', 90, 646, 30, ink, 10);
  ctx.strokeStyle = ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(85, 636); ctx.lineTo(300, 632); ctx.stroke();
  // coffee drip spot
  ctx.fillStyle = 'rgba(120,80,40,0.12)';
  ctx.beginPath(); ctx.arc(480, 700, 40, 0, 7); ctx.fill();
  return toTex(c, { aniso: 16 });
}

/* ---------- thermal receipts ---------- */
export function receiptTexture(kind: 0 | 1 | 2): THREE.Texture {
  const W = 300, H = 720;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  paperBase(ctx, W, H, [240, 238, 234], 30 + kind);
  ctx.fillStyle = '#2b2b2b';
  ctx.textAlign = 'center';
  const lines: [string, string][][] = [
    [[ 'MINISTOP 24H', 'h' ], ['CN Lê Văn Sỹ', 's'], ['21/10  22:41', 's'], ['', 's'],
     ['Mì ly x3 ...... 36.000', 'l'], ['Sữa tươi 1L .. 34.500', 'l'], ['Bánh mì sandwich 18.000', 'l'], ['Pin AA x2 ..... 22.000', 'l'], ['Nước suối ...... 6.000', 'l'], ['', 's'], ['TỔNG     116.500', 'b'], ['Thẻ ****4417', 's'], ['Cảm ơn quý khách!', 's']],
    [[ 'NHÀ THUỐC AN KHANG', 'h' ], ['19/10  19:12', 's'], ['', 's'], ['Panadol Extra ... 21.000', 'l'], ['Vitamin C ....... 48.000', 'l'], ['Băng cá nhân ..... 9.000', 'l'], ['', 's'], ['TỔNG       78.000', 'b'], ['Tiền mặt', 's']],
    [[ 'GRAB FOOD', 'h' ], ['Cơm tấm Thuận Kiều', 's'], ['20/10  21:58', 's'], ['', 's'], ['Cơm sườn bì chả 55.000', 'l'], ['Trà đá ........ 5.000', 'l'], ['Phí giao hàng . 15.000', 'l'], ['Giảm giá ..... -10.000', 'l'], ['', 's'], ['TỔNG     65.000', 'b']],
  ];
  let y = 60;
  for (const [t, k] of lines[kind]) {
    ctx.font = k === 'h' ? 'bold 28px monospace' : k === 'b' ? 'bold 24px monospace' : k === 'l' ? '19px monospace' : '18px monospace';
    ctx.globalAlpha = 0.75 + Math.random() * 0.2;
    if (k === 'l') { ctx.textAlign = 'left'; ctx.fillText(t, 22, y); ctx.textAlign = 'center'; }
    else ctx.fillText(t, W / 2, y);
    y += k === 'h' ? 44 : 32;
  }
  ctx.globalAlpha = 1;
  // barcode
  const r = rng(kind + 3);
  for (let x = 40; x < W - 40; x += 2 + Math.floor(r() * 3)) { ctx.fillRect(x, y + 20, 1 + Math.floor(r() * 2), 60); }
  // fold crease
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, H * 0.45, W, 3);
  return toTex(c);
}

/* ---------- wall calendar ---------- */
export function calendarTexture(): THREE.Texture {
  const W = 512, H = 720;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  paperBase(ctx, W, H, [248, 246, 240], 50);
  // photo area: a misty mountain print
  const g = ctx.createLinearGradient(0, 30, 0, 330);
  g.addColorStop(0, '#b7c6cf'); g.addColorStop(1, '#e8e2d2');
  ctx.fillStyle = g; ctx.fillRect(28, 30, W - 56, 300);
  const r = rng(51);
  for (let l = 0; l < 4; l++) {
    ctx.fillStyle = `rgba(${60 + l * 25},${80 + l * 22},${90 + l * 18},${0.5 + l * 0.12})`;
    ctx.beginPath(); ctx.moveTo(28, 330);
    for (let x = 28; x <= W - 28; x += 8) ctx.lineTo(x, 180 + l * 35 + Math.sin(x / 40 + l) * 20 + r() * 8);
    ctx.lineTo(W - 28, 330); ctx.fill();
  }
  ctx.fillStyle = '#333'; ctx.font = 'bold 34px Georgia, serif'; ctx.textAlign = 'left';
  ctx.fillText('THÁNG 10', 32, 380);
  ctx.font = '18px Georgia, serif'; ctx.fillStyle = '#777'; ctx.fillText('2025', 200, 380);
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  ctx.font = 'bold 16px sans-serif';
  days.forEach((d, i) => { ctx.fillStyle = i === 6 ? '#b33' : '#555'; ctx.fillText(d, 42 + i * 64, 420); });
  ctx.font = '20px sans-serif';
  const start = 2; // Oct 1 2025 is Wednesday
  for (let d = 1; d <= 31; d++) {
    const idx = d - 1 + start;
    const cx = 42 + (idx % 7) * 64, cy = 456 + Math.floor(idx / 7) * 50;
    ctx.fillStyle = idx % 7 === 6 ? '#b33' : '#333';
    ctx.fillText(String(d), cx, cy);
    if (d < 21) { // days already gone: crossed
      ctx.strokeStyle = 'rgba(40,40,90,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 6, cy - 16); ctx.lineTo(cx + 22, cy + 4); ctx.stroke();
    }
  }
  // circled notes
  const circ = (d: number, txt: string, col: string) => {
    const idx = d - 1 + start; const cx = 42 + (idx % 7) * 64 + 8, cy = 456 + Math.floor(idx / 7) * 50 - 7;
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy, 22, 17, 0.2, 0, 7); ctx.stroke();
    handText(ctx, txt, cx - 24, cy + 30, 13, col, d);
  };
  circ(25, 'sn mẹ', '#c0392b');
  circ(19, 'bảo trì NH', '#2c3e70');
  circ(31, 'deadline', '#2c3e70');
  return toTex(c);
}

/* ---------- small framed photo ---------- */
export function photoTexture(): THREE.Texture {
  const W = 400, H = 300;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f0c9a0'); g.addColorStop(0.45, '#e9a77c'); g.addColorStop(0.55, '#5c8aa0'); g.addColorStop(1, '#c9b48d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); ctx.arc(300, 125, 22, 0, 7); ctx.fill();
  // two figures on a beach, slightly blurry
  ctx.filter = 'blur(1.5px)';
  const fig = (x: number, s: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, 180 - 60 * s, 13 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 18 * s, 270); ctx.quadraticCurveTo(x - 20 * s, 190 - 40 * s, x, 190 - 45 * s); ctx.quadraticCurveTo(x + 20 * s, 190 - 40 * s, x + 18 * s, 270); ctx.fill();
  };
  fig(150, 1.0, '#3d2c2a'); fig(200, 0.9, '#6b3b3b');
  ctx.filter = 'none';
  // photo grain + fade
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] = img.data[i] * 0.9 + 20 + n; img.data[i + 1] = img.data[i + 1] * 0.9 + 15 + n; img.data[i + 2] = img.data[i + 2] * 0.85 + 10 + n;
  }
  ctx.putImageData(img, 0, 0);
  return toTex(c);
}

/* ---------- poster (film print) ---------- */
export function posterTexture(): THREE.Texture {
  const W = 420, H = 600;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6dccb'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1f3b4d'; ctx.fillRect(30, 30, W - 60, 400);
  ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(W / 2, 200, 90, 0, 7); ctx.fill();
  ctx.fillStyle = '#1f3b4d';
  for (let i = 0; i < 9; i++) ctx.fillRect(30, 200 + i * 14, W - 60, 6);
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(30, 330, W - 60, 100);
  ctx.fillStyle = '#1f3b4d'; ctx.font = 'bold 46px Helvetica, Arial'; ctx.textAlign = 'center';
  ctx.fillText('IN THE MOOD', W / 2, 500);
  ctx.font = '22px Helvetica, Arial'; ctx.fillText('for a quiet night', W / 2, 540);
  ctx.font = '12px Helvetica, Arial'; ctx.fillText('EXHIBITION · 2019 · SAIGON', W / 2, 575);
  // sun fade
  ctx.fillStyle = 'rgba(255,250,240,0.18)'; ctx.fillRect(0, 0, W, H);
  return toTex(c);
}

/* ---------- book spine strip ---------- */
export function spineTexture(title: string, bg: string, fg: string): THREE.Texture {
  const c = canvas(64, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 64, 256);
  const img = ctx.getImageData(0, 0, 64, 256);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  ctx.save(); ctx.translate(36, 128); ctx.rotate(Math.PI / 2);
  ctx.fillStyle = fg; ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText(title, 0, 0); ctx.restore();
  ctx.fillStyle = fg; ctx.fillRect(0, 14, 64, 2); ctx.fillRect(0, 240, 64, 2);
  return toTex(c);
}

/* ---------- city facade windows (emissive) ---------- */
export function facadeTexture(seed: number, cols: number, rows: number, style: 0 | 1 | 2): THREE.Texture {
  const W = 512, H = 1024;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  const r = rng(seed);
  ctx.fillStyle = style === 1 ? '#0b0d12' : '#07080b'; ctx.fillRect(0, 0, W, H);
  // facade grime gradient
  const cw = W / cols, ch = H / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = r();
      const px = x * cw + cw * 0.15, py = y * ch + ch * 0.2, pw = cw * 0.7, ph = ch * 0.6;
      if (lit < 0.42) {
        const warm = r();
        let col: string;
        if (warm < 0.55) col = `rgb(${230 + r() * 25},${160 + r() * 50},${90 + r() * 40})`;
        else if (warm < 0.8) col = `rgb(${200 + r() * 40},${210 + r() * 30},${230})`;
        else if (warm < 0.9) col = `rgb(${120 + r() * 40},${150 + r() * 60},${255})`; // TV flicker blue
        else col = `rgb(255,${120 + r() * 40},${120 + r() * 40})`;
        const g = ctx.createLinearGradient(px, py, px, py + ph);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(40,30,20,1)');
        ctx.fillStyle = g; ctx.globalAlpha = 0.45 + r() * 0.55;
        ctx.fillRect(px, py, pw, ph);
        // curtains / blinds silhouettes
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#120c08';
        if (r() < 0.4) { ctx.fillRect(px, py, pw * (0.2 + r() * 0.3), ph); }
        if (r() < 0.3) for (let b = 0; b < ph; b += 4) ctx.fillRect(px, py + b, pw, 1.5);
        if (r() < 0.12) { ctx.fillRect(px + pw * 0.4, py + ph * 0.35, pw * 0.15, ph * 0.65); } // a person silhouette
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `rgba(${30 + r() * 20},${34 + r() * 20},${44 + r() * 20},1)`;
        ctx.fillRect(px, py, pw, ph);
      }
      if (style === 2 && r() < 0.5) { // AC units / balconies
        ctx.fillStyle = '#1a1b20'; ctx.fillRect(px + pw * 0.6, py + ph + 2, pw * 0.35, ch * 0.12);
      }
    }
  }
  return toTex(c, { aniso: 4 });
}

/* ---------- neon sign ---------- */
export function neonTexture(text: string, color: string, sub?: string): THREE.Texture {
  const W = 512, H = 160;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px "Arial Rounded MT Bold", Arial, sans-serif';
  ctx.shadowColor = color; ctx.shadowBlur = 30;
  ctx.fillStyle = color; ctx.fillText(text, W / 2, sub ? 92 : 110);
  ctx.shadowBlur = 8; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6; ctx.fillText(text, W / 2, sub ? 92 : 110);
  ctx.globalAlpha = 1;
  if (sub) { ctx.font = 'bold 30px Arial'; ctx.shadowBlur = 14; ctx.fillStyle = color; ctx.fillText(sub, W / 2, 140); }
  return toTex(c);
}

/* ---------- wet asphalt with light streaks ---------- */
export function wetRoadTexture(): THREE.Texture {
  const W = 512, H = 1024;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = fbm(x / 3, y / 3, 61, 2) * 0.5 + fbm(x / 60, y / 60, 62, 3) * 0.5;
    const puddle = fbm(x / 90, y / 90, 63, 3) > 0.56 ? 1 : 0;
    const v = 10 + n * 18 - puddle * 6;
    const i = (y * W + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 3; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // lane markings
  ctx.fillStyle = 'rgba(200,190,160,0.5)';
  for (let y = 0; y < H; y += 120) ctx.fillRect(W / 2 - 4, y, 8, 60);
  // reflected light smears (vertical streaks = reflections of lit signs)
  const r = rng(64);
  for (let i = 0; i < 26; i++) {
    const x = r() * W, w = 6 + r() * 18;
    const cols = ['255,170,90', '255,90,160', '90,200,255', '255,230,200', '120,255,170'];
    const col = cols[Math.floor(r() * cols.length)];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const y0 = r();
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(Math.min(0.99, y0), `rgba(${col},${0.12 + r() * 0.2})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x, 0, w, H);
  }
  return toTex(c, { aniso: 8 });
}

/* ---------- droplet shadow mask for the light coming through the window ---------- */
export function dropMaskCanvas(): HTMLCanvasElement {
  return canvas(256, 256);
}
export function paintDropMask(c: HTMLCanvasElement, t: number) {
  const ctx = c.getContext('2d')!;
  const W = c.width, H = c.height;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const r = rng(91);
  // static beads
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H, s = 0.6 + r() * 2.4;
    ctx.fillStyle = 'rgba(60,70,80,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y, s, s * 1.15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.3, s * 0.4, 0, 7); ctx.fill();
  }
  // a few sliding drops with trails
  for (let i = 0; i < 6; i++) {
    const x = r() * W, sp = 8 + r() * 14, ph = r() * 100;
    const y = ((t * sp + ph * 10) % (H + 80)) - 40;
    ctx.strokeStyle = 'rgba(80,90,100,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, Math.max(0, y - 60)); ctx.lineTo(x + Math.sin(y / 20) * 2, y); ctx.stroke();
    ctx.fillStyle = 'rgba(40,50,60,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y, 2.6, 3.2, 0, 0, 7); ctx.fill();
  }
}
