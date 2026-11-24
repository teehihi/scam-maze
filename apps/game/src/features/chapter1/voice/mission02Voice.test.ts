import { describe, expect, it } from "vitest";
import { hasMission02Voice, mission02VoiceUrl, MISSION02_VOICE_STEMS } from "./mission02Voice";

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
