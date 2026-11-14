import * as THREE from 'three';
import { tr } from './strings';
import type { House } from './house';
import type { Room, Spot } from './types';
import { mulberry32 } from './util';
import { makeRoomLight, lightSwitch, curtain, ceilingFan, faucet, shower, flush, gasStove, riceCooker, radio, aircon, washer, tv, fridge, wallClock, incense, sitSpot, steam } from './devices';
import * as F from './furniture';

const PI = Math.PI;
const SOFA = ['#6f7a86', '#7a5a4a', '#5a7a68', '#8a6a52', '#4f6a86'];
const BLANK = ['#6c8fb0', '#b4636b', '#7ba07a', '#c9a24b', '#8a76b0'];

export function furnishRoom(h: House, room: Room) {
  const B = h.b, { W, D, t, ph, xs, zs, zf, kz0, xw, zw } = h, y = h.F(room.k), k = room.k, sp = h.spec;
  const r = mulberry32(sp.seed * 131 + k * 17 + room.id.length * 7);
  const spot = (name: string, s: Omit<Spot, 'k' | 'room'>) => { h.spots[name] = { ...s, k, room: room.id }; };
  const col = SOFA[sp.seed % SOFA.length], bl = BLANK[(sp.seed + k) % BLANK.length];
  const light = (x: number, z: number, type: 'disc' | 'tube' | 'bulb' = 'disc', color = 0xffe0b0, power = 1) => makeRoomLight(h, room, x, y + h.CH, z, type, color, power);
  const sw = (x: number, z: number, nrm: 'px' | 'nx' | 'pz' | 'nz', yy = 1.3) => lightSwitch(h, room, x, y + yy, z, nrm);
  const fan = (x: number, z: number, id: string) => ceilingFan(h, x, y + h.CH, z, `${h.id}.${k}.${id}`, false);
  const pic = (x: number, yy: number, z: number, yaw: number, w = 0.5, hh = 0.35) => F.framePic(B, x, y + yy, z, yaw, w, hh, Math.floor(r() * 9));
  const ac = (x: number, yy: number, z: number, n: 'px' | 'nx' | 'pz' | 'nz', id = 'ac') => aircon(h, room, `${h.id}.${k}.${id}`, x, y + yy, z, n);
  const id = (s: string) => `${h.id}.${k}.${s}`;

  switch (room.kind) {
    case 'living': case 'garage': {
      const garage = room.kind === 'garage';
      light(W / 2, 1.35); fan(W / 2, 3.3, 'fan'); sw(t, 0.6, 'px');
      const sx = W - t - 0.45, sz = 2.45;
      F.sofa(B, sx, y, sz, -PI / 2, col); F.coffeeTable(B, sx - 0.95, y, sz, -PI / 2);
      F.rug(B, sx - 0.95, y, sz, 1.5, 2.2, '#8a3a30');
      const tz = garage ? 3.7 : 2.6;
      F.tvCabinet(B, t + 0.22, y, tz, PI / 2, 1.5); tv(h, room, id('tv'), t + 0.22, y + 0.52, tz, PI / 2, 0.95);
      ac(t, 2.2, tz, 'px'); F.altarTable(B, W - t - 0.25, y, 4.2, -PI / 2, 1.0, true);
      incense(h, id('inc'), W - t - 0.36, y + 1.02, 4.2, 0);
      F.calendar(B, t, y + 1.5, 1.35, PI / 2); pic(W - t, 1.55, sz, -PI / 2, 0.7, 0.45);
      F.shoeRack(B, t + 0.17, y, garage ? 3.1 : 0.9, PI / 2, 0.7);
      F.plant(B, W - t - 0.3, y, 0.55, 1.1, 5 + sp.seed);
      wallClock(h, W - t, y + 2.25, 1.0, 'nx');
      if (garage) { F.motorbike(B, 0.8, y, 1.4, PI, ['#c92f2a', '#2a5aa0', '#222'][sp.seed % 3]); }
      curtain(h, room, 3.0, y + 0.8, t + 0.04, 1.4, 1.5, 'pz', '#e6d8bd');
      sitSpot(h, sx, y, sz, 1.9, 0.9, -PI / 2, tr('act.sitSofa'), 1.05);
      spot('tv', { x: sx - 0.05, z: sz, yaw: -PI / 2, pose: 'sit', device: id('tv') });
      spot('pray', { x: W - t - 1.05, z: 4.2, yaw: PI / 2, pose: 'stand', device: id('inc') });
      spot('lounge', { x: sx - 0.05, z: sz + 0.5, yaw: -PI / 2, pose: 'sit' });
      break;
    }
    case 'shop': case 'cafe': case 'pho': {
      light(W / 2, 2.0, 'tube', 0xf6f8ff, 1.1); fan(W / 2, 3.7, 'fan'); sw(t, 0.6, 'px');
      F.counter(B, W - t - 0.85, y, 1.0, PI, 1.7, 0.6, 0.9, 'tile:#46484c', room.kind === 'pho' ? 'm:#aeb4ba' : 'woodF:#c9bfae');
      F.stool(B, W - t - 0.85, y, 1.78, room.kind === 'cafe' ? '#2a7fd0' : '#d9382a');
      radio(h, id('radio'), W - t - 0.45, y + 0.93, 1.0, PI);
      F.calendar(B, W - t, y + 1.6, 3.4, -PI / 2);
      if (room.kind === 'shop') {
        F.shelfUnit(B, t + 0.2, y, 2.55, PI / 2, 3.3, 1.95, sp.seed);
        F.drinkFridge(B, W - t - 0.31, y, 2.65, -PI / 2); F.chestFreezer(B, W - t - 0.33, y, 3.9, -PI / 2, 1.1);
        for (let i = 0; i < 12; i++) B.quad('laundry:' + ['#d6362a', '#2f6fc0', '#f2c230', '#2f9a52', '#e84a8a'][i % 5], [0.5 + i * 0.11, y + 2.25, t + 0.12], [0.6 + i * 0.11, y + 2.25, t + 0.12], [0.6 + i * 0.11, y + 2.62, t + 0.12], [0.5 + i * 0.11, y + 2.62, t + 0.12], [0, 0, 1, 0, 1, 1, 0, 1]);
        B.box(0.45, y + 2.6, t + 0.1, 1.4, 0.015, 0.015, 'm:#aaa');
        B.box(W - t - 0.8, y + 0.93, 0.85, 0.3, 0.2, 0.28, 'g:#d8d2c0'); B.box(W - t - 1.4, y + 0.93, 1.05, 0.32, 0.03, 0.22, 'm:#aaa');
        B.box(t + 0.55, y, 3.5, 0.5, 0.35, 0.4, 'woodF:#a78a64'); // sacks/crates
        spot('shop', { x: W - t - 0.85, z: 1.78, yaw: PI, pose: 'sit', device: id('radio') });
      } else if (room.kind === 'cafe') {
        F.shelfUnit(B, t + 0.2, y, 1.9, PI / 2, 2.0, 1.9, sp.seed + 2);
        B.box(W - t - 1.5, y + 0.93, 0.8, 0.4, 0.32, 0.35, 'm:#9aa0a5'); B.box(W - t - 1.45, y + 1.25, 0.82, 0.3, 0.05, 0.3, 'm:#444');
        for (let i = 0; i < 4; i++) { B.cyl(W - t - 0.5 + (i % 2) * 0.12, y + 0.93, 0.8 + Math.floor(i / 2) * 0.1, 0.035, 0.04, 'm:#cfd3d6', 8); B.cyl(W - t - 1.0 + i * 0.1, y + 0.93, 1.15, 0.03, 0.06, 'g:#f4f0e6', 8); }
        F.lowTable(B, 0.95, y, 3.0, '#3b78d6'); F.stool(B, 0.95, y, 3.5, '#d9382a'); F.stool(B, 0.95, y, 2.5, '#2a9fd6'); F.stool(B, 1.45, y, 3.0, '#e8c02a');
        F.lowTable(B, W - t - 0.55, y, 3.6, '#e8b02a'); F.stool(B, W - t - 1.05, y, 3.6, '#d9382a'); F.stool(B, W - t - 0.55, y, 4.15, '#2a7fd0');
        tv(h, room, id('tv'), t, y + 1.75, 4.2, PI / 2, 0.8);
        spot('shop', { x: W - t - 0.85, z: 1.78, yaw: PI, pose: 'sit', device: id('radio') });
        spot('tv', { x: 1.45, z: 3.4, yaw: -PI / 2, pose: 'sit', device: id('tv') });
      } else {
        // phở stall
        B.cyl(W - t - 1.2, y + 0.93, 0.95, 0.3, 0.42, 'm:#b8bcc0', 20); B.cyl(W - t - 1.2, y + 1.35, 0.95, 0.31, 0.03, 'm:#a8acb0', 20);
        B.cyl(W - t - 0.5, y + 0.93, 0.9, 0.2, 0.22, 'm:#b8bcc0', 16);
        for (let i = 0; i < 8; i++) B.cyl(W - t - 1.75, y + 0.93 + i * 0.03, 0.8, 0.08, 0.03, 'g:#f4f2ea', 10, 0.07);
        const s2 = steam(h, W - t - 1.2, y + 1.4, 0.95, { n: 18, size: 0.5, spread: 0.1, rise: 1.0, op: 0.32 }); s2.active = true;
        F.drinkFridge(B, t + 0.35, y, 3.9, PI / 2, 0.9, 1.7);
        F.lowTable(B, 1.0, y, 1.8, '#3b78d6'); F.stool(B, 1.0, y, 2.3, '#2a9fd6'); F.stool(B, 1.5, y, 1.8, '#d9382a'); F.stool(B, 0.55, y, 1.8, '#e8c02a');
        F.lowTable(B, 1.0, y, 3.2, '#3b78d6'); F.stool(B, 1.0, y, 3.7, '#d9382a'); F.stool(B, 1.5, y, 3.2, '#2a9fd6');
        spot('shop', { x: W - t - 1.2, z: 1.55, yaw: PI, pose: 'cook', device: id('radio') });
      }
      spot('lounge', { x: W - t - 0.85, z: 1.78, yaw: PI, pose: 'phone' });
      break;
    }
    case 'repair': {
      light(W / 2, 2.2, 'tube', 0xf6f8ff, 1.1); sw(t, 0.6, 'px'); fan(W / 2, 3.6, 'fan');
      F.motorbike(B, 2.35, y, 2.3, PI, '#3a3a3e');
      F.counter(B, t + 0.32, y, 3.0, PI / 2, 2.4, 0.6, 0.9, 'woodF:#5a4a38', 'm:#5a5f66');
      B.box(t + 0.01, y + 1.2, 1.6, 0.03, 0.9, 2.8, 'woodF:#8a7a62');
      for (let i = 0; i < 14; i++) B.box(t + 0.04, y + 1.35 + (i % 3) * 0.22, 1.8 + i * 0.18, 0.04, 0.16, 0.025, 'm:#b8bcc0');
      for (let i = 0; i < 3; i++) B.cyl(W - t - 0.45, y + i * 0.2, 4.1, 0.3, 0.2, 'r:#1a1a1a', 14);
      B.cyl(W - t - 0.35, y, 3.3, 0.28, 0.85, 'm:#2a5aa0', 14); B.cyl(W - t - 1.0, y, 4.3, 0.28, 0.85, 'm:#a83a2a', 14);
      B.col(W - t - 0.7, y, 3.0, 0.7, 1.0, 1.4);
      B.box(1.2, y + 0.005, 3.0, 1.1, 0.012, 0.9, 'r:#17140f', {});
      F.stool(B, 1.5, y, 4.0, '#2a7fd0');
      spot('shop', { x: 1.3, z: 3.0, yaw: 0, pose: 'work', device: id('radio') });
      radio(h, id('radio'), t + 0.4, y + 0.93, 3.0, PI / 2);
      spot('lounge', { x: 1.5, z: 3.95, yaw: 0, pose: 'phone' });
      break;
    }
    case 'hair': {
      light(W / 2, 2.2, 'tube', 0xf6f8ff, 1.1); sw(t, 0.6, 'px'); fan(W / 2, 3.6, 'fan');
      F.counter(B, W - t - 0.22, y, 2.3, -PI / 2, 2.8, 0.4, 0.82, 'tile:#3b3b3d', 'woodF:#cfc7b8');
      for (const z of [1.5, 3.1]) { F.mirrorWall(B, W - t - 0.0, y + 1.05, z, -PI / 2, 1.1, 0.95); F.barberChair(B, W - t - 1.1, y, z, PI / 2); }
      F.sofa(B, t + 0.45, y, 3.5, PI / 2, '#7a3a2a', 1.4);
      B.cyl(t + 0.3, y, 0.7, 0.05, 0.9, 'g:#f4f4f4', 8); B.cyl(t + 0.3, y + 0.9, 0.7, 0.06, 0.12, 'g:#2a5aa0', 8);
      radio(h, id('radio'), W - t - 0.4, y + 0.85, 2.3, -PI / 2);
      spot('shop', { x: W - t - 1.9, z: 2.3, yaw: PI / 2, pose: 'stand', device: id('radio') });
      spot('lounge', { x: 0.95, z: 3.5, yaw: PI / 2, pose: 'sit' });
      break;
    }
    case 'hall': {
      const zc = (room.z0 + room.z1) / 2;
      if (room.id.endsWith('.lobby')) {
        light(W / 2, (room.z0 + room.z1) / 2, 'disc', 0xfff0d0, 0.9); sw(t + 1.45, zf + ph, 'pz');
        F.plant(B, t + 0.35, y, zf + 0.5, 1.2, 11 + k); pic(W - t, 1.6, 4.3, -PI / 2, 0.6, 0.4); F.calendar(B, W - t, y + 1.4, 4.1, -PI / 2);
        B.box(W - t - 0.3, y, 4.2, 0.28, 0.75, 0.6, 'woodF:#6a4a30'); B.cyl(W - t - 0.16, y + 0.75, 4.2, 0.06, 0.22, 'g:#3a6ea5', 10, 0.04);
      } else {
        light(h.spineX, zc, 'bulb', 0xffe6b0, 0.8); sw(t, room.z0 + 0.3, 'px');
        if (k === 0) { F.shoeRack(B, t + 0.17, y, room.z0 + 1.4, PI / 2, 0.8); }
        pic(t, 1.6, zc + 0.6, PI / 2, 0.5, 0.7);
        F.plant(B, t + 0.3, y, room.z1 - 0.5, 1.0, 21 + k);
      }
      void zs; void kz0;
      break;
    }
    case 'bedroom': {
      const front = room.id.endsWith('.front'), single = room.id.endsWith('.bed');
      if (single) {
        F.bed(B, W - t - 1.0, y, zs + 1.9, -PI / 2, 1.4, 2.0, bl); F.wardrobe(B, xs + ph + 0.3, y, kz0 - 1.1, PI / 2, 1.2); F.nightstand(B, W - t - 0.2, y, zs + 0.9, -PI / 2);
        light((xs + W) / 2, zs + 2.1); fan((xs + W) / 2, zs + 1.0, 'fan'); ac(W - t, 2.2, zs + 1.9, 'nx'); sw(xs + ph, zs + 0.2 + 0.5, 'px', 1.3);
        spot('bed', { x: W - t - 1.3, z: zs + 1.9, yaw: PI / 2, pose: 'lie', y: 0.62 });
        curtain(h, room, W - t - 0.5, y + 0.0, kz0 - 0.08, 1.0, 2.0, 'nz', '#d9d1e4');
        break;
      }
      if (front) {
        F.bed(B, W - t - 1.0, y, 2.75, -PI / 2, 1.6, 2.0, bl); F.nightstand(B, W - t - 0.2, y, 1.75, -PI / 2);
        F.wardrobe(B, t + 0.3, y, 2.2, PI / 2, 1.7);
        light(W / 2, 2.4); fan(W / 2, 1.2, 'fan'); ac(W - t, 2.2, 2.75, 'nx'); sw(t + 1.45, zf, 'nz');
        pic(W - t, 1.55, 1.75, -PI / 2, 0.5, 0.35); wallClock(h, t, y + 2.1, 3.3, 'px');
        curtain(h, room, W / 2, y, t + 0.07, W - 1.0, 2.4, 'pz', ['#d7c9b0', '#c9d6dd', '#e0c9cf'][sp.seed % 3]);
        F.rug(B, 1.2, y, 2.0, 1.0, 1.6, '#9a6a4a');
        sitSpot(h, W - t - 1.0, y + 0.25, 2.75, 1.6, 2.0, -PI / 2, tr('act.lieBed'), 0.95);
        spot('bed', { x: W - t - 1.1, z: 2.75, yaw: PI / 2, pose: 'lie', y: 0.62 });
        spot('lounge', { x: 1.0, z: 1.2, yaw: PI, pose: 'phone' });
      } else {
        const a0 = kz0 + ph;
        F.bed(B, W - t - 1.0, y, a0 + 1.5, -PI / 2, 1.5, 2.0, bl); F.nightstand(B, W - t - 0.2, y, a0 + 0.55, -PI / 2);
        F.wardrobe(B, t + 0.3, y, a0 + 1.9, PI / 2, 1.5);
        F.desk(B, 1.1, y, D - t - 0.3, PI, 1.2);
        light(W / 2, a0 + 2.3); fan(W / 2, a0 + 1.0, 'fan'); ac(W - t, 2.2, a0 + 1.5, 'nx'); sw(Math.min(xs - 0.2, t + 1.1) + 0.12, kz0 + ph, 'pz');
        pic(t, 1.6, a0 + 2.9, PI / 2, 0.6, 0.4);
        if (h.hasWell) curtain(h, room, (xs + 0.35 + W - t - 0.35) / 2, y + 0.95, kz0 + ph + 0.05, 1.2, 1.4, 'pz', '#dfe3d2');
        curtain(h, room, 1.2, y + 0.9, D - t - 0.05, 1.0, 1.45, 'nz', '#e6d9c6');
        F.rug(B, 1.4, y, a0 + 1.6, 1.0, 1.5, '#4a6a8a');
        sitSpot(h, W - t - 1.0, y + 0.25, a0 + 1.5, 1.5, 2.0, -PI / 2, tr('act.lieBed'), 0.95);
        spot('bed', { x: W - t - 1.1, z: a0 + 1.5, yaw: PI / 2, pose: 'lie', y: 0.62 });
        spot('desk', { x: 1.1, z: D - t - 0.95, yaw: 0, pose: 'work' });
        spot('lounge', { x: 1.0, z: a0 + 0.8, yaw: PI, pose: 'phone' });
      }
      break;
    }
    case 'study': {
      light(W / 2, 2.4, 'disc', 0xfff4dc); fan(W / 2, 1.3, 'fan'); sw(t + 1.45, zf, 'nz'); ac(W - t, 2.2, 2.4, 'nx');
      F.desk(B, W / 2 + 0.3, y, 1.15, 0, 1.4); F.bookshelf(B, W - t - 0.15, y, 2.4, -PI / 2, 1.6); F.sofa(B, t + 0.45, y, 1.9, PI / 2, '#8a6a4a', 1.5);
      F.plant(B, t + 0.35, y, 0.55, 1.2, 31); pic(t, 1.6, 2.6, PI / 2, 0.7, 0.45);
      curtain(h, room, W / 2, y, t + 0.07, W - 1.0, 2.4, 'pz', '#c9d6dd');
      spot('desk', { x: W / 2 + 0.3, z: 1.82, yaw: PI, pose: 'work' });
      spot('lounge', { x: 1.0, z: 1.9, yaw: PI / 2, pose: 'sit' });
      break;
    }
    case 'altar': {
      light(W / 2, 2.0, 'disc', 0xffe2a0, 0.8); fan(W / 2, 1.0, 'fan'); sw(t + 1.45, zf, 'nz');
      F.altarTable(B, W - t - 0.25, y, 1.9, -PI / 2, 1.7, true); incense(h, id('inc'), W - t - 0.36, y + 1.02, 1.9, 0);
      F.rug(B, 2.0, y, 2.0, 1.6, 1.4, '#a8332a'); F.plant(B, t + 0.35, y, 0.6, 1.1, 41); F.plant(B, t + 0.35, y, 3.3, 1.0, 43, 'dark');
      curtain(h, room, W / 2, y, t + 0.07, W - 1.0, 2.4, 'pz', '#e8d8b0');
      for (let i = 0; i < 3; i++) B.cyl(0.55 + i * 0.4, y + 2.45, 0.35, 0.12, 0.3, 'emit:#e0361e', 10, 0.1);
      spot('pray', { x: W - t - 1.1, z: 1.9, yaw: PI / 2, pose: 'stand', device: id('inc') });
      break;
    }
    case 'kitchen': {
      const z0c = kz0 + 0.2, len = zw - kz0 - 0.4, zc = (kz0 + zw) / 2;
      light(1.3, zc, 'tube', 0xf6f8ff, 1.0); sw(t, kz0 + 0.12, 'px');
      F.counter(B, t + 0.3, y, z0c + len / 2, PI / 2, len, 0.6);
      B.box(t, y + 0.88, z0c, 0.012, 0.7, len, 'tileW:#e5ecee');
      F.sinkUnit(B, t + 0.3, y, z0c + 0.45, PI / 2); faucet(h, id('sink'), t + 0.1, y + 0.9, z0c + 0.45, PI / 2, y + 0.84, tr('noun.sinkTap'));
      const zst = z0c + len * 0.6, zrc = z0c + len - 0.25;
      gasStove(h, id('stove'), t + 0.3, y + 0.9, zst, PI / 2); riceCooker(h, id('rice'), t + 0.3, y + 0.9, zrc, PI / 2);
      B.box(t, y + 1.6, zst - 0.4, 0.5, 0.4, 0.8, 'm:#c9ccd0'); B.box(t, y + 2.0, zst - 0.12, 0.3, 0.35, 0.24, 'm:#b8bcc0');
      B.box(t, y + 1.55, z0c, 0.34, 0.7, 0.7, 'woodF:#c9bda8'); B.box(t, y + 1.55, zst + 0.45, 0.34, 0.7, Math.max(0.3, z0c + len - zst - 0.45), 'woodF:#c9bda8');
      B.box(t + 0.05, y + 0.9, z0c + 0.95, 0.3, 0.005, 0.4, 'm:#ccc'); for (let i = 0; i < 5; i++) B.cyl(t + 0.2, y + 0.94, z0c + 1.0 + i * 0.07, 0.11, 0.012, 'g:#f4f2ea', 12);
      B.cyl(t + 0.3, y + 0.9, zst + 0.5, 0.06, 0.04, 'g:#c8321e', 8);
      fridge(h, id('fridge'), W - t - 0.36, y, zw - 0.45, -PI / 2);
      const tz = kz0 + Math.min(1.5, (zw - kz0) / 2 - 0.15), tx = (xs + W - t) / 2 + 0.05;
      F.diningTable(B, tx, y, tz, PI / 2, 1.2, 0.72, 4);
      B.cyl(tx, y + 2.45, tz, 0.02, 0.65, 'r:#222', 6); B.cyl(tx, y + 2.35, tz, 0.16, 0.14, 'emit:#fff1c9', 12, 0.1);
      wallClock(h, W - t, y + 2.05, zc + 0.4, 'nx'); pic(W - t, 1.55, tz + 0.1, -PI / 2, 0.5, 0.35);
      spot('cook', { x: t + 0.98, z: zst, yaw: -PI / 2, pose: 'cook', device: id('stove') });
      spot('rice', { x: t + 0.98, z: zrc, yaw: -PI / 2, pose: 'cook', device: id('rice') });
      spot('eat1', { x: tx - 0.66, z: tz, yaw: PI / 2, pose: 'eat' }); spot('eat2', { x: tx + 0.66, z: tz, yaw: -PI / 2, pose: 'eat' });
      spot('eat3', { x: tx, z: tz - 0.88, yaw: 0, pose: 'eat' }); spot('eat4', { x: tx, z: tz + 0.88, yaw: PI, pose: 'eat' });
      F.rug(B, 1.1, y, zc, 0.8, 1.4, '#8a4a3a');
      break;
    }
    case 'laundry': {
      light(1.1, zw + 1.3, 'bulb', 0xfff0d0, 0.8); sw(t, zw + 0.3, 'px');
      washer(h, id('washer'), t + 0.3, zw + 1.0, PI / 2, y);
      F.counter(B, 1.4, y, D - t - 0.29, PI, 1.0, 0.55, 0.85, 'm:#c9ced3', 'g:#d8dcde');
      B.box(0.95, y + 0.85, D - t - 0.5, 0.9, 0.0, 0.0, 'm:#000'); B.box(1.0, y + 0.8, D - t - 0.48, 0.8, 0.08, 0.4, 'r:#1a1a1a', { py: 'm:#aab0b4' });
      faucet(h, id('wash'), 1.4, y + 0.87, D - t - 0.03, PI, y + 0.82, tr('noun.laundryTap'));
      B.cyl(1.35, y, zw + 0.6, 0.17, 0.3, 'g:#2a9fd6', 12, 0.2); F.stool(B, 1.2, y, zw + 1.05, '#d9382a');
      B.cyl(1.6, y, zw + 0.25, 0.16, 0.5, 'g:#e8c02a', 10, 0.2);
      const zA = zw + 0.1, zB = D - t - 0.1;
      B.box(1.05, y + 2.15, zA, 0.02, 0.02, zB - zA, 'm:#aaa');
      for (let z = zA + 0.15; z < zB - 0.4; z += 0.38) B.quad('laundry:' + ['#e8567a', '#4d86d6', '#f0c24a', '#e9e4d6', '#7ec27a'][Math.floor(r() * 5)], [1.05, y + 1.4 + r() * 0.2, z], [1.05, y + 1.4 + r() * 0.2, z + 0.28], [1.05, y + 2.15, z + 0.28], [1.05, y + 2.15, z], [0, 0, 1, 0, 1, 1, 0, 1]);
      curtain(h, room, 1.2, y + 1.0, D - t - 0.05, 1.0, 1.3, 'nz', '#e6d9c6');
      spot('wash', { x: 1.45, z: D - t - 0.95, yaw: 0, pose: 'wash', device: id('wash') });
      spot('laundry', { x: t + 1.0, z: zw + 1.0, yaw: -PI / 2, pose: 'wash', device: id('washer') });
      break;
    }
    case 'wc': {
      light((xw + W - t) / 2, (zw + D - t) / 2, 'bulb', 0xfff2d0, 0.9);
      lightSwitch(h, room, xw - ph, y + 1.3, zw + 1.35, 'nx', tr('noun.wcLight'));
      F.toilet(B, W - t - 0.45, y, D - t - 0.4, PI); flush(h, W - t - 0.45, y + 0.82, D - t - 0.25, 0);
      F.basin(B, W - t - 0.22, y, zw + 0.75, -PI / 2); faucet(h, id('basin'), W - t - 0.12, y + 0.9, zw + 0.75, -PI / 2, y + 0.88, tr('noun.basinTap'));
      shower(h, id('shower'), xw + 0.03, y + 2.05, zw + 1.75, y, PI / 2);
      B.cyl(xw + 0.65, y, zw + 1.75, 0.09, 0.012, 'm:#8a8f94', 14);
      B.cyl(xw + 0.35, y, zw + 2.15, 0.15, 0.3, 'g:#2a7fd0', 12, 0.19); B.box(xw + 0.3, y + 0.3, zw + 2.0, 0.02, 0.02, 0.2, 'g:#2a7fd0');
      F.waterHeater(B, W - t - 0.32, y + 1.85, D - t, PI);
      B.box(xw + 0.01, y + 1.5, zw + 0.5, 0.02, 0.3, 0.3, 'g:#fff'); B.box(W - t - 0.04, y + 1.4, zw + 1.2, 0.04, 0.04, 0.3, 'm:#bbb');
      spot('bath', { x: xw + 0.55, z: zw + 1.75, yaw: -PI / 2, pose: 'stand', device: id('shower') });
      break;
    }
    case 'well': {
      B.surf(xs + 0.08, h.zE + 0.1, W - t - 0.08, wz1m(h) - 0.1, y + 0.06, 'concrete');
      B.box(xs + 0.08, y, h.zE + 0.1, W - t - xs - 0.16, 0.06, wz1m(h) - h.zE - 0.2, 'r:#4a3c2e', { ny: null });
      for (let i = 0; i < 9; i++) B.cyl(xs + 0.25 + r() * 1.3, y + 0.05, h.zE + 0.25 + r() * 1.0, 0.07 + r() * 0.06, 0.07, 'r:#8c8a84', 7);
      B.cyl(W - t - 0.45, y + 0.05, h.zE + 0.5, 0.0, 0.0, 'r:#000');
      B.leaves(xs + 0.55, y + 1.3, h.zE + 0.55, 0.85, 40, 'leaf:banyan', sp.seed + 3, 1.5); B.cyl(xs + 0.55, y + 0.05, h.zE + 0.55, 0.05, 1.1, 'r:#6a8a3a', 6);
      B.leaves(W - t - 0.55, y + 1.0, h.zE + 1.0, 0.55, 22, 'leaf:green', sp.seed + 4, 1.2);
      B.cyl(W - t - 0.55, y + 0.05, h.zE + 1.0, 0.18, 0.3, 'g:#b5532e', 12, 0.22);
      B.box(xs + 0.9, y + 0.06, wz1m(h) - 0.35, 0.28, 0.05, 0.28, 'm:#777'); // drain grate
      F.stool(B, xs + 1.3, y + 0.05, h.zE + 0.4, '#2a9fd6');
      break;
    }
    default: break;
  }
  void zs;
}
function wz1m(h: House) { return h.wz1; }

export function furnishExtras(h: House) {
  const B = h.b, { W, D, n } = h, r = mulberry32(h.spec.seed * 71 + 9);
  // rain pipes on the side walls and meter box on the facade
  const top = h.F(n - 1) + h.CH;
  for (const [x, z] of [[-0.05, D - 0.5], [W + 0.05, D - 0.5], [-0.05, 1.0], [W + 0.05, 1.0]] as [number, number][]) {
    if (r() < 0.5) continue; B.cyl(x, 0, z, 0.035, top, 'g:#e5e1d6', 8);
    for (let k = 0; k < 4; k++) B.cyl(x, 0.5 + k * (top / 4), z, 0.045, 0.05, 'g:#d8d4c8', 8);
  }
  B.box(W - 0.6, h.F(0) + 1.45, -0.0, 0.0, 0, 0, 'm:#000');
  const mx = Math.min(W - 0.7, 2.6);
  B.box(mx, h.F(0) + 1.55, -0.1, 0.26, 0.32, 0.1, 'g:#e8e6e0'); B.box(mx + 0.04, h.F(0) + 1.62, -0.105, 0.18, 0.1, 0.006, 'glass');
  B.box(mx + 0.11, h.F(0) + 1.4, -0.03, 0.02, 0.15, 0.02, 'r:#222');
  // wall sockets (ổ cắm) with two-pin slots on the left wall of habitable rooms
  for (const rm of h.rooms) {
    if (['well', 'wellup', 'hall', 'wc'].includes(rm.kind) || Math.abs(rm.x0 - h.t) > 0.01) continue;
    const yy = h.F(rm.k) + 0.32, zc = (rm.z0 + rm.z1) / 2 + 0.5;
    if (zc > rm.z1 - 0.3) continue;
    B.box(h.t, yy, zc - 0.045, 0.012, 0.09, 0.09, 'g:#f3f1ea');
    B.box(h.t + 0.012, yy + 0.03, zc - 0.012, 0.003, 0.012, 0.004, 'r:#1d1d1d');
    B.box(h.t + 0.012, yy + 0.055, zc - 0.012, 0.003, 0.012, 0.004, 'r:#1d1d1d');
  }
  // entrance: a pair of worn sandals and two helmets set down by the door
  const y0 = h.F(0);
  B.rb('woodP:#8a5a34', 1.62, y0, 0.45, 0.1, 0.025, 0.25, 0.01);
  B.rb('woodP:#8a5a34', 1.78, y0, 0.45, 0.1, 0.025, 0.25, 0.01);
  // placed well away from the spawn point so they never fill the first-person view
  B.geo('g:#d8322a', new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 3.1, y0, 0.6);
  B.geo('g:#e8e4d8', new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 3.36, y0, 0.62);
  void sitSpot;
}
