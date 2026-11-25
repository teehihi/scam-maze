import * as T from "three";
import type {
  AxisSignalState,
  IntersectionSignalSnapshot,
  IntersectionSpec,
  LampColor,
  PedLampState,
  SignalAxis,
} from "./types";

const PED_FLASH_SEC = 4.0;

export interface CountdownHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: T.CanvasTexture;
  lastKey: string;
}

export interface SignalVisualBinding {
  intersectionId: string;
  axis: SignalAxis;
  redMat: T.MeshStandardMaterial;
  amberMat: T.MeshStandardMaterial;
  greenMat: T.MeshStandardMaterial;
  /** One handle, or several when a signal drives more than one canvas. */
  countdown?: CountdownHandle | CountdownHandle[];
}

const COUNTDOWN_GEOMETRY = new T.PlaneGeometry(0.32, 0.34);

function makeAxisState(
  lamp: LampColor,
  countdown: number,
  timeToRed: number,
  timeToGreen: number,
  pedLamp: PedLampState,
  pedCountdown: number,
): AxisSignalState {
  return { lamp, countdown, timeToRed, timeToGreen, pedLamp, pedCountdown };
}

/**
 * Unified QCVN 41:2024/BGTVT Vietnamese Traffic Signal Controller.
 *
 * Every signalized intersection follows a strict 4-stage safety cycle:
 *   Stage 0: NS Green (nsGreenSec)
 *   Stage 1: NS Amber (amberSec = 3.0s)
 *   Stage 2: All-Red clearance (allRedSec = 1.8s)
 *   Stage 3: EW Green / Ped Walk (ewGreenSec)
 *   Stage 4: EW Amber (amberSec = 3.0s; 0s if midblockPedOnly)
 *   Stage 5: All-Red clearance (allRedSec = 1.8s)
 */
export class TrafficSignalController {
  private readonly specs = new Map<string, IntersectionSpec>();
  private readonly snapshots = new Map<string, IntersectionSignalSnapshot>();
  private readonly bindings: SignalVisualBinding[] = [];
  private currentTime = 0;

  constructor(intersections: Iterable<IntersectionSpec>) {
    for (const inter of intersections) {
      this.specs.set(inter.id, inter);
    }
    this.update(0);
  }

  /** Register a 3D traffic light head (and optional 2-digit Vietnamese LED countdown panel). */
  bindVisual(binding: SignalVisualBinding) {
    this.bindings.push(binding);
    this.applyBinding(binding);
  }

  /**
   * Build ONE canvas, texture and material for a 2-digit Vietnamese LED countdown. `createPanelMesh`
   * makes any number of meshes that show the same texture, so one handle updates all of them.
   */
  static createSharedCountdown(): { createPanelMesh: () => T.Mesh; handle: CountdownHandle } {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
    return {
      createPanelMesh: () => new T.Mesh(COUNTDOWN_GEOMETRY, mat),
      handle: { canvas, ctx, texture, lastKey: "" },
    };
  }

  /** Build a 2-digit glowing Vietnamese LED countdown panel texture & mesh for a signal head. */
  static createCountdownPanel(): { mesh: T.Mesh; handle: CountdownHandle } {
    const shared = TrafficSignalController.createSharedCountdown();
    return { mesh: shared.createPanelMesh(), handle: shared.handle };
  }

  update(simTime: number) {
    this.currentTime = simTime;
    for (const [id, spec] of this.specs) {
      if (!spec.signalized) {
        const alwaysGreen = makeAxisState("green", 99, 99, 0, "dont_walk", 0);
        this.snapshots.set(id, {
          intersectionId: id,
          ns: alwaysGreen,
          ew: alwaysGreen,
          allRed: false,
        });
        continue;
      }

      const ewAmber = spec.midblockPedOnly ? 0 : spec.amberSec;
      const t0 = spec.nsGreenSec;
      const t1 = t0 + spec.amberSec;
      const t2 = t1 + spec.allRedSec;
      const t3 = t2 + spec.ewGreenSec;
      const t4 = t3 + ewAmber;
      const cycle = t4 + spec.allRedSec;

      const phase = (((simTime + spec.phaseOffset) % cycle) + cycle) % cycle;

      let ns: AxisSignalState;
      let ew: AxisSignalState;
      let allRed = false;

      if (phase < t0) {
        // Stage 0: NS Green, EW Red
        const nsRem = t0 - phase;
        const ewWait = t2 - phase;
        const pedState: PedLampState = nsRem <= PED_FLASH_SEC ? "flash" : "walk";
        ns = makeAxisState("green", nsRem, nsRem + spec.amberSec, 0, pedState, nsRem);
        ew = makeAxisState("red", ewWait, 0, ewWait, "dont_walk", ewWait);
      } else if (phase < t1) {
        // Stage 1: NS Amber, EW Red
        const ambRem = t1 - phase;
        const ewWait = t2 - phase;
        ns = makeAxisState("amber", ambRem, ambRem, cycle - phase, "dont_walk", cycle - phase);
        ew = makeAxisState("red", ewWait, 0, ewWait, "dont_walk", ewWait);
      } else if (phase < t2) {
        // Stage 2: All-Red clearance before EW Green
        allRed = true;
        const redRem = t2 - phase;
        ns = makeAxisState("red", cycle - phase, 0, cycle - phase, "dont_walk", cycle - phase);
        ew = makeAxisState("red", redRem, 0, redRem, "dont_walk", redRem);
      } else if (phase < t3) {
        // Stage 3: EW Green (or Midblock Pedestrian Walk), NS Red
        const ewRem = t3 - phase;
        const nsWait = cycle - phase;
        const pedState: PedLampState = ewRem <= PED_FLASH_SEC ? "flash" : "walk";
        ns = makeAxisState("red", nsWait, 0, nsWait, "dont_walk", nsWait);
        ew = makeAxisState("green", ewRem, ewRem + ewAmber, 0, pedState, ewRem);
      } else if (phase < t4) {
        // Stage 4: EW Amber, NS Red
        const ambRem = t4 - phase;
        const nsWait = cycle - phase;
        ns = makeAxisState("red", nsWait, 0, nsWait, "dont_walk", nsWait);
        ew = makeAxisState("amber", ambRem, ambRem, cycle - phase + t2, "dont_walk", cycle - phase + t2);
      } else {
        // Stage 5: All-Red clearance before NS Green
        allRed = true;
        const nsWait = cycle - phase;
        ns = makeAxisState("red", nsWait, 0, nsWait, "dont_walk", nsWait);
        ew = makeAxisState("red", nsWait + t2, 0, nsWait + t2, "dont_walk", nsWait + t2);
      }

      this.snapshots.set(id, { intersectionId: id, ns, ew, allRed });
    }

    for (const b of this.bindings) {
      this.applyBinding(b);
    }
  }

  getSnapshot(intersectionId: string): IntersectionSignalSnapshot | undefined {
    return this.snapshots.get(intersectionId);
  }

  getAxisState(intersectionId: string, axis: SignalAxis): AxisSignalState {
    const snap = this.snapshots.get(intersectionId);
    if (!snap) return makeAxisState("green", 99, 99, 0, "walk", 99);
    return axis === "ns" ? snap.ns : snap.ew;
  }

  private applyBinding(b: SignalVisualBinding) {
    const st = this.getAxisState(b.intersectionId, b.axis);
    const isRed = st.lamp === "red";
    const isAmb = st.lamp === "amber";
    const isGrn = st.lamp === "green";

    b.redMat.emissiveIntensity = isRed ? 3.8 : 0.03;
    b.amberMat.emissiveIntensity = isAmb ? 3.5 : 0.03;
    b.greenMat.emissiveIntensity = isGrn ? 3.6 : 0.03;

    if (b.countdown) {
      const secs = Math.max(0, Math.min(99, Math.ceil(st.countdown)));
      const col = isGrn ? "#2eff78" : isAmb ? "#ffbb24" : "#ff3628";
      const key = `${col}:${secs}`;
      const handles = Array.isArray(b.countdown) ? b.countdown : [b.countdown];
      for (const h of handles) this.drawCountdown(h, key, col, secs);
    }
  }

  private drawCountdown(h: CountdownHandle, key: string, col: string, secs: number) {
    if (key === h.lastKey) return;
    h.lastKey = key;
    const { ctx, canvas, texture } = h;
    ctx.fillStyle = "#08090c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#22262e";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = col;
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(secs).padStart(2, "0"), canvas.width / 2, canvas.height / 2 + 2);
    texture.needsUpdate = true;
  }

  /** Helper for telemetry/debugging */
  getSimTime(): number {
    return this.currentTime;
  }
}
