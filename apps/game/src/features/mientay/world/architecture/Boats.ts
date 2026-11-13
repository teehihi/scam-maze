import * as THREE from 'three';
import { MekongMaterialLibrary } from '../materials/ProceduralPBR';
import { sampleRiverWave } from '../water/MekongWater';
import { SeededRNG, clamp, lerp } from '../math/Noise';
import { createPlankSurface, createRopeCurve } from '../detail/ArchitecturalDetail';

export type ProduceKind = 'pineapple' | 'watermelon' | 'pumpkin' | 'cabbage' | 'banana';

export interface FloatingBoatInstance {
  group: THREE.Group;
  anchorX: number;
  anchorZ: number;
  baseYaw: number;
  phase: number;
  length: number;
  draft: number;
}

export interface BoatsSystem {
  group: THREE.Group;
  playerBoat: THREE.Group;
  playerBoatDockPos: THREE.Vector3;
  lanternLights: THREE.PointLight[];
  lanternBulbs: THREE.MeshStandardMaterial[];
  update: (
    elapsedTime: number,
    nightFactor: number,
    playerDriven: boolean,
    playerSpeed?: number,
  ) => void;
  dispose: () => void;
}

/**
 * Generates a realistic double-ended curved wooden hull (outer + inner shell + gunwale lip)
 * matching authentic Mekong Delta ghe bầu / tam bản / xuồng ba lá proportions.
 */
function buildCurvedHullGeometry(
  length: number,
  beam: number,
  depth: number,
  prowLift: number,
  sternLift: number,
  paintedBow = false,
): THREE.BufferGeometry {
  const segsZ = 24;
  const segsU = 10;
  const verts: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segsZ; iz++) {
    const tz = iz / segsZ; // 0 = stern, 1 = bow
    const z = (tz - 0.5) * length;
    const widthProfile = Math.sin(Math.pow(tz, 0.85) * Math.PI);
    const halfW = Math.max(0.025, beam * 0.5 * Math.pow(widthProfile, 0.72));
    const sheer =
      Math.pow(clamp((tz - 0.5) * 2, 0, 1), 2.2) * prowLift +
      Math.pow(clamp((0.5 - tz) * 2, 0, 1), 2.1) * sternLift;
    const keelDrop = Math.sin(tz * Math.PI) * depth;

    for (let iu = 0; iu <= segsU; iu++) {
      const tu = (iu / segsU) * 2 - 1;
      const absU = Math.abs(tu);
      const x = Math.sign(tu) * Math.pow(absU, 0.82) * halfW;
      const y = sheer + (Math.pow(absU, 1.55) - 1) * keelDrop + depth * 0.45;
      verts.push(x, y, z);
      uvs.push(tz * 3.0, (iu / segsU) * 1.4);

      if (paintedBow && tz > 0.84) {
        // Traditional Cần Thơ crimson-painted bow stempost
        colors.push(0.72, 0.17, 0.13);
      } else if (paintedBow && absU > 0.82) {
        // Teal/blue painted upper gunwale strake
        colors.push(0.24, 0.54, 0.64);
      } else {
        colors.push(1.0, 1.0, 1.0);
      }
    }
  }

  const stride = segsU + 1;
  for (let iz = 0; iz < segsZ; iz++) {
    for (let iu = 0; iu < segsU; iu++) {
      const a = iz * stride + iu;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildProduceMesh(kind: ProduceKind, matsCache: Record<string, THREE.Material>): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'pineapple') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), matsCache.pineapple);
    body.scale.set(0.85, 1.35, 0.85);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 6), matsCache.leafGreen);
    crown.position.y = 0.18;
    g.add(body, crown);
  } else if (kind === 'watermelon') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), matsCache.watermelon);
    body.scale.set(0.95, 1.15, 0.95);
    g.add(body);
  } else if (kind === 'pumpkin') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 7), matsCache.pumpkin);
    body.scale.set(1.15, 0.78, 1.15);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.07, 5), matsCache.leafGreen);
    stem.position.y = 0.13;
    g.add(body, stem);
  } else if (kind === 'cabbage') {
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 1), matsCache.cabbage);
    g.add(body);
  } else {
    // Banana bunch
    for (let i = 0; i < 4; i++) {
      const ban = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.17, 5), matsCache.banana);
      ban.rotation.z = 0.35;
      ban.position.set((i - 1.5) * 0.04, 0, Math.sin(i) * 0.03);
      g.add(ban);
    }
  }
  return g;
}

export function createBoatsSystem(mats: MekongMaterialLibrary): BoatsSystem {
  const group = new THREE.Group();
  group.name = 'MekongBoats';
  const rng = new SeededRNG(4207);
  const disposables: Array<{ dispose: () => void }> = [];
  const boats: FloatingBoatInstance[] = [];
  const lanternLights: THREE.PointLight[] = [];
  const lanternBulbs: THREE.MeshStandardMaterial[] = [];

  const woodHullMat = mats.getWoodPlank(2, 1, true);
  const woodDeckMat = mats.getWoodPlank(3, 2, false);
  const tinRoofMat = mats.getCorrugatedTin(2, 1);
  const thatchMat = mats.getNipaThatch(2, 1);
  const eyeTex = mats.createMatGheTexture();
  const eyeMat = new THREE.MeshStandardMaterial({
    map: eyeTex,
    transparent: true,
    alphaTest: 0.25,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const redBowMat = new THREE.MeshStandardMaterial({ color: 0x9c241b, roughness: 0.62 });
  const blueTrimMat = new THREE.MeshStandardMaterial({ color: 0x225a7a, roughness: 0.6 });
  const tealTrimMat = new THREE.MeshStandardMaterial({ color: 0x266e5e, roughness: 0.6 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x8f7a44, roughness: 0.74 });
  const plankDarkLineMat = new THREE.MeshStandardMaterial({ color: 0x2e2117, roughness: 0.88 });
  const basketMat = new THREE.MeshStandardMaterial({ color: 0xa27e48, roughness: 0.85 });
  const nonLaMat = new THREE.MeshStandardMaterial({ color: 0xd9c390, roughness: 0.84, side: THREE.DoubleSide });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x8c959c, metalness: 0.8, roughness: 0.35 });
  const woodHullVertexMat = woodHullMat.clone();
  woodHullVertexMat.vertexColors = true;
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9ec0c7,
    transparent: true,
    opacity: 0.22,
    roughness: 0.15,
    metalness: 0.1,
    depthWrite: false,
  });
  const stoolRedMat = new THREE.MeshStandardMaterial({ color: 0xb92b27, roughness: 0.48 });

  const produceMats: Record<string, THREE.Material> = {
    pineapple: new THREE.MeshStandardMaterial({ color: 0xc27f18, roughness: 0.82 }),
    watermelon: new THREE.MeshStandardMaterial({ color: 0x26561e, roughness: 0.52 }),
    pumpkin: new THREE.MeshStandardMaterial({ color: 0xc65816, roughness: 0.72 }),
    cabbage: new THREE.MeshStandardMaterial({ color: 0x6ba03e, roughness: 0.74 }),
    banana: new THREE.MeshStandardMaterial({ color: 0xd8aa22, roughness: 0.68 }),
    leafGreen: new THREE.MeshStandardMaterial({ color: 0x2e5c1b, roughness: 0.75 }),
  };
  disposables.push(woodHullVertexMat);

  disposables.push(
    eyeMat,
    redBowMat,
    blueTrimMat,
    tealTrimMat,
    bambooMat,
    basketMat,
    nonLaMat,
    steelMat,
    glassMat,
    stoolRedMat,
    ...Object.values(produceMats),
  );

  // Reusable hulls
  const gheLonHullGeo = buildCurvedHullGeometry(11.6, 2.75, 1.05, 0.78, 0.46, true);
  const gheFoodHullGeo = buildCurvedHullGeometry(7.6, 2.05, 0.82, 0.56, 0.34, true);
  const sampanHullGeo = buildCurvedHullGeometry(4.4, 1.06, 0.44, 0.28, 0.24, false);
  const voLaiHullGeo = buildCurvedHullGeometry(7.8, 1.18, 0.46, 0.34, 0.16, false);
  disposables.push(gheLonHullGeo, gheFoodHullGeo, sampanHullGeo, voLaiHullGeo);

  // Helper to attach Mắt Ghe on both bow cheeks
  function attachBoatEyes(parent: THREE.Group, bowZ: number, cheekX: number, eyeY: number, scale = 1) {
    const eyeGeo = new THREE.PlaneGeometry(0.68 * scale, 0.34 * scale);
    disposables.push(eyeGeo);
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(eyeGeo, eyeMat);
      m.position.set(side * cheekX, eyeY, bowZ);
      m.rotation.y = side * (Math.PI * 0.5 - 0.34);
      m.rotation.x = -0.08;
      parent.add(m);
    }
  }

  function hullSurfacePoint(
    tz: number,
    tu: number,
    length: number,
    beam: number,
    depth: number,
    prowLift: number,
    sternLift: number,
  ): THREE.Vector3 {
    const widthProfile = Math.sin(Math.pow(tz, 0.85) * Math.PI);
    const halfW = Math.max(0.025, beam * 0.5 * Math.pow(widthProfile, 0.72));
    const sheer =
      Math.pow(clamp((tz - 0.5) * 2, 0, 1), 2.2) * prowLift +
      Math.pow(clamp((0.5 - tz) * 2, 0, 1), 2.1) * sternLift;
    const keelDrop = Math.sin(tz * Math.PI) * depth;
    const absU = Math.abs(tu);
    return new THREE.Vector3(
      Math.sign(tu) * Math.pow(absU, 0.82) * halfW,
      sheer + (Math.pow(absU, 1.55) - 1) * keelDrop + depth * 0.45,
      (tz - 0.5) * length,
    );
  }

  function addHullConstruction(
    parent: THREE.Group,
    length: number,
    beam: number,
    depth: number,
    prowLift: number,
    sternLift: number,
    deckWidth: number,
    deckLength: number,
    deckY: number,
    seed: number,
    deckZ = -0.2,
  ) {
    // Continuous gunwale caps and two longitudinal strakes follow the sheer.
    for (const side of [-1, 1]) {
      for (const [tu, radius, mat] of [
        [side * 0.99, 0.052, woodDeckMat],
        [side * 0.66, 0.018, plankDarkLineMat],
        [side * 0.38, 0.013, plankDarkLineMat],
      ] as Array<[number, number, THREE.Material]>) {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 18; i++) {
          points.push(hullSurfacePoint(i / 18, tu, length, beam, depth, prowLift, sternLift));
        }
        const rail = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 5, false),
          mat,
        );
        rail.castShadow = true;
        parent.add(rail);
        disposables.push(rail.geometry);
      }
    }

    // Transverse frames visible above the floorboards.
    const ribCount = Math.max(3, Math.floor(length / 1.35));
    for (let i = 0; i < ribCount; i++) {
      const tz = 0.18 + (i / Math.max(1, ribCount - 1)) * 0.64;
      const center = hullSurfacePoint(tz, 0, length, beam, depth, prowLift, sternLift);
      const widthHere = Math.max(0.22, beam * Math.sin(Math.pow(tz, 0.85) * Math.PI) * 0.72);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(widthHere, 0.055, 0.075), woodDeckMat);
      rib.position.set(0, deckY + 0.045, center.z);
      rib.castShadow = true;
      parent.add(rib);
    }

    const deck = createPlankSurface({
      width: deckWidth,
      depth: deckLength,
      plankWidth: 0.27,
      thickness: 0.07,
      material: woodDeckMat,
      along: 'z',
      seed,
      toneVariation: 0.11,
    });
    deck.position.set(0, deckY, deckZ);
    parent.add(deck);

    // Coiled mooring rope and a line dropping toward the water.
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 5, 14), bambooMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(beam * 0.22, deckY + 0.09, length * 0.24);
    parent.add(coil);
    const bowPoint = hullSurfacePoint(0.94, 0.35, length, beam, depth, prowLift, sternLift);
    parent.add(
      createRopeCurve(
        bowPoint,
        new THREE.Vector3(beam * 0.62, 0.02, length * 0.28),
        0.24,
        bambooMat,
        0.016,
      ),
    );
  }

  // Helper to build bamboo Cây Bẹo hanging 2-3 produce items
  function createCayBeo(produce: ProduceKind): THREE.Group {
    const poleGrp = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.025, 0.042, 4.4, 6);
    disposables.push(poleGeo);
    const pole = new THREE.Mesh(poleGeo, bambooMat);
    pole.position.y = 2.2;
    pole.castShadow = true;
    poleGrp.add(pole);

    // Cross twig at top + hanging rope + sample fruits
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.7, 5), bambooMat);
    twig.rotation.z = Math.PI * 0.42;
    twig.position.set(0.22, 4.05, 0);
    poleGrp.add(twig);

    for (let k = 0; k < 2; k++) {
      const item = buildProduceMesh(produce, produceMats);
      item.position.set(0.18 + k * 0.22, 3.85 - k * 0.28, 0);
      item.scale.setScalar(1.25);
      poleGrp.add(item);
    }
    poleGrp.rotation.x = 0.24; // leans gracefully over bow!
    return poleGrp;
  }

  // --------------------------------------------------------------------------
  // 1. Large Merchant Boats ("Ghe Thương Hồ & Cây Bẹo") in Floating Market
  // --------------------------------------------------------------------------
  const merchantSpecs: Array<{
    x: number;
    z: number;
    yaw: number;
    produce: ProduceKind;
    trim: THREE.Material;
    hasBulb?: boolean;
  }> = [
    { x: -12.5, z: -14.0, yaw: 0.22, produce: 'pineapple', trim: blueTrimMat, hasBulb: true },
    { x: -3.2, z: -4.5, yaw: -0.35, produce: 'watermelon', trim: tealTrimMat, hasBulb: true },
    { x: -15.8, z: 6.5, yaw: 0.48, produce: 'pumpkin', trim: blueTrimMat },
    { x: 2.5, z: -20.5, yaw: -0.18, produce: 'banana', trim: tealTrimMat, hasBulb: true },
    { x: -8.0, z: 16.0, yaw: 0.12, produce: 'cabbage', trim: blueTrimMat },
  ];

  merchantSpecs.forEach((spec, idx) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(gheLonHullGeo, woodHullVertexMat);
    hull.castShadow = hull.receiveShadow = true;
    boat.add(hull);

    // Tapered carved wooden stempost ("lô mũi") seated flush into the bow prow
    const stemPost = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.48, 0.14), redBowMat);
    stemPost.rotation.x = 0.34;
    stemPost.position.set(0, 1.08, 5.42);
    boat.add(stemPost);

    attachBoatEyes(boat, 4.25, 0.49, 0.66, 0.92);

    // Deck planking
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 7.8), woodDeckMat);
    deck.position.set(0, 0.34, -0.3);
    deck.receiveShadow = true;
    boat.add(deck);

    // Arched Bamboo / Corrugated-iron cabin ("Mui Ghe")
    const cabinGeo = new THREE.CylinderGeometry(1.18, 1.18, 4.4, 12, 1, true, -Math.PI * 0.46, Math.PI * 0.92);
    cabinGeo.rotateX(Math.PI / 2);
    const cabinMat = idx % 2 === 0 ? tinRoofMat : thatchMat;
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.material = cabinMat.clone();
    cabinMesh.material.side = THREE.DoubleSide;
    cabinMesh.position.set(0, 0.55, -2.0);
    cabinMesh.castShadow = cabinMesh.receiveShadow = true;
    disposables.push(cabinGeo, cabinMesh.material);
    boat.add(cabinMesh);

    // Cây Bẹo bamboo marketing pole at bow
    const beo = createCayBeo(spec.produce);
    beo.position.set(0.25, 0.45, 3.6);
    boat.add(beo);

    // Baskets of fresh produce piled on forward deck
    for (let b = 0; b < 4; b++) {
      const bx = (b % 2 === 0 ? -0.45 : 0.45) + rng.range(-0.08, 0.08);
      const bz = 0.9 + Math.floor(b / 2) * 1.1;
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.25, 0.42, 9), basketMat);
      basket.position.set(bx, 0.58, bz);
      basket.castShadow = true;
      boat.add(basket);

      for (let f = 0; f < 4; f++) {
        const fruit = buildProduceMesh(spec.produce, produceMats);
        fruit.position.set(bx + Math.cos(f * 1.6) * 0.14, 0.84, bz + Math.sin(f * 1.6) * 0.14);
        boat.add(fruit);
      }
    }

    // Warm glowing filament bulb hanging inside cabin entrance (illuminates twilight market!)
    if (spec.hasBulb) {
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xffd27a,
        emissive: new THREE.Color(0xff9d2e),
        emissiveIntensity: 0.4,
        roughness: 0.3,
      });
      lanternBulbs.push(bulbMat);
      disposables.push(bulbMat);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bulbMat);
      bulb.position.set(0, 1.52, 0.1);
      boat.add(bulb);

      const pt = new THREE.PointLight(0xff9e38, 0, 12, 1.8);
      pt.position.set(0, 1.4, 0.2);
      boat.add(pt);
      lanternLights.push(pt);
    }

    boat.position.set(spec.x, 0, spec.z);
    boat.rotation.y = spec.yaw;
    group.add(boat);
    boats.push({
      group: boat,
      anchorX: spec.x,
      anchorZ: spec.z,
      baseYaw: spec.yaw,
      phase: idx * 1.4,
      length: 11.6,
      draft: -0.14,
    });
  });

  // --------------------------------------------------------------------------
  // 2. Floating Breakfast Boats ("Ghe Hủ Tiếu & Cà Phê Sáng Chợ Nổi")
  // --------------------------------------------------------------------------
  const foodBoats: Array<[number, number, number]> = [
    [-7.0, 2.2, 1.15],
    [-1.2, -11.5, -0.65],
    [4.6, 7.8, 2.35],
  ];

  foodBoats.forEach(([fx, fz, fyaw], idx) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(gheFoodHullGeo, woodHullVertexMat);
    hull.castShadow = hull.receiveShadow = true;
    boat.add(hull);
    attachBoatEyes(boat, 2.85, 0.48, 0.52, 0.72);

    addHullConstruction(boat, 7.6, 2.05, 0.82, 0.56, 0.34, 1.6, 5.2, 0.3, 3100 + idx * 29, -0.1);

    // Tarp awning frame on 4 bamboo poles
    const awningMat = new THREE.MeshStandardMaterial({
      color: idx === 0 ? 0x265985 : idx === 1 ? 0x9e3428 : 0x2e6f48,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    disposables.push(awningMat);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 3.6), awningMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 1.78, -0.2);
    roof.castShadow = true;
    boat.add(roof);

    for (const px of [-0.72, 0.72]) {
      for (const pz of [-1.7, 1.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 5), bambooMat);
        post.position.set(px, 1.05, pz);
        boat.add(post);
      }
    }

    // Framed Glass Hủ Tiếu showcase cabinet with visible ceramic bowls inside!
    const cabinetGlass = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.84), glassMat);
    cabinetGlass.position.set(-0.32, 0.72, 0.45);
    const cabBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.9), woodDeckMat);
    cabBase.position.set(-0.32, 0.38, 0.45);
    const cabTop = cabBase.clone();
    cabTop.position.set(-0.32, 1.08, 0.45);
    for (const cx of [-0.58, -0.06]) {
      for (const cz of [0.04, 0.86]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 0.03), woodHullMat);
        strut.position.set(cx, 0.73, cz);
        boat.add(strut);
      }
    }
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xeee8da, roughness: 0.35 });
    disposables.push(bowlMat);
    for (let bw = 0; bw < 3; bw++) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.08, 8), bowlMat);
      bowl.position.set(-0.32, 0.45, 0.2 + bw * 0.24);
      boat.add(bowl);
    }
    boat.add(cabinetGlass, cabBase, cabTop);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.38, 12), steelMat);
    pot.position.set(0.32, 0.56, 0.35);
    boat.add(pot);

    // Classic red plastic stools for customers perched on deck
    for (let s = 0; s < 2; s++) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.32, 8), stoolRedMat);
      stool.position.set(-0.2 + s * 0.5, 0.48, 1.75);
      boat.add(stool);
    }

    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffdf8e,
      emissive: new THREE.Color(0xff9c2a),
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    lanternBulbs.push(bulbMat);
    disposables.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), bulbMat);
    bulb.position.set(0, 1.68, 0.35);
    boat.add(bulb);

    const pt = new THREE.PointLight(0xffa440, 0, 11, 1.7);
    pt.position.set(0, 1.6, 0.35);
    boat.add(pt);
    lanternLights.push(pt);

    boat.position.set(fx, 0, fz);
    boat.rotation.y = fyaw;
    group.add(boat);
    boats.push({
      group: boat,
      anchorX: fx,
      anchorZ: fz,
      baseYaw: fyaw,
      phase: idx * 2.1 + 0.7,
      length: 7.6,
      draft: -0.1,
    });
  });

  // --------------------------------------------------------------------------
  // 3. Agile Sampans ("Xuồng Ba Lá") & Long-Tail Skiffs ("Vỏ Lãi")
  // --------------------------------------------------------------------------
  const sampanCoords: Array<[number, number, number]> = [
    [-10.2, -5.8, 0.9],
    [-4.8, 9.5, -1.2],
    [12.4, 2.2, 0.3],     // Moored right beside Stilt Village!
    [13.6, -7.2, -0.4],   // Moored near Stilt Village north jetty
    [-31.2, 8.8, 0.25],   // Moored at Khmer Pagoda West Landing!
    [22.5, -25.2, 1.45],  // Gliding in East Nipa Canal mouth!
  ];

  sampanCoords.forEach(([sx, sz, syaw], idx) => {
    const sampan = new THREE.Group();
    const hull = new THREE.Mesh(sampanHullGeo, woodHullMat);
    hull.castShadow = hull.receiveShadow = true;
    sampan.add(hull);
    addHullConstruction(sampan, 4.4, 1.06, 0.44, 0.28, 0.24, 0.72, 2.8, 0.14, 4100 + idx * 17, 0);

    // Thwart benches ("sạp / băng ngồi")
    for (const tz of [-0.9, 0.1, 1.0]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.24), woodDeckMat);
      bench.position.set(0, 0.28, tz);
      sampan.add(bench);
    }

    // Wooden paddle & conical hat ("nón lá")
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 5), bambooMat);
    oar.rotation.x = Math.PI * 0.48;
    oar.rotation.z = 0.22;
    oar.position.set(0.24, 0.34, -0.2);
    sampan.add(oar);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 12, 1, true), nonLaMat);
    hat.position.set(-0.08, 0.39, 0.1);
    hat.rotation.z = 0.15;
    sampan.add(hat);

    // Cargo basket of watermelons or lotus flowers
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.28, 8), basketMat);
    basket.position.set(0, 0.34, 0.95);
    sampan.add(basket);
    const melon = buildProduceMesh(idx % 2 === 0 ? 'watermelon' : 'pineapple', produceMats);
    melon.position.set(0, 0.52, 0.95);
    sampan.add(melon);

    sampan.position.set(sx, 0, sz);
    sampan.rotation.y = syaw;
    group.add(sampan);
    boats.push({
      group: sampan,
      anchorX: sx,
      anchorZ: sz,
      baseYaw: syaw,
      phase: idx * 1.15,
      length: 4.4,
      draft: -0.06,
    });
  });

  // Vỏ Lãi with Long-tail Outboard Engine ("Đuôi Tôm")
  const voLaiSpecs: Array<[number, number, number]> = [
    [9.4, -14.2, -0.45],
    [-19.2, -26.5, 0.3],
  ];
  voLaiSpecs.forEach(([vx, vz, vyaw], idx) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(voLaiHullGeo, blueTrimMat);
    hull.castShadow = hull.receiveShadow = true;
    boat.add(hull);
    attachBoatEyes(boat, 3.0, 0.3, 0.35, 0.55);

    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.42), steelMat);
    engine.position.set(0, 0.45, -2.5);
    boat.add(engine);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.3, 6), steelMat);
    shaft.rotation.x = Math.PI * 0.42;
    shaft.position.set(0, 0.22, -3.5);
    boat.add(shaft);

    boat.position.set(vx, 0, vz);
    boat.rotation.y = vyaw;
    group.add(boat);
    boats.push({
      group: boat,
      anchorX: vx,
      anchorZ: vz,
      baseYaw: vyaw,
      phase: idx * 1.9 + 0.4,
      length: 7.8,
      draft: -0.07,
    });
  });

  // --------------------------------------------------------------------------
  // 4. Interactive Player Boat ("Xuồng Du Ngoạn Bến Đò") moored at Pier!
  // --------------------------------------------------------------------------
  const playerBoatDockPos = new THREE.Vector3(11.6, 0, 27.6);
  const playerBoat = new THREE.Group();
  playerBoat.name = 'PlayerSampan';
  const pHull = new THREE.Mesh(sampanHullGeo, woodHullMat);
  pHull.scale.set(1.16, 1.12, 1.16);
  pHull.castShadow = pHull.receiveShadow = true;
  playerBoat.add(pHull);
  attachBoatEyes(playerBoat, 1.85, 0.3, 0.35, 0.52);

  for (const tz of [-1.0, 0.0, 1.1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 0.28), woodDeckMat);
    bench.position.set(0, 0.3, tz);
    playerBoat.add(bench);
  }
  const pLanternMat = new THREE.MeshStandardMaterial({
    color: 0xffe49c,
    emissive: new THREE.Color(0xff9f32),
    emissiveIntensity: 0.7,
  });
  lanternBulbs.push(pLanternMat);
  disposables.push(pLanternMat);
  const pPost = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.15, 5), bambooMat);
  pPost.position.set(0.36, 0.85, 1.75);
  const pBulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), pLanternMat);
  pBulb.position.set(0.36, 1.42, 1.75);
  const pLight = new THREE.PointLight(0xffa43c, 0, 14, 1.6);
  pLight.position.set(0.36, 1.38, 1.75);
  lanternLights.push(pLight);
  playerBoat.add(pPost, pBulb, pLight);

  addHullConstruction(playerBoat, 5.1, 1.22, 0.49, 0.32, 0.27, 0.84, 3.2, 0.16, 4901, 0);

  // Subtle foaming Kelvin wake V-ribbon attached beneath player boat bow & stern
  const wakeUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0 },
  };
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: wakeUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSpeed;
      varying vec2 vUv;
      float wHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float wNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x),
          mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        float speedNorm = clamp(abs(uSpeed) / 7.0, 0.0, 1.0);
        if (speedNorm < 0.04) discard;
        // vUv.y = 1 at bow tip -> 0 behind stern
        float along = 1.0 - vUv.y;
        float xNorm = abs(vUv.x - 0.5) * 2.0;
        float armDist = abs(xNorm - (0.10 + along * 0.72));
        float arm = smoothstep(0.18, 0.02, armDist);
        float sternFoam = smoothstep(0.32, 0.02, xNorm) * smoothstep(0.28, 0.72, along);
        float n = wNoise(vec2(vUv.x * 16.0, vUv.y * 28.0 + uTime * 3.8));
        float alpha = (arm * 0.75 + sternFoam * 0.45) * smoothstep(0.0, 0.14, along) * (1.0 - along) * smoothstep(0.32, 0.78, n) * speedNorm * 0.62;
        gl_FragColor = vec4(vec3(0.86, 0.84, 0.78), alpha);
      }
    `,
  });
  const wakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 8.6, 1, 1), wakeMat);
  wakeMesh.rotation.x = -Math.PI / 2;
  wakeMesh.position.set(0, 0.06, -1.35);
  playerBoat.add(wakeMesh);
  disposables.push(wakeMesh.geometry, wakeMat, plankDarkLineMat);

  playerBoat.position.copy(playerBoatDockPos);
  playerBoat.rotation.y = Math.PI * 0.9;
  group.add(playerBoat);

  return {
    group,
    playerBoat,
    playerBoatDockPos,
    lanternLights,
    lanternBulbs,
    update: (
      elapsedTime: number,
      nightFactor: number,
      playerDriven: boolean,
      playerSpeed = 0,
    ) => {
      wakeUniforms.uTime.value = elapsedTime;
      wakeUniforms.uSpeed.value = playerDriven ? playerSpeed : 0;
      // Animate wave bobbing & pitch/roll on every moored boat
      for (const b of boats) {
        const w = sampleRiverWave(b.anchorX, b.anchorZ, elapsedTime + b.phase);
        const swayX = Math.sin(elapsedTime * 0.45 + b.phase) * 0.14;
        const swayZ = Math.cos(elapsedTime * 0.38 + b.phase) * 0.12;
        b.group.position.set(b.anchorX + swayX, w.height + b.draft, b.anchorZ + swayZ);

        // Transform world wave slope into boat local frame
        const cosY = Math.cos(b.baseYaw);
        const sinY = Math.sin(b.baseYaw);
        const localPitch = w.slopeZ * cosY + w.slopeX * sinY;
        const localRoll = -w.slopeX * cosY + w.slopeZ * sinY;
        b.group.rotation.set(
          localPitch * 0.85 + Math.sin(elapsedTime * 0.9 + b.phase) * 0.012,
          b.baseYaw + Math.sin(elapsedTime * 0.3 + b.phase) * 0.028,
          localRoll * 1.15 + Math.cos(elapsedTime * 1.1 + b.phase) * 0.018,
        );
      }

      if (!playerDriven) {
        const pw = sampleRiverWave(playerBoat.position.x, playerBoat.position.z, elapsedTime);
        playerBoat.position.y = pw.height - 0.05;
        playerBoat.rotation.x = pw.slopeZ * 0.7;
        playerBoat.rotation.z = -pw.slopeX * 0.9;
      }

      // Warm incandescent market lights ramp up softly at dawn & twilight/night
      const glowPower = clamp(nightFactor * 1.15 + 0.15, 0.15, 1.35);
      for (const bm of lanternBulbs) {
        bm.emissiveIntensity = glowPower * 2.6;
      }
      for (const pl of lanternLights) {
        pl.intensity = nightFactor > 0.08 ? lerp(0.5, 4.2, nightFactor) : 0.0;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
