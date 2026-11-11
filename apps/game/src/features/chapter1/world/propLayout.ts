/**
 * World positions of the five Chapter 1 Interactables (Requirements 2.5, 3.1).
 *
 * The narrative side (labels, actions, evidence) lives in
 * `game/narrative/chapter1/interactables.ts`. This module only holds rendering-layer placement and
 * has no React or Three.js imports, so tests can check it directly.
 *
 * Coordinates are world units (metres):
 * - `position` is the centre of the focus sphere used by `findFocusedInteractable`. Its Y value is
 *   the ground height plus the height of the part of the object the player looks at.
 * - `radius` is the focus sphere radius.
 * - `yaw` turns the prop so its front (local +Z) faces the walkable strip: `Math.PI / 2` faces +X
 *   (props on the west side, x near 180), `-Math.PI / 2` faces -X (props on the east side).
 *
 * CALIBRATION STATUS: UNVERIFIED BY EYE. These values were placed without a browser, from the
 * play-area bounds only (`STREET_PLAY_BOUNDS`: x 180–198.5, z -92..52, ground y -92.70). X and Y
 * follow the design's starting values, except the shopkeeper's Y (see below). Z was moved closer to the spawn
 * (`[188.6, -92.70, -88.89]`, facing +Z) so the whole chapter area is about 30 m long instead of
 * about 50 m. Before release, check every prop with `pnpm dev:game` against the real street
 * geometry (no prop inside a wall, floating or hidden) and record the final values here.
 */

import type { InteractableId } from "../../../game/narrative/chapter1/ids";
import { INTERACTABLE_IDS } from "../../../game/narrative/chapter1/ids";
import { STREET_PLAY_BOUNDS } from "../../../game/scenes/MainMenuScene/streetPlayArea";
import type { InteractableSphere, Vec3 } from "../interaction/findFocusedInteractable";

export interface PropPlacement {
  /** Focus sphere centre in world space. */
  readonly position: Vec3;
  /** Focus sphere radius in metres. */
  readonly radius: number;
  /** Rotation around world Y, in radians. */
  readonly yaw: number;
}

export const PROP_FOCUS_RADIUS = 0.6;

/** Ground height that every prop stands on. */
export const PROP_GROUND_Y = STREET_PLAY_BOUNDS.groundY;

const FACE_EAST = Math.PI / 2;
const FACE_WEST = -Math.PI / 2;

export const INTERACTABLE_LAYOUT: Readonly<Record<InteractableId, PropPlacement>> = Object.freeze({
  // Café table on the west side; the wallet lies on the table top (about 0.8 m high).
  "obj.wallet": { position: [184.5, -91.9, -82], radius: PROP_FOCUS_RADIUS, yaw: FACE_EAST },
  // Mailbox on a post on the east side; the box is about 1.1 m high.
  "obj.mailbox": { position: [197.6, -91.6, -78], radius: PROP_FOCUS_RADIUS, yaw: FACE_WEST },
  // Notice in the shop window on the west side, at about 1.5 m.
  "obj.shop-poster": { position: [180.4, -91.2, -72], radius: PROP_FOCUS_RADIUS, yaw: FACE_EAST },
  // Sam behind the shop counter, 4 m further along so the poster and Sam do not overlap. The
  // focus centre is at about 1.4 m (design value: 0.8 m) so the sphere covers both the counter
  // top and Sam's upper body, and a player looking at Sam's face from 2 m away still hits it.
  "obj.shopkeeper": { position: [181.6, -91.3, -68], radius: PROP_FOCUS_RADIUS, yaw: FACE_EAST },
  // Community notice board on the east side, at about 1.3 m.
  "obj.notice-board": { position: [197.8, -91.4, -64], radius: PROP_FOCUS_RADIUS, yaw: FACE_WEST },
});

/** Focus spheres in `INTERACTABLE_IDS` order, ready for `findFocusedInteractable`. */
export const INTERACTABLE_SPHERES: readonly InteractableSphere<InteractableId>[] = Object.freeze(
  INTERACTABLE_IDS.map((id) => ({
    id,
    center: INTERACTABLE_LAYOUT[id].position,
    radius: INTERACTABLE_LAYOUT[id].radius,
  })),
);
