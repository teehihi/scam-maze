/**
 * Automatic turn signal (blinker), driven by the steering keys.
 *
 * - Holding A or D for `armDelay` seconds switches the signal on for that side.
 * - Once steering stops, the signal stays on for `offDelay` seconds (the turn is finishing),
 *   then switches off.
 * - Steering the other way for `armDelay` seconds moves the signal to that side.
 * Tapping the keys briefly (lane corrections) never switches it on.
 */

export type SteerDirection = -1 | 0 | 1;

export interface TurnSignalState {
  /** Side currently blinking: -1 left, 1 right, 0 off. */
  active: SteerDirection;
  /** Side being steered and for how long, used to arm the signal. */
  heldDirection: SteerDirection;
  heldFor: number;
  /** Time since steering stopped while the signal is on. */
  releasedFor: number;
}

export interface TurnSignalConfig {
  armDelay: number;
  offDelay: number;
}

export const DEFAULT_TURN_SIGNAL_CONFIG: TurnSignalConfig = {
  armDelay: 0.35,
  offDelay: 1.5,
};

export const INITIAL_TURN_SIGNAL: TurnSignalState = {
  active: 0,
  heldDirection: 0,
  heldFor: 0,
  releasedFor: 0,
};

export function stepTurnSignal(
  state: TurnSignalState,
  steer: SteerDirection,
  dt: number,
  config: TurnSignalConfig = DEFAULT_TURN_SIGNAL_CONFIG,
): TurnSignalState {
  const heldFor = steer !== 0 && steer === state.heldDirection ? state.heldFor + dt : steer !== 0 ? dt : 0;
  let active = state.active;
  let releasedFor = state.releasedFor;

  if (steer !== 0) {
    releasedFor = 0;
    if (heldFor >= config.armDelay) active = steer;
  } else if (active !== 0) {
    releasedFor += dt;
    if (releasedFor >= config.offDelay) {
      active = 0;
      releasedFor = 0;
    }
  }

  return { active, heldDirection: steer, heldFor, releasedFor };
}
