import * as THREE from 'three';
import * as T from './textures';
import { rbox, mesh, lathe, tube, wallPiece, drapedCloth, drapeOverBar, curtain, pillow, paper, worldUV } from './geo';
import { LaptopScreen, PhoneScreen } from './screens';

export const ROOM = { x0: -2.6, x1: 2.6, z0: -2.1, z1: 2.1, h: 2.65 };
export const WIN = { x0: -1.75, x1: 0.35, y0: 0.95, y1: 2.3, depth: 0.22 };

export type Collider = [number, number, number, number];

export interface Apartment {
  colliders: Collider[];
  hits: THREE.Object3D[];
  lights: {
    ceilingSpot: THREE.SpotLight; ceilingFill: THREE.PointLight; deskSpot: THREE.SpotLight; deskFill: THREE.PointLight;
    bedLamp: THREE.PointLight; kitchen: THREE.SpotLight; phone: THREE.PointLight; laptop: THREE.PointLight;
  };
  emissives: { ceiling: THREE.MeshStandardMaterial; desk: THREE.MeshStandardMaterial; bed: THREE.MeshStandardMaterial; kitchen: THREE.MeshStandardMaterial; powerLed: THREE.MeshBasicMaterial; acLed: THREE.MeshBasicMaterial };
  glassPanes: THREE.Mesh[];
  rightSash: THREE.Group;
  phone: THREE.Group;
  phoneScreenMat: THREE.MeshBasicMaterial;
  laptopScreen: LaptopScreen;
  laptopScreenMat: THREE.MeshBasicMaterial;
  phoneScreen: PhoneScreen;
  steam: THREE.Points;
  fridgeDoor: THREE.Group;
  fridgeCollider: Collider;
  fridge: { point: THREE.PointLight; spot: THREE.SpotLight; led: THREE.MeshBasicMaterial; mist: THREE.Points };
  chair: THREE.Group;
  clockHands: { h: THREE.Object3D; m: THREE.Object3D; s: THREE.Object3D };
  updaters: ((t: number, dt: number) => void)[];
  points: Record<string, THREE.Vector3>;
}

function tag(o: THREE.Object3D, id: string, hits: THREE.Object3D[]) {
  o.traverse((c) => { c.userData.id = id; });
  hits.push(o);
}

export function buildApartment(scene: THREE.Scene, cityTexHook: (panes: THREE.Mesh[]) => void): Apartment {
  const root = new THREE.Group();
  scene.add(root);
  const hits: THREE.Object3D[] = [];
  const colliders: Collider[] = [];
  const updaters: ((t: number, dt: number) => void)[] = [];
  const points: Record<string, THREE.Vector3> = {};

  /* ======================= MATERIALS ======================= */
  const floorT = T.floorPlanks();
  [floorT.map, floorT.normalMap!, floorT.roughnessMap!].forEach((t) => t.repeat.set(1 / 1.2, 1 / 1.2));
  const floorMat = new THREE.MeshStandardMaterial({ map: floorT.map, normalMap: floorT.normalMap, roughnessMap: floorT.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xc9bfb4 });
  const wallT = T.plaster();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallT.map, normalMap: wallT.normalMap, roughnessMap: wallT.roughnessMap, normalScale: new THREE.Vector2(0.35, 0.35) });
  const ceilT = T.plaster([232, 228, 220], 8);
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilT.map, normalMap: ceilT.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(0.3, 0.3) });
  const paintWhite = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.45 });
  const deskT = T.deskWood();
  const deskMat = new THREE.MeshStandardMaterial({ map: deskT.map, normalMap: deskT.normalMap, roughnessMap: deskT.roughnessMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  const dwT = T.darkWood();
  const darkWood = new THREE.MeshStandardMaterial({ map: dwT.map, normalMap: dwT.normalMap, roughness: 0.55, normalScale: new THREE.Vector2(0.4, 0.4) });
  const lwMap = deskT.map.clone(); lwMap.repeat.set(3, 3); lwMap.rotation = Math.PI / 2; lwMap.needsUpdate = true;
  const lightWood = new THREE.MeshStandardMaterial({ map: lwMap, color: 0xe6dccb, roughness: 0.6 });
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.7 });
  const brushedT = T.brushed();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.32, metalness: 1, roughnessMap: brushedT });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9b9fa5, roughness: 0.38, metalness: 0.9, roughnessMap: brushedT });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.5, metalness: 0.15 });
  const plasticWhite = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.4 });
  const plasticBlack = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 });
  const granite = new THREE.MeshPhysicalMaterial({ map: T.speckle('#3b3a3c', '#bdb6aa', 9), roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const linen = T.fabric(1, 0.9, 0.35);
  [linen.map, linen.normalMap!].forEach((t) => t.repeat.set(6, 6));
  const sheetMat = new THREE.MeshStandardMaterial({ map: linen.map, normalMap: linen.normalMap, color: 0xe8e4dc, roughness: 0.92, normalScale: new THREE.Vector2(0.5, 0.5) });
  const cotton = T.fabric(4, 1.2, 0.25);
  [cotton.map, cotton.normalMap!].forEach((t) => t.repeat.set(5, 5));
  const duvetMat = new THREE.MeshPhysicalMaterial({ map: cotton.map, normalMap: cotton.normalMap, color: 0x7d8ea0, roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color(0xb8c6d6), sheenRoughness: 0.6, side: THREE.DoubleSide });
  const pillowMat = new THREE.MeshPhysicalMaterial({ map: cotton.map, normalMap: cotton.normalMap, color: 0xeeeae2, roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) });
  const knitT = T.knit();
  [knitT.map, knitT.normalMap!].forEach((t) => t.repeat.set(5, 5));
  const throwMat = new THREE.MeshPhysicalMaterial({ map: knitT.map, normalMap: knitT.normalMap, color: 0xc89a3e, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xffd890), side: THREE.DoubleSide });
  const curtainMat = new THREE.MeshPhysicalMaterial({ map: linen.map, normalMap: linen.normalMap, color: 0x8c9488, roughness: 0.95, sheen: 0.5, sheenColor: new THREE.Color(0xc0c8b8), side: THREE.DoubleSide });
  const hoodieMat = new THREE.MeshPhysicalMaterial({ map: cotton.map, normalMap: cotton.normalMap, color: 0x5a5f66, roughness: 0.95, sheen: 0.8, sheenColor: new THREE.Color(0x9aa0aa), side: THREE.DoubleSide });
  const jacketMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2a3a, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.25, side: THREE.DoubleSide, normalMap: cotton.normalMap });
  const wetGloss = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const ceramic = new THREE.MeshPhysicalMaterial({ map: T.speckle('#d9d3c4', '#6b5d4c', 3), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 });
  const ceramicSage = new THREE.MeshPhysicalMaterial({ map: T.speckle('#8fa392', '#3e4a40', 7), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const terracotta = new THREE.MeshStandardMaterial({ map: T.speckle('#a5583a', '#5e2c1b', 11), roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3e6b35, roughness: 0.55, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x5e8a3e, roughness: 0.5, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.22, clearcoat: 1, specularIntensity: 1, depthWrite: false });
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0xc8dde6, roughness: 0.02, transparent: true, opacity: 0.3, depthWrite: false });
  const coffeeMat = new THREE.MeshPhysicalMaterial({ color: 0x1e120a, roughness: 0.08, clearcoat: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x222224, roughness: 0.9 });
  const cableWhite = new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.55 });
  const cableBlack = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.6 });
  const rugT = T.rug();
  const rugMat = new THREE.MeshStandardMaterial({ color: 0xb0a8a2, map: rugT.map, normalMap: rugT.normalMap, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
  const cardboard = new THREE.MeshStandardMaterial({ map: T.speckle('#a88458', '#6b5232', 13), roughness: 0.95 });

  const ceilingShade = new THREE.MeshStandardMaterial({ color: 0xf7efe2, emissive: new THREE.Color(1, 0.72, 0.45), emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.97 });
  const deskBulb = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.8, 0.55), emissiveIntensity: 0 });
  const bedShade = new THREE.MeshStandardMaterial({ map: linen.map, color: 0xefe3cf, emissive: new THREE.Color(1, 0.62, 0.32), emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide });
  const kitchenStrip = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.9, 0.75), emissiveIntensity: 0 });
  const powerLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.6) });
  const acLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 0.4) });

  /* ======================= ARCHITECTURE ======================= */
  const { x0, x1, z0, z1, h } = ROOM;
  // floor
  const floorGeo = worldUV(new THREE.PlaneGeometry(x1 - x0, z1 - z0), (x1 - x0), (z1 - z0));
  const floor = mesh(floorGeo, floorMat, 0, 0, 0, root, false);
  floor.rotation.x = -Math.PI / 2;
  // ceiling
  const ceil = mesh(worldUV(new THREE.PlaneGeometry(x1 - x0, z1 - z0), 3, 2.5), ceilMat, 0, h, 0, root, false);
  ceil.rotation.x = Math.PI / 2;
  // walls
  const north = new THREE.Group(); north.position.set(0, 0, z0); root.add(north);
  [[x0, x1, 0, WIN.y0], [x0, x1, WIN.y1, h], [x0, WIN.x0, WIN.y0, WIN.y1], [WIN.x1, x1, WIN.y0, WIN.y1]].forEach(([a, b, c, d]) => mesh(wallPiece(a, b, c, d), wallMat, 0, 0, 0, north, false));
  const south = new THREE.Group(); south.position.set(0, 0, z1); south.rotation.y = Math.PI; root.add(south);
  mesh(wallPiece(-x1, -x0, 0, h), wallMat, 0, 0, 0, south, false);
  const west = new THREE.Group(); west.position.set(x0, 0, 0); west.rotation.y = Math.PI / 2; root.add(west);
  mesh(wallPiece(-z1, -z0, 0, h), wallMat, 0, 0, 0, west, false);
  const east = new THREE.Group(); east.position.set(x1, 0, 0); east.rotation.y = -Math.PI / 2; root.add(east);
  mesh(wallPiece(z0, z1, 0, h), wallMat, 0, 0, 0, east, false);
  // walls receive shadows
  [north, south, west, east].forEach((g) => g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.receiveShadow = true; }));

  // window reveals (wall thickness)
  const D = WIN.depth;
  const revL = mesh(wallPiece(0, D, WIN.y0, WIN.y1), wallMat, WIN.x0, 0, z0, root, false); revL.rotation.y = Math.PI / 2; revL.position.z = z0; revL.position.x = WIN.x0;
  revL.geometry.translate(0, 0, 0);
  const revR = mesh(wallPiece(-D, 0, WIN.y0, WIN.y1), wallMat, WIN.x1, 0, z0, root, false); revR.rotation.y = -Math.PI / 2;
  const revT = mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, D), wallMat, (WIN.x0 + WIN.x1) / 2, WIN.y1, z0 - D / 2, root, false); revT.rotation.x = Math.PI / 2;
  // granite sill
  mesh(rbox(WIN.x1 - WIN.x0 + 0.12, 0.035, D + 0.06, 0.006), granite, (WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.0175, z0 - D / 2 + 0.03, root);
  // skirting boards
  const sk = (len: number, x: number, z: number, ry: number) => { const m = mesh(rbox(len, 0.08, 0.014, 0.004), paintWhite, x, 0.04, z, root, false); m.rotation.y = ry; };
  sk(x1 - x0, 0, z0 + 0.007, 0); sk(x1 - x0, 0, z1 - 0.007, 0); sk(z1 - z0, x0 + 0.007, 0, Math.PI / 2); sk(z1 - z0, x1 - 0.007, 0, Math.PI / 2);
  // cornice shadow line
  const cornice = (len: number, x: number, z: number, ry: number) => { const m = mesh(rbox(len, 0.04, 0.03, 0.01), paintWhite, x, h - 0.02, z, root, false); m.rotation.y = ry; };
  cornice(x1 - x0, 0, z0 + 0.015, 0); cornice(x1 - x0, 0, z1 - 0.015, 0); cornice(z1 - z0, x0 + 0.015, 0, Math.PI / 2); cornice(z1 - z0, x1 - 0.015, 0, Math.PI / 2);

  // water stain on the ceiling near the window corner (old leak, darker tonight)
  {
    const c = T.canvas(256, 256); const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
    g.addColorStop(0, 'rgba(150,120,70,0.10)'); g.addColorStop(0.75, 'rgba(140,105,60,0.16)'); g.addColorStop(0.82, 'rgba(110,80,40,0.32)'); g.addColorStop(0.9, 'rgba(140,110,60,0.0)');
    ctx.fillStyle = g; ctx.beginPath();
    for (let a = 0; a < 6.3; a += 0.2) { const rr = 110 + Math.sin(a * 3) * 10 + Math.sin(a * 7) * 6; ctx.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
    ctx.fill();
    const stain = mesh(new THREE.PlaneGeometry(0.7, 0.55), new THREE.MeshStandardMaterial({ map: T.toTex(c), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 2.2, h - 0.002, -1.85, root, false);
    stain.rotation.x = Math.PI / 2;
  }
  // grubby finger marks around the light switch
  {
    const c = T.canvas(128, 128); const ctx = c.getContext('2d')!;
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(60,50,40,${Math.random() * 0.06})`; ctx.beginPath(); ctx.arc(64 + (Math.random() - 0.5) * 70, 64 + (Math.random() - 0.5) * 80, 3 + Math.random() * 8, 0, 7); ctx.fill(); }
    const sm = mesh(new THREE.PlaneGeometry(0.22, 0.26), new THREE.MeshStandardMaterial({ map: T.toTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 0.52, 1.2, z1 - 0.002, root, false);
    sm.rotation.y = Math.PI;
  }

  /* ======================= WINDOW ======================= */
  const winG = new THREE.Group(); root.add(winG);
  const wz = z0 - 0.15;
  const fw = 0.045;
  const W = WIN.x1 - WIN.x0, Hh = WIN.y1 - WIN.y0, cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2;
  mesh(rbox(W, fw, 0.1, 0.006), frameMat, cx, WIN.y0 + fw / 2, wz, winG);
  mesh(rbox(W, fw, 0.1, 0.006), frameMat, cx, WIN.y1 - fw / 2, wz, winG);
  mesh(rbox(fw, Hh, 0.1, 0.006), frameMat, WIN.x0 + fw / 2, cy, wz, winG);
  mesh(rbox(fw, Hh, 0.1, 0.006), frameMat, WIN.x1 - fw / 2, cy, wz, winG);
  // track rails
  mesh(rbox(W, 0.012, 0.09, 0.003), alu, cx, WIN.y0 + fw + 0.006, wz, winG);
  const glassPanes: THREE.Mesh[] = [];
  const sashW = W / 2 + 0.03, sashH = Hh - fw * 2;
  const mkSash = (sx: number, sz: number, seed: number) => {
    const s = new THREE.Group(); s.position.set(sx, cy, sz); winG.add(s);
    const b = 0.04;
    mesh(rbox(sashW, b, 0.035, 0.005), frameMat, 0, sashH / 2 - b / 2, 0, s);
    mesh(rbox(sashW, b, 0.035, 0.005), frameMat, 0, -sashH / 2 + b / 2, 0, s);
    mesh(rbox(b, sashH, 0.035, 0.005), frameMat, -sashW / 2 + b / 2, 0, 0, s);
    mesh(rbox(b, sashH, 0.035, 0.005), frameMat, sashW / 2 - b / 2, 0, 0, s);
    // little latch
    mesh(rbox(0.018, 0.08, 0.02, 0.004), alu, sashW / 2 - b / 2, 0, 0.025, s);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(sashW - b * 2, sashH - b * 2), new THREE.MeshBasicMaterial());
    pane.userData.seed = seed;
    pane.castShadow = false;
    s.add(pane);
    glassPanes.push(pane);
    return s;
  };
  mkSash(WIN.x0 + sashW / 2 + 0.02, wz + 0.022, 1.7);
  const rightSash = mkSash(WIN.x1 - sashW / 2 - 0.02, wz - 0.022, 9.3);
  cityTexHook(glassPanes);
  tag(winG, 'window', hits);
  points.window = new THREE.Vector3(cx, cy, z0);

  // curtain rod + curtains
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.2, 12).rotateZ(Math.PI / 2), blackMetal, -0.7, 2.44, z0 + 0.09, root);
  [-2.28, 0.86].forEach((x) => { mesh(new THREE.SphereGeometry(0.02, 12, 8), blackMetal, x, 2.44, z0 + 0.09, root); mesh(rbox(0.02, 0.02, 0.09, 0.005), blackMetal, x + (x < 0 ? 0.05 : -0.05), 2.44, z0 + 0.045, root); });
  const cL = mesh(curtain(0.62, 1.62, 6, 0.045, 2), curtainMat, -1.93, 2.42, z0 + 0.1, root);
  const cR = mesh(curtain(0.34, 2.36, 4, 0.05, 5), curtainMat, 0.45, 2.42, z0 + 0.09, root);
  for (let i = 0; i < 9; i++) { mesh(new THREE.TorusGeometry(0.02, 0.003, 6, 16), blackMetal, -2.2 + i * 0.07, 2.44, z0 + 0.09, root); }
  void cL; void cR;

  /* ======================= DESK ======================= */
  const desk = new THREE.Group(); root.add(desk);
  const DX = -1.65, DZ = -1.77, DY = 0.74;
  mesh(rbox(1.4, 0.03, 0.65, 0.008), deskMat, DX, DY - 0.015, DZ, desk);
  [[-0.66, -0.29], [0.66, -0.29], [-0.66, 0.29], [0.66, 0.29]].forEach(([dx, dz]) => mesh(rbox(0.03, DY - 0.03, 0.03, 0.004), blackMetal, DX + dx, (DY - 0.03) / 2, DZ + dz, desk));
  mesh(rbox(1.3, 0.02, 0.02, 0.004), blackMetal, DX, DY - 0.08, DZ - 0.29, desk);
  colliders.push([-2.4, -0.9, -2.1, -1.42]);
  points.desk = new THREE.Vector3(DX, DY, DZ);

  // --- laptop ---
  const laptop = new THREE.Group(); laptop.position.set(-1.62, DY, -1.7); laptop.rotation.y = 0.06; desk.add(laptop);
  const lw = 0.32, ld = 0.22;
  mesh(rbox(lw, 0.014, ld, 0.006), alu, 0, 0.007, 0, laptop);
  // keyboard
  {
    const c = T.canvas(512, 300); const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#8f9399'; ctx.fillRect(0, 0, 512, 300);
    ctx.fillStyle = '#1d1e21'; ctx.fillRect(20, 10, 472, 190);
    const rows = [13, 13, 12, 11, 9];
    rows.forEach((n, ri) => { const kw = 472 / 14; for (let k = 0; k < n; k++) { ctx.fillStyle = '#2b2c30'; ctx.fillRect(26 + k * kw + ri * 6, 16 + ri * 36, kw - 5, 31); } });
    ctx.fillStyle = '#2b2c30'; ctx.fillRect(150, 160, 210, 32);
    ctx.fillStyle = '#868a90'; ctx.fillRect(160, 212, 192, 80);
    ctx.strokeStyle = '#7a7e84'; ctx.strokeRect(160, 212, 192, 80);
    // worn shiny keys
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(26 + 4 * 33, 88, 120, 30);
    const kb = mesh(new THREE.PlaneGeometry(lw - 0.012, ld - 0.012), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.5, metalness: 0.3 }), 0, 0.0142, 0, laptop, false);
    kb.rotation.x = -Math.PI / 2;
  }
  const lid = new THREE.Group(); lid.position.set(0, 0.014, -ld / 2 + 0.004); lid.rotation.x = -0.32; laptop.add(lid);
  mesh(rbox(lw, ld, 0.006, 0.005), alu, 0, ld / 2, -0.003, lid);
  const laptopScreen = new LaptopScreen();
  const laptopScreenMat = new THREE.MeshBasicMaterial({ map: laptopScreen.tex, color: 0x000000 });
  mesh(new THREE.PlaneGeometry(lw - 0.012, ld - 0.016), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 }), 0, ld / 2, 0.0004, lid, false);
  mesh(new THREE.PlaneGeometry(lw - 0.026, (lw - 0.026) * 0.625), laptopScreenMat, 0, ld / 2 + 0.003, 0.0008, lid, false);
  // power LED
  mesh(new THREE.BoxGeometry(0.004, 0.001, 0.002), powerLed, 0.13, 0.008, ld / 2 + 0.0005, laptop, false);
  tag(laptop, 'laptop', hits);
  const laptopLight = new THREE.PointLight(0x9fb4ff, 0, 1.6, 2);
  laptopLight.position.set(-1.62, DY + 0.3, -1.25);
  root.add(laptopLight);
  points.laptop = new THREE.Vector3(-1.62, DY + 0.1, -1.7);
  // laptop charger cable down behind the desk to the power strip
  mesh(tube([new THREE.Vector3(-1.79, DY + 0.006, -1.66), new THREE.Vector3(-1.9, DY + 0.004, -1.62), new THREE.Vector3(-1.98, DY + 0.003, -1.9), new THREE.Vector3(-2.0, DY + 0.002, -2.07), new THREE.Vector3(-2.02, 0.5, -2.09), new THREE.Vector3(-2.06, 0.05, -2.06), new THREE.Vector3(-2.15, 0.012, -1.95)], 0.0028), cableWhite, 0, 0, 0, desk);
  // power strip on the floor
  mesh(rbox(0.32, 0.035, 0.06, 0.008), plasticWhite, -2.15, 0.018, -1.92, desk);
  [0, 1, 2].forEach((i) => mesh(rbox(0.04, 0.03, 0.035, 0.005), plasticBlack, -2.26 + i * 0.07, 0.045, -1.92, desk));
  mesh(new THREE.BoxGeometry(0.006, 0.004, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.2, 0.1) }), -2.03, 0.037, -1.92, desk, false);

  // --- desk lamp (anglepoise) ---
  const lampG = new THREE.Group(); lampG.position.set(-2.18, DY, -1.98); desk.add(lampG);
  mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.018, 32), blackMetal, 0, 0.009, 0, lampG);
  const arm1 = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.36, 8), blackMetal, 0.04, 0.18, 0.03, lampG); arm1.rotation.z = -0.25; arm1.rotation.x = 0.15;
  const arm2 = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 8), blackMetal, 0.17, 0.39, 0.1, lampG); arm2.rotation.z = -1.15; arm2.rotation.x = 0.3;
  mesh(new THREE.SphereGeometry(0.012, 10, 8), blackMetal, 0.085, 0.35, 0.055, lampG);
  const shade = new THREE.Group(); shade.position.set(0.3, 0.42, 0.17); shade.rotation.set(0.5, 0, -0.9); lampG.add(shade);
  mesh(lathe([[0.012, 0.06], [0.025, 0.05], [0.04, 0.02], [0.065, -0.04], [0.066, -0.045]], 32), new THREE.MeshStandardMaterial({ color: 0x2f4a3f, roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide }), 0, 0, 0, shade);
  mesh(new THREE.SphereGeometry(0.022, 16, 12), deskBulb, 0, -0.01, 0, shade, false);
  const deskSpot = new THREE.SpotLight(0xffd7a8, 0, 4, 0.95, 0.65, 2);
  const deskTarget = new THREE.Object3D(); deskTarget.position.set(-1.55, DY, -1.62); root.add(deskTarget);
  deskSpot.target = deskTarget;
  shade.updateMatrixWorld(true);
  root.updateMatrixWorld(true);
  const sp = new THREE.Vector3(); shade.getWorldPosition(sp);
  // The hand-set Euler left the shade's opening facing back toward the base, away from where the
  // spot shines (it looked upside down). Turn the shade so its open end (local -Y) faces the target.
  {
    const tp = new THREE.Vector3(); deskTarget.getWorldPosition(tp);
    const dir = tp.sub(sp).normalize();
    const parentQ = new THREE.Quaternion(); lampG.getWorldQuaternion(parentQ);
    dir.applyQuaternion(parentQ.invert());
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    shade.updateMatrixWorld(true);
  }
  deskSpot.position.copy(sp).add(new THREE.Vector3(0, -0.03, 0));
  deskSpot.castShadow = true; deskSpot.shadow.mapSize.set(1024, 1024); deskSpot.shadow.bias = -0.0004; deskSpot.shadow.normalBias = 0.01; deskSpot.shadow.camera.near = 0.03;
  root.add(deskSpot);
  const deskFill = new THREE.PointLight(0xffc890, 0, 2.5, 2); deskFill.position.copy(sp).add(new THREE.Vector3(0, 0.05, 0)); root.add(deskFill);
  tag(lampG, 'desklamp', hits);

  // --- mug of cold coffee ---
  const mug = new THREE.Group(); mug.position.set(-1.13, DY, -1.57); desk.add(mug);
  mesh(lathe([[0, 0], [0.036, 0], [0.04, 0.004], [0.042, 0.02], [0.043, 0.09], [0.044, 0.094], [0.041, 0.096], [0.038, 0.09], [0.037, 0.012], [0.0, 0.01]], 48), ceramicSage, 0, 0, 0, mug);
  const handle = mesh(new THREE.TorusGeometry(0.026, 0.0075, 12, 28, Math.PI * 1.25), ceramicSage, 0.045, 0.05, 0, mug); handle.rotation.z = -Math.PI * 0.62;
  const coffee = mesh(new THREE.CircleGeometry(0.037, 32), coffeeMat, 0, 0.045, 0, mug, false); coffee.rotation.x = -Math.PI / 2;
  // dried ring on the inner wall
  mesh(new THREE.CylinderGeometry(0.0372, 0.0372, 0.004, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.6, side: THREE.BackSide }), 0, 0.068, 0, mug, false);
  mug.rotation.y = 2.4;
  tag(mug, 'mug', hits);
  points.mug = new THREE.Vector3(-1.13, DY + 0.05, -1.57);

  // --- papers: the note + receipts + envelope ---
  const papers = new THREE.Group(); desk.add(papers);
  const note = mesh(paper(0.105, 0.14, 0.004, 3), new THREE.MeshStandardMaterial({ map: T.noteTexture(), roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.5 }), -1.33, DY + 0.0015, -1.53, papers, false);
  note.rotation.y = 0.32; note.receiveShadow = true;
  tag(note, 'note', hits);
  points.note = new THREE.Vector3(-1.33, DY, -1.53);
  const receipts = new THREE.Group(); papers.add(receipts);
  ([[0, -1.24, -1.72, -0.5, 0.02], [1, -1.08, -1.82, 0.9, 0.012], [2, -1.25, -1.6, 1.25, 0.018]] as [0 | 1 | 2, number, number, number, number][]).forEach(([k, x, z, ry, curl], i) => {
    const m = mesh(paper(0.058, 0.14, curl, 10 + k), new THREE.MeshStandardMaterial({ map: T.receiptTexture(k), roughness: 0.6, side: THREE.DoubleSide }), x, DY + 0.003 + i * 0.0012, z, receipts, false);
    m.rotation.y = ry; m.receiveShadow = true;
  });
  tag(receipts, 'receipts', hits);
  points.receipts = new THREE.Vector3(-1.18, DY, -1.7);
  // envelope (electricity bill, unopened)
  {
    const c = T.canvas(320, 180); const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#efe8d8'; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#1b4f8a'; ctx.fillRect(14, 14, 40, 40);
    ctx.fillStyle = '#333'; ctx.font = 'bold 13px Arial'; ctx.fillText('TỔNG CÔNG TY ĐIỆN LỰC TP.HCM', 62, 30); ctx.font = '11px Arial'; ctx.fillText('Thông báo tiền điện kỳ 10/2025', 62, 48);
    ctx.font = '14px Arial'; ctx.fillText('Kính gửi: Ng. T. M. An', 120, 120); ctx.fillText('P. 6.07, 214 Lê Văn Sỹ', 120, 140);
    const env = mesh(paper(0.22, 0.12, 0.002, 7), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.8 }), -1.95, DY + 0.0018, -1.5, papers, false);
    env.rotation.y = -0.15;
  }
  // pen + pencil
  const pen = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a3d8a, roughness: 0.35 }), -1.41, DY + 0.0045, -1.6, desk);
  pen.rotation.y = 0.9;
  const pencil = mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.16, 6).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe5b73b, roughness: 0.5 }), -1.06, DY + 0.0038, -1.43, desk);
  pencil.rotation.y = -0.3;
  // notebooks stack
  const nb = new THREE.Group(); nb.position.set(-2.12, DY, -1.62); nb.rotation.y = 0.12; desk.add(nb);
  [[0x2d3e50, 0.24, 0.012], [0x8a3b2e, 0.21, 0.016], [0xd9cfb8, 0.2, 0.01], [0x4b6b4a, 0.18, 0.022]].forEach(([c, w, t], i) => {
    const m = mesh(rbox(w, t, w * 1.35, 0.002), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), (i % 2) * 0.008, 0.01 + i * 0.018, (i % 3) * 0.006, nb);
    m.rotation.y = (i - 1.5) * 0.06;
  });
  // small succulent
  const pot = new THREE.Group(); pot.position.set(-1.0, DY, -2.0); desk.add(pot);
  mesh(lathe([[0, 0], [0.04, 0], [0.05, 0.075], [0.052, 0.08], [0.046, 0.082], [0, 0.07]], 28), terracotta, 0, 0, 0, pot);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, l = 0.03 + (i % 3) * 0.008;
    const leaf = mesh(new THREE.SphereGeometry(1, 10, 8), leafMat2, Math.cos(a) * 0.015, 0.085 + (i % 3) * 0.006, Math.sin(a) * 0.015, pot);
    leaf.scale.set(0.012, l, 0.009); leaf.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
  }
  // plastic water bottle half empty
  const bottle = new THREE.Group(); bottle.position.set(-2.32, DY, -1.78); desk.add(bottle);
  mesh(lathe([[0, 0], [0.032, 0], [0.033, 0.16], [0.03, 0.18], [0.013, 0.21], [0.012, 0.225], [0, 0.225]], 24), new THREE.MeshPhysicalMaterial({ color: 0xdfefff, roughness: 0.08, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false }), 0, 0, 0, bottle, false);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 20), waterMat, 0, 0.041, 0, bottle, false);
  mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x2e7dd1, roughness: 0.4 }), 0, 0.232, 0, bottle);
  mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.05, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x3aa0e0, roughness: 0.5 }), 0, 0.12, 0, bottle);

  // --- desk chair with hoodie ---
  const chair = new THREE.Group(); chair.position.set(-1.5, 0, -1.02); chair.rotation.y = 0.45; root.add(chair);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 12), steel, 0, 0.27, 0, chair);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = mesh(rbox(0.3, 0.025, 0.04, 0.008), plasticBlack, Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15, chair); leg.rotation.y = -a;
    mesh(new THREE.SphereGeometry(0.025, 10, 8), rubber, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, chair);
  }
  mesh(rbox(0.46, 0.07, 0.44, 0.03), new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.85, normalMap: cotton.normalMap }), 0, 0.46, 0, chair);
  const back = mesh(rbox(0.42, 0.5, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.85, normalMap: cotton.normalMap }), 0, 0.78, 0.22, chair); back.rotation.x = -0.12;
  mesh(rbox(0.04, 0.3, 0.03, 0.01), plasticBlack, 0, 0.56, 0.24, chair);
  const hoodie = mesh(drapeOverBar(0.44, 0.38, 0.42, 0.035, 12, 0.05), hoodieMat, 0, 1.03, 0.25, chair);
  hoodie.rotation.x = -0.12;
  colliders.push([-1.85, -1.15, -1.35, -0.7]);
  [-1, 1].forEach((sd) => { mesh(rbox(0.025, 0.2, 0.03, 0.008), plasticBlack, sd * 0.24, 0.58, 0.02, chair); mesh(rbox(0.06, 0.025, 0.24, 0.01), plasticBlack, sd * 0.24, 0.69, -0.03, chair); });
  tag(chair, 'chair', hits);

  // --- calendar & sticky notes on west wall ---
  const cal = mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshStandardMaterial({ map: T.calendarTexture(), roughness: 0.85 }), x0 + 0.004, 1.45, -1.65, root, false);
  cal.rotation.y = Math.PI / 2; cal.rotation.z = 0.015;
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.006, 8).rotateZ(Math.PI / 2), steel, x0 + 0.004, 1.67, -1.65, root, false);
  tag(cal, 'calendar', hits);
  points.calendar = new THREE.Vector3(x0, 1.45, -1.65);
  [[1.3, -1.38, '#f7e36b', 0.08], [1.24, -1.31, '#ff9ec7', -0.1], [1.55, -1.36, '#9fe0ff', 0.04]].forEach(([y, z, col, r], i) => {
    const c = T.canvas(128, 128); const ctx = c.getContext('2d')!; ctx.fillStyle = col as string; ctx.fillRect(0, 0, 128, 128);
    T.handText(ctx, ['VPN?', 'mua pin', 'pass wifi ở sau router'][i], 10, 50, 22, '#223', i + 30);
    const s = mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.8 }), x0 + 0.005 + i * 0.0005, y as number, z as number, root, false);
    s.rotation.y = Math.PI / 2; s.rotation.z = r as number;
  });

  // --- wall shelf above desk: books, framed photo, trailing pothos ---
  const shelf = new THREE.Group(); root.add(shelf);
  mesh(rbox(0.22, 0.022, 0.75, 0.004), lightWood, x0 + 0.11, 1.86, -1.7, shelf);
  [-1.4, -2.0].forEach((z) => mesh(rbox(0.16, 0.03, 0.02, 0.004), blackMetal, x0 + 0.08, 1.835, z, shelf));
  const spines: [string, string, string][] = [['Rừng Na Uy', '#e8e1cf', '#7a1f1f'], ['Atomic Habits', '#f3c94b', '#111'], ['Excel cho DN', '#2d5a8a', '#fff'], ['Nhà Giả Kim', '#d26f3c', '#fff'], ['Sapiens', '#efefef', '#333'], ['Tiếng Anh B2', '#4b7d4a', '#fff']];
  let bz = -2.02;
  spines.forEach(([t, bg, fg], i) => {
    const bh = 0.17 + (i % 3) * 0.025, bt = 0.025 + (i % 2) * 0.012;
    const spine = new THREE.MeshStandardMaterial({ map: T.spineTexture(t, bg, fg), roughness: 0.7 });
    const plain = new THREE.MeshStandardMaterial({ color: bg, roughness: 0.7 });
    const pagesM = new THREE.MeshStandardMaterial({ color: 0xeee6d2, roughness: 0.9 });
    const b = mesh(new THREE.BoxGeometry(0.15, bh, bt), [spine, pagesM, pagesM, pagesM, plain, plain], x0 + 0.1, 1.871 + bh / 2, bz + bt / 2, shelf);
    if (i === 5) { b.rotation.x = 0.25; b.position.z += 0.02; b.position.y -= 0.01; }
    bz += bt + 0.002;
  });
  // framed photo on shelf
  const frame = new THREE.Group(); frame.position.set(x0 + 0.1, 1.871, -1.55); frame.rotation.y = Math.PI / 2 + 0.25; shelf.add(frame);
  mesh(rbox(0.16, 0.125, 0.012, 0.003), darkWood, 0, 0.065, 0, frame);
  const ph = mesh(new THREE.PlaneGeometry(0.13, 0.095), new THREE.MeshStandardMaterial({ map: T.photoTexture(), roughness: 0.3 }), 0, 0.065, 0.0065, frame, false); void ph;
  const fb = mesh(rbox(0.02, 0.1, 0.01, 0.002), darkWood, 0, 0.05, -0.03, frame); fb.rotation.x = 0.35;
  tag(frame, 'photo', hits);
  points.photo = new THREE.Vector3(x0 + 0.1, 1.94, -1.55);
  // pothos in a little pot with trailing vine
  const pothos = new THREE.Group(); pothos.position.set(x0 + 0.11, 1.871, -1.4); shelf.add(pothos);
  mesh(lathe([[0, 0], [0.045, 0], [0.055, 0.09], [0.058, 0.095], [0, 0.085]], 28), ceramic, 0, 0, 0, pothos);
  const heart = new THREE.Shape(); heart.moveTo(0, 0); heart.bezierCurveTo(0.02, 0.012, 0.024, 0.035, 0, 0.05); heart.bezierCurveTo(-0.024, 0.035, -0.02, 0.012, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(heart, 6);
  const vine = (pts: THREE.Vector3[], n: number, seed: number) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh(new THREE.TubeGeometry(curve, 40, 0.0018, 5), leafMat, 0, 0, 0, pothos, false);
    const r = T.rng(seed);
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n);
      const l = mesh(leafGeo, r() < 0.5 ? leafMat : leafMat2, p.x, p.y, p.z, pothos);
      const s = 0.7 + r() * 0.6; l.scale.setScalar(s);
      l.rotation.set(r() * 2 - 1 + 1.2, r() * 6.28, r() * 2 - 1);
    }
  };
  vine([new THREE.Vector3(0, 0.09, 0), new THREE.Vector3(0.08, 0.1, 0.02), new THREE.Vector3(0.14, 0.0, 0.05), new THREE.Vector3(0.15, -0.25, 0.08), new THREE.Vector3(0.14, -0.42, 0.15)], 16, 4);
  vine([new THREE.Vector3(0, 0.09, 0), new THREE.Vector3(0.06, 0.08, -0.05), new THREE.Vector3(0.13, -0.05, -0.12), new THREE.Vector3(0.14, -0.2, -0.2)], 11, 8);
  vine([new THREE.Vector3(0, 0.09, 0), new THREE.Vector3(-0.02, 0.16, 0.02), new THREE.Vector3(0.02, 0.2, 0.05)], 6, 12);

  /* ======================= NIGHTSTAND, PHONE ======================= */
  const NS = { x: 0.83, z: -1.87, w: 0.42, d: 0.42, h: 0.55 };
  const ns = new THREE.Group(); ns.position.set(NS.x, 0, NS.z); root.add(ns);
  mesh(rbox(NS.w, NS.h - 0.06, NS.d, 0.01), darkWood, 0, (NS.h - 0.06) / 2 + 0.06, 0, ns);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.06, 8), darkWood, a * (NS.w / 2 - 0.03), 0.03, b * (NS.d / 2 - 0.03), ns));
  mesh(rbox(NS.w - 0.03, 0.16, 0.012, 0.004), darkWood, 0, NS.h - 0.12, NS.d / 2 + 0.002, ns);
  mesh(new THREE.SphereGeometry(0.011, 12, 8), steel, 0, NS.h - 0.12, NS.d / 2 + 0.014, ns);
  colliders.push([NS.x - NS.w / 2, NS.x + NS.w / 2, -2.1, NS.z + NS.d / 2]);
  const NY = NS.h;
  // bedside lamp: ceramic base + linen drum shade
  const bl = new THREE.Group(); bl.position.set(0.72, NY, -1.97); root.add(bl);
  mesh(lathe([[0, 0], [0.055, 0], [0.065, 0.04], [0.07, 0.1], [0.05, 0.17], [0.02, 0.2], [0.012, 0.21], [0, 0.21]], 36), ceramic, 0, 0, 0, bl);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8), steel, 0, 0.25, 0, bl);
  mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.17, 40, 1, true), bedShade, 0, 0.33, 0, bl);
  mesh(new THREE.SphereGeometry(0.03, 16, 12), deskBulb, 0, 0.3, 0, bl, false);
  const bedLamp = new THREE.PointLight(0xffb36b, 0, 5, 2); bedLamp.position.set(0.72, NY + 0.32, -1.97);
  bedLamp.castShadow = false;
  root.add(bedLamp);
  tag(bl, 'bedlamp', hits);
  // glass of water
  const gl = new THREE.Group(); gl.position.set(0.66, NY, -1.75); root.add(gl);
  mesh(lathe([[0, 0], [0.03, 0], [0.033, 0.1], [0.031, 0.1], [0.028, 0.004], [0, 0.004]], 32), glassMat, 0, 0, 0, gl, false);
  mesh(new THREE.CylinderGeometry(0.0285, 0.028, 0.055, 24), waterMat, 0, 0.032, 0, gl, false);

  // phone (lying face up, charging)
  const phone = new THREE.Group(); phone.position.set(0.93, NY + 0.0045, -1.78); phone.rotation.y = 0.22; root.add(phone);
  const PW = 0.072, PL = 0.152;
  mesh(rbox(PW, 0.0085, PL, 0.004), new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.3, metalness: 0.6 }), 0, 0, 0, phone);
  const phoneScreen = new PhoneScreen();
  const phoneScreenMat = new THREE.MeshBasicMaterial({ map: phoneScreen.tex, color: 0x000000 });
  const scr = mesh(new THREE.PlaneGeometry(PW - 0.005, PL - 0.006), phoneScreenMat, 0, 0.0044, 0, phone, false);
  scr.rotation.x = -Math.PI / 2;
  // case edge
  mesh(new THREE.BoxGeometry(0.006, 0.003, 0.003), plasticBlack, 0, 0.0005, PL / 2 + 0.001, phone, false);
  tag(phone, 'phone', hits);
  // charger + cable from the outlet above the nightstand
  const outlet = new THREE.Group(); outlet.position.set(0.9, 0.66, z0 + 0.002); root.add(outlet);
  mesh(rbox(0.08, 0.12, 0.01, 0.004), plasticWhite, 0, 0, 0.005, outlet);
  mesh(rbox(0.045, 0.045, 0.035, 0.006), plasticWhite, 0, -0.02, 0.025, outlet);
  const pp = new THREE.Vector3(); phone.updateMatrixWorld(true);
  const portW = new THREE.Vector3(0, 0, -PL / 2 - 0.006).applyMatrix4(phone.matrixWorld);
  pp.copy(portW);
  mesh(tube([
    new THREE.Vector3(0.9, 0.62, z0 + 0.03), new THREE.Vector3(0.905, 0.6, z0 + 0.045), new THREE.Vector3(0.92, NY + 0.004, z0 + 0.08),
    new THREE.Vector3(0.82, NY + 0.0032, -1.98), new THREE.Vector3(0.84, NY + 0.0032, -1.9), new THREE.Vector3(0.98, NY + 0.0032, -1.92),
    new THREE.Vector3(pp.x + 0.01, NY + 0.0034, pp.z - 0.03), pp.clone().setY(NY + 0.0042),
  ], 0.0018, 96, 6), cableWhite, 0, 0, 0, root);
  const phoneLight = new THREE.PointLight(0xbcd0ff, 0, 3, 2); phoneLight.position.set(0.93, NY + 0.08, -1.78); root.add(phoneLight);
  points.phone = new THREE.Vector3(0.93, NY, -1.78);

  /* ======================= BED ======================= */
  const bed = new THREE.Group(); root.add(bed);
  const BX = 1.82, BZ = -1.07;
  mesh(rbox(1.52, 0.26, 2.04, 0.015), darkWood, BX, 0.17, BZ, bed);
  mesh(rbox(1.42, 0.2, 1.96, 0.05, 4), sheetMat, BX, 0.4, BZ, bed);
  // upholstered headboard
  mesh(rbox(1.55, 0.75, 0.08, 0.035, 4), new THREE.MeshStandardMaterial({ color: 0x6f675c, roughness: 0.95, normalMap: linen.normalMap, normalScale: new THREE.Vector2(1, 1) }), BX, 0.72, z0 + 0.045, bed);
  const pl1 = mesh(pillow(0.62, 0.16, 0.42, 0.35, 3), pillowMat, 1.5, 0.565, -1.83, bed); pl1.rotation.set(-0.25, 0.08, 0.02);
  const pl2 = mesh(pillow(0.6, 0.15, 0.4, 0.1, 7), pillowMat, 2.14, 0.56, -1.84, bed); pl2.rotation.set(-0.2, -0.12, -0.03);
  // duvet thrown back toward the foot, rumpled
  const duvet = mesh(drapedCloth({ w: 1.75, l: 1.75, segW: 90, segL: 90, hw: 0.72, hl: 0.97, top: 0.535, z0: 0.25, wrinkle: 0.05, seed: 5, fold: 0.3, lump: 0.25 }), duvetMat, BX, 0, BZ, bed);
  duvet.rotation.y = 0.03;
  // knit throw half sliding off the foot
  const thr = mesh(drapedCloth({ w: 0.7, l: 0.55, segW: 40, segL: 30, hw: 0.72, hl: 0.97, top: 0.56, z0: 0.82, wrinkle: 0.025, seed: 9 }), throwMat, BX + 0.35, 0.01, BZ, bed);
  void thr;
  // paperback lying open face-down on the bed
  const book = new THREE.Group(); book.position.set(1.42, 0.62, -1.25); book.rotation.set(0.04, 0.6, 0.02); bed.add(book);
  const bc = new THREE.MeshStandardMaterial({ color: 0x264653, roughness: 0.7 });
  const lp = mesh(rbox(0.12, 0.012, 0.18, 0.003), bc, -0.058, 0, 0, book); lp.rotation.z = 0.16;
  const rp = mesh(rbox(0.12, 0.012, 0.18, 0.003), bc, 0.058, 0, 0, book); rp.rotation.z = -0.16;
  // AC remote
  const remote = mesh(rbox(0.045, 0.015, 0.15, 0.007), plasticWhite, 1.25, 0.56, -1.55, bed); remote.rotation.y = 1.2;
  colliders.push([1.02, 2.6, -2.1, -0.02]);
  tag(bed, 'bed', hits);
  points.bed = new THREE.Vector3(BX, 0.5, BZ);

  // poster above bed + AC unit
  const poster = mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshStandardMaterial({ map: T.posterTexture(), roughness: 0.7 }), x1 - 0.004, 1.55, -0.6, root, false);
  poster.rotation.y = -Math.PI / 2; poster.rotation.z = -0.012;
  [[-0.2, 0.29], [0.2, 0.29]].forEach(([dz, dy]) => mesh(new THREE.BoxGeometry(0.002, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0xdedbd0, transparent: true, opacity: 0.6 }), x1 - 0.005, 1.55 + dy, -0.6 + dz, root, false));
  const ac = new THREE.Group(); ac.position.set(x1 - 0.12, 2.32, -1.35); ac.rotation.y = -Math.PI / 2; root.add(ac);
  mesh(rbox(0.85, 0.28, 0.2, 0.05, 4), plasticWhite, 0, 0, 0, ac);
  mesh(rbox(0.78, 0.03, 0.02, 0.01), new THREE.MeshStandardMaterial({ color: 0xcfccc4, roughness: 0.5 }), 0, -0.1, 0.095, ac);
  mesh(new THREE.BoxGeometry(0.008, 0.008, 0.004), acLed, 0.32, -0.06, 0.1, ac, false);

  /* ======================= WARDROBE ======================= */
  const wd = new THREE.Group(); wd.position.set(x0 + 0.29, 0, -0.1); root.add(wd);
  const inner = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  mesh(rbox(0.02, 2.0, 1.2, 0.004), lightWood, -0.28, 1.0, 0, wd);
  mesh(new THREE.PlaneGeometry(1.16, 1.9).rotateY(Math.PI / 2), inner, -0.268, 1.0, 0, wd, false);
  mesh(rbox(0.58, 0.02, 1.2, 0.004), lightWood, 0, 1.99, 0, wd);
  mesh(rbox(0.58, 0.06, 1.2, 0.004), lightWood, 0, 0.03, 0, wd);
  mesh(rbox(0.58, 2.0, 0.02, 0.004), lightWood, 0, 1.0, -0.59, wd);
  mesh(rbox(0.58, 2.0, 0.02, 0.004), lightWood, 0, 1.0, 0.59, wd);
  mesh(rbox(0.56, 0.02, 0.02, 0.004), lightWood, 0, 1.0, 0, wd);
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.16, 8).rotateX(Math.PI / 2), steel, 0.0, 1.8, 0, wd);
  mesh(rbox(0.012, 1.94, 0.59, 0.004), lightWood, 0.296, 1.0, 0.3, wd);
  const doorAjar = new THREE.Group(); doorAjar.position.set(0.29, 0, -0.595); doorAjar.rotation.y = 0.5; wd.add(doorAjar);
  mesh(rbox(0.018, 1.94, 0.59, 0.004), lightWood, 0.009, 1.0, 0.295, doorAjar);
  mesh(rbox(0.012, 0.18, 0.012, 0.004), steel, 0.03, 1.05, 0.55, doorAjar);
  mesh(rbox(0.012, 0.18, 0.012, 0.004), steel, 0.31, 1.05, 0.05, wd);
  // shirts visible through the gap
  [0x2f3b52, 0xe3ddd1, 0x7b2e2e, 0x50614a].forEach((c, i) => {
    const s = mesh(drapeOverBar(0.4, 0.32, 0.32, 0.01, 30 + i, 0.02), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide, normalMap: cotton.normalMap }), 0.0, 1.8, -0.5 + i * 0.08, wd);
    s.rotation.y = 0.1 * (i - 1.5);
  });
  // cardboard boxes on top (never unpacked)
  mesh(rbox(0.5, 0.3, 0.45, 0.01), cardboard, 0, 2.15, -0.25, wd);
  const box2 = mesh(rbox(0.4, 0.22, 0.38, 0.01), cardboard, 0.02, 2.11, 0.3, wd); box2.rotation.y = 0.1;
  {
    const c = T.canvas(256, 128); const ctx = c.getContext('2d')!; ctx.fillStyle = '#a88458'; ctx.fillRect(0, 0, 256, 128);
    T.handText(ctx, 'ĐỒ MÙA ĐÔNG', 20, 70, 34, '#111', 40);
    const lab = mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.9 }), 0.252, 2.15, -0.25, wd, false); lab.rotation.y = Math.PI / 2;
  }
  colliders.push([x0, x0 + 0.62, -0.75, 0.55]);

  /* ======================= KITCHENETTE ======================= */
  const kit = new THREE.Group(); root.add(kit);
  const KZ = z1 - 0.3;
  // base cabinets
  mesh(rbox(1.4, 0.82, 0.58, 0.008), new THREE.MeshStandardMaterial({ color: 0xcdc6b8, roughness: 0.55 }), -1.3, 0.41 + 0.04, KZ, kit);
  mesh(new THREE.BoxGeometry(1.38, 0.08, 0.52), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }), -1.3, 0.04, KZ + 0.02, kit);
  [-1.82, -1.47, -1.12, -0.78].forEach((x) => { mesh(rbox(0.33, 0.76, 0.015, 0.004), new THREE.MeshStandardMaterial({ color: 0xd9d3c6, roughness: 0.5 }), x, 0.46, KZ - 0.29, kit); mesh(rbox(0.12, 0.012, 0.015, 0.005), steel, x, 0.78, KZ - 0.305, kit); });
  // countertop
  mesh(rbox(1.44, 0.035, 0.62, 0.006), granite, -1.3, 0.885, KZ, kit);
  // sink
  mesh(rbox(0.46, 0.012, 0.4, 0.01), steel, -1.05, 0.906, KZ + 0.02, kit);
  const basin = mesh(new THREE.PlaneGeometry(0.4, 0.34), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.25, metalness: 1 }), -1.05, 0.913, KZ + 0.02, kit, false); basin.rotation.x = -Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.025, 16).rotateX(-Math.PI / 2), plasticBlack, -1.05, 0.914, KZ + 0.02, kit, false);
  mesh(tube([new THREE.Vector3(-1.05, 0.91, KZ + 0.25), new THREE.Vector3(-1.05, 1.15, KZ + 0.25), new THREE.Vector3(-1.05, 1.2, KZ + 0.17), new THREE.Vector3(-1.05, 1.12, KZ + 0.09)], 0.011, 32, 12), steel, 0, 0, 0, kit);
  // a drop hanging from the tap
  mesh(new THREE.SphereGeometry(0.004, 8, 6), waterMat, -1.05, 1.105, KZ + 0.09, kit, false);
  // dish rack with bowl + chopsticks
  const rack = new THREE.Group(); rack.position.set(-0.75, 0.903, KZ + 0.02); kit.add(rack);
  for (let i = 0; i < 7; i++) mesh(new THREE.TorusGeometry(0.11, 0.0025, 4, 20, Math.PI), steel, -0.09 + i * 0.03, 0.02, 0, rack).rotation.y = Math.PI / 2;
  mesh(rbox(0.26, 0.01, 0.3, 0.004), plasticWhite, 0, 0.004, 0, rack);
  const bowl = mesh(lathe([[0, 0], [0.03, 0], [0.032, 0.008], [0.07, 0.05], [0.068, 0.052], [0.028, 0.012], [0, 0.012]], 32), ceramic, 0, 0.08, 0, rack); bowl.rotation.x = 1.2;
  [0, 1].forEach((i) => { const c = mesh(new THREE.CylinderGeometry(0.003, 0.002, 0.24, 6), lightWood, 0.1 + i * 0.008, 0.1, 0.1, rack); c.rotation.x = 0.3; });
  // electric kettle
  const kettle = new THREE.Group(); kettle.position.set(-1.55, 0.903, KZ + 0.08); kit.add(kettle);
  mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.02, 32), plasticBlack, 0, 0.01, 0, kettle);
  mesh(lathe([[0, 0.02], [0.08, 0.02], [0.085, 0.05], [0.08, 0.17], [0.07, 0.22], [0.058, 0.235], [0, 0.235]], 40), steel, 0, 0, 0, kettle);
  const kh = mesh(tube([new THREE.Vector3(0, 0.05, -0.08), new THREE.Vector3(0, 0.07, -0.13), new THREE.Vector3(0, 0.19, -0.13), new THREE.Vector3(0, 0.22, -0.06)], 0.012, 24, 8), plasticBlack, 0, 0, 0, kettle); void kh;
  mesh(lathe([[0.0, 0.18], [0.012, 0.2], [0.02, 0.21]], 16), steel, 0, 0, 0.08, kettle).rotation.x = -0.6;
  const kLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.1, 0.1) });
  mesh(new THREE.BoxGeometry(0.01, 0.006, 0.006), kLed, 0, 0.04, -0.12, kettle, false);
  kettle.rotation.y = 0.5;
  tag(kettle, 'kettle', hits);
  points.kettle = new THREE.Vector3(-1.55, 1.0, KZ + 0.08);
  // rice cooker
  const rc = new THREE.Group(); rc.position.set(-1.85, 0.903, KZ + 0.05); kit.add(rc);
  mesh(lathe([[0, 0], [0.13, 0], [0.14, 0.04], [0.14, 0.17], [0.13, 0.2], [0.09, 0.225], [0, 0.23]], 40), new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, roughness: 0.35, clearcoat: 0.6 }), 0, 0, 0, rc);
  mesh(rbox(0.06, 0.04, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: 0xc04030, roughness: 0.4 }), 0, 0.1, -0.14, rc);
  // instant noodle cups stack + condiments
  const cupTex = (() => { const c = T.canvas(256, 64); const ctx = c.getContext('2d')!; ctx.fillStyle = '#d82e2e'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#fff3c4'; ctx.font = 'bold 26px Arial'; ctx.fillText('HẢO HẢO ★ tôm chua cay', 6, 42); return T.toTex(c); })();
  [0, 1, 2].forEach((i) => mesh(lathe([[0, 0], [0.04, 0], [0.05, 0.1], [0.051, 0.102], [0, 0.102]], 24), new THREE.MeshStandardMaterial({ map: cupTex, roughness: 0.6 }), -1.32 + (i === 2 ? 0.11 : 0), 0.903 + (i === 1 ? 0.035 : 0), KZ + 0.15 - (i === 2 ? 0.05 : 0), kit));
  [[0x6b2c12, 0.24], [0x2a1a10, 0.19]].forEach(([c, hgt], i) => mesh(lathe([[0, 0], [0.028, 0], [0.028, (hgt as number) * 0.7], [0.012, (hgt as number) * 0.85], [0.011, hgt as number], [0, hgt as number]], 20), new THREE.MeshPhysicalMaterial({ color: c as number, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 }), -0.68 + i * 0.07, 0.903, KZ + 0.24, kit));
  // cutting board leaning on the wall
  const cb = mesh(rbox(0.28, 0.4, 0.018, 0.02), lightWood, -1.25, 1.1, z1 - 0.04, kit); cb.rotation.x = 0.12;
  // upper cabinets + under-cabinet light
  mesh(rbox(1.4, 0.6, 0.34, 0.008), new THREE.MeshStandardMaterial({ color: 0xcdc6b8, roughness: 0.55 }), -1.3, 1.85, z1 - 0.17, kit);
  [-1.65, -0.95].forEach((x) => { mesh(rbox(0.68, 0.58, 0.012, 0.004), new THREE.MeshStandardMaterial({ color: 0xd9d3c6, roughness: 0.5 }), x, 1.85, z1 - 0.345, kit); mesh(rbox(0.012, 0.1, 0.015, 0.005), steel, x + (x < -1.3 ? 0.3 : -0.3), 1.62, z1 - 0.36, kit); });
  mesh(new THREE.BoxGeometry(1.2, 0.01, 0.02), kitchenStrip, -1.3, 1.545, z1 - 0.3, kit, false);
  // Under-cabinet strip as a short, wide, shadowless cone: unlike a RectAreaLight it is cheap in every
  // material's shader and its light stops at 3.6 m, so it cannot leak past the kitchen walls.
  const kitchenLight = new THREE.SpotLight(0xffe6c4, 0, 3.6, 1.25, 1, 2);
  kitchenLight.position.set(-1.3, 1.52, z1 - 0.3);
  const kitchenTarget = new THREE.Object3D(); kitchenTarget.position.set(-1.3, 0, z1 - 0.34); root.add(kitchenTarget);
  kitchenLight.target = kitchenTarget;
  root.add(kitchenLight);
  const ksw = mesh(rbox(0.05, 0.03, 0.03, 0.006), plasticWhite, -0.7, 1.545, z1 - 0.32, kit); tag(ksw, 'kitchenlight', hits);
  /* fridge (top freezer; the main door really opens) */
  const fr = new THREE.Group(); fr.position.set(x0 + 0.33, 0, z1 - 0.31); root.add(fr);
  const FW = 0.56, FD = 0.58, FH = 1.45, FT = 0.025;
  const frPaint = new THREE.MeshPhysicalMaterial({ color: 0xdedcd6, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const gasketMat = new THREE.MeshStandardMaterial({ color: 0xb9b9b4, roughness: 0.85 });
  const fGlass = new THREE.MeshPhysicalMaterial({ color: 0xd4eceb, roughness: 0.08, transparent: true, opacity: 0.38, clearcoat: 1, depthWrite: false });
  const fPlastic = new THREE.MeshPhysicalMaterial({ color: 0xe6f0f2, roughness: 0.2, transparent: true, opacity: 0.5, clearcoat: 0.6, depthWrite: false });
  const put = <O extends THREE.Object3D>(o: O, x: number, y: number, z: number, parent: THREE.Object3D, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };
  const labelTex = (w: number, h: number, bg: string, fg: string, lines: string[], accent?: string, fsr = 0.2) => {
    const c = T.canvas(w, h); const x = c.getContext('2d')!;
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (accent) { x.fillStyle = accent; x.fillRect(0, 0, w, h * 0.2); x.fillRect(0, h * 0.82, w, h * 0.18); }
    x.fillStyle = fg; x.textAlign = 'center'; x.font = `bold ${Math.floor(h * fsr)}px Arial`;
    lines.forEach((l, i) => x.fillText(l, w / 2, h * 0.53 + (i - (lines.length - 1) / 2) * h * fsr * 1.2));
    return T.toTex(c);
  };
  const makeBottle = (rad: number, hgt: number, liquid: number, capCol: number, lines: string[], lbg: string, lfg: string, opacity = 0.85) => {
    const g = new THREE.Group();
    const neck = hgt * 0.2, body = hgt - neck - 0.012;
    mesh(lathe([[0, 0], [rad * 0.9, 0], [rad, 0.004], [rad, body], [rad * 0.55, body + neck * 0.55], [rad * 0.3, body + neck], [0, body + neck]], 20), new THREE.MeshPhysicalMaterial({ color: liquid, roughness: 0.1, transparent: true, opacity, clearcoat: 1, depthWrite: false }), 0, 0, 0, g, false);
    mesh(new THREE.CylinderGeometry(rad * 0.33, rad * 0.33, 0.014, 12), new THREE.MeshStandardMaterial({ color: capCol, roughness: 0.45 }), 0, body + neck + 0.005, 0, g);
    if (lines.length) mesh(new THREE.CylinderGeometry(rad * 1.012, rad * 1.012, body * 0.42, 20, 1, true), new THREE.MeshStandardMaterial({ map: labelTex(128, 64, lbg, lfg, lines, undefined, 0.2), roughness: 0.5, side: THREE.DoubleSide }), 0, body * 0.5, 0, g, false);
    return g;
  };
  const makeCan = (col: string, txt: string) => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.115, 20), new THREE.MeshStandardMaterial({ map: labelTex(128, 64, col, '#fff', [txt, '330ml'], '#d4af37', 0.2), roughness: 0.3, metalness: 0.8 }), 0, 0.0575, 0, g);
    mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.004, 20), steel, 0, 0.117, 0, g, false);
    return g;
  };
  const makeJar = (rad: number, hgt: number, content: number, lid: number) => {
    const g = new THREE.Group();
    mesh(lathe([[0, 0], [rad, 0], [rad, hgt], [rad * 0.88, hgt + 0.006]], 24), glassMat, 0, 0, 0, g, false);
    mesh(new THREE.CylinderGeometry(rad * 0.92, rad * 0.92, hgt * 0.72, 20), new THREE.MeshStandardMaterial({ color: content, roughness: 0.55 }), 0, hgt * 0.38, 0, g, false);
    mesh(new THREE.CylinderGeometry(rad * 0.9, rad * 0.9, 0.014, 20), new THREE.MeshStandardMaterial({ color: lid, roughness: 0.4 }), 0, hgt + 0.01, 0, g);
    return g;
  };

  // --- cabinet shell ---
  mesh(rbox(FT, FH, FD, 0.004), frPaint, -FW / 2 + FT / 2, FH / 2, 0, fr);
  mesh(rbox(FT, FH, FD, 0.004), frPaint, FW / 2 - FT / 2, FH / 2, 0, fr);
  mesh(rbox(FW, FT, FD, 0.004), frPaint, 0, FH - FT / 2, 0, fr);
  mesh(rbox(FW, 0.05, FD, 0.004), frPaint, 0, 0.025, 0, fr);
  mesh(rbox(FW, FH, FT, 0.004), frPaint, 0, FH / 2, FD / 2 - FT / 2, fr);
  mesh(rbox(FW - 2 * FT, 0.02, FD - FT, 0.003), frPaint, 0, 0.995, -FT / 2, fr);
  // gasket ring on the cabinet face
  mesh(rbox(0.014, 0.93, 0.01, 0.003), gasketMat, -FW / 2 + 0.032, 0.5, -FD / 2 + 0.004, fr);
  mesh(rbox(0.014, 0.93, 0.01, 0.003), gasketMat, FW / 2 - 0.032, 0.5, -FD / 2 + 0.004, fr);
  // thermostat dial + led strip
  const dial = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 16).rotateX(Math.PI / 2), plasticBlack, 0.17, 0.92, FD / 2 - FT - 0.006, fr);
  void dial;
  mesh(new THREE.BoxGeometry(0.003, 0.012, 0.002), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.17, 0.936, FD / 2 - FT - 0.012, fr, false);
  const fridgeLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  mesh(rbox(0.3, 0.005, 0.03, 0.002), fridgeLed, 0, 0.972, -0.12, fr, false);
  // glass shelves
  [0.3, 0.55, 0.78].forEach((y) => {
    mesh(rbox(0.49, 0.006, 0.43, 0.002), fGlass, 0, y, 0.04, fr, false);
    mesh(rbox(0.49, 0.014, 0.008, 0.002), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 }), 0, y + 0.004, -0.178, fr);
  });
  // crisper drawer with greens, carrots, lemons
  mesh(rbox(0.48, 0.19, 0.44, 0.01), fPlastic, 0, 0.145, 0.03, fr, false);
  mesh(rbox(0.17, 0.014, 0.012, 0.004), frPaint, 0, 0.215, -0.196, fr);
  {
    const rg = T.rng(404);
    for (let i = 0; i < 16; i++) {
      const lf = mesh(new THREE.SphereGeometry(1, 10, 8), rg() < 0.5 ? leafMat : leafMat2, -0.19 + rg() * 0.26, 0.07 + rg() * 0.11, -0.06 + rg() * 0.26, fr, false);
      lf.scale.set(0.045, 0.012, 0.03); lf.rotation.set((rg() - 0.5) * 0.9, rg() * 3, (rg() - 0.5) * 0.9);
    }
    for (let i = 0; i < 3; i++) {
      const c = mesh(new THREE.CylinderGeometry(0.012, 0.003, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0xe0771f, roughness: 0.6 }), 0.16, 0.064 + i * 0.012, -0.04 + i * 0.06, fr, false);
      c.rotation.set(0, 0.2 * i, Math.PI / 2);
    }
    [[0.1, 0.12], [0.14, 0.15]].forEach(([x, z]) => { const l = mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8cf3a, roughness: 0.55 }), x, 0.075, z, fr, false); l.scale.set(0.03, 0.022, 0.022); });
  }
  // shelf A (0.78): milk, eggs, kimchi, yoghurt
  {
    const milk = new THREE.Group(); put(milk, -0.16, 0.783, 0.1, fr, 0.15);
    const mf = new THREE.MeshStandardMaterial({ map: labelTex(128, 256, '#f4f6fb', '#1f4e9c', ['SỮA', 'TƯƠI', 'TIỆT TRÙNG', '1 LÍT'], '#2d6fd1', 0.085), roughness: 0.5 });
    const mp = new THREE.MeshStandardMaterial({ color: 0xf0f3f8, roughness: 0.5 });
    mesh(new THREE.BoxGeometry(0.07, 0.17, 0.07), [mp, mp, mp, mp, mp, mf], 0, 0.085, 0, milk);
    mesh(rbox(0.07, 0.03, 0.014, 0.004), mp, 0, 0.185, 0, milk);
    mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0x2d6fd1, roughness: 0.4 }), 0.015, 0.176, 0.02, milk);
    const eg = new THREE.Group(); put(eg, 0.0, 0.783, 0.03, fr, -0.1);
    mesh(rbox(0.13, 0.03, 0.09, 0.006), new THREE.MeshStandardMaterial({ color: 0xa9a496, roughness: 0.95 }), 0, 0.015, 0, eg);
    for (let i = 0; i < 6; i++) { if (i === 4) continue; const e = mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe9d8bd, roughness: 0.55 }), -0.04 + (i % 3) * 0.04, 0.045, -0.02 + Math.floor(i / 3) * 0.04, eg); e.scale.set(0.017, 0.023, 0.017); }
    put(makeJar(0.04, 0.11, 0xb53a22, 0xd9d3c4), 0.16, 0.783, 0.1, fr);
    [0, 1].forEach((i) => mesh(lathe([[0, 0], [0.024, 0], [0.028, 0.05], [0.0, 0.05]], 16), new THREE.MeshStandardMaterial({ map: labelTex(64, 64, '#fff', '#c2185b', ['DÂU'], '#f06292', 0.22), roughness: 0.5 }), 0.14 + i * 0.055, 0.783, -0.06, fr));
  }
  // shelf B (0.55): covered bowl, tofu, leftovers, tomatoes
  {
    const bw = new THREE.Group(); put(bw, -0.1, 0.553, 0.08, fr);
    mesh(lathe([[0, 0], [0.032, 0], [0.034, 0.006], [0.078, 0.055], [0.075, 0.058], [0.03, 0.012], [0, 0.012]], 32), ceramic, 0, 0, 0, bw);
    const soup = mesh(new THREE.CircleGeometry(0.062, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a5a22, roughness: 0.3 }), 0, 0.04, 0, bw, false);
    void soup;
    mesh(new THREE.CircleGeometry(0.085, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }), 0, 0.058, 0, bw, false);
    const lo = new THREE.Group(); put(lo, 0.14, 0.553, 0.1, fr, 0.2);
    mesh(rbox(0.17, 0.07, 0.12, 0.008), fPlastic, 0, 0.035, 0, lo, false);
    mesh(rbox(0.15, 0.045, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.85 }), 0, 0.03, 0, lo, false);
    mesh(rbox(0.172, 0.012, 0.122, 0.004), new THREE.MeshStandardMaterial({ color: 0x3f7fd0, roughness: 0.4 }), 0, 0.076, 0, lo);
    mesh(rbox(0.1, 0.04, 0.075, 0.006), fPlastic, 0.08, 0.573, -0.07, fr, false);
    mesh(rbox(0.085, 0.028, 0.06, 0.006), new THREE.MeshStandardMaterial({ color: 0xf3ecd8, roughness: 0.8 }), 0.08, 0.566, -0.07, fr, false);
    [[-0.19, -0.06], [-0.15, -0.09], [-0.2, -0.0]].forEach(([x, z]) => {
      const t = mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc9301f, roughness: 0.35 }), x, 0.58, z, fr); t.scale.set(0.03, 0.025, 0.03);
      mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 6), leafMat, x, 0.605, z, fr, false);
    });
  }
  // shelf C (0.30): beer cans, bread, butter
  {
    [['#1f6e3a', 'SAIGON'], ['#1f6e3a', 'SAIGON'], ['#b3202a', '333']].forEach(([c, t], i) => put(makeCan(c, t), -0.19 + i * 0.07, 0.303, 0.1, fr, i));
    const bread = new THREE.Group(); put(bread, 0.13, 0.303, 0.08, fr, 0.1);
    mesh(rbox(0.13, 0.075, 0.23, 0.025, 4), new THREE.MeshPhysicalMaterial({ color: 0xe6cb98, roughness: 0.35, clearcoat: 0.7, transparent: true, opacity: 0.92 }), 0, 0.0375, 0, bread);
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 8), new THREE.MeshStandardMaterial({ color: 0x2d6fd1 }), 0, 0.07, 0.112, bread, false);
    mesh(rbox(0.1, 0.028, 0.07, 0.006), plasticWhite, -0.04, 0.317, -0.05, fr);
    mesh(rbox(0.07, 0.02, 0.05, 0.004), new THREE.MeshStandardMaterial({ color: 0xf0d46a, roughness: 0.35 }), -0.04, 0.325, -0.05, fr);
  }

  // --- the door: hinged on the wall side ---
  const fdoor = new THREE.Group(); fdoor.position.set(-FW / 2, 0, -FD / 2); fr.add(fdoor);
  const DH = 0.955, DY0 = 0.03;
  mesh(rbox(FW, DH, 0.05, 0.012, 4), frPaint, FW / 2, DY0 + DH / 2, -0.025, fdoor);
  mesh(rbox(0.016, DH - 0.04, 0.012, 0.004), gasketMat, 0.022, DY0 + DH / 2, 0.006, fdoor);
  mesh(rbox(0.016, DH - 0.04, 0.012, 0.004), gasketMat, FW - 0.022, DY0 + DH / 2, 0.006, fdoor);
  mesh(rbox(FW - 0.04, 0.016, 0.012, 0.004), gasketMat, FW / 2, DY0 + DH - 0.02, 0.006, fdoor);
  mesh(rbox(FW - 0.04, 0.016, 0.012, 0.004), gasketMat, FW / 2, DY0 + 0.02, 0.006, fdoor);
  mesh(rbox(0.022, 0.32, 0.03, 0.008), alu, FW - 0.05, DY0 + DH - 0.22, -0.066, fdoor);
  // door bins
  [0.14, 0.4, 0.66].forEach((y) => {
    mesh(rbox(0.46, 0.006, 0.07, 0.002), fPlastic, 0.28, y, 0.045, fdoor, false);
    mesh(rbox(0.46, 0.045, 0.005, 0.002), fPlastic, 0.28, y + 0.0225, 0.08, fdoor, false);
    [0.05, 0.51].forEach((x) => mesh(rbox(0.005, 0.06, 0.07, 0.002), fPlastic, x, y + 0.03, 0.045, fdoor, false));
  });
  put(makeBottle(0.034, 0.25, 0xcfe6f2, 0x2e7dd1, ['NƯỚC', 'SUỐI'], '#e6f4fb', '#1a5fa8', 0.5), 0.1, 0.143, 0.045, fdoor);
  put(makeBottle(0.03, 0.21, 0xd8b45a, 0xe0b020, ['TRÀ', 'XANH'], '#cde8c0', '#25672a', 0.75), 0.18, 0.143, 0.045, fdoor);
  put(makeBottle(0.028, 0.2, 0x6b3a12, 0xd4af37, ['BIA', 'HƠI'], '#e8d9a0', '#6b3a12', 0.9), 0.27, 0.143, 0.045, fdoor);
  put(makeBottle(0.026, 0.17, 0x23100a, 0xc02020, ['XÌ', 'DẦU'], '#f4e9c8', '#7a1810', 0.95), 0.1, 0.403, 0.045, fdoor);
  put(makeBottle(0.024, 0.18, 0xa5561a, 0x2a5fb0, ['NƯỚC', 'MẮM'], '#f5ecd2', '#8a3f10', 0.85), 0.19, 0.403, 0.045, fdoor);
  put(makeBottle(0.022, 0.15, 0xc62a1a, 0xffffff, ['TƯƠNG', 'ỚT'], '#f6dede', '#a01a10', 0.9), 0.28, 0.403, 0.045, fdoor);
  put(makeBottle(0.026, 0.16, 0xaa1c14, 0x1c7a3a, ['KETCH', 'UP'], '#f4efe0', '#aa1c14', 0.95), 0.37, 0.403, 0.045, fdoor);
  mesh(rbox(0.1, 0.05, 0.05, 0.006), new THREE.MeshStandardMaterial({ map: labelTex(128, 64, '#f2e08a', '#6b4d00', ['BƠ', 'LẠT'], '#d4a017', 0.2), roughness: 0.5 }), 0.12, 0.69, 0.045, fdoor);
  put(makeJar(0.028, 0.07, 0x5a1d52, 0xb03a48), 0.25, 0.663, 0.045, fdoor);
  [0.35, 0.42].forEach((x) => mesh(lathe([[0, 0], [0.022, 0], [0.026, 0.055], [0, 0.055]], 16), new THREE.MeshStandardMaterial({ map: labelTex(64, 64, '#fff', '#c2185b', ['SỮA', 'CHUA'], '#f06292', 0.2), roughness: 0.5 }), x, 0.663, 0.045, fdoor));
  // door front: take-away menu, postcard, magnets
  {
    const c = T.canvas(256, 360); const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff8e8'; ctx.fillRect(0, 0, 256, 360);
    ctx.fillStyle = '#b5281c'; ctx.font = 'bold 28px Arial'; ctx.fillText('BÚN BÒ CÔ BA', 18, 44); ctx.fillStyle = '#333'; ctx.font = '15px Arial';
    ['Bún bò đặc biệt ....... 55k', 'Bún bò giò ............. 45k', 'Bún chả cua ........... 40k', 'Trà đá ..................... 3k', '', 'GIAO TẬN NHÀ', '0909 xxx 214'].forEach((l, i) => ctx.fillText(l, 18, 90 + i * 30));
    const menu = mesh(new THREE.PlaneGeometry(0.17, 0.24), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.8 }), 0.2, 0.7, -0.0515, fdoor, false); menu.rotation.y = Math.PI; menu.rotation.z = 0.05;
    const pc = mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ map: T.photoTexture(), roughness: 0.4 }), 0.37, 0.38, -0.0515, fdoor, false); pc.rotation.y = Math.PI; pc.rotation.z = -0.1;
    [[0x2a9d8f, 0.13, 0.8], [0xe76f51, 0.28, 0.6], [0xe9c46a, 0.36, 0.43], [0x264653, 0.4, 0.33]].forEach(([col, x, y]) => mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), x, y, -0.054, fdoor));
    // sticky reminder on the freezer
    const sc2 = T.canvas(128, 128); const sx = sc2.getContext('2d')!; sx.fillStyle = '#ffd96b'; sx.fillRect(0, 0, 128, 128); T.handText(sx, 'mua', 14, 50, 30, '#223', 61); T.handText(sx, 'trứng!', 14, 92, 30, '#223', 62);
    const st = mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshStandardMaterial({ map: T.toTex(sc2), roughness: 0.8 }), 0.1, 1.28, -FD / 2 - 0.0515, fr, false); st.rotation.y = Math.PI; st.rotation.z = 0.07;
  }
  // freezer door (static) + badge
  mesh(rbox(FW, 0.435, 0.05, 0.012, 4), frPaint, 0, 1.2175, -FD / 2 - 0.025, fr);
  mesh(rbox(0.022, 0.16, 0.03, 0.008), alu, 0.22, 1.12, -FD / 2 - 0.065, fr);
  mesh(new THREE.BoxGeometry(FW - 0.02, 0.004, 0.01), plasticBlack, 0, 0.996, -FD / 2 - 0.02, fr, false);
  {
    const c = T.canvas(128, 40); const ctx = c.getContext('2d')!; ctx.fillStyle = '#b8bcc2'; ctx.fillRect(0, 0, 128, 40); ctx.fillStyle = '#333'; ctx.font = 'italic bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText('HOMI', 64, 29);
    const bd = mesh(new THREE.PlaneGeometry(0.06, 0.019), new THREE.MeshStandardMaterial({ map: T.toTex(c), metalness: 0.8, roughness: 0.3 }), -0.15, 1.4, -FD / 2 - 0.0515, fr, false); bd.rotation.y = Math.PI;
  }
  tag(fr, 'fridge', hits);
  points.fridge = new THREE.Vector3(x0 + 0.33, 1.15, z1 - 0.6);
  const fridgeCollider: Collider = [100, 100, 100, 100];
  colliders.push(fridgeCollider);
  const frPoint = new THREE.PointLight(0xe6f0ff, 0, 1.4, 2); frPoint.position.set(fr.position.x, 0.78, fr.position.z - 0.05); root.add(frPoint);
  const frSpot = new THREE.SpotLight(0xdce9ff, 0, 3.4, 1.0, 1, 2); frSpot.position.set(fr.position.x, 0.9, fr.position.z - 0.25);
  const frTarget = new THREE.Object3D(); frTarget.position.set(fr.position.x + 0.15, 0.3, fr.position.z - 1.6); root.add(frTarget); frSpot.target = frTarget; root.add(frSpot);
  colliders.push([x0, -0.55, z1 - 0.65, z1]);

  /* ======================= ENTRANCE ======================= */
  const ent = new THREE.Group(); root.add(ent);
  const DXc = 1.2;
  // door frame & slab
  mesh(rbox(0.06, 2.1, 0.06, 0.006), paintWhite, DXc - 0.48, 1.05, z1 - 0.02, ent);
  mesh(rbox(0.06, 2.1, 0.06, 0.006), paintWhite, DXc + 0.48, 1.05, z1 - 0.02, ent);
  mesh(rbox(1.02, 0.06, 0.06, 0.006), paintWhite, DXc, 2.1, z1 - 0.02, ent);
  const doorMat = new THREE.MeshStandardMaterial({ map: dwT.map, color: 0x9a8a78, roughness: 0.5, normalMap: dwT.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  mesh(rbox(0.9, 2.04, 0.045, 0.006), doorMat, DXc, 1.02, z1 - 0.03, ent);
  [[0.25, 0.55], [0.25, 1.45]].forEach(([_a, y]) => mesh(rbox(0.7, 0.75, 0.006, 0.004), doorMat, DXc, y, z1 - 0.055, ent));
  mesh(rbox(0.13, 0.018, 0.02, 0.008), steel, DXc - 0.3, 1.0, z1 - 0.075, ent);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 20).rotateX(Math.PI / 2), steel, DXc - 0.36, 1.0, z1 - 0.06, ent);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 12).rotateX(Math.PI / 2), steel, DXc, 1.55, z1 - 0.06, ent);
  // door chain (hanging, unhooked)
  mesh(tube([new THREE.Vector3(DXc - 0.42, 1.3, z1 - 0.06), new THREE.Vector3(DXc - 0.4, 1.12, z1 - 0.065), new THREE.Vector3(DXc - 0.38, 1.04, z1 - 0.06)], 0.003, 20, 5), steel, 0, 0, 0, ent);
  tag(ent, 'door', hits);
  // light switch
  const sw = new THREE.Group(); sw.position.set(0.52, 1.2, z1 - 0.004); root.add(sw);
  mesh(rbox(0.085, 0.12, 0.01, 0.004), plasticWhite, 0, 0, -0.004, sw);
  const rocker = mesh(rbox(0.035, 0.06, 0.008, 0.003), new THREE.MeshStandardMaterial({ color: 0xfaf8f3, roughness: 0.3 }), 0, 0, -0.011, sw);
  rocker.rotation.x = 0.08;
  mesh(new THREE.BoxGeometry(0.004, 0.004, 0.002), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.5, 0.1) }), 0, -0.04, -0.012, sw, false);
  tag(sw, 'switch', hits);
  points.switch = new THREE.Vector3(0.52, 1.2, z1);
  // shoe cabinet + key bowl + letters
  const sc = new THREE.Group(); sc.position.set(2.2, 0, z1 - 0.18); root.add(sc);
  mesh(rbox(0.78, 0.85, 0.34, 0.008), lightWood, 0, 0.425, 0, sc);
  mesh(new THREE.BoxGeometry(0.004, 0.8, 0.01), new THREE.MeshStandardMaterial({ color: 0x5a4a3a }), 0, 0.43, -0.171, sc, false);
  const kb = mesh(lathe([[0, 0], [0.05, 0], [0.09, 0.035], [0.088, 0.037], [0.045, 0.006], [0, 0.006]], 32), ceramicSage, -0.2, 0.85, 0, sc); void kb;
  // keys in bowl
  const keys = new THREE.Group(); keys.position.set(-0.2, 0.862, 0); sc.add(keys);
  mesh(new THREE.TorusGeometry(0.014, 0.0018, 6, 20).rotateX(Math.PI / 2), steel, 0, 0, 0, keys);
  [0.5, 1.9].forEach((a) => { const k = mesh(rbox(0.05, 0.003, 0.016, 0.002), new THREE.MeshStandardMaterial({ color: 0xc8a75a, metalness: 1, roughness: 0.35 }), Math.cos(a) * 0.035, 0.001, Math.sin(a) * 0.035, keys); k.rotation.y = -a; });
  mesh(rbox(0.03, 0.01, 0.02, 0.005), new THREE.MeshStandardMaterial({ color: 0xd04a3a, roughness: 0.5 }), -0.02, 0.004, 0.03, keys);
  [0, 1].forEach((i) => { const l = mesh(paper(0.2, 0.11, 0.001, 60 + i), new THREE.MeshStandardMaterial({ color: i ? 0xf1ece0 : 0xdcd2b8, roughness: 0.8 }), 0.12, 0.851 + i * 0.002, 0.02 - i * 0.03, sc, false); l.rotation.y = 0.2 - i * 0.4; });
  colliders.push([1.78, 2.6, z1 - 0.38, z1]);
  // coat hooks + wet jacket
  mesh(rbox(0.5, 0.06, 0.02, 0.005), lightWood, x1 - 0.012, 1.72, 1.25, root).rotation.y = Math.PI / 2;
  [1.08, 1.25, 1.42].forEach((z) => mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8).rotateZ(Math.PI / 2), steel, x1 - 0.05, 1.72, z, root));
  const jacket = mesh(drapeOverBar(0.46, 0.72, 0.1, 0.02, 17, 0.06), jacketMat, x1 - 0.1, 1.72, 1.25, root);
  jacket.rotation.y = -Math.PI / 2;
  const tote = mesh(drapeOverBar(0.32, 0.38, 0.05, 0.01, 21, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.95, side: THREE.DoubleSide, normalMap: linen.normalMap }), x1 - 0.06, 1.71, 1.44, root);
  tote.rotation.y = -Math.PI / 2;
  tag(jacket, 'jacket', hits);
  points.jacket = new THREE.Vector3(x1 - 0.1, 1.4, 1.25);
  // drips under the jacket
  const drip = mesh(new THREE.CircleGeometry(0.12, 24).rotateX(-Math.PI / 2), wetGloss, x1 - 0.15, 0.002, 1.25, root, false); drip.scale.set(1, 1, 0.7);
  // umbrella leaning in the corner + puddle
  const um = new THREE.Group(); um.position.set(x1 - 0.17, 0, 1.0); um.rotation.set(0.0, 0, -0.1); root.add(um);
  const umbPts: [number, number][] = [[0.0, 0.08]];
  for (let i = 0; i <= 10; i++) { const y = 0.08 + i * 0.075; umbPts.push([0.012 + Math.sin((i / 10) * Math.PI) * 0.035 + (i / 10) * 0.012, y]); }
  umbPts.push([0.008, 0.9]); umbPts.push([0, 0.9]);
  const umbGeo = lathe(umbPts, 8);
  mesh(umbGeo, new THREE.MeshPhysicalMaterial({ color: 0x1d1f24, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }), 0, 0, 0, um);
  mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), steel, 0, 0.04, 0, um);
  mesh(tube([new THREE.Vector3(0, 0.88, 0), new THREE.Vector3(0, 1.0, 0), new THREE.Vector3(0.02, 1.05, 0), new THREE.Vector3(0.06, 1.03, 0), new THREE.Vector3(0.065, 0.99, 0)], 0.011, 24, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 0.5 }), 0, 0, 0, um);
  const puddle = mesh(new THREE.CircleGeometry(0.2, 32).rotateX(-Math.PI / 2), wetGloss, x1 - 0.2, 0.002, 1.0, root, false); puddle.scale.set(1.2, 1, 0.8);
  tag(um, 'umbrella', hits);
  // shoes kicked off by the door
  const shoe = (x: number, z: number, ry: number, side = false) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; if (side) s.rotation.z = 1.35; root.add(s);
    mesh(rbox(0.1, 0.03, 0.27, 0.012), plasticWhite, 0, 0.015, 0, s);
    const up = mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.85, normalMap: cotton.normalMap }), 0, 0.028, 0.0, s);
    up.scale.set(0.048, 0.075, 0.13);
    mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.8 }), 0, 0.095, -0.05, s);
    mesh(new THREE.CircleGeometry(0.15, 20).rotateX(-Math.PI / 2), wetGloss, 0, 0.003, 0, s, false).scale.set(0.6, 1, 1.2);
  };
  shoe(0.95, 1.8, 0.3); shoe(1.25, 1.65, -0.5, true);
  // wet footprints fading toward the room
  for (let i = 0; i < 6; i++) {
    const fp = mesh(new THREE.CircleGeometry(0.05, 14).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x080808, roughness: 0.05, transparent: true, opacity: 0.22 - i * 0.03, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 1.1 - i * 0.12 + (i % 2) * 0.06, 0.002, 1.45 - i * 0.28, root, false);
    fp.scale.set(0.8, 1, 2.0); fp.rotation.y = 0.35;
  }

  /* ======================= MISC ======================= */
  // rug
  const rugM = mesh(rbox(1.6, 0.012, 2.3, 0.005), rugMat, -0.4, 0.006, 0.2, root, false); rugM.rotation.y = 0.07; rugM.receiveShadow = true;
  // narrow bookcase on east wall
  const bk = new THREE.Group(); bk.position.set(x1 - 0.16, 0, 0.55); root.add(bk);
  mesh(rbox(0.3, 1.7, 0.02, 0.004), lightWood, 0, 0.85, -0.39, bk);
  mesh(rbox(0.3, 1.7, 0.02, 0.004), lightWood, 0, 0.85, 0.39, bk);
  mesh(new THREE.BoxGeometry(0.01, 1.7, 0.78), lightWood, 0.145, 0.85, 0, bk);
  const r = T.rng(77);
  [0.02, 0.44, 0.86, 1.28, 1.69].forEach((y, si) => {
    mesh(rbox(0.3, 0.02, 0.78, 0.004), lightWood, 0, y, 0, bk);
    if (si === 4) return;
    let z = -0.37;
    while (z < 0.32) {
      if (si === 1 && z > 0.0 && z < 0.2) { z = 0.2; continue; }
      const bt = 0.02 + r() * 0.03, bh = 0.18 + r() * 0.15;
      const c = new THREE.Color().setHSL(r(), 0.25 + r() * 0.3, 0.25 + r() * 0.4);
      const b = mesh(rbox(0.2, bh, bt, 0.003), new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }), -0.01, y + 0.01 + bh / 2, z + bt / 2, bk);
      if (r() < 0.12) { b.rotation.x = 0.2; b.position.z += 0.02; }
      z += bt + 0.004;
    }
  });
  // bluetooth speaker + candle on the bookcase
  mesh(rbox(0.07, 0.1, 0.18, 0.03), new THREE.MeshStandardMaterial({ color: 0x3d3d40, roughness: 0.9, normalMap: linen.normalMap }), -0.01, 0.51, 0.1, bk);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 24), new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: 0.6 }), 0, 1.335, 0.25, bk);
  colliders.push([x1 - 0.33, x1, 0.12, 0.98]);
  // laundry basket with clothes
  const lb = new THREE.Group(); lb.position.set(1.85, 0, 0.5); root.add(lb);
  const wicker = T.fabric(3, 1.6, 0.5); wicker.map.repeat.set(4, 2); wicker.normalMap!.repeat.set(4, 2);
  mesh(lathe([[0, 0], [0.17, 0], [0.2, 0.38], [0.205, 0.4], [0.195, 0.4], [0.165, 0.01], [0, 0.01]], 36), new THREE.MeshStandardMaterial({ color: 0xbfa77f, map: wicker.map, normalMap: wicker.normalMap, roughness: 0.9, side: THREE.DoubleSide }), 0, 0, 0, lb);
  [[0x8899aa, 0, 0.36, 0], [0xddd6c8, 0.06, 0.39, 0.05], [0x2a2a2e, -0.05, 0.38, -0.06]].forEach(([c, x, y, z]) => { const s = mesh(new THREE.IcosahedronGeometry(0.11, 2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, normalMap: cotton.normalMap }), x, y, z, lb); s.scale.set(1, 0.45, 0.9); });
  const sock = mesh(drapeOverBar(0.07, 0.12, 0.08, 0.005, 50, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }), 0.2, 0.4, 0.0, lb); sock.rotation.y = Math.PI / 2;
  colliders.push([1.62, 2.08, 0.27, 0.73]);

  // paper-lantern ceiling light
  const pend = new THREE.Group(); pend.position.set(-0.2, h, 0.05); root.add(pend);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), plasticWhite, 0, -0.01, 0, pend);
  mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.42, 6), cableBlack, 0, -0.22, 0, pend);
  const lantern = new THREE.SphereGeometry(0.22, 40, 24);
  { const p = lantern.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const ribs = 1 + Math.abs(Math.sin(y * 70)) * 0.012; p.setXYZ(i, p.getX(i) * ribs, y * 0.92, p.getZ(i) * ribs); } lantern.computeVertexNormals(); }
  const lan = mesh(lantern, ceilingShade, 0, -0.62, 0, pend, false); lan.castShadow = false;
  const ceilingSpot = new THREE.SpotLight(0xffc98f, 0, 9, 1.35, 0.9, 2);
  ceilingSpot.position.set(-0.2, h - 0.75, 0.05);
  const cst = new THREE.Object3D(); cst.position.set(-0.2, 0, 0.05); root.add(cst); ceilingSpot.target = cst;
  ceilingSpot.castShadow = true; ceilingSpot.shadow.mapSize.set(1024, 1024); ceilingSpot.shadow.bias = -0.0005; ceilingSpot.shadow.normalBias = 0.02; ceilingSpot.shadow.camera.near = 0.25;
  root.add(ceilingSpot);
  const ceilingFill = new THREE.PointLight(0xffc690, 0, 7, 2); ceilingFill.position.set(-0.2, h - 0.5, 0.05); root.add(ceilingFill);
  // smoke detector
  mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.035, 28), plasticWhite, 1.2, h - 0.017, 0.8, root);
  mesh(new THREE.SphereGeometry(0.003, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.1, 0.1) }), 1.2, h - 0.036, 0.84, root, false);
  // more outlets
  [[-1.95, 0.3, z0 + 0.002, 0], [-0.3, 0.3, z1 - 0.002, Math.PI]].forEach(([x, y, z, ry]) => { const o = mesh(rbox(0.08, 0.08, 0.01, 0.004), plasticWhite, x, y, z, root); o.rotation.y = ry; });

  /* ======================= EXTRA LIVED-IN DETAIL ======================= */
  // wireless mouse, earbud case, laptop charger brick
  {
    const m = new THREE.Group(); put(m, -1.84, DY, -1.5, desk, 0.25);
    mesh(rbox(0.062, 0.026, 0.104, 0.013, 4), new THREE.MeshStandardMaterial({ color: 0xe6e6e8, roughness: 0.35 }), 0, 0.013, 0, m);
    mesh(new THREE.BoxGeometry(0.003, 0.001, 0.03), plasticBlack, 0, 0.0262, -0.02, m, false);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.006, 10).rotateZ(Math.PI / 2), plasticBlack, 0, 0.026, -0.03, m);
    const eb = new THREE.Group(); put(eb, -1.5, DY, -1.45, desk, 0.6);
    mesh(rbox(0.05, 0.026, 0.036, 0.012, 3), plasticWhite, 0, 0.013, 0, eb);
    mesh(new THREE.BoxGeometry(0.004, 0.002, 0.004), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 0.3) }), 0, 0.0265, 0.012, eb, false);
    const br = mesh(rbox(0.095, 0.024, 0.052, 0.006), plasticBlack, -1.97, DY + 0.012, -1.64, desk); br.rotation.y = 0.5;
  }
  // sticker + webcam on the laptop
  {
    const c = T.canvas(128, 128); const cx2 = c.getContext('2d')!; cx2.fillStyle = '#f4c542'; cx2.beginPath(); cx2.arc(64, 64, 60, 0, 7); cx2.fill(); cx2.fillStyle = '#2a2a2a'; cx2.font = 'bold 54px Arial'; cx2.textAlign = 'center'; cx2.fillText('☕', 64, 84);
    const stk = mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.4 }), 0.08, ld / 2 - 0.02, -0.0065, lid, false); stk.rotation.y = Math.PI;
    mesh(new THREE.CircleGeometry(0.0022, 10), new THREE.MeshBasicMaterial({ color: 0x050510 }), 0, ld - 0.0105, 0.0011, lid, false);
  }
  // wall clock (ticks, hands follow game time)
  const clockG = new THREE.Group(); put(clockG, -0.05, 2.05, z1 - 0.02, root, Math.PI);
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5 }), 0, 0, 0.015, clockG);
  {
    const c = T.canvas(256, 256); const x = c.getContext('2d')!;
    x.fillStyle = '#efe9da'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#222'; x.fillStyle = '#222'; x.textAlign = 'center'; x.font = 'bold 26px Georgia';
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; const l = i % 5 === 0 ? 14 : 6; x.lineWidth = i % 5 === 0 ? 3 : 1; x.beginPath(); x.moveTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); x.lineTo(128 + Math.sin(a) * (118 - l), 128 - Math.cos(a) * (118 - l)); x.stroke(); }
    [12, 3, 6, 9].forEach((n) => { const a = (n / 12) * Math.PI * 2; x.fillText(String(n), 128 + Math.sin(a) * 88, 128 - Math.cos(a) * 88 + 9); });
    const face = mesh(new THREE.CircleGeometry(0.135, 40), new THREE.MeshStandardMaterial({ map: T.toTex(c), roughness: 0.6 }), 0, 0, 0.0305, clockG, false); void face;
  }
  const mkHand = (len: number, wid: number, z: number, col: number) => { const g = new THREE.Group(); mesh(rbox(wid, len, 0.002, 0.0006), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), 0, len / 2 - len * 0.1, 0, g, false); g.position.z = z; clockG.add(g); return g; };
  const clockHands = { h: mkHand(0.08, 0.008, 0.032, 0x111111), m: mkHand(0.115, 0.005, 0.0335, 0x111111), s: mkHand(0.125, 0.0018, 0.035, 0xb02020) };
  mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 10).rotateX(Math.PI / 2), blackMetal, 0, 0, 0.036, clockG, false);
  // house slippers beside the bed
  const slipper = (x: number, z: number, ry: number) => {
    const s = new THREE.Group(); put(s, x, 0, z, root, ry);
    mesh(rbox(0.095, 0.018, 0.26, 0.01), new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.9 }), 0, 0.009, 0, s);
    const up = mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xcbb9a0, roughness: 1, normalMap: knitT.normalMap, sheen: 1, sheenColor: new THREE.Color(0xffffff) }), 0, 0.016, -0.045, s);
    up.scale.set(0.047, 0.05, 0.105);
  };
  slipper(0.88, 0.42, 0.3); slipper(0.74, -0.18, -0.6);
  // cactus on the window sill
  {
    const cg = new THREE.Group(); put(cg, -0.15, WIN.y0, z0 - 0.07, root);
    mesh(lathe([[0, 0], [0.03, 0], [0.036, 0.05], [0.038, 0.054], [0, 0.048]], 20), terracotta, 0, 0, 0, cg);
    const cm = new THREE.MeshStandardMaterial({ color: 0x3f7a4a, roughness: 0.6 });
    mesh(new THREE.CapsuleGeometry(0.02, 0.08, 4, 12), cm, 0, 0.1, 0, cg);
    const arm = mesh(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), cm, 0.03, 0.105, 0, cg); arm.rotation.z = -0.5;
  }
  // dish soap, sponge, coffee jar on the counter
  put(makeBottle(0.025, 0.17, 0x66d0c0, 0xffffff, ['NƯỚC', 'RỬA'], '#e8fbf8', '#0e6e62', 0.8), -1.42, 0.903, KZ + 0.24, root);
  mesh(rbox(0.07, 0.025, 0.045, 0.008), new THREE.MeshStandardMaterial({ color: 0xd9d03a, roughness: 0.95 }), -1.3, 0.9155, KZ + 0.23, root);
  mesh(rbox(0.07, 0.007, 0.045, 0.003), new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.95 }), -1.3, 0.931, KZ + 0.23, root);
  {
    const jr = new THREE.Group(); put(jr, -1.7, 0.903, KZ + 0.2, root);
    mesh(lathe([[0, 0], [0.04, 0], [0.042, 0.13], [0.036, 0.14], [0, 0.14]], 24), new THREE.MeshStandardMaterial({ map: labelTex(128, 64, '#6b1e12', '#f4d9a0', ['CÀ PHÊ', 'RANG XAY'], '#d4a017', 0.2), roughness: 0.4 }), 0, 0, 0, jr);
    mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 20), blackMetal, 0, 0.15, 0, jr);
  }

  // steam particles for the kettle
  const steamN = 60;
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(steamN * 3), 3));
  const steamTex = (() => { const c = T.canvas(64, 64); const ctx = c.getContext('2d')!; const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); return T.toTex(c); })();
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ map: steamTex, size: 0.09, transparent: true, opacity: 0, depthWrite: false, color: 0xdddddd }));
  steam.frustumCulled = false;
  root.add(steam);
  const mistN = 44;
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mistN * 3), 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ map: steamTex, size: 0.2, transparent: true, opacity: 0, depthWrite: false, color: 0xcfe6ff }));
  mist.frustumCulled = false;
  root.add(mist);

  return {
    colliders, hits, updaters, points,
    lights: { ceilingSpot, ceilingFill, deskSpot, deskFill, bedLamp, kitchen: kitchenLight, phone: phoneLight, laptop: laptopLight },
    emissives: { ceiling: ceilingShade, desk: deskBulb, bed: bedShade, kitchen: kitchenStrip, powerLed, acLed },
    glassPanes, rightSash, phone, phoneScreenMat, laptopScreen, laptopScreenMat, phoneScreen, steam,
    fridgeDoor: fdoor, fridgeCollider, fridge: { point: frPoint, spot: frSpot, led: fridgeLed, mist }, chair, clockHands,
  };
}
