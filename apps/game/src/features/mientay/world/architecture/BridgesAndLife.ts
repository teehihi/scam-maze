import * as THREE from 'three';
import { MekongMaterialLibrary } from '../materials/ProceduralPBR';
import { registerWalkableSlope, sampleTerrainHeight } from '../terrain/MekongHeightfield';
import { SeededRNG, clamp, lerp } from '../math/Noise';


export interface BridgesAndLifeSystem {
  group: THREE.Group;
  update: (elapsedTime: number, nightFactor: number) => void;
  dispose: () => void;
}

interface BirdAgent {
  root: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  alt: number;
  speed: number;
  phase: number;
}

export function createBridgesAndLife(mats: MekongMaterialLibrary): BridgesAndLifeSystem {
  const group = new THREE.Group();
  group.name = 'MekongBridgesAndLife';
  const disposables: Array<{ dispose: () => void }> = [];
  const rng = new SeededRNG(9911);

  const plankLightMat = mats.getWoodPlank(3, 1, false);
  const plankDarkMat = mats.getWoodPlank(3, 1, true);
  const pilingMat = mats.getPilingBark(1, 3);
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x9b8347, roughness: 0.72 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x3b2c1d, roughness: 0.92 });
  const trussIronMat = new THREE.MeshStandardMaterial({ color: 0x4b5357, metalness: 0.55, roughness: 0.55 });
  const egretMat = new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.65, side: THREE.DoubleSide });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xd98e1e, roughness: 0.5 });
  disposables.push(bambooMat, ropeMat, trussIronMat, egretMat, beakMat);

  // --------------------------------------------------------------------------
  // 1. Cầu Khỉ Tre (Traditional Bamboo Monkey Bridge) at x = 48, z: -16 .. -36
  // --------------------------------------------------------------------------
  {
    const mk = new THREE.Group();
    const zStart = -16.5;
    const zEnd = -36.5;
    const bx = 48.0;
    const startY = 1.75;
    const endY = 1.48;
    const archPeak = 1.35;

    const getArchY = (t: number) =>
      lerp(startY, endY, t) + Math.sin(t * Math.PI) * archPeak;

    // 7 X-shaped bamboo trestle supports planted in canal mud
    const trestleCount = 7;
    for (let i = 0; i <= trestleCount; i++) {
      const t = i / trestleCount;
      const z = lerp(zStart, zEnd, t);
      const deckY = getArchY(t);
      const mudY = sampleTerrainHeight(bx, z) - 0.3;

      for (const side of [-1, 1]) {
        const legTopX = -side * 0.42;
        const legBotX = side * 0.62;
        const pBot = new THREE.Vector3(legBotX, mudY, 0);
        const pTop = new THREE.Vector3(legTopX, deckY + (side === 1 ? 0.98 : 0.08), 0);
        const len = pBot.distanceTo(pTop);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, len, 6), bambooMat);
        leg.position.copy(pBot).lerp(pTop, 0.5).add(new THREE.Vector3(bx, 0, z));
        leg.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          pTop.clone().sub(pBot).normalize(),
        );
        leg.castShadow = true;
        mk.add(leg);
      }

      // Lashing tie collar at X crossing
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 6), ropeMat);
      tie.position.set(bx, deckY - 0.04, z);
      mk.add(tie);
    }

    // Main curved 3-pole bamboo walkway + single curved handrail
    const walkPts: THREE.Vector3[] = [];
    const railPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 16; s++) {
      const t = s / 16;
      const z = lerp(zStart, zEnd, t);
      const y = getArchY(t);
      walkPts.push(new THREE.Vector3(bx, y, z));
      railPts.push(new THREE.Vector3(bx - 0.38, y + 0.96, z));
    }
    const walkCurve = new THREE.CatmullRomCurve3(walkPts);
    const railCurve = new THREE.CatmullRomCurve3(railPts);

    for (const dx of [-0.14, 0, 0.14]) {
      const pole = new THREE.Mesh(new THREE.TubeGeometry(walkCurve, 20, 0.055, 6, false), bambooMat);
      pole.position.x = dx;
      pole.castShadow = true;
      mk.add(pole);
    }
    const handrail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 20, 0.04, 6, false), bambooMat);
    handrail.castShadow = true;
    mk.add(handrail);

    group.add(mk);
    registerWalkableSlope('cau-khi-tre', bx - 0.65, bx + 0.65, zEnd, zStart, (_x, z) => {
      const t = clamp((zStart - z) / (zStart - zEnd), 0, 1);
      return getArchY(t) + 0.06;
    });
  }

  // --------------------------------------------------------------------------
  // 2. Cầu Gỗ Bắc Rạch (Sturdy Wooden Canal Footbridge) at x = 26, z: -15 .. -35
  // --------------------------------------------------------------------------
  {
    const wb = new THREE.Group();
    const bx = 26.5;
    const zStart = -14.8;
    const zEnd = -35.2;
    const startY = 1.85;
    const endY = 1.48;
    const archPeak = 0.85;
    const getDeckY = (t: number) => lerp(startY, endY, t) + Math.sin(t * Math.PI) * archPeak;

    const segs = 14;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const tm = (t0 + t1) * 0.5;
      const z0 = lerp(zStart, zEnd, t0);
      const z1 = lerp(zStart, zEnd, t1);
      const y0 = getDeckY(t0);
      const y1 = getDeckY(t1);
      const segLen = Math.hypot(z1 - z0, y1 - y0);
      const pitch = Math.atan2(y1 - y0, z0 - z1);

      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, segLen + 0.04), plankLightMat);
      plank.position.set(bx, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
      plank.rotation.x = pitch;
      plank.castShadow = plank.receiveShadow = true;
      wb.add(plank);

      if (i % 2 === 0) {
        const mudY = sampleTerrainHeight(bx, z0) - 0.3;
        for (const side of [-0.95, 0.95]) {
          const ph = y0 + 0.95 - mudY;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, ph, 6), pilingMat);
          post.position.set(bx + side, mudY + ph * 0.5, z0);
          post.castShadow = true;
          wb.add(post);

        }
      }
      void tm;
    }

    // Wooden handrails along both sides
    for (const side of [-0.95, 0.95]) {
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        pts.push(new THREE.Vector3(bx + side, getDeckY(t) + 0.92, lerp(zStart, zEnd, t)));
      }
      const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.045, 5, false);
      disposables.push(railGeo);
      wb.add(new THREE.Mesh(railGeo, plankDarkMat));
    }

    group.add(wb);
    registerWalkableSlope('cau-go-bach-rach', bx - 1.15, bx + 1.15, zEnd, zStart, (_x, z) => {
      const t = clamp((zStart - z) / (zStart - zEnd), 0, 1);
      return getDeckY(t) + 0.07;
    });
  }

  // --------------------------------------------------------------------------
  // 3. Cầu Làng Bến Sông (Main River Arched Truss Bridge) at z = -66, x: -38 .. +12
  // --------------------------------------------------------------------------
  {
    const mb = new THREE.Group();
    const bz = -66.0;
    const xStart = -38.0;
    const xEnd = 12.0;
    const startY = sampleTerrainHeight(xStart, bz);
    const endY = sampleTerrainHeight(xEnd, bz);
    const archPeak = 2.75; // Plenty of clearance for boats passing underneath!
    const getDeckY = (t: number) => lerp(startY, endY, t) + Math.sin(t * Math.PI) * archPeak;

    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = lerp(xStart, xEnd, t0);
      const x1 = lerp(xStart, xEnd, t1);
      const y0 = getDeckY(t0);
      const y1 = getDeckY(t1);
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      const slope = Math.atan2(y1 - y0, x1 - x0);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.05, 0.16, 2.8), plankDarkMat);
      deck.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, bz);
      deck.rotation.z = slope;
      deck.castShadow = deck.receiveShadow = true;
      mb.add(deck);

      // Pier pilings spaced nicely (leaving wide central boat navigation span around x=-13)
      if (i % 4 === 0 && (i < 8 || i > 14)) {
        const bedY = sampleTerrainHeight(x0, bz) - 0.5;
        for (const dz of [-1.2, 1.2]) {
          const ph = y0 - bedY;
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, ph, 7), pilingMat);
          pier.position.set(x0, bedY + ph * 0.5, bz + dz);
          pier.castShadow = true;
          mb.add(pier);

        }
      }

      // Steel truss vertical & diagonal posts along side rails
      if (i % 2 === 0) {
        for (const dz of [-1.32, 1.32]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.15, 0.09), trussIronMat);
          post.position.set(x0, y0 + 0.58, bz + dz);
          mb.add(post);
          if (i < segs - 2) {
            const diag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.85, 0.055), trussIronMat);
            diag.position.set(x0 + segLen, (y0 + y1) * 0.5 + 0.58, bz + dz);
            diag.rotation.z = i % 4 === 0 ? 0.88 : -0.88;
            mb.add(diag);
          }
        }
      }
    }

    for (const dz of [-1.32, 1.32]) {
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 18; s++) {
        const t = s / 18;
        pts.push(new THREE.Vector3(lerp(xStart, xEnd, t), getDeckY(t) + 1.12, bz + dz));
      }
      const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.055, 5, false);
      disposables.push(railGeo);
      mb.add(new THREE.Mesh(railGeo, trussIronMat));
    }

    group.add(mb);
    registerWalkableSlope('cau-lang-song-cai', xStart, xEnd, bz - 1.45, bz + 1.45, (x) => {
      const t = clamp((x - xStart) / (xEnd - xStart), 0, 1);
      return getDeckY(t) + 0.08;
    });
  }

  // --------------------------------------------------------------------------
  // 4. White Egrets ("Đàn Cò Trắng Bay Trên Đồng")
  // --------------------------------------------------------------------------
  const birds: BirdAgent[] = [];
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.14,
        0.52, 0.06, 0.04,
        0.85, 0.0, -0.18,
        0, 0, -0.16,
      ],
      3,
    ),
  );
  wingGeo.setIndex([0, 1, 3, 1, 2, 3]);
  wingGeo.computeVertexNormals();
  disposables.push(wingGeo);

  for (let i = 0; i < 9; i++) {
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 6), egretMat);
    body.rotation.x = Math.PI / 2;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 5), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.32;

    const leftWing = new THREE.Mesh(wingGeo, egretMat);
    const rightWing = new THREE.Mesh(wingGeo, egretMat);
    rightWing.scale.x = -1;
    root.add(body, beak, leftWing, rightWing);
    // Flown along a path by update(); must not be merged into static geometry.
    root.userData.dynamic = true;
    group.add(root);

    birds.push({
      root,
      leftWing,
      rightWing,
      cx: rng.range(-30, 55),
      cz: rng.range(-55, 25),
      rx: rng.range(18, 44),
      rz: rng.range(16, 36),
      alt: rng.range(11.5, 22.0),
      speed: rng.range(0.16, 0.26),
      phase: rng.range(0, Math.PI * 2),
    });
  }

  // --------------------------------------------------------------------------
  // 5. Twilight Fireflies ("Đom Đóm Rạch Dừa Nước")
  // --------------------------------------------------------------------------
  const fireflyCount = 90;
  const ffPos = new Float32Array(fireflyCount * 3);
  const ffBase = new Float32Array(fireflyCount * 3);
  const ffPhase = new Float32Array(fireflyCount);

  for (let i = 0; i < fireflyCount; i++) {
    // Cluster around Nipa canals, Lotus pond, and Banyan shrine
    const zone = i % 3;
    const x =
      zone === 0
        ? rng.range(15, 75)
        : zone === 1
          ? 70 + rng.range(-14, 14)
          : rng.range(-48, -28);
    const z =
      zone === 0
        ? rng.range(-34, -14)
        : zone === 1
          ? -74 + rng.range(-14, 14)
          : rng.range(-18, 12);
    const y = Math.max(0.5, sampleTerrainHeight(x, z)) + rng.range(0.4, 2.6);
    ffBase[i * 3] = ffPos[i * 3] = x;
    ffBase[i * 3 + 1] = ffPos[i * 3 + 1] = y;
    ffBase[i * 3 + 2] = ffPos[i * 3 + 2] = z;
    ffPhase[i] = rng.range(0, Math.PI * 2);
  }

  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('aPhase', new THREE.BufferAttribute(ffPhase, 1));
  const ffMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      varying float vPulse;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 1.1 + aPhase) * 0.55;
        p.y += sin(uTime * 1.7 + aPhase * 1.3) * 0.32;
        p.z += cos(uTime * 0.9 + aPhase * 0.7) * 0.55;
        vPulse = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 3.8 + aPhase * 4.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(24.0 / max(-mv.z, 1.0), 2.0, 9.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vPulse;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * 1.8, glow * vPulse * uOpacity);
      }
    `,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  fireflies.frustumCulled = false;
  group.add(fireflies);
  disposables.push(ffGeo, ffMat);

  // --------------------------------------------------------------------------
  // 6. Village Kitchen Woodsmoke ("Khói Lam Chiều") — Soft Radial Plume Particles
  // --------------------------------------------------------------------------
  const smokeCount = 26;
  const smPos = new Float32Array(smokeCount * 3);
  const smPhase = new Float32Array(smokeCount);
  for (let i = 0; i < smokeCount; i++) {
    smPos[i * 3] = 24.2;
    smPos[i * 3 + 1] = 4.9;
    smPos[i * 3 + 2] = -2.0;
    smPhase[i] = i / smokeCount;
  }
  const smGeo = new THREE.BufferGeometry();
  smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3));
  smGeo.setAttribute('aPhase', new THREE.BufferAttribute(smPhase, 1));
  const smMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      uniform float uTime;
      varying float vLife;
      void main() {
        float life = fract(uTime * 0.12 + aPhase);
        vLife = life;
        vec3 p = position;
        p.y += life * 6.2;
        p.x += life * 2.4 + sin(uTime * 0.9 + aPhase * 12.0) * (0.18 + life * 0.6);
        p.z += life * 1.1 + cos(uTime * 0.7 + aPhase * 9.0) * (0.15 + life * 0.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((55.0 + life * 110.0) / max(-mv.z, 1.0), 4.0, 48.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        float puff = exp(-d * d * 3.4);
        float fade = sin(vLife * 3.14159) * mix(0.14, 0.06, uNight);
        vec3 col = mix(vec3(0.84, 0.85, 0.86), vec3(0.45, 0.48, 0.54), uNight);
        gl_FragColor = vec4(col, puff * fade);
      }
    `,
  });
  const smokePlume = new THREE.Points(smGeo, smMat);
  smokePlume.frustumCulled = false;
  group.add(smokePlume);
  disposables.push(smGeo, smMat);

  return {
    group,
    update: (elapsedTime: number, nightFactor: number) => {
      // Animate flying egrets
      for (const b of birds) {
        const ang = elapsedTime * b.speed + b.phase;
        const x = b.cx + Math.cos(ang) * b.rx;
        const z = b.cz + Math.sin(ang) * b.rz;
        const y = b.alt + Math.sin(ang * 2.0 + b.phase) * 1.1;

        const dx = -Math.sin(ang) * b.rx;
        const dz = Math.cos(ang) * b.rz;
        b.root.position.set(x, y, z);
        b.root.rotation.y = Math.atan2(dx, dz);
        b.root.rotation.z = -0.14;

        const flapEnv = Math.sin(elapsedTime * 0.7 + b.phase) > -0.25 ? 1.0 : 0.15;
        const flap = Math.sin(elapsedTime * 7.8 + b.phase) * 0.62 * flapEnv;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
      }

      ffMat.uniforms.uTime.value = elapsedTime;
      ffMat.uniforms.uOpacity.value = clamp((nightFactor - 0.15) * 1.4, 0, 1);

      smMat.uniforms.uTime.value = elapsedTime;
      smMat.uniforms.uNight.value = nightFactor;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
