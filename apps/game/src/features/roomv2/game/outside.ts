import type { LaptopFrame, PhoneMode } from './screens';
import type { ScreenCornersPx, ScreenDeviceId, TaskMarkerPlacement } from './screenProjection';

/** Props a story host can listen to. Every other prop keeps the room's own behavior. */
export const ROOM_PROP_IDS = ['phone', 'laptop', 'note', 'receipts', 'calendar', 'photo', 'mug', 'door'] as const;
export type RoomPropId = (typeof ROOM_PROP_IDS)[number];
export const isRoomPropId = (id: string): id is RoomPropId => (ROOM_PROP_IDS as readonly string[]).includes(id);

/**
 * Port that lets an external story host (the chapter layer) drive the room. The engine only reports
 * what the player did and asks for text; it never reads story state. Without `RoomOptions.story` the
 * room behaves exactly as the standalone `/roomv2` page.
 */
export interface RoomStoryPort {
  /** Player pressed E on a story prop. `inspect-ready` fires when the camera pose is reached, `inspect-end` when the player leaves it. */
  onProp(id: RoomPropId, phase: 'interact' | 'inspect-ready' | 'inspect-end'): void;
  /** F, R, ... pressed (or a click) in an inspect pose. Returns true when handled. */
  onInspectKey(id: RoomPropId, key: string): boolean;
  /** Dynamic prompt text. `null` means "use the default translation". */
  label(id: string): string | null;
  /** Caption lines shown while inspecting. `null` means "use the default lines". */
  inspectLines(id: string): string[] | null;
  /** Key hints shown while inspecting. `null` means "use the default actions". */
  actions(id: string): Array<{ key: string; label: string }> | null;
  /** False keeps the player in the inspect pose (for example while the phone rings). */
  canLeaveInspect(id: string): boolean;
  /** True while the front door must stay shut. Optional; absent means unlocked. */
  doorLocked?(): boolean;
}

/** Presentation commands the engine accepts from a story host. */
export interface RoomStoryCommands {
  setPhoneMode(mode: PhoneMode): void;
  /** Vibration and ringtone on (true) or off (false). */
  ring(on: boolean): void;
  /** `LaptopFrame` text is drawn as given, so the host passes already translated text. `null` clears it. */
  setLaptopFrame(frame: LaptopFrame | null): void;
  /** Short notification sound at the laptop. */
  chime(): void;
  setMood(mood: 'calm' | 'quiet' | 'tense'): void;
  /**
   * Sets the time of day shown by the wall clock and the laptop and phone screens, in seconds. `null` returns to the
   * room's own clock (23:08 plus the time played). Optional.
   */
  setStoryClock?(secondsOfDay: number | null): void;
  /** Lowers the room's ambience under narration (true) or restores it (false). Optional. */
  duckForVoice?(on: boolean): void;
  /** Leaves the inspect pose even when `canLeaveInspect` says no. */
  closeInspect(): void;
  /** Shows (true) or hides (false) the cursor while a host overlay is open. `Engine` already has it. */
  setCursorMode?(on: boolean): void;
  /**
   * Follows the projected screen of the laptop or the phone while its inspect pose is reached. The listener gets the
   * four viewport corners in CSS pixels (top-left, top-right, bottom-right, bottom-left) whenever they change, or
   * null when the screen is not visible. null as device stops watching. Optional: hosts fall back to a flat panel.
   */
  watchScreen?(device: ScreenDeviceId | null, listener?: (corners: ScreenCornersPx | null) => void): void;
  /**
   * Follows the task marker of the laptop or the phone: the listener gets where to draw it, relative to the room
   * view (see `placeTaskMarker`), and the distance in metres, whenever that changes; null while the player is not
   * walking (before the start, in an inspect pose). null as prop stops watching. Optional.
   */
  watchTaskMarker?(prop: ScreenDeviceId | null, listener?: (marker: TaskMarker | null) => void): void;
  /**
   * Takes the phone off the nightstand (true) or puts it back (false). The story host does this when the
   * player carries the phone and brings it up with a key instead. Hidden, it is not drawn, lit or aimed at. Optional.
   */
  setPhoneCarried?(carried: boolean): void;
  /**
   * A page covers most of the view (the laptop): the room holds still and draws fewer frames, so
   * the page stays smooth. Optional.
   */
  setBackdrop?(on: boolean): void;
  /**
   * The thesis Writing Mode starts (true) or ends (false) while the laptop is held: the camera moves to
   * (or back from) the writing pose and Alex's hands rest on the keyboard. With `reducedMotion` the
   * camera cuts instead of moving. Presentation only. Optional.
   */
  setWriting?(on: boolean, reducedMotion?: boolean): void;
  /**
   * One keystroke of the Writing Mode: the hands type and the laptop plays a keypress at `volume`
   * (0..1). Ignored outside the Writing Mode. Presentation only. Optional.
   */
  typeOnKeyboard?(kind: "key" | "space" | "enter" | "backspace", volume: number): void;
}
/** One task-marker report of `watchTaskMarker`. */
export interface TaskMarker extends TaskMarkerPlacement {
  /** Metres from the camera, to one decimal. */
  distance: number;
}

/**
 * How the room is joined to the neighborhood when it is entered from house no. 59.
 * The room is its own engine; the neighborhood builds it ahead of time ("standby"), shows it when
 * the player walks through the white doorway, and hears back when the player leaves.
 */
export interface RoomOptions {
  /**
   * Build and compile everything but do not run or draw until `Engine.activate()`; the neighborhood
   * does this while the player walks to the door, so the room is ready the moment it is needed.
   */
  standby?: boolean;
  /** The player chose the room's door; the neighborhood starts its white-out. */
  onExitStart?: () => void;
  /** The white-out is done (about 0.6 s later): switch back to the neighborhood. */
  onExit?: () => void;
  /** External story host. When set, the room's own phone-call timeline is off (`story = 'external'`). */
  story?: RoomStoryPort;
}
