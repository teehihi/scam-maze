import * as THREE from 'three';
import { MekongMaterialLibrary } from '../materials/ProceduralPBR';
import {
  registerSolidCollider,
  registerWalkableBox,
  registerWalkableSlope,
} from '../terrain/MekongHeightfield';
import { clamp, lerp } from '../math/Noise';
import {
  createLouverPanel,
  createRoofRibs,
  createStainDecal,
} from '../detail/ArchitecturalDetail';

export interface HeritageMansionSystem {
  group: THREE.Group;
  update: (elapsedTime: number, nightFactor: number) => void;
  dispose: () => void;
}

export function createHeritageMansion(mats: MekongMaterialLibrary): HeritageMansionSystem {
  const group = new THREE.Group();
  group.name = 'MekongHeritageMansion';
  const disposables: Array<{ dispose: () => void }> = [];
  const lanternMats: THREE.MeshStandardMaterial[] = [];
  const lanternLights: THREE.PointLight[] = [];

  const graniteMat = mats.getStoneGranite(6, 1);
  const gachTauMat = mats.getGachTau(8, 6);
  const stuccoOchre = mats.getLimeStucco('ochre', 1, 1);
  const stuccoCream = mats.getLimeStucco('cream', 1, 1);
  const stuccoSage = mats.getLimeStucco('sage', 1, 1);
  const yinYangMat = mats.getYinYangTile(6, 4);
  const woodLimMat = mats.getWoodPlank(2, 2, true);
  const shutterTealMat = new THREE.MeshStandardMaterial({ color: 0x2f5f54, roughness: 0.65 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2224, metalness: 0.72, roughness: 0.45 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xc99a36, metalness: 0.55, roughness: 0.35 });
  const whiteSoffitMat = new THREE.MeshStandardMaterial({ color: 0xded9cb, roughness: 0.85 });
  const magentaFlowerMat = new THREE.MeshStandardMaterial({ color: 0xc72b6c, roughness: 0.65 });
  const yellowFlowerMat = new THREE.MeshStandardMaterial({ color: 0xe6b822, roughness: 0.6 });
  const leafPotMat = new THREE.MeshStandardMaterial({ color: 0x3f6f26, roughness: 0.7 });
  const ceramicPotMat = mats.getDaBoCeramic();

  disposables.push(
    shutterTealMat,
    ironMat,
    goldTrimMat,
    whiteSoffitMat,
    magentaFlowerMat,
    yellowFlowerMat,
    leafPotMat,
  );

  // Helper for red silk hanging lantern
  function addRedLantern(parent: THREE.Group, x: number, y: number, z: number, withLight = false) {
    const lm = new THREE.MeshStandardMaterial({
      color: 0xd93426,
      emissive: new THREE.Color(0xff5a20),
      emissiveIntensity: 0.25,
      roughness: 0.55,
    });
    lanternMats.push(lm);
    disposables.push(lm);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lm);
    body.scale.set(1, 1.28, 1);
    body.position.set(x, y, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8), goldTrimMat);
    cap.position.set(x, y + 0.23, z);
    const base = cap.clone();
    base.position.set(x, y - 0.23, z);
    parent.add(body, cap, base);

    if (withLight) {
      const pt = new THREE.PointLight(0xff7838, 0, 14, 1.7);
      pt.position.set(x, y - 0.1, z);
      parent.add(pt);
      lanternLights.push(pt);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Stone Granite River Embankment ("Bờ Kè Đá Xanh") & Quay Promenade
  // --------------------------------------------------------------------------
  const quayWall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 48), graniteMat);
  quayWall.position.set(24.8, 0.55, 44);
  quayWall.castShadow = quayWall.receiveShadow = true;
  group.add(quayWall);

  const quayCap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 48), graniteMat);
  quayCap.position.set(25.8, 1.66, 44);
  quayCap.receiveShadow = true;
  group.add(quayCap);
  registerWalkableBox('quay-promenade', 24.4, 28.0, 20.0, 68.0, 1.76);

  // --------------------------------------------------------------------------
  // 2. Sân Gạch Tàu Courtyard & Stone Approach Walkway (centered x: 40..66, z: 38..58)
  // --------------------------------------------------------------------------
  const baseY = 1.64;
  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 20), gachTauMat);
  courtyard.position.set(52, baseY, 48);
  courtyard.receiveShadow = true;
  group.add(courtyard);
  registerWalkableBox('mansion-courtyard', 40.0, 64.0, 38.0, 58.0, baseY + 0.06);

  const approachWalk = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.1, 4.4), graniteMat);
  approachWalk.position.set(33.5, baseY + 0.01, 48);
  approachWalk.receiveShadow = true;
  group.add(approachWalk);
  registerWalkableBox('mansion-approach', 26.8, 40.5, 45.8, 50.2, baseY + 0.06);

  // A shallow stone drainage channel and worn threshold stones keep the
  // courtyard from reading as one uninterrupted printed slab.
  const drain = new THREE.Mesh(new THREE.BoxGeometry(23.2, 0.035, 0.32), graniteMat);
  drain.position.set(52, baseY + 0.075, 39.2);
  drain.receiveShadow = true;
  group.add(drain);
  for (let grate = 0; grate < 9; grate++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.3), ironMat);
    bar.position.set(42 + grate * 2.5, baseY + 0.1, 39.2);
    group.add(bar);
  }
  for (const side of [-1, 1]) {
    const stain = createStainDecal(5.5, 1.1, 0.34);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(52 + side * 4.5, baseY + 0.125, 57.1);
    group.add(stain);
  }

  // Ornamental low courtyard wall + iron railing fence (with wide central gap at gate)
  for (const side of [-1, 1]) {
    const lowWall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 7.6), stuccoCream);
    lowWall.position.set(40.2, baseY + 0.34, 48 + side * 6.2);
    lowWall.castShadow = lowWall.receiveShadow = true;
    group.add(lowWall);
    registerSolidCollider(39.9, 40.5, 48 + side * 6.2 - 3.8, 48 + side * 6.2 + 3.8, baseY + 1.5);

    // Wrought-iron pickets above dwarf wall
    for (let p = 0; p < 14; p++) {
      const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.72, 4), ironMat);
      picket.position.set(40.2, baseY + 1.02, 48 + side * (2.6 + p * 0.54));
      group.add(picket);
    }
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 7.4), ironMat);
    topBar.position.set(40.2, baseY + 1.38, 48 + side * 6.2);
    group.add(topBar);
  }

  // --------------------------------------------------------------------------
  // 3. Cổng Tam Quan ("Phước An Đường") at x = 40.2, z = 48
  // --------------------------------------------------------------------------
  const gate = new THREE.Group();
  const pillarPositions = [-2.5, -1.65, 1.65, 2.5];
  pillarPositions.forEach((pz, i) => {
    const isMain = i === 1 || i === 2;
    const h = isMain ? 4.1 : 3.0;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.54, h, 0.54), stuccoOchre);
    pillar.position.set(0, h * 0.5, pz);
    pillar.castShadow = pillar.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), stuccoCream);
    cap.position.set(0, h + 0.09, pz);
    gate.add(pillar, cap);

    // Stepped plinth, recessed ceramic panel and a rain-darkened foot break
    // the formerly plain gate posts into built masonry.
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.68), graniteMat);
    plinth.position.set(0, 0.17, pz);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.045, h * 0.48, 0.34), stuccoCream);
    panel.position.set(-0.29, h * 0.52, pz);
    const stain = createStainDecal(0.5, 1.05, 0.5);
    stain.rotation.y = -Math.PI / 2;
    stain.position.set(-0.285, 0.58, pz);
    gate.add(plinth, panel, stain);
  });

  // Central gate lintel & pitched Yin-Yang tile gate roof
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.85, 3.8), stuccoOchre);
  gateBeam.position.set(0, 3.7, 0);
  gateBeam.castShadow = true;
  gate.add(gateBeam);

  // Carved plaque on gate ("PHƯỚC AN")
  const gateSignTex = mats.createSignboardTexture('PHƯỚC AN', 'NHÀ CỔ MIỀN TÂY', '#ece2ca', '#7e2a1b', '#6d1b10');
  const gateSignMat = new THREE.MeshStandardMaterial({ map: gateSignTex, roughness: 0.65 });
  disposables.push(gateSignMat);
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.56), gateSignMat);
  gateSign.position.set(-0.31, 3.72, 0);
  gateSign.rotation.y = -Math.PI / 2;
  gate.add(gateSign);

  // Curved Yin-Yang pitched gate roof
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 4.6), yinYangMat);
    slope.position.set(side * 0.56, 4.48, 0);
    slope.rotation.z = -side * 0.45;
    slope.castShadow = slope.receiveShadow = true;
    slope.add(
      createRoofRibs({
        slopeLength: 1.45,
        roofDepth: 4.6,
        spacing: 0.42,
        radius: 0.045,
        material: stuccoCream,
        y: 0.07,
      }),
    );
    gate.add(slope);
  }
  const gateRidge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.8, 6), stuccoCream);
  gateRidge.rotation.x = Math.PI / 2;
  gateRidge.position.set(0, 4.82, 0);
  gate.add(gateRidge);

  addRedLantern(gate, -0.45, 3.0, -1.35, true);
  addRedLantern(gate, -0.45, 3.0, 1.35, false);

  gate.position.set(40.2, baseY, 48);
  group.add(gate);

  // --------------------------------------------------------------------------
  // 4. Main 5-Bay Heritage Mansion (x = 61, z = 48, facing -X)
  // --------------------------------------------------------------------------
  const mansion = new THREE.Group();
  const plinthH = 0.96;
  const plinthW = 13.8; // X depth (includes 2.6m deep front colonnade veranda)
  const plinthD = 18.6; // Z width (5 bays across!)

  // Raised stone plinth ("Bó vỉa đá xanh")
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(plinthW, plinthH, plinthD), graniteMat);
  plinth.position.set(0, plinthH * 0.5, 0);
  plinth.castShadow = plinth.receiveShadow = true;
  mansion.add(plinth);

  const verandaFloor = new THREE.Mesh(new THREE.BoxGeometry(plinthW - 0.15, 0.08, plinthD - 0.15), gachTauMat);
  verandaFloor.position.set(0, plinthH + 0.04, 0);
  verandaFloor.receiveShadow = true;
  mansion.add(verandaFloor);

  // Register walkable veranda & central hall!
  const mx = 61;
  const mz = 48;
  registerWalkableBox(
    'mansion-veranda-hall',
    mx - plinthW * 0.5,
    mx + plinthW * 0.5 - 2.2,
    mz - plinthD * 0.5,
    mz + plinthD * 0.5,
    baseY + plinthH + 0.08,
  );

  // Twin sweeping stairs on front (-X) flanks leading up onto veranda
  for (const sSide of [-1, 1]) {
    const stairZ = sSide * 4.4;
    for (let st = 0; st < 6; st++) {
      const t = st / 5;
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 2.2), graniteMat);
      step.position.set(-plinthW * 0.5 - 2.2 + t * 2.1, (st + 0.5) * (plinthH / 6), stairZ);
      step.castShadow = step.receiveShadow = true;
      mansion.add(step);
    }
    // Sweeping stair cheek walls
    for (const cw of [-1.2, 1.2]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.65, 0.22), stuccoCream);
      cheek.position.set(-plinthW * 0.5 - 1.15, plinthH * 0.55, stairZ + cw);
      cheek.rotation.z = 0.36;
      cheek.castShadow = true;
      mansion.add(cheek);
    }
    registerWalkableSlope(
      `mansion-stair-${sSide}`,
      mx - plinthW * 0.5 - 2.45,
      mx - plinthW * 0.5 + 0.1,
      mz + stairZ - 1.15,
      mz + stairZ + 1.15,
      (x) => {
        const t = clamp((x - (mx - plinthW * 0.5 - 2.4)) / 2.4, 0, 1);
        return baseY + 0.08 + t * plinthH;
      },
    );
  }

  // 5-Bay Front Colonnade Veranda (pilasters + molded bases + colonial arches + balustrade)
  const bayWidth = 3.5;
  const colX = -plinthW * 0.5 + 0.35;
  const wallH = 4.25;
  for (let i = 0; i < 6; i++) {
    const pz = (i - 2.5) * bayWidth;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.62), stuccoCream);
    base.position.set(colX, plinthH + 0.24, pz);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.46, wallH - 0.8, 0.46), stuccoOchre);
    shaft.position.set(colX, plinthH + wallH * 0.5, pz);
    shaft.castShadow = shaft.receiveShadow = true;
    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.28, 0.66), stuccoCream);
    capital.position.set(colX, plinthH + wallH - 0.25, pz);
    mansion.add(base, shaft, capital);

    // Arched spandrel header between adjacent bays
    if (i < 5) {
      const midZ = pz + bayWidth * 0.5;
      const spandrel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.88, bayWidth), stuccoOchre);
      spandrel.position.set(colX, plinthH + wallH - 0.34, midZ);
      spandrel.castShadow = true;
      mansion.add(spandrel);

      // Decorative arch rib
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(bayWidth * 0.38, 0.12, 6, 12, Math.PI),
        stuccoCream,
      );
      arch.rotation.y = Math.PI / 2;
      arch.position.set(colX, plinthH + wallH - 0.88, midZ);
      mansion.add(arch);

      // Balustrade ("con tiện") except in front of the two staircase openings (bays 1 and 3)
      if (i !== 1 && i !== 3) {
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, bayWidth - 0.4), stuccoCream);
        railTop.position.set(colX, plinthH + 0.92, midZ);
        mansion.add(railTop);
        for (let b = 0; b < 6; b++) {
          const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.78, 6), stuccoCream);
          bal.position.set(colX, plinthH + 0.48, pz + 0.45 + b * 0.52);
          mansion.add(bal);
        }
      }
    }
  }

  // Ornate Veranda Entablature & Molded Cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, plinthD), stuccoCream);
  cornice.position.set(colX, plinthH + wallH + 0.16, 0);
  cornice.castShadow = true;
  mansion.add(cornice);
  // A second, finer cornice line and damp-foot stains on the colonnade.
  const corniceLine = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.11, plinthD - 0.2), stuccoCream);
  corniceLine.position.set(colX + 0.03, plinthH + wallH - 0.08, 0);
  mansion.add(corniceLine);
  for (let i = 0; i < 6; i++) {
    const stain = createStainDecal(0.52, 1.0, 0.38);
    stain.rotation.y = -Math.PI / 2;
    stain.position.set(colX - 0.24, plinthH + 0.52, (i - 2.5) * bayWidth);
    mansion.add(stain);
  }

  // Main Facade Wall (2.7m back behind veranda) with 5 Wooden Louvered Door/Window Bays
  const facadeX = colX + 2.7;
  // Side & back masonry walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH + 0.4, plinthD - 0.6), stuccoOchre);
  backWall.position.set(plinthW * 0.5 - 0.3, plinthH + wallH * 0.5, 0);
  backWall.castShadow = backWall.receiveShadow = true;
  mansion.add(backWall);

  for (const side of [-1, 1]) {
    const sWall = new THREE.Mesh(new THREE.BoxGeometry(plinthW - 3.0, wallH + 0.4, 0.4), stuccoOchre);
    sWall.position.set(1.4, plinthH + wallH * 0.5, side * (plinthD * 0.5 - 0.35));
    sWall.castShadow = sWall.receiveShadow = true;
    mansion.add(sWall);
  }

  // Facade piers & tall French-Vietnamese louvered doors ("cửa lá sách")
  for (let b = 0; b < 5; b++) {
    const bz = (b - 2) * bayWidth;
    const isCenter = b === 2;
    if (!isCenter) {
      // Closed/half-open louvered wood shutter doors
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.05, 1.85), woodLimMat);
      doorFrame.position.set(facadeX, plinthH + 1.55, bz);
      const leaves = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.85, 1.62), shutterTealMat);
      leaves.position.set(facadeX - 0.06, plinthH + 1.55, bz);
      mansion.add(doorFrame, leaves);
      const louver = createLouverPanel({
        width: 1.5,
        height: 2.68,
        count: 13,
        material: shutterTealMat,
        frameMaterial: woodLimMat,
      });
      louver.position.set(facadeX - 0.145, plinthH + 1.55, bz);
      mansion.add(louver);
    } else {
      // Open Grand Central Entry revealing warm ironwood interior & gilded Hoành Phi!
      const headerWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.15, 2.4), stuccoOchre);
      headerWall.position.set(facadeX, plinthH + wallH - 0.52, bz);
      mansion.add(headerWall);

      // Open door panels Folded inward
      for (const ds of [-1, 1]) {
        const openPanel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.95, 0.08), shutterTealMat);
        openPanel.position.set(facadeX + 0.45, plinthH + 1.52, bz + ds * 1.12);
        mansion.add(openPanel);
      }

      // Interior Ironwood ("Gỗ Lim") columns + Gilded Altar Screen ("Bao Lam / Hoành Phi")
      for (const iz of [-1.4, 1.4]) {
        const limCol = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, wallH, 10), woodLimMat);
        limCol.position.set(facadeX + 2.8, plinthH + wallH * 0.5, iz);
        mansion.add(limCol);
      }
      const hoanhPhiTex = mats.createSignboardTexture(
        'PHƯỚC AN ĐƯỜNG',
        'Đức Lưu Quang',
        '#5d140f',
        '#d7a538',
        '#f4cb5a',
      );
      const hoanhPhiMat = new THREE.MeshStandardMaterial({
        map: hoanhPhiTex,
        roughness: 0.35,
        metalness: 0.25,
      });
      disposables.push(hoanhPhiMat);
      const hoanhPhi = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 2.3), goldTrimMat);
      hoanhPhi.position.set(facadeX + 3.2, plinthH + 3.1, 0);
      const hoanhPhiFace = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 0.6), hoanhPhiMat);
      hoanhPhiFace.rotation.y = -Math.PI / 2;
      hoanhPhiFace.position.set(facadeX + 3.13, plinthH + 3.1, 0);
      mansion.add(hoanhPhi, hoanhPhiFace);

      // Furnished depth behind the open bay: altar table, porcelain vases,
      // low stools and a woven floor mat prevent a hollow black interior.
      const altarTable = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 2.0), woodLimMat);
      altarTable.position.set(facadeX + 3.05, plinthH + 0.82, 0);
      const altarApron = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 1.82), woodLimMat);
      altarApron.position.set(facadeX + 3.05, plinthH + 0.4, 0);
      mansion.add(altarTable, altarApron);
      for (const vz of [-0.62, 0.62]) {
        const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.34, 10), ceramicPotMat);
        vase.position.set(facadeX + 3.05, plinthH + 1.05, vz);
        mansion.add(vase);
      }
      const floorMat = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 3.4),
        new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.94 }),
      );
      floorMat.rotation.x = -Math.PI / 2;
      floorMat.rotation.z = Math.PI / 2;
      floorMat.position.set(facadeX + 1.65, plinthH + 0.095, 0);
      floorMat.receiveShadow = true;
      mansion.add(floorMat);
      disposables.push(floorMat.material as THREE.Material);
      for (const sz of [-0.85, 0.85]) {
        const stool = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), woodLimMat);
        stool.position.set(facadeX + 1.55, plinthH + 0.25, sz);
        stool.castShadow = true;
        mansion.add(stool);
      }

      // Warm interior glow
      const intLight = new THREE.PointLight(0xffb454, 0, 12, 1.6);
      intLight.position.set(facadeX + 2.5, plinthH + 3.2, 0);
      mansion.add(intLight);
      lanternLights.push(intLight);
    }

    // Wall pilasters separating facade bays
    if (b < 4) {
      const wallPier = new THREE.Mesh(new THREE.BoxGeometry(0.36, wallH, 1.45), stuccoOchre);
      wallPier.position.set(facadeX, plinthH + wallH * 0.5, bz + bayWidth * 0.5);
      wallPier.castShadow = wallPier.receiveShadow = true;
      mansion.add(wallPier);
    }
  }
  registerSolidCollider(mx + 0.2, mx + plinthW * 0.5, mz - plinthD * 0.5, mz + plinthD * 0.5, baseY + plinthH + 5);

  // --------------------------------------------------------------------------
  // 5. 3-Layer Ngói Âm Dương Terracotta Roof (Lower Veranda Eave + Upper Main Roof)
  // --------------------------------------------------------------------------
  const roofBaseY = plinthH + wallH + 0.22;

  // Lower veranda eave slope (-X)
  const eaveSlope = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, plinthD + 1.4), yinYangMat);
  eaveSlope.position.set(colX + 1.25, roofBaseY + 0.45, 0);
  eaveSlope.rotation.z = 0.28;
  eaveSlope.castShadow = eaveSlope.receiveShadow = true;
  mansion.add(eaveSlope);

  // White-limed under-eave soffit ("lớp ngói màn quét vôi trắng" - authentic Bình Thủy!)
  const soffit = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.05, plinthD + 1.1), whiteSoffitMat);
  soffit.position.set(colX + 1.25, roofBaseY + 0.35, 0);
  soffit.rotation.z = 0.28;
  mansion.add(soffit);
  eaveSlope.add(
    createRoofRibs({
      slopeLength: 4.2,
      roofDepth: plinthD + 1.4,
      spacing: 0.44,
      radius: 0.055,
      material: yinYangMat,
      y: 0.105,
    }),
  );

  // Grand Upper Central Roof (double pitched Yin-Yang slopes + curved ridge crest)
  const upperY = roofBaseY + 0.95;
  const upperSpanX = 11.4;
  const upperRidgeH = 2.65;
  const halfX = upperSpanX * 0.5;
  const slopeLen = Math.hypot(halfX, upperRidgeH);
  const slopePitch = Math.atan2(upperRidgeH, halfX);

  const upperFront = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.18, plinthD + 1.2), yinYangMat);
  upperFront.position.set(1.6 - halfX * 0.5, upperY + upperRidgeH * 0.5, 0);
  upperFront.rotation.z = slopePitch;
  upperFront.castShadow = upperFront.receiveShadow = true;

  const upperBack = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.18, plinthD + 1.2), yinYangMat);
  upperBack.position.set(1.6 + halfX * 0.5, upperY + upperRidgeH * 0.5, 0);
  upperBack.rotation.z = -slopePitch;
  upperBack.castShadow = upperBack.receiveShadow = true;

  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, plinthD + 1.4), stuccoCream);
  ridgeBeam.position.set(1.6, upperY + upperRidgeH, 0);
  ridgeBeam.castShadow = true;

  // Upturned curved corner ridge finials ("đầu đao & phù điêu bờ nóc")
  for (const side of [-1, 1]) {
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.72, 6), goldTrimMat);
    finial.position.set(1.6, upperY + upperRidgeH + 0.42, side * (plinthD * 0.5 + 0.45));
    finial.rotation.x = side * 0.35;
    mansion.add(finial);
  }
  const lotusCenter = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), goldTrimMat);
  lotusCenter.position.set(1.6, upperY + upperRidgeH + 0.38, 0);
  mansion.add(upperFront, upperBack, ridgeBeam, lotusCenter);
  for (const slope of [upperFront, upperBack]) {
    slope.add(
      createRoofRibs({
        slopeLength: slopeLen,
        roofDepth: plinthD + 1.2,
        spacing: 0.46,
        radius: 0.065,
        material: yinYangMat,
        y: 0.115,
      }),
    );
  }
  // Individual curved end tiles along both eaves.
  for (const slope of [upperFront, upperBack]) {
    for (let i = 0; i < 22; i++) {
      const endTile = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), stuccoCream);
      endTile.scale.set(1.25, 0.55, 0.8);
      endTile.position.set(-slopeLen * 0.49, 0.12, -plinthD * 0.48 + i * plinthD * 0.045);
      slope.add(endTile);
    }
  }

  // Mansion veranda red lanterns
  for (const lz of [-5.25, 0, 5.25]) {
    addRedLantern(mansion, colX - 0.1, plinthH + 3.15, lz, lz === 0);
  }

  // Potted Ornamental Mai Vàng & Bougainvillea flanking courtyard stairs
  const potCoords: Array<[number, number, boolean]> = [
    [-plinthW * 0.5 - 2.6, -5.8, true],
    [-plinthW * 0.5 - 2.6, -3.0, false],
    [-plinthW * 0.5 - 2.6, 3.0, false],
    [-plinthW * 0.5 - 2.6, 5.8, true],
  ];
  for (const [px, pz, isBougainvillea] of potCoords) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.52, 10), ceramicPotMat);
    pot.position.set(px, 0.26, pz);
    pot.castShadow = true;
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), leafPotMat);
    bush.position.set(px, 0.85, pz);
    bush.castShadow = true;
    mansion.add(pot, bush);
    for (let f = 0; f < 6; f++) {
      const fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 5, 4),
        isBougainvillea ? magentaFlowerMat : yellowFlowerMat,
      );
      fl.position.set(
        px + Math.cos(f * 1.1) * 0.38,
        0.78 + (f % 3) * 0.16,
        pz + Math.sin(f * 1.1) * 0.38,
      );
      mansion.add(fl);
    }
  }

  mansion.position.set(mx, baseY, mz);
  group.add(mansion);

  // --------------------------------------------------------------------------
  // 6. 3 Heritage Riverside Shophouses ("Phố Cổ Bến Sông") at x: 32..54, z: 26..33
  // --------------------------------------------------------------------------
  const shopSpecs = [
    {
      x: 34.5,
      z: 27.5,
      w: 5.4,
      d: 6.4,
      h: 4.8,
      mat: stuccoOchre,
      title: 'CÀ PHÊ BẾN ĐÒ',
      sub: 'Trà Đá • Nước Mía',
      bg: '#eee0be',
      border: '#5c2817',
    },
    {
      x: 40.3,
      z: 27.2,
      w: 5.6,
      d: 6.8,
      h: 5.3,
      mat: stuccoCream,
      title: 'TIỆM BÁNH PÍA',
      sub: 'Đặc Sản Miền Tây',
      bg: '#f2e8cf',
      border: '#254e3c',
    },
    {
      x: 46.2,
      z: 27.4,
      w: 5.4,
      d: 6.4,
      h: 4.9,
      mat: stuccoSage,
      title: 'HỦ TIẾU SA ĐÉC',
      sub: 'Gia Truyền Xưa',
      bg: '#ebd9af',
      border: '#7a2016',
    },
  ];

  shopSpecs.forEach((s, idx) => {
    const shop = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), s.mat);
    body.position.y = s.h * 0.5;
    body.castShadow = body.receiveShadow = true;
    shop.add(body);

    // Pitched Yin-Yang tiled roof facing street (+Z toward river promenade)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.5, 0.16, s.d + 1.4), yinYangMat);
    roof.position.set(0, s.h + 0.35, 0.2);
    roof.rotation.x = 0.25;
    roof.castShadow = roof.receiveShadow = true;
    const shopRibs = createRoofRibs({
      slopeLength: s.d + 1.4,
      roofDepth: s.w + 0.5,
      spacing: 0.44,
      radius: 0.05,
      material: yinYangMat,
      y: 0.1,
    });
    shopRibs.rotation.y = Math.PI / 2;
    roof.add(shopRibs);
    shop.add(roof);

    // Wooden shopfront door + upper floor shuttered window facing North (-Z / Stilt village) & +Z
    const frontSignTex = mats.createSignboardTexture(s.title, s.sub, s.bg, s.border);
    const frontSignMat = new THREE.MeshStandardMaterial({ map: frontSignTex, roughness: 0.65 });
    disposables.push(frontSignMat);

    // Facing +Z (towards Mansion approach) & -Z (towards Stilt Village/River)
    const signF = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.95), frontSignMat);
    signF.position.set(0, 2.95, s.d * 0.5 + 0.04);
    const signB = signF.clone();
    signB.rotation.y = Math.PI;
    signB.position.set(0, 2.95, -s.d * 0.5 - 0.04);
    shop.add(signF, signB);

    for (const faceDir of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.25, 0.1), woodLimMat);
      door.position.set(0, 1.15, faceDir * (s.d * 0.5 + 0.02));
      const upperWin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.15, 0.1), shutterTealMat);
      upperWin.position.set(0, 3.95, faceDir * (s.d * 0.5 + 0.03));
      shop.add(door, upperWin);

      const doorLouver = createLouverPanel({
        width: 1.85,
        height: 2.02,
        count: 10,
        material: shutterTealMat,
        frameMaterial: woodLimMat,
      });
      doorLouver.rotation.y = Math.PI / 2;
      doorLouver.position.set(0, 1.15, faceDir * (s.d * 0.5 + 0.09));
      if (faceDir < 0) doorLouver.rotation.y = -Math.PI / 2;
      shop.add(doorLouver);

      const winLouver = createLouverPanel({
        width: 1.22,
        height: 1.02,
        count: 6,
        material: shutterTealMat,
        frameMaterial: woodLimMat,
      });
      winLouver.rotation.y = faceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      winLouver.position.set(0, 3.95, faceDir * (s.d * 0.5 + 0.1));
      shop.add(winLouver);
    }

    // A patched canvas awning and bamboo outriggers give each shop a
    // distinct working frontage rather than a blank heritage box.
    const awningMat = new THREE.MeshStandardMaterial({
      color: idx === 0 ? 0x8c3d2c : idx === 1 ? 0x315d49 : 0x77613a,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    disposables.push(awningMat);
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.25, 6, 1), awningMat);
    awning.position.set(0, 2.42, s.d * 0.5 + 0.62);
    awning.rotation.x = -0.48;
    awning.castShadow = true;
    shop.add(awning);
    for (const ax of [-1.65, 1.65]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.15, 5), woodLimMat);
      rod.position.set(ax, 2.05, s.d * 0.5 + 0.52);
      rod.rotation.x = 0.72;
      shop.add(rod);
    }
    const shopStain = createStainDecal(2.6, 1.15, 0.36);
    shopStain.position.set(-0.7, 0.62, s.d * 0.5 + 0.065);
    shop.add(shopStain);

    addRedLantern(shop, -1.6, 2.55, s.d * 0.5 + 0.45, idx === 0);
    addRedLantern(shop, 1.6, 2.55, s.d * 0.5 + 0.45, false);

    shop.position.set(s.x, baseY, s.z);
    group.add(shop);
    registerSolidCollider(
      s.x - s.w * 0.5,
      s.x + s.w * 0.5,
      s.z - s.d * 0.5,
      s.z + s.d * 0.5,
      baseY + s.h,
    );
  });

  return {
    group,
    update: (_elapsedTime: number, nightFactor: number) => {
      const glow = clamp(nightFactor * 1.15 + 0.12, 0.12, 1.45);
      for (const m of lanternMats) {
        m.emissiveIntensity = glow * 2.4;
      }
      for (const l of lanternLights) {
        l.intensity = nightFactor > 0.06 ? lerp(0.8, 5.5, nightFactor) : 0.55;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
