import * as THREE from 'three';
import type { HueMaterialSet } from '../../engine/materials/HueMaterialFoundry';
import {
  getTuDucLakeFactor,
  WATER_LEVEL_TU_DUC,
} from '../hueWorldConfig';
import {
  createHueLantern,
  createHueStaircase,
  createSweepingHueRoof,
} from './hueArchitecturalHelpers';
import type { LanternHandle } from './hueArchitecturalHelpers';

export interface TuDucBuildResult {
  group: THREE.Group;
  lanterns: LanternHandle[];
}

export function buildTuDucLakeComplex(mats: HueMaterialSet): TuDucBuildResult {
  const root = new THREE.Group();
  root.name = 'TuDucLakeComplex';
  const lanterns: LanternHandle[] = [];

  // -------------------------------------------------------------------------
  // 1. Hồ Lưu Khiêm Stone Retaining Embankment ("Kè Đá Hộc Phủ Rêu")
  // -------------------------------------------------------------------------
  const rimSegs = 68;
  const cx = -72;
  const cz = 175;
  for (let i = 0; i < rimSegs; i++) {
    const a = (i / rimSegs) * Math.PI * 2;
    // Trace shoreline contour where lake factor transitions ~0.35
    let r = 34;
    for (let step = 0; step < 12; step++) {
      const tx = cx + Math.cos(a) * r * 1.35;
      const tz = cz + Math.sin(a) * r * 0.85;
      const f = getTuDucLakeFactor(tx, tz);
      r += (f - 0.25) * 4.5;
    }
    const px = cx + Math.cos(a) * r * 1.35;
    const pz = cz + Math.sin(a) * r * 0.85;

    // Leave open gap where Xung Khiêm Tạ / Dũ Khiêm Tạ / Bridge sit
    if (Math.hypot(px + 38, pz - 168) < 9.5) continue;
    if (Math.hypot(px + 52, pz - 144) < 5.5) continue;

    const stoneBlock = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.3, 1.4),
      mats.daHocMortar,
    );
    stoneBlock.position.set(px, WATER_LEVEL_TU_DUC + 0.35, pz);
    stoneBlock.rotation.y = -a + Math.PI * 0.5;
    stoneBlock.castShadow = true;
    stoneBlock.receiveShadow = true;
    root.add(stoneBlock);

    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(4.25, 0.24, 1.52),
      mats.daThanh,
    );
    coping.position.set(px, WATER_LEVEL_TU_DUC + 1.52, pz);
    coping.rotation.y = -a + Math.PI * 0.5;
    root.add(coping);
  }

  // -------------------------------------------------------------------------
  // 2. XUNG KHIÊM TẠ (Overwater Twin-Roof Pavilion on Gỗ Lim Pilings!)
  //    Center: (-38, 4.0, 168), deck at y = 5.25m, facing West (-X) over lake
  // -------------------------------------------------------------------------
  const xk = new THREE.Group();
  xk.position.set(-38.5, WATER_LEVEL_TU_DUC, 168);

  // Wooden deck floor (20m along Z, 13m along X -> cantilevered over lake!)
  const deckW = 13.0;
  const deckD = 20.0;
  const deckY = 1.25; // world 5.25m

  const deckSlab = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.36, deckD), mats.goLimAged);
  deckSlab.position.set(0, deckY - 0.18, 0);
  deckSlab.castShadow = true;
  deckSlab.receiveShadow = true;
  xk.add(deckSlab);

  // Two-dimensional grid of Gỗ Lim water pilings plunging into Hồ Lưu Khiêm
  for (let px = -5.4; px <= 5.5; px += 2.7) {
    for (let pz = -8.6; pz <= 8.7; pz += 2.85) {
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.19, 3.4, 8),
        mats.goLimAged,
      );
      pile.position.set(px, deckY - 1.75, pz);
      pile.castShadow = true;
      xk.add(pile);
    }
  }

  // Creamy-grey perforated stone/wood balustrade ("Lan Can Con Tiện") seen in tu_duc_pavilion.jpg!
  const addBalustradeRun = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    skipStairs = false,
  ) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const angle = Math.atan2(x1 - x0, z1 - z0);
    const run = new THREE.Group();
    run.position.set((x0 + x1) * 0.5, deckY, (z0 + z1) * 0.5);
    run.rotation.y = angle;

    // Top & bottom rail beams
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, len), mats.hueLimeWall);
    topRail.position.y = 0.78;
    run.add(topRail);

    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, len), mats.hueLimeWall);
    botRail.position.y = 0.08;
    run.add(botRail);

    const numPosts = Math.max(2, Math.floor(len / 0.55));
    for (let i = 0; i <= numPosts; i++) {
      const t = (i / numPosts - 0.5) * len;
      if (skipStairs && (Math.abs(t + 5.2) < 1.1 || Math.abs(t - 5.2) < 1.1)) continue;
      const isMajor = i % 4 === 0;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(isMajor ? 0.22 : 0.1, isMajor ? 0.92 : 0.68, isMajor ? 0.22 : 0.1),
        mats.hueLimeWall,
      );
      post.position.set(0, isMajor ? 0.46 : 0.42, t);
      run.add(post);
    }
    xk.add(run);
  };

  // West waterfront edge (skipping two boat-landing stair openings!)
  addBalustradeRun(-deckW * 0.5 + 0.3, -deckD * 0.5 + 0.3, -deckW * 0.5 + 0.3, deckD * 0.5 - 0.3, true);
  // North & South ends
  addBalustradeRun(-deckW * 0.5 + 0.3, -deckD * 0.5 + 0.3, deckW * 0.5 - 0.3, -deckD * 0.5 + 0.3, false);
  addBalustradeRun(-deckW * 0.5 + 0.3, deckD * 0.5 - 0.3, deckW * 0.5 - 0.3, deckD * 0.5 - 0.3, false);

  // Two small wooden boat-landing stairs dipping straight into the lake (exact from tu_duc_pavilion.jpg!)
  for (const sz of [-5.2, 5.2]) {
    const stair = new THREE.Group();
    stair.position.set(-deckW * 0.5 - 0.35, deckY, sz);
    for (let s = 0; s < 5; s++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 1.35), mats.goLimAged);
      tread.position.set(-s * 0.24, -s * 0.3 - 0.15, 0);
      stair.add(tread);
    }
    for (const side of [-0.65, 0.65]) {
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), mats.goLimAged);
      stringer.position.set(-0.45, -0.7, side);
      stringer.rotation.z = -0.68;
      stair.add(stringer);
    }
    xk.add(stair);
  }

  // Open timber colonnade ("Hàng cột gỗ lim") — 5 bays along Z, 3 rows along X
  const colXs = [-4.8, 0, 4.8];
  const colZs = [-8.2, -4.1, 0, 4.1, 8.2];
  for (const cxCol of colXs) {
    for (const czCol of colZs) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.21, 3.65, 10),
        mats.goLimAged,
      );
      col.position.set(cxCol, deckY + 1.82, czCol);
      col.castShadow = true;
      xk.add(col);

      const stonePad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, 0.16, 8),
        mats.daThanh,
      );
      stonePad.position.set(cxCol, deckY + 0.08, czCol);
      xk.add(stonePad);
    }
  }

  // Lacquered timber rear wall panels & poetic wooden plaques
  const rearChamber = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, 11.5), mats.goLimLacquered);
  rearChamber.position.set(3.4, deckY + 1.6, 0);
  rearChamber.castShadow = true;
  xk.add(rearChamber);

  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 2.2), mats.sonSonThepVang);
  plaque.position.set(-4.65, deckY + 3.15, 0);
  xk.add(plaque);

  // Twin-Tier "Trùng Thiềm Điệp Ốc" Warm Amber Ngói Lưu Ly Roof!
  // Rotated so ridge runs parallel to the lake shoreline (along Z)
  const xkLowerRoof = createSweepingHueRoof(21.6, 13.8, 2.2, {
    ridgeLength: 10.5,
    eaveLift: 0.44,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: false,
  });
  xkLowerRoof.rotation.y = Math.PI * 0.5;
  xkLowerRoof.position.set(0, deckY + 3.45, 0);
  xk.add(xkLowerRoof);

  const xkUpperRoof = createSweepingHueRoof(16.8, 8.4, 2.35, {
    ridgeLength: 9.2,
    eaveLift: 0.38,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: true,
  });
  xkUpperRoof.rotation.y = Math.PI * 0.5;
  xkUpperRoof.position.set(1.2, deckY + 5.15, 0);
  xk.add(xkUpperRoof);

  // Warm lanterns beneath eaves reflecting over Hồ Lưu Khiêm
  for (const lz of [-5.5, 0, 5.5]) {
    const l = createHueLantern(lanterns, 0.9, lz === 0);
    l.position.set(-5.2, deckY + 2.85, lz);
    xk.add(l);
  }
  root.add(xk);

  // -------------------------------------------------------------------------
  // 3. DŨ KHIÊM TẠ (-52, 4.0, 144 — Triple-Tiered Boat-Landing Pavilion)
  // -------------------------------------------------------------------------
  const dk = new THREE.Group();
  dk.position.set(-52, WATER_LEVEL_TU_DUC, 144);

  const dkDeck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 7.2), mats.goLimAged);
  dkDeck.position.y = 1.1;
  dkDeck.castShadow = true;
  dkDeck.receiveShadow = true;
  dk.add(dkDeck);

  for (const px of [-2.8, 0, 2.8]) {
    for (const pz of [-2.8, 0, 2.8]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.9, 8), mats.goLimAged);
      pile.position.set(px, -0.4, pz);
      dk.add(pile);
    }
  }
  for (const px of [-2.6, 2.6]) {
    for (const pz of [-2.6, 2.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 3.0, 10), mats.goLimAged);
      col.position.set(px, 2.65, pz);
      col.castShadow = true;
      dk.add(col);
    }
  }
  const dkRoof1 = createSweepingHueRoof(8.6, 8.6, 1.4, {
    ridgeLength: 1.8,
    eaveLift: 0.38,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: false,
  });
  dkRoof1.position.y = 4.05;
  dk.add(dkRoof1);

  const dkRoof2 = createSweepingHueRoof(5.6, 5.6, 1.45, {
    ridgeLength: 0.8,
    eaveLift: 0.32,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: true,
  });
  dkRoof2.position.y = 5.25;
  dk.add(dkRoof2);

  const dkL = createHueLantern(lanterns, 0.85, true);
  dkL.position.y = 3.55;
  dk.add(dkL);
  root.add(dk);

  // -------------------------------------------------------------------------
  // 4. CẦU TIỂU KHIÊM TRÌ (Arched Bridge at x = -100..-84, z = 172)
  // -------------------------------------------------------------------------
  const bridge = new THREE.Group();
  bridge.position.set(-92, WATER_LEVEL_TU_DUC + 1.4, 172);
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const t0 = (i / segs - 0.5) * 16;
    const t1 = ((i + 1) / segs - 0.5) * 16;
    const xm = (t0 + t1) * 0.5;
    const u = xm / 8;
    const ym = (1 - u * u) * 0.9;
    const slope = (-2 * u * 0.9) / 8;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 4.0), mats.daThanhStairs);
    plank.position.set(xm, ym - 0.15, 0);
    plank.rotation.z = Math.atan(slope);
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridge.add(plank);

    for (const side of [-1.85, 1.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.72, 0.24), mats.hueLimeWall);
      rail.position.set(xm, ym + 0.36, side);
      rail.rotation.z = Math.atan(slope);
      bridge.add(rail);
    }
  }
  root.add(bridge);

  // -------------------------------------------------------------------------
  // 5. KHIÊM CUNG MÔN (2-Story Timber Gate) & HÒA KHIÊM ĐIỆN (-108 & -132)
  // -------------------------------------------------------------------------
  const gate = new THREE.Group();
  gate.position.set(-108, 5.4, 172);

  const gPlinth = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.75, 16.5), mats.daThanh);
  gPlinth.position.y = 0.375;
  gPlinth.receiveShadow = true;
  gate.add(gPlinth);

  // Two-story timber frame (facing East toward lake)
  for (const pz of [-5.8, -2.1, 2.1, 5.8]) {
    for (const px of [-2.4, 2.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 4.2, 10), mats.goLimAged);
      col.position.set(px, 2.85, pz);
      col.castShadow = true;
      gate.add(col);
    }
  }
  const gWalls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.6, 13.5), mats.goLimLacquered);
  gWalls.position.set(0, 2.55, 0);
  // Leave central doorway feel via recessed panel walls
  for (const sz of [-4.6, 4.6]) {
    const sideBay = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.6, 4.4), mats.goLimLacquered);
    sideBay.position.set(0, 2.55, sz);
    sideBay.castShadow = true;
    gate.add(sideBay);
  }
  const gRoof1 = createSweepingHueRoof(17.5, 9.2, 1.85, {
    ridgeLength: 9.0,
    eaveLift: 0.4,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: false,
  });
  gRoof1.rotation.y = Math.PI * 0.5;
  gRoof1.position.y = 4.65;
  gate.add(gRoof1);

  const gUpperBox = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.0, 7.6), mats.goLimLacquered);
  gUpperBox.position.y = 6.35;
  gate.add(gUpperBox);

  const gRoof2 = createSweepingHueRoof(10.8, 6.8, 1.9, {
    ridgeLength: 5.2,
    eaveLift: 0.36,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: true,
  });
  gRoof2.rotation.y = Math.PI * 0.5;
  gRoof2.position.y = 7.3;
  gate.add(gRoof2);

  const gl = createHueLantern(lanterns, 1.0, true);
  gl.position.set(2.9, 4.0, 0);
  gate.add(gl);
  root.add(gate);

  // Hòa Khiêm Điện (-132, 6.4, 172)
  const palace = new THREE.Group();
  palace.position.set(-132, 6.4, 172);

  const pPlinth = new THREE.Mesh(new THREE.BoxGeometry(15.5, 1.05, 25.5), mats.daThanh);
  pPlinth.position.y = 0.525;
  pPlinth.receiveShadow = true;
  palace.add(pPlinth);

  const pSteps = createHueStaircase(5.6, 1.05, 2.4, 5, mats.daThanhStairs, mats.daThanh, mats.khaiDinhDarkTrim, true);
  pSteps.position.set(8.0, 0, 0);
  pSteps.rotation.y = -Math.PI * 0.5;
  palace.add(pSteps);

  const pCore = new THREE.Mesh(new THREE.BoxGeometry(11.0, 4.4, 21.0), mats.goLimLacquered);
  pCore.position.y = 3.25;
  pCore.castShadow = true;
  palace.add(pCore);

  for (let pz = -9.5; pz <= 9.6; pz += 3.16) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 4.4, 10), mats.goLimAged);
    col.position.set(6.4, 3.25, pz);
    col.castShadow = true;
    palace.add(col);
  }

  const pRoof1 = createSweepingHueRoof(26.5, 15.8, 2.4, {
    ridgeLength: 14.0,
    eaveLift: 0.45,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: false,
  });
  pRoof1.rotation.y = Math.PI * 0.5;
  pRoof1.position.y = 5.35;
  palace.add(pRoof1);

  const pRoof2 = createSweepingHueRoof(20.5, 10.6, 2.6, {
    ridgeLength: 11.2,
    eaveLift: 0.42,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: true,
  });
  pRoof2.rotation.y = Math.PI * 0.5;
  pRoof2.position.y = 7.45;
  palace.add(pRoof2);

  root.add(palace);

  // -------------------------------------------------------------------------
  // 6. Floating Sen Huế (Lotus Pads & Pink/Cream Lotus Blossoms) on Hồ Lưu Khiêm
  // -------------------------------------------------------------------------
  const padGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.03, 14, 1, false, 0, Math.PI * 1.88);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3b6f38, roughness: 0.65 });
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xf4a9bc,
    emissive: 0x3a1020,
    emissiveIntensity: 0.12,
    roughness: 0.45,
  });

  const padMatrices: THREE.Matrix4[] = [];
  const flowerMatrices: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();

  for (let i = 0; i < 160; i++) {
    // Deterministic spread inside Hồ Lưu Khiêm
    const h1 = Math.sin(i * 12.9898) * 43758.5453;
    const h2 = Math.sin(i * 78.233) * 43758.5453;
    const rx = (h1 - Math.floor(h1) - 0.5) * 68;
    const rz = (h2 - Math.floor(h2) - 0.5) * 42;
    const lx = cx + rx;
    const lz = cz + rz;

    if (getTuDucLakeFactor(lx, lz) < 0.58) continue;
    // Skip under Xung Khiêm Tạ deck
    if (lx > -46 && lx < -31 && lz > 157 && lz < 179) continue;

    const sc = 0.65 + (i % 5) * 0.18;
    pos.set(lx, WATER_LEVEL_TU_DUC + 0.03, lz);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7);
    s.set(sc, 1, sc);
    m.compose(pos, q, s);
    padMatrices.push(m.clone());

    if (i % 3 === 0) {
      pos.set(lx + 0.15, WATER_LEVEL_TU_DUC + 0.18, lz + 0.1);
      s.set(sc * 0.8, sc * 0.8, sc * 0.8);
      m.compose(pos, q, s);
      flowerMatrices.push(m.clone());
    }
  }

  if (padMatrices.length > 0) {
    const padInst = new THREE.InstancedMesh(padGeo, padMat, padMatrices.length);
    padMatrices.forEach((mat, idx) => padInst.setMatrixAt(idx, mat));
    padInst.instanceMatrix.needsUpdate = true;
    padInst.receiveShadow = true;
    root.add(padInst);
  }
  if (flowerMatrices.length > 0) {
    const flowerGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const flowerInst = new THREE.InstancedMesh(flowerGeo, petalMat, flowerMatrices.length);
    flowerMatrices.forEach((mat, idx) => flowerInst.setMatrixAt(idx, mat));
    flowerInst.instanceMatrix.needsUpdate = true;
    root.add(flowerInst);
  }

  return { group: root, lanterns };
}
