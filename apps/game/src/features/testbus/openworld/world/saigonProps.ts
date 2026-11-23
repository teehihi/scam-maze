/**
 * Phase 2 & 3 — 100% Instanced Saigon Street Storytelling Micro-Props + Wet-Road Tire Spray System
 * Adds hundreds of grounded Ho Chi Minh City boulevard details (road arrows, stop bars, storm drains,
 * utility transformer boxes, public bins, sidewalk "cà phê bệt" plastic tables & stools) in ~8 GPU draw calls!
 */
import * as T from "three";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";

const _m4 = new T.Matrix4();
const _q = new T.Quaternion();
const _vPos = new T.Vector3();
const _vScale = new T.Vector3();
const _up = new T.Vector3(0, 1, 0);

function pushMatrix(list: T.Matrix4[], x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) {
  _vPos.set(x, y, z);
  _q.setFromAxisAngle(_up, ry);
  _vScale.set(sx, sy, sz);
  list.push(new T.Matrix4().compose(_vPos, _q, _vScale));
}

function commitInstances(parent: T.Group, geo: T.BufferGeometry, mat: T.Material, matrices: T.Matrix4[], castShadow = false) {
  if (matrices.length === 0) return null;
  const im = new T.InstancedMesh(geo, mat, matrices.length);
  for (let i = 0; i < matrices.length; i++) im.setMatrixAt(i, matrices[i]);
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = castShadow;
  im.receiveShadow = true;
  im.matrixAutoUpdate = false;
  im.updateMatrix();
  parent.add(im);
  return im;
}

function createRoadArrowTexture(): T.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 256);
  ctx.fillStyle = "rgba(182, 179, 168, 0.72)";
  // Crisp Vietnamese road straight-ahead arrow
  ctx.beginPath();
  ctx.moveTo(64, 18);
  ctx.lineTo(106, 98);
  ctx.lineTo(80, 98);
  ctx.lineTo(80, 238);
  ctx.lineTo(48, 238);
  ctx.lineTo(48, 98);
  ctx.lineTo(22, 98);
  ctx.closePath();
  ctx.fill();
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createSoftSprayTexture(): T.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(220, 232, 244, 0.52)");
  g.addColorStop(0.55, "rgba(185, 200, 216, 0.22)");
  g.addColorStop(1, "rgba(180, 195, 210, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function buildSaigonStreetProps(parent: T.Group, solids: Solid[]): void {
  const darkMetal = new T.MeshStandardMaterial({ color: 0x2a3034, roughness: 0.62, metalness: 0.58 });
  const utilGray = new T.MeshStandardMaterial({ color: 0x8d928c, roughness: 0.78, metalness: 0.28 });
  const binGreen = new T.MeshStandardMaterial({ color: 0x2c4236, roughness: 0.72, metalness: 0.25 });
  const stoolRed = new T.MeshStandardMaterial({ color: 0x9e322c, roughness: 0.52, metalness: 0.05 });
  const stoolBlue = new T.MeshStandardMaterial({ color: 0x285284, roughness: 0.52, metalness: 0.05 });
  const inoxTable = new T.MeshStandardMaterial({ color: 0xb8c0c6, roughness: 0.34, metalness: 0.78 });
  const stopBarMat = new T.MeshStandardMaterial({
    color: 0xb4b1a4,
    roughness: 0.90,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const arrowMat = new T.MeshStandardMaterial({
    map: createRoadArrowTexture(),
    transparent: true,
    depthWrite: false,
    roughness: 0.86,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const drains: T.Matrix4[] = [];
  const utilBoxes: T.Matrix4[] = [];
  const bins: T.Matrix4[] = [];
  const tables: T.Matrix4[] = [];
  const redStools: T.Matrix4[] = [];
  const blueStools: T.Matrix4[] = [];
  const stopBars: T.Matrix4[] = [];
  const arrows: T.Matrix4[] = [];

  // 1. Storm-drain curb grates along Đường 3/2, Điện Biên Phủ, Hải Triều & Park Entrance!
  for (const x of [14, 26, 38, 72, 88, 104, 118]) {
    pushMatrix(drains, x, 0.015, -70.35, 0.78, 0.03, 0.42, 0);
    pushMatrix(drains, x, 0.015, -81.65, 0.78, 0.03, 0.42, 0);
    pushMatrix(drains, x, 0.015, -141.35, 0.78, 0.03, 0.42, 0);
    pushMatrix(drains, x, 0.015, -152.65, 0.78, 0.03, 0.42, 0);
  }
  for (const z of [-94, -112, -130, -166, -190, -214]) {
    pushMatrix(drains, 50.35, 0.015, z, 0.42, 0.03, 0.78, 0);
    pushMatrix(drains, 61.65, 0.015, z, 0.42, 0.03, 0.78, 0);
  }

  // 2. Road intersection stop bars & painted directional lane arrows (authentic HCMC traffic markings!)
  // Blvd 1 (Z=-76): Eastbound lane Z=-79, Westbound lane Z=-73
  for (const x of [24, 40, 78, 102]) {
    pushMatrix(arrows, x, 0.012, -79.0, 1.5, 3.2, 1, Math.PI / 2); // pointing +X
    pushMatrix(arrows, x, 0.012, -73.0, 1.5, 3.2, 1, -Math.PI / 2); // pointing -X
  }
  // Blvd 2 (Z=-147): Eastbound lane Z=-150, Westbound lane Z=-144
  for (const x of [24, 40, 78, 102]) {
    pushMatrix(arrows, x, 0.012, -150.0, 1.5, 3.2, 1, Math.PI / 2);
    pushMatrix(arrows, x, 0.012, -144.0, 1.5, 3.2, 1, -Math.PI / 2);
  }
  // Hải Triều (X=56): Southbound X=59 (+Z), Northbound X=53 (-Z)
  for (const z of [-102, -124, -172, -206]) {
    pushMatrix(arrows, 59.0, 0.012, z, 1.5, 3.2, 1, Math.PI); // pointing +Z
    pushMatrix(arrows, 53.0, 0.012, z, 1.5, 3.2, 1, 0); // pointing -Z
  }
  // White stop bars ahead of every crosswalk at X=56 intersections
  pushMatrix(stopBars, 45.4, 0.01, -79.0, 0.45, 0.01, 5.4, 0);
  pushMatrix(stopBars, 66.6, 0.01, -73.0, 0.45, 0.01, 5.4, 0);
  pushMatrix(stopBars, 45.4, 0.01, -150.0, 0.45, 0.01, 5.4, 0);
  pushMatrix(stopBars, 66.6, 0.01, -144.0, 0.45, 0.01, 5.4, 0);
  pushMatrix(stopBars, 59.0, 0.01, -86.6, 5.4, 0.01, 0.45, 0);
  pushMatrix(stopBars, 53.0, 0.01, -65.4, 5.4, 0.01, 0.45, 0);
  pushMatrix(stopBars, 59.0, 0.01, -157.6, 5.4, 0.01, 0.45, 0);
  pushMatrix(stopBars, 53.0, 0.01, -136.4, 5.4, 0.01, 0.45, 0);

  // 3. Vietnamese street utility transformer cabinets ("tủ điện") & public trash bins strictly on sidewalks
  const utilSpots: [number, number][] = [
    [13.5, -66.5],
    [36.5, -85.4],
    [76.0, -66.5],
    [94.0, -85.4],
    [14.0, -137.5],
    [47.0, -112.0],
    [65.0, -110.0],
    [47.0, -188.0],
    [4.0, -230.0],
    [4.0, -278.0],
  ];
  for (const [ux, uz] of utilSpots) {
    pushMatrix(utilBoxes, ux, CURB_HEIGHT + 0.62, uz, 0.72, 1.24, 0.48, 0);
    solids.push(rect(ux, uz, 0.78, 0.54));
  }

  const binSpots: [number, number][] = [
    [22.5, -68.6],
    [41.5, -83.2],
    [74.5, -83.2],
    [98.0, -68.6],
    [22.5, -139.6],
    [74.5, -154.2],
    [48.2, -106.0],
    [63.8, -120.0],
    [70.5, -172.0],
    [70.5, -198.0],
    [14.0, -314.8],
    [38.0, -314.8],
  ];
  for (const [bx, bz] of binSpots) {
    pushMatrix(bins, bx, CURB_HEIGHT + 0.44, bz, 0.44, 0.88, 0.44, 0);
    solids.push(rect(bx, bz, 0.48, 0.48));
  }

  // 4. Authentic Saigon sidewalk "cà phê bệt / trà đá" inox tables & plastic red/blue stools tucked on wide sidewalks!
  const cafeSpots: [number, number][] = [
    [26.5, -66.6],
    [39.5, -66.6],
    [82.0, -66.6],
    [26.5, -85.2],
    [80.0, -137.6],
    [100.0, -137.6],
    [47.4, -95.0],
    [47.4, -129.0],
  ];
  for (let i = 0; i < cafeSpots.length; i++) {
    const [cx, cz] = cafeSpots[i];
    pushMatrix(tables, cx, CURB_HEIGHT + 0.52, cz, 0.68, 0.04, 0.52, 0);
    pushMatrix(tables, cx - 0.28, CURB_HEIGHT + 0.26, cz - 0.2, 0.035, 0.52, 0.035, 0);
    pushMatrix(tables, cx + 0.28, CURB_HEIGHT + 0.26, cz - 0.2, 0.035, 0.52, 0.035, 0);
    pushMatrix(tables, cx - 0.28, CURB_HEIGHT + 0.26, cz + 0.2, 0.035, 0.52, 0.035, 0);
    pushMatrix(tables, cx + 0.28, CURB_HEIGHT + 0.26, cz + 0.2, 0.035, 0.52, 0.035, 0);
    const stoolBucket = i % 2 === 0 ? redStools : blueStools;
    pushMatrix(stoolBucket, cx - 0.68, CURB_HEIGHT + 0.22, cz - 0.14, 0.28, 0.44, 0.28, 0.2);
    pushMatrix(stoolBucket, cx + 0.68, CURB_HEIGHT + 0.22, cz + 0.14, 0.28, 0.44, 0.28, -0.3);
    pushMatrix(stoolBucket, cx + 0.05, CURB_HEIGHT + 0.22, cz + 0.58, 0.28, 0.44, 0.28, 0.5);
    solids.push(rect(cx, cz, 0.85, 0.7));
  }

  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const arrowGeo = new T.PlaneGeometry(1, 1);
  arrowGeo.rotateX(-Math.PI / 2);

  commitInstances(parent, boxGeo, darkMetal, drains, false);
  commitInstances(parent, boxGeo, utilGray, utilBoxes, false);
  commitInstances(parent, boxGeo, binGreen, bins, false);
  commitInstances(parent, boxGeo, inoxTable, tables, false);
  commitInstances(parent, boxGeo, stoolRed, redStools, false);
  commitInstances(parent, boxGeo, stoolBlue, blueStools, false);
  commitInstances(parent, boxGeo, stopBarMat, stopBars, false);
  commitInstances(parent, arrowGeo, arrowMat, arrows, false);
}

// =============================================================================
// GTA 6 WET-ROAD TIRE SPRAY MIST SYSTEM (1 DRAW CALL FOR ALL BOULEVARD TRAFFIC!)
// =============================================================================
export interface TireSprayHandle {
  mesh: T.InstancedMesh;
  update: (
    vehicles: { group: T.Group; axis: "x" | "z"; dir: number; curSpeed: number }[],
    wetness: number,
    rainIntensity: number,
    time: number,
  ) => void;
  updateFromAgents: (
    agents: readonly { x: number; z: number; yaw: number; speed: number; halfWidth: number; halfLength: number; lodTier: number }[],
    wetness: number,
    rainIntensity: number,
    time: number,
  ) => void;
  dispose: () => void;
}

export function createWetTireSpraySystem(parent: T.Group, maxVehicles = 24): TireSprayHandle {
  const puffsPerVehicle = 2;
  const total = maxVehicles * puffsPerVehicle;
  const geo = new T.PlaneGeometry(1.5, 0.95);
  const mat = new T.MeshBasicMaterial({
    map: createSoftSprayTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const mesh = new T.InstancedMesh(geo, mat, total);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  // Park all unused puffs cleanly out of view
  for (let i = 0; i < total; i++) {
    _m4.makeScale(0, 0, 0);
    mesh.setMatrixAt(i, _m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  parent.add(mesh);

  return {
    mesh,
    update(vehicles, wetness, rainIntensity, time) {
      const sprayStrength = Math.max(0, (wetness - 0.35) * 0.8 + rainIntensity * 0.65);
      mat.opacity = Math.min(0.42, sprayStrength * 0.45);
      const visible = sprayStrength > 0.05;
      mesh.visible = visible;
      if (!visible) return;

      let idx = 0;
      for (let i = 0; i < vehicles.length && idx + 1 < total; i++) {
        const v = vehicles[i];
        if (!v.group.visible || v.curSpeed < 1.2) {
          _m4.makeScale(0, 0, 0);
          mesh.setMatrixAt(idx++, _m4);
          mesh.setMatrixAt(idx++, _m4);
          continue;
        }
        const speedNorm = Math.min(1.2, v.curSpeed / 7.0);
        const px = v.group.position.x;
        const pz = v.group.position.z;
        const ry = v.axis === "x" ? 0 : Math.PI / 2;
        for (let p = 0; p < puffsPerVehicle; p++) {
          const phase = ((time * 2.4 + i * 0.73 + p * 0.5) % 1.0);
          const trail = 1.65 + phase * 2.4;
          const lateral = (p === 0 ? -0.52 : 0.52);
          const wx = v.axis === "x" ? px - v.dir * trail : px + lateral;
          const wz = v.axis === "z" ? pz - v.dir * trail : pz + lateral;
          const wy = 0.28 + phase * 0.45;
          const sc = (0.55 + phase * 1.15) * speedNorm;
          _vPos.set(wx, wy, wz);
          _q.setFromAxisAngle(_up, ry + (p === 0 ? 0.18 : -0.18));
          _vScale.set(sc, sc * 0.8, sc);
          _m4.compose(_vPos, _q, _vScale);
          mesh.setMatrixAt(idx++, _m4);
        }
      }
      while (idx < total) {
        _m4.makeScale(0, 0, 0);
        mesh.setMatrixAt(idx++, _m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    updateFromAgents(agents, wetness, rainIntensity, time) {
      const sprayStrength = Math.max(0, (wetness - 0.32) * 0.85 + rainIntensity * 0.65);
      mat.opacity = Math.min(0.42, sprayStrength * 0.45);
      const visible = sprayStrength > 0.05;
      mesh.visible = visible;
      if (!visible) return;

      let idx = 0;
      for (let i = 0; i < agents.length && idx + 1 < total; i++) {
        const v = agents[i];
        if (v.lodTier === 2 || v.speed < 1.3) continue;
        const speedNorm = Math.min(1.25, v.speed / 7.5);
        const fx = Math.sin(v.yaw);
        const fz = Math.cos(v.yaw);
        const rx = -fz;
        const rz = fx;
        const latOff = Math.min(0.75, v.halfWidth * 0.65);
        for (let p = 0; p < puffsPerVehicle; p++) {
          const phase = (time * 2.4 + i * 0.73 + p * 0.5) % 1.0;
          const trail = v.halfLength + 0.4 + phase * 2.3;
          const side = p === 0 ? -latOff : latOff;
          const wx = v.x - fx * trail + rx * side;
          const wz = v.z - fz * trail + rz * side;
          const wy = 0.25 + phase * 0.42;
          const sc = (0.48 + phase * 1.1) * speedNorm;
          _vPos.set(wx, wy, wz);
          _q.setFromAxisAngle(_up, v.yaw + Math.PI / 2 + (p === 0 ? 0.18 : -0.18));
          _vScale.set(sc, sc * 0.8, sc);
          _m4.compose(_vPos, _q, _vScale);
          mesh.setMatrixAt(idx++, _m4);
        }
      }
      while (idx < total) {
        _m4.makeScale(0, 0, 0);
        mesh.setMatrixAt(idx++, _m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.map?.dispose();
      mat.dispose();
    },
  };
}
