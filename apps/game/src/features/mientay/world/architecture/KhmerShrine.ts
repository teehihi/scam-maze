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
  createRoofRibs,
  createStainDecal,
} from '../detail/ArchitecturalDetail';

export interface KhmerShrineSystem {
  group: THREE.Group;
  update: (elapsedTime: number, nightFactor: number) => void;
  dispose: () => void;
}

export function createKhmerShrine(mats: MekongMaterialLibrary): KhmerShrineSystem {
  const group = new THREE.Group();
  group.name = 'MekongKhmerShrine';
  const disposables: Array<{ dispose: () => void }> = [];
  const shrineLights: THREE.PointLight[] = [];

  const creamStucco = mats.getLimeStucco('khmerCream', 1, 1);
  const graniteMat = mats.getStoneGranite(4, 1);
  const agedBrickMat = mats.getAgedBrick(3, 3);
  const khmerTileMat = mats.getKhmerTile(4, 3);
  const yinYangMat = mats.getYinYangTile(3, 2);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xdca832,
    metalness: 0.72,
    roughness: 0.28,
  });
  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0x8e1f18,
    roughness: 0.45,
  });
  const nagaGreenMat = new THREE.MeshStandardMaterial({
    color: 0x2c6b47,
    roughness: 0.42,
    metalness: 0.2,
  });
  const buddhaGoldMat = new THREE.MeshStandardMaterial({
    color: 0xe8b938,
    metalness: 0.8,
    roughness: 0.24,
  });
  const candleMat = new THREE.MeshStandardMaterial({
    color: 0xffe49e,
    emissive: new THREE.Color(0xff8420),
    emissiveIntensity: 0.9,
  });
  disposables.push(
    goldMat,
    crimsonMat,
    nagaGreenMat,
    buddhaGoldMat,
    candleMat,
  );

  const baseY = 1.74;
  const cx = -57;
  const cz = 8;

  // --------------------------------------------------------------------------
  // 1. Pagoda Courtyard Plaza & 3-Tier Sanctuary Terrace
  // --------------------------------------------------------------------------
  const pagoda = new THREE.Group();

  const plazaFloor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.14, 24), graniteMat);
  plazaFloor.position.set(0, 0.04, 0);
  plazaFloor.receiveShadow = true;
  pagoda.add(plazaFloor);
  registerWalkableBox('khmer-plaza', cx - 12, cx + 12, cz - 12, cz + 12, baseY + 0.11);

  // 3 stepped terrace tiers
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.42, 18.6), creamStucco);
  tier1.position.set(-1.0, 0.21, 0);
  tier1.castShadow = tier1.receiveShadow = true;

  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.44, 16.4), creamStucco);
  tier2.position.set(-1.0, 0.64, 0);
  tier2.castShadow = tier2.receiveShadow = true;

  const tier3 = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.44, 14.4), creamStucco);
  tier3.position.set(-1.0, 1.08, 0);
  tier3.castShadow = tier3.receiveShadow = true;

  pagoda.add(tier1, tier2, tier3);
  const terraceTopY = 1.3;
  registerWalkableBox('khmer-terrace', cx - 6.4, cx + 4.4, cz - 7.2, cz + 7.2, baseY + terraceTopY);

  // Lotus boundary bollards ("Cột Sema / Búp Sen") framing the terrace
  for (let i = -3; i <= 3; i++) {
    for (const bx of [-6.0, 4.0]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.28), creamStucco);
      post.position.set(bx, terraceTopY + 0.36, i * 2.15);
      const lotusTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 6), goldMat);
      lotusTip.position.set(bx, terraceTopY + 0.88, i * 2.15);
      pagoda.add(post, lotusTip);
    }
  }

  // East Grand Staircase (+X facing river!) with Twin Naga Serpent Balustrades
  for (let st = 0; st < 7; st++) {
    const t = st / 6;
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.19, 3.2), graniteMat);
    step.position.set(6.8 - t * 2.5, 0.1 + t * (terraceTopY - 0.15), 0);
    step.castShadow = step.receiveShadow = true;
    pagoda.add(step);
  }
  registerWalkableSlope(
    'khmer-east-stairs',
    cx + 4.3,
    cx + 7.1,
    cz - 1.6,
    cz + 1.6,
    (x) => {
      const t = clamp((cx + 7.0 - x) / 2.7, 0, 1);
      return baseY + 0.11 + t * (terraceTopY - 0.11);
    },
  );

  // Sculpted Naga Serpent Railings along stairs
  for (const side of [-1, 1]) {
    const railPts = [
      new THREE.Vector3(7.1, 0.45, side * 1.75),
      new THREE.Vector3(5.6, 0.92, side * 1.75),
      new THREE.Vector3(4.3, terraceTopY + 0.35, side * 1.75),
    ];
    const curve = new THREE.CatmullRomCurve3(railPts);
    const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.15, 7, false), nagaGreenMat);
    body.castShadow = true;

    // Sculpted 7-headed Khmer Naga fan hood & upright serpent neck at stair base
    const nagaHeadGroup = new THREE.Group();
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.75, 8), nagaGreenMat);
    neck.position.set(0, 0.36, 0);
    neck.rotation.z = -0.18;
    const fanBack = new THREE.Mesh(new THREE.CircleGeometry(0.48, 12, 0, Math.PI), goldMat);
    fanBack.rotation.y = Math.PI / 2;
    fanBack.position.set(-0.04, 0.72, 0);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 6, 12), goldMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0.02, 0.56, 0);
    nagaHeadGroup.add(neck, fanBack, collar);
    // 7 small crowned Naga serpent heads arranged along the fan arc
    for (let nh = -3; nh <= 3; nh++) {
      const ang = nh * 0.36;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 6), goldMat);
      head.position.set(0.03, 0.72 + Math.cos(ang) * 0.44, Math.sin(ang) * 0.44);
      head.rotation.x = ang;
      head.rotation.z = -0.25;
      nagaHeadGroup.add(head);
    }
    nagaHeadGroup.position.set(7.25, 0.35, side * 1.75);
    pagoda.add(body, nagaHeadGroup);
  }

  // --------------------------------------------------------------------------
  // 2. Crimson & Gold Lacquered Sanctuary Columns + Inner Chamber
  // --------------------------------------------------------------------------
  const colH = 4.6;
  const colPositions: Array<[number, number]> = [];
  for (const ix of [-4.4, -2.2, 0.2, 2.6]) {
    for (const iz of [-5.2, -2.6, 2.6, 5.2]) {
      colPositions.push([ix, iz]);
    }
  }
  // Portico columns at +X entrance
  colPositions.push([2.6, -1.6], [2.6, 1.6], [-4.4, -1.6], [-4.4, 1.6]);

  for (const [px, pz] of colPositions) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.36, 10), goldMat);
    base.position.set(px, terraceTopY + 0.18, pz);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, colH, 10), crimsonMat);
    shaft.position.set(px, terraceTopY + 0.36 + colH * 0.5, pz);
    shaft.castShadow = shaft.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.32, 10), goldMat);
    cap.position.set(px, terraceTopY + colH + 0.45, pz);
    // Krud/Kâyno gilded bracket arm under roof eaves on outer columns
    if (Math.abs(px) > 2.4 || Math.abs(pz) > 4.5) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.16), goldMat);
      bracket.position.set(px + (px > 0 ? 0.28 : -0.28), terraceTopY + colH + 0.18, pz);
      bracket.rotation.z = px > 0 ? -0.55 : 0.55;
      pagoda.add(bracket);
    }
    pagoda.add(base, shaft, cap);
  }

  // Sanctuary Inner Walls (with wide open East sanctuary portal)
  const cellaW = 5.4;
  const cellaD = 8.4;
  const cellaX = -1.1;
  const cellaBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, colH, cellaD), creamStucco);
  cellaBack.position.set(cellaX - cellaW * 0.5, terraceTopY + colH * 0.5, 0);
  cellaBack.castShadow = cellaBack.receiveShadow = true;
  pagoda.add(cellaBack);

  for (const side of [-1, 1]) {
    const sWall = new THREE.Mesh(new THREE.BoxGeometry(cellaW, colH, 0.36), creamStucco);
    sWall.position.set(cellaX, terraceTopY + colH * 0.5, side * (cellaD * 0.5));
    sWall.castShadow = sWall.receiveShadow = true;
    pagoda.add(sWall);

    // Recessed gilded Khmer window frames on side walls
    for (const wz of [-2.2, 2.2]) {
      const wFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.85, 0.42), goldMat);
      wFrame.position.set(cellaX + wz * 0.55, terraceTopY + 2.2, side * (cellaD * 0.5));
      const wFill = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.55, 0.44), crimsonMat);
      wFill.position.copy(wFrame.position);
      pagoda.add(wFrame, wFill);
    }
  }

  // East Sanctuary Portal framing gilded Seated Buddha inside!
  for (const side of [-1, 1]) {
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(0.36, colH, 2.5), creamStucco);
    frontWing.position.set(cellaX + cellaW * 0.5, terraceTopY + colH * 0.5, side * 3.0);
    pagoda.add(frontWing);
  }
  const portalArch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.25, 4.2), goldMat);
  portalArch.position.set(cellaX + cellaW * 0.5, terraceTopY + colH - 0.55, 0);
  pagoda.add(portalArch);

  // Gilded Seated Buddha Statue on Lotus Pedestal inside sanctuary
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.9, 12), goldMat);
  pedestal.position.set(cellaX - 1.2, terraceTopY + 0.45, 0);
  const bodyB = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.55, 10), buddhaGoldMat);
  bodyB.position.set(cellaX - 1.2, terraceTopY + 1.65, 0);
  const headB = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), buddhaGoldMat);
  headB.position.set(cellaX - 1.2, terraceTopY + 2.55, 0);
  const ushnisha = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 6), buddhaGoldMat);
  ushnisha.position.set(cellaX - 1.2, terraceTopY + 2.95, 0);
  pagoda.add(pedestal, bodyB, headB, ushnisha);

  const altarLight = new THREE.PointLight(0xffa438, 1.5, 16, 1.6);
  altarLight.position.set(cellaX + 0.2, terraceTopY + 2.4, 0);
  pagoda.add(altarLight);
  shrineLights.push(altarLight);

  registerSolidCollider(cx - 4.2, cx + 1.8, cz - 4.4, cz + 4.4, baseY + terraceTopY + 5);

  // --------------------------------------------------------------------------
  // 3. 3-Tier Steep Khmer Glazed Roof + Naga Ridge Horns + Gilded Spire
  // --------------------------------------------------------------------------
  const roofBaseY = terraceTopY + colH + 0.5;
  const roofTiers = [
    { w: 9.8, d: 13.6, rise: 1.95, y: roofBaseY },
    { w: 7.4, d: 11.0, rise: 2.2, y: roofBaseY + 1.3 },
    { w: 4.8, d: 8.6, rise: 2.35, y: roofBaseY + 2.7 },
  ];

  roofTiers.forEach((rt, idx) => {
    const halfD = rt.d * 0.5;
    const slopeLen = Math.hypot(halfD, rt.rise);
    const pitch = Math.atan2(rt.rise, halfD);

    // Steep side slopes (angled across Z, ridge running East-West X!)
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(rt.w, 0.18, slopeLen), khmerTileMat);
      slope.position.set(-0.9, rt.y + rt.rise * 0.5, side * halfD * 0.5);
      slope.rotation.x = side * pitch;
      slope.castShadow = slope.receiveShadow = true;
      const ribs = createRoofRibs({
        slopeLength: slopeLen,
        roofDepth: rt.w,
        spacing: 0.44,
        radius: 0.045,
        material: goldMat,
        y: 0.1,
      });
      ribs.rotation.y = Math.PI / 2;
      slope.add(ribs);
      pagoda.add(slope);

      // Upturned curved Naga tail roof horn at corners!
      for (const ex of [-rt.w * 0.5, rt.w * 0.5]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.95, 5), goldMat);
        horn.position.set(-0.9 + ex, rt.y + 0.42, side * (halfD + 0.1));
        horn.rotation.x = side * 0.42;
        horn.rotation.z = ex < 0 ? 0.35 : -0.35;
        pagoda.add(horn);
      }
    }

    // Ornate Gilded Triangular Gable Pediment at East (+X) & West (-X) ends
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-halfD * 0.96, 0);
    gableShape.lineTo(halfD * 0.96, 0);
    gableShape.lineTo(0, rt.rise * 0.96);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.24, bevelEnabled: false });
    disposables.push(gableGeo);
    for (const gx of [-rt.w * 0.48, rt.w * 0.48]) {
      const gable = new THREE.Mesh(gableGeo, idx === 2 ? goldMat : crimsonMat);
      gable.rotation.y = Math.PI / 2;
      gable.position.set(-0.9 + gx - 0.12, rt.y + 0.02, 0);
      pagoda.add(gable);

      // Peak Naga finial horn
      const peakHorn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 5), goldMat);
      peakHorn.position.set(-0.9 + gx * 1.04, rt.y + rt.rise + 0.42, 0);
      peakHorn.rotation.z = gx > 0 ? -0.32 : 0.32;
      pagoda.add(peakHorn);
    }

    // Golden ridge spine
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(rt.w + 0.3, 0.28, 0.32), goldMat);
    ridge.position.set(-0.9, rt.y + rt.rise + 0.05, 0);
    pagoda.add(ridge);
  });

  // Tall Central Gilded Stupa Spire crowning the top roof
  const topPeakY = roofBaseY + 2.7 + 2.35;
  const spireBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), goldMat);
  spireBase.position.set(-0.9, topPeakY + 0.3, 0);
  const spireShaft = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 8), goldMat);
  spireShaft.position.set(-0.9, topPeakY + 2.35, 0);
  spireShaft.castShadow = true;
  pagoda.add(spireBase, spireShaft);

  pagoda.position.set(cx, baseY, cz);
  group.add(pagoda);

  // --------------------------------------------------------------------------
  // 4. Ancient Mossy Brick Stupa ("Tháp Cổ Rêu Phong") at (-55, 22.5)
  // --------------------------------------------------------------------------
  const stupa = new THREE.Group();
  const stupaTiers = [
    { w: 3.4, h: 1.2, y: 0.6 },
    { w: 2.6, h: 1.1, y: 1.75 },
    { w: 1.9, h: 1.4, y: 3.0 },
    { w: 1.2, h: 1.6, y: 4.5 },
  ];
  for (const st of stupaTiers) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.w), agedBrickMat);
    b.position.y = st.y;
    b.castShadow = b.receiveShadow = true;
    stupa.add(b);
    const corniceTier = new THREE.Mesh(
      new THREE.BoxGeometry(st.w + 0.14, 0.12, st.w + 0.14),
      creamStucco,
    );
    corniceTier.position.y = st.y + st.h * 0.5 - 0.04;
    stupa.add(corniceTier);
  }
  const stupaStain = createStainDecal(2.8, 1.15, 0.52);
  stupaStain.position.set(0, 0.65, 1.72);
  stupa.add(stupaStain);
  const stupaTip = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 8), goldMat);
  stupaTip.position.y = 6.1;
  stupa.add(stupaTip);
  stupa.position.set(-55, sampleTerrainHeight(-55, 22.5), 22.5);
  group.add(stupa);
  registerSolidCollider(-57, -53, 20.5, 24.5, 9);

  // --------------------------------------------------------------------------
  // 5. West Bank Stone River Landing ("Bến Thuyền Chùa") at x: -42..-31, z: 6..12
  // --------------------------------------------------------------------------
  const landing = new THREE.Group();
  for (let s = 0; s < 9; s++) {
    const t = s / 8;
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 4.2), graniteMat);
    step.position.set(lerp(-41.5, -32.2, t), lerp(1.74, -0.15, t), 9.0);
    step.castShadow = step.receiveShadow = true;
    landing.add(step);
  }
  group.add(landing);
  registerWalkableSlope('west-temple-landing', -42.0, -32.0, 6.8, 11.2, (x) => {
    const t = clamp((x + 41.5) / 9.3, 0, 1);
    return lerp(1.85, 0.15, t);
  });

  // --------------------------------------------------------------------------
  // 6. Small Red River Shrine ("Miếu Bà Cây Đa") under Ancient Banyan (-40.5, -10.5)
  // --------------------------------------------------------------------------
  const mieu = new THREE.Group();
  const mx = -40.5;
  const mz = -10.5;
  const my = sampleTerrainHeight(mx, mz);

  const mBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 2.2), agedBrickMat);
  mBase.position.y = 0.22;
  const mBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.45, 1.6), crimsonMat);
  mBody.position.y = 1.15;
  mBody.castShadow = true;
  const mRoof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 4), yinYangMat);
  mRoof.rotation.y = Math.PI / 4;
  mRoof.position.y = 2.35;
  mRoof.castShadow = true;
  const mFinial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), goldMat);
  mFinial.position.y = 2.9;

  // Stone incense burner + glowing red candle + curling incense smoke wisps!
  const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.34, 10), graniteMat);
  urn.position.set(1.05, 0.58, 0);
  for (let inc = 0; inc < 5; inc++) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), crimsonMat);
    stick.position.set(1.05 + (inc - 2) * 0.018, 0.82, (inc % 2 - 0.5) * 0.03);
    stick.rotation.z = (inc - 2) * 0.06;
    mieu.add(stick);
  }

  const candle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), candleMat);
  candle.position.set(0.84, 0.88, 0.22);
  const mLight = new THREE.PointLight(0xff7426, 1.2, 9, 1.8);
  mLight.position.set(1.0, 1.1, 0);
  shrineLights.push(mLight);

  const incPos = new Float32Array(14 * 3);
  const incPhase = new Float32Array(14);
  for (let w = 0; w < 14; w++) {
    incPos[w * 3] = 1.05;
    incPos[w * 3 + 1] = 0.85;
    incPos[w * 3 + 2] = 0;
    incPhase[w] = w / 14;
  }
  const incGeo = new THREE.BufferGeometry();
  incGeo.setAttribute('position', new THREE.BufferAttribute(incPos, 3));
  incGeo.setAttribute('aPhase', new THREE.BufferAttribute(incPhase, 1));
  const incMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      varying float vLife;
      void main() {
        float life = fract(uTime * 0.22 + aPhase);
        vLife = life;
        vec3 p = position;
        p.y += life * 2.1;
        p.x += sin(uTime * 1.5 + aPhase * 12.0) * (0.04 + life * 0.14);
        p.z += cos(uTime * 1.2 + aPhase * 9.0) * (0.03 + life * 0.12);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((16.0 + life * 28.0) / max(-mv.z, 1.0), 2.0, 18.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        float puff = exp(-d * d * 3.5);
        gl_FragColor = vec4(0.86, 0.88, 0.9, puff * sin(vLife * 3.14159) * 0.22);
      }
    `,
  });
  const incPoints = new THREE.Points(incGeo, incMat);
  incPoints.frustumCulled = false;
  disposables.push(incGeo, incMat);

  mieu.add(mBase, mBody, mRoof, mFinial, urn, candle, mLight, incPoints);
  mieu.position.set(mx, my, mz);
  group.add(mieu);

  return {
    group,
    update: (elapsedTime: number, nightFactor: number) => {
      incMat.uniforms.uTime.value = elapsedTime;

      const lPow = lerp(0.8, 3.8, nightFactor) + Math.sin(elapsedTime * 7.5) * 0.14;
      for (const l of shrineLights) {
        l.intensity = lPow;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
