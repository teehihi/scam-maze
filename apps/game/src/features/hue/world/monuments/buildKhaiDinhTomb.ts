import * as THREE from 'three';
import type { HueMaterialSet } from '../../engine/materials/HueMaterialFoundry';
import {
  createCornerDragonFinial,
  createHueLantern,
  createHueStaircase,
  createLotusBud,
  createTruBieuPillar,
} from './hueArchitecturalHelpers';
import type { LanternHandle } from './hueArchitecturalHelpers';

export interface KhaiDinhBuildResult {
  group: THREE.Group;
  lanterns: LanternHandle[];
  incenseOrigin: THREE.Vector3;
  interiorLights: THREE.PointLight[];
}

function createMandarinStatue(
  mat: THREE.Material,
  darkMat: THREE.Material,
  isMilitary: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.95), darkMat);
  plinth.position.y = 0.175;
  plinth.castShadow = true;
  g.add(plinth);

  // Flowing court robe
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.35, 10), mat);
  robe.position.y = 1.02;
  robe.castShadow = true;
  g.add(robe);

  // Sleeves / clasped hands holding ceremonial tablet ("hốt") or sword
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.55, 0.36), mat);
  torso.position.y = 1.48;
  torso.castShadow = true;
  g.add(torso);

  if (isMilitary) {
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.1), darkMat);
    sword.position.set(0.26, 1.25, 0.18);
    g.add(sword);
  } else {
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.06), darkMat);
    tablet.position.set(0, 1.56, 0.24);
    tablet.rotation.x = -0.25;
    g.add(tablet);
  }

  // Head & court hat
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), mat);
  head.position.y = 1.92;
  head.castShadow = true;
  g.add(head);

  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.18, 8), darkMat);
  hat.position.y = 2.1;
  g.add(hat);

  return g;
}

function createStoneElephant(mat: THREE.Material, darkMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 2.1), darkMat);
  plinth.position.y = 0.16;
  g.add(plinth);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 10), mat);
  body.scale.set(0.82, 0.8, 1.25);
  body.position.set(0, 1.12, 0);
  body.castShadow = true;
  g.add(body);

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.24, 0.72), darkMat);
  saddle.position.set(0, 1.56, 0);
  g.add(saddle);

  for (const sx of [-0.32, 0.32]) {
    for (const sz of [-0.48, 0.48]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.72, 10), mat);
      leg.position.set(sx, 0.58, sz);
      leg.castShadow = true;
      g.add(leg);
    }
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat);
  head.position.set(0, 1.28, 0.82);
  head.castShadow = true;
  g.add(head);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), mat);
    ear.scale.set(0.22, 1.0, 0.75);
    ear.position.set(side * 0.42, 1.32, 0.7);
    g.add(ear);
  }

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.74, 8), mat);
  trunk.position.set(0, 0.86, 1.12);
  trunk.rotation.x = 0.25;
  g.add(trunk);

  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 6), darkMat);
    tusk.position.set(side * 0.2, 0.98, 1.15);
    tusk.rotation.x = Math.PI * 0.38;
    g.add(tusk);
  }
  return g;
}

function createStoneHorse(mat: THREE.Material, darkMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.32, 1.85), darkMat);
  plinth.position.y = 0.16;
  g.add(plinth);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 1.28, 10), mat);
  body.rotation.x = Math.PI * 0.5;
  body.position.set(0, 1.08, 0);
  body.castShadow = true;
  g.add(body);

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.52), darkMat);
  saddle.position.set(0, 1.36, 0);
  g.add(saddle);

  for (const sx of [-0.21, 0.21]) {
    for (const sz of [-0.46, 0.46]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.78, 8), mat);
      leg.position.set(sx, 0.6, sz);
      leg.castShadow = true;
      g.add(leg);
    }
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 0.68, 10), mat);
  neck.position.set(0, 1.46, 0.55);
  neck.rotation.x = 0.42;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.52, 8), mat);
  head.position.set(0, 1.68, 0.82);
  head.rotation.x = Math.PI * 0.65;
  g.add(head);

  return g;
}

export function buildKhaiDinhTomb(mats: HueMaterialSet): KhaiDinhBuildResult {
  const root = new THREE.Group();
  root.name = 'KhaiDinhTomb';
  const lanterns: LanternHandle[] = [];
  const interiorLights: THREE.PointLight[] = [];

  const CX = 40;

  // -------------------------------------------------------------------------
  // 1. Flight 1 (z = 248 -> 262, y = 6.0 -> 10.2) + Nghi Môn Terrace (z = 262..270)
  // -------------------------------------------------------------------------
  const flight1 = createHueStaircase(
    9.2,
    4.2,
    14.0,
    30,
    mats.daThanhStairs,
    mats.khaiDinhConcrete,
    mats.khaiDinhDarkTrim,
    true,
  );
  flight1.position.set(CX, 6.0, 248);
  flight1.rotation.y = Math.PI; // Climb toward +Z!
  root.add(flight1);

  // Nghi Môn / Tam Quan Terrace (y = 10.2m, z = 262..270) — deep fortified retaining base
  const t1Group = new THREE.Group();
  t1Group.position.set(CX, 10.2, 266);

  const t1Floor = new THREE.Mesh(new THREE.BoxGeometry(34, 6.2, 9.5), mats.khaiDinhConcrete);
  t1Floor.position.y = -3.1;
  t1Floor.receiveShadow = true;
  t1Floor.castShadow = true;
  t1Group.add(t1Floor);

  // Outer Trụ Biểu pillars with polygonal stone blocks ("đá hộc viền vữa") + lotus buds
  for (const sx of [-11.2, 11.2]) {
    const pillar = createTruBieuPillar(
      7.6,
      1.35,
      mats.daHocMortar,
      mats.khaiDinhConcrete,
      mats.khaiDinhDarkTrim,
    );
    pillar.position.set(sx, 0, -2.5);
    t1Group.add(pillar);

    // Connecting balustrade wings with hexagonal stone panels
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.4, 0.7), mats.daHocMortar);
    wing.position.set(sx * 0.68, 1.2, -2.5);
    wing.castShadow = true;
    t1Group.add(wing);
  }

  // Sunburst Neo-Baroque Tam Quan Gate ("Cổng Mặt Trời Tỏa Tia" seen in khai_dinh.jpg!)
  const archFrame = new THREE.Group();
  archFrame.position.set(0, 0, -2.5);
  for (const sx of [-2.4, 2.4]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(1.15, 5.2, 1.1), mats.khaiDinhRelief);
    pil.position.set(sx, 2.6, 0);
    pil.castShadow = true;
    archFrame.add(pil);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.25, 1.2), mats.khaiDinhRelief);
  lintel.position.set(0, 5.4, 0);
  lintel.castShadow = true;
  archFrame.add(lintel);

  // Sunburst rays inside arched doorway header
  for (let r = 0; r < 9; r++) {
    const ang = -Math.PI * 0.42 + (r / 8) * Math.PI * 0.84;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.25), mats.khaiDinhConcrete);
    ray.position.set(Math.sin(ang) * 1.15, 4.1 + Math.cos(ang) * 0.72, 0);
    ray.rotation.z = -ang;
    archFrame.add(ray);
  }

  // Curling dragon acroteria crowning Nghi Môn
  for (const sx of [-2.1, 0, 2.1]) {
    const crest = createCornerDragonFinial(mats.khaiDinhDarkTrim, sx === 0 ? 0.65 : 0.48);
    crest.position.set(sx, 6.05, 0);
    archFrame.add(crest);
  }
  t1Group.add(archFrame);
  root.add(t1Group);

  // -------------------------------------------------------------------------
  // 2. Flight 2 (z = 270 -> 280, y = 10.2 -> 13.6) + Sân Chầu & Bi Đình (z = 280..310)
  // -------------------------------------------------------------------------
  const flight2 = createHueStaircase(
    8.2,
    3.4,
    10.0,
    24,
    mats.daThanhStairs,
    mats.khaiDinhConcrete,
    mats.khaiDinhDarkTrim,
    true,
  );
  flight2.position.set(CX, 10.2, 270);
  flight2.rotation.y = Math.PI;
  root.add(flight2);

  const sanChau = new THREE.Group();
  sanChau.position.set(CX, 13.6, 295);

  // Deep fortified stone courtyard podium embedded into mountain slope
  const scFloor = new THREE.Mesh(new THREE.BoxGeometry(36, 7.6, 31), mats.daThanh);
  scFloor.position.y = -3.78;
  scFloor.receiveShadow = true;
  sanChau.add(scFloor);

  // Retaining front & side stone walls anchoring Sân Chầu
  for (const side of [-1, 1]) {
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(13.2, 6.8, 0.95), mats.daHocMortar);
    frontWall.position.set(side * 11.2, -3.1, -15.2);
    sanChau.add(frontWall);

    const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.75, 6.5, 31), mats.daHocMortar);
    sideSkirt.position.set(side * 17.65, -3.2, 0);
    sanChau.add(sideSkirt);

    const sideParapet = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.15, 31), mats.khaiDinhConcrete);
    sideParapet.position.set(side * 17.6, 0.55, 0);
    sideParapet.castShadow = true;
    sanChau.add(sideParapet);
  }

  // Two Rows of Basalt Stone Statues in Sân Chầu (Quan Văn, Quan Võ, Ngựa, Voi)
  const statueZs = [-11.5, -8.5, -5.2, -2.0];
  statueZs.forEach((sz, idx) => {
    for (const side of [-1, 1]) {
      let statue: THREE.Group;
      if (idx < 2) {
        statue = createMandarinStatue(
          mats.daThanh,
          mats.khaiDinhDarkTrim,
          idx === 1,
        );
      } else if (idx === 2) {
        statue = createStoneHorse(mats.daThanh, mats.khaiDinhDarkTrim);
      } else {
        statue = createStoneElephant(mats.daThanh, mats.khaiDinhDarkTrim);
      }
      statue.position.set(side * 7.8, 0, sz);
      // Face inward toward the central Thần Đạo
      statue.rotation.y = side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
      sanChau.add(statue);
    }
  });

  // Bi Đình (Octagonal Concrete Neo-Gothic-Asian Stele Pavilion at z = 301 -> local +6)
  const biDinh = new THREE.Group();
  biDinh.position.set(0, 0, 6.2);

  const bdPlinth = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.1, 0.85, 8), mats.khaiDinhConcrete);
  bdPlinth.position.y = 0.425;
  bdPlinth.rotation.y = Math.PI / 8;
  bdPlinth.receiveShadow = true;
  biDinh.add(bdPlinth);

  // 8 Neo-Gothic arched corner piers
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.95, 5.4, 0.95), mats.khaiDinhRelief);
    pier.position.set(Math.sin(a) * 4.4, 3.55, Math.cos(a) * 4.4);
    pier.rotation.y = a;
    pier.castShadow = true;
    biDinh.add(pier);
  }

  // Ornate upper octagon entablature & two-tier Neo-Gothic lotus cupola
  const entab = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 1.15, 8), mats.khaiDinhConcrete);
  entab.position.y = 6.45;
  entab.rotation.y = Math.PI / 8;
  entab.castShadow = true;
  biDinh.add(entab);

  const dome1 = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.3, 8), mats.khaiDinhDarkTrim);
  dome1.position.y = 8.15;
  dome1.rotation.y = Math.PI / 8;
  dome1.castShadow = true;
  biDinh.add(dome1);

  const lanternStage = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 1.3, 8), mats.khaiDinhRelief);
  lanternStage.position.y = 9.45;
  lanternStage.rotation.y = Math.PI / 8;
  biDinh.add(lanternStage);

  const dome2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.1, 8), mats.khaiDinhDarkTrim);
  dome2.position.y = 11.05;
  dome2.rotation.y = Math.PI / 8;
  biDinh.add(dome2);

  const bdLotus = createLotusBud(mats.khaiDinhConcrete, 0.72);
  bdLotus.position.y = 12.1;
  biDinh.add(bdLotus);

  // Massive Imperial Stele ("Thanh Đức Thần Công"碑) inside Bi Đình
  const stele = new THREE.Mesh(new THREE.BoxGeometry(1.75, 3.3, 0.44), mats.daThanh);
  stele.position.y = 2.55;
  stele.castShadow = true;
  biDinh.add(stele);

  sanChau.add(biDinh);
  root.add(sanChau);

  // -------------------------------------------------------------------------
  // 3. Flights 3 & 4 Ascending to Cung Thiên Định Summit (z = 310 -> 340)
  // -------------------------------------------------------------------------
  const flight3 = createHueStaircase(
    7.4,
    5.0,
    14.0,
    34,
    mats.daThanhStairs,
    mats.khaiDinhConcrete,
    mats.khaiDinhDarkTrim,
    true,
  );
  flight3.position.set(CX, 13.6, 310);
  flight3.rotation.y = Math.PI;
  root.add(flight3);

  const midTerrace = new THREE.Mesh(new THREE.BoxGeometry(27.5, 9.8, 9.2), mats.khaiDinhConcrete);
  midTerrace.position.set(CX, 13.7, 328);
  midTerrace.receiveShadow = true;
  root.add(midTerrace);

  // Two monumental dragon-carved obelisks flanking the upper landing
  for (const sx of [-11.5, 11.5]) {
    const obelisk = createTruBieuPillar(
      8.5,
      1.2,
      mats.khaiDinhRelief,
      mats.khaiDinhConcrete,
      mats.khaiDinhDarkTrim,
    );
    obelisk.position.set(CX + sx, 18.6, 328);
    root.add(obelisk);
  }

  const flight4 = createHueStaircase(
    6.8,
    2.8,
    8.0,
    18,
    mats.daThanhStairs,
    mats.khaiDinhConcrete,
    mats.khaiDinhDarkTrim,
    true,
  );
  flight4.position.set(CX, 18.6, 332);
  flight4.rotation.y = Math.PI;
  root.add(flight4);

  // -------------------------------------------------------------------------
  // 4. CUNG THIÊN ĐỊNH (Summit Monument & Enterable Khảm Sành Sứ Sanctuary!)
  //    Platform y = 21.4m, Interior Marble Floor y = 22.1m, z = 340..370
  // -------------------------------------------------------------------------
  const cung = new THREE.Group();
  cung.position.set(CX, 21.4, 355);

  // Deeply anchored terrace podium (top at y=0.7 relative -> world 22.1m)
  const podium = new THREE.Mesh(new THREE.BoxGeometry(38, 6.8, 30), mats.khaiDinhConcrete);
  podium.position.y = -2.7;
  podium.receiveShadow = true;
  cung.add(podium);

  // Front steps onto Cung Thiên Định porch
  const entrySteps = createHueStaircase(
    5.4,
    0.7,
    2.2,
    4,
    mats.daThanhStairs,
    mats.khaiDinhConcrete,
    mats.khaiDinhDarkTrim,
    false,
  );
  entrySteps.position.set(0, 0, -14.8);
  entrySteps.rotation.y = Math.PI;
  cung.add(entrySteps);

  // Marble checkerboard interior floor (y = 0.71 local = 22.11 world)
  const interiorFloor = new THREE.Mesh(new THREE.BoxGeometry(27.5, 0.14, 21.5), mats.marbleTileFloor);
  interiorFloor.position.set(0, 0.71, 0.5);
  interiorFloor.receiveShadow = true;
  cung.add(interiorFloor);

  // --- EXTERIOR ARCHITECTURAL SHELL (Weathered Neo-Gothic / Baroque Concrete) ---
  const WALL_H = 8.4;
  // Front facade walls leaving wide OPEN central arched portal (x in [-2.4, +2.4])
  for (const side of [-1, 1]) {
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(11.8, WALL_H, 1.05), mats.khaiDinhConcrete);
    frontWing.position.set(side * 8.3, 0.7 + WALL_H * 0.5, -10.2);
    frontWing.castShadow = true;
    frontWing.receiveShadow = true;
    cung.add(frontWing);

    // Ornate carved exterior dragon relief pilasters across the front facade
    for (const px of [3.1, 7.6, 12.6]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.95, WALL_H + 0.6, 1.32), mats.khaiDinhRelief);
      pil.position.set(side * px, 0.7 + WALL_H * 0.5, -10.25);
      pil.castShadow = true;
      cung.add(pil);
    }

    // Side arched window indentations (dark interior glaze)
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.2, 1.18), mats.khaiDinhDarkTrim);
    winFrame.position.set(side * 10.1, 3.8, -10.2);
    cung.add(winFrame);
  }

  // Central Portal Header above doorway (doorway clearance height = 4.6m -> walkable inside!)
  const portalHeader = new THREE.Mesh(new THREE.BoxGeometry(5.2, WALL_H - 4.6, 1.15), mats.khaiDinhRelief);
  portalHeader.position.set(0, 0.7 + 4.6 + (WALL_H - 4.6) * 0.5, -10.2);
  portalHeader.castShadow = true;
  cung.add(portalHeader);

  // Central Sunburst pediment rising above portal
  const pediment = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.3, 1.25), mats.khaiDinhRelief);
  pediment.position.set(0, 0.7 + WALL_H + 1.1, -10.2);
  pediment.castShadow = true;
  cung.add(pediment);

  // Side exterior walls (Tả, Hữu Trực Phòng wings)
  for (const side of [-1, 1]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(1.05, WALL_H, 22.5), mats.khaiDinhConcrete);
    sideWall.position.set(side * 14.0, 0.7 + WALL_H * 0.5, 0.5);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    cung.add(sideWall);

    // Side Baroque pilasters & arched clerestory openings
    for (let pz = -7; pz <= 8; pz += 5) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.3, WALL_H + 0.5, 0.9), mats.khaiDinhRelief);
      pil.position.set(side * 14.0, 0.7 + WALL_H * 0.5, pz);
      cung.add(pil);
    }
  }

  // Rear sanctuary wall
  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(29.0, WALL_H, 1.1), mats.khaiDinhConcrete);
  rearWall.position.set(0, 0.7 + WALL_H * 0.5, 11.4);
  rearWall.castShadow = true;
  rearWall.receiveShadow = true;
  cung.add(rearWall);

  // Roof terrace parapet & Asian-Gothic stepped pavilion crown
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(29.4, 0.85, 23.0), mats.khaiDinhDarkTrim);
  roofDeck.position.set(0, 0.7 + WALL_H + 0.4, 0.5);
  roofDeck.castShadow = true;
  cung.add(roofDeck);

  // Parapet filigree balustrade around roof perimeter
  for (let px = -13; px <= 13; px += 2.6) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.05, 6), mats.khaiDinhRelief);
    fin.position.set(px, 0.7 + WALL_H + 1.3, -10.5);
    cung.add(fin);
  }

  // Upper central octagonal sanctuary lantern roof rising over Cung Thiên Định
  const upperHall = new THREE.Mesh(new THREE.BoxGeometry(14.5, 2.8, 12.2), mats.khaiDinhConcrete);
  upperHall.position.set(0, 0.7 + WALL_H + 2.1, 1.2);
  upperHall.castShadow = true;
  cung.add(upperHall);

  const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(10.6, 3.2, 4), mats.khaiDinhDarkTrim);
  upperRoof.rotation.y = Math.PI * 0.25;
  upperRoof.position.set(0, 0.7 + WALL_H + 5.0, 1.2);
  upperRoof.castShadow = true;
  cung.add(upperRoof);

  const apexBud = createLotusBud(mats.khaiDinhConcrete, 0.9);
  apexBud.position.set(0, 0.7 + WALL_H + 6.45, 1.2);
  cung.add(apexBud);

  // -------------------------------------------------------------------------
  // 5. INTERIOR SANCTUARY: KHẢM SÀNH SỨ, BỬU TÁN & TƯỢNG ĐỒNG MẠ VÀNG
  // -------------------------------------------------------------------------
  // Inner porcelain-mosaic walls lining the interior of Điện Khải Thành & Sanctuary!
  const innerRearMosaic = new THREE.Mesh(new THREE.BoxGeometry(26.6, WALL_H - 0.3, 0.25), mats.porcelainMosaicWallWide);
  innerRearMosaic.position.set(0, 0.7 + (WALL_H - 0.3) * 0.5, 10.75);
  innerRearMosaic.receiveShadow = true;
  cung.add(innerRearMosaic);

  for (const side of [-1, 1]) {
    const innerSideMosaic = new THREE.Mesh(new THREE.BoxGeometry(0.25, WALL_H - 0.3, 20.6), mats.porcelainMosaicWallWide);
    innerSideMosaic.position.set(side * 13.3, 0.7 + (WALL_H - 0.3) * 0.5, 0.5);
    innerSideMosaic.receiveShadow = true;
    cung.add(innerSideMosaic);

    // Front interior mosaic return walls
    const innerFrontMosaic = new THREE.Mesh(new THREE.BoxGeometry(10.6, WALL_H - 0.3, 0.22), mats.porcelainMosaicWallWide);
    innerFrontMosaic.position.set(side * 7.9, 0.7 + (WALL_H - 0.3) * 0.5, -9.55);
    cung.add(innerFrontMosaic);

    // 4 Interior Porcelain-Encrusted Dragon Columns framing the central nave!
    for (const pz of [-5.2, 0.4, 5.8]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, WALL_H - 0.4, 14), mats.porcelainMosaicWall);
      col.position.set(side * 4.4, 0.7 + (WALL_H - 0.4) * 0.5, pz);
      col.castShadow = true;
      cung.add(col);

      // Gilded capital collar
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.46, 0.42, 12), mats.sonSonThepVang);
      collar.position.set(side * 4.4, 0.7 + WALL_H - 0.75, pz);
      cung.add(collar);
    }
  }

  // Ornate Gilt Filigree Cửa Võng arches between front nave columns
  const cuaVong = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.35, 0.22), mats.sonSonThepVang);
  cuaVong.position.set(0, 5.9, -5.2);
  cung.add(cuaVong);

  // Ceiling Mural: "Cửu Long Ẩn Vân" (Nine Dragons Hidden in Clouds)
  const ceilingMural = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 20.4), mats.porcelainMosaicCeiling);
  ceilingMural.rotation.x = Math.PI * 0.5;
  ceilingMural.position.set(0, 0.7 + WALL_H - 0.15, 0.5);
  cung.add(ceilingMural);

  // Foreground Điện Khải Thành Altar Table (z = -2.2 local)
  const altar = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.25, 1.45), mats.porcelainMosaicWall);
  altar.position.set(0, 0.7 + 0.625, -2.0);
  cung.add(altar);

  const altarTrim = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.15, 1.6), mats.sonSonThepVang);
  altarTrim.position.set(0, 0.7 + 1.28, -2.0);
  cung.add(altarTrim);

  // Incense Burner ("Lư Hương") & Twin Candelabras on Altar
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.52, 12), mats.giltBronze);
  burner.position.set(0, 0.7 + 1.62, -2.0);
  cung.add(burner);

  for (const sx of [-1.25, 1.25]) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.65, 8), mats.giltBronze);
    candle.position.set(sx, 0.7 + 1.68, -2.0);
    cung.add(candle);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd078 }),
    );
    flame.position.set(sx, 0.7 + 2.08, -2.0);
    cung.add(flame);
  }

  // Central Sanctuary Dais (y = 0.7 + 0.6 = 1.3 local -> 22.7 world)
  const dais = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 6.2), mats.marbleTileFloor);
  dais.position.set(0, 0.7 + 0.3, 4.6);
  dais.receiveShadow = true;
  cung.add(dais);

  // Rear Setting Sun Relief Panel behind Throne
  const sunDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.24, 24), mats.giltBronze);
  sunDisc.rotation.x = Math.PI * 0.5;
  sunDisc.position.set(0, 3.6, 7.3);
  cung.add(sunDisc);

  // Royal Throne & Gilt-Bronze Statue of Emperor Khải Định (1.7:1 scale!)
  const throneBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.9), mats.porcelainMosaicWall);
  throneBase.position.set(0, 1.3 + 0.45, 4.6);
  cung.add(throneBase);

  const throneBack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 0.28), mats.sonSonThepVang);
  throneBack.position.set(0, 1.3 + 1.6, 5.45);
  cung.add(throneBack);

  const emperorGroup = new THREE.Group();
  emperorGroup.position.set(0, 1.3 + 0.9, 4.6);
  const lap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.68, 1.05), mats.giltBronze);
  lap.position.set(0, 0.34, 0.15);
  lap.castShadow = true;
  emperorGroup.add(lap);

  const torsoE = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 1.25, 12), mats.giltBronze);
  torsoE.position.set(0, 1.15, -0.05);
  torsoE.castShadow = true;
  emperorGroup.add(torsoE);

  const headE = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), mats.giltBronze);
  headE.position.set(0, 1.98, -0.02);
  emperorGroup.add(headE);

  const crownE = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.34, 10), mats.giltBronze);
  crownE.position.set(0, 2.26, -0.02);
  emperorGroup.add(crownE);
  cung.add(emperorGroup);

  // Sculpted 1-ton Bửu Tán Canopy overhead ("Màn rủ nhung lụa bằng sành sứ")!
  const buuTan = new THREE.Group();
  buuTan.position.set(0, 6.9, 4.6);

  // Upper octagonal silk-draped dome
  const canopyDome = new THREE.Mesh(
    new THREE.ConeGeometry(2.9, 1.85, 12, 4, true),
    mats.porcelainMosaicBuuTan,
  );
  canopyDome.position.y = 0.6;
  if ('side' in mats.porcelainMosaicBuuTan) {
    mats.porcelainMosaicBuuTan.side = THREE.DoubleSide;
  }
  buuTan.add(canopyDome);

  // Sculpted scalloped hanging valances & flowing tassel corners
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const drape = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.48, 1.7, 8),
      mats.porcelainMosaicBuuTan,
    );
    drape.position.set(Math.sin(a) * 2.45, -0.85, Math.cos(a) * 2.45);
    drape.rotation.z = -Math.sin(a) * 0.14;
    drape.rotation.x = Math.cos(a) * 0.14;
    buuTan.add(drape);
  }
  cung.add(buuTan);

  // Warm candlelight pool illuminating the porcelain shards & gilt bronze without blowing out!
  const sanctumLight1 = new THREE.PointLight(0xffa852, 5.2, 22, 1.5);
  sanctumLight1.position.set(0, 4.6, -2.0);
  cung.add(sanctumLight1);
  interiorLights.push(sanctumLight1);

  const sanctumLight2 = new THREE.PointLight(0xffc168, 6.4, 24, 1.45);
  sanctumLight2.position.set(0, 5.2, 3.2);
  cung.add(sanctumLight2);
  interiorLights.push(sanctumLight2);

  const porchLightL = createHueLantern(lanterns, 1.0, true);
  porchLightL.position.set(-3.2, 4.4, -10.9);
  cung.add(porchLightL);
  const porchLightR = createHueLantern(lanterns, 1.0, true);
  porchLightR.position.set(3.2, 4.4, -10.9);
  cung.add(porchLightR);

  root.add(cung);

  const incenseOrigin = new THREE.Vector3(CX, 21.4 + 0.7 + 1.9, 355 - 2.0);

  return {
    group: root,
    lanterns,
    incenseOrigin,
    interiorLights,
  };
}
