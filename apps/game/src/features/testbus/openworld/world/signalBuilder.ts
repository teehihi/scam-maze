import * as T from "three";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";
import { SaigonRoadGraph, type SaigonTrafficManager } from "../traffic";
import { lamp } from "../simulation/scene-kit";
import { TrafficSignalController } from "../traffic/signalController";
import { createMastArmSignal, type LampSet, type SharedCountdown } from "./mastArmSignal";
import { deriveSignalApproaches, signalBasePosition, signalYaw, type SignalApproach } from "./signalPlacement";
import { createGlbMastArmSignal, loadTrafficSignalTemplate } from "./trafficSignalModel";
import { createSignalDebugOverlay, isSignalDebugEnabled } from "./signalDebug";
import type { WorldStreamer } from "./WorldStreamer";

export interface BuildIntersectionSignalsOptions {
  graph?: SaigonRoadGraph;
  trafficMgr?: SaigonTrafficManager;
  streamer: WorldStreamer;
  solids: Solid[];
  curbHeight?: number;
  parent: T.Object3D;
  /** Called with each signal container once its model is in place (open world asset tracker). */
  onAssetLoaded?: (obj: T.Object3D) => void;
}

export interface IntersectionSignals {
  /** One group per signalized intersection, holding all of its signals. */
  groups: Map<string, T.Group>;
  approaches: SignalApproach[];
  /** Pole base positions, same order as `approaches`. */
  poles: { x: number; z: number }[];
  /** Lamp materials of every signal; only driven by the caller when no TrafficManager is bound. */
  staticLamps: LampSet[];
}

const SIGNAL_NEAR_DIST = 140;
const SIGNAL_LOD_DIST = 260;

interface PendingSignal {
  approach: SignalApproach;
  container: T.Group;
  lamps: LampSet;
  countdown: SharedCountdown;
}

/** Fills each container with the GLB model, or with the procedural mast arm when the model cannot be loaded. */
async function populateSignals(pending: PendingSignal[], onAssetLoaded?: (obj: T.Object3D) => void): Promise<void> {
  if (!pending.length) return;
  let template: Awaited<ReturnType<typeof loadTrafficSignalTemplate>> | null = null;
  try {
    template = await loadTrafficSignalTemplate();
  } catch (error) {
    console.warn("[openworld] traffic signal model failed to load, using the procedural signals", error);
  }
  for (const { approach: a, container, lamps, countdown } of pending) {
    const common = { lamps, countdown, armLength: a.armLength, laneCentres: a.laneCentres };
    let signal;
    try {
      signal = template ? createGlbMastArmSignal(template, common) : createMastArmSignal(common);
    } catch (error) {
      console.warn("[openworld] traffic signal model is unusable, using the procedural signal", error);
      signal = createMastArmSignal(common);
    }
    container.add(signal.group);
    onAssetLoaded?.(container);
  }
}

/**
 * The only place mast-arm signals are built. Every approach edge of every signalized intersection
 * in the road graph gets one signal, placed from RoadEdge.end, and each intersection streams in and
 * out as a single chunk so it is never half lit.
 */
export function buildIntersectionSignals(opts: BuildIntersectionSignalsOptions): IntersectionSignals {
  const { trafficMgr, streamer, solids, parent } = opts;
  const graph = opts.graph ?? trafficMgr?.graph ?? new SaigonRoadGraph();
  const curbHeight = opts.curbHeight ?? CURB_HEIGHT;
  const approaches = deriveSignalApproaches(graph);
  const groups = new Map<string, T.Group>();
  const poles: { x: number; z: number }[] = [];
  const staticLamps: LampSet[] = [];
  const pending: PendingSignal[] = [];

  for (const a of approaches) {
    let group = groups.get(a.intersectionId);
    if (!group) {
      group = new T.Group();
      group.name = `signals-${a.intersectionId}`;
      groups.set(a.intersectionId, group);
      parent.add(group);
    }
    const pos = signalBasePosition(a);
    // Lamps and countdown belong to the signal, not to its model, so they are bound right away and the
    // GLB (or the procedural fallback) only has to wear them when it arrives.
    const lamps: LampSet = { r: lamp(0xff3426, 0.03), y: lamp(0xffb524, 0.03), g: lamp(0x28e672, 0.03) };
    const countdown = TrafficSignalController.createSharedCountdown();
    if (trafficMgr) {
      trafficMgr.bindSignalVisual({
        intersectionId: a.intersectionId,
        axis: a.axis,
        redMat: lamps.r,
        amberMat: lamps.y,
        greenMat: lamps.g,
        countdown: countdown.handle,
      });
    } else {
      staticLamps.push(lamps);
    }
    const container = new T.Group();
    container.name = `signal-${a.edgeId}`;
    container.position.set(pos.x, curbHeight, pos.z);
    container.rotation.y = signalYaw(a.heading);
    group.add(container);
    pending.push({ approach: a, container, lamps, countdown });
    poles.push(pos);
    solids.push(rect(pos.x, pos.z, 0.28, 0.28));
  }

  for (const [intersectionId, group] of groups) {
    const center = graph.intersections.get(intersectionId)!.center;
    streamer.register({
      id: `signals-${intersectionId}`,
      name: `Traffic signals ${intersectionId}`,
      district: "Traffic signals",
      cx: center.x,
      cz: center.z,
      near: group,
      nearDist: SIGNAL_NEAR_DIST,
      lodDist: SIGNAL_LOD_DIST,
    });
  }

  void populateSignals(pending, opts.onAssetLoaded);

  if (isSignalDebugEnabled()) parent.add(createSignalDebugOverlay(approaches, graph, graph.intersections.values()));

  return { groups, approaches, poles, staticLamps };
}
