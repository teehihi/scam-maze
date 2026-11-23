import {driveSurface,driveTexture} from './drive-look';
import {DISTRICT_START, DISTRICT_BLOCK} from './q10-plan';
import {districtFinishes} from './q10-materials';
import {makeSurveyKit,SURVEY} from './survey462';
import {freezeStaticMatrices} from '../world/meshBatcher';
import {streetVehicles, VAN_LENGTH, type ParkedBikeSlot} from './vehicles';
import { attachDynamicLamps } from './vehicleLights';
import { TrafficSignalController, type SaigonTrafficManager } from '../traffic';
import * as T from 'three';
import { CURB_HEIGHT, rect, ROUTE_BOARD, STOP_SIGN, type Point, type Solid } from './boarding';
import { ROUTE } from './transit';
import { asset, batch, box, contact, contactMaterial, granular, label, lamp, material, mesh, orb, plane, polygon, random, rod, rounded, textLabel, tube, write } from './scene-kit';

const WIDTH = SURVEY.width;
const X_ANGLE = -Math.PI / 2;
const STREET_MIN = DISTRICT_START;
const STREET_MAX = 99;
const CENTRE = (STREET_MIN + STREET_MAX) / 2;
const ROAD_LENGTH = STREET_MAX - STREET_MIN;

function busGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - r * 0.75, y - r, r * 1.5, r * 1.7, r * 0.25); ctx.fill();
  ctx.fillRect(x - r * 0.59, y + r * 0.6, r * 0.26, r * 0.33);
  ctx.fillRect(x + r * 0.33, y + r * 0.6, r * 0.26, r * 0.33);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(x - r * 0.55, y - r * 0.59, r * 1.1, r * 0.58);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x + side * r * 0.45, y + r * 0.37, r * 0.108, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}

function transportIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, bg: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, size * 1.38, 0, Math.PI * 2); ctx.fill();
  // Keep the glyph's window knockout local to its own canvas.
  const temp = document.createElement('canvas'); temp.width = temp.height = 100;
  busGlyph(temp.getContext('2d')!, 50, 50, 42, color);
  ctx.drawImage(temp, -size, -size, size * 2, size * 2);
  ctx.restore();
}

function boardMaterial(destination: boolean) {
  return label(768, 1024, (ctx) => {
    ctx.fillStyle = '#e7eadc'; ctx.fillRect(0, 0, 768, 1024);
    ctx.fillStyle = '#164b3c'; ctx.fillRect(0, 0, 768, 186);
    transportIcon(ctx, 86, 88, 34, '#e8f2d4', '#326a4e');
    write(ctx, 'GIAO THÔNG CÔNG CỘNG', 147, 75, 31, '#e8efd8');
    write(ctx, 'THÀNH PHỐ HỒ CHÍ MINH', 147, 121, 28, '#a3c9ae');
    write(ctx, 'THÔNG TIN TUYẾN XE BUÝT', 40, 246, 37, '#194337');
    write(ctx, destination ? 'Trạm Chợ Lớn  /  Quận 5' : 'Trạm Lý Thái Tổ  /  Quận 10', 40, 294, 29, '#456653');
    ctx.fillStyle = '#becc65'; ctx.beginPath(); ctx.roundRect(40, 339, 100, 90, 9); ctx.fill();
    write(ctx, ROUTE.number, 90, 404, 55, '#1d3924', 800, 'center');
    write(ctx, 'LÝ THÁI TỔ - CHỢ LỚN', 168, 380, 38, '#15382e');
    write(ctx, 'Tuyến mô phỏng  /  Hướng đi Chợ Lớn', 171, 423, 25, '#466452', 400);
    ctx.strokeStyle = '#477559'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(64, 500); ctx.lineTo(64, 713); ctx.stroke();
    for (const [i, stop] of [ROUTE.origin, ROUTE.via, ROUTE.destination].entries()) {
      const y = 510 + i * 96;
      ctx.fillStyle = '#174735'; ctx.beginPath(); ctx.arc(64, y, 11, 0, Math.PI * 2); ctx.fill();
      write(ctx, stop, 103, y + 11, 34, '#224635');
    }
    ctx.fillStyle = '#cddcca'; ctx.fillRect(40, 773, 688, 143);
    write(ctx, 'GIÁ VÉ LƯỢT', 67, 823, 26, '#315444');
    write(ctx, '7.000 đồng', 67, 875, 39, '#183e32');
    write(ctx, '05:30 - 20:00', 460, 870, 29, '#315444');
    write(ctx, 'Vui lòng nhường ghế cho người cần ưu tiên.', 43, 972, 26, '#466452', 400);
  });
}

function stopEnvironment(parent: T.Group, solids: Solid[], stopZ: number, destination: boolean, shade: T.Material, lightbox:T.Material) {
  const g = new T.Group(); parent.add(g);
  const steel = material(0x434e4d, 0.46, 0.68);
  const nickel = material(0xb6bec0, 0.35, 0.72);
  const rim = material(0x193948, 0.42, 0.54);
  const roof = material(0x456b78, 0.57, 0.43);
  const seam = material(0x2c3c39, 0.82, 0.14);
  const concrete = material(0x90958a, 0.89);
  const bench = material(0xabb6b8, 0.42, 0.65);
  const light = lamp(0xe9ebcb, 1.0);
  const glass = new T.MeshPhysicalMaterial({ color: 0x729c98, metalness: 0.23, roughness: 0.14, transparent: true, opacity: 0.23, side: T.DoubleSide, depthWrite: false, clearcoat: 0.7, envMapIntensity: 1.15 });
  const centre = 1.12;
  const ends = [-2.39, -0.59, 1.12, 2.84, 4.63];
  for (const z of ends) {
    box(g, [3.99, 1.43, z], [0.10, 2.54, 0.10], steel);
    box(g, [3.99, 0.245, z], [0.24, 0.17, 0.25], concrete);
    const rib = box(g, [2.79, 2.698, z], [2.50, 0.084, 0.071], rim);
    rib.rotation.z = -0.085;
    solids.push(rect(3.99, z + stopZ, 0.23, 0.23));
  }
  for (const z of [-2.39, 4.63]) {
    box(g, [1.91, 1.45, z], [0.08, 2.57, 0.08], nickel);
    solids.push(rect(1.91, z + stopZ, 0.15, 0.15));
  }
  box(g, [3.99, 0.42, centre], [0.082, 0.11, 7.13], steel);
  box(g, [3.99, 2.43, centre], [0.082, 0.11, 7.13], steel);
  box(g, [1.49, 2.847, centre], [0.10, 0.14, 7.78], rim);
  box(g, [4.09, 2.627, centre], [0.09, 0.13, 7.78], rim);
  // Barrel-vaulted canopy from the Drive stop, fitted to the existing posts and boarding bay.
  const arc=(u:number)=>2.84-.21*u+.52*Math.sin(Math.PI*u);
  for(let j=0;j<12;j++){const u=j/12,v=(j+1)/12,dx=2.69/12,dy=arc(v)-arc(u);
    box(g,[1.47+(u+v)*1.345,(arc(u)+arc(v))*.5,centre],[Math.hypot(dx,dy)+.008,.044,7.78],roof).rotation.z=Math.atan2(dy,dx);
    if(j%3===0)box(g,[1.47+u*2.69,arc(u)-.04,centre],[.047,.066,7.78],nickel);}
  for(const z of ends){const pts:[number,number,number][]=Array.from({length:9},(_,j)=>[1.47+j*2.69/8,arc(j/8)-.055,z]);tube(g,pts,.042,rim,12);}
  for (const z of [0.27, 1.98]) {
    const panel = plane(g, [3.994, 1.43, z], [1.63, 1.93], glass, X_ANGLE);
    panel.renderOrder = 2;
    for (const y of [1.19, 1.32]) box(g, [3.937, y, z], [0.014, 0.017, 1.61], nickel, false);
  }
  solids.push(rect(4.00, centre + stopZ, 0.12, 7.12));
  const posterZ = 3.72;
  const poster = label(600, 900, (ctx) => {
    const bg = ctx.createLinearGradient(80, 0, 520, 900);
    bg.addColorStop(0, '#a6b356'); bg.addColorStop(0.55, '#326b4e'); bg.addColorStop(1, '#184b3e');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 600, 900);
    ctx.strokeStyle = '#91b185'; ctx.lineWidth = 2;
    for (let i = 0; i < 15; i++) { ctx.beginPath(); ctx.ellipse(380, 475, 85 + i * 12, 45 + i * 7, -0.55, 0, Math.PI * 2); ctx.stroke(); }
    transportIcon(ctx, 300, 483, 117, '#e5ebbf', '#246148');
    write(ctx, 'ĐI XE BUÝT', 50, 135, 66, '#f8f3cd', 800);
    write(ctx, 'SỐNG XANH', 50, 220, 70, '#eff4bc', 800);
    write(ctx, 'Vì một thành phố sạch hơn.', 50, 747, 33, '#e4ebc6');
    write(ctx, 'TP. HỒ CHÍ MINH', 50, 814, 28, '#beda9d');
  });
  for (const [z, display] of [[ROUTE_BOARD.z, boardMaterial(destination)], [posterZ, destination ? poster : lightbox]] as const) {
    box(g, [3.964, 1.46, z], [0.12, 1.90, 1.47], seam);
    plane(g, [3.895, 1.46, z], [1.36, 1.78], display, X_ANGLE);
  }
  for (const z of [0.27, 2.00]) {
    for (const a of [3.27, 3.43, 3.59]) box(g, [a, 0.64, z], [0.143, 0.051, 1.48], bench);
    for (const delta of [-0.50, 0.50]) {
      box(g, [3.45, 0.405, z + delta], [0.43, 0.045, 0.054], steel);
      box(g, [3.45, 0.397, z + delta + 0.024], [0.07, 0.48, 0.083], steel);
    }
    solids.push(rect(3.45, z + stopZ, 0.54, 1.48));
  }
  for (const z of [-1.81, 0.42, 2.56, 4.19]) {
    box(g, [2.50, 2.654, z], [0.14, 0.060, 0.70], steel);
    box(g, [2.50, 2.618, z], [0.085, 0.027, 0.61], light);
  }
  const bin = material(0x3c5950, 0.56, 0.28);
  rounded(g, [3.55, 0.59, 5.19], [0.49, 0.87, 0.49], 0.07, bin);
  box(g, [3.55, 0.99, 5.19], [0.55, 0.081, 0.51], steel);
  box(g, [3.29, 0.83, 5.19], [0.026, 0.12, 0.31], seam);
  solids.push(rect(3.55, stopZ + 5.19, 0.51, 0.50));
  const sign = label(512, 716, (ctx) => {
    ctx.fillStyle = '#e6efd9'; ctx.fillRect(0, 0, 512, 716);
    ctx.fillStyle = '#22618a'; ctx.fillRect(13, 13, 486, 414);
    transportIcon(ctx, 256, 153, 89, '#f7f8e5', '#28618a');
    write(ctx, 'ĐIỂM DỪNG', 256, 312, 48, '#eef1d9', 800, 'center');
    write(ctx, 'XE BUÝT', 256, 373, 54, '#eef1d9', 800, 'center');
    write(ctx, destination ? 'CHỢ LỚN' : 'LÝ THÁI TỔ', 256, 497, 45, '#214c3c', 800, 'center');
    write(ctx, `TUYẾN ${ROUTE.number}`, 256, 582, 49, '#214c3c', 800, 'center');
    write(ctx, 'TP. HỒ CHÍ MINH', 256, 666, 26, '#496454', 700, 'center');
  });
  rod(g, [STOP_SIGN.x, 0.17, STOP_SIGN.z], [STOP_SIGN.x, 1.97, STOP_SIGN.z], 0.039, nickel);
  rounded(g, [STOP_SIGN.x, 2.39, STOP_SIGN.z], [0.66, 0.93, 0.060], 0.032, rim);
  plane(g, [STOP_SIGN.x, 2.39, STOP_SIGN.z - 0.035], [0.61, 0.88], sign, Math.PI);
  plane(g, [STOP_SIGN.x, 2.39, STOP_SIGN.z + 0.035], [0.61, 0.88], sign);
  solids.push(rect(STOP_SIGN.x, stopZ + STOP_SIGN.z, 0.13, 0.15));
  contact(g, 2.75, 0.173, centre, 3.85, 9.2, shade);
  g.position.z = stopZ;
  batch(g);
}

function scooter(parent: T.Group, paint: T.Material, rider: boolean, trim: ReturnType<typeof bikeMaterials>) {
  const group = new T.Group(); parent.add(group);
  const { rubber, gray, chrome, seat, headlight, brake, skin, cloth, pants, helmet } = trim;
  for (const z of [-0.65, 0.64]) {
    const wheel = mesh(group, new T.TorusGeometry(0.222, 0.055, 10, 24), rubber, [0, 0.278, z]); wheel.rotation.y = Math.PI / 2;
    const rim = mesh(group, new T.TorusGeometry(0.165, 0.018, 6, 20), chrome, [0, 0.278, z]); rim.rotation.y = Math.PI / 2;
    rod(group, [-0.064, 0.278, z], [0.065, 0.278, z], 0.085, gray);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      rod(group, [0.007, 0.278, z], [0.0, 0.278 + Math.sin(a) * 0.17, z + Math.cos(a) * 0.17], 0.010, gray, 0.006, 5);
    }
  }
  rounded(group, [0, 0.43, 0.005], [0.35, 0.14, 0.88], 0.062, gray);
  const rear = rounded(group, [0, 0.65, 0.47], [0.42, 0.37, 0.84], 0.148, paint); rear.rotation.x = 0.09;
  rounded(group, [0, 0.86, 0.37], [0.36, 0.105, 0.72], 0.049, seat);
  const front = rounded(group, [0, 0.68, -0.55], [0.36, 0.52, 0.25], 0.12, paint); front.rotation.x = -0.28;
  orb(group, [0, 0.48, -0.68], [0.106, 0.079, 0.225], paint);
  for (const x of [-0.098, 0.098]) rod(group, [x, 0.28, -0.66], [x, 0.94, -0.48], 0.023, chrome);
  rod(group, [-0.32, 1.02, -0.47], [0.32, 1.02, -0.47], 0.027, gray);
  rounded(group, [0, 1.014, -0.51], [0.32, 0.154, 0.14], 0.06, paint);
  rounded(group, [0, 1.014, -0.588], [0.19, 0.065, 0.021], 0.015, headlight);
  for (const x of [-0.23, 0.23]) {
    rod(group, [x, 1.02, -0.44], [x * 1.32, 1.17, -0.52], 0.012, chrome);
    orb(group, [x * 1.32, 1.18, -0.52], [0.066, 0.035, 0.03], gray);
  }
  rounded(group, [0, 0.72, 0.861], [0.24, 0.086, 0.031], 0.022, brake);
  box(group, [0, 0.47, 0.83], [0.18, 0.135, 0.015], chrome);
  if (rider) {
    const torso = rounded(group, [0, 1.10, 0.28], [0.38, 0.47, 0.22], 0.10, cloth); torso.rotation.x = 0.19;
    orb(group, [0, 1.45, 0.20], [0.105, 0.136, 0.113], skin);
    orb(group, [0, 1.52, 0.217], [0.125, 0.111, 0.134], helmet);
    rounded(group, [0, 1.52, 0.092], [0.155, 0.038, 0.073], 0.016, gray);
    for (const side of [-1, 1]) {
      rod(group, [side * 0.14, 1.24, 0.22], [side * 0.24, 1.06, -0.13], 0.057, cloth, 0.045);
      rod(group, [side * 0.24, 1.06, -0.13], [side * 0.27, 1.02, -0.45], 0.044, cloth, 0.032);
      orb(group, [side * 0.27, 1.02, -0.45], [0.036, 0.04, 0.057], skin);
      rod(group, [side * 0.13, 0.895, 0.29], [side * 0.23, 0.63, -0.14], 0.071, pants, 0.052);
      rod(group, [side * 0.23, 0.63, -0.14], [side * 0.15, 0.456, 0.07], 0.056, pants, 0.043);
      rounded(group, [side * 0.15, 0.465, 0.016], [0.1, 0.083, 0.20], 0.035, seat);
    }
  }
  batch(group);
  return group;
}

function bikeMaterials() {
  return { rubber: material(0x171b1b, 0.92), gray: material(0x252929, 0.54, 0.30), chrome: material(0xa7abab, 0.44, 0.65), seat: material(0x242525, 0.84), headlight: lamp(0xe7e4cb, 0.35), brake: lamp(0x952f20, 0.45), skin: material(0xa76e50, 0.75), cloth: material(0x40574a), pants: material(0x2c3438), helmet: material(0xd3d1b5, 0.34, 0.15) };
}

export function buildStreet(
  scene: T.Scene,
  software: boolean,
  manager?: T.LoadingManager,
  onAssetLoaded?: (obj: T.Object3D) => void,
  trafficMgr?: SaigonTrafficManager,
) {
  const environment = new T.Group(); scene.add(environment);
  const solids: Solid[] = [];
  const rng = random(58200);
  const loader = new T.TextureLoader(manager);
  const roadTex=(file:string,srgb=false)=>{const t=loader.load(asset(`survey/${file}.webp`));if(srgb)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1,ROAD_LENGTH/WIDTH);t.anisotropy=4;return t;};

  const wallMap = granular([174, 171, 154], [1.7, 2.8], false, 913);
  const asphalt = new T.MeshStandardMaterial({ map:roadTex("map",true),roughnessMap:roadTex("rough"),normalMap:roadTex("normal"),normalScale:new T.Vector2(.45,.45),roughness:.94 });
  const paving=driveSurface(loader,'brick',!software,3.4,ROAD_LENGTH/2,true), slab=driveSurface(loader,'slab',!software,3.4,ROAD_LENGTH/2,true);
  const skyline=[3,5].map(n=>{const key='shop'+n,m=driveSurface(loader,key,!software,1,1,true);m.emissive.set(0xffd49c);m.emissiveMap=driveTexture(loader,key+'-emissive');return m;});
  const concrete = material(0x88877e, 0.90);
  const pale = material(0xa6a294, 0.87);
  const charcoal = material(0x333937, 0.85);
  const corrugated = driveSurface(loader,"tin",!software);corrugated.metalness=.43;corrugated.roughness=.56;
  const canopies = [material(0x463932, 0.84), material(0x3b615b, 0.72), material(0x565a45, 0.66), material(0x7a4c40, 0.69)];
  const pales = [0xdac9aa, 0xaebdaf, 0xa6b8a0, 0xd6bf93, 0xbab6ac, 0xa5b9c3, 0xcaa590, 0xc9cbb9].map((color) => new T.MeshStandardMaterial({ color, map: wallMap, roughness: 0.91, bumpMap: software ? null : wallMap, bumpScale: 0.063 }));
  loader.load(asset('stucco.jpg'), (texture) => {
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(1.16, 1.36); texture.anisotropy = 4;
    for (const wall of pales) { wall.map = texture; if (!software) wall.bumpMap = texture; wall.needsUpdate = true; }
  });
  const floorColor = material(0x777b73, 0.91);
  const balconyGlass = new T.MeshStandardMaterial({ color: 0x34514e, metalness: 0.63, roughness: 0.29, envMapIntensity: 0.92 });
  const balconyShadow = material(0x242c2b, 0.82);
  const molding = material(0xaeb1a4, 0.72);
  const white = new T.MeshStandardMaterial({ color: 0xd7d5bc, map: wallMap, roughness: 0.91, polygonOffset: true, polygonOffsetFactor: -1 });

  const tactile = material(0xaa8b52, 0.94);
  const darkMetal = material(0x333a37, 0.58, 0.46);
  const wire = material(0x24282a, 0.86);
  const bark=driveSurface(loader,'trunk',!software,2,2);
  const earth = material(0x46483a, 0.99);
  const shade = contactMaterial(0.66);
  const leafTexture = loader.load(asset('canopy.png'));
  leafTexture.colorSpace = T.SRGBColorSpace;
  leafTexture.anisotropy = 4;
  const leaves = new T.MeshStandardMaterial({ map: leafTexture, color: 0x97ae89, side: T.DoubleSide, alphaTest: 0.51, roughness: 0.99, emissive: 0x204211, emissiveIntensity: 0.26 });
  const sway={value:0};
  const windAmp={value:1};
  for(const surface of [leaves,wire,...canopies]){const amount=surface===leaves?.045:.012;surface.onBeforeCompile=(shader)=>{shader.uniforms.uWind=sway;shader.uniforms.uWindAmp=windAmp;shader.vertexShader='uniform float uWind, uWindAmp;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n transformed.x += ${amount}*uWindAmp*sin(uWind*1.8+position.z*1.3+position.y)*smoothstep(1.,5.,position.y);`);if(surface===leaves)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
float thin=max(0.,dot(-normal,directionalLights[0].direction));reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.21,.28,.09)*thin;
#endif`);};surface.customProgramCacheKey=()=>`sway-${amount}`;}
  // Pre-bind 1×1 neutral DataTexture on shopfronts so async shopfronts.jpg load NEVER triggers runtime shader recompile!
  const shopPlaceholder = new T.DataTexture(new Uint8Array([92, 88, 82, 255]), 1, 1);
  shopPlaceholder.colorSpace = T.SRGBColorSpace;
  shopPlaceholder.needsUpdate = true;
  const shopfronts = [material(0x746f5d, 0.88), material(0x6a7771, 0.88)];
  for (const sf of shopfronts) {
    sf.map = shopPlaceholder;
    sf.emissiveMap = shopPlaceholder;
  }
  loader.load(asset('shopfronts.jpg'), (map) => {
    map.colorSpace = T.SRGBColorSpace; map.anisotropy = 4;
    [0.006, 0.504].forEach((x, i) => {
      const slice = map.clone(); slice.offset.x = x; slice.repeat.x = 0.486;
      shopfronts[i].color.set(0xdcd7cc);
      shopfronts[i].map = slice;
      shopfronts[i].emissiveMap = slice;
    });
  });
  const finishes=districtFinishes(loader);
  const periodFacade=finishes.loggia;
  const cloth=label(256,256,ctx=>{ctx.fillStyle='#cbb998';ctx.fillRect(0,0,256,256);for(let i=0;i<12;i++){ctx.fillStyle='#546a64';ctx.fillRect(i*22,0,10,256);ctx.fillStyle='#84725a';ctx.fillRect(i*22+12,0,2,256);}});
  const shopNames = [
    ['CƠM TẤM BÀ TƯ', '#742f26', '#e4bd77'], ['CÀ PHÊ 68', '#3f5140', '#efdfb2'], ['NHÀ THUỐC MINH TÂM', '#dddccb', '#22755a'], ['TIỆM TẠP HÓA', '#bfb192', '#573629'],
    ['BÁNH MÌ SÀI GÒN', '#733a29', '#eed894'], ['HỦ TIẾU NAM VANG', '#d4c3a0', '#6e3129'], ['SỬA XE HONDA', '#393f55', '#e9dfba'], ['TRÀ - CÀ PHÊ', '#486049', '#e6dec4'],
  ].map(([name, bg, fg], i) => label(640, 120, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 640, 120);
    ctx.strokeStyle = fg; ctx.globalAlpha = 0.46; ctx.strokeRect(8, 8, 624, 104); ctx.globalAlpha = 1;
    write(ctx, name, 320, 70, i === 2 ? 43 : 50, fg, 800, 'center');
    write(ctx, i === 2 ? 'QUẦY THUỐC TÂY' : 'KÍNH CHÀO QUÝ KHÁCH', 320, 101, 16, fg, 600, 'center');
  }));
  const choLonSigns = [
    textLabel('TRÀ PHÚC AN', '#54282b', '#d6b16a', 640, 132, 60),
    textLabel('TIỆM THUỐC ĐÔNG Y', '#755144', '#efdab7', 640, 132, 49),
    textLabel('QUÁN MÌ CHỢ LỚN', '#4e6051', '#e8c987', 640, 132, 55),
  ];
  const decal=(key:string)=>new T.MeshStandardMaterial({map:driveTexture(loader,key),transparent:true,depthWrite:false,roughness:.94});
  const busBay=decal('bay-map'),zebra=decal('crossing-map'),scraps=decal('street-scraps');

  plane(environment, [-WIDTH / 2, -0.001, CENTRE], [WIDTH + 0.02, ROAD_LENGTH], asphalt, 0, X_ANGLE);
  // West sidewalk runs continuously; East sidewalk opens cleanly at both East Boulevards (Z=-76 & Z=-147, width 12m)
  box(environment, [-WIDTH - 3.4, 0.068, CENTRE], [6.8, 0.145, ROAD_LENGTH], concrete, false);
  plane(environment, [-WIDTH - 3.4, CURB_HEIGHT, CENTRE], [6.8, ROAD_LENGTH], slab, 0, X_ANGLE);
  for (const [z0, z1] of [
    [STREET_MIN, -153],
    [-141, -82],
    [-70, STREET_MAX],
  ] as const) {
    const len = z1 - z0;
    const mid = (z0 + z1) * 0.5;
    box(environment, [3.4, 0.068, mid], [6.8, 0.145, len], concrete, false);
    plane(environment, [3.4, CURB_HEIGHT, mid], [6.8, len], paving, 0, X_ANGLE);
  }
  const curb = new T.Group(); environment.add(curb);
  for (let z = STREET_MIN; z < STREET_MAX; z += 0.70) {
    const inEastBlvd = Math.abs(z + 76) < 6.3 || Math.abs(z + 147) < 6.3;
    for (const x of [0.075, -WIDTH - 0.075]) {
      if (x > 0 && inEastBlvd) continue;
      box(curb, [x, 0.106, z], [0.15, 0.107, 0.687], rng() < 0.20 ? concrete : pale, false).receiveShadow = true;
    }
  }
  for (let z = STREET_MIN + 1; z < STREET_MAX; z += 5.6) {
    if ([-76, -96, -147].some((crossing) => Math.abs(crossing - z) < 5)) continue;
    for(const x of [-WIDTH*.25,-WIDTH*.75])plane(curb,[x,.004,z],[.135,2.72],white,0,X_ANGLE);
  }
  for (const z of [-76, -96, -147]) {
    plane(curb,[-WIDTH/2,.006,z],[WIDTH-.6,2.78],zebra,0,X_ANGLE);
    for (const side of [-1, 1]) plane(curb, [-WIDTH * 0.5, 0.0055, z + side * 2.49], [WIDTH - 0.48, 0.12], white, 0, X_ANGLE);
  }
  for (const stop of [ROUTE.originZ, ROUTE.destinationZ]) {
    plane(curb,[-1.62,.007,stop],[3.03,14.2],busBay,0,X_ANGLE);
    for (let zz = -6.25; zz <= 5.3; zz += 0.41) {
      box(curb, [0.54, 0.171, stop + zz], [0.34, 0.018, 0.395], tactile, false).receiveShadow = true;
      for (let j = 0; j < 5; j++) box(curb, [0.54 + (j - 2) * 0.052, 0.181, stop + zz], [0.016, 0.006, 0.26], tactile, false).receiveShadow = true;
    }
  }
  for (let z = -180; z < 50; z += 9.4) {
    box(curb, [-0.24, 0.012, z], [0.35, 0.028, 0.62], charcoal, false);
    for (let i = 0; i < 9; i++) box(curb, [-0.24, 0.027, z + (i - 4) * 0.059], [0.30, 0.012, 0.026], darkMetal, false);
  }
  // Low median pickets and yellow-capped uprights seen in both 462 Lý Thái Tổ views.
  const pickets:T.Matrix4[]=[]; const stamp=(x:number,y:number,z:number,w:number,h:number,l:number)=>new T.Matrix4().makeScale(w,h,l).setPosition(x,y,z);
  for(let z=STREET_MIN+1;z<STREET_MAX-2;z+=2.5){if([-76,-96,-147].some(c=>Math.abs(c-z)<4.8))continue;const x=-WIDTH*.5;
   for(const dx of [-.24,.24])plane(curb,[x+dx,.005,z],[.13,2.50],white,0,X_ANGLE);
   box(curb,[x,.06,z],[.16,.12,2.48],concrete);box(curb,[x,.77,z],[.07,.065,2.48],darkMetal);box(curb,[x,.21,z],[.055,.04,2.48],darkMetal);box(curb,[x,.42,z-1.2],[.078,.85,.078],darkMetal);box(curb,[x,.865,z-1.2],[.089,.09,.089],tactile);
   solids.push(rect(x,z,.07,2.5));for(let j=0;j<15;j++)pickets.push(stamp(x,.48,z-1.10+j*.155,.023,.54,.023));
  }
  const fence=new T.InstancedMesh(new T.BoxGeometry(),darkMetal,pickets.length);pickets.forEach((m,i)=>fence.setMatrixAt(i,m));environment.add(fence);
  batch(curb);

  function tree(g: T.Group, x: number, z: number, s: number) {
    box(g, [x, 0.165, z], [1.12, 0.02, 1.15], earth, false).receiveShadow = true;
    const top: [number, number, number] = [x + 0.17, 4.65 * s, z + 0.20];
    rod(g, [x, 0.16, z], [x - 0.08, 1.57 * s, z], 0.195 * s, bark, 0.129 * s, 12);
    rod(g, [x - 0.08, 1.48 * s, z], top, 0.134 * s, bark, 0.063 * s, 11);
    for (let f = 0; f < 6; f++) {
      const angle = f * 2.38 + rng() * 0.28;
      const sink = 0.68 + rng() * 1.7;
      const tx = x + Math.cos(angle) * (2.0 + rng() * 0.42) * s, tz = z + Math.sin(angle) * (1.92 + rng() * 0.5) * s;
      const ty = (3.88 + rng() * 1.95) * s;
      const fork: [number, number, number] = [x + (tx - x) * 0.54, ty - 0.64 * s, z + (tz - z) * 0.50];
      rod(g, [x, (sink + 1.2) * s, z + 0.08], fork, 0.085 * s, bark, 0.045 * s);
      rod(g, fork, [tx, ty, tz], 0.046 * s, bark, 0.014 * s, 7);
      for (let j = 0; j < 3; j++) {
        const card = plane(g, [tx + Math.sin(angle + j) * 0.24 * s, ty + j * s * 0.25, tz + j * 0.16 * s], [(2.8 + rng() * 1.18) * s, (2.45 + rng() * 0.81) * s], leaves);
        card.rotation.set(-0.20 - rng() * 1.25, angle + j * 1.52, (rng() - 0.5) * 1.25, 'YXZ');
        if(x>0 && Math.abs(card.position.z+10)<6.2){card.position.y=Math.max(card.position.y,5.5);card.position.x+=.42;}
        card.castShadow = true;
      }
    }
    contact(g, x, 0.174, z, 2.8, 3.5, shade);
    solids.push(rect(x, z, 0.45 * s, 0.46 * s));
  }

  const rotor=label(128,128,c=>{c.clearRect(0,0,128,128);c.translate(64,64);c.fillStyle='#525957';c.beginPath();c.arc(0,0,58,0,Math.PI*2);c.fill();for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.fillStyle='#a6aaa2';c.beginPath();c.ellipse(17,14,12,28,-.8,0,Math.PI*2);c.fill();}c.fillStyle='#656a64';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();});
  if(rotor instanceof T.MeshStandardMaterial){rotor.alphaTest=.42;rotor.map!.center.set(.5,.5);}
  const flyer=textLabel('SỬA NHÀ','#e1d5b4','#563c38',160,150,28);
  function house(g: T.Group, x: number, z: number, sign: number, width: number, side: number, floors: number) {
    const facade = pales[Math.floor(rng() * pales.length)];
    const height = 3.36 + floors * 2.84;
    const w = width - 0.06;
    const inward = -side;
    const yaw = side * X_ANGLE;
    const face = (distance: number) => x + inward * distance;
    const back = 6.6 + rng() * 2.40;
    box(g, [x + side * back / 2, height / 2 + 0.15, z], [back, height, w], facade);
    box(g, [face(0.065), 0.46, z], [0.20, 0.58, w + 0.02], floorColor);
    box(g, [face(0.039), 1.632, z], [0.10, 2.54, w - 0.33], balconyShadow);
    plane(g, [face(0.092), 1.625, z], [w - 0.46, 2.47], shopfronts[sign % 2], yaw);
    for (const z2 of [z - w / 2 + 0.12, z + w / 2 - 0.12]) box(g, [face(0.16), 1.66, z2], [0.28, 3.05, 0.25], facade);
    box(g, [face(0.13), 3.23, z], [0.32, 0.63, w - 0.13], canopies[sign % 4]);
    const inChoLon = z < -118 && z > -143;
    const business = inChoLon ? choLonSigns[sign % choLonSigns.length] : shopNames[sign % shopNames.length];
    plane(g, [face(0.305), 3.24, z], [w - 0.26, 0.58], business, yaw);
    if (rng() > 0.30) {
      const awning = box(g, [face(0.69), 2.91, z], [1.25, 0.073, w + 0.07], sign%3===1?cloth:canopies[sign % 4]);
      awning.rotation.z = side * 0.12;
      box(g, [face(1.25), 2.79, z], [0.08, 0.175, w + 0.07], canopies[sign % 4]);
      for (const k of [-1, 1]) rod(g, [face(0.11), 2.56, z + k * w * 0.40], [face(1.20), 2.83, z + k * w * 0.40], 0.027, darkMetal);
    }
    if (sign % 3 === 0) {
      const pipeZ = z + (w * 0.45) * (sign % 2 ? 1 : -1);
      rod(g, [face(0.24), 0.20, pipeZ], [face(0.24), height + 0.06, pipeZ], 0.034, corrugated);
      for (let i = 0; i < floors + 2; i++) box(g, [face(0.21), 1.02 + i * 2.42, pipeZ], [0.15, 0.036, 0.12], darkMetal);
    }
    if (sign === 0 || sign === 1 || sign === 4) {
      for (const k of [-1, 1]) {
        const stoolZ = z + k * w * 0.24, stoolX = face(0.54 + rng() * 0.27);
        box(g, [stoolX, 0.517, stoolZ], [0.30, 0.043, 0.31], canopies[(sign + 3) % 4]);
        for (const a of [-1, 1]) for (const b of [-1, 1]) rod(g, [stoolX + a * 0.13, 0.165, stoolZ + b * 0.135], [stoolX + a * 0.106, 0.50, stoolZ + b * 0.108], 0.022, canopies[(sign + 3) % 4], 0.027, 6);
        solids.push(rect(stoolX, stoolZ, 0.29, 0.30));
      }
    }
    for (let f = 0; f < floors; f++) {
      const y = 3.74 + f * 2.84;
      box(g, [face(0.10), y + 0.044, z], [0.27, 0.17, w + 0.075], molding);
      const balcony = (f + sign) % 4 !== 0;
      const windowWidth = w * (balcony ? 0.70 : 0.65);
      box(g, [face(0.052), y + 0.92, z], [0.13, 1.71, windowWidth + 0.18], balconyShadow);
      box(g, [face(0.125), y + 0.95, z], [0.053, 1.55, windowWidth], balconyGlass);
      for (const j of [-1, 0, 1]) box(g, [face(0.163), y + 0.95, z + j * windowWidth * 0.483], [0.075, 1.66, 0.064], molding);
      box(g, [face(0.163), y + 1.55, z], [0.077, 0.057, windowWidth], molding);
      if(sign%3!==2){plane(g,[face(.21),y+1.32,z],[w-.10,2.55],periodFacade,yaw);}
      if (balcony) {
        const ledge = 0.75 + rng() * 0.31;
        box(g, [face(ledge * 0.52), y, z], [ledge, 0.16, w * 0.92], facade);
        for (const yy of [0.18, 0.92]) box(g, [face(ledge), y + yy, z], [0.040, 0.040, w * 0.89], darkMetal);
        for (let j = -6; j <= 6; j++) box(g, [face(ledge), y + 0.53, z + j * w * 0.069], [0.027, 0.76, 0.027], darkMetal);
        for (const j of [-1, 1]) box(g, [face(ledge * 0.54), y + 0.90, z + j * w * 0.44], [ledge * 0.91, 0.037, 0.043], darkMetal);
        if (rng() > 0.71) {
          const pz = z + (rng() - 0.50) * w * 0.72;
          rounded(g, [face(0.53), y + 0.23, pz], [0.30, 0.29, 0.31], 0.04, canopies[0]);
          const card = plane(g, [face(0.55), y + 0.52, pz], [0.94, 0.78], leaves, yaw);
          card.castShadow = true;
        }
      }
      if (rng() > 0.48) {
        const acZ = z + w * (rng() > 0.5 ? 0.37 : -0.37);
        rounded(g, [face(0.26), y + 1.83, acZ], [0.35, 0.32, 0.57], 0.028, molding);
        plane(g,[face(.449),y+1.83,acZ+.07],[.28,.28],rotor,yaw);
        tube(g,[[face(.31),y+1.77,acZ-.27],[face(.22),y+1.68,acZ-.39],[face(.15),y+.92,acZ-.41]],.022,concrete,5);
        for (let k = 0; k < 5; k++) box(g, [face(0.452), y + 1.74 + k * 0.044, acZ], [0.016, 0.011, 0.44], corrugated, false);
      }
    }
    box(g, [face(0.062), height + 0.30, z], [0.183, 0.52, w], facade);
    box(g, [face(0.10), height + 0.58, z], [0.23, 0.092, w + 0.10], molding);
    if (rng() > 0.61) {
      const tankX = x + side * (2 + rng() * 2);
      rod(g, [tankX, height + 0.20, z], [tankX, height + 1.46, z], 0.53, corrugated, 0.53, 16);
      box(g, [tankX, height + 0.13, z], [1.44, 0.14, 1.44], darkMetal);
    }
    const far=g.userData.shell as T.Group;
    box(far,[x+side*back/2,height/2+.15,z],[back,height,w],facade,false);
    plane(far,[face(.02),1.61,z],[w-.17,2.89],shopfronts[sign%2],yaw);
    plane(far,[face(.024),3.23,z],[w-.12,.64],business,yaw);
    for(let n=0;n<floors;n++)plane(far,[face(.025),4.95+n*2.84,z],[w-.08,2.62],periodFacade,yaw);
    solids.push(rect(x + side * back * 0.5, z, back, w));
  }

  function powerPole(g: T.Group, x: number, z: number) {
    rod(g, [x, 0.13, z], [x, 7.21, z], 0.16, concrete, 0.104, 10);
    rod(g, [x, 0.16, z], [x, 1.22, z], 0.173, pale, 0.153, 10);
    box(g, [x - 0.19, 2.39, z], [0.27, 0.48, 0.36], darkMetal);
    plane(g,[x-.02,1.53,z-.157],[.23,.31],flyer,Math.PI);
    for(let k=0;k<3;k++){const coil=mesh(g,new T.TorusGeometry(.29+k*.014,.016,5,24),wire,[x-.15,5.7+k*.018,z-.12]);coil.rotation.y=.38;}
    box(g, [x, 6.97, z], [1.26, 0.09, 0.14], darkMetal);
    for (let j = -1; j <= 1; j++) rod(g, [x + j * 0.48, 7.00, z], [x + j * 0.48, 7.25, z], 0.054, molding);
    tube(g, [[x, 5.72, z], [x - 0.39, 6.27, z], [x - 1.32, 6.63, z], [x - 1.80, 6.62, z]], 0.046, darkMetal, 9);
    rounded(g, [x - 1.85, 6.58, z], [0.51, 0.105, 0.19], 0.046, corrugated);
    solids.push(rect(x, z, 0.33, 0.33));
  }

  const paintColors = [0x782e29, 0x52686c, 0xaab1a6, 0x5a4c37, 0x434748].map((color) => material(color, 0.34, 0.31));
  const trim = bikeMaterials();
  const parkedBikeSlots: ParkedBikeSlot[] = [];
  const surveyStucco=driveTexture(loader,"stucco-map");const kit=makeSurveyKit(surveyStucco,shopfronts,finishes,software?null:driveTexture(loader,"stucco-normal",false));
  const blocks: { group: T.Group; far:T.Group; start: number }[] = [];
  for (let j = 0; j < 14; j++) {
    const block = new T.Group(); environment.add(block);
    const start = STREET_MIN + j * DISTRICT_BLOCK;
    const far=new T.Group();environment.add(far);block.userData.shell=far;blocks.push({ group:block,far,start });
    for (const side of [1, -1]) {
      const authored=kit.block(j,start,side,block,far,solids);
      if(!authored)for (let k = 0; k < 4; k++) {
        const z = start + 2.43 + k * 5.15;
        const roadGap = [-76, -96, -147].some((crossing) => Math.abs(z - crossing) < (side === 1 && (crossing === -76 || crossing === -147) ? 13.0 : 2.75));
        if (roadGap) continue;
        house(block, side === 1 ? 5.53 + rng() * 0.46 : -16.04 - rng() * 0.48, z, (j + k * 2 + (side === 1 ? 0 : 3)) % shopNames.length, 4.96 + rng() * 0.12, side, 1 + Math.floor(rng() * 4));
      }
      const z = start + 3.0 + rng() * 5.3;
      const x = side === 1 ? (z > -12 && z < 8 || z > -139 && z < -121 ? 4.88 : 1.00 + rng() * 0.84) : -12.77 - rng();
      if(authored){const tx=side>0?(j===9?4.8:1.23):-WIDTH-1.15;
       // Irregular crowns open sightlines to the trading bays, not paired avenue trees.
       const offset=side>0?0:2.7;tree(block,tx,start+4.1+offset,j%3===1?1.46:1.17);
       if(side<0 || j!==7)tree(block,tx+side*.42,start+15.3-offset,j%2===0?.92:1.21);if(j%2===0){const lx=side>0?.85:-WIDTH-.85;kit.lampPost(block,lx,start+8,side);solids.push(rect(lx,start+8,.22,.22));}}
      else if (!(side === 1 && (Math.abs(z + 76) < 11.2 || Math.abs(z + 147) < 11.2))) tree(block, x, z, 0.78 + rng() * 0.53);
      if (!authored && (j % 2 === 0 || side === -1) && !(side === 1 && (Math.abs(z + 9 + 76) < 11.2 || Math.abs(z + 9 + 147) < 11.2))) tree(block, side === -1 ? -13.62 : 4.55, z + 9, 0.62 + rng() * 0.56);
      if (z > -15 && z < 6 || z > -138 && z < -122 || (side === 1 && (Math.abs(z + 76) < 11.5 || Math.abs(z + 147) < 11.5))) continue;
      for (let k = 0; k < (authored && j===7 && side>0 ? 6 : 1 + (j + side + 1) % 3); k++) {
        const bx = side === 1 ? (j===7?2.95:4.61) : -14.77, bz = (j===7 && side>0?start+7:z) + 1.45 + k * 0.91;
        if (side === 1 && (Math.abs(bz + 76) < 10.8 || Math.abs(bz + 147) < 10.8)) continue;
        // Replaced crude procedural box scooters with REAL 3D GLB motorbikes (PCX / Super Cub / PBR motorbike)!
        parkedBikeSlots.push({ parent: block, x: bx, y: 0.167, z: bz, ry: side * (1.11 + rng() * 0.42) });
        solids.push(rect(bx, bz, 1.53, 0.50));
        contact(block, bx, 0.176, bz, 1.87, 0.89, shade);
      }
    }
    const here = start + 2.15;
    if (Math.abs(here + 76) >= 7.0 && Math.abs(here + 147) >= 7.0) powerPole(block, 4.72, here);
    if (j < 13) for (let k = 0; k < 7; k++) {
      const x = 4.72 + (k - 3) * 0.12, y = k < 4 ? 6.34 + k * 0.047 : 7.23 + (k - 5) * 0.047;
      const cable = tube(block, [[x, y, here], [x - 0.32, y - 0.43, here + 6.1], [x - 0.38, y - 0.52, here + 12.2], [x, y, here + 21]], k < 3 ? 0.019 : 0.012, wire, 10);
      cable.castShadow = false;
    }
    if ((j<6 || j>10) && j % 3 === 1 && Math.abs(here + 76) >= 7.0 && Math.abs(here + 147) >= 7.0) for (let k = 0; k < 4; k++) {
      const z = here + k * 0.13;
      const cable = tube(block, [[4.72, 6.43 + k * 0.10, z], [-2, 5.94 + k * 0.10, z + 0.71], [-9.5, 6.17 + k * 0.1, z + 2.08], [-16.35, 7.29, z + 3.10]], 0.016, wire, 12);
      cable.castShadow = false;
    }
    for(const side of [1,-1]){
      const xx=side===1?1.7:-12.95,zz=start+6.2;
      if (side === 1 && (Math.abs(zz + 76) < 10.5 || Math.abs(zz + 147) < 10.5)) continue;
      rod(far,[xx,.16,zz],[xx,4.68,zz],.14,bark,.07,5);
      for(let i=0;i<3;i++){const card=plane(far,[xx,4.88,zz],[5.7,3.7],leaves,i*Math.PI/3);card.castShadow=false;}
    }
    batch(far);far.visible=false;batch(block);freezeStaticMatrices(block);freezeStaticMatrices(far);
  }

  const dressing = new T.Group(); environment.add(dressing);
  // Keep ONLY west-side background depth blocks well clear of west shophouses (x < -28);
  // all East-side & North urban districts are cleanly authored in saigonDistricts.ts with zero overlaps!
  for (let i = 0; i < 12; i++) {
    const z = -175 + i * 19.5;
    const x = -29 - (i % 3) * 6;
    const w = 8 + (i % 3) * 2.5, h = 11 + (i % 4) * 3.5;
    box(dressing, [x, h * 0.50, z], [w, h, 10], pales[i % pales.length]);
    plane(dressing, [x + w * 0.5 + 0.04, h * 0.5, z], [10, h], skyline[i % 2], Math.PI / 2);
  }
  for(let i=0;i<29;i++)plane(dressing,[i%2?-.4:.67,.013+(i%2?0:.155),-159+i*8.2],[.56,.68],scraps,0,X_ANGLE);
  // Receding south skyline strictly beyond playable south boundary (z >= 96) and well off the roadway!
  for (let i = 0; i < 6; i++) {
    const z = 104 + i * 8;
    for (const side of [-1, 1]) {
      const x = side > 0 ? 10.5 + i * 0.5 : -23.5 - i * 0.5;
      const h = 9 + ((i * 7 + (side + 1) * 3) % 14);
      box(dressing, [x, h / 2, z], [6.5, h, 6.8], pales[(i + side + 2) % pales.length]);
      plane(dressing, [x, h * 0.5, z - 3.42], [6.4, h], skyline[i % 2], Math.PI);
      plane(dressing, [x - side * 3.27, h * 0.5, z], [6.7, h], skyline[i % 2], side * X_ANGLE);
    }
  }
  // Per-intersection QCVN 41:2024 traffic signal heads + glowing 2-digit Vietnamese LED countdown panels!
  const legacySignalColours = [0xe94b37, 0xf1ae40, 0x58bf78].map(c => lamp(c, 0));
  const lttSignalSpecs: { z: number; interId: string }[] = [
    { z: -76, interId: "J_LTT_32" },
    { z: -96, interId: "J_LTT_PED" },
    { z: -147, interId: "J_LTT_DBP" },
  ];
  for (const { z, interId } of lttSignalSpecs) {
    const redMat = trafficMgr ? lamp(0xff3426, 0.03) : legacySignalColours[0];
    const ambMat = trafficMgr ? lamp(0xffb524, 0.03) : legacySignalColours[1];
    const grnMat = trafficMgr ? lamp(0x28e672, 0.03) : legacySignalColours[2];
    const perInterMats = [redMat, ambMat, grnMat];
    for (const side of [1, -1]) {
      const x = side === 1 ? 0.73 : -12.51;
      // Place east-side traffic signal on the corner sidewalk cleanly outside the 12m cross-boulevard mouth!
      const sz = side === 1 && (z === -76 || z === -147) ? z + 7.2 : z - 2.6;
      rod(dressing, [x, 0.16, sz], [x, 4.15, sz], 0.065, darkMetal);
      box(dressing, [x - side * 0.19, 3.65, sz], [0.34, 0.81, 0.31], charcoal);
      for (const [i, light] of perInterMats.entries()) {
        orb(dressing, [x - side * 0.36, 3.9 - i * 0.25, sz - 0.01], [0.037, 0.083, 0.085], light);
        // Also add forward-facing lens along Lý Thái Tổ (+Z / -Z) so approaching drivers see the signal clearly!
        orb(dressing, [x - side * 0.19, 3.9 - i * 0.25, sz + side * 0.16], [0.082, 0.082, 0.035], light);
      }
      if (trafficMgr) {
        const panel = TrafficSignalController.createCountdownPanel();
        panel.mesh.position.set(x - side * 0.19, 4.26, sz + side * 0.165);
        panel.mesh.rotation.y = side === 1 ? 0 : Math.PI;
        environment.add(panel.mesh);
        trafficMgr.bindSignalVisual({
          intersectionId: interId,
          axis: "ns",
          redMat,
          amberMat: ambMat,
          greenMat: grnMat,
          countdown: panel.handle,
        });
      }
      solids.push(rect(x, sz, 0.19, 0.20));
    }
  }
  const leafStain = [material(0x514d32), material(0x78694a), material(0x87805b)];
  const wear = label(384, 192, (ctx) => {
    const wearRng = random(109027);
    for (let i = 0; i < 145; i++) {
      const a = wearRng() * Math.PI * 2, length = Math.sqrt(wearRng());
      const x = 192 + Math.cos(a) * length * 165, y = 96 + Math.sin(a) * length * 71, r = 2.9 + wearRng() * 18;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(49,43,32,${wearRng() * 0.14})`); gradient.addColorStop(1, 'rgba(49,43,32,0)');
      ctx.fillStyle = gradient; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  });
  wear.transparent = true; wear.depthWrite = false;
  for (let i = 0; i < 68; i++) {
    const x = i % 2 === 0 ? 0.05 + rng() * 3.39 : -0.45 - rng() * 9.1;
    const z = -169 + rng() * 210;
    plane(dressing, [x, x < 0 ? 0.009 : 0.162, z], [0.52 + rng() * 1.67, 0.49 + rng() * 2.78], wear, 0, X_ANGLE).rotation.z = (rng() - 0.5) * 1.0;
  }
  for (let i = 0; i < 150; i++) {
    const x = i % 3 === 0 ? -11.55 + rng() * 0.52 : -0.21 + rng() * 3.43;
    const z = -146 + rng() * 162, size = 0.018 + rng() * 0.066;
    const y = x >= 0 ? 0.164 : 0.007;
    polygon(dressing, [[x - size * 0.71, y, z], [x, y + 0.008, z + size], [x + size, y, z - size * 0.2], [x + size * 0.22, y, z - size * 0.59]], leafStain[i % 3]).castShadow = false;
  }
  // Glass-fronted bánh mì trolley with steel trim and a little tin canopy.
  const cartX=3.6,cartZ=-17.7;box(dressing,[cartX,.71,cartZ],[.69,.65,1.29],molding);box(dressing,[cartX,1.065,cartZ],[.78,.06,1.38],darkMetal);
  const glassCase=new T.MeshPhysicalMaterial({color:0xc6ded8,transparent:true,opacity:.19,roughness:.08,metalness:.12,depthWrite:false});
  for(const side of [-1,1]){for(const end of [-1,1]){const xx=cartX+side*.35,zz=cartZ+end*.64;rod(dressing,[xx,.3,zz],[xx,1.73,zz],.018,darkMetal);const wheel=mesh(dressing,new T.TorusGeometry(.10,.027,6,16),charcoal,[xx,.282,zz]);wheel.rotation.y=Math.PI/2;}
   plane(dressing,[cartX+side*.354,1.39,cartZ],[1.22,.59],glassCase,side*Math.PI/2);}
  const bread=material(0xb87834,.75);for(let j=0;j<8;j++){orb(dressing,[cartX-.14+(j%2)*.27,1.16,cartZ-.43+Math.floor(j/2)*.27],[.088,.075,.164],bread,11).rotation.y=.35;}
  box(dressing,[cartX,1.76,cartZ],[.9,.095,1.49],canopies[0]);plane(dressing,[cartX-.352,.73,cartZ],[1.22,.51],textLabel('BÁNH MÌ  •  20K','#e6b95e','#a03425',600,220,68),X_ANGLE);solids.push(rect(cartX,cartZ,.8,1.48));
  // The low vendor parasol across from the shuttered strip (east-facing view).
  const ux=3.08,uz=-6.65;rod(dressing,[ux,.16,uz],[ux,2.55,uz],.025,darkMetal);
  const clothPanels=[canopies[1],material(0xc6a54a,.9),canopies[0]];
  for(let i=0;i<12;i++){const a=i*Math.PI/6,b=a+Math.PI/6;polygon(dressing,[[ux,2.65,uz],[ux+1.42*Math.cos(b),2.06,uz+1.42*Math.sin(b)],[ux+1.42*Math.cos(a),2.06,uz+1.42*Math.sin(a)]],clothPanels[Math.floor(i/2)%3]);clothPanels[Math.floor(i/2)%3].side=T.DoubleSide;}
  box(dressing,[ux,.71,uz],[1.08,.08,.79],floorColor);solids.push(rect(ux,uz,1.1,.82));
  batch(dressing);
  const ad=driveTexture(loader,'stop-ad'),lightbox=new T.MeshStandardMaterial({map:ad,emissiveMap:ad,emissive:0xffdda6,roughness:.32});
  stopEnvironment(environment, solids, ROUTE.originZ, false, shade,lightbox);
  stopEnvironment(environment, solids, ROUTE.destinationZ, true, shade,lightbox);
  const wayfinding = new T.Group(); environment.add(wayfinding);
  rod(wayfinding, [1.04, 0.16, -132.5], [1.04, 2.66, -132.5], 0.043, darkMetal);
  plane(wayfinding, [1.04, 2.39, -132.56], [1.48, 0.31], textLabel('ĐƯỜNG CHÂU VĂN LIÊM', '#1c5480', '#f0eee3', 512, 104, 39), Math.PI);
  solids.push(rect(1.04, -132.5, 0.13, 0.13));

  type StreetTrafficSlot = {
    id: string;
    root: T.Group;
    chassis: T.Group;
    body: T.Group;
    speed: number;
    x: number;
    direction: number;
    category: "moto" | "car" | "van";
    halfWidth: number;
    halfLength: number;
    edgeId: string;
    s: number;
    laneIndex: 0 | 1;
  };

  const motoSpawns: { edgeId: string; s: number; direction: number; x: number }[] = [
    { edgeId: "LTT_M2_NB", s: 12, direction: -1, x: -2.75 },
    { edgeId: "LTT_S_SB", s: 52, direction: 1, x: -9.85 },
    { edgeId: "LTT_S_NB", s: 94, direction: -1, x: -2.65 },
    { edgeId: "LTT_S_SB", s: 14, direction: 1, x: -8.95 },
    { edgeId: "LTT_S_NB", s: 44, direction: -1, x: -3.45 },
    { edgeId: "LTT_S_SB", s: 36, direction: 1, x: -9.55 },
    { edgeId: "LTT_S_NB", s: 24, direction: -1, x: -2.45 },
  ];

  const traffic: StreetTrafficSlot[] = motoSpawns.map((sp, i) => {
    const root = new T.Group();
    const chassis = new T.Group();
    root.add(chassis);
    environment.add(root);

    const body = scooter(chassis, paintColors[i % paintColors.length], true, trim);
    if (trafficMgr) {
      // In TrafficManager frame, +Z is forward -> flip host by PI so host(-Z) maps to chassis(+Z)!
      body.rotation.y = Math.PI;
    } else {
      root.position.set(sp.x, 0, [-112, -32, -54, -72, -3, -48, 21][i]);
      root.rotation.y = sp.direction > 0 ? Math.PI : 0;
    }
    contact(chassis, 0, 0.007, 0, 1.1, 2.35, shade);
    return {
      id: `LTT_MOTO_${i}`,
      root,
      chassis,
      body,
      speed: 5.5 + rng() * 4.5,
      x: sp.x,
      direction: sp.direction,
      category: "moto",
      halfWidth: 0.44,
      halfLength: 1.04,
      edgeId: sp.edgeId,
      s: sp.s,
      laneIndex: 1,
    };
  });

  // Moving Saigon Corolla Taxi (slot 7)
  const carRoot = new T.Group();
  const carChassis = new T.Group();
  const car = new T.Group();
  carRoot.add(carChassis);
  carChassis.add(car);
  environment.add(carRoot);
  if (trafficMgr) car.rotation.y = Math.PI;
  else carRoot.position.set(-10.05, 0, -88);
  traffic.push({
    id: "LTT_TAXI_0",
    root: carRoot,
    chassis: carChassis,
    body: car,
    x: -10.05,
    direction: 1,
    speed: 7.4,
    category: "car",
    halfWidth: 0.92,
    halfLength: 2.24,
    edgeId: "LTT_M2_SB",
    s: 16,
    laneIndex: 0,
  });

  const parkedMPV = new T.Group();
  parkedMPV.position.set(-WIDTH + 1.02, 0, -12.5);
  environment.add(parkedMPV);
  solids.push(rect(parkedMPV.position.x, -12.5, 1.87, 4.49));

  const van = new T.Group();
  van.position.set(-WIDTH + 0.98, 0, -34);
  environment.add(van);
  solids.push(rect(van.position.x, -34, 2.1, VAN_LENGTH + 0.2));

  // Moving Saigon Delivery Van (slot 8)
  const truckRoot = new T.Group();
  const truckChassis = new T.Group();
  const truck = new T.Group();
  truckRoot.add(truckChassis);
  truckChassis.add(truck);
  environment.add(truckRoot);
  if (trafficMgr) truck.rotation.y = Math.PI;
  else truckRoot.position.set(-4.65, 0, -30);
  traffic.push({
    id: "LTT_VAN_0",
    root: truckRoot,
    chassis: truckChassis,
    body: truck,
    x: -4.65,
    direction: -1,
    speed: 5.8,
    category: "van",
    halfWidth: 0.98,
    halfLength: VAN_LENGTH * 0.5,
    edgeId: "LTT_S_NB",
    s: 74,
    laneIndex: 0,
  });

  // Register all 9 Lý Thái Tổ vehicles into unified SaigonTrafficManager
  if (trafficMgr) {
    for (const slot of traffic) {
      trafficMgr.spawnVehicle({
        id: slot.id,
        category: slot.category,
        edgeId: slot.edgeId,
        s: slot.s,
        laneIndex: slot.laneIndex,
        halfWidth: slot.halfWidth,
        halfLength: slot.halfLength,
        rig: {
          root: slot.root,
          chassis: slot.chassis,
          wheels: [],
          wheelRadius: slot.category === "moto" ? 0.28 : 0.34,
          lights: null,
        },
      });
    }
  }

  const fleet = streetVehicles(
    traffic,
    parkedMPV,
    van,
    truck,
    parkedBikeSlots,
    onAssetLoaded,
    trafficMgr
      ? (index, info) => {
          const slot = traffic[index];
          if (!slot) return;
          const lights = attachDynamicLamps(
            slot.chassis,
            slot.halfWidth,
            slot.halfLength,
            slot.category === "moto",
          );
          trafficMgr.attachRig(slot.id, {
            root: slot.root,
            chassis: slot.chassis,
            wheels: info.wheels,
            wheelRadius: info.wheelRadius,
            lights,
            crewHead: info.crewHead,
            crewHeadRestQ: info.crewHead ? info.crewHead.quaternion.clone() : undefined,
          });
        }
      : undefined,
  );
  const velocities = traffic.map((t) => t.speed);
  // Pre-bind emissiveMap at build time so street.wet() NEVER triggers runtime shader recompilation!
  for (const m of [...shopNames, ...choLonSigns, ...shopfronts, periodFacade]) {
    if (m instanceof T.MeshStandardMaterial) {
      m.emissiveMap = m.map;
    }
  }
  return {
    solids,
    blocks,
    environment,
    setWind(strength: number) {
      windAmp.value = strength;
    },
    dispose() {
      fleet.dispose();
    },
    wet(value: boolean, wetness: number) {
      kit.lights(wetness);
      leaves.emissiveIntensity = value ? 0.012 : 0.12;
      leaves.color.set(value ? 0x4d5e49 : 0x8fa67e);
      lightbox.emissiveIntensity = 0.12 + wetness * 0.72;
      for (const m of skyline) m.emissiveIntensity = 0.02 + wetness * 0.95;
      paving.roughness = slab.roughness = 0.91 - wetness * 0.44;
      for (const m of [...shopNames, ...choLonSigns, ...shopfronts, periodFacade]) {
        if (m instanceof T.MeshStandardMaterial) {
          if (m.map && m.emissiveMap !== m.map) {
            m.emissiveMap = m.map;
            m.needsUpdate = true;
          }
          m.emissive.set(value ? 0xffcea4 : 0x000000);
          m.emissiveIntensity = m === periodFacade ? 0.14 : shopfronts.includes(m) ? (m.map ? 0.32 : 0.0) : 1.35;
        }
      }
      asphalt.roughness = 0.89 - wetness * 0.57;
      asphalt.metalness = 0.02 + wetness * 0.36;
      asphalt.color.set(value ? 0x8a9aa8 : 0xd4d8dc);
      balconyGlass.emissive.set(value ? 0xa17b44 : 0x000000);
      balconyGlass.emissiveIntensity = 0.45;
    },
    update(dt: number, player: Point, time: number, skipBlockCull = false) {
      if (!trafficMgr) fleet.update();
      sway.value = time;
      if (rotor instanceof T.MeshStandardMaterial) rotor.map!.rotation = time * 5;

      if (!skipBlockCull) {
        for (const { group, far, start } of blocks) {
          const d = Math.max(0, Math.abs(start + 10.5 - player.z) - 10.5);
          group.visible = d < (software ? 24 : 43);
          far.visible = !group.visible && d < 150;
        }
      }

      if (trafficMgr) return; // Unified SaigonTrafficManager handles all signals & vehicle motion!

      const tick = time % 22;
      const signal = tick < 10 ? 2 : tick < 12 ? 1 : 0;
      for (let i = 0; i < 3; i++) {
        legacySignalColours[i].color.setScalar(signal === i ? 0.25 : 0.015);
        legacySignalColours[i].emissiveIntensity = signal === i ? 1.8 : 0.025;
      }

      for (const [i, slot] of traffic.entries()) {
        const { root, direction, speed } = slot;
        const ahead = (player.z - root.position.z) * direction;
        const giveWay = Math.abs(player.x - root.position.x) < 1.0 && ahead > -0.7 && ahead < 3.8;
        let gap = Infinity;
        for (const other of traffic) {
          if (other === slot || other.direction !== direction || Math.abs(other.x - slot.x) > 1) continue;
          const d = (other.root.position.z - root.position.z) * direction;
          if (d > 0) gap = Math.min(gap, d - other.halfLength - slot.halfLength - 0.8);
        }
        if (signal !== 2) {
          for (const z of [-76, -96, -147]) {
            const d = (z - root.position.z) * direction;
            if (d > 0) gap = Math.min(gap, d - 2.7);
          }
        }
        const target = giveWay ? 0 : Math.min(speed, Math.sqrt(6 * Math.max(0, gap - 0.75)));
        velocities[i] += T.MathUtils.clamp(target - velocities[i], -6 * dt, 2.4 * dt);
        if (!giveWay) root.position.z += direction * Math.min(velocities[i] * dt, Math.max(0, gap));
        if (root.position.z < -189) root.position.z = 49;
        if (root.position.z > 52) root.position.z = -185;
        root.position.x = slot.x + 0.21 * Math.sin(time * 0.7 + i * 2.2);
        root.rotation.z = Math.sin(time * 1.6 + i) * 0.024;
      }
    },
    trafficClear(p: Point) {
      if (trafficMgr) {
        return !trafficMgr.vehicles.some(
          (v) =>
            !v.externalControl &&
            Math.abs(v.z - p.z) < v.halfLength + 0.55 &&
            Math.abs(v.x - p.x) < v.halfWidth + 0.45,
        );
      }
      return !traffic.some(
        (slot) =>
          Math.abs(slot.root.position.z - p.z) < slot.halfLength + 0.2 &&
          Math.abs(slot.root.position.x - p.x) < slot.halfWidth + 0.2,
      );
    },
  };
}