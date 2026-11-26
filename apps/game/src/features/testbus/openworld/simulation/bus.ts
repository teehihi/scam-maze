import {driveTexture,exhaust} from "./drive-look";
import * as T from 'three';
import { BUS_DOORS, BUS_FLOOR, DOOR_IDS, HALF, seatBase, seats, VALIDATOR, type PassengerSeat } from './boarding';
import { clamp, smooth, type BusRouteController, type DoorId } from './transit';
import { batch, box, contact, contactMaterial, granular, label, lamp, material, mesh, orb, plane, polygon, rod, rounded, textLabel, tube, write } from './scene-kit';

type Profile = [height: number, z: number, half: number][];
type V = [number, number, number];
const R = Math.PI / 2;
const wheelZ = [-2.93, 3.48];

function cap(group: T.Group, profile: Profile, surface: T.Material, direction: number, crown = 0.112) {
  const segments = 14;
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
  const low = profile[0][0], high = profile[profile.length - 1][0];
  for (let j = 0; j < profile.length; j++) {
    const [y, z, half] = profile[j];
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * 2 - 1;
      vertices.push(u * half, y, z + direction * crown * (1 - u * u));
      uvs.push(direction < 0 ? 1 - i / segments : i / segments, (y - low) / (high - low));
      if (j && i) {
        const a = (j - 1) * (segments + 1) + i - 1, b = a + 1, c = a + segments + 1, d = c + 1;
        indices.push(...(direction < 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return mesh(group, geometry, surface, [0, 0, 0]);
}

function roofShell(group: T.Group, paint: T.Material) {
  const zs = [-5.50, -5.39, -5.15, -4.64, -3.40, 0, 3.40, 4.81, 5.23, 5.48];
  const positions: number[] = [], texs: number[] = [], index: number[] = [];
  for (const [j, z] of zs.entries()) {
    for (let i = 0; i <= 20; i++) {
      const u = (i - 10) / 10;
      const edge = 3.204 - 0.264 * Math.abs(u) ** 10;
      const taper = j === 0 ? 0.35 : j === 1 ? 0.18 : j === 2 || j === 9 ? 0.075 : 0;
      positions.push(u * (1.248 - taper * 0.26), edge - taper * (1 - Math.abs(u) ** 4), z);
      texs.push((u + 1) / 2, (z + 5.5) / 11);
      if (j && i) { const a = (j - 1) * 21 + i - 1; index.push(a, a + 21, a + 1, a + 1, a + 21, a + 22); }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(texs, 2)); geo.setIndex(index); geo.computeVertexNormals();
  mesh(group, geo, paint, [0, 0, 0]);
}

function lowerSide(group: T.Group, side: number, from: number, to: number, paint: T.Material, skirt: T.Material) {
  const cut: V[] = [];
  const x = side * (HALF - 0.009);
  const slices = [from, to, ...wheelZ.filter((z) => z - 0.54 > from && z + 0.54 < to).flatMap((z) => Array.from({ length: 17 }, (_, i) => z + (i - 8) * 0.54 / 8))].sort((a, b) => a - b);
  for (const z of slices) {
    const w = Math.min(...wheelZ.map((wheel) => Math.abs(wheel - z)));
    const floor = w < 0.539 ? 0.346 + 0.64 * Math.sqrt(1 - (w / 0.54) ** 2) : 0.315;
    cut.push([x, floor, z]);
  }
  const highY = (z: number) => 1.26 + 0.085 * Math.sin(z * 0.59);
  const tops = Array.from({ length: 19 }, (_, i): V => { const z = to + (from - to) * (i / 18); return [x, highY(z), z]; });
  const edge = [...cut, ...tops];
  polygon(group, side === 1 ? edge.reverse() : edge, paint);
  const band = [[x + side * 0.005, 1.34, from], [x + side * 0.005, 1.34, to], ...tops.map(([x1, y, z]) => [x1 + side * 0.005, y, z] as V)] as V[];
  polygon(group, side === 1 ? band : band.reverse(), skirt);
  const sillMaterial = material(0x303f30, 0.54, 0.24);
  for (let i = 0; i < cut.length - 1; i++) {
    const a = cut[i], b = cut[i + 1];
    if (Math.abs(a[1] - b[1]) > 0.42) continue;
    const edgeRod = rod(group, [a[0], a[1], a[2]], [b[0], b[1], b[2]], 0.024, sillMaterial, 0.024, 6);
    edgeRod.castShadow = false;
  }
}

function led(text: string, tint = '#def28b', w = 768, h = 126, size = 73) {
  return label(w, h, (ctx) => {
    ctx.fillStyle = '#121a17'; ctx.fillRect(0, 0, w, h);
    ctx.shadowColor = tint; ctx.shadowBlur = 9;
    write(ctx, text, w / 2, h * 0.5 + size * 0.32, size, tint, 800, 'center');
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8,14,12,.48)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.1);
    for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1.05, h);
  }, true);
}

function buildWheel(root: T.Group, x: number, z: number, outside: number, surfaces: { rubber: T.Material; hub: T.Material; bright: T.Material; black: T.Material }) {
  const wheel = new T.Group();
  wheel.position.set(x, 0.47, z);
  root.add(wheel);
  const p = [[0.25, -0.131], [0.34, -0.133], [0.414, -0.122], [0.46, -0.086], [0.471, -0.048], [0.471, 0.049], [0.46, 0.088], [0.412, 0.126], [0.35, 0.134], [0.255, 0.128], [0.25, -0.131]];
  const tire = mesh(wheel, new T.LatheGeometry(p.map(([r, y]) => new T.Vector2(r, y)), 38), surfaces.rubber, [0, 0, 0]);
  tire.rotation.z = -R;
  rod(wheel, [-0.13, 0, 0], [0.13, 0, 0], 0.265, surfaces.hub, 0.265, 30);
  const ring = mesh(wheel, new T.TorusGeometry(0.248, 0.018, 9, 32), surfaces.bright, [outside * 0.137, 0, 0]); ring.rotation.y = R;
  rod(wheel, [outside * 0.131, 0, 0], [outside * 0.158, 0, 0], 0.102, surfaces.black, 0.081, 24);
  rod(wheel, [outside * 0.157, 0, 0], [outside * 0.169, 0, 0], 0.078, surfaces.hub, 0.075, 20);
  for (let i = 0; i < 9; i++) {
    const a = i * 2 * Math.PI / 9;
    const y = Math.sin(a), zz = Math.cos(a);
    orb(wheel, [outside * 0.132, y * 0.194, zz * 0.194], [0.011, 0.023, 0.023], surfaces.black, 8);
    rod(wheel, [outside * 0.132, y * 0.131, zz * 0.131], [outside * 0.147, y * 0.131, zz * 0.131], 0.013, surfaces.bright, 0.011, 6);
  }
  batch(wheel);
  return wheel;
}

function bodyGlass(visibility: number) {
  const glass = new T.MeshPhysicalMaterial({ color: 0x263a39, metalness: 0.34, roughness: 0.135, clearcoat: 0.80, clearcoatRoughness: 0.13, transparent: true, opacity: visibility, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.18, forceSinglePass: true });
  glass.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= gl_FrontFacing ? 1.0 : 0.52;');
  };
  return glass;
}

function createDoor(root: T.Group, id: DoorId, frame: T.Material, green: T.Material, yellow: T.Material, glass: T.Material) {
  const { min, max } = BUS_DOORS[id];
  const width = (max - min) / 2;
  const symbol = label(224, 340, (ctx) => {
    ctx.fillStyle = '#bf4935';
    ctx.beginPath(); ctx.moveTo(10, 119); ctx.lineTo(112, 55); ctx.lineTo(214, 119); ctx.lineTo(214, 324); ctx.lineTo(112, 284); ctx.lineTo(10, 324); ctx.fill();
    ctx.strokeStyle = '#f5d286'; ctx.lineWidth = 12; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(42, 83 + i * 26); ctx.lineTo(112, 29 + i * 26); ctx.lineTo(182, 83 + i * 26); ctx.stroke(); }
    write(ctx, 'CỬA', 112, 202, 55, '#f3edcf', 800, 'center');
    write(ctx, id === 'front' ? 'LÊN' : 'XUỐNG', 112, 254, id === 'front' ? 47 : 40, '#f3edcf', 800, 'center');
  });
  symbol.transparent = true; symbol.depthWrite = false;
  const hinge = [-1, 1].map((side) => {
    const leaf = new T.Group(); root.add(leaf);
    const z = (min + max) / 2 + side * width / 2;
    leaf.position.set(1.253, 0, z);
    const w = width - 0.026;
    const yin = 0.354, top = 2.833;
    for (const edge of [-1, 1]) rounded(leaf, [0, (yin + top) / 2, edge * (w / 2 - 0.011)], [0.088, top - yin, 0.047], 0.012, frame);
    for (const y of [yin + 0.015, 0.883, 1.177, top - 0.016]) box(leaf, [0, y, 0], [0.082, 0.037, w], frame);
    rounded(leaf, [0.002, 0.611, 0], [0.080, 0.479, w - 0.053], 0.013, green);
    box(leaf, [0.050, 0.756, 0.0], [0.015, 0.035, 0.142], frame);
    const pane = plane(leaf, [0.011, 1.848, 0], [w - 0.061, 1.922], glass, R); pane.renderOrder = 4;
    if (side === -1) plane(leaf, [0.017, 1.60, 0.0], [0.24, 0.36], symbol, R).renderOrder = 5;
    else {
      box(leaf, [-0.039, 1.245, 0], [0.014, 0.035, w - 0.050], yellow, false);
      tube(leaf, [[-0.031, 0.93, 0.23], [-0.086, 1.00, 0.20], [-0.103, 1.47, 0.17], [-0.040, 1.54, 0.18]], 0.019, yellow, 9);
    }
    batch(leaf);
    return { leaf, z, side };
  });
  return (open: number) => {
    for (const { leaf, z, side } of hinge) {
      leaf.position.x = 1.253 + 0.091 * smooth(clamp(open / 0.29));
      leaf.position.z = z + side * (width + 0.048) * smooth(clamp((open - 0.13) / 0.87));
    }
  };
}

function seatModel(group: T.Group, seat: PassengerSeat, trim: T.Material, blue: T.Material, bars: T.Material, accent: T.Material) {
  const { x, z } = seat;
  const y = seatBase(z);
  rod(group, [x, y + 0.025, z - 0.013], [x, y + 0.39, z + 0.044], 0.035, bars);
  box(group, [x, y + 0.014, z], [0.17, 0.023, 0.21], trim);
  rounded(group, [x, y + 0.445, z - 0.038], [0.388, 0.118, 0.445], 0.048, trim);
  rounded(group, [x, y + 0.491, z - 0.066], [0.351, 0.083, 0.372], 0.038, blue);
  const back = rounded(group, [x, y + 0.732, z + 0.192], [0.383, 0.546, 0.098], 0.046, trim); back.rotation.x = 0.14;
  const pad = rounded(group, [x, y + 0.738, z + 0.143], [0.325, 0.460, 0.061], 0.027, blue); pad.rotation.x = 0.14;
  tube(group, [[x - 0.148, y + 0.918, z + 0.229], [x - 0.130, y + 1.032, z + 0.232], [x, y + 1.056, z + 0.231], [x + 0.127, y + 1.032, z + 0.230], [x + 0.148, y + 0.918, z + 0.229]], 0.017, bars, 10);
  const line = box(group, [x, y + 0.46, z - 0.257], [0.25, 0.015, 0.011], accent, false); line.rotation.z = -0.05;
}

function busInterior(group: T.Group, trim: T.Material, rails: T.Material, yellow: T.Material, rubber: T.Material, shadow: T.Material) {
  const floorMap = granular([78, 82, 80], [3, 4], false, 965);
  const floor = new T.MeshStandardMaterial({ map: floorMap, bumpMap: floorMap, bumpScale: 0.018, roughness: 0.84 });
  const casing = material(0x878c80, 0.74);
  const headliner = new T.MeshStandardMaterial({ color: 0xd4d6c9, roughness: 0.69, emissive: 0xb8c6b5, emissiveIntensity: 0.17 });
  const hardware = material(0x555d59, 0.62, 0.32);
  const stops = lamp(0x9f3225, 0.26);
  const whiteLight = lamp(0xeef1d9, 1.28);
  const upholstery = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.67, map: label(256, 320, (ctx) => {
    const gradient = ctx.createLinearGradient(10, 10, 245, 305); gradient.addColorStop(0, '#325a62'); gradient.addColorStop(1, '#21454f');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 320);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = i > 15 ? '#86a053' : ['#527f82', '#5e898b', '#426d70'][i % 3];
      ctx.beginPath(); ctx.moveTo(-8, 90 + i * 6); ctx.quadraticCurveTo(121, 112 + i * 6, 269, 196 + i * 3); ctx.stroke();
    }
    const rng = (i: number) => Math.sin(i * 12.039 + 1.023) * 32431 % 1;
    for (let i = 0; i < 4200; i++) { ctx.fillStyle = i % 2 ? 'rgba(230,230,200,.045)' : 'rgba(0,0,0,.09)'; ctx.fillRect(Math.abs(rng(i)) * 256, Math.abs(rng(14322 + i)) * 320, 2.5, 1); }
  }).map });

  const platform = (x0: number, x1: number, z0: number, z1: number, height: number) => box(group, [(x0 + x1) / 2, height - 0.058, (z0 + z1) / 2], [x1 - x0, 0.116, z1 - z0], floor);
  platform(-1.18, 0.821, -5.38, 2.03, BUS_FLOOR);
  platform(-1.18, 1.18, 2.03, 2.40, 0.77);
  platform(-1.18, 1.18, 2.40, 5.40, 0.92);
  for (const [a, b] of [[-5.38, BUS_DOORS.front.min], [BUS_DOORS.front.max, BUS_DOORS.rear.min], [BUS_DOORS.rear.max, 2.03]]) platform(0.82, 1.19, a, b, BUS_FLOOR);
  for (const id of DOOR_IDS) {
    const { min, max } = BUS_DOORS[id];
    const z = (min + max) / 2;
    platform(0.82, 1.102, min, max, 0.47);
    platform(1.10, 1.417, min, max, 0.32);
    for (const [x, y] of [[0.821, BUS_FLOOR], [1.101, 0.47], [1.409, 0.32]]) {
      box(group, [x, y + 0.005, z], [0.036, 0.018, max - min - 0.045], yellow);
      box(group, [x - 0.026, y + 0.009, z], [0.015, 0.011, max - min - 0.057], rails, false);
    }
    for (const x of [0.91, 0.952, 0.994, 1.195, 1.237, 1.279]) box(group, [x, x < 1.10 ? 0.475 : 0.325, z], [0.010, 0.010, max - min - 0.12], hardware, false);
    for (const z2 of [min + 0.027, max - 0.027]) box(group, [1.10, 0.469, z2], [0.43, 0.31, 0.044], casing);
  }
  for (const [y, z] of [[0.774, 2.05], [0.924, 2.415]]) {
    box(group, [0, y, z], [0.82, 0.015, 0.065], yellow);
    box(group, [0, y - 0.08, z - 0.02], [0.84, 0.14, 0.021], trim);
  }
  for (const side of [-1, 1]) {
    rounded(group, [0.985 * side, 0.77, -2.90], [0.44, 0.34, 1.06], 0.073, casing);
    rounded(group, [side * 1.13, 2.824, 0.015], [0.213, 0.22, 10.77], 0.086, headliner);
    const lowerWalls = side === -1 ? [[-5.26, 5.34]] : [[-5.32, -5.23], [BUS_DOORS.front.max, BUS_DOORS.rear.min], [BUS_DOORS.rear.max, 5.34]];
    for (const [a, b] of lowerWalls) {
      rounded(group, [side * 1.194, 0.986, (a + b) / 2], [0.094, 0.70, b - a], 0.021, casing);
      box(group, [side * 1.167, 1.335, (a + b) / 2], [0.093, 0.052, b - a], trim);
    }
    rod(group, [side * 0.631, 2.642, -3.53], [side * 0.631, 2.642, 5.09], 0.023, rails, 0.023, 10);
    for (const z of [-3.47, -1.93, -0.96, 0.28, 1.86, 3.13, 4.16, 5.04]) {
      if (side === 1 && z === 0.28) continue;
      const h = z > 2.4 ? 0.92 : BUS_FLOOR;
      tube(group, [[side * 0.447, h, z], [side * 0.447, h + 0.58, z], [side * 0.471, 2.36, z], [side * 0.62, 2.616, z], [side * 0.69, 2.94, z]], 0.022, rails, 13);
      if (z === -1.93 || z === 1.86 || z === 4.16) {
        rounded(group, [side * 0.446, 1.67, z], [0.070, 0.10, 0.081], 0.013, trim);
        box(group, [side * 0.402, 1.674, z], [0.020, 0.044, 0.036], stops);
      }
    }
    for (let i = 0; i < 13; i++) {
      const z = -3.15 + i * 0.64;
      rod(group, [side * 0.63, 2.62, z], [side * 0.63, 2.503, z], 0.016, hardware, 0.012);
      tube(group, [[side * 0.63, 2.51, z], [side * 0.548, 2.39, z], [side * 0.561, 2.357, z], [side * 0.703, 2.357, z], [side * 0.715, 2.395, z]], 0.015, headliner, 14, true);
    }
    for (const z of [-3.45, -1.29, 0.87, 3.03, 5.04]) {
      box(group, [side * 0.72, 2.957, z], [0.180, 0.040, 1.74], trim);
      box(group, [side * 0.72, 2.928, z], [0.099, 0.022, 1.61], whiteLight, false);
    }
  }
  rounded(group, [0, 3.003, 0], [1.99, 0.10, 10.69], 0.048, headliner);
  for (const x of [-0.35, 0.35]) for (let i = 0; i < 44; i++) box(group, [x, 2.947, -4.450 + i * 0.212], [0.112, 0.009, 0.030], hardware, false);
  for (const seat of seats) {
    contact(group, seat.x, seatBase(seat.z) + 0.015, seat.z, 0.54, 0.59, shadow);
    seatModel(group, seat, trim, upholstery, rails, yellow);
  }

  for (const z of [-1.43, 0.76, 4.25]) {
    const floorY = z > 2.4 ? 0.92 : BUS_FLOOR;
    box(group, [0, floorY + 0.001, z], [0.52, 0.010, 0.59], trim, false);
    box(group, [0, floorY + 0.009, z], [0.49, 0.009, 0.55], floor, false);
    box(group, [0.149, floorY + 0.016, z + 0.19], [0.079, 0.003, 0.041], hardware, false);
  }
  const caution = textLabel('CỬA THOÁT HIỂM', '#ede7ce', '#903927', 512, 96, 57);
  for (const [side, z] of [[-1, -1.74], [1, 3.68]]) plane(group, [side * 1.188, 2.321, z], [0.58, 0.105], caution, -side * R);
  plane(group, [1.20, 1.897, -2.85], [0.38, 0.25], textLabel('GHẾ ƯU TIÊN', '#264b60', '#e8e9d1', 256, 141, 34), -R);
  for (const z of [0.106, 4.87]) {
    rod(group, [-1.12, 1.61, z], [-1.12, 1.94, z], 0.063, stops, 0.055);
    rod(group, [-1.12, 1.95, z], [-1.12, 2.02, z], 0.025, trim);
    tube(group, [[-1.15, 2.01, z], [-1.20, 1.96, z], [-1.201, 1.72, z]], 0.013, rubber, 8);
  }

  rounded(group, [0, 2.782, -3.61], [0.62, 0.225, 0.138], 0.035, trim);
  plane(group, [0, 2.782, -3.536], [0.541, 0.154], led('06   CHỢ LỚN', '#bdde97', 512, 135, 58));
  rod(group, [VALIDATOR.x, BUS_FLOOR, VALIDATOR.z], [VALIDATOR.x, 1.74, VALIDATOR.z], 0.032, yellow);
  const machine = rounded(group, [VALIDATOR.x - 0.058, 1.51, VALIDATOR.z - 0.043], [0.165, 0.237, 0.104], 0.033, trim); machine.rotation.y = Math.PI;
  plane(group, [VALIDATOR.x - 0.058, 1.543, VALIDATOR.z - 0.099], [0.111, 0.10], textLabel('VÉ XE', '#24463b', '#cfe677', 160, 140, 33, true), Math.PI);
  box(group, [VALIDATOR.x - 0.058, 1.407, VALIDATOR.z - 0.098], [0.144, 0.022, 0.020], yellow);

  rounded(group, [-0.652, 0.996, -4.67], [0.56, 0.18, 0.52], 0.082, rubber);
  const driverBack = rounded(group, [-0.652, 1.337, -4.441], [0.52, 0.59, 0.12], 0.051, rubber); driverBack.rotation.x = 0.12;
  rounded(group, [-0.652, 1.702, -4.407], [0.28, 0.177, 0.11], 0.05, rubber);
  rounded(group, [-0.58, 1.125, -5.221], [1.119, 0.46, 0.37], 0.105, trim);
  rounded(group, [-0.65, 1.377, -5.15], [0.45, 0.15, 0.254], 0.045, hardware);
  const gauge = plane(group, [-0.65, 1.409, -5.013], [0.29, 0.086], led('00 km/h', '#acd9ca', 324, 96, 45)); gauge.rotation.x = -0.33;
  for (const x of [-0.288, -0.238, -0.188, -0.143, -0.100]) for (let i = 0; i < 3; i++) box(group, [x, 1.356, -5.108 + i * 0.062], [0.028, 0.019, 0.037], x === -0.238 && i === 1 ? stops : rubber, false);
  for (const x of [-0.744, -0.559]) {
    const pedal = box(group, [x, 0.727, -5.170], [0.091, 0.144, 0.023], trim); pedal.rotation.x = -0.39;
  }
  tube(group, [[-0.65, 0.91, -5.15], [-0.65, 1.157, -5.09], [-0.65, 1.415, -4.949]], 0.038, trim, 7);
  const wheel = new T.Group(); wheel.position.set(-0.65, 1.429, -4.929); wheel.rotation.x = -0.80; group.add(wheel);
  mesh(wheel, new T.TorusGeometry(0.189, 0.019, 10, 32), rubber, [0, 0, 0]);
  rounded(wheel, [0, 0, 0.013], [0.136, 0.107, 0.05], 0.022, trim);
  for (const a of [-2.68, -0.46, 1.56]) rod(wheel, [0, 0, 0.006], [Math.cos(a) * 0.179, Math.sin(a) * 0.179, 0], 0.020, hardware);
  rounded(group, [-0.709, 1.135, -4.285], [0.86, 0.80, 0.092], 0.039, casing);
  tube(group, [[-1.12, 1.65, -4.288], [-0.92, 1.70, -4.28], [-0.45, 1.70, -4.28], [-0.31, 1.58, -4.28]], 0.028, rails, 13);
  plane(group, [-0.699, 1.252, -4.231], [0.55, 0.143], textLabel('KHU VỰC LÁI XE', '#b6baaa', '#414c44', 512, 128, 56));

  return wheel;
}

export function buildBus(scene: T.Scene, route: BusRouteController, interiorFill = true) {
  const root = new T.Group(); root.name = 'Route 06 city bus'; scene.add(root);
  const fixed = new T.Group(); root.add(fixed);
  const plume=exhaust(scene);
  const silk=new T.MeshStandardMaterial({map:driveTexture(new T.TextureLoader(),"bus-print"),roughness:.42,metalness:.18});
  const paint = new T.MeshPhysicalMaterial({ color: 0x2d7892, roughness: 0.37, metalness: 0.37, clearcoat: 0.85, clearcoatRoughness: 0.24, envMapIntensity: 1.03, side: T.DoubleSide });
  const bright = new T.MeshPhysicalMaterial({ color: 0x58a684, roughness: 0.31, metalness: 0.26, clearcoat: 0.62, side: T.DoubleSide });
  const darkGreen = new T.MeshPhysicalMaterial({ color: 0x34563f, roughness: 0.42, metalness: 0.36, clearcoat: 0.58, side: T.DoubleSide });
  const glazing = bodyGlass(0.47);
  const windshield = bodyGlass(0.30);
  const frame = material(0x242e2e, 0.41, 0.40);
  const black = material(0x202729, 0.66);
  const tireMap = granular([39, 41, 39], [14, 2], false, 448);
  const rubber = new T.MeshStandardMaterial({ map: tireMap, roughness: 0.94, bumpMap: tireMap, bumpScale: 0.016 });
  const silver = material(0xb7bfba, 0.32, 0.78);
  const nickel = material(0xa6b7ac, 0.40, 0.52);
  const yellow = material(0xd1ae4c, 0.47, 0.29);
  const headlight = lamp(0xf1f4d8, 1.8);
  const marker = lamp(0xe09932, 0.50),leftMarker=marker.clone();
  const tail = lamp(0xb43b25, 0.72);
  const brake = lamp(0xd03b27, 0.35);
  const shadow = contactMaterial(0.49);
  const under = contact(root, 0, 0.013, 0, 3.9, 11.61, contactMaterial(0.97)); under.renderOrder = 1;
  box(fixed, [0, 0.432, 0.05], [1.85, 0.29, 10.00], black);
  roofShell(fixed, bright);
  rounded(fixed, [0, 3.242, 0.54], [1.83, 0.142, 3.96], 0.066, darkGreen);
  rounded(fixed, [0, 3.279, 0.52], [1.66, 0.125, 3.74], 0.059, bright);
  for (const x of [-0.57, 0.57]) for (let i = 0; i < 15; i++) box(fixed, [x, 3.343, -0.993 + i * 0.19], [0.22, 0.013, 0.038], frame, false);
  rod(fixed, [0.27, 3.222, -2.93], [0.26, 3.424, -2.76], 0.014, black);
  for (const side of [-1, 1]) {
    box(fixed, [side * 1.218, 2.916, 0], [0.076, 0.117, 10.69], frame);
    const sections = side < 0 ? [[-5.44, 5.42]] : [[-5.42, BUS_DOORS.front.min], [BUS_DOORS.front.max, BUS_DOORS.rear.min], [BUS_DOORS.rear.max, 5.42]];
    for (const [a, b] of sections) lowerSide(fixed, side, a, b, paint, darkGreen);
    const panes = side === 1 ? [[-3.685, -1.76], [-1.76, 0.33], [1.80, 3.58], [3.58, 5.36]] : [[-5.30, -3.78], [-3.78, -2.06], [-2.06, -0.19], [-0.19, 1.73], [1.73, 3.62], [3.62, 5.36]];
    for (const [a, b] of panes) {
      const z = (a + b) / 2, w = b - a;
      rounded(fixed, [side * 1.240, 1.315, z], [0.049, 0.104, w], 0.020, frame);
      box(fixed, [side * 1.239, 2.814, z], [0.048, 0.14, w], frame);
      const glass = plane(fixed, [side * 1.253, 2.069, z], [w - 0.085, 1.46], glazing, side * R); glass.renderOrder = 3;
      box(fixed, [side * 1.252, 2.484, z], [0.032, 0.021, w - 0.062], frame);
      for (const other of [a, b]) rounded(fixed, [side * 1.237, 2.064, other], [0.065, 1.58, 0.073], 0.016, frame);
    }
    for (const z of [-5.36, 5.40]) rounded(fixed, [side * 1.213, 2.053, z], [0.105, 1.76, 0.174], 0.040, frame);
    for (const z of [-2.14, -0.34, 2.11, 4.40]) {
      if (side < 0 || Math.abs(z - 1.03) > 0.81) {
        box(fixed, [side * 1.253, 0.831, z], [0.018, 0.523, 0.013], darkGreen, false);
        rounded(fixed, [side * 1.258, 0.555, z + 0.123], [0.026, 0.053, 0.123], 0.012, side>0?marker:leftMarker);
      }
    }
    for (let i = 0; i < 12; i++) box(fixed, [side * 1.250, 0.768, 4.26 + i * 0.073], [0.013, 0.48, 0.020], black, false);
    plane(fixed,[side*1.262,.89,side===1?-1.65:0],[side===1?3.87:10.33,.53],silk,side*R);
    const sideName = label(690, 110, (ctx) => {
      ctx.fillStyle = '#36553f'; ctx.fillRect(0, 0, 690, 110);
      write(ctx, 'XE BUÝT ĐIỆN TP.HCM', 345, 71, 52, '#dce9bc', 800, 'center');
    });
    plane(fixed, [side * 1.255, 1.145, side > 0 ? -0.75 : -0.45], [1.60, 0.255], sideName, side * R);
    plane(fixed, [side * 1.259, 2.678, -2.52], [1.27, 0.19], led('06  CHỢ LỚN', '#d4e88f', 512, 110, 66), side * R).renderOrder = 4;
    const mirrorOffset = side * 1.47;
    tube(fixed, [[side * 1.15, 2.682, -5.134], [side * 1.353, 2.71, -5.34], [mirrorOffset, 2.662, -5.51], [mirrorOffset, 2.365, -5.49]], 0.044, frame, 12);
    rounded(fixed, [mirrorOffset, 2.327, -5.474], [0.192, 0.435, 0.117], 0.049, frame);
    rounded(fixed, [mirrorOffset, 2.329, -5.403], [0.152, 0.371, 0.033], 0.015, silver);
  }

  for (const id of DOOR_IDS) {
    const { min, max } = BUS_DOORS[id];
    for (const end of [min, max]) rounded(fixed, [1.21, 1.59, end], [0.12, 2.47, 0.067], 0.019, frame);
    rounded(fixed, [1.197, 2.866, (min + max) / 2], [0.164, 0.102, max - min + 0.063], 0.037, frame);
  }

  cap(fixed, [[0.317, -5.425, 1.15], [0.405, -5.493, 1.21], [0.731, -5.486, 1.239], [1.08, -5.475, 1.245], [1.223, -5.451, 1.224]], paint, -1, 0.125);
  cap(fixed, [[0.348, -5.44, 1.155], [0.408, -5.501, 1.185], [0.461, -5.499, 1.20]], frame, -1, 0.13);
  cap(fixed, [[0.783, -5.499, 0.84], [0.99, -5.49, 1.149], [1.245, -5.455, 1.198]], frame, -1, 0.127);
  cap(fixed, [[1.205, -5.44, 1.226], [1.32, -5.451, 1.211]], frame, -1, 0.128);
  const screen = cap(fixed, [[1.306, -5.45, 1.19], [1.569, -5.454, 1.205], [2.49, -5.389, 1.208], [2.83, -5.318, 1.190], [2.915, -5.293, 1.143]], windshield, -1, 0.127); screen.renderOrder = 4;
  cap(fixed, [[2.758, -5.305, 1.211], [2.925, -5.275, 1.201], [3.026, -5.248, 1.136], [3.158, -5.153, 0.98]], bright, -1, 0.138);
  box(fixed, [0, 2.646, -5.477], [1.85, 0.292, 0.075], frame);
  plane(fixed, [0, 2.65, -5.522], [1.73, 0.224], led('06   CHỢ LỚN', '#ffbb49'), Math.PI).renderOrder = 5;
  for (const s of [-1, 1]) {
    const a: V = [s * 0.67, 1.292, -5.561], b: V = [s * 0.11, 1.422, -5.603];
    rod(fixed, a, b, 0.012, black);
    rod(fixed, b, [s * 0.82, 1.462, -5.559], 0.017, frame);
    const plate = rounded(fixed, [s * 0.932, 0.930, -5.563], [0.475, 0.197, 0.081], 0.055, frame); plate.rotation.z = -s * 0.36;
    const drl = rounded(fixed, [s * 0.943, 1.004, -5.605], [0.383, 0.036, 0.034], 0.015, headlight); drl.rotation.z = -s * 0.36;
    for (let i = 0; i < 2; i++) orb(fixed, [s * (0.86 + i * 0.139), 0.909 + i * 0.026, -5.61 + i * 0.010], [0.041, 0.041, 0.021], headlight);
    orb(fixed, [s * 1.024, 0.479, -5.578], [0.042, 0.043, 0.020], headlight);
    rod(fixed, [s * 0.095, 1.071, -5.585], [0, 0.977, -5.594], 0.014, silver, 0.013);
  }
  plane(fixed, [0, 0.580, -5.621], [0.38, 0.125], textLabel('50H-317.26', '#d4b34b', '#292b1e', 400, 124, 70), Math.PI);
  plane(fixed, [0, 0.901, -5.623], [0.32, 0.047], textLabel('SAIGON BUS', '#262f2e', '#d2d8ce', 420, 80, 48), Math.PI);
  cap(fixed, [[0.319, 5.414, 1.13], [0.41, 5.462, 1.209], [1.48, 5.446, 1.240], [1.698, 5.419, 1.205]], darkGreen, 1, 0.09);
  cap(fixed, [[1.635, 5.417, 1.219], [1.73, 5.438, 1.225]], frame, 1, 0.097);
  cap(fixed, [[1.724, 5.43, 1.17], [2.67, 5.423, 1.18], [2.829, 5.406, 1.123]], glazing, 1, 0.09).renderOrder = 3;
  cap(fixed, [[2.805, 5.418, 1.203], [2.932, 5.386, 1.202], [3.121, 5.413, 1.03]], bright, 1, 0.081);
  for (const x of [-1.09, 1.09]) {
    rounded(fixed, [x, 1.086, 5.509], [0.160, 0.678, 0.085], 0.035, frame);
    for (let i = 0; i < 4; i++) rounded(fixed, [x, 0.85 + i * 0.143, 5.555], [0.101, 0.091, 0.03], 0.020, i === 1 ? (x>0?marker:leftMarker) : i === 0 ? headlight : tail);
  }
  rounded(fixed, [0, 2.764, 5.517], [0.45, 0.084, 0.043], 0.014, brake);
  plane(fixed, [0, 0.971, 5.545], [0.378, 0.128], textLabel('50H-317.26', '#d4b34b', '#292b1e', 400, 124, 70));
  plane(fixed, [0, 2.533, 5.53], [0.45, 0.193], led('06', '#d8ea91', 320, 128, 86)).renderOrder = 4;
  for (let i = 0; i < 10; i++) box(fixed, [0, 1.270 + i * 0.036, 5.541], [0.91, 0.015, 0.019], frame, false);

  const steering=busInterior(fixed, frame, nickel, yellow, black, shadow);root.add(steering);
  batch(fixed);
  if (interiorFill) {
    const interiorLight = new T.PointLight(0xeaf4de, 7.0, 7.5, 2);
    interiorLight.position.set(0, 2.78, 0.20); root.add(interiorLight);
  }
  const beamGroup=new T.Group();root.add(beamGroup);
  const beamMap=driveTexture(new T.TextureLoader(),'light-beam'),cone=new T.MeshBasicMaterial({map:beamMap,color:0xffe8b9,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,opacity:.28});
  for(const side of [-1,1]){const spill=plane(beamGroup,[side*.93,-.004,-10.4],[2.2,9.6],cone,0,-Math.PI/2);spill.position.y=.034;spill.rotation.z=side*.05;}
  beamGroup.visible=false;
  const doors = { front: createDoor(root, 'front', frame, paint, yellow, glazing), rear: createDoor(root, 'rear', frame, paint, yellow, glazing) };
  const wheels = wheelZ.flatMap((wz) => [-1, 1].map((s) => buildWheel(root, s * 1.086, wz, s, { rubber, hub: nickel, bright: silver, black })));
  root.position.set(route.x, 0, route.z);
  let elapsed=0,lastSpeed=0,tilt=0,tiltV=0;
  return { root, night(value:boolean){beamGroup.visible=value;headlight.emissiveIntensity=value?3.4:1.8;},dispose(){plume.dispose();}, update(dt: number) {
    root.position.set(route.x, 0, route.z);
    root.rotation.y = route.yaw;
    for (const id of DOOR_IDS) doors[id](route.doors[id].amount);
    for (const wheel of wheels) wheel.rotation.x -= route.speed / 0.47 * dt;
    elapsed+=dt;const blink=Math.sin(elapsed*8)>0?3.4:.2;
    marker.emissiveIntensity=route.phase==='approaching'?blink:.18;leftMarker.emissiveIntensity=route.phase==='departing'||route.phase==='driving'&&route.progress<.03?blink:.18;
    const acceleration=T.MathUtils.clamp((route.speed-lastSpeed)/Math.max(.005,dt),-4,4);lastSpeed=route.speed;plume.update(dt,root,route.speed,acceleration);
    tiltV+=(-32*tilt-9*tiltV+acceleration*.085)*dt;tilt+=tiltV*dt;root.rotation.x=tilt;
    steering.rotation.z=route.steer*2.4+.024*Math.sin(elapsed*.7);
    brake.emissiveIntensity = route.phase === 'approaching' && route.speed < 2 || route.phase === 'departing' || route.phase === 'arrived' ? 2.3 : 0.25;
  } };
}