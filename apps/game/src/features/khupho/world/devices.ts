import * as THREE from 'three';
import { tr } from './strings';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeGroup } from './builder';
import { mat } from './materials';
import { glowTex } from './textures';
import type { House } from './house';
import type { Device, Room, RoomLight } from './types';

let _glow: THREE.Texture | null = null;
const glow = () => (_glow ??= glowTex());
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

/**
 * Marks device parts that never move, never toggle and never change material after build, so
 * `mergeDevices` (staticMerge.ts) may merge them. A marked group marks all of its meshes; only mark
 * a group whose own transform is fixed. Everything that moves or toggles stays unmarked.
 */
function markStatic(...objs: THREE.Object3D[]) {
  for (const o of objs) o.userData.staticDevice = true;
}
/** `makeGroup` whose result is marked static. */
function markStaticGroup(fn: Parameters<typeof makeGroup>[0]): THREE.Group {
  const g = makeGroup(fn);
  markStatic(g);
  return g;
}

/** Materials that were created per device with identical constant values; shared so merged parts collapse into one draw. */
const SWITCH_LED_MAT = new THREE.MeshBasicMaterial({ color: '#ff5a2a' });
const FAN_BOWL_MAT = new THREE.MeshStandardMaterial({ color: '#f4efe0', roughness: 0.3, emissive: '#fff1c8', emissiveIntensity: 0.05, side: THREE.DoubleSide });
const TV_LED_MAT = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff2020', emissiveIntensity: 1.2 });

export function mkDevice(set: (on: boolean) => void, init = false): Device {
  const d: Device = { on: init, set(on) { d.on = on; set(on); }, toggle() { d.set(!d.on); } };
  set(init);
  return d;
}
let _streak: THREE.CanvasTexture | null = null;
function streak() {
  if (_streak) return _streak;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d')!;
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.7})`; x.fillRect(Math.random() * 64, Math.random() * 128, 1 + Math.random() * 2, 14 + Math.random() * 40); }
  _streak = new THREE.CanvasTexture(c); _streak.wrapS = _streak.wrapT = THREE.RepeatWrapping; return _streak;
}

export function hit(h: House, x: number, y: number, z: number, w: number, hh: number, d: number, label: string | (() => string), act: () => void, yaw = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), hitMat);
  m.position.set(x, y + hh / 2, z); m.rotation.y = yaw; h.group.add(m);
  h.addInteract(m, typeof label === 'string' ? () => label : label, act);
  return m;
}

// ---------------- hinged doors / windows ----------------
export interface DoorOpts {
  axis: 'x' | 'z'; c: number; th: number; a: number; b: number; y: number; hgt: number; hinge: 'a' | 'b'; swing: 1 | -1;
  mat?: string; glass?: boolean; open?: boolean; label?: string; bars?: boolean; frame?: string; colTag?: string; sound?: string; noCol?: boolean;
}
export function hingeDoor(h: House, o: DoorOpts): Device {
  const w = o.b - o.a, s = o.hinge === 'a' ? 1 : -1, pivot = o.hinge === 'a' ? o.a : o.b;
  const wood = o.mat ?? 'woodF:#a8744a', fr = o.frame ?? 'm:#cfd3d6';
  const leaf = makeGroup((b) => {
    const x0 = s > 0 ? 0 : -w, T = 0.04;
    if (o.glass) {
      const f = 0.05;
      b.box(x0, 0, -T / 2, w, f, T, fr); b.box(x0, o.hgt - f, -T / 2, w, f, T, fr);
      b.box(x0, 0, -T / 2, f, o.hgt, T, fr); b.box(x0 + w - f, 0, -T / 2, f, o.hgt, T, fr);
      b.box(x0 + f, f, -0.003, w - 2 * f, o.hgt - 2 * f, 0.006, 'glass');
      if (o.bars) for (let i = 1; i < Math.floor(w / 0.1); i++) b.box(x0 + i * 0.1, f, T / 2 + 0.005, 0.012, o.hgt - 2 * f, 0.012, 'm:#2a2a2a');
      if (o.hgt > 1.5) b.box(x0 + f, o.hgt * 0.46, -T / 2 - 0.003, w - 2 * f, 0.04, T + 0.006, fr);
    } else {
      b.box(x0, 0, -T / 2, w, o.hgt, T, wood);
      const pw = w - 0.2, ph1 = o.hgt * 0.36;
      for (const yy of [0.12, o.hgt * 0.52]) for (const zz of [-T / 2 - 0.006, T / 2]) b.box(x0 + 0.1, yy, zz, pw, ph1, 0.006, wood.replace('woodF', 'woodP'));
    }
    const hx = s > 0 ? w - 0.09 : -w + 0.05;
    b.box(hx, 1.0, -T / 2 - 0.04, 0.04, 0.012, 0.045, 'm:#b9bcc0'); b.box(hx, 1.0, T / 2 - 0.005, 0.04, 0.012, 0.045, 'm:#b9bcc0');
    b.box(hx + 0.005, 0.99, -T / 2 - 0.045, 0.03, 0.03, 0.008, 'm:#b9bcc0');
  });
  const piv = new THREE.Group(), holder = new THREE.Group();
  holder.position.set(o.axis === 'x' ? pivot : o.c + o.th / 2, o.y, o.axis === 'x' ? o.c + o.th / 2 : pivot);
  holder.rotation.y = o.axis === 'x' ? 0 : -Math.PI / 2;
  piv.add(leaf); holder.add(piv); h.group.add(holder);
  const sign = o.axis === 'x' ? (o.hinge === 'a' ? -o.swing : o.swing) : (o.hinge === 'a' ? o.swing : -o.swing);
  const maxA = sign * 1.65;
  let cur = o.open ? maxA : 0, tgt = cur;
  piv.rotation.y = cur;
  const col = o.noCol ? null : o.axis === 'x' ? h.dynCol(o.a, o.y, o.c, w, o.hgt, o.th) : h.dynCol(o.c, o.y, o.a, o.th, o.hgt, w);
  if (col) { col.enabled = !o.open; col.tag = o.colTag ?? 'door'; }
  const wpos = h.wp(o.axis === 'x' ? pivot : o.c, o.y + 1, o.axis === 'x' ? o.c : pivot);
  const dev = mkDevice((on) => {
    tgt = on ? maxA : 0; if (col) col.enabled = !on || false;
    if (col && on) setTimeout(() => { if (dev.on) col.enabled = false; }, 0);
    h.ctx.sfx.play(on ? (o.sound ? o.sound + 'open' : 'dooropen') : (o.sound ? o.sound + 'close' : 'doorclose'), wpos);
  }, !!o.open);
  if (o.open) { cur = tgt = maxA; }
  h.ctx.dyn.push((dt) => {
    if (Math.abs(cur - tgt) < 1e-3) { if (cur !== tgt) { cur = tgt; piv.rotation.y = cur; } return; }
    cur += (tgt - cur) * Math.min(1, dt * 5.5); piv.rotation.y = cur;
    if (col && tgt === 0 && Math.abs(cur) < 0.5) col.enabled = true;
  });
  h.addInteract(leaf, () => (dev.on ? tr('verb.close') : tr('verb.open')) + (o.label ?? tr('noun.door')), () => dev.toggle());
  h.doors.push(dev);
  return dev;
}

// ---------------- rolling shutter ----------------
export function shutter(h: House, o: { x0: number; x1: number; y0: number; y1: number; c: number; th: number; color: string; open?: boolean }): Device {
  const w = o.x1 - o.x0, hg = o.y1 - o.y0;
  const g = makeGroup((b) => { b.box(o.x0, -hg, o.c + 0.03, w, hg, 0.045, 'shut:' + o.color); });
  g.position.y = o.y1; h.group.add(g);
  const col = h.dynCol(o.x0, o.y0, o.c, w, hg, o.th);
  col.tag = 'shutter';
  let cur = o.open ? 0.07 : 1, tgt = cur;
  g.scale.y = cur; col.enabled = !o.open;
  const wpos = h.wp((o.x0 + o.x1) / 2, o.y0 + 1, o.c);
  const dev = mkDevice((on) => { tgt = on ? 0.07 : 1; if (!on) col.enabled = true; else setTimeout(() => (col.enabled = false), 300); h.ctx.sfx.play('shutter', wpos); }, !!o.open);
  cur = tgt;
  g.scale.y = cur;
  h.ctx.dyn.push((dt) => {
    if (Math.abs(cur - tgt) < 1e-3) return;
    cur += Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), dt * 0.9); g.scale.y = cur;
  });
  h.addInteract(g, () => (dev.on ? tr('act.shutterDown') : tr('act.shutterUp')), () => dev.toggle());
  h.doors.push(dev);
  return dev;
}

// ---------------- lights & switches ----------------
export function makeRoomLight(h: House, room: Room, x: number, y: number, z: number, type: 'disc' | 'tube' | 'bulb' = 'disc', color = 0xffe2b0, power = 1): RoomLight {
  const emat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: 0.4 });
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (type === 'disc') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 20), emat)); (g.children[0] as THREE.Mesh).position.y = -0.025;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.012, 20), mat('r:#e8e6e0')); rim.position.y = -0.006; g.add(rim); markStatic(rim);
  } else if (type === 'tube') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.07), emat); m.position.y = -0.03; g.add(m);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.02, 0.1), mat('r:#dddad2')); hs.position.y = -0.008; g.add(hs); markStatic(hs);
  } else {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3), mat('r:#222')); cord.position.y = -0.15; g.add(cord); markStatic(cord);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), emat); bulb.position.y = -0.32; g.add(bulb);
  }
  g.children.forEach((c) => { (c as THREE.Mesh).castShadow = false; });
  h.group.add(g);
  const rl: RoomLight = { pos: h.wp(x, y - 0.35, z), level: 0, target: 0, manual: false, color, power, mats: [emat], curtainMats: [], roomId: room.id, houseId: h.id };
  room.light = rl; h.ctx.roomLights.push(rl);
  return rl;
}
export function setRoomLight(h: House, room: Room, on: boolean, manual = false) {
  if (!room.light) return;
  room.light.target = on ? 1 : 0; if (manual) room.light.manual = true;
  void h;
}
const rotFor = { pz: 0, nz: Math.PI, px: Math.PI / 2, nx: -Math.PI / 2 };
export function lightSwitch(h: House, room: Room, x: number, y: number, z: number, nrm: 'px' | 'nx' | 'pz' | 'nz', label = tr('noun.light')) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotFor[nrm];
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.125, 0.012), mat('g:#f1efe8')); plate.position.z = 0.006;
  const rock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.01), mat('g:#e2dfd6')); rock.position.z = 0.016;
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.004), SWITCH_LED_MAT); led.position.set(0.025, 0.045, 0.013);
  g.add(plate, rock, led); h.group.add(g); markStatic(plate, led);
  h.addInteract(g, () => (room.light?.target ? tr('verb.turnOff') : tr('verb.turnOn')) + label, () => {
    if (!room.light) return;
    setRoomLight(h, room, room.light.target < 0.5, true); rock.rotation.x = room.light.target > 0.5 ? 0.3 : -0.3;
    h.ctx.sfx.play('click', h.wp(x, y, z));
  });
}
export function curtain(h: House, room: Room, x: number, y: number, z: number, w: number, hgt: number, nrm: 'px' | 'nx' | 'pz' | 'nz', color = '#e9dcc3') {
  if (!room.curtainMat) room.curtainMat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(0xffc882), emissiveIntensity: 0, roughness: 1, side: THREE.DoubleSide });
  if (room.light) room.light.curtainMats.push(room.curtainMat);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotFor[nrm];
  if (!room.curtainMat.map) { const ref = mat('cloth:#ffffff') as THREE.MeshStandardMaterial; room.curtainMat.map = ref.map; room.curtainMat.normalMap = ref.normalMap; room.curtainMat.normalScale.set(0.6, 0.6); room.curtainMat.roughnessMap = ref.roughnessMap; room.curtainMat.needsUpdate = true; }
  for (const sgn of [-1, 1]) {
    // pleated panel: wave amplitude grows toward the hem, panel gathers toward the window edge
    const pw = w * 0.3, geo = new THREE.PlaneGeometry(pw, hgt, 28, 10), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), tt = (hgt / 2 - py) / hgt;
      p.setZ(i, Math.sin(px * 46 + sgn * 0.7) * (0.012 + 0.022 * tt) + Math.sin(px * 17 + py * 2.2) * 0.006);
      p.setY(i, py + Math.sin(px * 46) * 0.004 * tt);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, room.curtainMat); m.position.set(sgn * w * 0.35, hgt / 2, 0.035); m.castShadow = false; g.add(m); markStatic(m);
    for (let k = 0; k < 7; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 5, 10), mat('m:#6a6a6a')); ring.position.set(sgn * w * 0.35 + (k / 6 - 0.5) * pw, hgt + 0.015, 0.03); g.add(ring); markStatic(ring); }
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w + 0.2, 6), mat('m:#555')); rod.rotation.z = Math.PI / 2; rod.position.set(0, hgt + 0.03, 0.03); g.add(rod); markStatic(rod);
  h.group.add(g);
}

// ---------------- fan ----------------
export function ceilingFan(h: House, x: number, y: number, z: number, id: string, on = false): Device {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), mat('m:#d8d8d4')); rod.position.y = -0.1;
  const canopy = new THREE.Mesh(new THREE.LatheGeometry([[0.07, 0], [0.075, -0.02], [0.05, -0.045], [0.02, -0.05]].map(([r, y]) => new THREE.Vector2(r, y)), 20), mat('m:#e4e4de')); canopy.position.y = 0;
  const motor = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0], [0.07, 0.0], [0.11, 0.02], [0.115, 0.055], [0.09, 0.085], [0.0, 0.09]].map(([r, y]) => new THREE.Vector2(r, y)), 24), mat('m:#e2e2dc')); motor.position.y = -0.33;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), FAN_BOWL_MAT); bowl.position.y = -0.33; bowl.scale.y = 0.7;
  const rot = new THREE.Group(); rot.position.y = -0.27;
  // blade: tapered paddle with rounded tip, slight camber, steel iron arm
  const sh = new THREE.Shape(); sh.moveTo(0.0, -0.045); sh.lineTo(0.5, -0.07); sh.quadraticCurveTo(0.6, -0.07, 0.6, 0); sh.quadraticCurveTo(0.6, 0.07, 0.5, 0.07); sh.lineTo(0.0, 0.045); sh.closePath();
  const bgeo = new THREE.ExtrudeGeometry(sh, { depth: 0.009, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 6 });
  bgeo.rotateX(Math.PI / 2); const bp = bgeo.attributes.position; for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) - Math.abs(bp.getZ(i)) * 0.06);
  bgeo.computeVertexNormals();
  const wood = mat('woodF:#8a5a38');
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Group(); a.rotation.y = (i / 3) * Math.PI * 2;
    const bl = new THREE.Mesh(bgeo, wood); bl.position.set(0.17, -0.02, 0); bl.rotation.z = 0.09; bl.castShadow = true; a.add(bl);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 0.03), mat('m:#2a2a2a')); arm.position.set(0.13, -0.012, 0); a.add(arm);
    rot.add(a);
  }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.18, 4), mat('m:#b0b0a0')); chain.position.set(0.04, -0.45, 0.02);
  g.add(canopy, chain, bowl);
  g.add(rod, motor, rot); h.group.add(g);
  markStatic(canopy, chain, bowl, rod, motor);
  const wpos = h.wp(x, y - 0.3, z);
  let speed = 0, tgt = 0;
  const dev = mkDevice((o) => { tgt = o ? 7 : 0; h.ctx.sfx.play('click', wpos); h.ctx.sfx.loop(id, 'fan', wpos, o); }, on);
  if (on) { speed = 7; }
  h.ctx.dyn.push((dt) => { if (speed === tgt && !tgt) return; speed += (tgt - speed) * Math.min(1, dt * 0.8); if (Math.abs(speed - tgt) < 0.01) speed = tgt; rot.rotation.y += speed * dt; });
  h.addInteract(g, () => (dev.on ? tr('act.fanOff') : tr('act.fanOn')), () => dev.toggle());
  h.devices[id] = dev;
  return dev;
}

// ---------------- steam / smoke ----------------
export function steam(h: House, x: number, y: number, z: number, o: { n?: number; size?: number; spread?: number; rise?: number; color?: number; op?: number } = {}) {
  const n = o.n ?? 14, pos = new Float32Array(n * 3), age = new Float32Array(n);
  for (let i = 0; i < n; i++) age[i] = Math.random();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: glow(), size: o.size ?? 0.22, transparent: true, opacity: 0, depthWrite: false, color: o.color ?? 0xffffff, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m); pts.position.set(x, y, z); pts.frustumCulled = false; h.group.add(pts);
  const s = { active: false };
  const wp = h.wp(x, y, z), rise = o.rise ?? 0.4, spread = o.spread ?? 0.08, op = o.op ?? 0.3;
  h.ctx.dyn.push((dt, t) => {
    m.opacity += ((s.active ? op : 0) - m.opacity) * Math.min(1, dt * 3);
    if (m.opacity < 0.01 || h.ctx.eye.distanceToSquared(wp) > 400) return;
    for (let i = 0; i < n; i++) {
      age[i] += dt * 0.45; if (age[i] > 1) age[i] = 0;
      const a = age[i];
      pos[i * 3] = Math.sin(t * 1.3 + i * 2.1) * spread * a * 3; pos[i * 3 + 1] = a * rise; pos[i * 3 + 2] = Math.cos(t * 1.1 + i * 1.7) * spread * a * 3;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return s;
}

// ---------------- water ----------------
export function faucet(h: House, id: string, x: number, y: number, z: number, yaw: number, targetY: number, label = tr('noun.faucet')): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const chrome = mat('m:#d8dce0');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 10), chrome); base.position.y = 0.06;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.16, 8), chrome); neck.rotation.x = Math.PI / 2; neck.position.set(0, 0.12, 0.08);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.03), chrome); knob.position.set(0, 0.1, 0);
  g.add(base, neck, knob); markStatic(base, neck, knob);
  const L = y + 0.12 - targetY;
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, L, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#d7edff', transparent: true, opacity: 0.6, map: streak(), depthWrite: false, side: THREE.DoubleSide }));
  st.position.set(0, 0.12 - L / 2, 0.16); st.visible = false; g.add(st);
  h.group.add(g);
  const wpos = h.wp(x, y, z);
  const dev = mkDevice((on) => { st.visible = on; h.ctx.sfx.loop(id, 'water', wpos, on); }, false);
  h.ctx.dyn.push((dt) => { if (st.visible) (st.material as THREE.MeshBasicMaterial).map!.offset.y -= dt * 3; });
  h.addInteract(g, () => (dev.on ? tr('verb.turnOff') : tr('verb.open')) + label, () => dev.toggle());
  h.devices[id] = dev;
  return dev;
}
export function shower(h: House, id: string, x: number, y: number, z: number, floorY: number, yaw = 0): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const chrome = mat('m:#d8dce0');
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), chrome); pipe.rotation.x = Math.PI / 2; pipe.position.set(0, 0, 0.12);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.03, 16), chrome); head.position.set(0, -0.02, 0.24); head.rotation.x = 0.35;
  const hgt = y - floorY;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, hgt - 0.1, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#dff2ff', transparent: true, opacity: 0.35, map: streak(), depthWrite: false, side: THREE.DoubleSide }));
  cone.position.set(0, -(hgt - 0.1) / 2 - 0.05, 0.27); cone.visible = false;
  g.add(pipe, head, cone); h.group.add(g); markStatic(pipe, head);
  const st = steam(h, x + Math.sin(yaw) * 0.3, floorY + 0.8, z + Math.cos(yaw) * 0.3, { n: 16, size: 0.5, spread: 0.12, rise: 0.8, op: 0.22 });
  const wpos = h.wp(x + Math.sin(yaw) * 0.2, y, z + Math.cos(yaw) * 0.2);
  const dev = mkDevice((on) => { cone.visible = on; st.active = on; h.ctx.sfx.loop(id, 'shower', wpos, on); }, false);
  h.ctx.dyn.push((dt) => { if (cone.visible) (cone.material as THREE.MeshBasicMaterial).map!.offset.y -= dt * 3.4; });
  h.addInteract(g, () => (dev.on ? tr('act.showerOff') : tr('act.showerOn')), () => dev.toggle());
  h.devices[id] = dev;
  return dev;
}
export function flush(h: House, x: number, y: number, z: number, yaw: number) {
  const m = hit(h, x, y, z, 0.16, 0.1, 0.1, tr('act.flush'), () => h.ctx.sfx.play('flush', h.wp(x, y, z)), yaw);
  void m;
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), mat('m:#e5e5e5')); b.rotation.x = Math.PI / 2; b.position.set(x, y + 0.05, z); b.rotation.y = yaw; h.group.add(b); markStatic(b);
}

// ---------------- stove / rice cooker / radio / ac / washer / tv / fridge ----------------
export function gasStove(h: House, id: string, x: number, y: number, z: number, yaw: number): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const body = makeGroup((b) => {
    b.box(-0.37, 0, -0.2, 0.74, 0.07, 0.4, 'm:#3b3d40'); b.box(-0.35, 0.07, -0.18, 0.7, 0.012, 0.36, 'm:#1c1d1f');
    for (const px of [-0.17, 0.17]) { b.cyl(px, 0.082, 0, 0.07, 0.014, 'm:#2a2a2a', 14); b.cyl(px, 0.096, 0, 0.035, 0.012, 'm:#777', 12); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; b.box(px + Math.cos(a) * 0.075 - 0.01, 0.1, Math.sin(a) * 0.075 - 0.01, 0.02, 0.03, 0.02, 'm:#2a2a2a'); } }
    b.box(-0.37, 0.0, 0.2, 0.74, 0.0, 0.0, 'm:#000');
  });
  g.add(body);
  const pot = makeGroup((b) => { b.cyl(0, 0.1, 0, 0.13, 0.15, 'm:#aab0b5', 16); b.cyl(0, 0.255, 0, 0.133, 0.02, 'm:#9aa0a5', 16); b.box(0.13, 0.2, -0.015, 0.1, 0.02, 0.03, 'm:#2a2a2a'); });
  pot.position.x = -0.17; g.add(pot); markStatic(body, pot);
  const flames: THREE.Mesh[] = [];
  for (const px of [-0.17, 0.17]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.045, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#4f8dff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    f.position.set(px, 0.115, 0); f.visible = false; g.add(f); flames.push(f);
  }
  h.group.add(g);
  const st = steam(h, x, y + 0.3, z, { n: 14, size: 0.3, spread: 0.07, rise: 0.7, op: 0.28 });
  const wpos = h.wp(x, y + 0.2, z);
  const dev = mkDevice((on) => { flames.forEach((f) => (f.visible = on)); st.active = on; h.ctx.sfx.loop(id, 'gas', wpos, on); h.ctx.sfx.play('click', wpos); }, false);
  h.ctx.dyn.push((_dt, t) => { if (dev.on) flames.forEach((f, i) => f.scale.set(1 + Math.sin(t * 25 + i) * 0.1, 1 + Math.sin(t * 31 + i * 2) * 0.2, 1)); });
  h.addInteract(g, () => (dev.on ? tr('act.stoveOff') : tr('act.stoveOn')), () => dev.toggle());
  h.devices[id] = dev;
  return dev;
}
export function riceCooker(h: House, id: string, x: number, y: number, z: number, yaw: number): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const cookerBody = makeGroup((b) => { b.cyl(0, 0, 0, 0.13, 0.2, 'g:#f1efe6', 16); b.cyl(0, 0.08, 0, 0.134, 0.03, 'm:#6b6e72', 16); b.box(-0.03, 0.04, 0.125, 0.06, 0.04, 0.012, 'emit:#ff3b1a'); });
  g.add(cookerBody); markStatic(cookerBody);
  const lid = makeGroup((b) => { b.cyl(0, 0, 0, 0.13, 0.05, 'g:#f1efe6', 16, 0.1); b.cyl(0, 0.05, 0, 0.03, 0.02, 'm:#aaa', 8); });
  lid.position.set(0, 0.2, 0); g.add(lid); h.group.add(g);
  const st = steam(h, x, y + 0.25, z, { n: 10, size: 0.22, spread: 0.04, rise: 0.5, op: 0.25 });
  const wpos = h.wp(x, y, z);
  const dev = mkDevice((on) => { lid.position.y = on ? 0.215 : 0.2; lid.rotation.x = on ? -0.9 : 0; lid.position.z = on ? -0.1 : 0; st.active = on; h.ctx.sfx.play('click', wpos); }, false);
  h.addInteract(g, () => (dev.on ? tr('act.cookerClose') : tr('act.cookerOpen')), () => dev.toggle());
  h.devices[id] = dev;
  return dev;
}
export function radio(h: House, id: string, x: number, y: number, z: number, yaw: number): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  g.add(markStaticGroup((b) => {
    b.box(-0.14, 0, -0.045, 0.28, 0.16, 0.09, 'woodF:#6b4a32'); b.box(-0.12, 0.03, 0.044, 0.12, 0.1, 0.004, 'r:#1a1a1a');
    b.box(0.02, 0.09, 0.044, 0.1, 0.04, 0.004, 'g:#d9c9a0'); b.cyl(0.07, 0.04, 0.046, 0.02, 0.01, 'm:#aaa', 8);
    b.box(0.1, 0.16, -0.02, 0.006, 0.28, 0.006, 'm:#ccc');
  }));
  h.group.add(g);
  const wpos = h.wp(x, y, z);
  const dev = mkDevice((on) => h.ctx.sfx.loop(id, 'radio', wpos, on), false);
  h.addInteract(g, () => (dev.on ? tr('act.radioOff') : tr('act.radioOn')), () => dev.toggle());
  h.devices[id] = dev; return dev;
}
export function aircon(h: House, room: Room, id: string, x: number, y: number, z: number, nrm: 'px' | 'nx' | 'pz' | 'nz'): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotFor[nrm];
  g.add(markStaticGroup((b) => { b.box(-0.45, 0, 0, 0.9, 0.29, 0.22, 'g:#f4f4f1'); b.box(-0.4, 0.2, 0.22, 0.8, 0.012, 0.001, 'g:#d7d7d3'); b.box(0.3, 0.2, 0.2, 0.05, 0.02, 0.025, 'r:#2b2b2b'); }));
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.012, 0.06), mat('g:#f1f1ee')); flap.position.set(0, 0.025, 0.2); g.add(flap);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#22ff66', emissiveIntensity: 0 })); led.position.set(0.37, 0.2, 0.222); g.add(led);
  h.group.add(g);
  const wpos = h.wp(x, y, z), lm = led.material as THREE.MeshStandardMaterial;
  let ft = 0, fc = 0;
  const dev = mkDevice((on) => { ft = on ? -0.9 : 0; lm.emissiveIntensity = on ? 2.5 : 0; h.ctx.sfx.play('click', wpos); h.ctx.sfx.loop(id, 'ac', wpos, on); }, false);
  h.ctx.dyn.push((dt) => { if (Math.abs(fc - ft) > 0.001) { fc += (ft - fc) * Math.min(1, dt * 3); flap.rotation.x = fc; } });
  h.addInteract(g, () => (dev.on ? tr('act.acOff') : tr('act.acOn')), () => dev.toggle());
  h.devices[id] = dev; void room; return dev;
}
export function washer(h: House, id: string, x: number, z: number, yaw: number, y0: number): Device {
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = yaw;
  g.add(makeGroup((b) => {
    b.box(-0.3, 0, -0.3, 0.6, 0.85, 0.6, 'g:#e9eaec'); b.box(-0.3, 0.76, 0.298, 0.6, 0.09, 0.004, 'g:#c9cdd1'); b.cyl(0.18, 0.8, 0.3, 0.025, 0.006, 'm:#888', 10);
    b.box(-0.27, 0.8, 0.3, 0.2, 0.03, 0.004, 'r:#16222c');
  }));
  const door = new THREE.Group(); door.position.set(0, 0.4, 0.3);
  door.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 10, 28), mat('m:#cfd3d6')));
  const glassM = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), new THREE.MeshStandardMaterial({ color: '#30424d', roughness: 0.05, metalness: 0.4 })); glassM.position.z = 0.005; door.add(glassM);
  const drum = new THREE.Group(); drum.position.z = 0.008;
  for (let i = 0; i < 3; i++) { const cl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.004), mat('laundry:' + ['#e8567a', '#4d86d6', '#f0c24a'][i])); cl.position.set(Math.cos(i * 2.1) * 0.09, Math.sin(i * 2.1) * 0.09, 0); cl.rotation.z = i; drum.add(cl); }
  door.add(drum); g.add(door); h.group.add(g);
  const wpos = h.wp(x, y0 + 0.4, z);
  let sp = 0;
  const dev = mkDevice((on) => { h.ctx.sfx.loop(id, 'washer', wpos, on); h.ctx.sfx.play('click', wpos); }, false);
  h.ctx.dyn.push((dt) => { const t = dev.on ? 6 : 0; sp += (t - sp) * Math.min(1, dt * 1.5); if (sp > 0.01) { drum.rotation.z += sp * dt; g.position.x = x; g.position.y = y0 + (dev.on ? Math.sin(performance.now() * 0.05) * 0.0015 : 0); } });
  h.addInteract(g, () => (dev.on ? tr('act.washerStop') : tr('act.washerStart')), () => dev.toggle());
  h.devices[id] = dev; return dev;
}

let _tvTex: THREE.CanvasTexture[] = [];
export function tv(h: House, room: Room, id: string, x: number, y: number, z: number, yaw: number, w = 1.0): Device {
  const hg = w * 0.5625;
  const c = document.createElement('canvas'); c.width = 128; c.height = 72; const cx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; _tvTex.push(tex);
  const smat = new THREE.MeshStandardMaterial({ color: '#050506', roughness: 0.12, metalness: 0.5, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0 });
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const blk = mat('r:#0b0b0d');
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(w + 0.024, hg + 0.024, 0.026, 2, 0.008), blk); bezel.position.set(0, hg / 2, 0.0);
  const rear = new THREE.Mesh(new RoundedBoxGeometry(w * 0.62, hg * 0.62, 0.035, 2, 0.012), mat('r:#17171a')); rear.position.set(0, hg / 2, -0.028);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.004), mat('m:#8c8f93')); chin.position.set(0, -0.004, 0.0145);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 6, 5), TV_LED_MAT); led.position.set(w * 0.42, -0.004, 0.0145);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, hg), smat); scr.position.set(0, hg / 2, 0.0135);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.02), mat('m:#1c1c1e')); neck.position.set(0, -0.04, -0.03);
  const stand = new THREE.Mesh(new RoundedBoxGeometry(Math.min(0.5, w * 0.4), 0.012, 0.18, 2, 0.005), mat('m:#1c1c1e')); stand.position.set(0, -0.09, -0.02);
  g.add(bezel, rear, chin, led, neck);
  g.add(scr, stand); h.group.add(g); markStatic(bezel, rear, chin, led, neck, stand);
  const wpos = h.wp(x, y + hg / 2, z);
  const rl: RoomLight = { pos: h.wp(x + Math.sin(yaw) * 0.8, y + hg / 2, z + Math.cos(yaw) * 0.8), level: 0, target: 0, manual: true, color: 0x8fb4ff, power: 0.45, mats: [], curtainMats: [], roomId: room.id + ':tv', houseId: h.id };
  h.ctx.roomLights.push(rl);
  let acc = 0;
  const draw = (t: number) => {
    const sc = Math.floor(t / 4) % 3;
    cx.fillStyle = `hsl(${(t * 14 + sc * 80) % 360},45%,32%)`; cx.fillRect(0, 0, 128, 72);
    cx.fillStyle = 'rgba(255,255,255,0.8)'; cx.beginPath(); cx.arc(30 + Math.sin(t * 0.7) * 14, 28, 12, 0, 6.3); cx.fill();
    cx.fillStyle = 'rgba(255,230,160,0.7)'; cx.fillRect(60 + Math.sin(t) * 10, 16, 50, 6 + sc * 3); cx.fillRect(60, 30, 40, 4);
    cx.fillStyle = '#b8141a'; cx.fillRect(0, 60, 128, 12); cx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) cx.fillRect(((i * 17 - t * 20) % 140 + 140) % 140 - 6, 64, 10, 3);
    cx.fillStyle = '#f5c518'; cx.fillRect(4, 4, 18, 8);
    tex.needsUpdate = true;
  };
  draw(0);
  const dev = mkDevice((on) => { smat.emissiveIntensity = on ? 1.15 : 0; rl.target = on ? 1 : 0; h.ctx.sfx.play('click', wpos); h.ctx.sfx.loop(id, 'tv', wpos, on); }, false);
  h.ctx.dyn.push((dt, t) => {
    if (!dev.on) return; acc += dt; if (acc > 0.12 && h.ctx.eye.distanceToSquared(wpos) < 150) { acc = 0; draw(t); }
  });
  hit(h, x, y, z + 0.02, w, hg, 0.1, () => (dev.on ? tr('act.tvOff') : tr('act.tvOn')), () => dev.toggle(), yaw);
  h.devices[id] = dev; return dev;
}

export function fridge(h: House, id: string, x: number, y: number, z: number, yaw: number, wd = 0.62, hg = 1.72): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const d = 0.64, T = 0.03;
  g.add(markStaticGroup((b) => {
    b.box(-wd / 2, 0, -d / 2, T, hg, d - 0.04, 'g:#dfe2e4'); b.box(wd / 2 - T, 0, -d / 2, T, hg, d - 0.04, 'g:#dfe2e4');
    b.box(-wd / 2, hg - T, -d / 2, wd, T, d - 0.04, 'g:#dfe2e4'); b.box(-wd / 2, 0.06, -d / 2, wd, T, d - 0.04, 'g:#dfe2e4'); b.box(-wd / 2, 0, -d / 2, wd, hg, T, 'g:#d4d7d9');
    b.box(-wd / 2 + T, 0.06, -d / 2 + T, wd - 2 * T, 0.0, 0.0, 'g:#fff');
    b.box(-wd / 2 + T, 0.55, -d / 2 + T, wd - 2 * T, 0.008, d - 0.1, 'glass'); b.box(-wd / 2 + T, 1.0, -d / 2 + T, wd - 2 * T, 0.008, d - 0.1, 'glass'); b.box(-wd / 2 + T, 1.35, -d / 2 + T, wd - 2 * T, 0.008, d - 0.1, 'glass');
    b.box(-wd / 2 + T, 0.06 + T, -d / 2 + T, wd - 2 * T, 0.001, d - 0.1, 'g:#f4f6f6');
    b.box(-0.2, 0.09, -0.1, 0.4, 0.002, 0.2, 'emit:#fff6dc');
    for (let i = 0; i < 4; i++) { b.cyl(-0.2 + i * 0.12, 0.568, 0, 0.032, 0.2, ['g:#d94a2e', 'g:#3a8f4b', 'g:#e8c23a', 'g:#3a6fc2'][i], 10); }
    b.box(-0.2, 1.018, -0.1, 0.24, 0.12, 0.16, 'g:#f3e9c9'); b.box(0.06, 1.018, -0.12, 0.16, 0.09, 0.2, 'g:#cde3c0');
    b.cyl(-0.1, 1.368, 0.02, 0.07, 0.1, 'g:#e8884a', 10); b.cyl(0.1, 1.368, 0.0, 0.06, 0.12, 'g:#7bb24a', 10);
  }));
  const door = makeGroup((b) => { b.box(0, 0, 0, wd, hg, 0.045, 'g:#eceeef'); b.box(0.04, 0.2, 0.045, 0.02, 0.9, 0.02, 'm:#9a9ea2'); b.box(0.04, hg * 0.45, 0.0, wd - 0.08, 0.004, 0.0, 'r:#ccc'); });
  const piv = new THREE.Group(); piv.position.set(-wd / 2, 0, d / 2 - 0.04); door.position.x = 0; piv.add(door); g.add(piv); h.group.add(g);
  const wpos = h.wp(x, y + 1, z);
  let cur = 0, tgt = 0;
  const dev = mkDevice((on) => { tgt = on ? -1.9 : 0; h.ctx.sfx.play('fridge', wpos); }, false);
  h.ctx.dyn.push((dt) => { if (Math.abs(cur - tgt) < 1e-3) return; cur += (tgt - cur) * Math.min(1, dt * 6); piv.rotation.y = cur; });
  h.addInteract(piv, () => (dev.on ? tr('act.fridgeClose') : tr('act.fridgeOpen')), () => dev.toggle());
  h.devices[id] = dev;
  return dev;
}

export function wallClock(h: House, x: number, y: number, z: number, nrm: 'px' | 'nx' | 'pz' | 'nz') {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotFor[nrm];
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 24), mat('g:#f6f2e6')); face.rotation.x = Math.PI / 2; face.position.z = 0.015;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 8, 24), mat('woodF:#5c3b22')); rim.position.z = 0.03;
  const hand = (len: number, wd: number) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(wd, len, 0.004), mat('r:#111')); m.position.y = len / 2 - 0.01; p.add(m); p.position.z = 0.036; g.add(p); return p; };
  const hh = hand(0.07, 0.008), mm = hand(0.11, 0.005);
  g.add(face, rim); h.group.add(g); markStatic(face, rim);
  h.ctx.dyn.push(() => { const hr = h.ctx.env.hour; mm.rotation.z = -((hr % 1) * Math.PI * 2); hh.rotation.z = -(((hr % 12) / 12) * Math.PI * 2); });
}

export function incense(h: House, id: string, x: number, y: number, z: number, yaw: number): Device {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw;
  const tips: THREE.Mesh[] = [];
  g.add(markStaticGroup((b) => { b.cyl(0, 0, 0, 0.045, 0.07, 'g:#7a3b22', 12, 0.05); for (let i = -1; i <= 1; i++) b.cyl(i * 0.015, 0.07, 0, 0.0025, 0.18, 'r:#8a4a2a', 5); }));
  for (let i = -1; i <= 1; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff4a1a' })); t.position.set(i * 0.015, 0.255, 0); t.visible = false; g.add(t); tips.push(t); }
  h.group.add(g);
  const sm = steam(h, x, y + 0.26, z, { n: 12, size: 0.1, spread: 0.03, rise: 0.8, color: 0xdddddd, op: 0.28 });
  const dev = mkDevice((on) => { tips.forEach((t) => (t.visible = on)); sm.active = on; h.ctx.sfx.play('click', h.wp(x, y, z)); }, false);
  hit(h, x, y, z, 0.16, 0.32, 0.12, () => (dev.on ? tr('act.incenseOff') : tr('act.incenseOn')), () => dev.toggle(), yaw);
  h.devices[id] = dev; return dev;
}

export function sitSpot(h: House, x: number, y: number, z: number, w: number, d: number, yaw: number, label: string, eye = 1.1) {
  const wp = h.wp(x, y, z);
  const hy = h.group.rotation.y + yaw;
  hit(h, x, y, z, w, 0.5, d, label, () => h.ctx.player.sit(wp, hy, eye, label), 0);
}
