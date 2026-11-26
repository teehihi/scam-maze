// Incoming calls of the device content (`DeviceItemDef.incomingCall`): who is calling Alex now. Pure:
// it reads the chapter state and the scenario, and never changes either. The phone rings while a
// caller is pending; the call ends only through the caller's own actions (`call` or `decline`), which
// the player chooses.
import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";

/** The action that answers (or returns) the call, and the one that declines it. */
export const ANSWER_ACTION = "call";
export const DECLINE_ACTION = "decline";

/** The first contact who is calling and has not been answered or declined, or null. */
export function pendingIncomingCaller(state: ChapterState, scenario: ScenarioDefinition): string | null {
  if (state.status !== "playing") return null;
  for (const def of scenario.deviceItems ?? []) {
    if (def.incomingCall !== true || !Object.hasOwn(state.device.items, def.id)) continue;
    const done = state.device.items[def.id].done;
    if (!done.includes(ANSWER_ACTION) && !done.includes(DECLINE_ACTION)) return def.id;
  }
  return null;
}
