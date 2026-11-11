import * as THREE from 'three';
import type { HueMaterialSet } from '../../engine/materials/HueMaterialFoundry';
import { getCanalCenterX } from '../hueWorldConfig';
import {
  createCornerDragonFinial,
  createHueLantern,
  createSweepingHueRoof,
} from './hueArchitecturalHelpers';
import type { LanternHandle } from './hueArchitecturalHelpers';

export interface ThanhToanBuildResult {
  group: THREE.Group;
  lanterns: LanternHandle[];
}

export function buildThanhToanAndVillage(mats: HueMaterialSet): ThanhToanBuildResult {
  const root = new THREE.Group();
  root.name = 'ThanhToanAndVillage';
  const lanterns: LanternHandle[] = [];

  const BZ = 215;
  const BX = getCanalCenterX(BZ); // ~ 260m

  // -------------------------------------------------------------------------
  // 1. CẦU NGÓI THANH TOÀN (x = BX - 11.5 .. BX + 11.5, z = 215)
  // -------------------------------------------------------------------------
  const bridge = new THREE.Group();
  bridge.position.set(BX, 0, BZ);

  const HALF_LEN = 11.5; // Total length 23m including portals
  const HALF_W = 2.65;
  const deckY = (xLocal: number) => {
    const u = Math.min(1, Math.abs(xLocal) / HALF_LEN);
    return 2.35 + (1 - u * u) * 1.45;
  };

  // Stone bank abutments, sloped village entry ramps & timber water pilings
  for (const dir of [-1, 1]) {
    const abut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.8, 6.2), mats.daHocMortar);
    abut.position.set(dir * (HALF_LEN - 0.7), 1.1, 0);
    abut.receiveShadow = true;
    abut.castShadow = true;
    bridge.add(abut);

    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.3, 5.4), mats.daThanhStairs);
    ramp.position.set(dir * (HALF_LEN + 2.1), 1.75, 0);
    ramp.rotation.z = -dir * 0.14;
    ramp.receiveShadow = true;
    bridge.add(ramp);
  }
  for (const px of [-5.8, -2.2, 2.2, 5.8]) {
    for (const pz of [-2.1, 2.1]) {
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 4.2, 8),
        mats.goLimAged,
      );
      pile.position.set(px, 1.3, pz);
      pile.castShadow = true;
      bridge.add(pile);
    }
  }

  // Arched wooden deck planks & side wooden rest benches ("hai dãy bục gỗ")
  const segs = 14;
  for (let i = 0; i < segs; i++) {
    const x0 = (i / segs - 0.5) * (HALF_LEN * 2);
    const x1 = ((i + 1) / segs - 0.5) * (HALF_LEN * 2);
    const xm = (x0 + x1) * 0.5;
    const ym = deckY(xm);
    const slope = (deckY(x1) - deckY(x0)) / (x1 - x0);
    const segLen = Math.hypot(x1 - x0, deckY(x1) - deckY(x0)) + 0.08;

    const plank = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.22, HALF_W * 2), mats.goLimAged);
    plank.position.set(xm, ym - 0.11, 0);
    plank.rotation.z = Math.atan(slope);
    plank.receiveShadow = true;
    plank.castShadow = true;
    bridge.add(plank);

    // Side benches & backrests (skip center altar alcove slightly on North side)
    for (const side of [-1, 1]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.14, 0.62), mats.goLimLacquered);
      bench.position.set(xm, ym + 0.42, side * (HALF_W - 0.42));
      bench.rotation.z = Math.atan(slope);
      bridge.add(bench);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.56, 0.12), mats.goLimAged);
      rail.position.set(xm, ym + 0.85, side * (HALF_W - 0.12));
      rail.rotation.z = Math.atan(slope);
      bridge.add(rail);
    }
  }

  // 7-Bay Exposed Timber Vì Kèo Trusses (8 truss bents across x)
  const bentXs = [-9.6, -6.7, -3.9, -1.55, 1.55, 3.9, 6.7, 9.6]; // Wider central bay [-1.55, +1.55]
  bentXs.forEach((bx) => {
    const base = deckY(bx);
    const eaveH = 2.65;
    const ridgeH = 4.35;

    // Left & Right timber columns
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, eaveH, 8), mats.goLimAged);
      col.position.set(bx, base + eaveH * 0.5, side * (HALF_W - 0.22));
      col.castShadow = true;
      bridge.add(col);
    }

    // Tie beam ("xà ngang") & central king post ("trụ trốn")
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, HALF_W * 2 - 0.2), mats.goLimAged);
    tie.position.set(bx, base + eaveH, 0);
    bridge.add(tie);

    const kingPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, ridgeH - eaveH, 0.18), mats.goLimAged);
    kingPost.position.set(bx, base + (eaveH + ridgeH) * 0.5, 0);
    bridge.add(kingPost);

    // Pitched rafters
    for (const side of [-1, 1]) {
      const rLen = Math.hypot(HALF_W + 0.35, ridgeH - eaveH + 0.2);
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, rLen), mats.goLimAged);
      rafter.position.set(bx, base + (eaveH + ridgeH) * 0.5 - 0.05, side * (HALF_W * 0.52));
      rafter.rotation.x = side * Math.atan2(ridgeH - eaveH, HALF_W);
      bridge.add(rafter);
    }
  });

  // Central Bay Altar to Bà Trần Thị Đạo (on North side z = -1.75)
  const shrine = new THREE.Group();
  shrine.position.set(0, deckY(0), -1.85);
  const shrineTable = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.95, 0.72), mats.goLimLacquered);
  shrineTable.position.y = 0.475;
  shrine.add(shrineTable);
  const shrineBack = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.8, 0.18), mats.sonSonThepVang);
  shrineBack.position.set(0, 1.4, -0.28);
  shrine.add(shrineBack);
  const shrineLantern = createHueLantern(lanterns, 0.8, true);
  shrineLantern.position.set(0, 2.25, 0.25);
  shrine.add(shrineLantern);
  bridge.add(shrine);

  // Curved Arched Bridge Roof in Glazed Green Ngói Thanh Lưu Ly!
  const roofSegs = 16;
  const rPos: number[] = [];
  const rUvs: number[] = [];
  const rIdx: number[] = [];
  let rV = 0;

  for (const side of [-1, 1]) {
    const start = rV;
    for (let i = 0; i <= roofSegs; i++) {
      const t = i / roofSegs;
      const x = (t - 0.5) * (HALF_LEN * 2 - 0.2);
      const yBase = deckY(Math.max(-HALF_LEN, Math.min(HALF_LEN, x)));
      const yEave = yBase + 2.48;
      const yRidge = yBase + 4.45;

      // 3 profile stations from ridge (v=1) to eave (v=0) for slight concave sweep
      for (let j = 0; j <= 4; j++) {
        const v = j / 4;
        const z = side * (1 - v) * (HALF_W + 0.75);
        const y = THREE.MathUtils.lerp(yEave, yRidge, v) - Math.sin(v * Math.PI) * 0.2;
        rPos.push(x, y, z);
        rUvs.push(t * 5, v * 1.6);
        rV++;
      }
    }
    for (let i = 0; i < roofSegs; i++) {
      for (let j = 0; j < 4; j++) {
        const a = start + i * 5 + j;
        const b = a + 1;
        const c = a + 5;
        const d = c + 1;
        if (side > 0) {
          rIdx.push(a, c, d, a, d, b);
        } else {
          rIdx.push(a, d, c, a, b, d);
        }
      }
    }
  }
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
  roofGeo.setIndex(rIdx);
  roofGeo.computeVertexNormals();
  mats.ngoiLuuLyGreen.side = THREE.DoubleSide;
  const roofMesh = new THREE.Mesh(roofGeo, mats.ngoiLuuLyGreen);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  bridge.add(roofMesh);

  // Ornamental Entrance Portals ("Cổng Vòm Vàng Kem + Cuốn Thư + Khảm Sành Sứ") on BOTH Ends!
  for (const dir of [-1, 1]) {
    const portal = new THREE.Group();
    portal.position.set(dir * (HALF_LEN - 0.1), deckY(HALF_LEN), 0);
    portal.rotation.y = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

    // Two ochre masonry pillars with cobalt porcelain panels
    for (const sx of [-2.45, 2.45]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.76, 3.3, 0.76), mats.ochreVillagePlaster);
      pil.position.set(sx, 1.65, 0);
      pil.castShadow = true;
      portal.add(pil);

      const mosaicInset = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.35, 0.8), mats.phapLamCobalt);
      mosaicInset.position.set(sx, 1.7, 0);
      portal.add(mosaicInset);
    }

    // Creamy-ochre pitched gable fascia enclosing the tiled bridge roof cleanly
    const gableShape = new THREE.Shape([
      new THREE.Vector2(-3.2, 2.45),
      new THREE.Vector2(3.2, 2.45),
      new THREE.Vector2(2.6, 3.65),
      new THREE.Vector2(0, 4.65),
      new THREE.Vector2(-2.6, 3.65),
    ]);
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.62, bevelEnabled: false });
    gableGeo.translate(0, 0, -0.31);
    const header = new THREE.Mesh(gableGeo, mats.ochreVillagePlaster);
    header.castShadow = true;
    portal.add(header);

    // Central "Cuốn Thư" banner panel inlaid with khảm sành sứ
    const cuonThu = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.9, 0.7), mats.porcelainMosaicWall);
    cuonThu.position.set(0, 4.25, 0);
    portal.add(cuonThu);

    // Flanking porcelain dragon-phoenix ridge acroteria curving along gable edges
    for (const sx of [-1, 1]) {
      const wingCrest = createCornerDragonFinial(mats.porcelainMosaicWall, 0.56);
      wingCrest.position.set(sx * 2.95, 2.55, 0.1);
      wingCrest.rotation.z = -sx * 0.35;
      portal.add(wingCrest);
    }

    const portalLantern = createHueLantern(lanterns, 0.85, true);
    portalLantern.position.set(0, 2.65, 0.45);
    portal.add(portalLantern);

    bridge.add(portal);
  }

  root.add(bridge);

  // -------------------------------------------------------------------------
  // 2. Miếu Làng Thanh Thủy (Ochre Shrine across the canal) & Sân Phơi Làng Hương
  // -------------------------------------------------------------------------
  const mieu = new THREE.Group();
  mieu.position.set(BX + 22, 2.3, BZ - 15);
  mieu.rotation.y = -Math.PI * 0.35;

  const mBase = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 4.4), mats.daThanh);
  mBase.position.y = 0.25;
  mBase.receiveShadow = true;
  mieu.add(mBase);

  const mBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.5, 3.4), mats.ochreVillagePlaster);
  mBody.position.y = 1.75;
  mBody.castShadow = true;
  mieu.add(mBody);

  const mDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.8, 3.48), mats.goLimLacquered);
  mDoor.position.y = 1.4;
  mieu.add(mDoor);

  const mRoof = createSweepingHueRoof(5.6, 4.6, 1.45, {
    ridgeLength: 1.8,
    eaveLift: 0.32,
    tileMat: mats.ngoiTerracotta,
    trimMat: mats.hueLimeWall,
    finialMat: mats.porcelainMosaicWall,
    addDragonCrest: true,
  });
  mRoof.position.y = 2.95;
  mieu.add(mRoof);
  root.add(mieu);

  // Làng Hương Thủy Xuân: Vibrant radiating dyed-bamboo incense bouquets!
  const incenseYard = new THREE.Group();
  incenseYard.position.set(BX - 16, 2.3, BZ + 13);

  const yardMat = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.14, 9.0), mats.daThanhStairs);
  yardMat.position.y = 0.05;
  yardMat.receiveShadow = true;
  incenseYard.add(yardMat);

  const incenseColors = [0xd62739, 0xf2b429, 0xb8338a, 0x229972, 0x6c42b8, 0xe85a2a];
  const stickGeo = new THREE.CylinderGeometry(0.014, 0.011, 0.92, 5);
  const footMat = new THREE.MeshStandardMaterial({ color: 0xc29e65, roughness: 0.82 });

  for (let b = 0; b < 18; b++) {
    const bx = ((b % 6) - 2.5) * 1.45 + (b % 2) * 0.25;
    const bz = (Math.floor(b / 6) - 1) * 2.2;
    const bouquet = new THREE.Group();
    bouquet.position.set(bx, 0.12, bz);

    const color = incenseColors[b % incenseColors.length];
    const headMat = new THREE.MeshStandardMaterial({ color, roughness: 0.78 });

    // Tightly bound splayed bamboo foot
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.26, 0.36, 10), footMat);
    waist.position.y = 0.18;
    waist.castShadow = true;
    bouquet.add(waist);

    // Organic curved dome cluster of radiating incense sticks
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      headMat,
    );
    core.scale.set(1.15, 0.65, 1.15);
    core.position.y = 0.62;
    core.castShadow = true;
    bouquet.add(core);

    for (let ring = 0; ring < 2; ring++) {
      const nSticks = ring === 0 ? 14 : 10;
      const tilt = ring === 0 ? 0.52 : 0.26;
      for (let s = 0; s < nSticks; s++) {
        const a = (s / nSticks) * Math.PI * 2 + ring * 0.22;
        const st = new THREE.Mesh(stickGeo, headMat);
        st.position.set(Math.sin(a) * 0.16 * (ring === 0 ? 1.3 : 0.7), 0.52, Math.cos(a) * 0.16 * (ring === 0 ? 1.3 : 0.7));
        st.rotation.z = -Math.sin(a) * tilt;
        st.rotation.x = Math.cos(a) * tilt;
        bouquet.add(st);
      }
    }

    incenseYard.add(bouquet);
  }

  // Drying bamboo tray with conical hats ("Nón Bài Thơ")
  const rack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 1.1), mats.bambooWoven);
  rack.position.set(-3.8, 0.42, -3.0);
  incenseYard.add(rack);

  const nonGeo = new THREE.ConeGeometry(0.4, 0.34, 14, 1, true);
  for (let n = 0; n < 3; n++) {
    const non = new THREE.Mesh(nonGeo, mats.bambooWoven);
    non.position.set(-4.6 + n * 0.8, 0.92, -3.0);
    incenseYard.add(non);
  }

  root.add(incenseYard);

  return { group: root, lanterns };
}
