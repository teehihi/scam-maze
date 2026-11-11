import * as THREE from 'three';
import type { HueMaterialSet } from '../../engine/materials/HueMaterialFoundry';
import { getRiverCenterZ } from '../hueWorldConfig';
import {
  createCornerDragonFinial,
  createHueLantern,
  createSweepingHueRoof,
} from './hueArchitecturalHelpers';
import type { LanternHandle } from './hueArchitecturalHelpers';

export interface DragonBoatHandle {
  group: THREE.Group;
  baseX: number;
  speed: number;
  direction: 1 | -1;
  offsetZ: number;
}

export interface KimLongAndBoatsResult {
  group: THREE.Group;
  boats: DragonBoatHandle[];
  lanterns: LanternHandle[];
  hoaDangGroup: THREE.Group;
  hoaDangLights: THREE.PointLight[];
  updateBoats: (elapsed: number) => void;
}

function createDragonBoat(
  mats: HueMaterialSet,
  lanterns: LanternHandle[],
): THREE.Group {
  const boat = new THREE.Group();

  // Elongated curved timber hull
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.95, 2.75),
    mats.goLimAged,
  );
  hull.position.y = 0.28;
  hull.castShadow = true;
  hull.receiveShadow = true;
  boat.add(hull);

  // Tapered bow & stern prows
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.42, 3.2, 4), mats.goLimLacquered);
  bow.rotation.z = -Math.PI * 0.5;
  bow.rotation.x = Math.PI * 0.25;
  bow.scale.set(0.65, 1, 1.0);
  bow.position.set(7.5, 0.45, 0);
  boat.add(bow);

  const stern = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 4), mats.goLimAged);
  stern.rotation.z = Math.PI * 0.5;
  stern.rotation.x = Math.PI * 0.25;
  stern.scale.set(0.65, 1, 1.0);
  stern.position.set(-7.2, 0.45, 0);
  boat.add(stern);

  // Twin Sculpted Gilt Dragon Heads at Bow ("Song Long")
  for (const sz of [-0.68, 0.68]) {
    const dragonNeck = createCornerDragonFinial(mats.giltBronze, 1.05);
    dragonNeck.rotation.y = Math.PI * 0.5;
    dragonNeck.position.set(7.6, 0.85, sz);
    boat.add(dragonNeck);
  }

  // Arched Woven-Bamboo & Lacquered Timber Cabin ("Khoang Thuyền Rồng")
  const cabinRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 7.2, 12, 1, true, 0, Math.PI),
    mats.bambooWoven,
  );
  cabinRoof.rotation.z = Math.PI * 0.5;
  cabinRoof.rotation.x = -Math.PI * 0.5;
  cabinRoof.position.set(-0.2, 1.32, 0);
  cabinRoof.castShadow = true;
  if ('side' in mats.bambooWoven) {
    mats.bambooWoven.side = THREE.DoubleSide;
  }
  boat.add(cabinRoof);

  // Vermilion cabin arch trim & side windows
  for (const sx of [-3.7, 3.3]) {
    const archTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.08, 6, 14, Math.PI),
      mats.goLimLacquered,
    );
    archTrim.rotation.y = Math.PI * 0.5;
    archTrim.position.set(sx, 1.32, 0);
    boat.add(archTrim);
  }

  for (const sz of [-1.22, 1.22]) {
    for (let cx = -2.8; cx <= 2.4; cx += 1.7) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 6), mats.goLimLacquered);
      post.position.set(cx, 1.25, sz);
      boat.add(post);
    }
  }

  // Glowing bow & cabin lanterns
  const bowL = createHueLantern(lanterns, 0.72, true);
  bowL.position.set(6.1, 1.75, 0);
  boat.add(bowL);

  const cabinL = createHueLantern(lanterns, 0.68, false);
  cabinL.position.set(-0.2, 2.2, 0);
  boat.add(cabinL);

  return boat;
}

export function buildKimLongGardenAndBoats(mats: HueMaterialSet): KimLongAndBoatsResult {
  const root = new THREE.Group();
  root.name = 'KimLongGardenAndBoats';
  const lanterns: LanternHandle[] = [];

  // -------------------------------------------------------------------------
  // 1. NHÀ VƯỜN KIM LONG (-45, 3.2, -108)
  // -------------------------------------------------------------------------
  const garden = new THREE.Group();
  garden.position.set(-45, 3.2, -108);

  // Mossy Perimeter Garden Wall & Arched Gate facing South (+Z) toward River
  for (const side of [-1, 1]) {
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(11.0, 2.1, 0.55), mats.hueLimeWall);
    frontWall.position.set(side * 7.6, 1.05, 11.5);
    frontWall.castShadow = true;
    garden.add(frontWall);

    const tileCap = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.22, 0.78), mats.ngoiTerracotta);
    tileCap.position.set(side * 7.6, 2.18, 11.5);
    garden.add(tileCap);
  }

  // Arched Gate ("Cổng Vòm Gạch Rêu")
  for (const sx of [-1.75, 1.75]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.3, 0.8), mats.hueBrick);
    post.position.set(sx, 1.65, 11.5);
    post.castShadow = true;
    garden.add(post);
  }
  const gateTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 0.85), mats.hueLimeRose);
  gateTop.position.set(0, 3.35, 11.5);
  garden.add(gateTop);
  const gateRoof = createSweepingHueRoof(5.4, 2.2, 1.05, {
    eaveLift: 0.25,
    tileMat: mats.ngoiTerracotta,
    trimMat: mats.hueLimeWall,
  });
  gateRoof.position.set(0, 3.75, 11.5);
  garden.add(gateRoof);

  // Ceramic Dragon Bình Phong Spirit Screen directly inside gate (z = +6.5)
  const binhPhong = new THREE.Group();
  binhPhong.position.set(0, 0, 6.2);
  const bpBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 0.72), mats.daThanh);
  bpBase.position.y = 0.225;
  binhPhong.add(bpBase);
  const bpPanel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.3, 0.44), mats.hueLimeWall);
  bpPanel.position.y = 1.6;
  bpPanel.castShadow = true;
  binhPhong.add(bpPanel);
  const bpMosaic = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.6, 0.48), mats.porcelainMosaicWall);
  bpMosaic.position.y = 1.6;
  binhPhong.add(bpMosaic);
  const bpCap = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 0.68), mats.ngoiTerracotta);
  bpCap.position.y = 2.85;
  binhPhong.add(bpCap);
  garden.add(binhPhong);

  // Main Nhà Rường 3 Gian 2 Chái (z = -2.5)
  const house = new THREE.Group();
  house.position.set(0, 0, -2.5);
  const hPlinth = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.65, 10.6), mats.daThanh);
  hPlinth.position.y = 0.325;
  hPlinth.receiveShadow = true;
  house.add(hPlinth);

  const hBody = new THREE.Mesh(new THREE.BoxGeometry(14.5, 3.2, 7.6), mats.goLimLacquered);
  hBody.position.set(0, 2.25, -0.5);
  hBody.castShadow = true;
  house.add(hBody);

  for (let i = -3; i <= 3; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 3.2, 8), mats.goLimAged);
    col.position.set(i * 2.25, 2.25, 4.1);
    col.castShadow = true;
    house.add(col);
  }

  const hRoof = createSweepingHueRoof(17.8, 11.4, 2.85, {
    ridgeLength: 8.6,
    eaveLift: 0.42,
    tileMat: mats.ngoiTerracotta,
    trimMat: mats.hueLimeWall,
    finialMat: mats.porcelainMosaicWall,
    addDragonCrest: true,
  });
  hRoof.position.set(0, 3.75, 0);
  house.add(hRoof);

  const hLantern = createHueLantern(lanterns, 0.9, true);
  hLantern.position.set(0, 3.2, 4.4);
  house.add(hLantern);

  garden.add(house);

  // Stone Garden Well & Lotus Basin ("Hồ Non Bộ")
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.85, 0.72, 14), mats.daHocMortar);
  well.position.set(6.5, 0.36, 4.5);
  garden.add(well);

  root.add(garden);

  // -------------------------------------------------------------------------
  // 2. ĐỒI VỌNG CẢNH SCENIC LOOKOUT TERRACE (-220, 18.8, +94)
  // -------------------------------------------------------------------------
  const vongCanh = new THREE.Group();
  vongCanh.position.set(-220, 18.8, 94);

  const vcDeck = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.55, 8), mats.daThanh);
  vcDeck.position.y = 0.25;
  vcDeck.receiveShadow = true;
  vongCanh.add(vcDeck);

  // Stone lookout rail posts facing the river (-Z)
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.42 + (i / 5) * Math.PI * 0.84 + Math.PI;
    const px = Math.sin(a) * 6.6;
    const pz = Math.cos(a) * 6.6;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.05, 0.36), mats.daThanh);
    post.position.set(px, 0.95, pz);
    post.castShadow = true;
    vongCanh.add(post);

    if (i === 0 || i === 5) {
      const l = createHueLantern(lanterns, 0.8, true);
      l.position.set(px, 1.78, pz);
      vongCanh.add(l);
    }
  }
  for (const bx of [-3.0, 3.0]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.68), mats.daThanh);
    bench.position.set(bx, 0.72, 2.2);
    bench.castShadow = true;
    vongCanh.add(bench);
  }
  root.add(vongCanh);

  // -------------------------------------------------------------------------
  // 3. THUYỀN RỒNG SÔNG HƯƠNG (2 Animated Royal Dragon Boats)
  // -------------------------------------------------------------------------
  const boats: DragonBoatHandle[] = [];
  const boatConfigs: { baseX: number; speed: number; direction: 1 | -1; offsetZ: number }[] = [
    { baseX: -120, speed: 4.8, direction: 1, offsetZ: -6 },
    { baseX: 110, speed: 4.1, direction: -1, offsetZ: 8 },
  ];

  boatConfigs.forEach((cfg) => {
    const bMesh = createDragonBoat(mats, lanterns);
    root.add(bMesh);
    boats.push({
      group: bMesh,
      ...cfg,
    });
  });

  // -------------------------------------------------------------------------
  // 4. ĐÈN HOA ĐĂNG SÔNG HƯƠNG (Floating Paper Lotus Lanterns for Dusk & Night)
  // -------------------------------------------------------------------------
  const hoaDangGroup = new THREE.Group();
  const hoaDangLights: THREE.PointLight[] = [];
  const hdColors = [0xffa94d, 0xff6b8b, 0xffe066, 0xff8c5a];
  const hdGeo = new THREE.CylinderGeometry(0.28, 0.12, 0.22, 6);

  for (let i = 0; i < 48; i++) {
    const rx = -240 + (i / 48) * 460 + Math.sin(i * 4.3) * 14;
    const rz = getRiverCenterZ(rx) + Math.cos(i * 7.1) * 24;
    const mat = new THREE.MeshStandardMaterial({
      color: hdColors[i % hdColors.length],
      emissive: hdColors[i % hdColors.length],
      emissiveIntensity: 1.5,
      roughness: 0.4,
    });
    const lantern = new THREE.Mesh(hdGeo, mat);
    lantern.position.set(rx, 0.08, rz);
    lantern.userData = { baseX: rx, phase: i * 0.9 };
    hoaDangGroup.add(lantern);

    if (i % 12 === 0) {
      const pt = new THREE.PointLight(0xffaa55, 1.8, 12, 1.8);
      pt.position.set(rx, 0.5, rz);
      hoaDangGroup.add(pt);
      hoaDangLights.push(pt);
    }
  }
  root.add(hoaDangGroup);

  const updateBoats = (elapsed: number) => {
    for (const b of boats) {
      // Smoothly loop along Sông Hương between x = -300 and +300
      const span = 600;
      const raw = (b.baseX + elapsed * b.speed * b.direction + 300) % span;
      const x = (raw < 0 ? raw + span : raw) - 300;
      const z = getRiverCenterZ(x) + b.offsetZ;

      const dx = 2.0 * b.direction;
      const nextZ = getRiverCenterZ(x + dx) + b.offsetZ;
      const yaw = Math.atan2(-(nextZ - z), dx);

      b.group.position.set(x, Math.sin(elapsed * 1.4 + b.baseX) * 0.06, z);
      b.group.rotation.y = yaw;
      b.group.rotation.z = Math.sin(elapsed * 1.1 + b.baseX) * 0.018;
      b.group.rotation.x = Math.cos(elapsed * 1.3 + b.baseX) * 0.014;
    }

    // Gentle drift of Hoa Đăng lanterns
    hoaDangGroup.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.userData.baseX !== undefined) {
        const bx = child.userData.baseX as number;
        const ph = child.userData.phase as number;
        const driftX = ((bx + elapsed * 0.55 + 240) % 480) - 240;
        child.position.x = driftX;
        child.position.y = 0.07 + Math.sin(elapsed * 1.8 + ph) * 0.02;
        child.rotation.y = elapsed * 0.4 + ph;
      }
    });
  };

  // Initialize boat positions cleanly before first render
  updateBoats(0);

  return {
    group: root,
    boats,
    lanterns,
    hoaDangGroup,
    hoaDangLights,
    updateBoats,
  };
}
