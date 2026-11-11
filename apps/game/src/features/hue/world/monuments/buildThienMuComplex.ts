import * as THREE from 'three';
import type { HueMaterialSet } from '../../engine/materials/HueMaterialFoundry';
import {
  createHueLantern,
  createHueStaircase,
  createOctagonalCurvedRoof,
  createStoneTurtleStele,
  createSweepingHueRoof,
  createTruBieuPillar,
} from './hueArchitecturalHelpers';
import type { LanternHandle } from './hueArchitecturalHelpers';

export interface ThienMuBuildResult {
  group: THREE.Group;
  bellPosition: THREE.Vector3;
  bellMesh: THREE.Group;
  lanterns: LanternHandle[];
}

export function buildThienMuComplex(mats: HueMaterialSet): ThienMuBuildResult {
  const root = new THREE.Group();
  root.name = 'ThienMuComplex';
  const lanterns: LanternHandle[] = [];

  const CX = -210;
  const PLATEAU_Y = 9.5;

  // -------------------------------------------------------------------------
  // 1. Bến Thuyền Sông Hương & 24 Bậc Đá Thanh (-210, 0..3.6, -44..-64)
  // -------------------------------------------------------------------------
  const pierGroup = new THREE.Group();
  pierGroup.position.set(CX, 0, -43);

  // Stone river jetty jutting into Sông Hương
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.2, 6.5), mats.daThanh);
  jetty.position.set(0, -0.35, 1.5);
  jetty.castShadow = true;
  jetty.receiveShadow = true;
  pierGroup.add(jetty);

  // Mooring stone bollards
  for (const bx of [-4.8, 4.8]) {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.85, 8),
      mats.daThanh,
    );
    bollard.position.set(bx, 1.05, 4.0);
    bollard.castShadow = true;
    pierGroup.add(bollard);
  }

  // 24 stone steps climbing from pier (y=0.6) to roadside Tam Quan (y=3.6)
  const pierStairs = createHueStaircase(
    7.8,
    3.0,
    19.0,
    24,
    mats.daThanhStairs,
    mats.daThanh,
    mats.daThanh,
    false,
  );
  pierStairs.position.set(0, 0.6, -1.6);
  pierGroup.add(pierStairs);

  // Riverside stone lantern posts at pier entrance
  for (const sx of [-4.6, 4.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.1, 0.55), mats.daThanh);
    post.position.set(sx, 1.65, -1.2);
    post.castShadow = true;
    pierGroup.add(post);
    const lantern = createHueLantern(lanterns, 0.9, true);
    lantern.position.set(sx, 2.95, -1.2);
    pierGroup.add(lantern);
  }
  root.add(pierGroup);

  // -------------------------------------------------------------------------
  // 2. Cổng Tam Quan (4 Trụ Biểu) & 15 Bậc Cấp Lên Sân Chùa
  // -------------------------------------------------------------------------
  const gateGroup = new THREE.Group();
  gateGroup.position.set(CX, 3.6, -65.5);

  // Paved terrace in front of Tam Quan
  const roadPad = new THREE.Mesh(new THREE.BoxGeometry(19, 0.5, 6), mats.daThanh);
  roadPad.position.set(0, -0.15, 0);
  roadPad.receiveShadow = true;
  gateGroup.add(roadPad);

  const pillarXs = [-6.2, -2.5, 2.5, 6.2];
  pillarXs.forEach((px, idx) => {
    const isInner = idx === 1 || idx === 2;
    const pillar = createTruBieuPillar(
      isInner ? 6.2 : 5.1,
      isInner ? 0.92 : 0.78,
      mats.hueLimeRose,
      mats.hueLimeWall,
      mats.phapLamJade,
    );
    pillar.position.set(px, 0, 0);
    gateGroup.add(pillar);
  });

  // Low connecting courtyard wing walls beside pillars
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 0.55), mats.hueLimeWall);
    wing.position.set(side * 4.35, 1.05, 0);
    wing.castShadow = true;
    gateGroup.add(wing);

    const coping = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.25, 0.75), mats.ngoiTerracotta);
    coping.position.set(side * 4.35, 2.18, 0);
    gateGroup.add(coping);
  }

  // 15 Stone Steps climbing from Tam Quan (y=3.6) to Plateau (y=9.5, rise=5.9m)
  const hillStairs = createHueStaircase(
    9.4,
    PLATEAU_Y - 3.6,
    12.5,
    15,
    mats.daThanhStairs,
    mats.daThanh,
    mats.khaiDinhDarkTrim,
    true,
  );
  hillStairs.position.set(0, 0, -0.8);
  gateGroup.add(hillStairs);
  root.add(gateGroup);

  // -------------------------------------------------------------------------
  // 3. Sân Chùa Đồi Hà Khê Platform & Retaining Wall (y = 9.5m)
  // -------------------------------------------------------------------------
  const terrace = new THREE.Group();
  terrace.position.set(CX, PLATEAU_Y, -108);

  // Stone paved courtyard slab with retaining skirt blending cleanly into hill
  const courtFloor = new THREE.Mesh(new THREE.BoxGeometry(58, 1.6, 68), mats.daThanh);
  courtFloor.position.set(0, -0.78, 0);
  courtFloor.receiveShadow = true;
  terrace.add(courtFloor);

  // Front stone retaining wall along south cliff edge (z = -78 in world -> local +30)
  for (const side of [-1, 1]) {
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(23.5, 4.4, 0.9), mats.daHocMortar);
    frontWall.position.set(side * 16.8, -1.8, 30.0);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    terrace.add(frontWall);

    const balustrade = new THREE.Mesh(new THREE.BoxGeometry(23.5, 0.72, 0.45), mats.hueLimeWall);
    balustrade.position.set(side * 16.8, 0.42, 30.0);
    terrace.add(balustrade);
  }
  root.add(terrace);

  // -------------------------------------------------------------------------
  // 4. Đình Hương Nguyện (Octagonal Timber Pavilion at -210, 9.5, -85)
  // -------------------------------------------------------------------------
  const huongNguyen = new THREE.Group();
  huongNguyen.position.set(CX, PLATEAU_Y, -85);

  const hnPlinth = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.1, 0.55, 8), mats.daThanh);
  hnPlinth.position.y = 0.275;
  hnPlinth.rotation.y = Math.PI / 8;
  hnPlinth.receiveShadow = true;
  huongNguyen.add(hnPlinth);

  // 8 Gỗ Lim timber columns
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 3.6, 10), mats.goLimAged);
    col.position.set(Math.sin(a) * 3.85, 2.35, Math.cos(a) * 3.85);
    col.castShadow = true;
    huongNguyen.add(col);
  }
  // Timber frieze ring & hanging carved wooden boards
  const hnBeam = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.48, 8, 1, true), mats.goLimLacquered);
  hnBeam.position.y = 3.9;
  hnBeam.rotation.y = Math.PI / 8;
  huongNguyen.add(hnBeam);

  // Double-tier curved octagonal roof
  const hnRoof1 = createOctagonalCurvedRoof(
    8,
    5.4,
    2.6,
    1.55,
    0.42,
    mats.ngoiLuuLyGold,
    mats.phapLamJade,
    0.34,
  );
  hnRoof1.position.y = 4.05;
  huongNguyen.add(hnRoof1);

  const hnNeck = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.72, 8), mats.goLimLacquered);
  hnNeck.position.y = 5.75;
  hnNeck.rotation.y = Math.PI / 8;
  huongNguyen.add(hnNeck);

  const hnRoof2 = createOctagonalCurvedRoof(
    8,
    3.45,
    0.22,
    1.7,
    0.32,
    mats.ngoiLuuLyGold,
    mats.phapLamJade,
    0.28,
  );
  hnRoof2.position.y = 6.08;
  huongNguyen.add(hnRoof2);

  const hnFinial = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), mats.giltBronze);
  hnFinial.position.y = 7.9;
  huongNguyen.add(hnFinial);

  const hnLantern = createHueLantern(lanterns, 1.0, true);
  hnLantern.position.y = 3.2;
  huongNguyen.add(hnLantern);

  root.add(huongNguyen);

  // -------------------------------------------------------------------------
  // 5. Hai Bi Đình Tứ Giác (Flanking Stele Pavilions, x = -224 & -196)
  // -------------------------------------------------------------------------
  for (const sx of [-14.2, 14.2]) {
    const biDinh = new THREE.Group();
    biDinh.position.set(CX + sx, PLATEAU_Y, -85);

    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 4.4), mats.daThanh);
    base.position.y = 0.25;
    base.receiveShadow = true;
    biDinh.add(base);

    for (const px of [-1.55, 1.55]) {
      for (const pz of [-1.55, 1.55]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.0, 10), mats.goLimAged);
        col.position.set(px, 2.0, pz);
        col.castShadow = true;
        biDinh.add(col);
      }
    }

    // Engraved imperial stele inside
    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.26), mats.daThanh);
    stele.position.set(0, 1.6, 0);
    stele.castShadow = true;
    biDinh.add(stele);

    const roof = createSweepingHueRoof(5.4, 5.4, 1.85, {
      ridgeLength: 0.5,
      eaveLift: 0.38,
      tileMat: mats.ngoiLuuLyGreen,
      trimMat: mats.hueLimeWall,
      finialMat: mats.phapLamJade,
      addDragonCrest: true,
    });
    roof.position.y = 3.45;
    biDinh.add(roof);
    root.add(biDinh);
  }

  // -------------------------------------------------------------------------
  // 6. THÁP PHƯỚC DUYÊN (22.26m 7-Tier Octagonal Pagoda! Center: -210, 9.5, -104)
  // -------------------------------------------------------------------------
  const tower = new THREE.Group();
  tower.position.set(CX, PLATEAU_Y, -104);

  // Octagonal Đá Thanh Base Plinth (h = 1.16m, outer radius ~ 7.0m)
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.15, 1.16, 8), mats.daThanh);
  plinth.position.y = 0.58;
  plinth.rotation.y = Math.PI / 8;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  tower.add(plinth);

  // Carved octagonal stone balustrade around plinth top (skip south entrance +Z)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const isSouth = Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) > 0.8;
    const rBal = 6.35;
    const px = Math.sin(a + Math.PI / 8) * rBal;
    const pz = Math.cos(a + Math.PI / 8) * rBal;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.92, 0.28), mats.daThanh);
    post.position.set(px, 1.62, pz);
    post.castShadow = true;
    tower.add(post);

    if (!isSouth) {
      const aMid = a;
      const mx = Math.sin(aMid) * (rBal * 0.92);
      const mz = Math.cos(aMid) * (rBal * 0.92);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.62, 0.18), mats.daThanh);
      rail.position.set(mx, 1.48, mz);
      rail.rotation.y = aMid;
      rail.castShadow = true;
      tower.add(rail);
    }
  }

  // 3 front stone steps leading up to the tower plinth on South (+Z)
  const towerSteps = createHueStaircase(
    2.8,
    1.16,
    1.8,
    4,
    mats.daThanhStairs,
    mats.daThanh,
    mats.daThanh,
    false,
  );
  towerSteps.position.set(0, 0, 7.6);
  tower.add(towerSteps);

  // 7 Tapering Octagonal Stories ("Thượng Thu Hạ Thách" -> total 19.8m above plinth!)
  const tierHeights = [3.55, 3.2, 2.95, 2.75, 2.55, 2.42, 2.38]; // sum = 19.8m
  const tierRadiiBottom = [4.95, 4.35, 3.82, 3.35, 2.92, 2.54, 2.2];
  let currY = 1.16;

  for (let t = 0; t < 7; t++) {
    const th = tierHeights[t];
    const rBot = tierRadiiBottom[t];
    const rTop = rBot * 0.935;
    const tierGroup = new THREE.Group();
    tierGroup.position.y = currY;

    // Main octagonal exposed gạch vồ brick core
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, th, 8),
      mats.hueBrick,
    );
    core.position.y = th * 0.5;
    core.rotation.y = Math.PI / 8;
    core.castShadow = true;
    core.receiveShadow = true;
    tierGroup.add(core);

    // Subtle lime-plaster corner pilasters on all 8 corners
    for (let c = 0; c < 8; c++) {
      const ca = (c / 8) * Math.PI * 2 + Math.PI / 8;
      const pil = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, th * 0.92, 0.24),
        mats.hueLimeRose,
      );
      pil.position.set(Math.sin(ca) * (rBot - 0.04), th * 0.5, Math.cos(ca) * (rBot - 0.04));
      pil.rotation.y = ca;
      tierGroup.add(pil);
    }

    // South-facing (+Z) Imperial Portal Frame:
    // Faded rose lime-plaster border + Pháp Lam Hoành Phi & Câu Đối + Arched Lattice Window!
    const apothem = ((rBot + rTop) * 0.5) * Math.cos(Math.PI / 8);
    const frameW = rBot * 0.72;
    const frameH = th * 0.84;

    const southFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, frameH, 0.22),
      mats.hueLimeRose,
    );
    southFrame.position.set(0, th * 0.48, apothem + 0.05);
    southFrame.receiveShadow = true;
    tierGroup.add(southFrame);

    // Flanking vertical Câu Đối plaques in glazed Pháp Lam
    for (const side of [-1, 1]) {
      const cauDoi = new THREE.Mesh(
        new THREE.BoxGeometry(frameW * 0.16, frameH * 0.78, 0.08),
        mats.phapLamJade,
      );
      cauDoi.position.set(side * frameW * 0.37, th * 0.46, apothem + 0.17);
      tierGroup.add(cauDoi);
    }

    // Horizontal Hoành Phi plaque above the arch in Pháp Lam
    const hoanhPhi = new THREE.Mesh(
      new THREE.BoxGeometry(frameW * 0.62, frameH * 0.14, 0.09),
      t % 2 === 0 ? mats.phapLamJade : mats.phapLamCobalt,
    );
    hoanhPhi.position.set(0, th * 0.84, apothem + 0.18);
    tierGroup.add(hoanhPhi);

    // Dark recessed niche + vermilion wooden lattice door + subtle inner shrine light
    const archW = frameW * 0.44;
    const archH = frameH * 0.56;
    const nicheBack = new THREE.Mesh(
      new THREE.BoxGeometry(archW, archH, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x160b09, roughness: 0.95 }),
    );
    nicheBack.position.set(0, th * 0.41, apothem + 0.11);
    tierGroup.add(nicheBack);

    // Semicircular arched top recess
    const archDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(archW * 0.5, archW * 0.5, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: 0x160b09, roughness: 0.95 }),
    );
    archDisk.rotation.x = Math.PI * 0.5;
    archDisk.position.set(0, th * 0.41 + archH * 0.48, apothem + 0.11);
    tierGroup.add(archDisk);

    // Vermilion lattice door inside niche
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(archW * 0.86, archH * 0.86, 0.06),
      mats.goLimLacquered,
    );
    door.position.set(0, th * 0.41, apothem + 0.16);
    tierGroup.add(door);

    // Subtle warm golden sanctuary lantern inside tiers 0, 2, 4, 6
    if (t % 2 === 0) {
      const innerGlow = createHueLantern(lanterns, 0.55 - t * 0.04, t === 0);
      innerGlow.position.set(0, th * 0.45, apothem + 0.22);
      tierGroup.add(innerGlow);
    }

    // Circular oculus vents ("cửa sổ tròn") on NE, NW, SE, SW facets
    for (const angle of [Math.PI * 0.25, -Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75]) {
      const ox = Math.sin(angle) * (apothem + 0.04);
      const oz = Math.cos(angle) * (apothem + 0.04);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.26 - t * 0.015, 0.06, 8, 16),
        mats.hueLimeRose,
      );
      ring.position.set(ox, th * 0.52, oz);
      ring.rotation.y = angle;
      tierGroup.add(ring);

      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.22 - t * 0.014, 12),
        new THREE.MeshStandardMaterial({ color: 0x1b1210, roughness: 0.95 }),
      );
      hole.position.set(ox * 0.995, th * 0.52, oz * 0.995);
      hole.rotation.y = angle;
      tierGroup.add(hole);
    }

    // Overhanging Curved Octagonal Roof + 8 Pháp Lam Cù Dao Dragon Finials (56 total!)
    const eaveOuter = rBot + 0.95 - t * 0.06;
    const eaveInner = t < 6 ? tierRadiiBottom[t + 1] * 0.97 : 0.28;
    const roofH = t < 6 ? 0.85 - t * 0.04 : 1.38;
    const roof = createOctagonalCurvedRoof(
      8,
      eaveOuter,
      eaveInner,
      roofH,
      0.26 - t * 0.018,
      mats.ngoiTerracotta,
      mats.phapLamJade,
      0.34 - t * 0.02,
    );
    roof.position.y = th - 0.18;
    tierGroup.add(roof);

    tower.add(tierGroup);
    currY += th;
  }

  // Crown: 1.30m Bình Cam Lồ Pháp Lam & Gilt-Bronze Spire (reaching y = 31.76m!)
  const camLoGroup = new THREE.Group();
  camLoGroup.position.y = currY + 1.15;

  const baseLotus = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.56, 0.28, 8), mats.phapLamJade);
  camLoGroup.add(baseLotus);

  const vase = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.28, 0.14),
        new THREE.Vector2(0.42, 0.42),
        new THREE.Vector2(0.32, 0.72),
        new THREE.Vector2(0.14, 0.95),
        new THREE.Vector2(0.24, 1.15),
        new THREE.Vector2(0.03, 1.32),
      ],
      16,
    ),
    mats.giltBronze,
  );
  vase.position.y = 0.12;
  vase.castShadow = true;
  camLoGroup.add(vase);

  tower.add(camLoGroup);
  root.add(tower);

  // -------------------------------------------------------------------------
  // 7. Hai Lầu Lục Giác: Đại Hồng Chung (West) & Rùa Đá Cõng Bia (East)
  // -------------------------------------------------------------------------
  const bellPavilion = new THREE.Group();
  bellPavilion.position.set(CX - 18.5, PLATEAU_Y, -118);

  const bpPlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.0, 0.55, 6), mats.daThanh);
  bpPlinth.position.y = 0.275;
  bpPlinth.receiveShadow = true;
  bellPavilion.add(bpPlinth);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 3.8, 10), mats.goLimAged);
    col.position.set(Math.sin(a) * 3.1, 2.45, Math.cos(a) * 3.1);
    col.castShadow = true;
    bellPavilion.add(col);
  }

  // Timber bell frame & 2-ton Bronze Đại Hồng Chung Bell
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 0.34), mats.goLimAged);
  crossBeam.position.y = 3.8;
  bellPavilion.add(crossBeam);

  const bellMesh = new THREE.Group();
  bellMesh.position.set(0, 3.6, 0);
  const bellBody = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.68, -1.65),
        new THREE.Vector2(0.62, -1.35),
        new THREE.Vector2(0.56, -0.7),
        new THREE.Vector2(0.5, -0.15),
        new THREE.Vector2(0.35, 0.1),
        new THREE.Vector2(0.08, 0.2),
      ],
      20,
    ),
    mats.antiqueBronzeBell,
  );
  bellBody.castShadow = true;
  bellMesh.add(bellBody);

  // Raised molded inscription rings around the bell
  for (const ry of [-1.25, -0.7, -0.25]) {
    const r = ry < -1 ? 0.62 : ry < -0.5 ? 0.57 : 0.52;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.032, 6, 20), mats.giltBronze);
    band.rotation.x = Math.PI * 0.5;
    band.position.y = ry;
    bellMesh.add(band);
  }
  bellPavilion.add(bellMesh);

  // Suspended wooden striking log ("chày kình")
  const striker = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 8), mats.goLimAged);
  striker.rotation.x = Math.PI * 0.5;
  striker.position.set(0, 2.2, 1.35);
  bellPavilion.add(striker);

  const bpRoof = createOctagonalCurvedRoof(
    6,
    4.5,
    0.25,
    2.2,
    0.35,
    mats.ngoiLuuLyGold,
    mats.phapLamJade,
    0.3,
  );
  bpRoof.position.y = 4.25;
  bellPavilion.add(bpRoof);
  root.add(bellPavilion);

  // East Hexagonal Pavilion: Giant Stone Turtle Carrying Imperial Stele
  const turtlePavilion = new THREE.Group();
  turtlePavilion.position.set(CX + 18.5, PLATEAU_Y, -118);

  const tpPlinth = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.0, 0.55, 6), mats.daThanh);
  tpPlinth.position.y = 0.275;
  tpPlinth.receiveShadow = true;
  turtlePavilion.add(tpPlinth);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 3.8, 10), mats.goLimAged);
    col.position.set(Math.sin(a) * 3.1, 2.45, Math.cos(a) * 3.1);
    col.castShadow = true;
    turtlePavilion.add(col);
  }

  const turtleStele = createStoneTurtleStele(mats.daThanh, mats.daThanhStairs);
  turtleStele.position.y = 0.55;
  turtlePavilion.add(turtleStele);

  const tpRoof = createOctagonalCurvedRoof(
    6,
    4.5,
    0.25,
    2.2,
    0.35,
    mats.ngoiLuuLyGold,
    mats.phapLamJade,
    0.3,
  );
  tpRoof.position.y = 4.25;
  turtlePavilion.add(tpRoof);
  root.add(turtlePavilion);

  // -------------------------------------------------------------------------
  // 8. Tường Cổ Rêu Phong, Cửa Nguyệt & Điện Đại Hùng (z = -128..-148)
  // -------------------------------------------------------------------------
  const innerGroup = new THREE.Group();
  innerGroup.position.set(CX, PLATEAU_Y, -129);

  // Inner brick wall with arched Tam Quan gate & moon gates
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(19.5, 3.2, 0.68), mats.hueLimeWall);
    wall.position.set(side * 13.5, 1.6, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    innerGroup.add(wall);

    const tileTop = new THREE.Mesh(new THREE.BoxGeometry(19.7, 0.26, 0.92), mats.ngoiTerracotta);
    tileTop.position.set(side * 13.5, 3.3, 0);
    innerGroup.add(tileTop);
  }

  // Central inner Tam Quan portal
  for (const sx of [-2.8, 2.8]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.3, 4.4, 1.3), mats.hueLimeRose);
    pier.position.set(sx, 2.2, 0);
    pier.castShadow = true;
    innerGroup.add(pier);
  }
  const gateLintel = new THREE.Mesh(new THREE.BoxGeometry(6.9, 1.1, 1.25), mats.hueLimeRose);
  gateLintel.position.set(0, 4.1, 0);
  innerGroup.add(gateLintel);

  const gateRoof = createSweepingHueRoof(8.6, 3.4, 1.35, {
    eaveLift: 0.3,
    tileMat: mats.ngoiLuuLyGold,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: true,
  });
  gateRoof.position.set(0, 4.6, 0);
  innerGroup.add(gateRoof);

  // Điện Đại Hùng (Main Sanctuary Hall at z = -146)
  const hall = new THREE.Group();
  hall.position.set(0, 0, -17);

  const hallPlinth = new THREE.Mesh(new THREE.BoxGeometry(22.5, 0.85, 13.5), mats.daThanh);
  hallPlinth.position.y = 0.425;
  hallPlinth.receiveShadow = true;
  hall.add(hallPlinth);

  // Timber hall body & front portico columns
  const hallBody = new THREE.Mesh(new THREE.BoxGeometry(19.2, 4.2, 9.8), mats.goLimLacquered);
  hallBody.position.set(0, 2.95, -0.8);
  hallBody.castShadow = true;
  hall.add(hallBody);

  for (let i = -3; i <= 3; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 4.2, 10), mats.goLimAged);
    col.position.set(i * 2.9, 2.95, 5.4);
    col.castShadow = true;
    hall.add(col);
  }

  // Twin-tier Trùng Thiềm Điệp Ốc roof
  const hallRoof1 = createSweepingHueRoof(23.2, 14.2, 2.3, {
    eaveLift: 0.42,
    tileMat: mats.ngoiTerracotta,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: false,
  });
  hallRoof1.position.set(0, 4.95, 0.2);
  hall.add(hallRoof1);

  const hallRoof2 = createSweepingHueRoof(17.5, 9.6, 2.4, {
    eaveLift: 0.4,
    tileMat: mats.ngoiTerracotta,
    trimMat: mats.hueLimeWall,
    finialMat: mats.phapLamJade,
    addDragonCrest: true,
  });
  hallRoof2.position.set(0, 6.95, -0.7);
  hall.add(hallRoof2);

  for (const lx of [-4.5, 0, 4.5]) {
    const l = createHueLantern(lanterns, 1.0, lx === 0);
    l.position.set(lx, 4.25, 5.8);
    hall.add(l);
  }

  innerGroup.add(hall);
  root.add(innerGroup);

  const bellPosition = new THREE.Vector3(CX - 18.5, PLATEAU_Y + 2.4, -118);

  return {
    group: root,
    bellPosition,
    bellMesh,
    lanterns,
  };
}
