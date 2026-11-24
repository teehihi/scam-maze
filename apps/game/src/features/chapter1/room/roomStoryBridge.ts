// Adapter between the Room v2 engine (`RoomStoryPort`) and the chapter layer (task 8.3).
// Pure TypeScript: no React and no Three.js. Type-only imports from roomv2 are erased at build time.
// The engine calls the port methods; the layer attaches handlers while it is mounted. Before
// `attach` and after `detach` every method returns a neutral default.
// See .kiro/specs/chapter-01-double-deception/design.md, "RoomStoryBridge".
import type { RoomPropId, RoomStoryCommands, RoomStoryPort } from "../../roomv2/game/outside";

/**
 * The slice of Story NPC runtime context the bridge may send back after a conversation opens.
 * Structural copy: this pure module must not import the narrative or street modules at runtime.
 */
export interface StoryContextPatch {
  flags?: Record<string, boolean>;
}

/** Structural copy keeps this room-only bridge's import boundary independent of the street module. */
export interface TransitEvent {
  type: "wait-started" | "bus-at-stop" | "boarded" | "left-bus" | "fare-paid" | "departed" | "passed-stop" | "arrived" | "transfer-complete";
  at: number;
  route: string;
  stop?: string;
  amount?: number;
  onTime?: boolean;
}

/**
 * What the layer provides while it is mounted. Every member is optional; a missing member uses the
 * same default as "not attached".
 */
export interface RoomStoryHandlers extends Partial<RoomStoryPort> {
  /** True while a chapter overlay (call, phone, laptop, journal, decision, debrief, pause) is open. */
  overlayOpen?(): boolean;
  /** A Bus 06 route event from the street: boarded, fare paid, departed, arrived, transfer done. */
  onTransit?(event: TransitEvent): void;
  /** A street NPC reply selected by the player; may return the updated story flags synchronously. */
  onStoryReply?(npcId: string, replyId: string): StoryContextPatch | void;
  /** A street NPC conversation opened; may return the updated story flags synchronously. */
  onStoryStart?(npcId: string): StoryContextPatch | void;
}

export class RoomStoryBridge implements RoomStoryPort {
  /**
   * Presentation commands of the running engine, set from `onReady(engine)` and cleared with
   * `null` when the engine is destroyed. Independent from `attach` and `detach`.
   */
  commands: RoomStoryCommands | null = null;

  private handlers: RoomStoryHandlers | null = null;

  /** Connects the layer. A second call replaces the first handlers. */
  attach(handlers: RoomStoryHandlers): void {
    this.handlers = handlers;
  }

  /** Disconnects the layer. Safe to call when nothing is attached. */
  detach(): void {
    this.handlers = null;
  }

  get attached(): boolean {
    return this.handlers !== null;
  }

  onProp(id: RoomPropId, phase: "interact" | "inspect-ready" | "inspect-end"): void {
    this.handlers?.onProp?.(id, phase);
  }

  onInspectKey(id: RoomPropId, key: string): boolean {
    return this.handlers?.onInspectKey?.(id, key) ?? false;
  }

  label(id: string): string | null {
    return this.handlers?.label?.(id) ?? null;
  }

  inspectLines(id: string): string[] | null {
    return this.handlers?.inspectLines?.(id) ?? null;
  }

  actions(id: string): Array<{ key: string; label: string }> | null {
    return this.handlers?.actions?.(id) ?? null;
  }

  canLeaveInspect(id: string): boolean {
    return this.handlers?.canLeaveInspect?.(id) ?? true;
  }

  doorLocked(): boolean {
    return this.handlers?.doorLocked?.() ?? false;
  }

  /** True while a chapter overlay is open. Hosts use it to skip their own Escape handling. */
  overlayOpen(): boolean {
    return this.handlers?.overlayOpen?.() ?? false;
  }

  /**
   * Passes a Bus 06 event from the street to the layer. The street calls this while the player is
   * out of the room; nothing happens before the layer attaches.
   */
  transit(event: TransitEvent): void {
    this.handlers?.onTransit?.(event);
  }

  /** Passes a street NPC reply to the layer and returns its context patch. */
  storyReply(npcId: string, replyId: string): StoryContextPatch | undefined {
    return this.handlers?.onStoryReply?.(npcId, replyId) ?? undefined;
  }

  /** Passes the start of a street NPC conversation to the layer and returns its context patch. */
  storyStart(npcId: string): StoryContextPatch | undefined {
    return this.handlers?.onStoryStart?.(npcId) ?? undefined;
  }
}
