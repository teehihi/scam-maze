/**
 * Grab driver: a Honda Wave scooter with its rider on one skeleton (`grab-driver.optimized.glb`).
 * The file carries four clips; the wheels turn inside them, so the traffic rig gets no separate wheel list and
 * the clip is chosen and timed from the speed the traffic agent really drives.
 */

export const GRAB_DRIVER_FILE = "grab-driver.optimized.glb";

export type GrabClipName = "Drive_Cruise" | "Drive_Fast" | "Drive_Turn" | "Idle_TrafficLight";

/** Ground speed (m/s) at which each driving clip rolls without slipping: wheel radius 0.275 m times its spin rate. */
export const GRAB_CRUISE_SPEED = 3.46;
export const GRAB_FAST_SPEED = 6.9;

export interface GrabClipChoice {
  clip: GrabClipName;
  timeScale: number;
}

/** Picks the clip and its playback rate for the current speed and steering. */
export function pickGrabClip(speed: number, steerAngle = 0): GrabClipChoice {
  if (speed < 0.3) return { clip: "Idle_TrafficLight", timeScale: 1 };
  if (Math.abs(steerAngle) > 0.18 && speed < GRAB_FAST_SPEED) {
    return { clip: "Drive_Turn", timeScale: Math.max(0.3, speed / GRAB_CRUISE_SPEED) };
  }
  if (speed < (GRAB_CRUISE_SPEED + GRAB_FAST_SPEED) / 2) {
    return { clip: "Drive_Cruise", timeScale: speed / GRAB_CRUISE_SPEED };
  }
  return { clip: "Drive_Fast", timeScale: speed / GRAB_FAST_SPEED };
}

/**
 * Lamp placement on the Grab scooter, measured from `grab-driver.optimized.glb` (metres, bone local space).
 * The head lens sits on the front face of the cowl, which is at z = 0.093 and spans y = -0.042..0.063 in the
 * Bike_Steering frame, so the lens turns with the handlebar. The tail lens sits on the tip of the rear carrier
 * (Bike_Chassis frame, tip at z = -0.94, y = 0.42..0.56, half width 0.055).
 */
export const GRAB_HEADLAMP = {
  bone: "Bike_Steering",
  position: [0, 0.012, 0.075] as const,
  radius: 0.055,
  depth: 0.03,
};
export const GRAB_TAILLAMP = {
  bone: "Bike_Chassis",
  position: [0, 0.49, -0.925] as const,
  radius: 0.034,
  depth: 0.02,
};
