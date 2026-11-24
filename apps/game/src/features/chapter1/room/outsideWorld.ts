/**
 * Chapter 1 host for the Saigon open world (the `/testbus` scene) around Room 6.07.
 *
 * The open world shares the room's renderer. Every room frame it runs and draws the street from the room camera
 * (colour + depth); the room composites itself over it, so through the open door and the open window the player
 * sees the live street and walks out and back in with no cut. Nothing inside the room changes: the room engine
 * keeps its props, story port and UI, and only gains a real door and a real outside.
 */
import type { Engine as RoomEngine } from "../../roomv2/game/engine";
import type { OpenWorldEngine, OpenWorldSnapshot } from "../../testbus/openworld/world/OpenWorldEngine";
import type { TransitEvent } from "../../testbus/openworld/simulation/transit";

export interface OutsideWorldHooks {
  /** HUD data (about 8 times a second). `outdoors` is true while the player is out of the room. */
  onSnapshot: (snap: OpenWorldSnapshot, outdoors: boolean) => void;
  /** Bus 06 events from the route controller, for the chapter store. */
  onTransit?: (event: TransitEvent) => void;
  /** A street NPC reply selected by the player. */
  onStoryReply?: (npcId: string, replyId: string) => void;
}

export interface OutsideWorldHandle {
  readonly world: OpenWorldEngine;
  dispose(): void;
}

/** The door stays locked while the chapter runs; `?opendoor` (testing) opens it from the start. */
export function doorForcedOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("opendoor");
  } catch {
    return false;
  }
}

/** Builds the open world around the room. Resolves null where it cannot start (the room keeps its own city). */
export async function attachOutsideWorld(room: RoomEngine, hooks: OutsideWorldHooks): Promise<OutsideWorldHandle | null> {
  const container = room.renderer.domElement.parentElement;
  if (!container) return null;
  const { OpenWorldEngine: World } = await import("../../testbus/openworld/world/OpenWorldEngine");
  let world: OpenWorldEngine;
  try {
    world = new World(container, (snap) => hooks.onSnapshot(snap, room.outdoors), {
      renderer: room.renderer,
      viewTarget: room.cityRT,
      clockHours: () => (room.storyClockSeconds === null ? null : room.storyClockSeconds / 3600),
      onDoor: () => room.toggleOutsideDoor(),
      onThunder: (intensity) => room.outsideThunder(intensity),
      onTransit: hooks.onTransit,
      onStoryReply: hooks.onStoryReply,
    });
  } catch (error) {
    console.error("Outside world failed to start, keeping the built-in city:", error);
    return null;
  }
  // Dev-only handle for the browser console and automated checks; never set in production builds.
  if (import.meta.env.DEV) (window as unknown as { __outsideWorld?: OpenWorldEngine }).__outsideWorld = world;
  room.setOutside({
    stepView: (dt, pose) => world.stepView(dt, pose),
    enterPlay: (eye, yaw, pitch) => world.enterPlay(eye, yaw, pitch),
    stepPlay: (dt, input) => world.stepPlay(dt, input),
    interact: () => world.interact(),
    confirm: () => world.confirmRide(),
    setMuted: (muted) => world.setStreetMuted(muted),
    backdrop: () => world.backdrop,
    exposure: () => 1.26 + 0.16 * world.atmosphere.state.nightFactor,
    rainAmount: () => world.atmosphere.state.rainIntensity,
    daylight: () => 1 - world.atmosphere.state.nightFactor,
  });
  return {
    world,
    dispose() {
      room.setOutside(null);
      world.dispose();
    },
  };
}
