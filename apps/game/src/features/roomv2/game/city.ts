import * as THREE from 'three';
import { facadeTexture, neonTexture, wetRoadTexture, rng, canvas, toTex } from './textures';

export const STREET_Y = -17.5;

function glowTex() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return toTex(c);
}
function streakTex() {
  const c = canvas(64, 256);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.15, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h; ctx.fillRect(0, 0, 64, 256);
  // broken up by ripples
  for (let y = 0; y < 256; y += 6) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.6})`; ctx.fillRect(0, y, 64, 3); }
  return toTex(c);
}

export function buildCity(scene: THREE.Scene) {
  const city = new THREE.Group();
  const r = rng(2024);
  const glow = glowTex();
  const streak = streakTex();
  const add = <T extends THREE.Object3D>(o: T) => { city.add(o); return o; };
  const updaters: ((t: number, dt: number) => void)[] = [];

  /* ---------- sky dome: low clouds lit by sodium light pollution ---------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vP);
        float el = clamp(d.y, -0.2, 1.0);
        vec3 horizon = vec3(0.30, 0.17, 0.12);
        vec3 mid = vec3(0.07, 0.055, 0.075);
        vec3 zen = vec3(0.012, 0.016, 0.03);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, el));
        col = mix(col, zen, smoothstep(0.15, 0.7, el));
        vec2 cp = d.xz / max(d.y, 0.05) * 1.3 + vec2(uTime*0.006, uTime*0.002);
        float cl = fbm(cp);
        col += vec3(0.16, 0.09, 0.07) * smoothstep(0.45, 0.85, cl) * (1.0 - smoothstep(0.0, 0.6, el)) * 0.9;
        col *= 0.9 + 0.1*cl;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = add(new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), skyMat));
  updaters.push((t) => { skyMat.uniforms.uTime.value = t; });

  /* ---------- street ---------- */
  const roadTex = wetRoadTexture();
  roadTex.repeat.set(1, 8);
  const roadMat = new THREE.MeshBasicMaterial({ map: roadTex, color: new THREE.Color(1.1, 1.05, 1.1) });
  const road = add(new THREE.Mesh(new THREE.PlaneGeometry(12, 320), roadMat));
  road.rotation.x = -Math.PI / 2; road.rotation.z = Math.PI / 2;
  road.position.set(0, STREET_Y, -15);
  const walkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.048, 0.05) });
  for (const z of [-7.5, -22.5]) {
    const w = add(new THREE.Mesh(new THREE.BoxGeometry(320, 0.18, 3), walkMat));
    w.position.set(0, STREET_Y + 0.09, z);
  }

  /* ---------- buildings across the street ---------- */
  const facades = [facadeTexture(1, 8, 16, 0), facadeTexture(2, 6, 14, 2), facadeTexture(3, 10, 20, 1), facadeTexture(4, 5, 12, 2)];
  const sideMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.018, 0.018, 0.024) });
  const shopColors = ['#f7f3e6', '#ffd9a0', '#a8ffd0', '#ffb3d9', '#bfe3ff'];
  let x = -70;
  while (x < 70) {
    const w = 7 + r() * 10, h = 14 + r() * 26, d = 10 + r() * 6;
    const fi = Math.floor(r() * facades.length);
    const tex = facades[fi].clone(); tex.needsUpdate = true;
    tex.repeat.set(w / 14, h / 28); tex.offset.set(r(), r());
    const front = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setHSL(0.08 + r() * 0.05, 0.2, 0.55 + r() * 0.35) });
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, h, d), [sideMat, sideMat, sideMat, sideMat, front, sideMat]));
    b.position.set(x + w / 2, STREET_Y + h / 2, -24 - d / 2 - r() * 2);
    // ground floor shop
    const lit = r() < 0.6;
    const shop = add(new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, 2.8), new THREE.MeshBasicMaterial({
      color: lit ? new THREE.Color(shopColors[Math.floor(r() * shopColors.length)]).multiplyScalar(1.6) : new THREE.Color(0.05, 0.05, 0.055),
    })));
    shop.position.set(x + w / 2, STREET_Y + 1.6, b.position.z + d / 2 + 0.02);
    if (lit) {
      const pool = add(new THREE.Mesh(new THREE.PlaneGeometry(w - 1, 5), new THREE.MeshBasicMaterial({ map: glow, color: (shop.material as THREE.MeshBasicMaterial).color.clone().multiplyScalar(0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x + w / 2, STREET_Y + 0.2, -21.5);
      const refl = add(new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 9), new THREE.MeshBasicMaterial({ map: streak, color: (shop.material as THREE.MeshBasicMaterial).color.clone().multiplyScalar(0.18), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      refl.rotation.x = -Math.PI / 2; refl.position.set(x + w / 2, STREET_Y + 0.03, -16.5);
    }
    // awnings / rooftop clutter (water tanks, antennas)
    if (r() < 0.6) {
      const tank = add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 10), sideMat));
      tank.position.set(x + w * r(), STREET_Y + h + 0.8, b.position.z);
    }
    x += w;
  }

  /* ---------- distant towers fading into the mist ---------- */
  for (let i = 0; i < 38; i++) {
    const w = 14 + r() * 22, h = 40 + r() * 120;
    const tex = facades[Math.floor(r() * 4)].clone(); tex.needsUpdate = true;
    tex.repeat.set(w / 10, h / 20); tex.offset.set(r(), r());
    const front = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.9, 0.85, 0.9).multiplyScalar(0.7 + r() * 0.6) });
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [front, front, sideMat, sideMat, front, front]));
    const ang = (r() - 0.5) * 2.2;
    const dist = 90 + r() * 240;
    b.position.set(Math.sin(ang) * dist, STREET_Y + h / 2 - 4, -Math.cos(ang) * dist - 30);
    b.rotation.y = r() * 0.6;
    if (h > 120 && r() < 0.7) {
      const beacon = add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15) })));
      beacon.position.set(b.position.x, STREET_Y + h - 2.5, b.position.z);
      const ph = r() * 6;
      updaters.push((t) => { beacon.visible = Math.sin(t * 1.4 + ph) > 0.6; });
    }
  }

  /* ---------- street lamps & their wet reflections ---------- */
  const poleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.03, 0.035) });
  const sodium = new THREE.Color(3.2, 1.7, 0.7);
  for (let i = -6; i <= 6; i++) {
    for (const side of [0, 1]) {
      const lx = i * 17 + side * 8, lz = side ? -21.5 : -8.4;
      const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 8, 6), poleMat));
      pole.position.set(lx, STREET_Y + 4, lz);
      const arm = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.8), poleMat));
      arm.position.set(lx, STREET_Y + 7.9, lz + (side ? 0.9 : -0.9));
      const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.6), new THREE.MeshBasicMaterial({ color: sodium })));
      head.position.set(lx, STREET_Y + 7.8, lz + (side ? 1.7 : -1.7));
      const g = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.55, 0.25).multiplyScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      g.scale.set(4.5, 4.5, 1); g.position.copy(head.position);
      const pool = add(new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.5, 0.26, 0.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      pool.rotation.x = -Math.PI / 2; pool.position.set(lx, STREET_Y + 0.21, head.position.z);
      const refl = add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 12), new THREE.MeshBasicMaterial({ map: streak, color: new THREE.Color(0.9, 0.45, 0.18), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      refl.rotation.x = -Math.PI / 2; refl.position.set(lx, STREET_Y + 0.04, head.position.z + 5.5);
    }
  }

  /* ---------- tangled overhead cables (very Saigon) ---------- */
  const wireMat = new THREE.LineBasicMaterial({ color: 0x050506 });
  const catenary = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 24; k++) { const u = k / 24; const p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * sag; pts.push(p); }
    add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  };
  for (let i = -5; i < 5; i++) {
    for (let k = 0; k < 9; k++) {
      const y = STREET_Y + 7 + r() * 2.2;
      catenary(new THREE.Vector3(i * 17 + r() * 0.4, y, -8.1 + r() * 0.3), new THREE.Vector3((i + 1) * 17, y + (r() - 0.5) * 0.6, -8.1 + r() * 0.3), 0.4 + r() * 0.9);
    }
    if (r() < 0.7) for (let k = 0; k < 3; k++) catenary(new THREE.Vector3(i * 17, STREET_Y + 8 + r(), -8.2), new THREE.Vector3(i * 17 + 8 + r() * 4, STREET_Y + 8 + r(), -21.5), 1 + r());
  }
  // a cable passing right in front of our window, a bit closer
  catenary(new THREE.Vector3(-14, -2.2, -5), new THREE.Vector3(12, -1.4, -6), 1.6);
  catenary(new THREE.Vector3(-14, -2.6, -5.2), new THREE.Vector3(12, -1.9, -6.3), 1.9);

  /* ---------- trees on the sidewalk ---------- */
  const leafMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.03, 0.02) });
  for (let i = -5; i <= 5; i++) {
    const tz = -8.0 + (r() - 0.5) * 0.4, tx = i * 17 + 8.5;
    const crown = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const s = add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + r() * 1.2, 1), leafMat));
      s.position.set(tx + (r() - 0.5) * 3, STREET_Y + 6 + r() * 3, tz + (r() - 0.5) * 2.5);
      crown.add(s.clone());
    }
  }

  /* ---------- neon signs ---------- */
  const neon = (txt: string, col: string, sub: string | undefined, pos: THREE.Vector3, w: number, flicker: boolean) => {
    const m = new THREE.MeshBasicMaterial({ map: neonTexture(txt, col, sub), color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const p = add(new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), m));
    p.position.copy(pos);
    const c = new THREE.Color(col);
    const refl = add(new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 14), new THREE.MeshBasicMaterial({ map: streak, color: c.clone().multiplyScalar(0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    refl.rotation.x = -Math.PI / 2; refl.position.set(pos.x, STREET_Y + 0.05, -15);
    if (flicker) {
      let next = 0, on = true;
      updaters.push((t) => {
        if (t > next) { on = !on || Math.random() < 0.6; next = t + (on ? 0.5 + Math.random() * 6 : 0.04 + Math.random() * 0.12); }
        m.color.setScalar(on ? 2.2 : 0.25);
        (refl.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.15;
      });
    }
    return c;
  };
  neon('24H', '#5cf2c8', 'MINISTOP', new THREE.Vector3(-6, STREET_Y + 4.0, -23.8), 4, false);
  neon('KARAOKE', '#ff4fb4', undefined, new THREE.Vector3(9, STREET_Y + 9, -23.8), 6, true);
  neon('NHÀ THUỐC', '#7dff6a', '+', new THREE.Vector3(-22, STREET_Y + 4.2, -23.8), 5, false);
  neon('PHỞ', '#ffb347', 'MỞ CỬA KHUYA', new THREE.Vector3(20, STREET_Y + 4.4, -23.8), 4.5, false);

  /* ---------- traffic: scooters & cars on the wet road ---------- */
  type Veh = { g: THREE.Group; speed: number; lane: number };
  const vehs: Veh[] = [];
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 3.8) });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.25, 0.15) });
  const bodyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.03, 0.035) });
  const mkVeh = (car: boolean, dir: 1 | -1) => {
    const g = new THREE.Group();
    const bw = car ? 1.8 : 0.5, bl = car ? 4.2 : 1.8, bh = car ? 1.4 : 1.2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bl, bh, bw), bodyMat); body.position.y = bh / 2 + 0.2; g.add(body);
    const lights = car ? [-0.6, 0.6] : [0];
    for (const lz of lights) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(car ? 0.14 : 0.12, 6, 4), headMat); hl.position.set(dir * bl / 2, 0.8, lz); g.add(hl);
      const tl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), tailMat); tl.position.set(-dir * bl / 2, 0.8, lz); g.add(tl);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.95, 0.8).multiplyScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.set(2.2, 2.2, 1); sp.position.copy(hl.position); g.add(sp);
      const rs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.1, 0.05).multiplyScalar(0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      rs.scale.set(1.0, 1.0, 1); rs.position.copy(tl.position); g.add(rs);
    }
    // headlight beam on wet asphalt + reflection streak
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(car ? 8 : 5, car ? 3 : 1.6), new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.55, 0.5, 0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.rotation.x = -Math.PI / 2; beam.position.set(dir * (bl / 2 + (car ? 3.5 : 2)), 0.06, 0); g.add(beam);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(car ? 1.6 : 0.6, 7), new THREE.MeshBasicMaterial({ map: streak, color: new THREE.Color(0.7, 0.6, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    refl.rotation.x = -Math.PI / 2; refl.position.set(dir * bl / 2, 0.05, 3.5); g.add(refl);
    return g;
  };
  for (let i = 0; i < 22; i++) {
    const car = r() < 0.3;
    const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
    const g = mkVeh(car, dir);
    const lane = dir === 1 ? -12.4 - r() * 1.6 : -16.6 - r() * 1.8;
    g.position.set((r() - 0.5) * 240, STREET_Y, lane);
    add(g);
    vehs.push({ g, speed: dir * (car ? 9 + r() * 5 : 7 + r() * 5), lane });
  }
  updaters.push((_t, dt) => {
    for (const v of vehs) {
      v.g.position.x += v.speed * dt;
      if (v.g.position.x > 130) v.g.position.x = -130;
      if (v.g.position.x < -130) v.g.position.x = 130;
    }
  });

  /* ---------- a plane blinking slowly across the cloud deck ---------- */
  const plane = add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5) })));
  updaters.push((t) => {
    const u = (t * 0.004) % 1;
    plane.position.set(-300 + u * 600, 110, -340);
    plane.visible = (t % 1.3) < 0.12;
  });

  /* ---------- our own building: the AC unit and ledge just outside the window ---------- */
  const acMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.13, 0.13, 0.14) });
  const ac = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.3), acMat));
  ac.position.set(0.9, -0.55, -2.55);
  const grill = add(new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: 0x050505 })));
  grill.position.set(0.75, -0.55, -2.399);
  grill.rotation.y = 0;
  grill.position.z = -2.39; grill.rotation.x = 0;
  grill.lookAt(0.75, -0.55, 0);
  const facadeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.048, 0.05) });
  const ownWall = add(new THREE.Mesh(new THREE.PlaneGeometry(40, 30), facadeMat));
  ownWall.position.set(0, -14, -2.36);
  const ledge = add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.11) })));
  ledge.position.set(-0.7, 0.8, -2.5);

  /* ---------- faint drizzle near the lamps (the rain's last threads) ---------- */
  const N = 900;
  const dg = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6);
  const seeds: number[] = [];
  for (let i = 0; i < N; i++) { seeds.push(r() * 60 - 30, r() * 24 + STREET_Y, -4 - r() * 20); }
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const drizzle = add(new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.35, 0.3, 0.28), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
  drizzle.frustumCulled = false;
  updaters.push((t) => {
    for (let i = 0; i < N; i++) {
      const sx = seeds[i * 3], sz = seeds[i * 3 + 2];
      const y = STREET_Y + 24 - (((seeds[i * 3 + 1] - STREET_Y) + t * 7) % 24);
      pos[i * 6] = sx; pos[i * 6 + 1] = y; pos[i * 6 + 2] = sz;
      pos[i * 6 + 3] = sx + 0.02; pos[i * 6 + 4] = y - 0.25; pos[i * 6 + 5] = sz;
    }
    dg.attributes.position.needsUpdate = true;
  });

  city.traverse((o) => o.layers.set(1));
  scene.add(city);
  void sky;
  return { group: city, update: (t: number, dt: number) => updaters.forEach((u) => u(t, dt)) };
}
