// Pure derivation of what the call overlay shows (design.md, "`callDialogueView.ts`").
// No React, three, i18n or store imports. Only type imports from the narrative layer.
import type { DialogueView } from "../../../game/narrative/selectors";
import type { CallDef, ChapterState } from "../../../game/narrative/types";

/** What the phone screen shows. The caller line is never part of it. */
export type PhoneCallView =
  | { status: "ringing"; callerName: string; number: string }
  | { status: "active"; callerName: string; number: string };

/** What the subtitle overlay shows. */
export type SubtitleContent =
  | { kind: "line"; speakerName: string; text: string; nodeKey: string }
  | { kind: "connecting" }
  | { kind: "none" };

export interface CallDialogueView {
  /** `null`: no call to show. */
  screen: PhoneCallView | null;
  subtitle: SubtitleContent;
  /** Non-caller line, shown by `PlayerChoiceOverlay`. */
  narration: string | null;
}

/**
 * Derives the phone screen view, the subtitle content and the narration line from the call state,
 * the call definition and the current dialogue view. A dialogue view that is not linked to the
 * current call is ignored.
 */
export function deriveCallDialogueView(input: {
  call: ChapterState["call"];
  callDef: CallDef | undefined;
  dialogueView: DialogueView | null;
}): CallDialogueView {
  const { call, callDef, dialogueView } = input;
  const linkedView =
    dialogueView !== null && call.current !== null && dialogueView.callId === call.current
      ? dialogueView
      : null;
  const callerLine =
    linkedView !== null && (linkedView.speaker === "caller" || linkedView.speaker === "npc");
  const narration = linkedView !== null && !callerLine ? linkedView.line : null;

  let screen: PhoneCallView | null = null;
  let subtitle: SubtitleContent = { kind: "none" };
  if (callDef !== undefined && call.status === "ringing") {
    screen = { status: "ringing", callerName: callDef.displayName, number: callDef.number };
  } else if (callDef !== undefined && call.status === "active") {
    screen = { status: "active", callerName: callDef.displayName, number: callDef.number };
    if (linkedView === null) {
      subtitle = { kind: "connecting" };
    } else if (callerLine) {
      subtitle = {
        kind: "line",
        speakerName: linkedView.speakerName ?? callDef.displayName,
        text: linkedView.line,
        nodeKey: `${linkedView.graphId}:${linkedView.nodeId}`,
      };
    }
  }

  return { screen, subtitle, narration };
}

/**
 * Subtitles show when there is no voice controller, when the Subtitles setting is on, or when
 * nothing is audible.
 */
export function isSubtitleVisible(input: {
  subtitlesEnabled: boolean;
  audible: boolean | undefined;
}): boolean {
  return input.audible === undefined || input.subtitlesEnabled || !input.audible;
}
