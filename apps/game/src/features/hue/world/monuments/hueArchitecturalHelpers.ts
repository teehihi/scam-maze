import * as THREE from 'three';

export interface LanternHandle {
  mat: THREE.MeshStandardMaterial;
  light?: THREE.PointLight;
  baseIntensity: number;
}

/**
 * Generates a concave sweeping 4-slope rectangular Vietnamese roof ("mái đao cong")
 * with UV coordinates aligned along tile courses and upturned corner eaves.
 */
export function createSweepingHueRoof(
  width: number,
  depth: number,
  height: number,
  options: {
    ridgeLength?: number;
    eaveLift?: number;
    tileMat: THREE.Material;
    trimMat: THREE.Material;
    finialMat?: THREE.Material;
    addDragonCrest?: boolean;
    segX?: number;
    segZ?: number;
  },
): THREE.Group {
  const group = new THREE.Group();
  const ridgeLength = options.ridgeLength ?? Math.max(0.2, width - depth * 0.72);
  const eaveLift = options.eaveLift ?? 0.34;
  const segU = options.segX ?? 12;
  const segV = options.segZ ?? 10;

  const hw = width * 0.5;
  const hd = depth * 0.5;
  const hr = ridgeLength * 0.5;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertCount = 0;

  // Helper to build a single bilinear-interpolated concave curved slope face
  const addSlope = (
    p00: THREE.Vector3,
    p10: THREE.Vector3,
    p01: THREE.Vector3,
    p11: THREE.Vector3,
    uScale: number,
    vScale: number,
    flip = false,
  ) => {
    const startIdx = vertCount;
    for (let j = 0; j <= segV; j++) {
      const v = j / segV; // 0 = eave, 1 = ridge
      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        const bx = THREE.MathUtils.lerp(p00.x, p10.x, u);
        const by = THREE.MathUtils.lerp(p00.y, p10.y, u);
        const bz = THREE.MathUtils.lerp(p00.z, p10.z, u);

        const tx = THREE.MathUtils.lerp(p01.x, p11.x, u);
        const ty = THREE.MathUtils.lerp(p01.y, p11.y, u);
        const tz = THREE.MathUtils.lerp(p01.z, p11.z, u);

        let x = THREE.MathUtils.lerp(bx, tx, v);
        let y = THREE.MathUtils.lerp(by, ty, v);
        let z = THREE.MathUtils.lerp(bz, tz, v);

        // Concave Vietnamese roof sag: drops smoothly in mid-slope
        const sag = Math.sin(v * Math.PI) * height * 0.16;
        y -= sag;

        // Upturned corner eave flare ("đao cong"): lifts corners near v=0, u=0 or u=1
        const cornerWeight = Math.pow(Math.abs(u - 0.5) * 2, 2.2) * Math.pow(1 - v, 2.0);
        y += cornerWeight * eaveLift;
        // Subtle outward flare at corners
        const flareOut = cornerWeight * 0.22;
        const rLen = Math.hypot(x, z) || 1;
        x += (x / rLen) * flareOut;
        z += (z / rLen) * flareOut;

        positions.push(x, y, z);
        uvs.push(u * uScale, v * vScale);
        vertCount++;
      }
    }

    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = startIdx + j * (segU + 1) + i;
        const b = a + 1;
        const c = a + (segU + 1);
        const d = c + 1;
        if (!flip) {
          indices.push(a, b, d, a, d, c);
        } else {
          indices.push(a, d, b, a, c, d);
        }
      }
    }
  };

  // Front (+Z), Back (-Z), Right (+X), Left (-X)
  addSlope(
    new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hr, height, 0),
    new THREE.Vector3(hr, height, 0),
    Math.max(1, width / 4),
    Math.max(1, depth / 4),
    false,
  );
  addSlope(
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(hr, height, 0),
    new THREE.Vector3(-hr, height, 0),
    Math.max(1, width / 4),
    Math.max(1, depth / 4),
    false,
  );
  addSlope(
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hr, height, 0),
    new THREE.Vector3(hr, height, 0),
    Math.max(1, depth / 4),
    Math.max(1, depth / 4),
    false,
  );
  addSlope(
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(-hr, height, 0),
    new THREE.Vector3(-hr, height, 0),
    Math.max(1, depth / 4),
    Math.max(1, depth / 4),
    false,
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // DoubleSide roof tile mesh with underside eaves plank backing
  const roofMesh = new THREE.Mesh(geo, options.tileMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  if ('side' in options.tileMat) {
    (options.tileMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  }
  group.add(roofMesh);

  // Horizontal ridge beam ("bờ nóc")
  const ridgeGeo = new THREE.BoxGeometry(ridgeLength + 0.35, 0.24, 0.24);
  const ridge = new THREE.Mesh(ridgeGeo, options.trimMat);
  ridge.position.set(0, height + 0.08, 0);
  ridge.castShadow = true;
  group.add(ridge);

  // Four hip ridge ribs + upturned corner "kìm nóc / cù dao" finials
  const corners = [
    [hw, hd, hr, 0],
    [-hw, hd, -hr, 0],
    [hw, -hd, hr, 0],
    [-hw, -hd, -hr, 0],
  ];
  for (const [cx, cz, rx, rz] of corners) {
    const start = new THREE.Vector3(cx * 1.01, eaveLift * 0.9, cz * 1.01);
    const mid = new THREE.Vector3(
      (cx + rx) * 0.5,
      height * 0.5 - height * 0.14,
      (cz + rz) * 0.5,
    );
    const end = new THREE.Vector3(rx, height + 0.05, rz);
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const ribGeo = new THREE.TubeGeometry(curve, 12, 0.09, 6, false);
    const rib = new THREE.Mesh(ribGeo, options.trimMat);
    rib.castShadow = true;
    group.add(rib);

    // Upturned dragon-cloud corner finial
    const finial = createCornerDragonFinial(options.finialMat ?? options.trimMat, 0.36);
    finial.position.set(cx * 1.01, eaveLift * 0.85, cz * 1.01);
    finial.rotation.y = Math.atan2(cx, cz);
    group.add(finial);
  }

  // Optional ridge-end dragons ("hồi long") & central pearl/gourd
  if (options.addDragonCrest) {
    const fMat = options.finialMat ?? options.trimMat;
    const gourd = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.16, 0.12),
      new THREE.Vector2(0.07, 0.26),
      new THREE.Vector2(0.11, 0.38),
      new THREE.Vector2(0.02, 0.56),
    ], 12), fMat);
    gourd.position.set(0, height + 0.18, 0);
    gourd.castShadow = true;
    group.add(gourd);

    for (const dir of [-1, 1]) {
      const endDragon = createCornerDragonFinial(fMat, 0.48);
      endDragon.position.set(dir * (hr + 0.08), height + 0.16, 0);
      endDragon.rotation.y = dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      group.add(endDragon);
    }
  }

  return group;
}

/**
 * Generates an octagonal concave curved roof for Tháp Phước Duyên, Đình Hương Nguyện, and Lầu Lục Giác
 */
export function createOctagonalCurvedRoof(
  sides: number,
  outerRadius: number,
  innerRadius: number,
  height: number,
  eaveLift: number,
  tileMat: THREE.Material,
  finialMat: THREE.Material,
  finialScale = 0.35,
): THREE.Group {
  const group = new THREE.Group();
  const radialSegs = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vOffset = 0;

  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * Math.PI * 2 + Math.PI / sides;
    const a1 = ((s + 1) / sides) * Math.PI * 2 + Math.PI / sides;
    const p0x = Math.sin(a0) * outerRadius;
    const p0z = Math.cos(a0) * outerRadius;
    const p1x = Math.sin(a1) * outerRadius;
    const p1z = Math.cos(a1) * outerRadius;

    const t0x = Math.sin(a0) * innerRadius;
    const t0z = Math.cos(a0) * innerRadius;
    const t1x = Math.sin(a1) * innerRadius;
    const t1z = Math.cos(a1) * innerRadius;

    const segU = 6;
    const start = vOffset;
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs; // 0 = outer eave, 1 = upper neck
      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        const bx = THREE.MathUtils.lerp(p0x, p1x, u);
        const bz = THREE.MathUtils.lerp(p0z, p1z, u);
        const tx = THREE.MathUtils.lerp(t0x, t1x, u);
        const tz = THREE.MathUtils.lerp(t0z, t1z, u);

        const x = THREE.MathUtils.lerp(bx, tx, v);
        const z = THREE.MathUtils.lerp(bz, tz, v);
        let y = v * height - Math.sin(v * Math.PI) * height * 0.16;

        const cornerW = Math.pow(Math.abs(u - 0.5) * 2, 2.1) * Math.pow(1 - v, 1.8);
        y += cornerW * eaveLift;

        positions.push(x, y, z);
        uvs.push(u * 1.4, v * 1.2);
        vOffset++;
      }
    }

    for (let j = 0; j < radialSegs; j++) {
      for (let i = 0; i < segU; i++) {
        const a = start + j * (segU + 1) + i;
        const b = a + 1;
        const c = a + (segU + 1);
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    // Hip rib & corner cù dao finial
    const ribCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(p0x, eaveLift * 0.92, p0z),
      new THREE.Vector3((p0x + t0x) * 0.5, height * 0.42, (p0z + t0z) * 0.5),
      new THREE.Vector3(t0x, height + 0.02, t0z),
    );
    const rib = new THREE.Mesh(
      new THREE.TubeGeometry(ribCurve, 10, 0.065, 6, false),
      finialMat,
    );
    group.add(rib);

    const cuDao = createCornerDragonFinial(finialMat, finialScale);
    cuDao.position.set(p0x * 0.98, eaveLift * 0.85, p0z * 0.98);
    cuDao.rotation.y = a0;
    group.add(cuDao);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  if ('side' in tileMat) {
    (tileMat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  }
  const mesh = new THREE.Mesh(geo, tileMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return group;
}

/**
 * Sculpted Vietnamese upturned corner finial ("cù dao / đao mái")
 */
export function createCornerDragonFinial(mat: THREE.Material, scale = 0.4): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.35 * scale, 0.35 * scale),
    new THREE.Vector3(0, 0.95 * scale, 0.45 * scale),
    new THREE.Vector3(0, 1.35 * scale, 0.15 * scale),
    new THREE.Vector3(0, 1.15 * scale, -0.08 * scale),
  ]);
  const spine = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 12, 0.13 * scale, 6, false),
    mat,
  );
  spine.castShadow = true;
  g.add(spine);

  const curl = new THREE.Mesh(
    new THREE.TorusGeometry(0.14 * scale, 0.055 * scale, 6, 12),
    mat,
  );
  curl.position.set(0, 1.12 * scale, 0.12 * scale);
  curl.rotation.y = Math.PI * 0.5;
  g.add(curl);
  return g;
}

/**
 * Carved Lotus Bud Finial ("Búp Sen") crowning Trụ Biểu gate pillars
 */
export function createLotusBud(mat: THREE.Material, scale = 1.0): THREE.Group {
  const g = new THREE.Group();
  const lathe = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.45 * scale, 0.12 * scale),
        new THREE.Vector2(0.58 * scale, 0.42 * scale),
        new THREE.Vector2(0.46 * scale, 0.85 * scale),
        new THREE.Vector2(0.22 * scale, 1.2 * scale),
        new THREE.Vector2(0.02, 1.48 * scale),
      ],
      12,
    ),
    mat,
  );
  lathe.castShadow = true;
  g.add(lathe);

  // Carved lotus petals wrapping the lower bulb
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.24 * scale, 8, 8),
      mat,
    );
    petal.scale.set(0.7, 1.6, 0.45);
    petal.position.set(
      Math.sin(a) * 0.44 * scale,
      0.5 * scale,
      Math.cos(a) * 0.44 * scale,
    );
    petal.rotation.y = a;
    petal.rotation.x = 0.22;
    g.add(petal);
  }
  return g;
}

/**
 * Hue Royal Gate Pillar ("Trụ Biểu") with stepped plinth, shaft panels, lantern crown & lotus bud
 */
export function createTruBieuPillar(
  height: number,
  width: number,
  bodyMat: THREE.Material,
  trimMat: THREE.Material,
  lotusMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const baseH = height * 0.14;
  const shaftH = height * 0.64;
  const crownH = height * 0.14;

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.45, baseH, width * 1.45),
    trimMat,
  );
  plinth.position.y = baseH * 0.5;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(width, shaftH, width),
    bodyMat,
  );
  shaft.position.y = baseH + shaftH * 0.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);

  // Recessed calligraphy panel trims on shaft
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.04, shaftH * 0.72, width * 0.62),
    trimMat,
  );
  panel.position.y = baseH + shaftH * 0.5;
  g.add(panel);
  const panel2 = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.62, shaftH * 0.72, width * 1.04),
    trimMat,
  );
  panel2.position.y = baseH + shaftH * 0.5;
  g.add(panel2);

  // Crown lantern box ("lồng đèn")
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.32, crownH * 0.4, width * 1.32),
    trimMat,
  );
  cap.position.y = baseH + shaftH + crownH * 0.2;
  g.add(cap);

  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, crownH * 0.75, width * 0.92),
    bodyMat,
  );
  lantern.position.y = baseH + shaftH + crownH * 0.75;
  g.add(lantern);

  const topCap = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.38, crownH * 0.35, width * 1.38),
    trimMat,
  );
  topCap.position.y = baseH + shaftH + crownH * 1.25;
  g.add(topCap);

  const lotus = createLotusBud(lotusMat, width * 0.85);
  lotus.position.y = baseH + shaftH + crownH * 1.42;
  g.add(lotus);

  return g;
}

/**
 * Undulating Stone Dragon Balustrade ("Rồng Đá Chầu Bậc Cấp")
 */
export function createDragonBalustrade(
  length: number,
  rise: number,
  stoneMat: THREE.Material,
  darkTrimMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();

  // Sloped stone cheek wall
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(length, rise),
    new THREE.Vector2(length, rise + 0.85),
    new THREE.Vector2(0, 0.85),
  ];
  const shape = new THREE.Shape(pts);
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.44, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
  wallGeo.translate(0, 0, -0.22);
  wallGeo.rotateY(Math.PI * 0.5);
  const wall = new THREE.Mesh(wallGeo, stoneMat);
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);

  // Undulating sculpted dragon body riding along the top of the balustrade
  const spinePts: THREE.Vector3[] = [];
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = -t * length;
    const y = t * rise + 0.96 + Math.sin(t * Math.PI * 4) * 0.24;
    const x = Math.sin(t * Math.PI * 2) * 0.08;
    spinePts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(spinePts);
  const body = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, 0.2, 8, false),
    darkTrimMat,
  );
  body.castShadow = true;
  g.add(body);

  // Dorsal spine ridges
  for (let i = 1; i < 11; i++) {
    const pt = curve.getPoint(i / 11);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), darkTrimMat);
    fin.position.set(pt.x, pt.y + 0.2, pt.z);
    fin.rotation.x = -0.35;
    g.add(fin);
  }

  // Sculpted Dragon Head at bottom foot (z = 0)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.05, 0.22);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.58), darkTrimMat);
  skull.castShadow = true;
  headGroup.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.34), darkTrimMat);
  snout.position.set(0, -0.02, 0.38);
  headGroup.add(snout);

  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), darkTrimMat);
  crest.position.set(0, 0.3, -0.1);
  crest.rotation.x = -0.5;
  headGroup.add(crest);

  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), stoneMat);
  pearl.position.set(0, 0.05, 0.55);
  headGroup.add(pearl);

  g.add(headGroup);
  return g;
}

/**
 * Stepped Stone Staircase with optional Dragon Balustrades
 * Runs from z = 0 (y = 0) upward toward -Z (y = rise, z = -length)
 */
export function createHueStaircase(
  width: number,
  rise: number,
  length: number,
  steps: number,
  stepMat: THREE.Material,
  balustradeMat: THREE.Material,
  dragonMat: THREE.Material,
  hasDragons = true,
): THREE.Group {
  const g = new THREE.Group();
  const stepRise = rise / steps;
  const stepRun = length / steps;

  const stepGeo = new THREE.BoxGeometry(width, stepRise + 0.08, stepRun + 0.06);
  const inst = new THREE.InstancedMesh(stepGeo, stepMat, steps);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  for (let i = 0; i < steps; i++) {
    m.makeTranslation(0, (i + 0.5) * stepRise, -(i + 0.5) * stepRun);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);

  // Underlying solid masonry ramp so no gaps show from the sides
  const rampShape = new THREE.Shape([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(length, rise),
    new THREE.Vector2(length, 0),
  ]);
  const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
    depth: width - 0.1,
    bevelEnabled: false,
  });
  rampGeo.translate(0, 0, -(width - 0.1) * 0.5);
  rampGeo.rotateY(Math.PI * 0.5);
  const ramp = new THREE.Mesh(rampGeo, balustradeMat);
  ramp.receiveShadow = true;
  g.add(ramp);

  for (const side of [-1, 1]) {
    if (hasDragons) {
      const dr = createDragonBalustrade(length, rise, balustradeMat, dragonMat);
      dr.position.x = side * (width * 0.5 + 0.25);
      g.add(dr);
    } else {
      const wallShape = new THREE.Shape([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(length, rise),
        new THREE.Vector2(length, rise + 0.7),
        new THREE.Vector2(0, 0.7),
      ]);
      const wg = new THREE.ExtrudeGeometry(wallShape, { depth: 0.36, bevelEnabled: false });
      wg.translate(0, 0, -0.18);
      wg.rotateY(Math.PI * 0.5);
      const wMesh = new THREE.Mesh(wg, balustradeMat);
      wMesh.position.x = side * (width * 0.5 + 0.2);
      wMesh.castShadow = true;
      g.add(wMesh);
    }
  }

  return g;
}

/**
 * Traditional Huế Hexagonal Lantern with dynamic warm glow handle
 */
export function createHueLantern(
  lanterns: LanternHandle[],
  scale = 1.0,
  withLight = false,
): THREE.Group {
  const g = new THREE.Group();
  const silkMat = new THREE.MeshStandardMaterial({
    color: 0xffc66e,
    emissive: 0xff8c28,
    emissiveIntensity: 0.8,
    roughness: 0.5,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3b1f16, roughness: 0.65 });

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26 * scale, 0.14 * scale, 6), frameMat);
  cap.position.y = 0.22 * scale;
  g.add(cap);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.16 * scale, 0.34 * scale, 6), silkMat);
  g.add(body);

  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.08 * scale, 0.1 * scale, 6), frameMat);
  bot.position.y = -0.21 * scale;
  g.add(bot);

  let light: THREE.PointLight | undefined;
  if (withLight) {
    light = new THREE.PointLight(0xffa44c, 2.2, 16, 1.8);
    light.position.y = -0.05 * scale;
    g.add(light);
  }

  lanterns.push({ mat: silkMat, light, baseIntensity: withLight ? 2.2 : 0.8 });
  return g;
}

/**
 * Carved Stone Tortoise Carrying Royal Stele ("Rùa Đá Cõng Bia")
 */
export function createStoneTurtleStele(
  stoneMat: THREE.Material,
  steleMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();

  // Plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 3.6), stoneMat);
  base.position.y = 0.15;
  base.receiveShadow = true;
  g.add(base);

  // Tortoise shell
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), stoneMat);
  shell.scale.set(1.0, 0.45, 1.35);
  shell.position.set(0, 0.55, 0.05);
  shell.castShadow = true;
  g.add(shell);

  // 4 Stone Legs
  for (const sx of [-0.72, 0.72]) {
    for (const sz of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 8), stoneMat);
      leg.position.set(sx, 0.35, sz);
      g.add(leg);
    }
  }

  // Sculpted Tortoise Head stretching forward (+Z)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.65, 8), stoneMat);
  neck.rotation.x = Math.PI * 0.36;
  neck.position.set(0, 0.65, 1.35);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), stoneMat);
  head.scale.set(0.95, 0.82, 1.25);
  head.position.set(0, 0.86, 1.68);
  g.add(head);

  // Imperial Stone Stele Slab ("Bia Đá")
  const stele = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.35, 0.28), steleMat);
  stele.position.set(0, 1.98, 0);
  stele.castShadow = true;
  g.add(stele);

  const archTop = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.28, 16), steleMat);
  archTop.rotation.x = Math.PI * 0.5;
  archTop.position.set(0, 3.15, 0);
  g.add(archTop);

  return g;
}
