import * as THREE from 'three';
import { MekongMaterialLibrary } from '../materials/ProceduralPBR';
import {
  registerSolidCollider,
  registerWalkableBox,
  registerWalkableSlope,
  sampleTerrainHeight,
} from '../terrain/MekongHeightfield';
import { clamp, lerp } from '../math/Noise';
import {
  createLouverPanel,
  createPlankSurface,
  createPlankWall,
  createRoofRibs,
  createStainDecal,
} from '../detail/ArchitecturalDetail';

export interface StiltVillageSystem {
  group: THREE.Group;
  update: (elapsedTime: number, nightFactor: number) => void;
  dispose: () => void;
}

interface HouseSpec {
  x: number;
  z: number;
  w: number; // X width
  d: number; // Z depth
  floorY: number;
  yaw: number;
  roofKind: 'thatch' | 'tin' | 'mixed';
  wallColor: number;
  hasCafe?: boolean;
  hasLaundry?: boolean;
}

export function createStiltVillage(mats: MekongMaterialLibrary): StiltVillageSystem {
  const group = new THREE.Group();
  group.name = 'MekongStiltVillage';
  const disposables: Array<{ dispose: () => void }> = [];

  const plankLightMat = mats.getWoodPlank(2, 2, false);
  const plankDarkMat = mats.getWoodPlank(2, 2, true);
  const pilingMat = mats.getPilingBark(1, 3);
  const thatchMat = mats.getNipaThatch(3, 2);
  const tinMat = mats.getCorrugatedTin(2, 2);
  const daBoMat = mats.getDaBoCeramic();
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x8f7743, roughness: 0.78 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.88 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x564632, roughness: 0.92 });
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e2024 });
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.97 });
  const darkInsetMat = new THREE.MeshStandardMaterial({ color: 0x17130e, roughness: 0.92 });
  const lampBulbs: THREE.MeshStandardMaterial[] = [];
  const lampLights: THREE.PointLight[] = [];
  const clothMeshes: Array<{ mesh: THREE.Mesh; phase: number }> = [];

  disposables.push(bambooMat, tireMat, ropeMat, wireMat, mudMat, darkInsetMat);

  function addHangingLamp(parent: THREE.Group, x: number, y: number, z: number, withLight = false) {
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2c4b37, roughness: 0.65, side: THREE.DoubleSide });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffe4a0,
      emissive: new THREE.Color(0xff9b28),
      emissiveIntensity: 0.4,
    });
    disposables.push(shadeMat, bulbMat);
    lampBulbs.push(bulbMat);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 4), wireMat);
    cord.position.set(x, y + 0.19, z);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.12, 10, 1, true), shadeMat);
    shade.position.set(x, y + 0.02, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bulbMat);
    bulb.position.set(x, y - 0.03, z);
    parent.add(cord, shade, bulb);

    if (withLight) {
      const pt = new THREE.PointLight(0xff9e38, 0, 14, 1.7);
      pt.position.set(x, y - 0.12, z);
      parent.add(pt);
      lampLights.push(pt);
    }
  }

  function addLuNuoc(parent: THREE.Group, x: number, y: number, z: number, scale = 1) {
    const jarGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.24, 0.02),
        new THREE.Vector2(0.36, 0.34),
        new THREE.Vector2(0.34, 0.64),
        new THREE.Vector2(0.23, 0.78),
        new THREE.Vector2(0.26, 0.84),
      ],
      14,
    );
    disposables.push(jarGeo);
    const jar = new THREE.Mesh(jarGeo, daBoMat);
    jar.scale.setScalar(scale);
    jar.position.set(x, y, z);
    jar.castShadow = jar.receiveShadow = true;

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27 * scale, 0.27 * scale, 0.03, 10), plankDarkMat);
    lid.position.set(x, y + 0.85 * scale, z);
    parent.add(jar, lid);
  }

  function addStiltPilings(
    parent: THREE.Group,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    topY: number,
    colsX: number,
    colsZ: number,
    worldOffsetX = 0,
    worldOffsetZ = 0,
  ) {
    for (let ix = 0; ix < colsX; ix++) {
      const lx = lerp(minX, maxX, colsX === 1 ? 0.5 : ix / (colsX - 1));
      for (let iz = 0; iz < colsZ; iz++) {
        const lz = lerp(minZ, maxZ, colsZ === 1 ? 0.5 : iz / (colsZ - 1));
        const groundY = sampleTerrainHeight(worldOffsetX + lx, worldOffsetZ + lz);
        const bottomY = Math.min(groundY - 0.35, -0.4);
        const h = topY - bottomY;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, h, 9), pilingMat);
        post.position.set(lx, bottomY + h * 0.5, lz);
        post.rotation.y = (ix * 1.7 + iz * 0.9) % Math.PI;
        post.castShadow = post.receiveShadow = true;
        parent.add(post);

        const mound = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 9), mudMat);
        mound.position.set(lx, groundY + 0.015, lz);
        mound.scale.y = 0.55;
        mound.receiveShadow = true;
        parent.add(mound);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 1. Stilt Houses ("Nhà Sàn Ven Sông")
  // --------------------------------------------------------------------------
  const houses: HouseSpec[] = [
    { x: 21.5, z: -9.5, w: 6.2, d: 5.4, floorY: 1.85, yaw: 0.08, roofKind: 'thatch', wallColor: 0x9b7958, hasLaundry: true },
    { x: 22.8, z: -2.2, w: 6.6, d: 5.8, floorY: 1.85, yaw: -0.04, roofKind: 'mixed', wallColor: 0x678372 },
    { x: 21.2, z: 5.8, w: 6.8, d: 6.4, floorY: 1.85, yaw: 0.05, roofKind: 'thatch', wallColor: 0xa4825f, hasCafe: true },
    { x: 22.5, z: 13.8, w: 6.0, d: 5.2, floorY: 1.85, yaw: -0.06, roofKind: 'tin', wallColor: 0x708a98, hasLaundry: true },
    { x: 31.8, z: -5.5, w: 5.8, d: 5.2, floorY: 1.85, yaw: Math.PI, roofKind: 'tin', wallColor: 0xab8963 },
    { x: 32.0, z: 9.2, w: 6.0, d: 5.4, floorY: 1.85, yaw: Math.PI, roofKind: 'thatch', wallColor: 0x778c6a },
  ];

  houses.forEach((h, idx) => {
    const house = new THREE.Group();
    const hw = h.w * 0.5;
    const hd = h.d * 0.5;

    // Pilings anchored down into river mud!
    addStiltPilings(house, -hw + 0.3, hw - 0.3, -hd + 0.3, hd - 0.3, h.floorY, 3, 3, h.x, h.z);

    // Diagonal bracing in both structural planes; real stilt frames are
    // cross-tied against current, wind and the racking of a timber floor.
    for (const sz of [-hd + 0.35, hd - 0.35]) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.2, 5), pilingMat);
      brace.position.set(-hw * 0.45, h.floorY - 0.9, sz);
      brace.rotation.z = 0.78;
      house.add(brace);
    }
    for (const sx of [-hw + 0.35, hw - 0.35]) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 3.1, 5), pilingMat);
      brace.position.set(sx, h.floorY - 0.92, 0);
      brace.rotation.x = idx % 2 === 0 ? 0.76 : -0.76;
      house.add(brace);
    }
    // Longitudinal bearer beams under the floor plate.
    for (const bz of [-hd + 0.32, hd - 0.32]) {
      const bearer = new THREE.Mesh(new THREE.BoxGeometry(h.w + 1.2, 0.17, 0.14), plankDarkMat);
      bearer.position.set(-0.55, h.floorY - 0.14, bz);
      bearer.castShadow = bearer.receiveShadow = true;
      house.add(bearer);
    }

    // Main timber floor + front veranda ("hàng ba") facing river (-X):
    // individual boards with real gaps and minute level differences.
    const floorMesh = createPlankSurface({
      width: h.w + 1.46,
      depth: h.d - 0.06,
      plankWidth: 0.31,
      thickness: 0.13,
      material: plankLightMat,
      along: 'x',
      seed: 3100 + idx * 71,
      toneVariation: 0.1,
    });
    floorMesh.position.set(-0.65, h.floorY, 0);
    house.add(floorMesh);
    // Veranda front & back rim fascia beams cover plank end-grain cleanly
    const frontFascia = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, h.d), plankDarkMat);
    frontFascia.position.set(-0.65 - (h.w + 1.5) * 0.5, h.floorY - 0.01, 0);
    frontFascia.castShadow = frontFascia.receiveShadow = true;
    house.add(frontFascia);

    // Register walkable porch & interior bounds (approx world AABB)
    registerWalkableBox(
      `stilt-floor-${idx}`,
      h.x - hw - 1.4,
      h.x + hw,
      h.z - hd,
      h.z + hd,
      h.floorY + 0.07,
    );

    // Timber plank walls (tinted painted wood planks)
    const wallMat = plankDarkMat.clone();
    wallMat.color.setHex(h.wallColor);
    disposables.push(wallMat);

    const wallH = 2.65;
    const bodyW = h.w - 1.1;
    const bodyX = 0.55;
    // Back wall (+X), side walls (+/-Z), and partial front wall with open door
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, wallH, h.d - 0.2), wallMat);
    backWall.position.set(bodyX + bodyW * 0.5, h.floorY + wallH * 0.5, 0);
    backWall.castShadow = backWall.receiveShadow = true;
    house.add(backWall);

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(bodyW, wallH, 0.12), wallMat);
      sideWall.position.set(bodyX, h.floorY + wallH * 0.5, side * (hd - 0.14));
      sideWall.castShadow = sideWall.receiveShadow = true;
      house.add(sideWall);
    }

    // Front wall (-X) with open doorway & propped-open shuttered window!
    for (const side of [-1, 1]) {
      const frontSeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, wallH, h.d * 0.34), wallMat);
      frontSeg.position.set(bodyX - bodyW * 0.5, h.floorY + wallH * 0.5, side * (hd * 0.65));
      frontSeg.castShadow = frontSeg.receiveShadow = true;
      house.add(frontSeg);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, h.d * 0.36), wallMat);
    header.position.set(bodyX - bodyW * 0.5, h.floorY + wallH - 0.36, 0);
    house.add(header);

    // A second, physically boarded skin over the flat wall core, inheriting full
    // 512px wood grain, normal, roughness & weathering maps.
    const plankSkinMat = plankLightMat.clone();
    plankSkinMat.color.setHex(h.wallColor);
    disposables.push(plankSkinMat);
    const backSkin = createPlankWall({
      width: h.d - 0.2,
      height: wallH,
      material: plankSkinMat,
      seed: 5100 + idx * 37,
      vertical: idx % 2 === 1,
    });
    backSkin.rotation.y = Math.PI / 2;
    backSkin.position.set(bodyX + bodyW * 0.5 + 0.075, h.floorY + wallH * 0.5, 0);
    house.add(backSkin);

    for (const side of [-1, 1]) {
      const sideSkin = createPlankWall({
        width: bodyW,
        height: wallH,
        material: plankSkinMat,
        seed: 6100 + idx * 41 + side,
        vertical: idx % 2 === 0,
      });
      sideSkin.position.set(bodyX, h.floorY + wallH * 0.5, side * (hd - 0.035));
      house.add(sideSkin);

      const frontSkin = createPlankWall({
        width: h.d * 0.34,
        height: wallH,
        material: plankSkinMat,
        seed: 7100 + idx * 43 + side,
      });
      frontSkin.rotation.y = Math.PI / 2;
      frontSkin.position.set(
        bodyX - bodyW * 0.5 - 0.075,
        h.floorY + wallH * 0.5,
        side * hd * 0.65,
      );
      house.add(frontSkin);

      // Weather stain low on the river-facing boards.
      const stain = createStainDecal(1.45, 1.5, 0.42);
      stain.rotation.y = -Math.PI / 2;
      stain.position.set(bodyX - bodyW * 0.5 - 0.125, h.floorY + 0.72, side * hd * 0.62);
      house.add(stain);

      // Deep louvred side window with a real frame and shadowed inset.
      const inset = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.96, 0.055), darkInsetMat);
      inset.position.set(bodyX - 0.35 + (idx % 2) * 0.55, h.floorY + 1.68, side * (hd + 0.005));
      house.add(inset);
      const louver = createLouverPanel({
        width: 1.02,
        height: 0.9,
        count: 8,
        material: plankLightMat,
        frameMaterial: plankDarkMat,
      });
      louver.rotation.y = Math.PI / 2;
      louver.position.set(bodyX - 0.35 + (idx % 2) * 0.55, h.floorY + 1.68, side * (hd + 0.045));
      house.add(louver);
    }

    // Corner battens and a proud timber door frame conceal board ends.
    for (const cx of [bodyX - bodyW * 0.5, bodyX + bodyW * 0.5]) {
      for (const cz of [-hd + 0.08, hd - 0.08]) {
        const batten = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH + 0.04, 0.15), plankDarkMat);
        batten.position.set(cx, h.floorY + wallH * 0.5, cz);
        batten.castShadow = true;
        house.add(batten);
      }
    }
    for (const dz of [-0.68, 0.68]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.98, 0.14), plankDarkMat);
      jamb.position.set(bodyX - bodyW * 0.5 - 0.06, h.floorY + 0.99, dz);
      house.add(jamb);
    }

    // Propped-open wooden shutter ("cửa sổ chống cây tre")
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 1.05), plankLightMat);
    shutter.position.set(bodyX - bodyW * 0.5 - 0.32, h.floorY + 1.85, hd * 0.52);
    shutter.rotation.z = 0.68;
    shutter.castShadow = true;
    house.add(shutter);

    // Register solid interior wall block so player walks on veranda (-X) without walking through back wall
    registerSolidCollider(h.x - 0.1, h.x + hw, h.z - hd + 0.2, h.z + hd - 0.2, h.floorY + 3.2);

    // Veranda wooden balustrade & timber posts
    for (const pz of [-hd + 0.2, -hd * 0.32, hd * 0.32, hd - 0.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, wallH + 0.1, 6), pilingMat);
      post.position.set(-hw - 0.65, h.floorY + wallH * 0.5, pz);
      post.castShadow = true;
      house.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, h.d), plankLightMat);
    rail.position.set(-hw - 0.65, h.floorY + 0.92, 0);
    house.add(rail);

    // Gable roof (2 pitched roof slopes + overhanging eaves + triangular gable fills)
    const roofW = h.w + 2.4;
    const roofD = h.d + 1.2;
    const ridgeH = 1.45;
    const halfSpan = roofW * 0.5;
    const slopeLen = Math.hypot(halfSpan, ridgeH);
    const pitch = Math.atan2(ridgeH, halfSpan);
    const roofMatA = h.roofKind === 'tin' ? tinMat : thatchMat;
    const roofMatB = h.roofKind === 'mixed' ? tinMat : roofMatA;

    const leftSlope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.1, roofD), roofMatA);
    leftSlope.position.set(-0.2 - halfSpan * 0.5, h.floorY + wallH + ridgeH * 0.45, 0);
    leftSlope.rotation.z = pitch;
    leftSlope.castShadow = leftSlope.receiveShadow = true;

    const rightSlope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.1, roofD), roofMatB);
    rightSlope.position.set(-0.2 + halfSpan * 0.5, h.floorY + wallH + ridgeH * 0.45, 0);
    rightSlope.rotation.z = -pitch;
    rightSlope.castShadow = rightSlope.receiveShadow = true;

    const ridgeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, roofD + 0.1, 6), plankDarkMat);
    ridgeCap.rotation.x = Math.PI / 2;
    ridgeCap.position.set(-0.2, h.floorY + wallH + ridgeH - 0.02, 0);
    house.add(leftSlope, rightSlope, ridgeCap);

    // Corrugated roofs gain raised seams; thatch gains visible eave courses.
    if (h.roofKind === 'tin' || h.roofKind === 'mixed') {
      const ribTarget = h.roofKind === 'tin' ? [leftSlope, rightSlope] : [rightSlope];
      for (const slope of ribTarget) {
        slope.add(
          createRoofRibs({
            slopeLength: slopeLen,
            roofDepth: roofD,
            spacing: 0.48,
            radius: 0.055,
            material: plankDarkMat,
            y: 0.075,
          }),
        );
      }
    } else {
      for (const slope of [leftSlope, rightSlope]) {
        for (let course = 0; course < 3; course++) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.055, roofD * 0.99),
            plankDarkMat,
          );
          strip.position.set(-slopeLen * 0.32 + course * slopeLen * 0.3, 0.085, 0);
          slope.add(strip);
        }
      }
    }
    // Exposed rafter tails below both eaves.
    for (let r = 0; r < 7; r++) {
      const rz = -roofD * 0.42 + r * roofD * 0.14;
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.09), plankDarkMat);
        tail.position.set(-0.2 + side * (halfSpan + 0.18), h.floorY + wallH + 0.08, rz);
        house.add(tail);
      }
    }

    // Gable triangular walls
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-bodyW * 0.52, 0);
    gableShape.lineTo(bodyW * 0.52, 0);
    gableShape.lineTo(0, ridgeH * 0.85);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.1, bevelEnabled: false });
    disposables.push(gableGeo);
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(gableGeo, wallMat);
      gable.position.set(bodyX - 0.1, h.floorY + wallH - 0.05, side * (hd - 0.18));
      house.add(gable);
    }

    // Rainwater Lu Nước jar + warm hanging lamp on every stilt veranda
    addLuNuoc(house, -hw - 0.25, h.floorY + 0.07, -hd + 0.65, 0.9);
    addHangingLamp(house, -hw - 0.1, h.floorY + 2.15, 0, idx % 2 === 0);

    // Working clutter stored in the shaded undercroft: firewood, crates and
    // a coiled fishing net. These small occluders make the void under the
    // house feel used rather than architecturally empty.
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.62), plankDarkMat);
    crate.position.set(hw * 0.38, 0.55 + (idx % 2) * 0.12, -hd * 0.42);
    crate.rotation.y = idx * 0.37;
    crate.castShadow = crate.receiveShadow = true;
    house.add(crate);
    for (let log = 0; log < 4; log++) {
      const firewood = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.85, 6), pilingMat);
      firewood.rotation.z = Math.PI / 2;
      firewood.position.set(-hw * 0.28, 0.38 + (log % 2) * 0.12, hd * 0.38 + Math.floor(log / 2) * 0.13);
      firewood.castShadow = true;
      house.add(firewood);
    }
    const netCoil = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 5, 14), ropeMat);
    netCoil.position.set(0.1, h.floorY - 0.42, hd * 0.52);
    netCoil.rotation.y = Math.PI / 2;
    house.add(netCoil);

    // Riverside Hammock Café ("Quán Cà Phê Võng") on House #2
    if (h.hasCafe) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 1.3), plankLightMat);
      table.position.set(-hw + 0.05, h.floorY + 0.58, 0.6);
      const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 6), plankDarkMat);
      tLeg.position.set(-hw + 0.05, h.floorY + 0.3, 0.6);
      house.add(table, tLeg);

      // Swaying hammock ("võng") slung between front veranda posts
      const hammockMat = new THREE.MeshStandardMaterial({ color: 0x2c6e5e, roughness: 0.9, side: THREE.DoubleSide });
      disposables.push(hammockMat);
      const ham = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.9, 8, 1, true, 0, Math.PI), hammockMat);
      ham.rotation.x = Math.PI / 2;
      ham.rotation.y = Math.PI / 2;
      ham.scale.set(1, 0.55, 1);
      ham.position.set(-hw - 0.28, h.floorY + 0.95, -1.2);
      house.add(ham);
    }

    // Hanging laundry line ("áo bà ba & khăn rằn") gently fluttering in river breeze
    if (h.hasLaundry) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.8, 4), ropeMat);
      line.rotation.x = Math.PI / 2;
      line.position.set(-hw - 0.55, h.floorY + 1.88, 0);
      house.add(line);

      const garmentColors = [0xc8553d, 0x3b6e8c, 0xe8d9b8, 0x7c9c56];
      for (let g = 0; g < 3; g++) {
        const cm = new THREE.MeshStandardMaterial({
          color: garmentColors[(idx + g) % garmentColors.length],
          roughness: 0.92,
          side: THREE.DoubleSide,
        });
        disposables.push(cm);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.62, 1, 3), cm);
        cloth.position.set(-hw - 0.55, h.floorY + 1.54, -0.8 + g * 0.75);
        cloth.rotation.y = Math.PI / 2;
        cloth.castShadow = true;
        // Swayed every frame by update(); must not be merged into static geometry.
        cloth.userData.dynamic = true;
        house.add(cloth);
        clothMeshes.push({ mesh: cloth, phase: idx * 1.7 + g });
      }
    }

    house.position.set(h.x, 0, h.z);
    house.rotation.y = h.yaw;
    group.add(house);
  });

  // --------------------------------------------------------------------------
  // 2. Interconnected Wooden Boardwalks ("Cầu Ván Xóm Sàn")
  // --------------------------------------------------------------------------
  // Main riverside spine boardwalk at x: 24.5..28.5, z: -15..28
  const mainBoardwalk = new THREE.Group();
  const bwY = 1.85;
  addStiltPilings(mainBoardwalk, 25.4, 27.6, -14.5, 25.0, bwY, 2, 12);
  const bwDeck = createPlankSurface({
    width: 2.8,
    depth: 41.5,
    plankWidth: 0.31,
    thickness: 0.13,
    material: plankLightMat,
    along: 'x',
    seed: 8801,
    toneVariation: 0.12,
  });
  bwDeck.position.set(26.5, bwY, 5.5);
  mainBoardwalk.add(bwDeck);
  for (const sx of [25.25, 27.75]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 41.5), plankDarkMat);
    stringer.position.set(sx, bwY - 0.16, 5.5);
    stringer.castShadow = stringer.receiveShadow = true;
    mainBoardwalk.add(stringer);
  }
  group.add(mainBoardwalk);
  registerWalkableBox('village-boardwalk-spine', 25.0, 28.0, -15.5, 26.5, bwY + 0.07);

  // Ramp sloping down from boardwalk (z=26.2, y=1.85) onto dry riverside promenade (z=29.5, y=1.55)
  const rampDeck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 3.6), plankDarkMat);
  rampDeck.position.set(26.5, 1.7, 27.9);
  rampDeck.rotation.x = 0.095;
  rampDeck.receiveShadow = true;
  group.add(rampDeck);
  registerWalkableSlope('village-boardwalk-ramp', 25.0, 28.0, 26.2, 29.8, (_x, z) => {
    const t = clamp((z - 26.2) / 3.6, 0, 1);
    return lerp(1.92, 1.56, t);
  });

  // Connector boardwalk East toward Bamboo Monkey Bridge (x: 27..48, z: -17..-14)
  const eastSpur = new THREE.Group();
  addStiltPilings(eastSpur, 28.5, 48.0, -16.5, -14.8, 1.78, 6, 2);
  const eastSpurDeck = createPlankSurface({
    width: 21.5,
    depth: 2.2,
    plankWidth: 0.31,
    thickness: 0.12,
    material: plankLightMat,
    along: 'z',
    seed: 8817,
    toneVariation: 0.12,
  });
  eastSpurDeck.position.set(37.5, 1.78, -15.6);
  eastSpur.add(eastSpurDeck);
  group.add(eastSpur);
  registerWalkableBox('village-east-spur', 27.0, 49.0, -17.0, -14.4, 1.84);

  // --------------------------------------------------------------------------
  // 3. Wooden Ferry Pier ("Bến Đò Sông Hậu") at x: 12..26, z: 25.5..29.5
  // --------------------------------------------------------------------------
  const pier = new THREE.Group();
  const pierY = 1.15;
  addStiltPilings(pier, 12.6, 25.0, 25.8, 29.0, pierY, 5, 2);
  const pierDeck = createPlankSurface({
    width: 13.6,
    depth: 3.6,
    plankWidth: 0.32,
    thickness: 0.13,
    material: plankDarkMat,
    along: 'z',
    seed: 8831,
    toneVariation: 0.13,
  });
  pierDeck.position.set(18.8, pierY, 27.4);
  pier.add(pierDeck);

  // Step stairs up from Pier (y=1.15) to Riverside Quay Promenade (x=25.6..28.5, y=1.62)
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 3.4), plankLightMat);
    step.position.set(25.4 + s * 0.6, lerp(1.18, 1.56, s / 3), 27.4);
    step.receiveShadow = true;
    pier.add(step);
  }
  // Mooring bollards + old rubber tire fenders along pier tip
  for (const bz of [26.0, 28.8]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.85, 7), pilingMat);
    bollard.position.set(12.3, pierY + 0.35, bz);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 7, 14), tireMat);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(11.95, pierY - 0.35, bz);
    pier.add(bollard, tire);
  }
  addHangingLamp(pier, 13.0, pierY + 2.4, 26.0, true);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.7, 6), pilingMat);
  lampPost.position.set(12.8, pierY + 1.3, 26.0);
  pier.add(lampPost);

  // Bamboo fish traps ("nơm / lờ") resting on the pier
  const trap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.38, 0.72, 10, 1, true), bambooMat);
  trap.position.set(15.2, pierY + 0.43, 28.6);
  pier.add(trap);

  group.add(pier);
  registerWalkableBox('ferry-pier-main', 11.8, 25.6, 25.5, 29.3, pierY + 0.08);
  registerWalkableSlope('ferry-pier-stairs', 25.0, 27.8, 25.5, 29.3, (x) => {
    const t = clamp((x - 25.0) / 2.6, 0, 1);
    return lerp(1.22, 1.66, t);
  });

  // --------------------------------------------------------------------------
  // 4. Wooden Utility Poles & Sagging Catenary Wires ("Cột điện & Dây điện xóm")
  // --------------------------------------------------------------------------
  const poleCoords: Array<[number, number]> = [
    [29.2, 24.5],
    [29.5, 9.5],
    [29.2, -5.5],
    [34.5, 32.0],
    [47.0, 31.5],
  ];
  const poleTops: THREE.Vector3[] = [];
  for (const [px, pz] of poleCoords) {
    const py = sampleTerrainHeight(px, pz);
    const poleH = 6.2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, poleH, 7), pilingMat);
    pole.position.set(px, py + poleH * 0.5, pz);
    pole.castShadow = true;
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), plankDarkMat);
    crossArm.position.set(px, py + poleH - 0.3, pz);
    group.add(pole, crossArm);
    poleTops.push(new THREE.Vector3(px, py + poleH - 0.3, pz));
  }

  const wirePairs: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 4],
  ];
  for (const [iA, iB] of wirePairs) {
    const pA = poleTops[iA];
    const pB = poleTops[iB];
    for (const offset of [-0.3, 0.3]) {
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        const p = new THREE.Vector3().lerpVectors(pA, pB, t);
        p.x += offset;
        p.y -= Math.sin(t * Math.PI) * 0.65; // authentic gravity catenary sag!
        pts.push(p);
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      disposables.push(lineGeo);
      group.add(new THREE.Line(lineGeo, wireMat));
    }
  }

  return {
    group,
    update: (elapsedTime: number, nightFactor: number) => {
      // Gentle river breeze swaying hanging laundry
      for (const item of clothMeshes) {
        item.mesh.rotation.z = Math.sin(elapsedTime * 2.2 + item.phase) * 0.12 + 0.06;
      }

      const glow = clamp(nightFactor * 1.2 + 0.12, 0.12, 1.4);
      for (const bm of lampBulbs) {
        bm.emissiveIntensity = glow * 2.5;
      }
      for (const pl of lampLights) {
        // A faint warm practical keeps shaded verandas from collapsing to
        // black during the day while preserving the night lantern hierarchy.
        pl.intensity = nightFactor > 0.06 ? lerp(0.8, 5.2, nightFactor) : 0.38;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
