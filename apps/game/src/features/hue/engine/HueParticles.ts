import * as THREE from 'three';

export interface HueParticleSystem {
  group: THREE.Group;
  update: (dt: number, elapsed: number, cameraPos: THREE.Vector3) => void;
  setRainIntensity: (intensity: number) => void;
  dispose: () => void;
}

function createSoftRadialSprite(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.hypot(dx, dy) * 2.0;
      const alpha = Math.max(0, Math.pow(Math.max(0, 1 - r), 2.2));
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createHueParticles(
  incenseSources: THREE.Vector3[],
): HueParticleSystem {
  const group = new THREE.Group();
  group.name = 'HueAtmosphericParticles';
  const softSprite = createSoftRadialSprite();

  // 1. Rising Fragrant Incense Smoke Plumes
  const smokeCount = incenseSources.length * 24;
  const smokePositions = new Float32Array(smokeCount * 3);
  const smokeMeta: { origin: THREE.Vector3; age: number; speed: number; phase: number }[] = [];

  incenseSources.forEach((origin) => {
    for (let i = 0; i < 24; i++) {
      smokeMeta.push({
        origin: origin.clone(),
        age: (i / 24) * 4.5,
        speed: 0.45 + (i % 5) * 0.06,
        phase: i * 1.1,
      });
    }
  });

  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
  const smokeMat = new THREE.PointsMaterial({
    color: 0xe6e0d6,
    map: softSprite,
    size: 0.52,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  smokePoints.frustumCulled = false;
  group.add(smokePoints);

  // 2. Floating Sunbeam Dust Motes / Fireflies at night
  const moteCount = 160;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 60;
    motePos[i * 3 + 1] = Math.random() * 14 + 1;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffe49e,
    map: softSprite,
    size: 0.24,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.frustumCulled = false;
  group.add(motePoints);

  // 3. Mưa Bụi Xứ Huế (Fine Drizzle Rain Streaks around Camera)
  const rainCount = 900;
  const rainPos = new Float32Array(rainCount * 6);
  const rainOffsets: { x: number; y: number; z: number; speed: number }[] = [];
  for (let i = 0; i < rainCount; i++) {
    rainOffsets.push({
      x: (Math.random() - 0.5) * 56,
      y: Math.random() * 28,
      z: (Math.random() - 0.5) * 56,
      speed: 14 + Math.random() * 6,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xcfdbe0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  rainLines.visible = false;
  group.add(rainLines);

  let currentRain = 0;

  const setRainIntensity = (intensity: number) => {
    currentRain = Math.max(0, Math.min(1, intensity));
    rainLines.visible = currentRain > 0.02;
    rainMat.opacity = currentRain * 0.34;
  };

  const update = (dt: number, elapsed: number, cameraPos: THREE.Vector3) => {
    // Distance-aware incense smoke update: skip CPU work and GPU buffer uploads when far (> 65m)
    let nearIncense = false;
    for (let o = 0; o < incenseSources.length; o++) {
      const orig = incenseSources[o];
      const dx = cameraPos.x - orig.x;
      const dz = cameraPos.z - orig.z;
      if (dx * dx + dz * dz < 65 * 65) {
        nearIncense = true;
        break;
      }
    }
    smokePoints.visible = nearIncense;

    if (nearIncense) {
      const sAttr = smokeGeo.attributes.position as THREE.BufferAttribute;
      smokeMeta.forEach((s, idx) => {
        s.age = (s.age + dt * s.speed) % 4.5;
        const t = s.age / 4.5;
        const x = s.origin.x + Math.sin(elapsed * 1.2 + s.phase + t * 4) * 0.32 * t;
        const y = s.origin.y + t * 3.4;
        const z = s.origin.z + Math.cos(elapsed * 0.9 + s.phase + t * 3) * 0.25 * t;
        sAttr.setXYZ(idx, x, y, z);
      });
      sAttr.needsUpdate = true;
    }

    motePoints.position.set(
      Math.floor(cameraPos.x / 30) * 30,
      Math.max(0, Math.floor(cameraPos.y / 12) * 12 - 2),
      Math.floor(cameraPos.z / 30) * 30,
    );
    const mAttr = moteGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < moteCount; i++) {
      const y = mAttr.getY(i) + Math.sin(elapsed * 0.8 + i) * dt * 0.18;
      mAttr.setY(i, y);
    }
    mAttr.needsUpdate = true;

    if (currentRain > 0.02) {
      const rAttr = rainGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < rainCount; i++) {
        const ro = rainOffsets[i];
        ro.y -= ro.speed * dt;
        if (ro.y < -3) ro.y += 28;
        const wx = cameraPos.x + ro.x;
        const wy = cameraPos.y - 6 + ro.y;
        const wz = cameraPos.z + ro.z;
        rAttr.setXYZ(i * 2, wx, wy, wz);
        rAttr.setXYZ(i * 2 + 1, wx + 0.08, wy + 0.72, wz + 0.04);
      }
      rAttr.needsUpdate = true;
    }
  };

  const dispose = () => {
    softSprite.dispose();
    smokeGeo.dispose();
    smokeMat.dispose();
    moteGeo.dispose();
    moteMat.dispose();
    rainGeo.dispose();
    rainMat.dispose();
    group.clear();
  };

  return { group, update, setRainIntensity, dispose };
}
