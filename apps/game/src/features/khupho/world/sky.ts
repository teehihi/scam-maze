import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { smoothstep, lerp, clamp } from './util';
import { glowTex } from './textures';

export class SkySys {
  sky = new Sky();
  sun = new THREE.DirectionalLight('#fff1dc', 3);
  hemi = new THREE.HemisphereLight('#bcd4f0', '#8a7a66', 0.6);
  stars: THREE.Points;
  moon: THREE.Sprite;
  sunDir = new THREE.Vector3();
  fogCol = new THREE.Color();
  private tmp = new THREE.Color();
  private snap = new THREE.Vector3();
  shadowSize = 2048;

  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) { this.scene = scene; this.renderer = renderer;
    this.sky.scale.setScalar(1800);
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82;
    scene.add(this.hemi); scene.add(this.sun); scene.add(this.sun.target);
    const s = this.sun;
    s.castShadow = true; s.shadow.mapSize.set(this.shadowSize, this.shadowSize);
    const c = s.shadow.camera; c.left = -48; c.right = 48; c.top = 48; c.bottom = -48; c.near = 1; c.far = 260;
    s.shadow.bias = -0.0005; s.shadow.normalBias = 0.05;
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, y = Math.pow(Math.random(), 0.7), r = Math.sqrt(1 - y * y) * 1500;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y * 1500 + 20; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false; scene.add(this.stars);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#9fb2dc', fog: false, transparent: true, depthWrite: false, opacity: 0 }));
    this.moon.scale.setScalar(55); scene.add(this.moon);
    scene.fog = new THREE.FogExp2('#c9d5dc', 0.004);
  }

  update(env: { hour: number; night: number; rain: number; sun: number }, cam: THREE.Vector3, indoor: number) {
    const phase = ((env.hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(phase), Math.sin(phase), 0.38).normalize();
    const y = this.sunDir.y;
    const day = smoothstep(-0.06, 0.28, y), rain = env.rain;
    env.night = 1 - smoothstep(-0.2, 0.06, y); env.sun = day;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.turbidity.value = lerp(4.5, 18, rain); u.rayleigh.value = lerp(1.3, 0.35, rain) * (0.3 + 0.7 * day) + 0.15; u.mieCoefficient.value = lerp(0.004, 0.02, rain);
    this.sky.position.copy(cam); this.stars.position.copy(cam);
    (this.stars.material as THREE.PointsMaterial).opacity = clamp(env.night * (1 - rain) * 0.95, 0, 1);
    const moonDir = this.moonDir.copy(this.sunDir).multiplyScalar(-1);
    this.moon.position.copy(cam).addScaledVector(moonDir, 1200); (this.moon.material as THREE.SpriteMaterial).opacity = moonDir.y > 0 ? env.night * (1 - rain) * 0.55 : 0;
    // directional light = sun by day, moon by night
    const useSun = y > -0.03;
    const d = useSun ? this.sunDir : moonDir;
    this.snap.set(Math.round(cam.x / 3) * 3, 0, Math.round(cam.z / 3) * 3);
    this.sun.target.position.copy(this.snap); this.sun.target.updateMatrixWorld();
    this.sun.position.copy(this.snap).addScaledVector(d, 120);
    if (useSun) {
      this.tmp.set('#ff8a3c').lerp(this.noon, smoothstep(0.0, 0.5, y));
      this.sun.color.copy(this.tmp);
      this.sun.intensity = 3.4 * smoothstep(-0.02, 0.3, y) * (1 - 0.82 * rain) + 0.05;
    } else {
      this.sun.color.set('#7f9bff'); this.sun.intensity = 0.8 * Math.max(0, moonDir.y) * (1 - 0.6 * rain) * env.night;
    }
    // hemisphere ambient
    const dusk = Math.max(0, 1 - Math.abs(y - 0.02) / 0.2);
    this.hemi.color.set('#9fbbe0').lerp(this.tmp.set('#f0a878'), dusk * 0.6).lerp(this.tmp.set('#2b3f6a'), env.night * 0.9);
    this.hemi.groundColor.set('#8a7a66').lerp(this.tmp.set('#2a2a30'), env.night * 0.9);
    const amb = lerp(0.22, 0.62, day) * (1 - 0.35 * rain) + dusk * 0.12;
    // indoors the 'ground' bounce is pale floor tile and plaster, not brown earth: lifts ceilings out of the muddy brown
    this.hemi.groundColor.lerp(this.tmp.set('#d9d0c2').multiplyScalar(0.25 + 0.75 * (1 - env.night * 0.8)), indoor * 0.85);
    this.hemi.intensity = amb * lerp(1, 0.95, indoor);
    this.scene.environmentIntensity = lerp(0.03, 0.55, day) * (1 - 0.4 * rain) * lerp(1, 0.7, indoor);
    // fog
    this.fogCol.set('#c3d3de').lerp(this.tmp.set('#e6b08c'), dusk * 0.7).lerp(this.tmp.set('#0a111d'), env.night).lerp(this.tmp.set('#8d979f').multiplyScalar(0.35 + 0.65 * day), rain * 0.8);
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogCol);
    (this.scene.fog as THREE.FogExp2).density = lerp(0.0036, 0.011, rain) * lerp(1, 1.3, env.night);
    this.renderer.toneMappingExposure = lerp(1.15, 0.78, day) * lerp(1, 1.8, indoor) * (1 + 0.2 * (1 - day) * 0);
  }
  /** Scratch objects reused every frame (no allocation in `update`). */
  private readonly moonDir = new THREE.Vector3();
  private readonly noon = new THREE.Color('#fff3e0');
}

export function makeEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const sc = new THREE.Scene();
  const g = new THREE.SphereGeometry(50, 32, 16), c: number[] = [], p = g.attributes.position, col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    if (y > 0) col.set('#c9ddf5').lerp(new THREE.Color('#6a9be0'), Math.pow(y, 0.6)); else col.set('#b8a58c').lerp(new THREE.Color('#4a4238'), Math.pow(-y, 0.6));
    if (Math.abs(y) < 0.08) col.set('#f3ead8');
    c.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), new THREE.MeshBasicMaterial({ color: '#fff4d8' })); sun.position.set(25, 30, 15); sc.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(sc, 0.02).texture; pm.dispose(); return t;
}
