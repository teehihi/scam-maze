// Recorded voice of Mission 02 "THE RIDE": the street driver, Minh's ride briefing, and Cô Ba's
// phone confirmation and Chợ Lớn interview.
//
// Every spoken line of the mission carries a stable voice ID in its scenario data
// (`openingVoiceId`, `voiceId`, `labelVoiceId`, `ConversationLine.voiceId`). This module is the one
// place that turns such an ID into a clip URL, so the street dialogue, the phone and a subtitle
// player all agree on where a line lives.
//
// Layout: `<MISSION02_VOICE_BASE>/<locale>/lines/<stem>.mp3`, the same `<locale>/lines` shape as
// Mission 01. A line without a clip resolves to `null` and the caller shows subtitles only: a
// missing recording never blocks the scene and never falls back to another line's audio.
import type { GameLocale } from "@scammaze/shared-types";
import { MISSION02_VOICE_BASE } from "../../../config/assetPaths";

/**
 * Voice ID → recording stem. Adding a line here is what makes it playable; an ID that is authored
 * in the scenario data but missing here stays a subtitle (see `MISSION02_VOICE_STEMS` coverage in
 * `mission02Voice.test.ts`).
 */
export const MISSION02_VOICE_STEMS: Readonly<Record<string, string>> = {
  // --- Street driver at the Bus 06 stop -------------------------------------------------------
  "m02.driver.ambient": "driver.ambient.0",
  "m02.driver.opening": "driver.opening.0",
  "m02.driver.driver_ask_app": "driver.ask_app.0",
  "m02.driver.driver_ask_plate": "driver.ask_plate.0",
  "m02.driver.driver_wait_bus": "driver.wait_bus.0",

  // --- Minh: the ride briefing before the mission, and the walk-away line ---------------------
  "m02.minh.setup": "minh.setup.0",
  "m02.minh.minh_m02_route": "minh.m02_route.0",
  "m02.minh.minh_m02_coba": "minh.m02_coba.0",
  "m02.minh.minh_leave": "minh.leave.0",

  // --- Cô Ba: the phone confirmation of the appointment --------------------------------------
  "m02.coba.confirm.0": "coba.confirm.0",
  "m02.coba.confirm.1": "coba.confirm.1",
};

/**
 * Alex's spoken lines in the Mission 02 conversations (the reply he picks on the street, and the same
 * question in the phone transcript of the interview), with the file each recording will use. These are
 * placeholders: authored and subtitled, not recorded yet, so they resolve to no clip and stay silent.
 * When both language files of a line exist in `public/audio/mission02/<locale>/lines/`, move the
 * entry into `MISSION02_VOICE_STEMS` (a test fails while a delivered file is still listed here).
 * Alex's own phone line `m02.coba.confirm.0` is already recorded and lives in the map above.
 */
export const MISSION02_VOICE_PLACEHOLDERS: Readonly<Record<string, string>> = {
  // --- Minh, the evening before (Alex's three replies) --------------------------------------
  "m02.minh.minh_m02_route.alex": "alex.minh.m02_route.0",
  "m02.minh.minh_m02_coba.alex": "alex.minh.m02_coba.0",
  "m02.minh.minh_leave.alex": "alex.minh.leave.0",
  // --- The street driver at the Bus 06 stop ---------------------------------------------------
  "m02.driver.driver_ask_app.alex": "alex.driver.ask_app.0",
  "m02.driver.driver_ask_plate.alex": "alex.driver.ask_plate.0",
  "m02.driver.driver_wait_bus.alex": "alex.driver.wait_bus.0",
  // --- Cô Ba at the market office, before the interview ----------------------------------------
  "m02.coba.waiting.where.alex": "alex.coba.waiting.where.0",
  "m02.coba.waiting.slot.alex": "alex.coba.waiting.slot.0",
  "m02.coba.waiting.ledger.alex": "alex.coba.waiting.ledger.0",
  // --- The interview (street reply and phone transcript share the recording) ----------------
  "m02.coba.interview.transfer_check.alex": "alex.coba.interview.transfer_check.0",
  "m02.coba.interview.process.alex": "alex.coba.interview.process.0",
  "m02.coba.interview.exception.alex": "alex.coba.interview.exception.0",
  "m02.coba.interview.invite_reschedule.alex": "alex.coba.interview.invite_reschedule.0",
  // --- Late arrival ----------------------------------------------------------------------------
  "m02.coba.late.reschedule.alex": "alex.coba.late.reschedule.0",
  "m02.coba.late.thanks.alex": "alex.coba.late.thanks.0",
  "m02.coba.late.leave.alex": "alex.coba.late.leave.0",
  // --- The rescheduled interview -------------------------------------------------------------
  "m02.coba.rescheduled.start.alex": "alex.coba.rescheduled.start.0",
  "m02.coba.rescheduled.confirm.alex": "alex.coba.rescheduled.confirm.0",
  "m02.coba.rescheduled.leave.alex": "alex.coba.rescheduled.leave.0",
  // --- After the interview -------------------------------------------------------------------
  "m02.coba.after.thanks.alex": "alex.coba.after.thanks.0",
  "m02.coba.after.recap.alex": "alex.coba.after.recap.0",
  "m02.coba.after.leave.alex": "alex.coba.after.leave.0",
};

/** The file a line's recording uses (recorded or placeholder), or null for an unknown voice ID. */
export function mission02VoiceStem(voiceId: string): string | null {
  if (Object.hasOwn(MISSION02_VOICE_STEMS, voiceId)) return MISSION02_VOICE_STEMS[voiceId];
  if (Object.hasOwn(MISSION02_VOICE_PLACEHOLDERS, voiceId)) return MISSION02_VOICE_PLACEHOLDERS[voiceId];
  return null;
}

/** Locales that have their own recording. Only `en` may stand in for another locale, and only on request. */
const RECORDED_LOCALES: readonly GameLocale[] = ["en", "vi"];

/**
 * The clip of one Mission 02 voice line, or null when this line has no recording.
 *
 * `englishFallback` is the player's own setting: with it on, a Vietnamese line that has no clip
 * plays the English recording instead of going silent. The text on screen always stays in the
 * language of the game.
 */
export function mission02VoiceUrl(
  voiceId: string | null | undefined,
  locale: GameLocale,
  englishFallback = false,
): string | null {
  if (!voiceId) return null;
  if (!Object.hasOwn(MISSION02_VOICE_STEMS, voiceId)) return null;
  const stem = MISSION02_VOICE_STEMS[voiceId];
  const recorded: GameLocale = RECORDED_LOCALES.includes(locale) ? locale : "en";
  const chosen = recorded === locale || englishFallback ? recorded : null;
  if (chosen === null) return null;
  return `${MISSION02_VOICE_BASE}/${chosen}/lines/${stem}.mp3`;
}

/** True when the voice ID is one this module can play. */
export function hasMission02Voice(voiceId: string | null | undefined): boolean {
  return Boolean(voiceId && Object.hasOwn(MISSION02_VOICE_STEMS, voiceId));
}
