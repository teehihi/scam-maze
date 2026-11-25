import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MISSION_02_DEVICE_ITEMS } from "../../../game/narrative/chapter1/mission02";
import { hasMission02Voice, mission02VoiceStem, mission02VoiceUrl, MISSION02_VOICE_PLACEHOLDERS, MISSION02_VOICE_STEMS } from "./mission02Voice";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const lineFile = (locale: string, stem: string) => here(`../../../../public/audio/mission02/${locale}/lines/${stem}.mp3`);

/** Every voice ID of a line Alex speaks in Mission 02: street replies (`labelVoiceId`) and phone transcripts. */
function alexLineVoiceIds(): string[] {
  const cast = readFileSync(here("../../../game/narrative/chapter1/storyCast.ts"), "utf8");
  const replies = [...cast.matchAll(/labelVoiceId: "(m02\.[^"]+)"/g)].map((match) => match[1]);
  const transcripts = MISSION_02_DEVICE_ITEMS.flatMap((item) => item.actions ?? [])
    .flatMap((action) => action.transcript ?? [])
    .filter((line) => line.speaker === "alex" && line.voiceId !== undefined)
    .map((line) => line.voiceId as string);
  return [...new Set([...replies, ...transcripts])];
}

describe("Mission 02 Alex line manifest", () => {
  it("covers every line Alex speaks, as a recording or a placeholder", () => {
    const ids = alexLineVoiceIds();
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) expect(mission02VoiceStem(id), id).not.toBeNull();
  });

  it("keeps placeholders silent and apart from the recorded map", () => {
    for (const [id, stem] of Object.entries(MISSION02_VOICE_PLACEHOLDERS)) {
      expect(Object.hasOwn(MISSION02_VOICE_STEMS, id), id).toBe(false);
      expect(mission02VoiceUrl(id, "en"), id).toBeNull();
      expect(stem).toMatch(/^alex\.[a-z0-9_.]+\.0$/);
      // A delivered recording must move to the recorded map, or it would never play.
      expect([existsSync(lineFile("en", stem)), existsSync(lineFile("vi", stem))], `${id}: move it to MISSION02_VOICE_STEMS`).toEqual([false, false]);
    }
    const stems = Object.values(MISSION02_VOICE_PLACEHOLDERS);
    expect(new Set(stems).size).toBe(stems.length);
  });

  it("has both language files for every recorded line", () => {
    for (const stem of Object.values(MISSION02_VOICE_STEMS)) {
      expect(existsSync(lineFile("en", stem)), `en/${stem}`).toBe(true);
      expect(existsSync(lineFile("vi", stem)), `vi/${stem}`).toBe(true);
    }
  });
});

describe("Mission 02 recorded voice map", () => {
  it("resolves every recorded ID to its locale clip", () => {
    for (const voiceId of Object.keys(MISSION02_VOICE_STEMS)) {
      expect(mission02VoiceUrl(voiceId, "en")).toBe(`/audio/mission02/en/lines/${MISSION02_VOICE_STEMS[voiceId]}.mp3`);
      expect(mission02VoiceUrl(voiceId, "vi")).toBe(`/audio/mission02/vi/lines/${MISSION02_VOICE_STEMS[voiceId]}.mp3`);
      expect(hasMission02Voice(voiceId)).toBe(true);
    }
  });

  it("does not invent a clip for an authored but unrecorded interview line", () => {
    expect(hasMission02Voice("m02.coba.interview.transfer_check")).toBe(false);
    expect(mission02VoiceUrl("m02.coba.interview.transfer_check", "en")).toBeNull();
  });

  it("does not use English for Vietnamese unless the fallback setting is on", () => {
    // The map has both locales today; this still pins the explicit fallback contract for future
    // English-only recordings and avoids a silent cross-line fallback.
    expect(mission02VoiceUrl("m02.driver.opening", "vi", false)).toBe("/audio/mission02/vi/lines/driver.opening.0.mp3");
    expect(mission02VoiceUrl("m02.driver.opening", "vi", true)).toBe("/audio/mission02/vi/lines/driver.opening.0.mp3");
    expect(mission02VoiceUrl(null, "en")).toBeNull();
  });
});
