import * as THREE from 'three';
import { tr } from './strings';
import { Builder, type Col, type Surf, type Open } from './builder';
import { mulberry32 } from './util';
import { hingeDoor, hit } from './devices';
import type { Ctx, Device, Room, Spot } from './types';
import { buildFacade, buildRoof, buildYard } from './facade';
import { furnishRoom, furnishExtras } from './rooms';
import { HOME_FLOOR, HOME_HOUSE_NO, type Doorway } from './home';

/** Scratch for `House.toLocal` (called several times per frame per house). */
const _local = new THREE.Vector3();
export type Ground = 'living' | 'garage' | 'grocery' | 'cafe' | 'pho' | 'repair' | 'hair';
export interface HouseSpec {
  id: string; no: string; W: number; D: number; floors: number; style: 'modern' | 'french' | 'cap4'; ground: Ground;
  color: string; trim: string; accent: string; roof: 'flat' | 'tile'; yard: number; sign?: string[]; signBg?: string; signFg?: string;
  cage?: number[]; lite?: boolean; seed: number; gb?: boolean; solar?: boolean; flag?: boolean; well?: boolean; shutterColor?: string; family?: string;
}
type R4 = { x0: number; x1: number; z0: number; z1: number };
export function subtract(r: R4, holes: R4[]): R4[] {
  let out = [r];
  for (const h of holes) {
    const nxt: R4[] = [];
    for (const q of out) {
      if (h.x1 <= q.x0 || h.x0 >= q.x1 || h.z1 <= q.z0 || h.z0 >= q.z1) { nxt.push(q); continue; }
      if (h.x0 > q.x0) nxt.push({ x0: q.x0, x1: h.x0, z0: q.z0, z1: q.z1 });
      if (h.x1 < q.x1) nxt.push({ x0: h.x1, x1: q.x1, z0: q.z0, z1: q.z1 });
      const m0 = Math.max(q.x0, h.x0), m1 = Math.min(q.x1, h.x1);
      if (h.z0 > q.z0) nxt.push({ x0: m0, x1: m1, z0: q.z0, z1: h.z0 });
      if (h.z1 < q.z1) nxt.push({ x0: m0, x1: m1, z0: h.z1, z1: q.z1 });
    }
    out = nxt;
  }
  return out;
}

const PAINTS = ['#efe6d2', '#e7efe3', '#e3ecf0', '#f3e4e0', '#f1ebd6', '#dfeae6', '#f0e2c8', '#e9e3f0'];
const FLOORKIND: Record<string, string> = { tile: 'tile', wood: 'wood', gb: 'tile', conc: 'concrete', mosaic: 'tile' };

export class House {
  spec: HouseSpec; ctx: Ctx; id: string;
  group = new THREE.Group();
  b = new Builder();
  rot: number; ox: number; oz: number;
  W: number; D: number; n: number;
  t = 0.2; ph = 0.1; CH = 3.1; FH = 3.3;
  sw: number; xs: number; zs = 4.8; zE = 7.7; wz1 = 9.2; zf = 3.8; Lf = 1.9; kz0: number; xw: number; zw: number;
  hasWell: boolean; hasStairs: boolean; flat: boolean;
  rooms: Room[] = [];
  floorMat = new Map<Room, string>();
  spots: Record<string, Spot> = {};
  devices: Record<string, Device> = {};
  doors: Device[] = [];
  /** Rear bedroom door of house no. 59 and the white doorway behind it (see home.ts). */
  bedDoor?: Device;
  doorway?: Doorway;
  rnd: () => number;
  ext: string;
  spineX: number;
  yardD: number;
  glowMats: THREE.MeshStandardMaterial[] = [];

  constructor(spec: HouseSpec, place: { x: number; z: number; rot: number }, ctx: Ctx) {
    this.spec = spec; this.ctx = ctx; this.id = spec.id;
    this.W = spec.W; this.D = spec.D; this.n = spec.floors; this.yardD = spec.yard;
    this.flat = spec.roof === 'flat';
    this.hasStairs = this.n > 1;
    this.hasWell = !!spec.well && this.flat && this.n > 1;
    this.sw = this.hasStairs ? 1.8 : Math.max(2.0, (this.W - 0.4) * 0.5);
    this.xs = this.W - this.t - this.sw;
    this.kz0 = this.hasWell ? this.wz1 : this.zE;
    this.xw = this.W - this.t - 1.7; this.zw = this.D - this.t - 2.4;
    this.spineX = Math.min(1.35, this.xs - 0.3);
    this.rnd = mulberry32(spec.seed * 7919 + 13);
    this.ext = 'px:' + spec.color;
    this.ox = place.x; this.oz = place.z; this.rot = place.rot;
    this.group.position.set(place.x, 0, place.z); this.group.rotation.y = place.rot;
    ctx.root.add(this.group); this.group.updateMatrixWorld(true);
    if (spec.lite) this.buildLite(); else this.buildFull();
    this.b.build(this.group);
    for (const c of this.b.cols) ctx.phys.addCol(this.toWorldCol(c));
    for (const s of this.b.surfs) ctx.phys.addSurf(this.toWorldSurf(s));
    ctx.houses.push(this);
  }

  F(k: number) { return 0.35 + this.FH * k; }
  // ---------- transforms ----------
  wp(x: number, y: number, z: number) { return new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld); }
  /** Local position of a world point. Returns a shared scratch vector: read it at once, do not keep it. */
  toLocal(wx: number, wz: number) { const v = _local.set(wx, 0, wz); this.group.worldToLocal(v); return v; }
  toWorldCol(c: Col): Col {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const v = new THREE.Vector3();
    for (let i = 0; i < 4; i++) { v.set(i & 1 ? c.x1 : c.x0, 0, i & 2 ? c.z1 : c.z0).applyMatrix4(this.group.matrixWorld); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); }
    return { x0, x1, z0, z1, y0: c.y0, y1: c.y1, enabled: c.enabled, tag: c.tag };
  }
  toWorldSurf(s: Surf): Surf {
    const w = this.toWorldCol({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, y0: 0, y1: 0, enabled: true });
    const o: Surf = { x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1, y0: s.y0, y1: s.y1, kind: s.kind };
    if (s.ramp) {
      const p = new THREE.Vector3(s.ramp.px, 0, s.ramp.pz).applyMatrix4(this.group.matrixWorld);
      const q = new THREE.Vector3(s.ramp.px + s.ramp.dx, 0, s.ramp.pz + s.ramp.dz).applyMatrix4(this.group.matrixWorld);
      const dx = q.x - p.x, dz = q.z - p.z; o.ramp = { px: p.x, pz: p.z, dx, dz, l2: dx * dx + dz * dz };
    }
    return o;
  }
  /** register a dynamic collider (local coords); returns the world collider */
  dynCol(x: number, y: number, z: number, w: number, hh: number, d: number): Col {
    const c = this.toWorldCol({ x0: x, x1: x + w, z0: z, z1: z + d, y0: y, y1: y + hh, enabled: true });
    this.ctx.phys.addCol(c); return c;
  }
  addInteract(obj: THREE.Object3D, label: () => string, act: () => void) { this.ctx.inter.add({ obj, label, act }); }
  contains(wx: number, wz: number) { const l = this.toLocal(wx, wz); return l.x >= 0 && l.x <= this.W && l.z >= -this.yardD && l.z <= this.D; }
  roomAt(k: number, x: number, z: number) { return this.rooms.find((r) => r.k === k && x >= r.x0 - 1e-6 && x <= r.x1 + 1e-6 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6 && r.kind !== 'wcInner'); }
  roomAtWorld(wx: number, wy: number, wz: number): Room | null {
    if (!this.contains(wx, wz)) return null; const l = this.toLocal(wx, wz);
    if (l.z < 0) return null;
    const k = Math.max(0, Math.min(this.n - 1, Math.floor((wy - this.F(0) + 0.3) / this.FH)));
    let best: Room | null = null;
    for (const r of this.rooms) if (r.k === k && l.x >= r.x0 && l.x <= r.x1 && l.z >= r.z0 && l.z <= r.z1) { if (!best || (r.x1 - r.x0) * (r.z1 - r.z0) < (best.x1 - best.x0) * (best.z1 - best.z0)) best = r; }
    return best;
  }

  // ---------- routing (house-local waypoints for walkers) ----------
  get doorX() { return ['garage', 'grocery', 'cafe', 'pho', 'repair', 'hair'].includes(this.spec.ground) ? this.W / 2 : this.spec.style === 'cap4' ? 1.1 : 0.95; }
  private zoneOf(k: number, x: number, z: number): string {
    if (x >= this.xw && z >= this.zw) return 'wc';
    if (!this.hasStairs) return x > this.xs && z > this.zs && z < this.kz0 ? 'bed1' : 'main';
    if (k > 0 && z < this.zf) return 'uf';
    if (k > 0 && z > this.kz0 + this.ph) return 'ur';
    return 'main';
  }
  route(k0: number, x0: number, z0: number, k1: number, x1: number, z1: number, fromStreet = false, toStreet = false) {
    const P: { x: number; z: number }[] = [], sx = this.spineX, { zs, Lf, xs, W, t, zf, kz0, xw, zw } = this;
    const lL = xs + 0.42, lR = W - t - 0.42;
    const push = (x: number, z: number) => P.push({ x, z });
    const A = (k: number, x: number, z: number) => {
      const zn = this.zoneOf(k, x, z);
      if (zn === 'wc') { push(xw + 0.4, zw + 0.725); push(xw - 0.4, zw + 0.725); push(sx, zw + 0.725); }
      else if (zn === 'uf') { push(0.725, zf - 0.5); push(0.725, zf + 0.5); push(sx, zf + 0.5); }
      else if (zn === 'ur') { push(0.875, kz0 + 0.5); push(0.875, kz0 - 0.5); push(sx, kz0 - 0.5); }
      else if (zn === 'bed1') { push(xs + 0.6, zs + 0.775); push(sx, zs + 0.775); }
      else push(sx, z);
    };
    const B2 = (k: number, x: number, z: number) => {
      const zn = this.zoneOf(k, x, z);
      if (zn === 'wc') { push(sx, zw + 0.725); push(xw - 0.4, zw + 0.725); push(xw + 0.4, zw + 0.725); }
      else if (zn === 'uf') { push(sx, zf + 0.5); push(0.725, zf + 0.5); push(0.725, zf - 0.5); }
      else if (zn === 'ur') { push(sx, kz0 - 0.5); push(0.875, kz0 - 0.5); push(0.875, kz0 + 0.5); }
      else if (zn === 'bed1') { push(sx, zs + 0.775); push(xs + 0.6, zs + 0.775); }
      else push(sx, z);
    };
    let k = k0;
    if (fromStreet) { push(this.doorX, -1.0); push(this.doorX, 0.9); push(sx, 1.3); k = 0; } else { push(x0, z0); A(k0, x0, z0); }
    const tgt = toStreet ? { k: 0, z: 1.3 } : { k: k1, z: z1 };
    if (k !== tgt.k) {
      push(sx, zs - 0.3);
      while (k < tgt.k) { push(lL, zs - 0.3); push(lL, zs + 0.1); push(lL, zs + Lf - 0.05); push(lL, zs + Lf + 0.5); push(lR, zs + Lf + 0.5); push(lR, zs + Lf - 0.05); push(lR, zs + 0.1); push(lR, zs - 0.3); push(sx, zs - 0.3); k++; }
      while (k > tgt.k) { push(lR, zs - 0.3); push(lR, zs + 0.1); push(lR, zs + Lf - 0.05); push(lR, zs + Lf + 0.5); push(lL, zs + Lf + 0.5); push(lL, zs + Lf - 0.05); push(lL, zs + 0.1); push(lL, zs - 0.3); push(sx, zs - 0.3); k--; }
    }
    if (toStreet) { push(sx, 1.3); push(this.doorX, 0.9); push(this.doorX, -1.0); }
    else { push(sx, z1); B2(k1, x1, z1); push(x1, z1); }
    return P;
  }

  // ---------- rooms ----------
  private mkRoom(k: number, id: string, name: string, kind: string, x0: number, x1: number, z0: number, z1: number, paint: string, floor: string): Room {
    const r: Room = { id: `${this.id}.${k}.${id}`, name, k, x0, x1, z0, z1, kind, paint, house: this };
    this.rooms.push(r); this.floorMat.set(r, floor); return r;
  }
  private pa(i: number) { return 'pi:' + PAINTS[(this.spec.seed + i * 3) % PAINTS.length]; }
  private makeRooms() {
    const { W, D, t, ph, xs, zs, zf, kz0, xw, zw } = this;
    const sp = this.spec, n = this.n;
    const gName: Record<Ground, string> = { living: tr('room.living'), garage: tr('room.garage'), grocery: tr('room.grocery'), cafe: tr('room.cafe'), pho: tr('room.pho'), repair: tr('room.repair'), hair: tr('room.hair') };
    const gKind: Record<Ground, string> = { living: 'living', garage: 'garage', grocery: 'shop', cafe: 'cafe', pho: 'pho', repair: 'repair', hair: 'hair' };
    const livingFloor = sp.gb || sp.ground === 'living' || sp.ground === 'garage' ? (sp.gb ? 'gb' : 'tile:#e4ddcc') : sp.ground === 'repair' ? 'conc' : 'tile:#cdc7ba';
    const wcWall = 'tileW:#e8eeee';
    for (let k = 0; k < n; k++) {
      if (k === 0) {
        this.mkRoom(0, 'front', gName[sp.ground], gKind[sp.ground], t, W - t, t, zs, sp.ground === 'living' || sp.ground === 'garage' ? this.pa(0) : 'pi:#f1ecdc', livingFloor);
        if (this.hasStairs) {
          this.mkRoom(0, 'hall', tr('room.hallStairs'), 'hall', t, xs, zs, kz0, this.pa(1), 'tile:#ddd5c4');
          if (this.hasWell) this.mkRoom(0, 'well', tr('room.well'), 'well', xs, W - t, this.zE, this.wz1, this.ext, 'conc');
        } else {
          this.mkRoom(0, 'hall', tr('room.hall'), 'hall', t, xs, zs, kz0, this.pa(1), 'tile:#ddd5c4');
          this.mkRoom(0, 'bed', tr('room.bedroom'), 'bedroom', xs + ph, W - t, zs, kz0, this.pa(2), 'wood:#e2bd8e');
        }
        this.mkRoom(0, 'kitchen', tr('room.kitchen'), 'kitchen', t, W - t, kz0, zw, this.pa(3), 'tile:#d8d2c4');
        this.mkRoom(0, 'laundry', tr('room.laundry'), 'laundry', t, xw - ph, zw, D - t, this.pa(4), 'tile:#c4cbc8');
        this.mkRoom(0, 'wc', tr('room.wc'), 'wc', xw, W - t, zw, D - t, wcWall, 'mosaic:#c9d6d2');
      } else {
        const fk = n >= 3 && k === n - 1 && this.flat ? 'altar' : k === 2 ? 'study' : 'bedroom';
        const fname = fk === 'altar' ? tr('room.altar') : fk === 'study' ? tr('room.study') : k === 1 ? tr('room.masterBedroom') : tr('room.bedroom');
        this.mkRoom(k, 'front', fname, fk, t, W - t, t, zf, this.pa(k + 1), fk === 'altar' ? 'wood:#c79a68' : 'wood:#e0b98a');
        this.mkRoom(k, 'lobby', tr('room.lobbyFloor', { n: k + 1 }), 'hall', t, W - t, zf + ph, zs, this.pa(k + 2), 'tile:#ddd5c4');
        this.mkRoom(k, 'hall', tr('room.hall'), 'hall', t, xs, zs, kz0, this.pa(k + 2), 'tile:#ddd5c4');
        if (this.hasWell) this.mkRoom(k, 'well', tr('room.well'), 'wellup', xs, W - t, this.zE, this.wz1, this.ext, 'conc');
        this.mkRoom(k, 'rear', k === 1 ? tr('room.bedroom2') : tr('room.bedroomN', { n: k + 1 }), 'bedroom', t, W - t, kz0 + ph, D - t, this.pa(k + 4), 'wood:#d9b184');
        this.mkRoom(k, 'wc', 'WC', 'wc', xw, W - t, zw, D - t, wcWall, 'mosaic:#c9d6d2');
      }
    }
    void zf;
  }

  paintAt(k: number, x: number, z: number, fallback: string) {
    let best: Room | undefined;
    for (const r of this.rooms) if (r.k === k && x >= r.x0 - 0.15 && x <= r.x1 + 0.15 && z >= r.z0 - 1e-6 && z <= r.z1 + 1e-6) { if (!best || (r.x1 - r.x0) * (r.z1 - r.z0) < (best.x1 - best.x0) * (best.z1 - best.z0)) best = r; }
    return best ? best.paint : fallback;
  }

  // ---------- door helpers ----------
  casing(axis: 'x' | 'z', c: number, th: number, a: number, b: number, y0: number, y1: number, mat: string, inMat = 'woodP:#efeae0', sill = false) {
    const B = this.b, w = 0.06, d = 0.014;
    if (axis === 'x') {
      for (const [zz, m] of [[c - d, mat], [c + th, inMat]] as [number, string][]) {
        B.box(a - w, y0, zz, w, y1 - y0 + w, d, m); B.box(b, y0, zz, w, y1 - y0 + w, d, m); B.box(a, y1, zz, b - a, w, d, m);
      }
      if (sill) { B.box(a - 0.05, y0 - 0.04, c + th, b - a + 0.1, 0.04, 0.1, 'tile:#e6e2d8'); B.box(a - 0.05, y0 - 0.04, c - 0.06, b - a + 0.1, 0.04, 0.06, mat); }
    } else {
      for (const [xx, m] of [[c - d, mat], [c + th, inMat]] as [number, string][]) {
        B.box(xx, y0, a - w, d, y1 - y0 + w, w, m); B.box(xx, y0, b, d, y1 - y0 + w, w, m); B.box(xx, y1, a, d, w, b - a, m);
      }
      if (sill) { B.box(c + th, y0 - 0.04, a - 0.05, 0.1, 0.04, b - a + 0.1, 'tile:#e6e2d8'); }
    }
  }
  /** interior door in partition wall; returns opening */
  intDoor(axis: 'x' | 'z', c: number, th: number, a: number, b: number, k: number, opts: { swing?: 1 | -1; hinge?: 'a' | 'b'; label?: string; open?: boolean; mat?: string } = {}): Open {
    const y = this.F(k), hg = 2.15;
    this.casing(axis, c, th, a, b, y, y + hg, 'woodP:#efeae0');
    hingeDoor(this, { axis, c, th, a, b, y, hgt: hg, hinge: opts.hinge ?? 'a', swing: opts.swing ?? 1, label: opts.label ?? tr('noun.roomDoor'), open: opts.open, mat: opts.mat ?? 'woodF:#b48756' });
    return { a, b, y0: y, y1: y + hg };
  }

  /**
   * Behind the rear bedroom's door of house no. 59 stands a plain white panel, as bright as a
   * portal: opening the door shows it, and stepping into it is the way into the player's room.
   */
  private whiteDoorway(door: Device, x0: number, x1: number, y0: number, height: number) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false, fog: false, transparent: false, depthWrite: true });
    mat.color.setScalar(3); // above the bloom threshold, so the edges glow
    // A block, not a sheet: it fills the doorway to a depth of 0.6 m, so from no angle (nor with the eye
    // right up to it) is anything of the room behind it visible.
    const depth = 0.6;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.02, height, depth), mat);
    panel.position.set((x0 + x1) / 2, y0 + height / 2, this.kz0 + 0.08 + depth / 2); // starts behind the closed door's leaf
    this.group.add(panel);
    this.bedDoor = door;
    this.doorway = { x0, x1, z: this.kz0 + 0.02, z1: this.kz0 + this.ph + 0.5, height };
  }
  // ---------- build ----------
  private buildLite() {
    const { W, D, b } = this;
    this.makeRooms();
    const top = this.F(this.n - 1) + this.CH;
    b.box(0, -0.4, 0, W, top + 0.4 + 0.2, D, this.ext, { ny: null, py: null, nz: this.ext });
    b.col(0, 0, 0, W, top, D, 'wall');
    buildFacade(this, true);
    buildRoof(this);
    buildYard(this);
  }

  private buildFull() {
    const B = this.b, { W, D, t, ph, xs, zs, zE, wz1, kz0, xw, zw, n } = this;
    this.makeRooms();
    const ceil = 'pi:#f3f0e8';
    const holes = (k: number): R4[] => {
      if (k === 0) return [];
      if (k === n && !this.flat) return [];
      return [{ x0: xs, x1: W - t, z0: zs, z1: this.hasWell ? wz1 : zE }];
    };
    // ---- slabs & floor coverings
    B.box(0, -0.5, 0, W, 0.5 + this.F(0) - 0.02, D, 'conc', { ny: null, py: 'conc' });
    for (let k = 1; k <= n; k++) {
      for (const r of subtract({ x0: 0, x1: W, z0: 0, z1: D }, holes(k))) {
        B.box(r.x0, this.F(k) - 0.2, r.z0, r.x1 - r.x0, 0.18, r.z1 - r.z0, ceil, {
          nx: r.x0 === 0 ? this.ext : ceil, px: r.x1 === W ? this.ext : ceil, nz: r.z0 === 0 ? this.ext : ceil, pz: r.z1 === D ? this.ext : ceil, py: 'conc', ny: ceil,
        });
      }
    }
    for (const room of this.rooms) {
      const k = room.k, fm = this.floorMat.get(room)!;
      const wcOff = room.kind === 'wc' ? 0.004 : 0;
      const rects = subtract({ x0: room.x0, x1: room.x1, z0: room.z0, z1: room.z1 }, room.kind === 'wc' ? [] : holes(k).concat(this.hasWell && k === 0 ? [{ x0: xs, x1: W - t, z0: zE, z1: wz1 }] : []));
      for (const r of rects) {
        if (r.x1 - r.x0 < 0.01 || r.z1 - r.z0 < 0.01) continue;
        B.box(r.x0, this.F(k) - 0.02 + wcOff, r.z0, r.x1 - r.x0, 0.02, r.z1 - r.z0, fm, { ny: null, nx: null, px: null, nz: null, pz: null });
        if (room.kind !== 'well') B.surf(r.x0, r.z0, r.x1, r.z1, this.F(k) + wcOff, FLOORKIND[fm.split(':')[0]] ?? 'tile');
      }
    }
    // upper floor / front slab surface for the roof handled in buildRoof
    for (let k = 0; k < n; k++) this.walls(k);
    for (let k = 0; k < (this.flat ? n : n - 1); k++) if (this.hasStairs) this.stairs(k);
    // ceiling of top floor when tile roof / flat: top slab already added (k=n)
    buildFacade(this, false);
    buildRoof(this);
    buildYard(this);
    for (const room of this.rooms) furnishRoom(this, room);
    furnishExtras(this);
    void zE; void ph; void kz0; void xw; void zw;
  }

  private walls(k: number) {
    const B = this.b, { W, D, t, ph, xs, zs, zE, wz1, kz0, xw, zw, zf } = this;
    const y0 = this.F(k), y1 = y0 + this.CH;
    const ext = this.ext;
    const hallPaint = 'pi:#efe9db';
    // side walls (full depth), segmented by room paint
    const bps = new Set<number>([0, D]);
    for (const r of this.rooms) if (r.k === k) { bps.add(r.z0); bps.add(r.z1); }
    [zs, zE, wz1, zf, zs].forEach((z) => bps.add(z));
    bps.add(t); bps.add(D - t);
    const zl = [...bps].filter((z) => z >= 0 && z <= D).sort((a, b) => a - b);
    for (let i = 0; i < zl.length - 1; i++) {
      const za = zl[i], zb = zl[i + 1]; if (zb - za < 0.02) continue;
      const mz = (za + zb) / 2;
      const left = this.paintAt(k, t + 0.05, mz, hallPaint);
      const right = this.paintAt(k, W - t - 0.05, mz, hallPaint);
      const rightP = mz > zs && mz < zE ? hallPaint : right;
      const wellSide = this.hasWell && mz > zE && mz < wz1 ? ext : null;
      const leftIn = zb <= t + 1e-6 || za >= D - t - 1e-6 ? ext : left;
      B.wallZ(za, zb, 0, t, y0, y1, ext, leftIn, [], leftIn, { aoP: leftIn !== ext, skirt: 'woodP:#e9e4d8' });
      B.wallZ(za, zb, W - t, t, y0, y1, wellSide ?? rightP, ext, [], wellSide ?? rightP, { aoN: !wellSide, skirt: 'woodP:#e9e4d8' });
    }
    // partitions & stair walls handled per kind
    const bedPaint = (z: number, x = 1) => this.paintAt(k, x, z, hallPaint);
    if (k > 0) {
      B.surf(t, zf, W - t, zf + ph, y0, 'tile'); B.surf(t, kz0, W - t, kz0 + ph, y0, 'tile');
      const door1: Open = this.intDoor('x', zf, ph, t + 0.2, t + 1.05, k, { swing: -1, hinge: 'a', label: tr('noun.bedroomDoor') });
      B.wallX(t, W - t, zf, ph, y0, y1, bedPaint(zf - 0.2), bedPaint(zf + 0.3), [door1], 'woodP:#efeae0', { aoN: true, aoP: true, skirt: 'woodP:#e9e4d8' });
      const dx1 = t + 0.25, dx2 = Math.min(xs - 0.2, t + 1.1);
      const door2: Open = this.intDoor('x', kz0, ph, dx1, dx2, k, { swing: 1, hinge: 'a', label: tr('noun.bedroomDoor') });
      if (k === HOME_FLOOR && this.spec.no === HOME_HOUSE_NO) this.whiteDoorway(this.doors[this.doors.length - 1], dx1, dx2, y0, door2.y1 - y0);
      const xsplit = this.hasWell ? xs - ph : W - t;
      B.wallX(t, xsplit, kz0, ph, y0, y1, hallPaint, bedPaint(kz0 + 0.3), [door2], 'woodP:#efeae0', { aoN: true, aoP: true, skirt: 'woodP:#e9e4d8' });
      if (this.hasWell) B.wallX(xsplit, W - t, kz0, ph, y0, y1, ext, bedPaint(kz0 + 0.3), [{ a: xs + 0.35, b: W - t - 0.35, y0: y0 + 1.0, y1: y0 + 2.35, solid: true }], 'woodP:#efeae0', { aoP: true, skirt: 'woodP:#e9e4d8' });
      if (this.hasWell) this.windowFrame('x', kz0, ph, xs + 0.35, W - t - 0.35, y0 + 1.0, y0 + 2.35, 2);
    } else {
      if (this.hasWell) {
        // ground floor: well back wall (kitchen side window) at z = wz1 over x in [xs, W-t]
        B.wallX(xs - ph, W - t, wz1, ph, y0, y1, ext, bedPaint(wz1 + 0.3, xs + 0.3), [{ a: xs + 0.3, b: W - t - 0.3, y0: y0 + 1.0, y1: y0 + 2.2, solid: true }], 'woodP:#efeae0', { aoP: true });
        this.windowFrame('x', wz1, ph, xs + 0.3, W - t - 0.3, y0 + 1.0, y0 + 2.2, 2);
      }
    }
    // well left wall (x = xs - ph) between zE and wz1
    if (this.hasWell) {
      const opens: Open[] = k === 0 ? [{ a: zE + 0.25, b: wz1 - 0.25, y0: y0, y1: y0 + 2.2 }] : [{ a: zE + 0.2, b: wz1 - 0.2, y0: y0 + 0.9, y1: y0 + 2.45, solid: true }];
      B.wallZ(zE, wz1, xs - ph, ph, y0, y1, this.paintAt(k, xs - 0.3, (zE + wz1) / 2, hallPaint), ext, opens, 'woodP:#efeae0', { aoN: true, skirt: 'woodP:#e9e4d8' });
      if (k === 0) {
        B.surf(xs - ph, zE + 0.25, xs + 0.08, wz1 - 0.25, y0, 'concrete');
        this.casing('z', xs - ph, ph, zE + 0.25, wz1 - 0.25, y0, y0 + 2.2, 'woodP:#efeae0');
        hingeDoor(this, { axis: 'z', c: xs - ph, th: ph, a: zE + 0.25, b: wz1 - 0.25, y: y0, hgt: 2.2, hinge: 'a', swing: 1, glass: true, label: tr('noun.wellDoor'), frame: 'm:#d9dcde' });
      } else this.windowFrame('z', xs - ph, ph, zE + 0.2, wz1 - 0.2, y0 + 0.9, y0 + 2.45, 2, true);
    }
    // stairwell rear wall z = zE (x in [xs, W-t]); window above landing
    if (this.hasStairs) {
      const wy0 = y0 + 2.3, wy1 = y0 + 2.95;
      const opens: Open[] = [{ a: xs + 0.25, b: W - t - 0.25, y0: wy0, y1: wy1, solid: true }];
      B.wallX(xs, W - t, zE, ph, y0, y1, hallPaint, this.hasWell ? ext : hallPaint, opens, 'woodP:#efeae0', { aoN: true, skirt: 'woodP:#e9e4d8' });
      this.windowFrame('x', zE, ph, xs + 0.25, W - t - 0.25, wy0, wy1, 2, true);
      // left side rail wall of the stairwell
    }
    if (!this.hasStairs && k === 0) {
      B.surf(xs - ph, zs + 0.35, xs, zs + 1.2, y0, 'tile');
      const bp = this.paintAt(k, xs + 0.4, zs + 1, hallPaint), hp = hallPaint;
      const d1 = this.intDoor('z', xs - ph, ph, zs + 0.35, zs + 1.2, k, { swing: -1, hinge: 'a', label: tr('noun.bedroomDoor') });
      B.wallZ(zs, kz0, xs - ph, ph, y0, y1, hp, bp, [d1], 'woodP:#efeae0', { aoN: true, aoP: true, skirt: 'woodP:#e9e4d8' });
      B.wallX(xs - ph, W - t, zs - ph, ph, y0, y1, this.paintAt(k, W / 2, zs - 0.3, hp), bp, [], 'woodP:#efeae0', { aoN: true, aoP: true });
      B.wallX(xs - ph, W - t, kz0, ph, y0, y1, bp, this.paintAt(k, W / 2, kz0 + 0.3, hp), [], 'woodP:#efeae0', { aoN: true, aoP: true });
    }
    // WC enclosure
    const wcP = 'tileW:#e8eeee';
    const doorZ0 = zw + 0.3, doorZ1 = zw + 1.15;
    const wcDoor: Open = { a: doorZ0, b: doorZ1, y0, y1: y0 + 2.1 };
    B.surf(xw - ph, doorZ0, xw, doorZ1, y0, 'tile');
    this.casing('z', xw - ph, ph, doorZ0, doorZ1, y0, y0 + 2.1, 'woodP:#efeae0');
    hingeDoor(this, { axis: 'z', c: xw - ph, th: ph, a: doorZ0, b: doorZ1, y: y0, hgt: 2.1, hinge: 'a', swing: 1, mat: 'woodF:#7f8f90', label: tr('noun.wcDoor'), sound: 'door' });
    B.wallZ(zw - ph, D - t, xw - ph, ph, y0, y1, this.paintAt(k, xw - 0.3, zw + 0.5, hallPaint), wcP, [wcDoor], 'woodP:#efeae0', { aoN: true, skirt: 'woodP:#e9e4d8' });
    B.wallX(xw - ph, W - t, zw - ph, ph, y0, y1, this.paintAt(k, xw + 0.3, zw - 0.3, hallPaint), wcP, [], wcP, { aoN: true, skirt: 'woodP:#e9e4d8' });
    void zf;
    // back wall + windows
    const bw: Open[] = [];
    if (k >= 0) { const a = t + 0.5, bb = Math.min(xw - ph - 0.3, a + 1.3); bw.push({ a, b: bb, y0: y0 + (k === 0 ? 1.1 : 0.9), y1: y0 + 2.3, solid: true }); }
    const wcw: Open = { a: xw + 0.4, b: xw + 1.2, y0: y0 + 1.75, y1: y0 + 2.35, solid: true };
    bw.push(wcw);
    const backIn = this.paintAt(k, 1, D - 0.4, hallPaint);
    B.wallX(t, W - t, D - t, t, y0, y1, backIn, ext, bw, 'woodP:#efeae0', { aoN: false, skirt: undefined });
    this.windowFrame('x', D - t, t, bw[0].a, bw[0].b, bw[0].y0, bw[0].y1, 2, true, true);
    this.windowFrame('x', D - t, t, wcw.a, wcw.b, wcw.y0, wcw.y1, 1, true, true);
  }

  /** window with casing + glass sashes (opening already cut). grille on the pz side if outside */
  windowFrame(axis: 'x' | 'z', c: number, th: number, a: number, b: number, y0: number, y1: number, sashes: 1 | 2, fixedHalf = false, grille = false, outMat?: string) {
    this.casing(axis, c, th, a, b, y0, y1, outMat ?? 'px:' + this.spec.trim, 'woodP:#efeae0', true);
    const w = b - a;
    const mk = (aa: number, bb: number, hinge: 'a' | 'b', open = false) => hingeDoor(this, { axis, c, th, a: aa, b: bb, y: y0, hgt: y1 - y0, hinge, swing: 1, glass: true, label: tr('noun.window'), noCol: true, open, frame: 'm:#e4e6e8' });
    if (fixedHalf) {
      this.b.box(axis === 'x' ? a : c + th / 2 - 0.01, y0, axis === 'x' ? c + th / 2 - 0.01 : a, axis === 'x' ? w : 0.02, y1 - y0, axis === 'x' ? 0.02 : w, 'glass');
    } else if (sashes === 2) { mk(a, a + w / 2, 'a'); mk(a + w / 2, b, 'b'); } else mk(a, b, 'a');
    if (grille) this.grille(axis, c, th, a, b, y0, y1);
  }
  grille(axis: 'x' | 'z', c: number, th: number, a: number, b: number, y0: number, y1: number) {
    const B = this.b, m = 'm:#2f3236';
    const off = c + th + 0.04;
    if (axis === 'x') {
      for (let x = a + 0.06; x < b; x += 0.12) B.box(x, y0, off, 0.014, y1 - y0, 0.014, m);
      for (const y of [y0 + 0.02, (y0 + y1) / 2, y1 - 0.04]) B.box(a, y, off - 0.004, b - a, 0.02, 0.02, m);
    }
  }

  // ---------- stairs (dog-leg, 2 flights per floor) ----------
  private stairs(k: number) {
    const B = this.b, { W, t, xs, zs, zE, Lf } = this;
    const F0 = this.F(k), F1 = this.F(k + 1), half = F0 + this.FH / 2, rise = this.FH / 14, d = Lf / 7;
    const lw = 0.85, xL = xs, xR = xs + lw + 0.1, xE = W - t;
    const tread = k === 0 ? 'tile:#cfc8ba' : 'tile:#cfc8ba', riser = 'pi:#efe9db';
    const stepBox = (x: number, w: number, z: number, top: number, base: number) => B.box(x, base, z, w, top - base, d, 'pi:#e7e1d3', { py: tread, nz: riser, pz: null });
    // flight A: lane L, ascending +z
    for (let i = 0; i < 7; i++) {
      const top = F0 + (i + 1) * rise;
      stepBox(xL, lw, zs + i * d, top, k === 0 ? 0.0 : top - 0.4);
    }
    // landing
    B.box(xL, half - 0.25, zs + Lf, xE - xL, 0.25, zE - zs - Lf, 'pi:#e7e1d3', { py: tread, ny: 'pi:#f3f0e8' });
    if (k === 0) B.box(xL, 0, zs + Lf, xE - xL, half - 0.25, zE - zs - Lf, 'pi:#e7e1d3');
    // flight B: lane R, ascending toward -z, from landing (half) to F1 at z = zs
    for (let i = 0; i < 7; i++) {
      const top = half + (i + 1) * rise, z = zs + Lf - (i + 1) * d;
      B.box(xR, top - 0.4, z, xE - xR, 0.4, d, 'pi:#e7e1d3', { py: tread, pz: riser, nz: null, ny: i === 0 ? null : null });
    }
    // under-flight B closure + cabinet at the ground floor
    if (k === 0) {
      B.box(xR - 0.1, 0, zs, xE - xR + 0.1, F1 - 0.4, 0.08, 'pi:#efe9db', { nz: 'woodF:#a98258', pz: null });
      for (let i = 0; i < 2; i++) B.box(xR - 0.05 + i * ((xE - xR) / 2), 0.12, zs - 0.012, (xE - xR) / 2 - 0.06, 1.7, 0.012, 'woodP:#b48d62');
      B.box(xR + 0.55, 0.9, zs - 0.03, 0.02, 0.18, 0.03, 'm:#bbb');
      this.b.col(xR - 0.1, F0, zs, xE - xR + 0.1, 1.0, zE - zs, 'underStair');
      B.contact((xR + xE) / 2, zs - 0.2, xE - xR, 0.3, F0);
    }
    // mid divider (balustrade between flights) + left rail
    const rail = 'm:#2b2d30', wood = 'woodP:#6e4a2e';
    const balus = (x: number, zA: number, zB: number, yA: number, yB: number) => {
      const len = Math.hypot(zB - zA, yB - yA), ang = Math.atan2(yB - yA, zB - zA);
      B.push(x, yA + 0.92, zA, 0, -ang); B.box(-0.03, 0, 0, 0.06, 0.05, len, wood); B.pop();
      const nb = Math.floor(len / 0.13);
      for (let i = 0; i <= nb; i++) { const f = i / nb, y = yA + (yB - yA) * f, z = zA + (zB - zA) * f; B.box(x - 0.008, y, z - 0.008, 0.016, 0.92, 0.016, rail); }
    };
    balus(xs + 0.015, zs, zs + Lf, F0, half);
    balus(xs + lw + 0.05, zs, zs + Lf, F1, half);
    // top rail on upper floor edge along stair hole (x = xs side) and landing back
    B.col(xs, F0, zs, 0.06, this.FH, zE - zs, 'rail');
    B.col(xs + lw, F0, zs, 0.1, this.FH, Lf, 'rail');
    if (k > 0 || true) {
      // upper-floor balustrade along hole edge on floor F0 (for flights ascending from here) is the same as above
    }
    // walkable ramps
    B.surf(xL, zs, xL + lw, zs + Lf, F0, 'wood', { p0: [0, zs], p1: [0, zs + Lf], y1: half });
    B.surf(xs, zs + Lf, xE, zE, half, 'wood');
    B.surf(xR, zs, xE, zs + Lf, half, 'wood', { p0: [0, zs + Lf], p1: [0, zs], y1: F1 });
    // stairwell side wall light fixtures: wall lamp later in rooms
  }
}

export function houseHit(h: House, ...a: Parameters<typeof hit> extends [any, ...infer R] ? R : never) { return (hit as any)(h, ...a); }
