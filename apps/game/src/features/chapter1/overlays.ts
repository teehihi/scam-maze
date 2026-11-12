// Overlay stack for the Chapter_Page. Immutable: every helper returns a new stack.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Overlay and input rules", and
// Requirement 4 (player input is enabled only while the stack is empty).

import type { InteractableId } from "../../game/narrative/chapter1/ids";

export type Overlay =
  | { kind: "phone" }
  | { kind: "journal" }
  | { kind: "inspection"; objectId: InteractableId }
  /** Face-to-face dialogue panel (Sam). Phone calls render inside the phone overlay. */
  | { kind: "dialogue" }
  | { kind: "decision" }
  | { kind: "pause" }
  | { kind: "ending" }
  | { kind: "debrief" };

export type OverlayKind = Overlay["kind"];

/** Bottom first; the last element is the top-most overlay. */
export type OverlayStack = readonly Overlay[];

export const EMPTY_OVERLAYS: OverlayStack = Object.freeze([]);

/** Adds `overlay` on top. If an overlay of the same kind is already open, it moves to the top. */
export function push(stack: OverlayStack, overlay: Overlay): OverlayStack {
  return Object.freeze([...stack.filter((entry) => entry.kind !== overlay.kind), overlay]);
}

/** Removes the top-most overlay. Returns the same stack when it is empty. */
export function pop(stack: OverlayStack): OverlayStack {
  return stack.length === 0 ? stack : Object.freeze(stack.slice(0, -1));
}

export function top(stack: OverlayStack): Overlay | undefined {
  return stack[stack.length - 1];
}

/** With a kind: is an overlay of that kind open anywhere in the stack? Without: is any open? */
export function isOpen(stack: OverlayStack, kind?: OverlayKind): boolean {
  return kind === undefined ? stack.length > 0 : stack.some((entry) => entry.kind === kind);
}
