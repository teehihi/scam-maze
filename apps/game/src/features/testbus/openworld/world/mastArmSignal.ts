import * as T from "three";
import { box, lamp, material, orb, rod } from "../simulation/scene-kit";
import { TrafficSignalController, type SignalVisualBinding } from "../traffic/signalController";
import { signalYaw, type Heading } from "./signalPlacement";

export interface LampSet {
  r: T.MeshStandardMaterial;
  y: T.MeshStandardMaterial;
  g: T.MeshStandardMaterial;
}

export interface MastArmSignalOptions {
  /** World position of the pole base (y is the sidewalk height). */
  x: number;
  y: number;
  z: number;
  /** Direction of travel of the approaching traffic this signal controls. */
  heading: Heading;
  /** Reuse lamp materials (legacy shared cycle). Fresh materials are created when omitted. */
  lamps?: LampSet;
  /** Create countdown displays and report each one for binding. Omit for no countdowns. */
  onCountdown?: (countdown: NonNullable<SignalVisualBinding["countdown"]>, lamps: LampSet) => void;
  armLength?: number;
}

export interface MastArmSignal {
  group: T.Group;
  pole: T.Object3D;
  arm: T.Object3D;
  lamps: LampSet;
  /** Overhead heads on the arm plus the lower pole head. */
  heads: T.Object3D[];
  countdownPanels: T.Mesh[];
}

const steel = material(0x5b646a, 0.4, 0.7);
const housing = material(0x1f2326, 0.5, 0.55);
const visorMat = material(0x15181a, 0.6, 0.4);

/**
 * Vietnamese mast-arm (gia den) signal. Built in local space with the pole at the origin, the arm
 * along +X and every head facing -Z, then yawed so the arm reaches over the road and the heads face
 * the approaching driver. The pole stands on the driver's right-hand side.
 */
export function createMastArmSignal(opts: MastArmSignalOptions): MastArmSignal {
  const armLen = opts.armLength ?? 5.2;
  const lamps = opts.lamps ?? { r: lamp(0xff3426, 0.03), y: lamp(0xffb524, 0.03), g: lamp(0x28e672, 0.03) };
  const group = new T.Group();
  group.position.set(opts.x, opts.y, opts.z);
  group.rotation.y = signalYaw(opts.heading);

  const pole = new T.Group();
  box(pole, [0, 0.04, 0], [0.4, 0.08, 0.4], steel, false);
  rod(pole, [0, 0.08, 0], [0, 6.6, 0], 0.12, steel, 0.075, 12);
  group.add(pole);

  const arm = new T.Group();
  rod(arm, [0, 6.15, 0], [armLen, 6.3, 0], 0.07, steel, 0.045, 8);
  rod(arm, [0, 5.0, 0], [1.9, 6.18, 0], 0.035, steel, 0.035, 6);
  group.add(arm);

  const heads: T.Object3D[] = [];
  const countdownPanels: T.Mesh[] = [];

  const addCountdown = (parent: T.Object3D, x: number, y: number) => {
    box(parent, [x, y, 0], [0.46, 0.44, 0.18], housing, false);
    if (!opts.onCountdown) return;
    const panel = TrafficSignalController.createCountdownPanel();
    panel.mesh.position.set(x, y, -0.095);
    panel.mesh.rotation.y = Math.PI;
    parent.add(panel.mesh);
    countdownPanels.push(panel.mesh);
    opts.onCountdown(panel.handle, lamps);
  };

  const addHead = (x: number, y: number, withVisors: boolean) => {
    const head = new T.Group();
    head.position.set(x, y, 0);
    box(head, [0, 0, 0], [0.36, 1.0, 0.26], housing, false);
    const mats = [lamps.r, lamps.y, lamps.g];
    for (let i = 0; i < 3; i++) {
      const ly = 0.32 - i * 0.32;
      const disc = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.04, 16), mats[i]);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, ly, -0.14);
      head.add(disc);
      if (withVisors) box(head, [0, ly + 0.13, -0.2], [0.3, 0.025, 0.14], visorMat, false);
    }
    group.add(head);
    heads.push(head);
    return head;
  };

  // Two overhead heads hung from the arm, each with a countdown beside it (toward the pole).
  for (const hx of [armLen - 0.9, armLen - 2.6]) {
    rod(group, [hx, 6.28, 0], [hx, 6.0, 0], 0.03, steel, 0.03, 6);
    addHead(hx, 5.5, true);
    addCountdown(group, hx - 0.55, 5.7);
  }
  // Lower pole-mounted head with its own countdown, on the road side of the pole.
  addHead(0.38, 2.9, false);
  box(group, [0.19, 2.9, 0], [0.2, 0.06, 0.06], steel, false);
  addCountdown(group, 0.38, 2.0);
  orb(group, [0, 6.68, 0], [0.09, 0.09, 0.09], steel, 8);

  return { group, pole, arm, lamps, heads, countdownPanels };
}
