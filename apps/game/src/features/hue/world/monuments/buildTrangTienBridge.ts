import * as THREE from 'three';
import type { HueMaterialSet } from '../../engine/materials/HueMaterialFoundry';
import { createHueLantern } from './hueArchitecturalHelpers';
import type { LanternHandle } from './hueArchitecturalHelpers';

export interface TrangTienBuildResult {
  group: THREE.Group;
  lanterns: LanternHandle[];
}

function addStrut(
  parent: THREE.Object3D,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  thickness: number,
  mat: THREE.Material,
) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (len < 0.01) return;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, len, thickness),
    mat,
  );
  mesh.position.copy(p0).add(p1).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
}

export function buildTrangTienBridge(mats: HueMaterialSet): TrangTienBuildResult {
  const root = new THREE.Group();
  root.name = 'TrangTienBridge';
  const lanterns: LanternHandle[] = [];

  const CX = 195;
  const SPAN_COUNT = 6;
  const SPAN_LEN = 22.0; // Total 132m (-66 to +66)
  const START_Z = -66.0;
  const ROAD_HALF_W = 2.9;
  const WALK_OUTER_W = 4.25;

  const deckYAtZ = (z: number) => {
    const t = Math.abs(z) / 72;
    return 6.85 - t * t * 0.35;
  };

  // -------------------------------------------------------------------------
  // 1. Stone Cutwater River Piers (7 piers at span joints) & Approach Abutments
  // -------------------------------------------------------------------------
  for (let p = 0; p <= SPAN_COUNT; p++) {
    const pz = START_Z + p * SPAN_LEN;
    const isAbutment = p === 0 || p === SPAN_COUNT;
    const pier = new THREE.Group();
    pier.position.set(CX, 0, pz);

    const pierW = isAbutment ? 9.6 : 7.8;
    const pierZ = isAbutment ? 4.2 : 2.3;
    const pierH = 11.4; // y = -4.8 to +6.6

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(pierW, pierH, pierZ),
      mats.daHocMortar,
    );
    body.position.y = 0.85;
    body.castShadow = true;
    body.receiveShadow = true;
    pier.add(body);

    // Rounded semi-cylindrical upstream/downstream cutwaters
    for (const sx of [-1, 1]) {
      const cutwater = new THREE.Mesh(
        new THREE.CylinderGeometry(pierZ * 0.5, pierZ * 0.55, pierH, 12),
        mats.daHocMortar,
      );
      cutwater.position.set(sx * pierW * 0.5, 0.85, 0);
      cutwater.castShadow = true;
      pier.add(cutwater);
    }

    // Dressed Đá Thanh bearing cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(pierW + 1.3, 0.55, pierZ + 0.65),
      mats.daThanh,
    );
    cap.position.y = deckYAtZ(pz) - 0.35;
    cap.receiveShadow = true;
    pier.add(cap);

    root.add(pier);
  }

  // Approach stone masonry ramps connecting piers to North (-74..-66) and South (66..74) banks
  for (const dir of [-1, 1]) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 4.6, 10.5),
      mats.daHocMortar,
    );
    ramp.position.set(CX, 4.25, dir * 70.5);
    ramp.receiveShadow = true;
    root.add(ramp);

    const rampDeck = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.25, 10.8),
      mats.daThanhStairs,
    );
    rampDeck.position.set(CX, 6.55, dir * 70.5);
    rampDeck.receiveShadow = true;
    root.add(rampDeck);
  }

  // -------------------------------------------------------------------------
  // 2. Six Parabolic ("Vành Lược") Eiffel Steel Truss Spans + 1937 Balconies
  // -------------------------------------------------------------------------
  for (let s = 0; s < SPAN_COUNT; s++) {
    const z0 = START_Z + s * SPAN_LEN;
    const z1 = z0 + SPAN_LEN;
    const zMid = (z0 + z1) * 0.5;
    const spanGroup = new THREE.Group();
    spanGroup.position.set(CX, 0, zMid);

    // Main roadway & side cantilevered pedestrian walkway deck planks
    const dY = deckYAtZ(zMid);
    const roadSlab = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_HALF_W * 2, 0.26, SPAN_LEN + 0.05),
      mats.daThanhStairs,
    );
    roadSlab.position.y = dY - 0.13;
    roadSlab.receiveShadow = true;
    spanGroup.add(roadSlab);

    for (const side of [-1, 1]) {
      const walkDeck = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.18, SPAN_LEN + 0.05),
        mats.goLimAged,
      );
      walkDeck.position.set(side * (ROAD_HALF_W + 0.68), dY - 0.08, 0);
      walkDeck.receiveShadow = true;
      spanGroup.add(walkDeck);

      // Cantilevered triangular steel brackets beneath pedestrian balconies (exact from trang_tien.jpg!)
      const bays = 8;
      for (let b = 0; b <= bays; b++) {
        const bz = (b / bays - 0.5) * SPAN_LEN;
        addStrut(
          spanGroup,
          new THREE.Vector3(side * ROAD_HALF_W, dY - 1.15, bz),
          new THREE.Vector3(side * WALK_OUTER_W, dY - 0.15, bz),
          0.1,
          mats.eiffelSilverSteel,
        );
        addStrut(
          spanGroup,
          new THREE.Vector3(side * ROAD_HALF_W, dY - 0.15, bz),
          new THREE.Vector3(side * WALK_OUTER_W, dY - 0.15, bz),
          0.11,
          mats.eiffelSilverSteel,
        );

        // Outer wrought-iron pedestrian handrail post
        const railPost = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 1.05, 0.08),
          mats.eiffelWroughtIron,
        );
        railPost.position.set(side * (WALK_OUTER_W - 0.05), dY + 0.48, bz);
        spanGroup.add(railPost);
      }

      // Top & bottom continuous pedestrian iron railings
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.09, SPAN_LEN),
        mats.eiffelWroughtIron,
      );
      topRail.position.set(side * (WALK_OUTER_W - 0.05), dY + 1.0, 0);
      spanGroup.add(topRail);

      const midRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, SPAN_LEN),
        mats.eiffelWroughtIron,
      );
      midRail.position.set(side * (WALK_OUTER_W - 0.05), dY + 0.52, 0);
      spanGroup.add(midRail);
    }

    // Parabolic Camelback Truss Rib Network (8 panels per 22m span!)
    const PANELS = 8;
    const archPeak = 6.15; // rises +6.15m above deck at span center
    const endHeight = 1.45;

    const upperY = (u: number) => {
      // u in [-1, +1] -> smooth parabolic curve
      return dY + endHeight + (1 - u * u) * (archPeak - endHeight);
    };

    for (const side of [-1, 1]) {
      const tx = side * ROAD_HALF_W;
      // Lower chord beam
      const lowerChord = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.34, SPAN_LEN),
        mats.eiffelSilverSteel,
      );
      lowerChord.position.set(tx, dY - 0.05, 0);
      lowerChord.castShadow = true;
      spanGroup.add(lowerChord);

      for (let i = 0; i < PANELS; i++) {
        const zA = (i / PANELS - 0.5) * SPAN_LEN;
        const zB = ((i + 1) / PANELS - 0.5) * SPAN_LEN;
        const uA = zA / (SPAN_LEN * 0.5);
        const uB = zB / (SPAN_LEN * 0.5);
        const yA = upperY(uA);
        const yB = upperY(uB);

        // Upper curved chord segment
        addStrut(
          spanGroup,
          new THREE.Vector3(tx, yA, zA),
          new THREE.Vector3(tx, yB, zB),
          0.26,
          mats.eiffelSilverSteel,
        );

        // Vertical post at zA
        addStrut(
          spanGroup,
          new THREE.Vector3(tx, dY, zA),
          new THREE.Vector3(tx, yA, zA),
          0.17,
          mats.eiffelSilverSteel,
        );

        // Double Pratt-Warren X diagonals inside each panel for authentic Eiffel lattice!
        addStrut(
          spanGroup,
          new THREE.Vector3(tx, dY, zA),
          new THREE.Vector3(tx, yB, zB),
          0.11,
          mats.eiffelSilverSteel,
        );
        addStrut(
          spanGroup,
          new THREE.Vector3(tx, yA, zA),
          new THREE.Vector3(tx, dY, zB),
          0.11,
          mats.eiffelSilverSteel,
        );
      }
      // Final end vertical post
      addStrut(
        spanGroup,
        new THREE.Vector3(tx, dY, SPAN_LEN * 0.5),
        new THREE.Vector3(tx, upperY(1), SPAN_LEN * 0.5),
        0.22,
        mats.eiffelSilverSteel,
      );
    }

    // Overhead Cross-Bracing Portals connecting Left & Right Parabolic Chords
    for (let i = 1; i < PANELS; i++) {
      const bz = (i / PANELS - 0.5) * SPAN_LEN;
      const uy = upperY(bz / (SPAN_LEN * 0.5));
      if (uy - dY < 3.7) continue; // Keep full headroom clearance for walking/vehicles!

      addStrut(
        spanGroup,
        new THREE.Vector3(-ROAD_HALF_W, uy, bz),
        new THREE.Vector3(ROAD_HALF_W, uy, bz),
        0.18,
        mats.eiffelSilverSteel,
      );

      // Diagonal overhead wind X-bracing to next panel
      if (i < PANELS - 1) {
        const nz = ((i + 1) / PANELS - 0.5) * SPAN_LEN;
        const nuy = upperY(nz / (SPAN_LEN * 0.5));
        if (nuy - dY >= 3.7) {
          addStrut(
            spanGroup,
            new THREE.Vector3(-ROAD_HALF_W, uy, bz),
            new THREE.Vector3(ROAD_HALF_W, nuy, nz),
            0.1,
            mats.eiffelSilverSteel,
          );
          addStrut(
            spanGroup,
            new THREE.Vector3(ROAD_HALF_W, uy, bz),
            new THREE.Vector3(-ROAD_HALF_W, nuy, nz),
            0.1,
            mats.eiffelSilverSteel,
          );
        }
      }
    }

    // Vintage Bridge Lantern Posts at Pier Balconies
    const lamp = createHueLantern(lanterns, 0.78, s % 2 === 0);
    lamp.position.set(-WALK_OUTER_W + 0.1, dY + 2.55, -SPAN_LEN * 0.5);
    spanGroup.add(lamp);

    const lampPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
      mats.eiffelWroughtIron,
    );
    lampPost.position.set(-WALK_OUTER_W + 0.1, dY + 1.25, -SPAN_LEN * 0.5);
    spanGroup.add(lampPost);

    root.add(spanGroup);
  }

  // -------------------------------------------------------------------------
  // 3. Bến Ngự / Riverside Stone Quay Promenade along South Bank (z ~ +68)
  // -------------------------------------------------------------------------
  const quay = new THREE.Mesh(new THREE.BoxGeometry(68, 2.5, 5.2), mats.daHocMortar);
  quay.position.set(CX - 46, 1.0, 64);
  quay.receiveShadow = true;
  root.add(quay);

  const quayTop = new THREE.Mesh(new THREE.BoxGeometry(68.4, 0.25, 5.5), mats.daThanh);
  quayTop.position.set(CX - 46, 2.35, 64);
  quayTop.receiveShadow = true;
  root.add(quayTop);

  for (let lx = -72; lx <= -18; lx += 13.5) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.45), mats.daThanh);
    post.position.set(CX + lx, 3.1, 61.7);
    root.add(post);
    const l = createHueLantern(lanterns, 0.8, false);
    l.position.set(CX + lx, 4.05, 61.7);
    root.add(l);
  }

  return { group: root, lanterns };
}
