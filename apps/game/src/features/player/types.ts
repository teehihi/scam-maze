import type { MutableRefObject } from "react";

export interface PlayerControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  punch: boolean;
  block: boolean;
  inspect: boolean;
  interact: boolean;
}

export interface PlayerBounds {
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  maxRadius?: number;
  groundY: number;
}

export interface PlayerStats {
  position: [number, number, number];
  speed: number;
  isSprinting: boolean;
  isGrounded: boolean;
  isBlocking: boolean;
  isDriving?: boolean;
  isNearCar?: boolean;
  carSpeed?: number;
  carGear?: "P" | "D" | "R";
  carPosition?: [number, number, number];
  isEngineStarting?: boolean;
}

export interface FirstPersonPlayerProps {
  spawnPosition: [number, number, number];
  spawnYaw?: number;
  bounds: PlayerBounds;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
  keysRef: MutableRefObject<PlayerControlsState>;
  onStatsUpdate?: (stats: PlayerStats) => void;
  onInteract?: (playerPosition: [number, number, number]) => void;
  soundEnabled?: boolean;
  sfxVolume?: number;
  hitSoundPath?: string;
  missSoundPath?: string;
  interactReach?: number;
  /**
   * When false, movement, look and action input are ignored (pending mouse movement and
   * triggers are drained so the camera does not jump on resume). Defaults to true.
   */
  enabled?: boolean;
  carPivotRef?: MutableRefObject<any>;
}
