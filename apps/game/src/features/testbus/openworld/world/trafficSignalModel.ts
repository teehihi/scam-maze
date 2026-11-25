import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { TRAFFIC_SIGNAL_GLB } from "../../../../config/assetPaths";
import type { LampSet, MastArmSignal, SharedCountdown } from "./mastArmSignal";

/**
 * Node names of traffic-signal.optimized.glb (scripts/optimize-traffic-signal.cjs). The model is in the signal
 * local frame: pole axis on x = z = 0, base on y = 0, arm along +X, lenses facing -Z.
 */
export const SIGNAL_NODES = {
  pole: "pole",
  arm: "arm",
  headLow: "head_low",
  headA: "head_a",
  headB: "head_b",
} as const;
export const HEAD_PARTS = { body: "body", red: "red", amber: "amber", green: "green", countdown: "countdown" } as const;

export interface TrafficSignalTemplate {
  root: T.Object3D;
}

export interface GlbMastArmSignalOptions {
  lamps: LampSet;
  countdown?: SharedCountdown;
  /** Distance of the arm tip from the pole axis (m). */
  armLength: number;
  /** Distance of each lane centre from the pole along the arm; one overhead head hangs over each. */
  laneCentres: number[];
}

/**
 * The lens discs of the model are cut flush into the housing front (head_a, head_b: the body face is at the
 * same depth as the lens), so the body hides or z-fights them. Every lens is moved this far toward -Z
 * (the lens-facing side) so it always stands proud of the housing face.
 */
export const LENS_PUSH = 0.05;

const PANEL_SIZE = { w: 0.32, h: 0.34 };
/** Share of the countdown face the digit panel fills. */
const PANEL_FILL = 0.92;

let templatePromise: Promise<TrafficSignalTemplate> | null = null;

/** Loads the signal model once. A failed load is not cached, so a later call retries. */
export function loadTrafficSignalTemplate(): Promise<TrafficSignalTemplate> {
  if (!templatePromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    templatePromise = loader.loadAsync(TRAFFIC_SIGNAL_GLB).then((gltf) => prepareTemplate(gltf.scene));
    templatePromise.catch(() => {
      templatePromise = null;
    });
  }
  return templatePromise;
}

/** Test hook: forget the memoized template. */
export function resetTrafficSignalTemplate(): void {
  templatePromise = null;
}

/** Marks shadow casters (pole, arm, bodies) once on the template so every clone inherits the flags. */
export function prepareTemplate(root: T.Object3D): TrafficSignalTemplate {
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const casts = o.name === SIGNAL_NODES.pole || o.name === SIGNAL_NODES.arm || o.name.endsWith("_body");
    mesh.castShadow = casts;
    mesh.receiveShadow = false;
  });
  return { root };
}

function node(template: TrafficSignalTemplate, name: string): T.Object3D {
  const found = template.root.getObjectByName(name);
  if (!found) throw new Error(`traffic signal model is missing node "${name}"`);
  return found;
}

/** Native arm length (extras.length, written by the optimizer) or the arm's own bounds. */
function nativeArmLength(arm: T.Object3D): number {
  const fromExtras = arm.userData?.length;
  if (typeof fromExtras === "number" && fromExtras > 0) return fromExtras;
  arm.updateWorldMatrix(true, true);
  const box = new T.Box3().setFromObject(arm);
  return Math.max(0.01, box.max.x);
}

function assignLamps(head: T.Object3D, name: string, lamps: LampSet): void {
  const set = (part: string, mat: T.MeshStandardMaterial) => {
    const lens = head.getObjectByName(`${name}_${part}`) as T.Mesh | undefined;
    if (!lens) return;
    lens.material = mat;
    lens.position.z -= LENS_PUSH;
  };
  set(HEAD_PARTS.red, lamps.r);
  set(HEAD_PARTS.amber, lamps.y);
  set(HEAD_PARTS.green, lamps.g);
}

/**
 * Builds one signal from the loaded model, at the origin and unrotated (the caller's container sets position
 * and yaw). Geometry and the body material are shared with the template and with every other signal; only
 * the three lens materials (the LampSet) and the countdown panels belong to this signal.
 */
export function createGlbMastArmSignal(template: TrafficSignalTemplate, opts: GlbMastArmSignalOptions): MastArmSignal {
  const { lamps, countdown } = opts;
  const group = new T.Group();
  group.name = "MastArmSignalGlb";

  const pole = node(template, SIGNAL_NODES.pole).clone(true);
  group.add(pole);

  // The native arm is a straight pipe starting on the pole axis: stretch it along X to the graph's arm length.
  const armSource = node(template, SIGNAL_NODES.arm);
  const arm = new T.Group();
  arm.name = SIGNAL_NODES.arm;
  arm.add(armSource.clone(true));
  arm.scale.x = Math.max(0.1, opts.armLength) / nativeArmLength(armSource);
  group.add(arm);

  const heads: T.Object3D[] = [];
  const countdownPanels: T.Mesh[] = [];

  const lower = node(template, SIGNAL_NODES.headLow).clone(true);
  assignLamps(lower, SIGNAL_NODES.headLow, lamps);
  group.add(lower);
  heads.push(lower);

  const addOverhead = (sourceName: string, x: number) => {
    const head = node(template, sourceName).clone(true);
    head.position.x = x;
    assignLamps(head, sourceName, lamps);
    group.add(head);
    heads.push(head);
    const box = head.getObjectByName(`${sourceName}_${HEAD_PARTS.countdown}`);
    const face = box?.userData as { faceCenter?: number[]; faceSize?: number[] } | undefined;
    if (countdown && face?.faceCenter && face.faceSize) {
      const panel = countdown.createPanelMesh();
      const fit = Math.min(face.faceSize[0] / PANEL_SIZE.w, face.faceSize[1] / PANEL_SIZE.h) * PANEL_FILL;
      panel.scale.set(fit, fit, 1);
      // Just in front of the box face (toward -Z); the plane faces +Z by default.
      panel.position.set(face.faceCenter[0], face.faceCenter[1], face.faceCenter[2] - 0.01);
      panel.rotation.y = Math.PI;
      head.add(panel);
      countdownPanels.push(panel);
    }
  };

  // Nearest lane keeps the pole-side head, every farther lane gets a copy of the arm-tip head.
  const centres = (opts.laneCentres.length ? [...opts.laneCentres] : [opts.armLength - 0.9]).sort((a, b) => a - b);
  centres.forEach((x, i) => addOverhead(i === 0 ? SIGNAL_NODES.headA : SIGNAL_NODES.headB, x));

  return { group, pole, arm, lamps, heads, countdownPanels };
}
