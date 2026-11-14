/**
 * The player's house and its way into the room from `/roomv2`.
 *
 * Nothing in the street world is rebuilt: the master bedroom is an ordinary room. The other room
 * on the second floor (the rear bedroom) keeps its door, but behind the door stands a white
 * doorway; stepping into it hands the screen to the room, which is built ahead of time.
 */
import type * as THREE from 'three';
import type { House } from './house';

export const HOME_HOUSE_NO = '59';
/** Floor index (0-based) of the rooms; the door is the rear bedroom's, on the second floor. */
export const HOME_FLOOR = 1;

export function findHome(houses: readonly House[]): House | undefined {
  return houses.find((h) => h.spec.no === HOME_HOUSE_NO && !h.spec.lite && h.n > HOME_FLOOR);
}

/** The white doorway in house-local metres: x range of the opening, the wall's far face, its height. */
export interface Doorway { x0: number; x1: number; z: number; z1: number; height: number }

/**
 * True while the eye is on the far side of the open door's line, inside the doorway. `local` is the
 * eye in house-local metres; `y` the eye's world height; `floorY` the second floor's.
 */
export function inDoorway(d: Doorway, local: THREE.Vector3, y: number, floorY: number): boolean {
  return y > floorY + 0.4 && y < floorY + d.height + 0.3 && local.x > d.x0 && local.x < d.x1 && local.z > d.z && local.z < d.z1;
}
