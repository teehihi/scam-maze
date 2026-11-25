import * as T from "three";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";
import { SaigonRoadGraph, type SaigonTrafficManager } from "../traffic";
import { createMastArmSignal, type LampSet } from "./mastArmSignal";
import { deriveSignalApproaches, signalBasePosition, type SignalApproach } from "./signalPlacement";
import { createSignalDebugOverlay, isSignalDebugEnabled } from "./signalDebug";
import type { WorldStreamer } from "./WorldStreamer";

export interface BuildIntersectionSignalsOptions {
  graph?: SaigonRoadGraph;
  trafficMgr?: SaigonTrafficManager;
  streamer: WorldStreamer;
  solids: Solid[];
  curbHeight?: number;
  parent: T.Object3D;
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

  for (const a of approaches) {
    let group = groups.get(a.intersectionId);
    if (!group) {
      group = new T.Group();
      group.name = `signals-${a.intersectionId}`;
      groups.set(a.intersectionId, group);
      parent.add(group);
    }
    const pos = signalBasePosition(a);
    const signal = createMastArmSignal({
      x: pos.x,
      y: curbHeight,
      z: pos.z,
      heading: a.heading,
      armLength: a.armLength,
      laneCentres: a.laneCentres,
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
    if (!trafficMgr) staticLamps.push(signal.lamps);
    group.add(signal.group);
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

  if (isSignalDebugEnabled()) parent.add(createSignalDebugOverlay(approaches, graph, graph.intersections.values()));

  return { groups, approaches, poles, staticLamps };
}
