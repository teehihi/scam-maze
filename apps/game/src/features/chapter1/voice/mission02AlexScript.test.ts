// The Mission 02 Alex recording script (`docs/gameplay/M02_ALEX_RECORDING_SCRIPT.md`) must list every
// Alex voice ID and file the game uses, and its texts must be the game's subtitles, so a recording
// made from it always matches what the player reads.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import enVoice from "../../../i18n/locales/en/chapter1/voice";
import viVoice from "../../../i18n/locales/vi/chapter1/voice";
import { MISSION02_ALEX_CUES, MISSION02_ALEX_STEMS, MISSION02_ALEX_VOICE_IDS } from "./mission02AlexVoice";
import { MISSION02_VOICE_PLACEHOLDERS, MISSION02_VOICE_STEMS } from "./mission02Voice";

const script = readFileSync(resolve(__dirname, "../../../../../../docs/gameplay/M02_ALEX_RECORDING_SCRIPT.md"), "utf8");
/** The script writes a subtitle line break as `<br>`. */
const asScript = (text: string) => text.replaceAll("\n", "<br>");

describe("Mission 02 Alex recording script", () => {
  it("lists every story line with its ID, both files and both texts", () => {
    for (const cue of MISSION02_ALEX_CUES) {
      const stem = MISSION02_ALEX_STEMS[cue];
      expect(script, cue).toContain(`\`${MISSION02_ALEX_VOICE_IDS[cue]}\``);
      expect(script, cue).toContain(`audio/mission02/en/alex_m02_${stem}_en.mp3`);
      expect(script, cue).toContain(`audio/mission02/vi/alex_m02_${stem}_vi.mp3`);
      expect(script, cue).toContain(asScript((enVoice.voice.alex as Record<string, string>)[cue]));
      expect(script, cue).toContain(asScript((viVoice.voice.alex as Record<string, string>)[cue]));
    }
  });

  it("lists every Alex dialogue line with its ID and file", () => {
    const alexLines = { ...MISSION02_VOICE_PLACEHOLDERS, "m02.coba.confirm.0": MISSION02_VOICE_STEMS["m02.coba.confirm.0"] };
    for (const [id, stem] of Object.entries(alexLines)) {
      expect(script, id).toContain(`\`${id}\``);
      expect(script, id).toContain(`\`${stem}.mp3\``);
    }
  });
});
