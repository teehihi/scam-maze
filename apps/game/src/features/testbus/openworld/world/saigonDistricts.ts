import * as T from "three";
import { streetClips } from "../simulation/streetClips";
import { createHumanRealismRig, upgradeHumanMaterials, type HumanActivity, type HumanRealismRig } from "../simulation/humanRealism";
import type { HumanPresenceSystem } from "../simulation/humanPresence";
import { addHeadlightBeam, attachDynamicLamps, markLampParts, mountGrabLamps, mountRoundLamp, setVehicleLightLevel } from "../simulation/vehicleLights";
import { sampleEdge, type SaigonTrafficManager, type VehicleAgent } from "../traffic";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";
import { createMastArmSignal } from "./mastArmSignal";
import { SIGNAL_APPROACHES, signalBasePosition, type SignalApproach } from "./signalPlacement";
import {
  asset,
  box,
  contact,
  contactMaterial,
  label,
  lamp,
  material,
  plane,
  random,
  rod,
  textLabel,
  tube,
  write,
} from "../simulation/scene-kit";
import { equipVehicle, wheelRadius, wheelSpinSigns, type CrewMember } from "../simulation/vehicleCrew";
import { fixVanWheels, simplifyInPlace } from "../simulation/vehicleLod";
import { VAN_LENGTH } from "../simulation/vehicles";
import { GRAB_DRIVER_FILE, pickGrabClip, type GrabClipName } from "../simulation/grabDriver";
import {
  LONG_Q9_CRUISE_MIN_SECONDS,
  LONG_Q9_FILE,
  LONG_Q9_HEIGHT,
  LONG_Q9_KICKSTAND_DEPLOYED_DEG,
  LONG_Q9_KICKSTAND_FOLDED_DEG,
  LONG_Q9_NPC_V,
  LONG_Q9_PARK_V,
  LONG_Q9_RIG_HEIGHT,
  LONG_Q9_SEAT_OFFSET,
  LONG_Q9_SITES,
  WAVE_LONGQ9_FILE,
  createLongQ9State,
  longQ9SitePoint,
  longQ9TakeoverWindow,
  stepLongQ9,
  type LongQ9Clip,
  type LongQ9Frame,
  type LongQ9State,
  type LongQ9TrafficReading,
} from "../simulation/longQ9";
import type { WorldStreamer } from "./WorldStreamer";
import type { PooledLightSpec } from "./boardingHouse";
import {
  createCorrugatedTinPBR,
  createGranitePlazaPBR,
  createWorldFacadePBR,
  createRealSaigonShophousePBR,
  createRealTreeBarkPBR,
  createSaigonAsphaltPBR,
  createSaigonRiverWaterMaterial,
  SAIGON_SHADER_UNIFORMS,
} from "./pbrTextures";
import { buildRealisticPottedPlants, SaigonBotanicalBatch } from "./foliageAndProps";
import { freezeStaticMatrices, mergeStaticMeshesByMaterial } from "./meshBatcher";
import {
  addVietnameseShophouseRelief,
  buildRealisticGrassField,
  createAnimatedLedBillboardMaterial,
  createInteriorMappingTowerMaterial,
  createLushSoilGrassGroundMaterial,
  createSoftVolumetricLampHaloMaterial,
  type InteriorTowerMaterialHandle,
} from "./gtaRealism";
import { buildSaigonStreetProps, createWetTireSpraySystem } from "./saigonProps";
import { buildSaigonRiversideWorld } from "./saigonRiverside";

export const BITEXCO_POS = new T.Vector3(94, 0, -186);
export const LANDMARK81_POS = new T.Vector3(26, 0, -356);

export interface SaigonDistricts {
  root: T.Group;
  solids: Solid[];
  lightSpecs: PooledLightSpec[];
  isWalkableSidewalk: (x: number, z: number) => boolean;
  isWithinOpenWorld: (x: number, z: number) => boolean;
  setWindowPreviewMode: (enabled: boolean) => void;
  setEnvironment: (
    nightFactor: number,
    wetness: number,
    windStrength: number,
    rainIntensity?: number,
    sunDir?: T.Vector3,
    fogColor?: T.Color,
    fogDensity?: number,
  ) => void;
  update: (dt: number, time: number, playerX: number, playerZ: number) => void;
  dispose: () => void;
}

function neonSignMat(title: string, sub: string, bg: string, fg: string, glow: string) {
  const mat = label(512, 160, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 160);
    // Subtle sun-faded vertical acrylic weathering & metal bezel grime (NOT flat cartoon vector!)
    const gr = ctx.createLinearGradient(0, 0, 0, 160);
    gr.addColorStop(0, "rgba(18,16,14,0.34)");
    gr.addColorStop(0.22, "rgba(255,255,255,0.05)");
    gr.addColorStop(0.82, "rgba(0,0,0,0.08)");
    gr.addColorStop(1, "rgba(12,10,8,0.44)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = "#262a2e";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 150);
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 488, 136);
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    write(ctx, title, 256, 86, 46, fg, 800, "center");
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.82;
    write(ctx, sub, 256, 130, 20, fg, 600, "center");
    ctx.globalAlpha = 1;
  });
  if (mat instanceof T.MeshStandardMaterial) {
    mat.color.setHex(0xd4d2cc);
    mat.roughness = 0.42;
    mat.metalness = 0.12;
    mat.emissiveMap = mat.map;
    mat.emissive.set(glow).lerp(new T.Color(0xffe8cc), 0.35);
    mat.emissiveIntensity = 0.85;
  }
  return mat as T.MeshStandardMaterial;
}

/** Width / height of signs made from a supplied image, so their planes keep the artwork's proportions. */
const signAspect = new WeakMap<T.Material, number>();
/** Height (m) of a retail sign plane `width` m wide; image signs keep their aspect, the generated ones use `fallback`. */
const signHeight = (mat: T.Material, width: number, fallback: number) => {
  const aspect = signAspect.get(mat);
  return aspect ? width / aspect : fallback;
};

/**
 * A lit sign drawn from an image file (same glow treatment as neonSignMat). The material starts with a 1x1 placeholder
 * map and gets the real texture when it has loaded, so the shader is not recompiled when it arrives.
 */
function imageSignMat(file: string, aspect: number, fill: string, glow: string) {
  const hex = new T.Color(fill).getHex();
  const placeholder = new T.DataTexture(new Uint8Array([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255]), 1, 1);
  placeholder.colorSpace = T.SRGBColorSpace;
  placeholder.needsUpdate = true;
  const mat = new T.MeshStandardMaterial({
    map: placeholder,
    color: 0xd4d2cc,
    roughness: 0.42,
    metalness: 0.12,
    emissiveMap: placeholder,
    emissive: new T.Color(glow).lerp(new T.Color(0xffe8cc), 0.35),
    emissiveIntensity: 0.85,
  });
  new T.TextureLoader().load(asset(file), (texture) => {
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    mat.map = texture;
    mat.emissiveMap = texture;
  });
  signAspect.set(mat, aspect);
  return mat;
}

export function buildSaigonDistricts(
  scene: T.Scene,
  streamer: WorldStreamer,
  software: boolean,
  onAssetLoaded?: (obj: T.Object3D) => void,
  trafficMgr?: SaigonTrafficManager,
  humanPresence?: HumanPresenceSystem,
): SaigonDistricts {
  const presenceCleanups: (() => void)[] = [];
  const root = new T.Group();
  root.name = "SaigonOpenWorldDistricts";
  scene.add(root);

  const dynamicRoot = new T.Group();
  dynamicRoot.name = "SaigonDynamicProps";
  root.add(dynamicRoot);

  const solids: Solid[] = [];
  const dynamicEmissives: { mat: T.MeshStandardMaterial; base: number; night: number }[] = [];
  const beacons: T.MeshBasicMaterial[] = [];
  const districtLights: { spec: PooledLightSpec; max: number }[] = [];
  const haloMats: T.ShaderMaterial[] = [];
  const ledBillboardMats: T.ShaderMaterial[] = [];
  const vehicleBeamMats: T.MeshBasicMaterial[] = [];
  const headlightMats: T.MeshStandardMaterial[] = [];
  const taillightMats: T.MeshStandardMaterial[] = [];
  const trafficSignalMats: { r: T.MeshStandardMaterial; y: T.MeshStandardMaterial; g: T.MeshStandardMaterial }[] = [];
  const windUniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };
  let envWetness = 0.86;
  let envRain = 0.36;
  const animMixers: T.AnimationMixer[] = [];
  // Solids of the bikes of the roadside rescue (see loadLongQ9Repair). They are shared by reference with the engine, which copies
  // this array once, so they exist from the start and are moved off the map (x = 1e6) while their bike is not standing there.
  const OFF_MAP: Solid = { x0: 1e6, x1: 1e6, z0: 1e6, z1: 1e6 };
  const longQ9BikeSolid: Solid = { ...OFF_MAP };
  const strangerBikeSolids: Solid[] = LONG_Q9_SITES.map(() => ({ ...OFF_MAP }));
  solids.push(longQ9BikeSolid, ...strangerBikeSolids);
  const roamingActors: {
    group: T.Group;
    mixer?: T.AnimationMixer;
    walkAction?: T.AnimationAction;
    walkClipSpeed: number;
    realism: HumanRealismRig;
    activity: HumanActivity;
    partnerPos?: T.Vector3;
    axis: "x" | "z" | "idle";
    min: number;
    max: number;
    dir: number;
    speed: number;
    targetYaw: number;
  }[] = [];
  const _npcPlayerPos = new T.Vector3();
  const boulevardVehicles: {
    group: T.Group;
    wheels: { node: T.Object3D; sign: number }[];
    wheelRadius: number;
    crew: CrewMember | null;
    axis: "x" | "z";
    lane: number;
    min: number;
    max: number;
    dir: number;
    speed: number;
    curSpeed: number;
    length: number;
  }[] = [];

  let disposed = false;
  const rng = random(202611);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const shade = contactMaterial(0.56);

  // =========================================================================
  // ARCHITECTURAL PBR MATERIAL LIBRARY
  // =========================================================================
  const roadMat = createSaigonAsphaltPBR(2, 18);
  const plazaMat = createGranitePlazaPBR(16);
  const waterMat = createSaigonRiverWaterMaterial();
  const tinRoofMat = createCorrugatedTinPBR("#3c515c", "#6c3f28", 2, 2);
  // District 1 walls use real CC0 plaster / concrete scans with world-space UVs (no more stretched slabs).
  const concrete = createWorldFacadePBR("concrete_wall_007", "#b4b6b0", 3.0, 0.9);
  const travertine = createWorldFacadePBR("beige_wall_001", "#e6d9bd", 3.2, 0.8, 0.8);
  const warmLimestone = createWorldFacadePBR("clay_plaster", "#e8dcc6", 3.2, 0.8, 0.85);
  const darkGranite = createGranitePlazaPBR(4);
  darkGranite.color.set(0x464b52);
  darkGranite.roughness = 0.42;
  darkGranite.metalness = 0.12;
  const grassMat = createLushSoilGrassGroundMaterial(28, 24);
  const steel = material(0x3f474d, 0.36, 0.78);
  const bronzeMetal = material(0x4b433b, 0.34, 0.72);
  const aluFin = material(0x6b747d, 0.32, 0.68);
  const inox = material(0xd2dae0, 0.22, 0.92);
  const darkMetal = material(0x23282c, 0.44, 0.72);
  const louverDark = material(0x2e343b, 0.62, 0.45);
  const lobbyGlass = new T.MeshStandardMaterial({
    color: 0x1d2c36,
    emissive: new T.Color(0xffdfa8),
    emissiveIntensity: 0.14,
    roughness: 0.14,
    metalness: 0.65,
    envMapIntensity: 1.5,
  });
  dynamicEmissives.push({ mat: lobbyGlass, base: 0.06, night: 0.62 });

  // Architectural Textured Ground-Floor Commercial Retail / Lobby Storefront Material
  // (Replaces flat cream boxes with real recessed café/bank/retail depth, dark mullions, & warm ceiling downlights!)
  const lobbyTex = (() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    // Dark architectural glass backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, 256);
    bg.addColorStop(0, "#10161e");
    bg.addColorStop(0.32, "#241d18");
    bg.addColorStop(0.78, "#181514");
    bg.addColorStop(1, "#0b0d10");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);
    // 4 architectural retail bays with warm recessed ceiling downlights, interior shelves, tables & pillars
    for (let b = 0; b < 4; b++) {
      const bx = b * 128;
      // Warm interior ceiling soffit wash
      const pool = ctx.createRadialGradient(bx + 64, 58, 6, bx + 64, 90, 68);
      pool.addColorStop(0, b === 1 ? "rgba(255, 224, 174, 0.72)" : "rgba(255, 206, 138, 0.62)");
      pool.addColorStop(0.55, "rgba(180, 128, 74, 0.24)");
      pool.addColorStop(1, "rgba(18, 22, 28, 0.0)");
      ctx.fillStyle = pool;
      ctx.fillRect(bx + 6, 16, 116, 224);
      // Recessed downlight dots on ceiling
      ctx.fillStyle = "#fff1d0";
      ctx.fillRect(bx + 32, 28, 12, 5);
      ctx.fillRect(bx + 84, 28, 12, 5);
      // Interior wood/stone counter & silhouetted café furniture
      ctx.fillStyle = "#2b221a";
      ctx.fillRect(bx + 14, 162, 100, 62);
      ctx.fillStyle = "#4d3826";
      ctx.fillRect(bx + 16, 158, 96, 8);
      // Warm back-wall display shelf / menu board
      ctx.fillStyle = b % 2 === 0 ? "rgba(255, 198, 120, 0.42)" : "rgba(155, 210, 255, 0.34)";
      ctx.fillRect(bx + 24, 72, 80, 44);
      ctx.fillStyle = "rgba(24, 20, 18, 0.72)";
      for (let r = 0; r < 3; r++) ctx.fillRect(bx + 26, 82 + r * 12, 76, 3);
      // Subtle diagonal glass exterior reflection sheen
      ctx.fillStyle = "rgba(150, 190, 230, 0.07)";
      ctx.beginPath();
      ctx.moveTo(bx + 10, 18);
      ctx.lineTo(bx + 54, 18);
      ctx.lineTo(bx + 24, 238);
      ctx.lineTo(bx + 6, 238);
      ctx.closePath();
      ctx.fill();
      // Crisp dark bronze aluminum storefront mullions & transom bar
      ctx.fillStyle = "#14181e";
      ctx.fillRect(bx, 0, 8, 256);
      ctx.fillRect(bx + 120, 0, 8, 256);
      ctx.fillRect(bx, 0, 128, 18);
      ctx.fillRect(bx, 60, 128, 6);
      ctx.fillRect(bx, 224, 128, 32);
    }
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    tx.wrapS = T.RepeatWrapping;
    tx.wrapT = T.ClampToEdgeWrapping;
    tx.repeat.set(2, 1);
    tx.anisotropy = 4;
    return tx;
  })();

  const lobbyWarmInterior = new T.MeshStandardMaterial({
    color: 0xb8b2a8,
    map: lobbyTex,
    emissive: new T.Color(0xffd296),
    emissiveMap: lobbyTex,
    emissiveIntensity: 0.22,
    roughness: 0.24,
    metalness: 0.35,
    envMapIntensity: 1.35,
  });
  dynamicEmissives.push({ mat: lobbyWarmInterior, base: 0.14, night: 0.92 });

  const whitePaint = new T.MeshStandardMaterial({
    color: 0xe6e4d6,
    roughness: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const yellowPaint = new T.MeshStandardMaterial({
    color: 0xe8b93a,
    roughness: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const streetLampMat = lamp(0xffdca4, 2.2);
  dynamicEmissives.push({ mat: streetLampMat, base: 0.14, night: 3.2 });

  const warmSoffitMat = lamp(0xffd296, 0.8);
  dynamicEmissives.push({ mat: warmSoffitMat, base: 0.05, night: 1.35 });

  // True Soft Fresnel Volumetric Streetlamp Mist Cone Shader (ZERO hard geometric cone edges!)
  const haloMat = createSoftVolumetricLampHaloMaterial();
  haloMats.push(haloMat);

  // Authentic illuminated Saigon ground-floor tower retail signage (Highlands, Vietcombank, GS36, Phở 24, FamilyMart, Trung Nguyên)
  const retailSignMats = [
    neonSignMat("HIGHLANDS COFFEE", "CÀ PHÊ · TRÀ SEN VÀNG", "#5a1414", "#fff4dc", "#ff5238"),
    neonSignMat("VIETCOMBANK", "PGD QUẬN 1 · ATM 24/7", "#0d4a26", "#f0ffe8", "#3ce878"),
    // Supplied artwork (signs/gs36.webp, 1459 x 198): the convenience store is GS36 now.
    imageSignMat("signs/gs36.webp", 1459 / 198, "#004ccc", "#44b8ff"),
    neonSignMat("PHỞ 24 · SÀI GÒN", "HƯƠNG VỊ TRUYỀN THỐNG", "#164632", "#fff6d8", "#48e090"),
    neonSignMat("TRUNG NGUYÊN LEGEND", "CÀ PHÊ NĂNG LƯỢNG", "#2c1e16", "#f7e2b8", "#ffb648"),
    neonSignMat("FAMILYMART 24H", "MỞ CỬA SUỐT ĐÊM", "#0c4252", "#ecfff6", "#3ae8a6"),
  ];
  retailSignMats.forEach((m) => dynamicEmissives.push({ mat: m, base: 0.2, night: 1.85 }));

  // Real-Time 3D Parallax Interior Mapping Skyscraper Glass Shaders (3 realistic Saigon office/condo palettes)
  const interiorTowerHandles: InteriorTowerMaterialHandle[] = [
    createInteriorMappingTowerMaterial({ glassTint: 0x5f86a4, mullionColor: 0x3b4249, warmRatio: 0.52, seed: 1.3, cellWidth: 3.9, cellHeight: 3.45 }),
    createInteriorMappingTowerMaterial({ glassTint: 0x678f96, mullionColor: 0x4b4c4a, warmRatio: 0.64, seed: 2.7, cellWidth: 3.6, cellHeight: 3.25 }),
    createInteriorMappingTowerMaterial({ glassTint: 0x748596, mullionColor: 0x343940, warmRatio: 0.48, seed: 4.1, cellWidth: 4.2, cellHeight: 3.55 }),
  ];
  const towerMats = interiorTowerHandles.map((h) => h.material);

  // Real Photographic Saigon Shophouses (strictly 1-bay scale for narrow 5–7m tube houses — NEVER stretched!)
  const realShopMats = [
    createRealSaigonShophousePBR(3, "#eee8de", 1),
    createRealSaigonShophousePBR(5, "#e8e3da", 1),
    createRealSaigonShophousePBR(3, "#d8e0d8", 1),
    createRealSaigonShophousePBR(5, "#e4dacd", 1),
  ];
  realShopMats.forEach((m) => dynamicEmissives.push({ mat: m, base: 0.04, night: 1.05 }));

  const stuccoColors = [
    createWorldFacadePBR("painted_plaster_wall", "#f0e2c4", 3.4),
    createWorldFacadePBR("blue_plaster_weathered", "#cfe0d8", 3.4),
    createWorldFacadePBR("clay_plaster", "#e9c79d", 3.4),
    createWorldFacadePBR("painted_worn_brick", "#e7cdb8", 3.0),
    createWorldFacadePBR("grey_plaster_02", "#e3d9cc", 3.4),
  ];

  // Wind-swaying botanical palm & tropical foliage PBR materials + Instanced Botanical Batch
  const palmBark = createRealTreeBarkPBR(1, 3);
  const botanicalBatch = new SaigonBotanicalBatch();
  const potWind = { time: windUniforms.uTime, amp: windUniforms.uWind };

  // Helper: Detailed Saigon Streetlamp with Volumetric Mist Halo Cone & Dynamic PointLight
  const addLampPost = (parent: T.Group, x: number, z: number, armDirX: number, armDirZ: number, addLight = false) => {
    rod(parent, [x, CURB_HEIGHT, z], [x, 7.6, z], 0.095, steel, 0.055, 10);
    box(parent, [x, CURB_HEIGHT + 0.35, z], [0.28, 0.7, 0.28], darkMetal, false);
    rod(parent, [x, 7.55, z], [x + armDirX * 2.0, 7.9, z + armDirZ * 2.0], 0.045, steel, 0.032, 8);
    const lx = x + armDirX * 2.1;
    const lz = z + armDirZ * 2.1;
    box(parent, [lx, 7.86, lz], [0.64, 0.12, 0.28], darkMetal, false);
    box(parent, [lx, 7.79, lz], [0.54, 0.05, 0.22], streetLampMat, false);
    const cone = new T.Mesh(new T.ConeGeometry(2.6, 5.8, 12, 1, true), haloMat);
    cone.position.set(lx, 4.9, lz);
    parent.add(cone);

    solids.push(rect(x, z, 0.28, 0.28));
    if (addLight && !software) {
      const spec: PooledLightSpec = { x: lx, y: 7.35, z: lz, color: 0xffcb86, distance: 28, decay: 1.75, intensity: 0 };
      districtLights.push({ spec, max: 28 });
    }
  };

  // Helper: Instanced Saigon Royal Palm or Multi-Branch Shade Tree
  const addSaigonTree = (parent: T.Group, x: number, z: number, scale = 1, isPalm = false) => {
    box(parent, [x, CURB_HEIGHT + 0.04, z], [1.35 * scale, 0.08, 1.35 * scale], concrete, false);
    if (isPalm) {
      botanicalBatch.addRoyalPalm(x, CURB_HEIGHT, z, scale);
    } else {
      botanicalBatch.addShadeTree(x, CURB_HEIGHT, z, scale);
    }
    solids.push(rect(x, z, 0.5 * scale, 0.5 * scale));
  };

  // Helper: Vietnamese mast-arm (gia den) traffic signal on the driver's right-hand curb of one approach.
  const addTrafficSignal = (parent: T.Group, a: SignalApproach) => {
    const pos = signalBasePosition(a);
    const signal = createMastArmSignal({
      x: pos.x,
      y: CURB_HEIGHT,
      z: pos.z,
      heading: a.heading,
      onCountdown: trafficMgr
        ? (countdown, lamps) =>
            trafficMgr.bindSignalVisual({
              intersectionId: a.intersectionId,
              axis: a.axis,
              redMat: lamps.r,
              amberMat: lamps.y,
              greenMat: lamps.g,
              countdown,
            })
        : undefined,
    });
    if (!trafficMgr) trafficSignalMats.push(signal.lamps);
    parent.add(signal.group);
    solids.push(rect(pos.x, pos.z, 0.28, 0.28));
  };

  const addCrosswalk = (parent: T.Group, cx: number, cz: number, horizontal: boolean) => {
    for (let i = -4; i <= 4; i++) {
      if (horizontal) {
        plane(parent, [cx, 0.009, cz + i * 1.05], [3.2, 0.48], whitePaint, 0, -Math.PI / 2);
      } else {
        plane(parent, [cx + i * 1.05, 0.009, cz], [0.48, 3.2], whitePaint, 0, -Math.PI / 2);
      }
    }
  };

  // =========================================================================
  // REALISTIC MULTI-PART SAIGON ARCHITECTURAL HIGH-RISE BUILDER
  // 3 distinct HCMC archetypes (Office Curtain-Wall, Luxury Condo Balconies, Stone-Pier Financial Tower)
  // with 3D colonnade glass lobby podiums, cantilevered entrance canopies, stepped setbacks & HVAC crowns!
  // =========================================================================
  const addCommercialTower = (
    nearParent: T.Group,
    lodParent: T.Group | null,
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    matIdx: number,
    canopySide: "+z" | "-z" | "+x" | "-x" = "+z",
  ) => {
    const archetype = matIdx % 3;
    const tm = towerMats[archetype];
    const stoneMat = archetype === 0 ? darkGranite : archetype === 1 ? warmLimestone : travertine;
    const trimMat = archetype === 0 ? aluFin : archetype === 1 ? concrete : bronzeMetal;
    const podiumH = 6.8;
    const pw = w + 0.8;
    const pd = d + 0.8;

    // 1. Dark granite plinth + textured double-height glass retail/lobby podium (real depth, ZERO opaque cream slab!)
    box(nearParent, [x, 0.25, z], [pw + 0.25, 0.5, pd + 0.25], darkGranite, false);
    box(nearParent, [x, podiumH * 0.5, z], [pw - 0.42, podiumH - 0.32, pd - 0.42], lobbyWarmInterior, false);

    // 2. Structural 3D stone perimeter colonnade pillars (creates real light/shadow depth around ground lobby!)
    const colsX = Math.max(3, Math.round(pw / 4.2) + 1);
    const colsZ = Math.max(3, Math.round(pd / 4.2) + 1);
    for (let ix = 0; ix < colsX; ix++) {
      const cx = x - pw * 0.5 + 0.32 + (ix / (colsX - 1)) * (pw - 0.64);
      box(nearParent, [cx, podiumH * 0.5, z + pd * 0.5 - 0.22], [0.58, podiumH, 0.48], stoneMat);
      box(nearParent, [cx, podiumH * 0.5, z - pd * 0.5 + 0.22], [0.58, podiumH, 0.48], stoneMat);
    }
    for (let iz = 1; iz < colsZ - 1; iz++) {
      const cz = z - pd * 0.5 + 0.32 + (iz / (colsZ - 1)) * (pd - 0.64);
      box(nearParent, [x - pw * 0.5 + 0.22, podiumH * 0.5, cz], [0.48, podiumH, 0.58], stoneMat);
      box(nearParent, [x + pw * 0.5 - 0.22, podiumH * 0.5, cz], [0.48, podiumH, 0.58], stoneMat);
    }
    // Podium cornice slab + warm architectural soffit light band
    box(nearParent, [x, podiumH + 0.32, z], [pw + 0.35, 0.64, pd + 0.35], stoneMat);
    box(nearParent, [x, podiumH - 0.04, z], [pw - 0.1, 0.08, pd - 0.1], warmSoffitMat, false);

    // Cantilevered brushed-steel & glass entrance canopy + illuminated Saigon ground-floor retail signage!
    const canDepth = 2.1;
    const retailMat = retailSignMats[matIdx % retailSignMats.length];
    if (canopySide === "+z" || canopySide === "-z") {
      const s = canopySide === "+z" ? 1 : -1;
      box(nearParent, [x, 4.15, z + s * (pd * 0.5 + canDepth * 0.48)], [Math.min(w * 0.56, 8.0), 0.18, canDepth], bronzeMetal, false);
      box(nearParent, [x, 4.02, z + s * (pd * 0.5 + canDepth * 0.45)], [Math.min(w * 0.52, 7.6), 0.05, canDepth * 0.85], warmSoffitMat, false);
      plane(nearParent, [x, 5.25, z + s * (pd * 0.5 + 0.06)], [Math.min(w * 0.58, 6.2), signHeight(retailMat, Math.min(w * 0.58, 6.2), 1.35)], retailMat, s > 0 ? 0 : Math.PI);
    } else {
      const s = canopySide === "+x" ? 1 : -1;
      box(nearParent, [x + s * (pw * 0.5 + canDepth * 0.48), 4.15, z], [canDepth, 0.18, Math.min(d * 0.56, 8.0)], bronzeMetal, false);
      box(nearParent, [x + s * (pw * 0.5 + canDepth * 0.45), 4.02, z], [canDepth * 0.85, 0.05, Math.min(d * 0.52, 7.6)], warmSoffitMat, false);
      plane(nearParent, [x + s * (pw * 0.5 + 0.06), 5.25, z], [Math.min(d * 0.58, 6.2), signHeight(retailMat, Math.min(d * 0.58, 6.2), 1.35)], retailMat, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    }

    // 3. Stepped Upper Tower Shaft (distinct architectural silhouette per archetype!)
    const shaftBase = podiumH + 0.64;
    const shaftH = Math.max(12, h - shaftBase);
    const hasSetback = h >= 32;
    const mainH = hasSetback ? shaftH * 0.72 : shaftH;
    const upperH = hasSetback ? shaftH * 0.28 : 0;

    // Lower/main curtain-wall shaft
    box(nearParent, [x, shaftBase + mainH * 0.5, z], [w, mainH, d], tm);

    if (archetype === 0) {
      // ARCHETYPE A: Modern Office Tower — 3D vertical aluminum corner pilasters & bay fins
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(nearParent, [x + sx * (w * 0.5 + 0.06), shaftBase + mainH * 0.5, z + sz * (d * 0.5 + 0.06)], [0.46, mainH, 0.46], trimMat, false);
        }
      }
      // Mid-face vertical fins breaking the glass reflection cleanly
      for (const fx of [-w * 0.22, w * 0.22]) {
        box(nearParent, [x + fx, shaftBase + mainH * 0.5, z + d * 0.5 + 0.1], [0.22, mainH, 0.22], trimMat, false);
        box(nearParent, [x + fx, shaftBase + mainH * 0.5, z - d * 0.5 - 0.1], [0.22, mainH, 0.22], trimMat, false);
      }
      for (const fz of [-d * 0.22, d * 0.22]) {
        box(nearParent, [x + w * 0.5 + 0.1, shaftBase + mainH * 0.5, z + fz], [0.22, mainH, 0.22], trimMat, false);
        box(nearParent, [x - w * 0.5 - 0.1, shaftBase + mainH * 0.5, z + fz], [0.22, mainH, 0.22], trimMat, false);
      }
    } else if (archetype === 1) {
      // ARCHETYPE B: Saigon Luxury Residential Condo Tower — 3D cantilevered limestone balcony floor bands!
      const bandStep = 6.5;
      for (let by = shaftBase + 3.2; by < shaftBase + mainH - 1.2; by += bandStep) {
        box(nearParent, [x, by, z], [w + 0.9, 0.28, d + 0.9], warmLimestone, false);
        box(nearParent, [x, by + 0.52, z + d * 0.5 + 0.42], [w + 0.8, 0.72, 0.06], darkMetal, false);
        box(nearParent, [x, by + 0.52, z - d * 0.5 - 0.42], [w + 0.8, 0.72, 0.06], darkMetal, false);
        box(nearParent, [x + w * 0.5 + 0.42, by + 0.52, z], [0.06, 0.72, d + 0.8], darkMetal, false);
        box(nearParent, [x - w * 0.5 - 0.42, by + 0.52, z], [0.06, 0.72, d + 0.8], darkMetal, false);
      }
      // Solid concrete elevator core spine on one flank
      box(nearParent, [x - w * 0.5 - 0.18, shaftBase + mainH * 0.5, z], [0.65, mainH, d * 0.34], warmLimestone, false);
    } else {
      // ARCHETYPE C: Stone-Pier Financial Tower — heavy 3D travertine corner piers + mid-height refuge-floor louver band
      const pierW = Math.min(2.1, w * 0.15);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(nearParent, [x + sx * (w * 0.5 - pierW * 0.35), shaftBase + mainH * 0.5, z + sz * (d * 0.5 - pierW * 0.35)], [pierW, mainH, pierW], travertine, false);
        }
      }
      // Architectural mid-height mechanical/refuge louver band
      const refY = shaftBase + mainH * 0.52;
      box(nearParent, [x, refY, z], [w + 0.22, 1.4, d + 0.22], louverDark, false);
    }

    // 4. Stepped upper tier (architectural setback breaking the box silhouette against the sky!)
    let topW = w;
    let topD = d;
    if (hasSetback) {
      const stepY = shaftBase + mainH;
      box(nearParent, [x, stepY + 0.22, z], [w + 0.32, 0.44, d + 0.32], stoneMat, false);
      topW = w * 0.78;
      topD = d * 0.78;
      box(nearParent, [x, stepY + upperH * 0.5, z], [topW, upperH, topD], tm);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(nearParent, [x + sx * (topW * 0.5 + 0.05), stepY + upperH * 0.5, z + sz * (topD * 0.5 + 0.05)], [0.42, upperH, 0.42], stoneMat, false);
        }
      }
    }

    // 5. Realistic Rooftop Parapet, Mechanical Penthouse & HVAC Chiller Units (ZERO garish neon bars!)
    box(nearParent, [x, h + 0.35, z], [topW + 0.3, 0.72, topD + 0.3], stoneMat, false);
    const pentH = Math.min(4.2, Math.max(2.2, h * 0.06));
    box(nearParent, [x, h + 0.7 + pentH * 0.5, z], [topW * 0.62, pentH, topD * 0.58], louverDark, false);
    box(nearParent, [x, h + 0.7 + pentH + 0.16, z], [topW * 0.66, 0.32, topD * 0.62], stoneMat, false);
    // Rooftop chiller boxes & antenna mast on taller towers
    box(nearParent, [x + topW * 0.22, h + 1.3, z + topD * 0.24], [1.8, 1.2, 1.4], concrete, false);
    if (h > 48) {
      rod(nearParent, [x, h + 0.7 + pentH, z], [x, h + 0.7 + pentH + 5.2, z], 0.11, inox, 0.04, 6);
      const bm = new T.MeshBasicMaterial({ color: new T.Color(4.0, 0.18, 0.1) });
      beacons.push(bm);
      const bMesh = new T.Mesh(new T.SphereGeometry(0.36, 8, 6), bm);
      bMesh.position.set(x, h + 0.7 + pentH + 5.3, z);
      nearParent.add(bMesh);
    }

    if (lodParent) {
      box(lodParent, [x, h * 0.5, z], [w, h, d], tm, false);
      if (hasSetback) {
        box(lodParent, [x, h + pentH * 0.5, z], [topW * 0.62, pentH, topD * 0.58], louverDark, false);
      }
    }
    solids.push(rect(x, z, pw + 0.3, pd + 0.3));
  };

  // =========================================================================
  // CHUNK 1: ROOM 6.07 NORTH NEIGHBORHOOD — AUTHENTIC VIETNAMESE "NHÀ ỐNG" ROWS
  // Cleanly positioned in X ∈ [16.0, 44.5], Z ∈ [-63.0, -30.5] (ZERO overlap with
  // Lý Thái Tổ east shophouses x <= 14.1, Dãy Trọ z >= -19.2, or Đường 3/2 z <= -65.6!)
  // =========================================================================
  const chunkNorthView = new T.Group();
  root.add(chunkNorthView);

  // Inner hẻm concrete alley ground between Row 1 and Row 2 (x: 16..45, z: -52..-38.5)
  plane(chunkNorthView, [30.25, 0.02, -45.25], [29.5, 13.8], concrete, 0, -Math.PI / 2);

  // Row 1: 5 Contiguous Flush-Wall Tube Houses facing +Z (directly outside Room 6.07 window!)
  const row1Lots: [number, number, number, number, number][] = [
    [18.6, -34.5, 5.2, 8.6, 8.0],
    [24.0, -34.5, 5.6, 11.4, 8.0],
    [29.5, -34.5, 5.4, 7.8, 8.0],
    [35.2, -34.5, 6.0, 12.2, 8.0],
    [41.2, -34.5, 6.0, 9.4, 8.0],
  ];
  // Row 2: 4 Contiguous Commercial Shophouses facing -Z onto Đường 3/2 south sidewalk (z = -65.6)
  const row2Lots: [number, number, number, number, number][] = [
    [19.8, -57.5, 6.6, 11.8, 11.0],
    [26.7, -57.5, 7.2, 14.5, 11.0],
    [33.8, -57.5, 7.0, 10.6, 11.0],
    [40.9, -57.5, 7.2, 13.4, 11.0],
  ];

  const buildTubeHouse = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    facing: "+z" | "-z",
    i: number,
  ) => {
    const sign = facing === "+z" ? 1 : -1;
    const frontZ = z + sign * (d * 0.5);
    const backZ = z - sign * (d * 0.5);

    // Main masonry stucco volume
    box(chunkNorthView, [x, h * 0.5, z], [w - 0.04, h, d], stuccoColors[i % stuccoColors.length]);

    // Side masonry party-wall parapets + neatly recessed corrugated tin roof sloping away from front!
    for (const sx of [-1, 1]) {
      box(chunkNorthView, [x + sx * (w * 0.5 - 0.1), h + 0.32, z], [0.16, 0.64, d + 0.06], concrete, false);
    }
    box(chunkNorthView, [x, h + 0.36, frontZ - sign * 0.12], [w, 0.72, 0.2], concrete, false);
    const roof = box(chunkNorthView, [x, h + 0.18, z - sign * 0.2], [w - 0.36, 0.12, d - 0.35], tinRoofMat, false);
    roof.rotation.x = sign * 0.06;

    // Rooftop Sơn Hà stainless steel water tank on steel legs
    const tankY = h + 0.88;
    const tankZ = z - sign * (d * 0.2);
    const tank = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 1.1, 12), inox);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(x + (i % 2 === 0 ? 0.6 : -0.6), tankY, tankZ);
    chunkNorthView.add(tank);
    box(chunkNorthView, [x + (i % 2 === 0 ? 0.6 : -0.6), h + 0.36, tankZ], [1.1, 0.55, 0.72], darkMetal, false);

    // Real photographic Saigon shophouse facade strictly on street front & rear (proper 1-bay proportion — NEVER stretched!)
    const shopMat = realShopMats[i % realShopMats.length];
    plane(chunkNorthView, [x, h * 0.5, frontZ + sign * 0.03], [w - 0.14, h * 0.96], shopMat, facing === "+z" ? 0 : Math.PI);
    plane(chunkNorthView, [x, h * 0.5, backZ - sign * 0.03], [w - 0.14, h * 0.96], shopMat, facing === "+z" ? Math.PI : 0);

    // 3D Vietnamese architectural relief strictly on the street-facing facade (ZERO sideways collisions!)
    addVietnameseShophouseRelief(chunkNorthView, x, z, w - 0.08, h, d, facing, i + 7, true);
    solids.push(rect(x, z, w, d));
  };

  row1Lots.forEach(([x, z, w, h, d], i) => buildTubeHouse(x, z, w, h, d, "+z", i));
  row2Lots.forEach(([x, z, w, h, d], i) => buildTubeHouse(x, z, w, h, d, "-z", i + 5));

  // Vietnamese neon shopfront signs bracket-mounted cleanly onto exact Row 1 +Z facades (z = -30.5 + 0.16 = -30.34!)
  const row1Signs: [string, string, string, string, string, number, number, number][] = [
    ["PHỞ BÒ 24H", "ĐẶC SẢN HÀ NỘI · SÀI GÒN", "#5a1414", "#fff4cc", "#ff4a36", 18.6, 3.85, -30.34],
    ["CÀ PHÊ SỮA ĐÁ", "TRÀ ĐÁ · BẠC XỈU 22K", "#103b2e", "#e8ffdf", "#38e89e", 24.0, 3.85, -30.34],
    ["CƠM TẤM ĐÊM", "SƯỜN BÌ CHẢ · GIAO TẬN NƠI", "#5c330c", "#fff0c4", "#ffaa33", 29.5, 3.85, -30.34],
    ["CIRCLE K 24/7", "CỬA HÀNG TIỆN LỢI", "#6e1010", "#fff7e6", "#ff3b28", 35.2, 3.85, -30.34],
    ["HOTEL HÒA BÌNH", "PHÒNG LẠNH · WIFI FREE", "#102854", "#d8ecff", "#48a8ff", 41.2, 6.95, -30.34],
  ];
  row1Signs.forEach(([t, sub, bg, fg, glow, x, y, z]) => {
    const nm = neonSignMat(t, sub, bg, fg, glow);
    dynamicEmissives.push({ mat: nm, base: 0.22, night: 2.2 });
    box(chunkNorthView, [x, y, z - 0.08], [3.65, 1.08, 0.14], darkMetal, false);
    plane(chunkNorthView, [x, y, z], [3.54, 0.98], nm);
  });

  // Authentic overhead Saigon street cables criss-crossing outside Room 6.07 window (between Dãy Trọ roof & Row 1!)
  for (let c = 0; c < 4; c++) {
    const cy = 6.25 + c * 0.22;
    const wire = tube(
      chunkNorthView,
      [
        [15.5, cy, -25.5 - c * 1.1],
        [23.0, cy - 0.42, -26.2 - c * 1.0],
        [31.5, cy - 0.28, -26.8 - c * 0.9],
        [41.0, cy + 0.08, -27.2 - c * 0.8],
      ],
      0.015,
      darkMetal,
      12,
    );
    wire.castShadow = false;
  }

  streamer.register({
    id: "north-rooftops",
    name: "Khu Nhà Phố Hẻm 462",
    district: "Quận 10",
    cx: 30,
    cz: -46,
    near: chunkNorthView,
    nearDist: 165,
    lodDist: 380,
    alwaysVisible: true,
  });

  // =========================================================================
  // CHUNK 2: EAST COMMERCIAL BOULEVARDS (ĐƯỜNG 3/2 · ĐIỆN BIÊN PHỦ · HẢI TRIỀU)
  // Every sidewalk, intersection, lamp, tree & tower cleanly segmented — ZERO overlaps!
  // =========================================================================
  const chunkEastBlvd = new T.Group();
  const chunkEastBlvdLod = new T.Group();
  root.add(chunkEastBlvd, chunkEastBlvdLod);

  // --- Boulevard 1: Đường 3/2 (Z ∈ [-82, -70], X ∈ [0, 128]) ---
  plane(chunkEastBlvd, [64, 0.002, -76], [128, 12.0], roadMat, 0, -Math.PI / 2);
  plane(chunkEastBlvdLod, [64, 0.002, -76], [128, 12.0], roadMat, 0, -Math.PI / 2);
  // Split sidewalks cleanly around X=56 road (x ∈ [50, 62]) and Lý Thái Tổ sidewalk (x <= 6.8)!
  for (const sz of [-84.2, -67.8]) {
    for (const [x0, x1] of [
      [6.8, 50.0],
      [62.0, 128.0],
    ] as const) {
      const wSeg = x1 - x0;
      const cxSeg = (x0 + x1) * 0.5;
      box(chunkEastBlvd, [cxSeg, CURB_HEIGHT * 0.5, sz], [wSeg, CURB_HEIGHT, 4.4], concrete, false);
      plane(chunkEastBlvd, [cxSeg, CURB_HEIGHT + 0.004, sz], [wSeg, 4.4], plazaMat, 0, -Math.PI / 2);
    }
  }
  // Double yellow median & dashed lane markings (interrupted cleanly at X=56 intersection!)
  for (const [x0, x1] of [
    [6.0, 48.0],
    [64.0, 126.0],
  ] as const) {
    const len = x1 - x0;
    const cx = (x0 + x1) * 0.5;
    plane(chunkEastBlvd, [cx, 0.007, -75.85], [len, 0.12], yellowPaint, 0, -Math.PI / 2);
    plane(chunkEastBlvd, [cx, 0.007, -76.15], [len, 0.12], yellowPaint, 0, -Math.PI / 2);
    for (let x = x0 + 3; x < x1 - 2; x += 6) {
      plane(chunkEastBlvd, [x, 0.007, -73.0], [2.6, 0.12], whitePaint, 0, -Math.PI / 2);
      plane(chunkEastBlvd, [x, 0.007, -79.0], [2.6, 0.12], whitePaint, 0, -Math.PI / 2);
    }
  }
  addCrosswalk(chunkEastBlvd, 5.6, -76, true);
  addCrosswalk(chunkEastBlvd, 48.0, -76, true);
  addCrosswalk(chunkEastBlvd, 64.0, -76, true);

  // Boulevard street sign on south sidewalk corner
  rod(chunkEastBlvd, [9.6, CURB_HEIGHT, -68.2], [9.6, 3.1, -68.2], 0.045, steel);
  plane(chunkEastBlvd, [9.6, 2.78, -68.14], [2.4, 0.44], textLabel("ĐƯỜNG 3/2 → BITEXCO Q.1", "#144d7a", "#f4f3e8", 512, 100, 34));
  plane(chunkEastBlvd, [9.6, 2.78, -68.26], [2.4, 0.44], textLabel("ĐƯỜNG 3/2 → BITEXCO Q.1", "#144d7a", "#f4f3e8", 512, 100, 34), Math.PI);

  // --- Boulevard 2: Đại Lộ Điện Biên Phủ (Z ∈ [-153, -141], X ∈ [0, 132]) ---
  plane(chunkEastBlvd, [66, 0.002, -147], [132, 12.0], roadMat, 0, -Math.PI / 2);
  plane(chunkEastBlvdLod, [66, 0.002, -147], [132, 12.0], roadMat, 0, -Math.PI / 2);
  for (const sz of [-155.2, -138.8]) {
    for (const [x0, x1] of [
      [6.8, 50.0],
      [62.0, 132.0],
    ] as const) {
      const wSeg = x1 - x0;
      const cxSeg = (x0 + x1) * 0.5;
      box(chunkEastBlvd, [cxSeg, CURB_HEIGHT * 0.5, sz], [wSeg, CURB_HEIGHT, 4.4], concrete, false);
      plane(chunkEastBlvd, [cxSeg, CURB_HEIGHT + 0.004, sz], [wSeg, 4.4], plazaMat, 0, -Math.PI / 2);
    }
  }
  for (const [x0, x1] of [
    [6.0, 48.0],
    [64.0, 130.0],
  ] as const) {
    const len = x1 - x0;
    const cx = (x0 + x1) * 0.5;
    plane(chunkEastBlvd, [cx, 0.007, -146.85], [len, 0.12], yellowPaint, 0, -Math.PI / 2);
    plane(chunkEastBlvd, [cx, 0.007, -147.15], [len, 0.12], yellowPaint, 0, -Math.PI / 2);
  }
  addCrosswalk(chunkEastBlvd, 5.6, -147, true);
  addCrosswalk(chunkEastBlvd, 48.0, -147, true);
  addCrosswalk(chunkEastBlvd, 64.0, -147, true);

  // --- North-South Connector Avenue: Đường Hải Triều (X ∈ [50, 62], Z ∈ [-236, -65.6]) ---
  plane(chunkEastBlvd, [56, 0.003, -150.8], [12.0, 170.4], roadMat, 0, -Math.PI / 2);
  plane(chunkEastBlvdLod, [56, 0.003, -150.8], [12.0, 170.4], roadMat, 0, -Math.PI / 2);
  // Proper flanking granite sidewalks along Đường Hải Triều (split cleanly between Blvd 1 & Blvd 2!)
  for (const sx of [48.0, 64.0]) {
    for (const [z0, z1] of [
      [-236.0, -157.4],
      [-136.6, -86.4],
    ] as const) {
      const len = z1 - z0;
      const cz = (z0 + z1) * 0.5;
      box(chunkEastBlvd, [sx, CURB_HEIGHT * 0.5, cz], [4.0, CURB_HEIGHT, len], concrete, false);
      plane(chunkEastBlvd, [sx, CURB_HEIGHT + 0.004, cz], [4.0, len], plazaMat, 0, -Math.PI / 2);
    }
  }
  for (let z = -232; z <= -72; z += 6) {
    if (Math.abs(z + 147) < 8 || Math.abs(z + 76) < 8) continue;
    plane(chunkEastBlvd, [56, 0.008, z], [0.16, 2.8], whitePaint, 0, -Math.PI / 2);
  }
  for (const approach of SIGNAL_APPROACHES) {
    if (approach.owner === "east") addTrafficSignal(chunkEastBlvd, approach);
  }
  addCrosswalk(chunkEastBlvd, 56, -84, false);
  addCrosswalk(chunkEastBlvd, 56, -155, false);

  // Botanical Saigon trees, royal palms & volumetric streetlamps strictly on boulevard sidewalks (never on intersections!)
  for (const x of [12, 18, 25, 32, 38, 44, 70, 77, 86, 95, 102, 110, 118, 125]) {
    addSaigonTree(chunkEastBlvd, x, -67.8, 1.02, x % 3 === 0);
    addSaigonTree(chunkEastBlvd, x, -84.2, 0.98, x % 3 === 1);
    if (x % 2 === 0) addLampPost(chunkEastBlvd, x + 3.2, -83.0, 0, 1, x === 32 || x === 86);
    addSaigonTree(chunkEastBlvd, x, -138.8, 1.0, x % 3 === 2);
    if (x % 2 === 0) addLampPost(chunkEastBlvd, x + 3.2, -154.0, 0, 1, x === 32 || x === 102);
  }
  // Trees & lamps along Đường Hải Triều west sidewalk (X = 48.0)
  for (const z of [-90, -100, -112, -124, -162, -174, -192, -204]) {
    addSaigonTree(chunkEastBlvd, 48.0, z, 1.0, z % 2 === 0);
    if (z % 2 === 0) addLampPost(chunkEastBlvd, 49.0, z + 8, 1, 0, z === -174);
  }

  // District 1 / District 3 Commercial High-Rises — EVERY lot mathematically cleared from all roads, sidewalks & neighbors!
  const commercialTowers: [number, number, number, number, number, "+z" | "-z" | "+x" | "-x"][] = [
    // Block SW (X ∈ [16..45], Z ∈ [-134..-88])
    [24, -98, 13, 28, 13, "+z"],
    [39, -99, 11, 36, 13, "+x"],
    [25, -123, 14, 32, 14, "-z"],
    [39.2, -124, 11, 40, 13, "+x"],
    // Block SE (X ∈ [68..122], Z ∈ [-134..-88])
    [77, -99, 15, 48, 15, "+z"],
    [103, -100, 17, 58, 15, "+z"],
    [78, -124, 15, 44, 15, "-z"],
    [106, -124, 17, 54, 15, "-z"],
    // Block South of Blvd 1, East of Hải Triều (X ∈ [68..122], Z ∈ [-63..-42])
    [78, -54, 16, 38, 14, "-z"],
    [105, -54, 17, 44, 14, "-z"],
    // Block NW of Hải Triều (X ∈ [24..44], Z ∈ [-220..-162])
    [34, -172, 15, 42, 15, "+x"],
    [34, -204, 15, 48, 15, "+x"],
    // Block Far-East behind Bitexco Plaza (X >= 126, Z ∈ [-220..-162])
    [136, -176, 16, 68, 17, "-x"],
    [136, -208, 17, 58, 17, "-x"],
  ];
  commercialTowers.forEach(([x, z, w, h, d, side], i) => {
    addCommercialTower(chunkEastBlvd, chunkEastBlvdLod, x, z, w, h, d, i, side);
  });

  // =========================================================================
  // PHASE 2 & 5: ZERO-OVERLAP MID-RISE SAIGON URBAN INFILL + SOUTHERN Q.10 NEIGHBORHOOD
  // Eliminates empty grey/black voids behind Dãy Trọ 462/14 & along all avenues!
  // =========================================================================
  const infillBlocks: [number, number, number, number, number, "+z" | "-z" | "+x" | "-x"][] = [
    // East of Dãy Trọ 462/14 (X >= 33, Z ∈ [-24..-6])
    [40.5, -14.0, 12.0, 14.5, 14.0, "-z"],
    [54.5, -15.0, 13.0, 18.0, 15.0, "-z"],
    [72.0, -24.0, 16.0, 16.5, 16.0, "-z"],
    [94.0, -24.0, 18.0, 19.5, 16.0, "-z"],
    [116.0, -26.0, 16.0, 21.0, 18.0, "-z"],
    // South of Dãy Trọ 462/14 (Z ∈ [4..30], X ∈ [16..88]) — fills the black void seen from Balcony Floor 2!
    [21.0, 12.0, 12.0, 13.5, 11.0, "-z"],
    [35.0, 12.5, 13.0, 16.0, 11.0, "-z"],
    [50.0, 13.0, 14.0, 18.5, 12.0, "-z"],
    [66.0, 14.0, 14.0, 21.0, 12.0, "-z"],
    [82.0, 15.0, 14.0, 17.5, 12.0, "-z"],
    [28.0, 28.0, 18.0, 22.0, 14.0, "-z"],
    [52.0, 30.0, 20.0, 26.0, 14.0, "-z"],
    [78.0, 32.0, 18.0, 24.0, 14.0, "-z"],
    // Behind Đường 3/2 south row (X ∈ [48..64], Z ∈ [-61..-36])
    [55.5, -49.0, 13.0, 15.5, 16.0, "+z"],
    // Mid-rise fill along Northern Riverside west & east flanks (strictly outside X ∈ [-18..5.2]!)
    [17.5, -216.0, 12.0, 16.0, 18.0, "-x"],
    [17.5, -244.0, 12.0, 19.5, 18.0, "-x"],
    [17.5, -274.0, 12.0, 15.0, 18.0, "-x"],
    [36.0, -246.0, 16.0, 24.0, 20.0, "-x"],
    [36.0, -276.0, 16.0, 22.0, 18.0, "-x"],
    [76.0, -252.0, 18.0, 26.0, 20.0, "-z"],
    [104.0, -254.0, 18.0, 28.0, 20.0, "-z"],
    [-32.0, -220.0, 16.0, 18.0, 20.0, "+x"],
    [-32.0, -254.0, 16.0, 22.0, 20.0, "+x"],
    [-32.0, -286.0, 16.0, 17.0, 18.0, "+x"],
  ];
  infillBlocks.forEach(([x, z, w, h, d, side], i) => {
    const stone = i % 2 === 0 ? travertine : stuccoColors[i % stuccoColors.length];
    const tm = towerMats[i % towerMats.length];
    const shopM = realShopMats[i % realShopMats.length];
    box(chunkEastBlvd, [x, h * 0.5, z], [w, h, d], stone);
    // Warm architectural window cladding on ALL 4 sides (ZERO blank grey boxes seen from Dãy Trọ balcony!)
    box(chunkEastBlvd, [x, h * 0.56, z], [w + 0.14, h * 0.66, d + 0.14], i < 13 ? shopM : tm, false);
    box(chunkEastBlvd, [x, h + 0.28, z], [w + 0.22, 0.56, d + 0.22], concrete, false);
    box(chunkEastBlvd, [x, 0.24, z], [w + 0.16, 0.48, d + 0.16], darkGranite, false);
    const signM = retailSignMats[(i + 2) % retailSignMats.length];
    const s = side === "+z" || side === "+x" ? 1 : -1;
    if (side === "+z" || side === "-z") {
      plane(chunkEastBlvd, [x, 3.8, z + s * (d * 0.5 + 0.08)], [Math.min(w * 0.62, 5.8), signHeight(signM, Math.min(w * 0.62, 5.8), 1.2)], signM, s > 0 ? 0 : Math.PI);
    } else {
      plane(chunkEastBlvd, [x + s * (w * 0.5 + 0.08), 3.8, z], [Math.min(d * 0.62, 5.8), signHeight(signM, Math.min(d * 0.62, 5.8), 1.2)], signM, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    solids.push(rect(x, z, w + 0.2, d + 0.2));
  });

  // =========================================================================
  // PHASE 2 & 5: 4 GPU-ANIMATED SAIGON DIGITAL LED BILLBOARDS (Elevated clear of ALL poles/trees!)
  // =========================================================================
  const billboardSpecs: {
    pos: [number, number, number];
    size: [number, number];
    ry: number;
    headline: string;
    subline: string;
    accentA: string;
    accentB: string;
    badge: string;
  }[] = [
    {
      pos: [37.5, 17.6, -91.8],
      size: [8.6, 4.4],
      ry: 0,
      headline: "SÀI GÒN 2026",
      subline: "METRO BẾN THÀNH · SUỐI TIÊN",
      accentA: "#143d6b",
      accentB: "#38d4ff",
      badge: "QUẬN 1 LIVE",
    },
    {
      pos: [69.0, 18.2, -104.0],
      size: [9.4, 4.8],
      ry: -Math.PI / 2,
      headline: "BITEXCO SKYDECK",
      subline: "TẦNG 49 · TOÀN CẢNH TP.HCM",
      accentA: "#4a1938",
      accentB: "#ff8c42",
      badge: "HẢI TRIỀU Q.1",
    },
    {
      pos: [78.0, 18.0, -132.1],
      size: [9.0, 4.6],
      ry: Math.PI,
      headline: "CÀ PHÊ SỮA ĐÁ",
      subline: "HƯƠNG VỊ PHỐ THỊ SÀI GÒN",
      accentA: "#3d2214",
      accentB: "#ffca58",
      badge: "ĐIỆN BIÊN PHỦ",
    },
    {
      pos: [42.1, 18.4, -172.0],
      size: [9.2, 4.8],
      ry: Math.PI / 2,
      headline: "LANDMARK 81",
      subline: "VINHOMES CENTRAL PARK · 461M",
      accentA: "#0e3b46",
      accentB: "#4ef0b8",
      badge: "BÌNH THẠNH",
    },
  ];
  for (const bs of billboardSpecs) {
    const bm = createAnimatedLedBillboardMaterial(bs);
    ledBillboardMats.push(bm);
    const frame = new T.Group();
    frame.position.set(bs.pos[0], bs.pos[1], bs.pos[2]);
    frame.rotation.y = bs.ry;
    box(frame, [0, 0, -0.18], [bs.size[0] + 0.36, bs.size[1] + 0.36, 0.3], darkMetal, false);
    const screen = new T.Mesh(new T.PlaneGeometry(bs.size[0], bs.size[1]), bm);
    frame.add(screen);
    dynamicRoot.add(frame);
  }

  // Instanced Saigon street storytelling micro-props (arrows, stop bars, storm drains, cabinets, bins, sidewalk cafés!)
  buildSaigonStreetProps(dynamicRoot, solids);

  streamer.register({
    id: "east-boulevards",
    name: "Đại Lộ Thương Mại Quận 1",
    district: "Quận 10 → Quận 1",
    cx: 66,
    cz: -120,
    near: chunkEastBlvd,
    lod: chunkEastBlvdLod,
    nearDist: 175,
    lodDist: 580,
  });

  // =========================================================================
  // CHUNK 3: BITEXCO FINANCIAL TOWER PLAZA (EXACT PROVIDED MODEL #1 — 262.5M!)
  // Plaza spans X ∈ [66.0, 122.0], Z ∈ [-212.6, -157.4] — FLUSH with Hải Triều (x=66)
  // and Điện Biên Phủ sidewalk (z=-157.4), ZERO road overlap!
  // =========================================================================
  const chunkBitexco = new T.Group();
  root.add(chunkBitexco);

  const bxPlaza = box(chunkBitexco, [BITEXCO_POS.x, CURB_HEIGHT * 0.5, BITEXCO_POS.z + 1.0], [56, CURB_HEIGHT, 55.2], plazaMat, false);
  bxPlaza.receiveShadow = true;

  // Live Animated Reflecting Pool + Granite Coping strictly inside southwest corner of plaza
  plane(chunkBitexco, [BITEXCO_POS.x - 16, CURB_HEIGHT + 0.06, BITEXCO_POS.z + 18], [14.2, 7.2], waterMat, 0, -Math.PI / 2);
  box(chunkBitexco, [BITEXCO_POS.x - 16, CURB_HEIGHT + 0.16, BITEXCO_POS.z + 21.7], [14.6, 0.32, 0.34], concrete);
  box(chunkBitexco, [BITEXCO_POS.x - 16, CURB_HEIGHT + 0.16, BITEXCO_POS.z + 14.3], [14.6, 0.32, 0.34], concrete);
  box(chunkBitexco, [BITEXCO_POS.x - 23.1, CURB_HEIGHT + 0.16, BITEXCO_POS.z + 18], [0.34, 0.32, 7.4], concrete);
  box(chunkBitexco, [BITEXCO_POS.x - 8.9, CURB_HEIGHT + 0.16, BITEXCO_POS.z + 18], [0.34, 0.32, 7.4], concrete);

  // Stainless lighted bollards lining Bitexco west frontage (x = 67.4, well clear of x=62 road!)
  for (let z = BITEXCO_POS.z - 22; z <= BITEXCO_POS.z + 24; z += 4.6) {
    rod(chunkBitexco, [BITEXCO_POS.x - 26.6, CURB_HEIGHT, z], [BITEXCO_POS.x - 26.6, CURB_HEIGHT + 0.85, z], 0.065, inox, 0.065, 10);
    box(chunkBitexco, [BITEXCO_POS.x - 26.6, CURB_HEIGHT + 0.78, z], [0.14, 0.07, 0.14], streetLampMat, false);
  }
  // Modern granite plaza benches
  for (const bz of [BITEXCO_POS.z - 12, BITEXCO_POS.z - 2, BITEXCO_POS.z + 10]) {
    box(chunkBitexco, [BITEXCO_POS.x - 21.5, CURB_HEIGHT + 0.24, bz], [0.65, 0.44, 2.2], concrete);
  }

  // Bitexco Financial Tower Monument Sign
  box(chunkBitexco, [BITEXCO_POS.x - 24.5, CURB_HEIGHT + 1.2, BITEXCO_POS.z + 6], [0.45, 2.4, 4.6], material(0x1b2128, 0.32, 0.68));
  const bxSign = neonSignMat("BITEXCO TOWER", "2 HẢI TRIỀU · QUẬN 1 · TP.HCM", "#111b28", "#f4e6be", "#46aaff");
  dynamicEmissives.push({ mat: bxSign, base: 0.25, night: 1.9 });
  plane(chunkBitexco, [BITEXCO_POS.x - 24.75, CURB_HEIGHT + 1.35, BITEXCO_POS.z + 6], [4.2, 1.35], bxSign, -Math.PI / 2);

  // Royal Palms framing Bitexco Plaza (100% inside granite plaza!)
  for (const [tx, tz] of [
    [BITEXCO_POS.x - 24, BITEXCO_POS.z - 20],
    [BITEXCO_POS.x - 24, BITEXCO_POS.z + 24],
    [BITEXCO_POS.x + 24, BITEXCO_POS.z - 20],
    [BITEXCO_POS.x + 24, BITEXCO_POS.z + 24],
  ] as const) {
    addSaigonTree(chunkBitexco, tx, tz, 1.25, true);
  }
  addLampPost(chunkBitexco, BITEXCO_POS.x - 24.5, BITEXCO_POS.z - 6, 1, 0, true);
  addLampPost(chunkBitexco, BITEXCO_POS.x - 24.5, BITEXCO_POS.z + 14, 1, 0, false);

  // Stepped Dark-Granite & Glass Lotus Entrance Podium Plinth hugging Bitexco's base (ZERO floating gap!)
  const bxPlinth1 = new T.Mesh(new T.CylinderGeometry(14.8, 15.6, 0.75, 24), darkGranite);
  bxPlinth1.position.set(BITEXCO_POS.x, CURB_HEIGHT + 0.375, BITEXCO_POS.z);
  bxPlinth1.receiveShadow = true;
  chunkBitexco.add(bxPlinth1);
  const bxPlinth2 = new T.Mesh(new T.CylinderGeometry(13.2, 13.8, 4.4, 24), lobbyWarmInterior);
  bxPlinth2.position.set(BITEXCO_POS.x, CURB_HEIGHT + 2.8, BITEXCO_POS.z);
  chunkBitexco.add(bxPlinth2);
  const bxCanopyRing = new T.Mesh(new T.CylinderGeometry(14.6, 14.6, 0.28, 24), bronzeMetal);
  bxCanopyRing.position.set(BITEXCO_POS.x, CURB_HEIGHT + 5.05, BITEXCO_POS.z);
  chunkBitexco.add(bxCanopyRing);

  solids.push(rect(BITEXCO_POS.x, BITEXCO_POS.z, 26, 26));

  const bitexcoBeaconMat = new T.MeshBasicMaterial({ color: new T.Color(4.5, 0.2, 0.1) });
  beacons.push(bitexcoBeaconMat);
  const bxApexBeacon = new T.Mesh(new T.SphereGeometry(0.95, 10, 8), bitexcoBeaconMat);
  bxApexBeacon.position.set(BITEXCO_POS.x, 263.5, BITEXCO_POS.z);
  chunkBitexco.add(bxApexBeacon);

  districtLights.push({
    spec: { x: BITEXCO_POS.x - 12, y: 185, z: BITEXCO_POS.z + 18, color: 0x6eb8ff, distance: 150, decay: 1.5, intensity: 0 },
    max: 65,
  });

  // Stream the EXACT Bitexco Financial Tower 3D model asynchronously + inject realistic Lotus Glass Curtain-Wall Shader!
  const hydrateBitexco = async () => {
    const gltf = await loader.loadAsync(`/assets/testbus/ow/models/bitexco.optimized.glb`).catch((err) => {
      console.error("Failed to load Bitexco model:", err);
      return null;
    });
    if (!gltf || disposed) return;
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(model, true);
    const size = bounds.getSize(new T.Vector3());
    const center = bounds.getCenter(new T.Vector3());
    const targetHeight = 262.5;
    const scale = targetHeight / Math.max(1, size.y);
    const wrapper = new T.Group();
    wrapper.name = "BitexcoFinancialTower";
    model.scale.setScalar(scale);
    // Seat base cleanly inside the stepped granite entrance podium (-0.4m overlap guarantees ZERO air gap!)
    model.position.set(-center.x * scale, -bounds.min.y * scale + CURB_HEIGHT - 0.4, -center.z * scale);
    model.traverse((obj) => {
      if (obj instanceof T.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = true;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m instanceof T.MeshStandardMaterial) {
            // Photorealistic Bitexco Financial Tower Lotus Curtain-Wall Glass (fine mullions, real sky reflection, ZERO Minecraft blocks!)
            m.color.setHex(0x4f687f);
            m.roughness = 0.16;
            m.metalness = 0.72;
            m.envMapIntensity = 2.6;
            m.customProgramCacheKey = () => "bitexco-lotus-curtainwall-v2";
            m.onBeforeCompile = (shader) => {
              shader.uniforms.uBxNight = SAIGON_SHADER_UNIFORMS.uNight;
              shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\nvarying vec3 vBxWorld;\nvarying vec3 vBxNorm;")
                .replace(
                  "#include <worldpos_vertex>",
                  `#include <worldpos_vertex>
                   vBxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
                   vBxNorm = normalize(mat3(modelMatrix) * objectNormal);`,
                );
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  "#include <common>",
                  `#include <common>
                   uniform float uBxNight;
                   varying vec3 vBxWorld;
                   varying vec3 vBxNorm;
                   float bxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
                )
                .replace(
                  "#include <emissivemap_fragment>",
                  `#include <emissivemap_fragment>
                   float floorIdx = floor(max(vBxWorld.y, 0.0) / 3.35);
                   float floorF = fract(max(vBxWorld.y, 0.0) / 3.35);
                   float ang = atan(vBxWorld.z - (${BITEXCO_POS.z.toFixed(1)}), vBxWorld.x - (${BITEXCO_POS.x.toFixed(1)}));
                   // Ultra-fine 48-panel lotus curtain-wall glass grid (authentic real-world mullion scale!)
                   float panelCount = 48.0;
                   float bayIdx = floor(((ang + 3.1415926) / 6.2831853) * panelCount);
                   float bayF = fract(((ang + 3.1415926) / 6.2831853) * panelCount);
                   float spandrel = smoothstep(0.0, 0.16, floorF) * smoothstep(1.0, 0.86, floorF);
                   float mullion = smoothstep(0.0, 0.09, bayF) * smoothstep(1.0, 0.91, bayF);
                   float glassPane = spandrel * mullion * (1.0 - abs(vBxNorm.y));
                   // Realistic architectural glass reflection (subtle pane bow + sky gradient)
                   vec3 viewBx = normalize(cameraPosition - vBxWorld);
                   vec3 nBx = normalize(vBxNorm);
                   float fresBx = 0.25 + 0.75 * pow(1.0 - clamp(abs(dot(nBx, viewBx)), 0.0, 1.0), 2.8);
                   float paneBow = bxHash(vec2(floorIdx, bayIdx)) * 0.14 - 0.07;
                   vec3 reflSky = mix(vec3(0.46, 0.56, 0.66), vec3(0.14, 0.24, 0.38), clamp(nBx.y * 0.5 + 0.5 + paneBow, 0.0, 1.0));
                   reflSky = mix(reflSky, vec3(0.04, 0.07, 0.13), uBxNight);
                   // Sparse delicate illuminated corporate floors ONLY at dusk/night (ZERO checkerboard daytime blocks!)
                   float suiteSeed = bxHash(vec2(floorIdx, floor(bayIdx / 3.0)));
                   float paneSeed = bxHash(vec2(floorIdx * 1.9, bayIdx));
                   float suiteLit = step(0.56, suiteSeed) * (0.35 + 0.65 * paneSeed) * smoothstep(0.25, 0.92, floorF);
                   vec3 officeCol = mix(vec3(1.0, 0.82, 0.54), vec3(0.76, 0.88, 1.0), step(0.74, suiteSeed));
                   float skydeckBand = smoothstep(178.0, 184.0, vBxWorld.y) * smoothstep(200.0, 192.0, vBxWorld.y);
                   float nightFade = smoothstep(0.18, 0.72, uBxNight);
                   diffuseColor.rgb *= mix(0.45, 1.0, glassPane);
                   totalEmissiveRadiance += reflSky * fresBx * mix(0.42, 0.16, uBxNight) * glassPane;
                   totalEmissiveRadiance += officeCol * glassPane * suiteLit * nightFade * 0.78;
                   totalEmissiveRadiance += vec3(0.42, 0.80, 1.0) * skydeckBand * (0.12 + nightFade * 1.15);`,
                );
            };
            m.needsUpdate = true;
          }
        }
      }
    });
    wrapper.add(model);
    wrapper.position.copy(BITEXCO_POS);
    wrapper.rotation.y = -0.58;
    chunkBitexco.add(wrapper);
    freezeStaticMatrices(wrapper);
    onAssetLoaded?.(wrapper);
    streamer.landmarksReady++;
  };

  streamer.register({
    id: "bitexco-tower",
    name: "Bitexco Financial Tower",
    district: "Quận 1",
    cx: BITEXCO_POS.x,
    cz: BITEXCO_POS.z,
    near: chunkBitexco,
    nearDist: 450,
    lodDist: 900,
    alwaysVisible: true,
    hydrate: hydrateBitexco,
  });

  // =========================================================================
  // CHUNK 4: NORTHERN RIVERSIDE AVENUE & LANDMARK 81 (EXACT PROVIDED MODEL #2 — 461.2M!)
  // Road ends cleanly at Vinhomes Park Boulevard (Z ∈ [-312, -300]); Park Lawn &
  // Landmark 81 Plaza begin strictly north of Z = -316.4 (ZERO road/lawn overlap!)
  // =========================================================================
  const chunkLandmark = new T.Group();
  root.add(chunkLandmark);

  // Northern Riverside Avenue (X ∈ [-12.8, 0], Z ∈ [-312, -195])
  plane(chunkLandmark, [-6.4, 0.001, -253.5], [12.8, 117], roadMat, 0, -Math.PI / 2);
  // West sidewalk runs full length [-312, -195]; East sidewalk stops cleanly at Park Entrance Road (-300)
  box(chunkLandmark, [-15.4, CURB_HEIGHT * 0.5, -253.5], [5.2, CURB_HEIGHT, 117], concrete, false);
  plane(chunkLandmark, [-15.4, CURB_HEIGHT + 0.004, -253.5], [5.2, 117], plazaMat, 0, -Math.PI / 2);
  box(chunkLandmark, [2.6, CURB_HEIGHT * 0.5, -247.5], [5.2, CURB_HEIGHT, 105], concrete, false);
  plane(chunkLandmark, [2.6, CURB_HEIGHT + 0.004, -247.5], [5.2, 105], plazaMat, 0, -Math.PI / 2);
  plane(chunkLandmark, [-6.25, 0.007, -248.0], [0.12, 102], yellowPaint, 0, -Math.PI / 2);
  plane(chunkLandmark, [-6.55, 0.007, -248.0], [0.12, 102], yellowPaint, 0, -Math.PI / 2);

  // East-West Vinhomes Park Entrance Boulevard (Z ∈ [-312, -300], X ∈ [0, 96])
  plane(chunkLandmark, [48, 0.002, -306], [96, 12.0], roadMat, 0, -Math.PI / 2);
  plane(chunkLandmark, [48, 0.007, -305.85], [90, 0.12], yellowPaint, 0, -Math.PI / 2);
  plane(chunkLandmark, [48, 0.007, -306.15], [90, 0.12], yellowPaint, 0, -Math.PI / 2);
  addCrosswalk(chunkLandmark, 26, -306, false);
  // South sidewalk along Park Entrance Road (Z ∈ [-300, -295.6], X ∈ [5.2, 96])
  box(chunkLandmark, [50.6, CURB_HEIGHT * 0.5, -297.8], [90.8, CURB_HEIGHT, 4.4], concrete, false);
  plane(chunkLandmark, [50.6, CURB_HEIGHT + 0.004, -297.8], [90.8, 4.4], plazaMat, 0, -Math.PI / 2);
  // North Park Promenade Sidewalk (Z ∈ [-316.4, -312], X ∈ [-18, 96])
  box(chunkLandmark, [39, CURB_HEIGHT * 0.5, -314.2], [114, CURB_HEIGHT, 4.4], concrete, false);
  plane(chunkLandmark, [39, CURB_HEIGHT + 0.004, -314.2], [114, 4.4], plazaMat, 0, -Math.PI / 2);

  // Vinhomes Central Park Lawn (strictly north of promenade: X ∈ [-54, 106], Z ∈ [-400, -316.4])
  const parkGround = plane(chunkLandmark, [LANDMARK81_POS.x, CURB_HEIGHT - 0.01, -358.2], [160, 83.6], grassMat, 0, -Math.PI / 2);
  parkGround.receiveShadow = true;

  // Landmark 81 Granite Deck (X ∈ [-6, 58], Z ∈ [-387, -325]) + Grand Entrance Walkway to Promenade
  box(chunkLandmark, [LANDMARK81_POS.x, CURB_HEIGHT * 0.5, LANDMARK81_POS.z], [64, CURB_HEIGHT, 62], plazaMat, false);
  box(chunkLandmark, [LANDMARK81_POS.x, CURB_HEIGHT * 0.5, -320.7], [20, CURB_HEIGHT, 8.6], plazaMat, false);

  // Concrete riverside embankment promenade wall + stainless railing overlooking Saigon River
  box(chunkLandmark, [LANDMARK81_POS.x, CURB_HEIGHT + 0.1, -400.5], [166, 0.65, 1.2], concrete);
  rod(chunkLandmark, [LANDMARK81_POS.x - 80, CURB_HEIGHT + 1.05, -400.7], [LANDMARK81_POS.x + 80, CURB_HEIGHT + 1.05, -400.7], 0.03, inox);
  plane(chunkLandmark, [40, -0.32, -442], [560, 82], waterMat, 0, -Math.PI / 2);

  // Park trees strictly on grass lawn outside granite deck and towers (ZERO road/tower collisions!)
  const parkTreeCoords: [number, number, boolean][] = [
    [-12, -322, true],
    [-14, -342, false],
    [-12, -366, true],
    [-14, -388, false],
    [64, -322, true],
    [66, -344, false],
    [64, -368, true],
    [66, -388, false],
    [8, -394, true],
    [26, -394, false],
    [44, -394, true],
    [-22, -388, false],
    [76, -390, false],
  ];
  for (const [tx, tz, isPalm] of parkTreeCoords) {
    addSaigonTree(chunkLandmark, tx, tz, 1.25, isPalm);
  }
  for (let z = -292; z <= -206; z += 24) {
    addLampPost(chunkLandmark, 1.4, z, -1, 0, z === -244 || z === -292);
    addSaigonTree(chunkLandmark, 3.8, z + 8, 1.05, true);
  }
  for (const px of [2, 20, 38, 56]) {
    addLampPost(chunkLandmark, px, -313.5, 0, 1, px === 20);
  }

  // Landmark 81 Monument Sign cleanly beside entrance walkway
  const lmSign = neonSignMat("LANDMARK 81", "VINHOMES CENTRAL PARK · BÌNH THẠNH", "#0e1d2e", "#f7f3df", "#68c4ff");
  dynamicEmissives.push({ mat: lmSign, base: 0.25, night: 2.0 });
  box(chunkLandmark, [LANDMARK81_POS.x - 16, CURB_HEIGHT + 1.3, -321.5], [5.4, 2.6, 0.5], material(0x1f262e, 0.35, 0.6));
  plane(chunkLandmark, [LANDMARK81_POS.x - 16, CURB_HEIGHT + 1.4, -321.22], [5.0, 1.55], lmSign);

  // Flanking Vinhomes Central Park Luxury Residential Towers (strictly on park flanks, north of Z=-320, clear of granite deck!)
  const parkTowers: [number, number, number, number, number, "+z" | "-z" | "+x" | "-x"][] = [
    [-34, -368, 20, 138, 20, "+x"],
    [-32, -335, 18, 98, 18, "+z"],
    [84, -368, 20, 152, 22, "-x"],
    [82, -335, 18, 118, 18, "+z"],
  ];
  parkTowers.forEach(([x, z, w, h, d, side], i) => {
    addCommercialTower(chunkLandmark, null, x, z, w, h, d, i + 1, side);
  });

  solids.push(rect(LANDMARK81_POS.x, LANDMARK81_POS.z, 36, 36));

  const lmBeaconMat = new T.MeshBasicMaterial({ color: new T.Color(4.8, 0.22, 0.1) });
  beacons.push(lmBeaconMat);
  const lmSpireBeacon = new T.Mesh(new T.SphereGeometry(1.45, 10, 8), lmBeaconMat);
  lmSpireBeacon.position.set(LANDMARK81_POS.x, 462.5, LANDMARK81_POS.z);
  chunkLandmark.add(lmSpireBeacon);

  districtLights.push({
    spec: { x: LANDMARK81_POS.x, y: 380, z: LANDMARK81_POS.z + 25, color: 0x88c8ff, distance: 240, decay: 1.4, intensity: 0 },
    max: 85,
  });

  // Stream the EXACT Landmark 81 3D model asynchronously
  const hydrateLandmark81 = async () => {
    const gltf = await loader.loadAsync(`/assets/testbus/ow/models/landmark-81.glb`).catch((err) => {
      console.error("Failed to load Landmark 81 model:", err);
      return null;
    });
    if (!gltf || disposed) return;
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(model, true);
    const size = bounds.getSize(new T.Vector3());
    const center = bounds.getCenter(new T.Vector3());
    const targetHeight = 461.2;
    const scale = targetHeight / Math.max(1, size.y);
    const wrapper = new T.Group();
    wrapper.name = "Landmark81Tower";
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale + CURB_HEIGHT, -center.z * scale);
    model.traverse((obj) => {
      if (obj instanceof T.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = true;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m instanceof T.MeshStandardMaterial) {
            m.envMapIntensity = 1.7;
            m.roughness = Math.min(m.roughness, 0.22);
            m.metalness = Math.max(m.metalness, 0.48);
            if (m.map && !m.emissiveMap) {
              m.emissiveMap = m.map;
              m.emissive.set(0x98ccff);
              m.emissiveIntensity = 0.3;
              dynamicEmissives.push({ mat: m, base: 0.03, night: 0.58 });
            }
            m.needsUpdate = true;
          }
        }
      }
    });
    wrapper.add(model);
    wrapper.position.copy(LANDMARK81_POS);
    wrapper.rotation.y = 0.28;
    chunkLandmark.add(wrapper);
    onAssetLoaded?.(wrapper);
    streamer.landmarksReady++;
  };

  streamer.register({
    id: "landmark-81",
    name: "Landmark 81 · Vinhomes Central Park",
    district: "Bình Thạnh",
    cx: LANDMARK81_POS.x,
    cz: LANDMARK81_POS.z,
    near: chunkLandmark,
    nearDist: 560,
    lodDist: 1000,
    alwaysVisible: true,
    hydrate: hydrateLandmark81,
  });

  // =========================================================================
  // CHUNK 5: HO CHI MINH CITY DISTANT HORIZON SKYLINE RING (Stepped silhouettes, ZERO neon bars!)
  // Strictly placed far outside all playable districts & roadways
  // =========================================================================
  const chunkHorizon = new T.Group();
  root.add(chunkHorizon);
  plane(chunkHorizon, [35, -0.08, -140], [880, 880], material(0x282d30, 0.96), 0, -Math.PI / 2);

  const skylineRing: [number, number, number, number, number][] = [
    [-82, -80, 22, 48, 20],
    [-96, -150, 24, 64, 22],
    [-78, -220, 22, 76, 22],
    [-92, -295, 26, 88, 24],
    [172, -88, 24, 72, 22],
    [180, -165, 26, 98, 24],
    [186, -255, 28, 118, 26],
    [152, -310, 24, 92, 22],
    [-64, 88, 24, 42, 22],
    [54, 92, 26, 52, 22],
    [106, 54, 22, 46, 22],
  ];
  skylineRing.forEach(([x, z, w, h, d], i) => {
    const tm = towerMats[i % towerMats.length];
    const baseH = h * 0.72;
    const upperH = h * 0.28;
    box(chunkHorizon, [x, baseH * 0.5, z], [w, baseH, d], tm, false);
    box(chunkHorizon, [x, baseH + upperH * 0.5, z], [w * 0.74, upperH, d * 0.74], tm, false);
    box(chunkHorizon, [x, h + 1.4, z], [w * 0.45, 2.8, d * 0.45], louverDark, false);
  });

  streamer.register({
    id: "hcmc-skyline-horizon",
    name: "Đường Chân Trời TP.HCM",
    district: "TP. Hồ Chí Minh",
    cx: 35,
    cz: -140,
    near: chunkHorizon,
    nearDist: 900,
    lodDist: 1200,
    alwaysVisible: true,
  });

  // =========================================================================
  // OPEN-SOURCE PBR VEHICLE FLEET & ANIMATED NPCS
  // =========================================================================
  const headlightMat = new T.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new T.Color(0xfff0c4),
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const taillightMat = new T.MeshStandardMaterial({
    color: 0xaa1010,
    emissive: new T.Color(0xff2218),
    emissiveIntensity: 2.4,
    roughness: 0.15,
  });
  const beamMat = new T.MeshBasicMaterial({
    color: 0xffe8b0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
  });
  headlightMats.push(headlightMat);
  taillightMats.push(taillightMat);
  vehicleBeamMats.push(beamMat);

  const managedCrews: { root: T.Object3D; vehRoot: T.Object3D }[] = [];

  const loadExpandedFleet = async () => {
    const base = `/assets/testbus/ow/models/`;
    const [taxiGltf, sedanGltf, suvGltf, vanGltf, truckGltf, motoGltf, riderGltf, baothuGltf] = await Promise.all([
      loader.loadAsync(`${base}vehicles/taxi_corolla.glb`).catch(() => null),
      loader.loadAsync(`${base}vehicles/harmony.glb`).catch(() => null),
      loader.loadAsync(`${base}vehicles/savanna.glb`).catch(() => null),
      loader.loadAsync(`${base}vehicles/mula_van.glb`).catch(() => null),
      loader.loadAsync(`${base}vehicles/mula_van.glb`).catch(() => null),
      loader.loadAsync(`${base}vehicles/motorbike.glb`).catch(() => null),
      loader.loadAsync(`${base}bike-rider.optimized.glb`).catch(() => null),
      loader.loadAsync(`${base}baothu.optimized.glb`).catch(() => null),
    ]);
    if (disposed) return;

    let crewIndex = 4;
    let managedVehIdx = 0;

    const addVehicle = async (
      source: T.Object3D,
      targetLength: number,
      axis: "x" | "z",
      lane: number,
      min: number,
      max: number,
      start: number,
      dir: number,
      speed: number,
      kind: "car" | "truck" | "moto" | "rider",
      managedSpawn?: { edgeId: string; s: number; laneIndex?: 0 | 1 },
    ) => {
      if (disposed) return;
      const vehRoot = new T.Group();
      const holder = new T.Group();
      vehRoot.add(holder);
      const obj = source.clone(true);
      const b = new T.Box3().setFromObject(obj, true);
      const sz = b.getSize(new T.Vector3());

      if (kind !== "rider") {
        if (sz.x > sz.z) obj.rotation.y += Math.PI / 2;
        obj.rotation.y += Math.PI;
        obj.updateMatrixWorld(true);
        const b1 = new T.Box3().setFromObject(obj, true);
        const s = targetLength / Math.max(b1.max.z - b1.min.z, 0.5);
        obj.scale.setScalar(s);
        obj.updateMatrixWorld(true);
        const b2 = new T.Box3().setFromObject(obj, true);
        const c2 = b2.getCenter(new T.Vector3());
        obj.position.set(-c2.x, -b2.min.y, -c2.z);
      } else {
        const ctr = b.getCenter(new T.Vector3());
        obj.scale.setScalar(targetLength);
        obj.position.set(-ctr.x * targetLength, -b.min.y * targetLength, -ctr.z * targetLength);
      }

      const wheels: T.Object3D[] = [];
      obj.traverse((n) => {
        if (n instanceof T.Mesh) {
          n.castShadow = false;
          n.receiveShadow = true;
          // Upgrade GLB vehicle paint to realistic metallic automotive clearcoat PBR (no flat cartoon yellow/white!)
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          for (const m of mats) {
            if (m instanceof T.MeshStandardMaterial && !/tire|wheel|rubber|glass/i.test(n.name + m.name)) {
              m.envMapIntensity = 1.85;
              m.roughness = Math.min(m.roughness, 0.24);
              m.metalness = Math.max(m.metalness, 0.36);
              m.color.multiplyScalar(0.84);
            }
          }
        }
        if (/^wheel_|^FrontWheel|^RearWheel/i.test(n.name)) wheels.push(n);
      });
      holder.add(obj);
      const lamps = markLampParts(holder, obj, new T.Vector3(0, 0, 1));
      // Every moving vehicle except the pre-ridden baothu / bike-rider models gets a driver; bodies are merged to
      // a handful of draw calls and the wheels spin in the direction of travel.
      let crew: CrewMember | null = null;
      if (kind !== "rider") {
        if (kind === "moto") await simplifyInPlace(obj, 0.4);
        if (disposed) return;
        const equipped = await equipVehicle({
          host: holder,
          vehicle: obj,
          kind: kind === "moto" ? "moto" : "car",
          forward: new T.Vector3(0, 0, 1),
          variant: crewIndex++,
          isDisposed: () => disposed,
        });
        crew = equipped.crew;
        if (crew) onAssetLoaded?.(crew.root);
      }
      const spinSigns = wheelSpinSigns(holder, wheels, new T.Vector3(0, 0, 1));
      const radius = wheels[0] ? wheelRadius(wheels[0], 0.3) : 0.3;
      if (lamps.head) addHeadlightBeam(holder, obj, new T.Vector3(0, 0, 1), kind === "car" ? "car" : kind === "truck" ? "truck" : "moto");

      const contactW = kind === "truck" ? 2.6 : kind === "car" ? 2.15 : 1.0;
      const contactL = kind === "truck" ? targetLength : kind === "car" ? targetLength : 2.15;
      contact(holder, 0, 0.01, 0, contactW, contactL, shade);

      if (trafficMgr && managedSpawn) {
        dynamicRoot.add(vehRoot);
        onAssetLoaded?.(vehRoot);

        const isMoto = kind === "moto" || kind === "rider";
        const halfWidth = kind === "truck" ? 0.98 : kind === "car" ? 0.92 : 0.44;
        const halfLength = isMoto ? 1.04 : targetLength * 0.5;
        const dynamicLights = attachDynamicLamps(holder, halfWidth, halfLength, isMoto);

        holder.updateWorldMatrix(true, true);
        const invHolder = new T.Matrix4().copy(holder.matrixWorld).invert();
        const tmp = new T.Vector3();
        const detailedWheels = wheels.map((node, i) => {
          node.getWorldPosition(tmp).applyMatrix4(invHolder);
          // In holder local space, forward is +Z -> front wheels have local z > +0.15 (or name matches Front)
          const isFront = /front|_fl|_fr|wheel_f/i.test(node.name) || tmp.z > 0.15;
          return { node, sign: spinSigns[i], isFront, baseYaw: node.rotation.y };
        });

        let crewHead: T.Object3D | undefined;
        if (crew) {
          crew.root.traverse((o) => {
            if (!crewHead && o instanceof T.Bone && /head$/i.test(o.name)) crewHead = o;
          });
          managedCrews.push({ root: crew.root, vehRoot });
        }

        trafficMgr.spawnVehicle({
          id: `DIST_VEH_${managedVehIdx++}`,
          category: isMoto ? "moto" : kind === "truck" ? "van" : "car",
          edgeId: managedSpawn.edgeId,
          s: managedSpawn.s,
          laneIndex: managedSpawn.laneIndex,
          halfWidth,
          halfLength,
          rig: {
            root: vehRoot,
            chassis: holder,
            wheels: detailedWheels,
            wheelRadius: radius,
            lights: dynamicLights,
            crewHead,
            crewHeadRestQ: crewHead ? crewHead.quaternion.clone() : undefined,
          },
        });
        return;
      }

      if (axis === "x") {
        holder.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        holder.position.set(start, 0, lane);
      } else {
        holder.rotation.y = dir > 0 ? 0 : Math.PI;
        holder.position.set(lane, 0, start);
      }
      dynamicRoot.add(holder);
      onAssetLoaded?.(holder);
      boulevardVehicles.push({
        group: holder,
        wheels: wheels.map((node, i) => ({ node, sign: spinSigns[i] })),
        wheelRadius: radius,
        crew,
        axis,
        lane,
        min,
        max,
        dir,
        speed,
        curSpeed: speed,
        length: targetLength,
      });
    };

    // Traffic strictly on TRUE VIETNAM RIGHT-HAND TRAFFIC edges across Đường 3/2, Điện Biên Phủ, Hải Triều, Ven Sông & Vinhomes!
    if (taxiGltf) {
      await addVehicle(taxiGltf.scene, 4.45, "x", -73.0, 8, 122, 28, 1, 7.2, "car", { edgeId: "D32_W_EB", s: 12, laneIndex: 0 });
      await addVehicle(taxiGltf.scene, 4.45, "x", -144.0, 8, 124, 42, 1, 7.6, "car", { edgeId: "DBP_W_EB", s: 18, laneIndex: 0 });
      await addVehicle(taxiGltf.scene, 4.45, "z", 53.0, -230, -72, -185, 1, 6.8, "car", { edgeId: "HT_N_SB", s: 25, laneIndex: 0 });
    }
    if (sedanGltf) {
      await addVehicle(sedanGltf.scene, 4.45, "x", -79.0, 8, 122, 92, -1, 6.8, "car", { edgeId: "D32_E_WB", s: 20, laneIndex: 0 });
      await addVehicle(sedanGltf.scene, 4.45, "z", -3.2, -304, -198, -240, -1, 8.0, "car", { edgeId: "LTT_N_NB", s: 64, laneIndex: 0 });
    }
    if (suvGltf) {
      await addVehicle(suvGltf.scene, 4.55, "x", -73.0, 8, 122, 76, 1, 6.9, "car", { edgeId: "D32_E_EB", s: 18, laneIndex: 1 });
      await addVehicle(suvGltf.scene, 4.55, "z", 59.0, -230, -72, -110, -1, 6.5, "car", { edgeId: "HT_S_NB", s: 22, laneIndex: 0 });
    }
    if (vanGltf) {
      fixVanWheels(vanGltf.scene);
      await addVehicle(vanGltf.scene, VAN_LENGTH, "x", -150.0, 8, 124, 88, -1, 6.7, "car", { edgeId: "DBP_E_WB", s: 24, laneIndex: 0 });
      await addVehicle(vanGltf.scene, VAN_LENGTH, "z", -9.6, -304, -198, -285, 1, 7.0, "car", { edgeId: "LTT_N_SB", s: 20, laneIndex: 0 });
    }
    if (truckGltf) {
      fixVanWheels(truckGltf.scene);
      await addVehicle(truckGltf.scene, VAN_LENGTH, "x", -144.0, 8, 124, 96, 1, 5.6, "truck", { edgeId: "DBP_E_EB", s: 20, laneIndex: 1 });
      await addVehicle(truckGltf.scene, VAN_LENGTH, "z", -9.6, -304, -198, -230, 1, 5.4, "truck", { edgeId: "LTT_N_SB", s: 72, laneIndex: 0 });
    }
    if (motoGltf) {
      await addVehicle(motoGltf.scene, 2.1, "x", -72.0, 8, 122, 52, 1, 6.6, "moto", { edgeId: "D32_W_EB", s: 26, laneIndex: 1 });
      await addVehicle(motoGltf.scene, 2.1, "x", -151.0, 8, 124, 82, -1, 7.0, "moto", { edgeId: "DBP_W_WB", s: 14, laneIndex: 1 });
      await addVehicle(motoGltf.scene, 2.1, "z", 59.8, -230, -72, -175, -1, 6.1, "moto", { edgeId: "HT_N_NB", s: 18, laneIndex: 1 });
      await addVehicle(motoGltf.scene, 2.1, "z", -2.4, -304, -198, -260, -1, 6.8, "moto", { edgeId: "LTT_N_NB", s: 105, laneIndex: 1 });
    }
    const riderLod =
      riderGltf?.scene.getObjectByName("BikeRider_LOD1") ?? riderGltf?.scene.getObjectByName("BikeRider_LOD0");
    const baothuLod =
      baothuGltf?.scene.getObjectByName("BikeRider_LOD1") ?? baothuGltf?.scene.getObjectByName("BikeRider_LOD0");
    if (riderLod) {
      await addVehicle(riderLod, 1.9, "x", -72.2, 8, 122, 102, 1, 6.8, "rider", { edgeId: "D32_E_EB", s: 32, laneIndex: 1 });
      await addVehicle(riderLod, 1.9, "x", -143.0, 8, 124, 25, 1, 7.1, "rider", { edgeId: "DBP_W_EB", s: 8, laneIndex: 1 });
    }
    if (baothuLod) {
      await addVehicle(baothuLod, 1.9, "x", -80.0, 8, 122, 48, -1, 7.4, "rider", { edgeId: "D32_W_WB", s: 16, laneIndex: 1 });
      await addVehicle(baothuLod, 1.9, "z", 52.2, -230, -72, -120, 1, 7.1, "rider", { edgeId: "HT_S_SB", s: 20, laneIndex: 1 });
    }
  };

  let longQ9Actor: { update(dt: number, time: number, playerX: number, playerZ: number, rangeSq: number): void } | null = null;
  let longQ9Spawned = false;
  const grabAnimators: { id: string; mixer: T.AnimationMixer; actions: Map<GrabClipName, T.AnimationAction>; current: GrabClipName | null; root: T.Object3D }[] = [];

  const LONG_Q9_AGENT_ID = "DIST_LONG_Q9";
  /**
   * The stranded riders of the rescue sites: ordinary street NPC models (the same files as the pedestrians of
   * loadExpandedNPCs) next to the same parked-bike models as the boarding house courtyard. Not Long Q9.
   */
  const LONG_Q9_STRANGERS = [
    { npc: "manvn.optimized.glb", height: 1.68, bike: "bike-supercub.optimized.glb" },
    { npc: "npc-alan.optimized.glb", height: 1.74, bike: "bike-pcx.optimized.glb" },
    { npc: "rowan.optimized.glb", height: 1.73, bike: "vehicles/motorbike.glb" },
  ] as const;
  /** Half extents (m) of the solid of a parked bike: along its length and across. */
  const BIKE_SOLID_HALF = { along: 0.95, across: 0.38 };
  const setBikeSolid = (solid: Solid, x: number, z: number, alongX: boolean) => {
    const hx = alongX ? BIKE_SOLID_HALF.along : BIKE_SOLID_HALF.across;
    const hz = alongX ? BIKE_SOLID_HALF.across : BIKE_SOLID_HALF.along;
    solid.x0 = x - hx;
    solid.x1 = x + hx;
    solid.z0 = z - hz;
    solid.z1 = z + hz;
  };
  const clearSolid = (solid: Solid) => {
    solid.x0 = solid.x1 = solid.z0 = solid.z1 = 1e6;
  };

  /**
   * Long Q9's roadside rescue. The pure routine is simulation/longQ9.ts; this function loads the models and applies each frame:
   * the Wave (a managed traffic agent while he cruises, moved by the routine while he pulls over, parks and rides off),
   * Long on the seat or on foot, and the stranded rider and bike of each site.
   */
  const loadLongQ9Repair = async () => {
    // Long Q9 is unique: one body, one spawn per world, never a pool or config entry.
    if (longQ9Spawned) return;
    longQ9Spawned = true;
    const base = `/assets/testbus/ow/models/`;
    const [qGltf, waveGltf] = await Promise.all([
      loader.loadAsync(`${base}${LONG_Q9_FILE}`).catch(() => null),
      loader.loadAsync(`${base}${WAVE_LONGQ9_FILE}`).catch(() => null),
    ]);
    if (disposed || !qGltf || !waveGltf) return;

    // ---- The yellow Wave: pivots are rotated, the *_Mesh children are left alone.
    const wave = cloneSkinned(waveGltf.scene);
    wave.traverse((n) => {
      if (n instanceof T.Mesh) {
        n.castShadow = false;
        n.receiveShadow = true;
        n.frustumCulled = false;
      }
    });
    const node = (name: string) => wave.getObjectByName(name) ?? null;
    const steering = node("Wave_Steering");
    const frontWheel = node("Wave_FrontWheel");
    const rearWheel = node("Wave_RearWheel");
    const kickstand = node("Wave_Kickstand");
    const steerRest = steering ? steering.quaternion.clone() : new T.Quaternion();
    const steerRestInv = steerRest.clone().invert();
    const frontRadius = (frontWheel?.userData.radius as number | undefined) ?? 0.284;
    const rearRadius = (rearWheel?.userData.radius as number | undefined) ?? 0.272;
    const forwardIn = (x: number, z: number, inSteering: boolean) => {
      const f = new T.Vector3(x, 0, z).normalize();
      return inSteering ? f.applyQuaternion(steerRestInv) : f;
    };
    // Lamps at the anchors of the GLB, like every other vehicle: lenses that follow the node they sit on (the head lamp and the
    // front signals turn with the handlebar), bound to the shared night level, brake light and blinker code.
    const headAnchor = node("Wave_HeadLamp");
    if (headAnchor) {
      mountRoundLamp(headAnchor, { role: "head", name: "WaveHeadlamp", position: new T.Vector3(), radius: 0.055, depth: 0.02, facing: forwardIn(0, 1, true) });
    }
    const tailAnchor = node("Wave_TailLamp");
    if (tailAnchor) {
      mountRoundLamp(tailAnchor, { role: "tail", name: "WaveTaillamp", position: new T.Vector3(), radius: 0.04, depth: 0.018, facing: forwardIn(0, -1, false) });
    }
    for (const [anchorName, side, front] of [
      ["Wave_SignalFL", 1, true],
      ["Wave_SignalFR", -1, true],
      ["Wave_SignalRL", 1, false],
      ["Wave_SignalRR", -1, false],
    ] as const) {
      const anchor = node(anchorName);
      if (!anchor) continue;
      mountRoundLamp(anchor, {
        role: side > 0 ? "signal_left" : "signal_right",
        name: anchorName,
        position: new T.Vector3(),
        radius: 0.024,
        depth: 0.012,
        facing: forwardIn(side * 0.4, front ? 1 : -1, front),
      });
    }

    const vehRoot = new T.Group();
    vehRoot.name = "LongQ9Wave";
    const holder = new T.Group();
    holder.add(wave);
    vehRoot.add(holder);
    const seat = new T.Group();
    seat.name = "LongQ9Seat";
    seat.position.set(LONG_Q9_SEAT_OFFSET.x, 0, LONG_Q9_SEAT_OFFSET.z);
    holder.add(seat);
    addHeadlightBeam(holder, wave, new T.Vector3(0, 0, 1), "moto");
    contact(holder, 0, 0.01, 0, 1.0, 2.15, shade);
    const dynamicLights = attachDynamicLamps(holder, 0.4, 0.95, true);
    dynamicRoot.add(vehRoot);
    onAssetLoaded?.(vehRoot);

    // ---- Long on foot or on the seat.
    const obj = cloneSkinned(qGltf.scene);
    obj.scale.setScalar(LONG_Q9_HEIGHT / LONG_Q9_RIG_HEIGHT);
    upgradeHumanMaterials(obj);
    obj.traverse((n) => {
      if (n instanceof T.Mesh) {
        n.castShadow = false;
        n.receiveShadow = true;
        n.frustumCulled = false; // the crouch and sit poses leave the bind-pose bounds
      }
    });
    const mixer = new T.AnimationMixer(obj);
    const actions = new Map<LongQ9Clip, T.AnimationAction>();
    for (const clip of qGltf.animations) actions.set(clip.name as LongQ9Clip, mixer.clipAction(clip));
    const person = new T.Group();
    person.name = "LongQ9";
    person.add(obj);
    seat.add(person);
    let onFoot = false;
    let currentClip: LongQ9Clip | null = null;

    // With traffic he starts on the road before the second site (D32_W_EB, no rescue window there beyond s 4) and drives into
    // it, so he is seen cruising before the first rescue. Without traffic the scripted fallback starts at the first site.
    const startSite = trafficMgr ? 1 : 0;
    const state: LongQ9State = createLongQ9State(LONG_Q9_SITES, startSite);
    if (trafficMgr) state.t = 0;
    const ride = actions.get("Ride");
    if (ride) {
      ride.play();
      currentClip = "Ride";
    }

    // ---- Traffic: a managed moto agent while cruising.
    let agent: VehicleAgent | null = null;
    if (trafficMgr) {
      agent = trafficMgr.spawnVehicle({
        id: LONG_Q9_AGENT_ID,
        category: "moto",
        edgeId: LONG_Q9_SITES[0].edgeId,
        s: 8,
        // Strongly prefer the straight turn at the next junction: it leads onto the edge of the second site.
        preferStraightBias: 1000,
        laneIndex: 1,
        latOffset: 1.5,
        speed: 6.5,
        halfWidth: 0.4,
        halfLength: 0.95,
        wheelBase: 1.2,
        // The wheels turn in the per-frame code below (they are pivots of the GLB), so the traffic rig spins none.
        rig: { root: vehRoot, chassis: holder, wheels: [], wheelRadius: rearRadius, lights: dynamicLights },
      });
    }
    const placeAgent = (v: VehicleAgent, siteIdx: number, s: number, lat: number, speed: number) => {
      const edge = trafficMgr?.graph.edges.get(LONG_Q9_SITES[siteIdx].edgeId);
      if (!edge) return;
      const p = sampleEdge(edge, s, lat);
      v.externalControl = false;
      v.edgeId = edge.id;
      v.onTurn = false;
      v.turnId = null;
      v.nextTurnId = null;
      v.s = s;
      v.latOffset = lat;
      v.targetLatOffset = lat;
      v.latVel = 0;
      v.x = p.x;
      v.z = p.z;
      v.yaw = p.yaw;
      v.yawRate = 0;
      v.speed = speed;
      v.accel = 0;
      v.blinker = 0;
    };

    // ---- Stranded riders, one per site (loaded after Long starts, so the scenario never waits for them).
    const strangers: ({ group: T.Group; mixer?: T.AnimationMixer; yaw: number } | null)[] = LONG_Q9_SITES.map(() => null);

    if (humanPresence) {
      presenceCleanups.push(
        humanPresence.register({
          id: "street_long_q9",
          label: { en: "Long Q9, bike mechanic", vi: "Chú Long Q9, thợ sửa xe" },
          object: person,
          radius: 0.36,
          canSidestep: false,
          // Bumping him changes nothing: he keeps working (the state machine ignores the player).
          onBump: () => {},
          onPersonalSpace: () => {},
        }),
      );
    }

    const _tmpQ = new T.Quaternion();
    const _yAxis = new T.Vector3(0, 1, 0);
    let frontSpin = 0;
    let rearSpin = 0;
    let lastExternal = false;
    let solidOn = false;

    longQ9Actor = {
      update(dt, time, playerX, playerZ, rangeSq) {
        // 1. The routine. During cruise it reads the traffic agent (null on a junction arc; undefined without traffic).
        let reading: LongQ9TrafficReading | null | undefined;
        if (agent) {
          reading =
            !agent.externalControl && !agent.onTurn
              ? { edgeId: agent.edgeId, s: agent.s, latOffset: agent.latOffset, x: agent.x, z: agent.z, yaw: agent.yaw, speed: agent.speed }
              : null;
        }
        // Before riding off he waits while a vehicle is closing in from behind on the merge spot.
        let rideOffClear = true;
        if (trafficMgr && state.phase === "kickstand_up") {
          const sIdx = LONG_Q9_SITES[state.site];
          const mergeS = sIdx.parkU + 6;
          for (const v of trafficMgr.vehicles) {
            if (v.id === LONG_Q9_AGENT_ID || v.edgeId !== sIdx.edgeId || v.onTurn) continue;
            const behind = mergeS - v.s;
            if (behind > -2 && behind < 8 + v.speed * 2.5 && v.speed > 0.5) {
              rideOffClear = false;
              break;
            }
          }
        }
        const frame: LongQ9Frame = stepLongQ9(state, dt, LONG_Q9_SITES, reading, rideOffClear);
        const site = LONG_Q9_SITES[frame.site];

        // 2. The traffic agent: owned by the routine while it is not cruising, given back on the road afterwards.
        if (agent) {
          if (frame.external) {
            agent.externalControl = true;
            agent.edgeId = LONG_Q9_SITES[state.site].edgeId;
            agent.onTurn = false;
            agent.s = state.u;
            agent.latOffset = state.v;
            agent.targetLatOffset = state.v;
            agent.x = frame.bike.x;
            agent.z = frame.bike.z;
            agent.yaw = frame.bike.yaw;
            agent.speed = frame.speed;
            agent.accel = 0;
            agent.steerAngle = frame.steer;
            agent.blinker = frame.blinker;
          } else if (frame.handback) {
            const h = frame.handback;
            placeAgent(agent, state.site === 0 ? LONG_Q9_SITES.length - 1 : state.site - 1, h.s, h.latOffset, h.speed);
          } else if (frame.relocate) {
            // A cruise that never met the next site: bring him to its approach, but only where nobody can see it.
            const { sLo } = longQ9TakeoverWindow(site);
            const target = longQ9SitePoint(site, sLo, 1.5);
            const far = (x: number, z: number) => (x - playerX) ** 2 + (z - playerZ) ** 2 > 110 * 110;
            if (far(agent.x, agent.z) && far(target.x, target.z)) {
              placeAgent(agent, frame.site, sLo, 1.5, 6.5);
              state.relocate = false;
              state.t = LONG_Q9_CRUISE_MIN_SECONDS;
            }
          }
        }
        if (frame.external || !agent) {
          // Rig pose, lamps and tilt are applied by the traffic step only for managed agents; without traffic the routine
          // places the bike in every phase, cruise included.
          vehRoot.position.set(frame.bike.x, frame.bike.y, frame.bike.z);
          vehRoot.rotation.y = frame.bike.yaw;
          holder.rotation.x = 0;
          holder.rotation.z = frame.lean;
          dynamicLights.setBrake(frame.brake ? 0.9 : 0);
          dynamicLights.setBlinker(frame.blinker, frame.blinker !== 0 && Math.floor(time * 3.2) % 2 === 0);
        } else if (lastExternal) {
          vehRoot.position.y = 0;
          holder.rotation.z = 0;
        }
        lastExternal = frame.external;
        const bikeDistSq = (frame.bike.x - playerX) ** 2 + (frame.bike.z - playerZ) ** 2;
        vehRoot.visible = frame.bikeVisible && bikeDistSq < 155 * 155;

        // 3. Wheels, handlebar and kickstand (pivots of the GLB).
        const speed = frame.external || !agent ? frame.speed : agent.speed;
        const steer = frame.external || !agent ? frame.steer : agent.steerAngle;
        frontSpin += (speed * dt) / frontRadius;
        rearSpin += (speed * dt) / rearRadius;
        if (frontWheel) frontWheel.rotation.x = frontSpin % (Math.PI * 2);
        if (rearWheel) rearWheel.rotation.x = rearSpin % (Math.PI * 2);
        if (steering) steering.quaternion.copy(steerRest).multiply(_tmpQ.setFromAxisAngle(_yAxis, steer));
        if (kickstand) {
          kickstand.rotation.x = T.MathUtils.degToRad(
            LONG_Q9_KICKSTAND_FOLDED_DEG + (LONG_Q9_KICKSTAND_DEPLOYED_DEG - LONG_Q9_KICKSTAND_FOLDED_DEG) * frame.kickstand,
          );
        }

        // 4. Solid of the parked Wave while he works (the player cannot walk through it), none while it rides.
        // It is not switched on while the player stands where the bike is (he would be inside the rect); once on it stays on.
        const parked = frame.phase !== "cruise" && frame.speed === 0 && frame.kickstand > 0 && frame.bike.y > 0;
        if (parked) {
          if (!solidOn) {
            const px = frame.bike.x - playerX;
            const pz = frame.bike.z - playerZ;
            if (px * px + pz * pz > 1.6 * 1.6) {
              setBikeSolid(longQ9BikeSolid, frame.bike.x, frame.bike.z, Math.abs(site.dir.x) > 0.5);
              solidOn = true;
            }
          }
        } else if (solidOn) {
          clearSolid(longQ9BikeSolid);
          solidOn = false;
        }

        // 5. Long: parented to the seat while riding, in the world while on foot.
        if (frame.standingOnFoot !== onFoot) {
          onFoot = frame.standingOnFoot;
          if (onFoot) {
            dynamicRoot.add(person);
          } else {
            seat.add(person);
            person.position.set(0, 0, 0);
            person.rotation.set(0, 0, 0);
          }
        }
        let inRange = vehRoot.visible && bikeDistSq < rangeSq;
        if (onFoot) {
          person.position.set(frame.person.x, frame.person.y, frame.person.z);
          person.rotation.y = frame.person.yaw;
          const dx = frame.person.x - playerX;
          const dz = frame.person.z - playerZ;
          inRange = dx * dx + dz * dz < rangeSq;
        }
        person.visible = onFoot ? inRange : vehRoot.visible;
        if (inRange) {
          if (frame.clip !== currentClip) {
            const next = actions.get(frame.clip);
            if (next) {
              const prev = currentClip ? actions.get(currentClip) : undefined;
              next.reset().play();
              if (prev) prev.crossFadeTo(next, 0.35, false);
              currentClip = frame.clip;
            }
          }
          mixer.update(dt);
        }

        // 6. The stranded riders face Long while he works on foot next to the bike, otherwise their own bike.
        for (let i = 0; i < strangers.length; i++) {
          const st = strangers[i];
          if (!st) continue;
          const sSite = LONG_Q9_SITES[i];
          const sp = longQ9SitePoint(sSite, sSite.npcU, LONG_Q9_NPC_V);
          const dx = sp.x - playerX;
          const dz = sp.z - playerZ;
          st.group.visible = dx * dx + dz * dz < rangeSq;
          if (!st.group.visible) continue;
          let target = st.yaw;
          if (frame.strangerFacesLong && frame.site === i) target = Math.atan2(frame.person.x - sp.x, frame.person.z - sp.z);
          let dy = target - st.group.rotation.y;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          st.group.rotation.y += dy * Math.min(1, dt * 4);
          st.mixer?.update(dt);
        }
      },
    };

    // Stranded riders and their bikes.
    for (let i = 0; i < LONG_Q9_SITES.length; i++) {
      if (disposed) return;
      const site = LONG_Q9_SITES[i];
      const cfg = LONG_Q9_STRANGERS[i % LONG_Q9_STRANGERS.length];
      const alongYaw = Math.atan2(site.dir.x, site.dir.z);
      const bikeGltf = await loader.loadAsync(`${base}${cfg.bike}`).catch(() => null);
      if (disposed) return;
      if (bikeGltf) {
        const bike = bikeGltf.scene.clone(true);
        const b0 = new T.Box3().setFromObject(bike, true);
        const sz0 = b0.getSize(new T.Vector3());
        if (sz0.x > sz0.z) bike.rotation.y += Math.PI / 2;
        bike.updateMatrixWorld(true);
        const b1 = new T.Box3().setFromObject(bike, true);
        bike.scale.setScalar(1.9 / Math.max(b1.max.z - b1.min.z, 0.5));
        bike.updateMatrixWorld(true);
        const b2 = new T.Box3().setFromObject(bike, true);
        const c2 = b2.getCenter(new T.Vector3());
        bike.position.set(-c2.x, -b2.min.y, -c2.z);
        bike.traverse((n) => {
          if (n instanceof T.Mesh) {
            n.castShadow = false;
            n.receiveShadow = true;
          }
        });
        const bikeHolder = new T.Group();
        bikeHolder.add(bike);
        const bp = longQ9SitePoint(site, site.strangerBikeU, LONG_Q9_PARK_V);
        bikeHolder.position.set(bp.x, CURB_HEIGHT, bp.z);
        bikeHolder.rotation.y = alongYaw;
        contact(bikeHolder, 0, 0.01, 0, 1.0, 2.15, shade);
        dynamicRoot.add(bikeHolder);
        onAssetLoaded?.(bikeHolder);
        setBikeSolid(strangerBikeSolids[i], bp.x, bp.z, Math.abs(site.dir.x) > 0.5);
      }
      const npcGltf = await loader.loadAsync(`${base}${cfg.npc}`).catch(() => null);
      if (!npcGltf || disposed) continue;
      // A failed clip build must not end the loop: the remaining sites still get their bike and rider.
      const clips = await streetClips(cfg.npc, npcGltf.scene, npcGltf.animations).catch(() => null);
      if (disposed) return;
      if (!clips) continue;
      const npc = cloneSkinned(npcGltf.scene);
      const nb = new T.Box3().setFromObject(npc, true);
      const ns = cfg.height / Math.max(0.1, nb.max.y - nb.min.y);
      npc.scale.setScalar(ns);
      npc.position.set(-((nb.max.x + nb.min.x) * ns) / 2, -nb.min.y * ns, -((nb.max.z + nb.min.z) * ns) / 2);
      upgradeHumanMaterials(npc);
      npc.traverse((n) => {
        if (n instanceof T.Mesh) {
          n.castShadow = false;
          n.receiveShadow = true;
        }
      });
      const group = new T.Group();
      group.add(npc);
      const np = longQ9SitePoint(site, site.npcU, LONG_Q9_NPC_V);
      group.position.set(np.x, CURB_HEIGHT, np.z);
      // He first looks at his own bike: toward the road side of the curb (the -right direction).
      const yaw = Math.atan2(site.dir.z, -site.dir.x);
      group.rotation.y = yaw;
      contact(group, 0, 0.01, 0, 0.65, 0.65, shade);
      dynamicRoot.add(group);
      onAssetLoaded?.(group);
      let npcMixer: T.AnimationMixer | undefined;
      if (clips.idle) {
        npcMixer = new T.AnimationMixer(npc);
        const action = npcMixer.clipAction(clips.idle);
        action.timeScale = 0.85;
        action.time = Math.random() * clips.idle.duration;
        action.play();
      }
      strangers[i] = { group, mixer: npcMixer, yaw };
      if (humanPresence) {
        presenceCleanups.push(
          humanPresence.register({
            id: `street_long_q9_customer_${i}`,
            label: { en: "Stranded rider", vi: "Người đi xe bị hỏng" },
            object: group,
            radius: 0.34,
            canSidestep: false,
            onBump: () => {},
            onPersonalSpace: () => {},
          }),
        );
      }
    }
  };

  const loadGrabDrivers = async () => {
    if (!trafficMgr) return;
    const gltf = await loader.loadAsync(`/assets/testbus/ow/models/${GRAB_DRIVER_FILE}`).catch(() => null);
    if (disposed || !gltf) return;
    const spawns: { edgeId: string; s: number; laneIndex: 0 | 1 }[] = [
      { edgeId: "D32_W_EB", s: 60, laneIndex: 1 },
      { edgeId: "HT_N_NB", s: 40, laneIndex: 1 },
      { edgeId: "DBP_E_WB", s: 50, laneIndex: 1 },
    ];
    let idx = 0;
    for (const sp of spawns) {
      if (disposed) return;
      const id = `DIST_GRAB_${idx++}`;
      const obj = cloneSkinned(gltf.scene);
      const b = new T.Box3().setFromObject(obj, true);
      const ctr = b.getCenter(new T.Vector3());
      // Real-world scale (scale 1); the scooter faces +Z like every other vehicle rig.
      obj.position.set(-ctr.x, -b.min.y, -ctr.z);
      obj.traverse((n) => {
        if (n instanceof T.Mesh) {
          n.castShadow = false;
          n.receiveShadow = true;
          n.frustumCulled = false;
        }
      });
      const vehRoot = new T.Group();
      const holder = new T.Group();
      holder.add(obj);
      vehRoot.add(holder);
      const lamps = markLampParts(holder, obj, new T.Vector3(0, 0, 1));
      // The model has no lamp mesh: mount round lenses on its bones so the head lamp turns with the handlebar.
      const grabLamps = mountGrabLamps(obj);
      if (lamps.head || grabLamps.head) addHeadlightBeam(holder, obj, new T.Vector3(0, 0, 1), "moto");
      contact(holder, 0, 0.01, 0, 1.0, 2.15, shade);
      const dynamicLights = attachDynamicLamps(holder, 0.44, 1.04, true);
      dynamicRoot.add(vehRoot);
      onAssetLoaded?.(vehRoot);

      const mixer = new T.AnimationMixer(obj);
      const actions = new Map<GrabClipName, T.AnimationAction>();
      for (const clip of gltf.animations) actions.set(clip.name as GrabClipName, mixer.clipAction(clip));
      grabAnimators.push({ id, mixer, actions, current: null, root: vehRoot });

      trafficMgr.spawnVehicle({
        id,
        category: "moto",
        edgeId: sp.edgeId,
        s: sp.s,
        laneIndex: sp.laneIndex,
        halfWidth: 0.44,
        halfLength: 1.04,
        // The clips turn the wheels, so the traffic rig spins none of its own.
        rig: { root: vehRoot, chassis: holder, wheels: [], wheelRadius: 0.275, lights: dynamicLights },
      });
    }
  };

  const loadExpandedNPCs = async () => {
    const npcConfigs: {
      file: string;
      pos: [number, number, number];
      axis: "x" | "z" | "idle";
      min: number;
      max: number;
      speed: number;
      height: number;
      idleYaw?: number;
    }[] = [
      // Dãy Trọ 462/14 & Hẻm residents
      { file: "manvn.optimized.glb", pos: [17.4, CURB_HEIGHT, -9.8], axis: "x", min: 15.2, max: 22.0, speed: 0.72, height: 1.68 },
      { file: "npc-sofia.optimized.glb", pos: [11.2, CURB_HEIGHT, -11.4], axis: "x", min: 6.2, max: 13.0, speed: 0.68, height: 1.64 },
      // Đường 3/2 Commercial Boulevard pedestrians + stationary sidewalk café pair!
      { file: "npc-alan.optimized.glb", pos: [26.0, CURB_HEIGHT, -67.6], axis: "x", min: 14.0, max: 33.0, speed: 0.88, height: 1.74 },
      { file: "npc-linmei.optimized.glb", pos: [34.0, CURB_HEIGHT, -84.0], axis: "x", min: 14.0, max: 45.0, speed: 0.82, height: 1.62 },
      { file: "npc-sofia.optimized.glb", pos: [25.6, CURB_HEIGHT, -66.5], axis: "idle", min: 0, max: 0, speed: 0, height: 1.63, idleYaw: 1.2 },
      { file: "rowan.optimized.glb", pos: [27.3, CURB_HEIGHT, -66.5], axis: "idle", min: 0, max: 0, speed: 0, height: 1.73, idleYaw: -1.4 },
      // Bitexco Financial Tower Plaza walkers & conversing business pair!
      { file: "juno3.optimized.glb", pos: [BITEXCO_POS.x - 19, CURB_HEIGHT, BITEXCO_POS.z - 8], axis: "z", min: BITEXCO_POS.z - 18, max: BITEXCO_POS.z + 10, speed: 0.95, height: 1.65 },
      { file: "rowan.optimized.glb", pos: [BITEXCO_POS.x - 14, CURB_HEIGHT, BITEXCO_POS.z + 12], axis: "x", min: BITEXCO_POS.x - 22, max: BITEXCO_POS.x + 12, speed: 0.85, height: 1.72 },
      { file: "npc-alice.optimized.glb", pos: [BITEXCO_POS.x - 22, CURB_HEIGHT, BITEXCO_POS.z + 4], axis: "z", min: BITEXCO_POS.z - 16, max: BITEXCO_POS.z + 18, speed: 0.8, height: 1.66 },
      { file: "npc-arthur.optimized.glb", pos: [BITEXCO_POS.x - 12, CURB_HEIGHT, BITEXCO_POS.z - 18], axis: "x", min: BITEXCO_POS.x - 22, max: BITEXCO_POS.x + 16, speed: 0.9, height: 1.76 },
      { file: "npc-alan.optimized.glb", pos: [BITEXCO_POS.x - 18.2, CURB_HEIGHT, BITEXCO_POS.z + 8.5], axis: "idle", min: 0, max: 0, speed: 0, height: 1.74, idleYaw: 0.8 },
      { file: "npc-linmei.optimized.glb", pos: [BITEXCO_POS.x - 17.0, CURB_HEIGHT, BITEXCO_POS.z + 9.4], axis: "idle", min: 0, max: 0, speed: 0, height: 1.63, idleYaw: -2.3 },
      // Landmark 81 & Vinhomes Central Park walkers
      { file: "manvn.optimized.glb", pos: [LANDMARK81_POS.x - 10, CURB_HEIGHT, -327], axis: "x", min: LANDMARK81_POS.x - 24, max: LANDMARK81_POS.x + 22, speed: 0.82, height: 1.7 },
      { file: "npc-freya.optimized.glb", pos: [LANDMARK81_POS.x + 12, CURB_HEIGHT, -314.2], axis: "x", min: -6, max: 56, speed: 0.76, height: 1.65 },
    ];

    let actorSeed = 21;
    for (const cfg of npcConfigs) {
      if (disposed) return;
      const gltf = await loader.loadAsync(`/assets/testbus/ow/models/${cfg.file}`).catch(() => null);
      if (!gltf || disposed) continue;
      const clips = await streetClips(cfg.file, gltf.scene, gltf.animations);
      if (disposed) return;
      const obj = cloneSkinned(gltf.scene);
      const b = new T.Box3().setFromObject(obj, true);
      const s = cfg.height / Math.max(0.1, b.max.y - b.min.y);
      obj.scale.setScalar(s);
      obj.position.set(-((b.max.x + b.min.x) * s) / 2, -b.min.y * s, -((b.max.z + b.min.z) * s) / 2);
      upgradeHumanMaterials(obj);
      obj.traverse((n) => {
        if (n instanceof T.Mesh) {
          n.castShadow = false;
          n.receiveShadow = true;
        }
      });
      const holder = new T.Group();
      holder.add(obj);
      holder.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      contact(holder, 0, 0.01, 0, 0.65, 0.65, shade);
      dynamicRoot.add(holder);
      onAssetLoaded?.(holder);

      let mixer: T.AnimationMixer | undefined;
      let walkAction: T.AnimationAction | undefined;
      const walkClipSpeed = clips.walkSpeedAt(cfg.height);
      const clip = cfg.axis === "idle" ? clips.idle : clips.walk;
      if (clip) {
        mixer = new T.AnimationMixer(obj);
        const action = mixer.clipAction(clip);
        walkAction = action;
        // Feet stay planted: the clip plays at the speed the NPC actually walks.
        action.timeScale = cfg.axis === "idle" ? 0.85 : cfg.speed / walkClipSpeed;
        action.time = Math.random() * clip.duration;
        action.play();
        animMixers.push(mixer);
      }

      const initYaw =
        cfg.axis === "idle" ? (cfg.idleYaw ?? 0) : cfg.axis === "x" ? Math.PI / 2 : 0;
      holder.rotation.y = initYaw;
      const seed = actorSeed++;
      const activity: HumanActivity =
        cfg.axis === "idle"
          ? seed % 2 === 0
            ? "talking"
            : "listening"
          : "walking";
      const realism = createHumanRealismRig(holder, obj, seed);
      if (humanPresence) {
        presenceCleanups.push(
          humanPresence.register({
            id: `district_ped_${seed}`,
            label:
              cfg.axis === "idle"
                ? { en: "Saigon Local", vi: "Người dân Sài Gòn" }
                : { en: "Pedestrian", vi: "Người đi bộ" },
            object: holder,
            radius: 0.34,
            canSidestep: true,
            onBump: (dx, dz, strength) => {
              realism.triggerBump(dx, dz, strength);
              if (cfg.axis !== "idle") {
                holder.position.x += dx * 0.14;
                holder.position.z += dz * 0.14;
              }
            },
            onPersonalSpace: (closeness) => realism.setPersonalSpace(closeness),
          }),
        );
      }
      roamingActors.push({
        group: holder,
        mixer,
        walkAction,
        walkClipSpeed,
        realism,
        activity,
        axis: cfg.axis,
        min: cfg.min,
        max: cfg.max,
        dir: 1,
        speed: cfg.speed,
        targetYaw: initYaw,
      });
    }
    // Pair nearby stationary conversing NPCs so they maintain natural eye contact unless Alex approaches.
    for (let i = 0; i < roamingActors.length; i++) {
      const a = roamingActors[i];
      if (a.axis !== "idle") continue;
      for (let j = 0; j < roamingActors.length; j++) {
        if (i === j || roamingActors[j].axis !== "idle") continue;
        if (a.group.position.distanceTo(roamingActors[j].group.position) < 3.2) {
          a.partnerPos = roamingActors[j].group.position.clone().add(new T.Vector3(0, 1.56, 0));
          break;
        }
      }
    }
  };

  // Phase 3 & 4: Thủ Thiêm Skyline, Cable-Stayed Ba Son Bridge, Illuminated Saigon River Boats & Living Sky!
  const riversideWorld = buildSaigonRiversideWorld(chunkHorizon, dynamicRoot, towerMats);

  // Phase 3: 1-Draw-Call Wet-Road Tire Spray Mist System for ALL moving Saigon traffic!
  const tireSpray = createWetTireSpraySystem(dynamicRoot, 32);

  // Batch static district meshes across all 6 chunks down to minimal GPU draw calls!
  for (const ch of [chunkNorthView, chunkEastBlvd, chunkEastBlvdLod, chunkBitexco, chunkLandmark, chunkHorizon]) {
    mergeStaticMeshesByMaterial(ch);
    freezeStaticMatrices(ch);
  }

  // Commit ALL instanced Saigon boulevard trees & royal palms in just 4 GPU draw calls total!
  botanicalBatch.commit(dynamicRoot, palmBark, windUniforms, !software);

  // 3D Instanced Wind-Swaying Multi-Blade Tropical Grass Field (strictly on Vinhomes Park soil lawn north of Z=-316.4!)
  const realisticGrass = buildRealisticGrassField(
    [
      {
        x0: LANDMARK81_POS.x - 76,
        x1: LANDMARK81_POS.x + 76,
        z0: -399,
        z1: -317.5,
        y: CURB_HEIGHT - 0.01,
        density: 115,
        scale: 1.0,
        excludeCircle: { x: LANDMARK81_POS.x, z: LANDMARK81_POS.z, r: 44.0 },
      },
    ],
    software,
  );
  dynamicRoot.add(realisticGrass.mesh);

  // Photorealistic lathe-turned ceramic planters at Bitexco Plaza & Landmark 81
  buildRealisticPottedPlants(
    dynamicRoot,
    [
      { pos: [BITEXCO_POS.x - 21.5, CURB_HEIGHT, BITEXCO_POS.z - 15], scale: 1.55, hasFlowers: true },
      { pos: [BITEXCO_POS.x - 21.5, CURB_HEIGHT, BITEXCO_POS.z - 7], scale: 1.45, hasFlowers: false },
      { pos: [BITEXCO_POS.x - 21.5, CURB_HEIGHT, BITEXCO_POS.z + 3], scale: 1.55, hasFlowers: true },
      { pos: [BITEXCO_POS.x - 8.5, CURB_HEIGHT, BITEXCO_POS.z + 23.0], scale: 1.5, hasFlowers: true },
      { pos: [LANDMARK81_POS.x - 11.5, CURB_HEIGHT, -321.5], scale: 1.65, hasFlowers: true },
      { pos: [LANDMARK81_POS.x - 20.5, CURB_HEIGHT, -321.5], scale: 1.6, hasFlowers: false },
      { pos: [LANDMARK81_POS.x + 11.5, CURB_HEIGHT, -321.5], scale: 1.55, hasFlowers: true },
    ],
    potWind,
  );

  void Promise.all([loadExpandedFleet(), loadExpandedNPCs(), loadLongQ9Repair(), loadGrabDrivers()]);

  let savedVis = { eb: true, ebLod: false, bx: true, lm: true };

  return {
    root,
    solids,
    lightSpecs: districtLights.map((d) => d.spec),
    setWindowPreviewMode(enabled: boolean) {
      if (enabled) {
        savedVis = {
          eb: chunkEastBlvd.visible,
          ebLod: chunkEastBlvdLod.visible,
          bx: chunkBitexco.visible,
          lm: chunkLandmark.visible,
        };
        dynamicRoot.visible = false;
        chunkEastBlvd.visible = false;
        chunkEastBlvdLod.visible = true;
        chunkBitexco.visible = false;
        chunkLandmark.visible = false;
      } else {
        dynamicRoot.visible = true;
        chunkEastBlvd.visible = savedVis.eb;
        chunkEastBlvdLod.visible = savedVis.ebLod;
        chunkBitexco.visible = savedVis.bx;
        chunkLandmark.visible = savedVis.lm;
      }
    },
    isWalkableSidewalk(x: number, z: number) {
      if (x >= 4.8 && x <= 31.8 && z >= -19.2 && z <= -6.6) return true;
      // Blvd 1 & Blvd 2 sidewalks (excluding X ∈ [50, 62] roadway!)
      const notOnHaiTrieu = x < 50.0 || x > 62.0;
      if (notOnHaiTrieu && x >= 6.8 && x <= 128 && ((z >= -86.4 && z <= -82.0) || (z >= -70.0 && z <= -65.6))) return true;
      if (notOnHaiTrieu && x >= 6.8 && x <= 132 && ((z >= -157.4 && z <= -153.0) || (z >= -141.0 && z <= -136.6))) return true;
      // Đường Hải Triều flanking sidewalks
      if ((x >= 46.0 && x <= 50.0 || x >= 62.0 && x <= 66.0) && ((z >= -136.6 && z <= -86.4) || (z >= -236.0 && z <= -157.4))) return true;
      // Bitexco Plaza
      if (x >= 66.0 && x <= 122.0 && z >= -212.6 && z <= -157.4) return true;
      // Northern Riverside sidewalks & Vinhomes Park Entrance sidewalks
      if (z <= -195 && z >= -312 && x <= -12.8 && x >= -18.0) return true;
      if (z <= -195 && z >= -300 && x >= 0 && x <= 5.2) return true;
      if (x >= 5.2 && x <= 96 && z >= -300 && z <= -295.6) return true;
      if (x >= -18 && x <= 96 && z >= -316.4 && z <= -312) return true;
      // Vinhomes Central Park & Landmark 81 Plaza
      if (x >= -54 && x <= 106 && z >= -400 && z <= -316.4) return true;
      return false;
    },
    isWithinOpenWorld(x: number, z: number) {
      if (x >= -19.5 && x <= 7.0 && z >= -316 && z <= 48) return true;
      if (x >= 4.5 && x <= 31.8 && z >= -19.2 && z <= -6.6) return true;
      if (x >= 0 && x <= 132 && (Math.abs(z + 76) <= 10.6 || Math.abs(z + 147) <= 10.6)) return true;
      if (x >= 46 && x <= 66 && z >= -236 && z <= -65.6) return true;
      if (x >= 66 && x <= 122 && z >= -213 && z <= -157) return true;
      if (x >= -18 && x <= 96 && z >= -316.4 && z <= -295.6) return true;
      if (x >= -54 && x <= 106 && z >= -400 && z <= -316.4) return true;
      return false;
    },
    setEnvironment(
      nightFactor: number,
      wetness: number,
      windStrength: number,
      rainIntensity = 0.35,
      sunDir?: T.Vector3,
      fogColor?: T.Color,
      fogDensity = 0.0024,
    ) {
      envWetness = wetness;
      envRain = rainIntensity;
      const lit = T.MathUtils.smoothstep(nightFactor, 0.12, 0.72);
      windUniforms.uWind.value = 0.3 + windStrength * 1.4;
      for (const e of dynamicEmissives) {
        e.mat.emissiveIntensity = T.MathUtils.lerp(e.base, e.night, lit);
      }
      if (sunDir && fogColor) {
        for (const ih of interiorTowerHandles) {
          ih.setAtmosphere(nightFactor, sunDir, fogColor, fogDensity, fogColor, rainIntensity);
        }
        for (const lb of ledBillboardMats) {
          lb.uniforms.uNight.value = nightFactor;
          lb.uniforms.uFogColor.value.copy(fogColor);
          lb.uniforms.uFogDensity.value = fogDensity;
        }
        waterMat.uniforms.uFogColor.value.copy(fogColor);
        waterMat.uniforms.uFogDensity.value = fogDensity;
        waterMat.uniforms.uSkyHorizon.value.copy(fogColor);
      }
      for (const dl of districtLights) {
        dl.spec.intensity = dl.max * lit;
      }
      for (const hm of haloMats) {
        hm.uniforms.uOpacity.value = lit * (0.14 + rainIntensity * 0.24);
      }
      for (const bm of vehicleBeamMats) {
        bm.opacity = lit * (0.14 + wetness * 0.18);
      }
      for (const hm of headlightMats) hm.emissiveIntensity = 0.3 + lit * 2.8;
      for (const tm of taillightMats) tm.emissiveIntensity = 0.35 + lit * 2.6;
      setVehicleLightLevel(lit, wetness);

      roadMat.roughness = T.MathUtils.lerp(0.84, 0.14, wetness);
      roadMat.metalness = T.MathUtils.lerp(0.06, 0.42, wetness);
      plazaMat.roughness = T.MathUtils.lerp(0.64, 0.16, wetness);
      plazaMat.metalness = T.MathUtils.lerp(0.08, 0.34, wetness);

      waterMat.uniforms.uNight.value = nightFactor;
      waterMat.uniforms.uRain.value = rainIntensity;
      if (sunDir) waterMat.uniforms.uSunDir.value.copy(sunDir);
      riversideWorld.setEnvironment(nightFactor, rainIntensity);
    },
    update(dt: number, time: number, playerX: number, playerZ: number) {
      windUniforms.uTime.value = time;
      waterMat.uniforms.uTime.value = time;
      for (const hm of haloMats) hm.uniforms.uTime.value = time;
      for (const lb of ledBillboardMats) lb.uniforms.uTime.value = time;
      realisticGrass.update(time, windUniforms.uWind.value);
      riversideWorld.update(dt, time);

      const pulse = Math.sin(time * 2.6) > 0.2 ? 1.0 : 0.08;
      for (const b of beacons) b.color.setRGB(4.5 * pulse, 0.2 * pulse, 0.1 * pulse);

      // Legacy fallback signal cycle ONLY when trafficMgr is absent
      const cyc = time % 25.0;
      const ewGreen = cyc < 10.0;
      const ewYellow = cyc >= 10.0 && cyc < 12.5;
      const nsGreen = cyc >= 12.5 && cyc < 22.5;
      if (!trafficMgr) {
        for (const ts of trafficSignalMats) {
          ts.r.emissiveIntensity = !ewGreen && !ewYellow ? 3.2 : 0.05;
          ts.y.emissiveIntensity = ewYellow ? 3.0 : 0.05;
          ts.g.emissiveIntensity = ewGreen ? 3.0 : 0.05;
        }
      }

      const npcRangeSq = 75 * 75;
      _npcPlayerPos.set(playerX, 1.68, playerZ);
      const rainPace = 1 + envRain * 0.2;
      for (const a of roamingActors) {
        const dx = a.group.position.x - playerX;
        const dz = a.group.position.z - playerZ;
        const dSq = dx * dx + dz * dz;
        const visible = dSq < npcRangeSq;
        a.group.visible = visible;

        let curSpeed = 0;
        if (a.axis !== "idle") {
          curSpeed = a.speed * rainPace;
          const cur = a.axis === "x" ? a.group.position.x : a.group.position.z;
          let next = cur + a.dir * curSpeed * dt;
          if (next > a.max) {
            next = a.max;
            a.dir = -1;
          } else if (next < a.min) {
            next = a.min;
            a.dir = 1;
          }
          if (a.axis === "x") {
            a.group.position.x = next;
            a.targetYaw = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            a.group.position.z = next;
            a.targetYaw = a.dir > 0 ? 0 : Math.PI;
          }
          // Smooth angular interpolation (no snappy 180° robot pivots!)
          let diff = a.targetYaw - a.group.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.group.rotation.y += diff * Math.min(1, dt * 6.5);
          if (a.walkAction) a.walkAction.timeScale = curSpeed / a.walkClipSpeed;
        }
        if (visible) {
          if (a.mixer) a.mixer.update(dt);
          // Conversing café/plaza pairs keep eye contact with each other unless Alex walks within 3.6m!
          const focusPoint = a.partnerPos && dSq > 3.6 * 3.6 ? a.partnerPos : null;
          a.realism.update({
            dt,
            time,
            playerPos: _npcPlayerPos,
            focusPoint,
            moveSpeed: curSpeed,
            activity: a.activity,
            rain: envRain,
            hasActiveMixer: Boolean(a.mixer),
          });
        }
      }

      longQ9Actor?.update(dt, time, playerX, playerZ, npcRangeSq);

      if (trafficMgr) {
        for (const ga of grabAnimators) {
          const agent = trafficMgr.vehicles.find((v) => v.id === ga.id);
          if (!agent || !ga.root.visible || agent.lodTier > 1) continue;
          const choice = pickGrabClip(agent.speed, agent.steerAngle);
          if (choice.clip !== ga.current) {
            const next = ga.actions.get(choice.clip);
            if (next) {
              next.reset().play();
              if (ga.current) ga.actions.get(ga.current)?.crossFadeTo(next, 0.35, false);
              else next.fadeIn(0.1);
              ga.current = choice.clip;
            }
          }
          const act = ga.current ? ga.actions.get(ga.current) : undefined;
          if (act) act.timeScale = choice.timeScale;
          ga.mixer.update(dt);
        }
        // Distance-cull managed boulevard vehicles & driver crews cleanly, then drive wet-road tire spray!
        const vehRangeSq = 155 * 155;
        const crewRangeSq = 72 * 72;
        for (const v of trafficMgr.vehicles) {
          if (!v.rig || v.externalControl) continue;
          const dx = v.x - playerX;
          const dz = v.z - playerZ;
          v.rig.root.visible = dx * dx + dz * dz < vehRangeSq;
        }
        for (const c of managedCrews) {
          const dx = c.vehRoot.position.x - playerX;
          const dz = c.vehRoot.position.z - playerZ;
          c.root.visible = dx * dx + dz * dz < crewRangeSq;
        }
        tireSpray.updateFromAgents(trafficMgr.vehicles, envWetness, envRain, time);
        return;
      }

      // Legacy Smart Intersection Traffic AI fallback (when trafficMgr is not passed)
      const vehRangeSq = 135 * 135;
      for (let i = 0; i < boulevardVehicles.length; i++) {
        const v = boulevardVehicles[i];
        const dx = v.group.position.x - playerX;
        const dz = v.group.position.z - playerZ;
        const d2 = dx * dx + dz * dz;
        v.group.visible = d2 < vehRangeSq;
        if (v.crew) v.crew.root.visible = d2 < 70 * 70;

        const pos = v.axis === "x" ? v.group.position.x : v.group.position.z;
        let gap = Infinity;

        // 1. Player safety yield
        const playerAxisDist = (v.axis === "x" ? playerX - v.group.position.x : playerZ - v.group.position.z) * v.dir;
        const playerLatDist = Math.abs(v.axis === "x" ? playerZ - v.group.position.z : playerX - v.group.position.x);
        if (playerLatDist < 1.9 && playerAxisDist > 0 && playerAxisDist < 8.0) {
          gap = Math.min(gap, playerAxisDist - v.length * 0.5 - 1.8);
        }

        // 2. Red-light stop bars at Hải Triều (X=56) & East Boulevards (Z=-76, Z=-147)
        if (v.axis === "x" && !ewGreen) {
          const stopPos = v.dir > 0 ? 45.4 : 66.6;
          const distToStop = (stopPos - pos) * v.dir;
          if (distToStop > -0.4 && distToStop < 18.0) {
            gap = Math.min(gap, distToStop - v.length * 0.5);
          }
        } else if (v.axis === "z" && Math.abs(v.lane - 56) < 6 && !nsGreen) {
          for (const jz of [-76, -147]) {
            const stopPos = v.dir > 0 ? jz - 10.6 : jz + 10.6;
            const distToStop = (stopPos - pos) * v.dir;
            if (distToStop > -0.4 && distToStop < 18.0) {
              gap = Math.min(gap, distToStop - v.length * 0.5);
            }
          }
        }

        // 3. Same-lane vehicle headway braking (cars queue neatly behind one another!)
        for (let j = 0; j < boulevardVehicles.length; j++) {
          if (i === j) continue;
          const o = boulevardVehicles[j];
          if (o.axis !== v.axis || o.dir !== v.dir || Math.abs(o.lane - v.lane) > 1.35) continue;
          const opos = o.axis === "x" ? o.group.position.x : o.group.position.z;
          const ahead = (opos - pos) * v.dir;
          if (ahead > 0 && ahead < 26) {
            gap = Math.min(gap, ahead - (v.length + o.length) * 0.5 - 2.0);
          }
        }

        const targetSpeed = gap <= 0.35 ? 0 : Math.min(v.speed, Math.sqrt(5.2 * Math.max(0, gap)));
        v.curSpeed += T.MathUtils.clamp(targetSpeed - v.curSpeed, -8.5 * dt, 3.6 * dt);
        const step = Math.max(0, v.curSpeed * dt);
        if (v.axis === "x") {
          v.group.position.x += v.dir * step;
          if (v.group.position.x > v.max) v.group.position.x = v.min;
          if (v.group.position.x < v.min) v.group.position.x = v.max;
        } else {
          v.group.position.z += v.dir * step;
          if (v.group.position.z > v.max) v.group.position.z = v.min;
          if (v.group.position.z < v.min) v.group.position.z = v.max;
        }
        if (v.group.visible && step > 0.001) {
          const turn = step / v.wheelRadius;
          for (const w of v.wheels) w.node.rotation.x += w.sign * turn;
        }
      }

      // Update GTA 6 Wet-Road Tire Spray Mist behind all moving vehicles!
      tireSpray.update(boulevardVehicles, envWetness, envRain, time);
    },
    dispose() {
      for (const cleanup of presenceCleanups) cleanup();
      presenceCleanups.length = 0;
      disposed = true;
      realisticGrass.dispose();
      tireSpray.dispose();
      riversideWorld.dispose();
      void rng;
    },
  };
}
