import { fireEvent, screen } from "@testing-library/react";
import enHud from "../i18n/locales/en/chapter1/hud";
import viHud from "../i18n/locales/vi/chapter1/hud";

/** Visible text of the intro overlay's continue button, per language. */
export const INTRO_CONTINUE_EN = enHud.intro.continue;
export const INTRO_CONTINUE_VI = viHud.intro.continue;

/** Upper bound on clicks: two per paragraph (show all, next) for the longest script, plus margin. */
const MAX_INTRO_CLICKS = 12;

/**
 * Gets past the chapter intro overlay. Each paragraph takes a click to show all of its text and
 * another to move on; after the last paragraph the continue button starts the story. The scene
 * must already be ready.
 */
export function passIntro(label: string = INTRO_CONTINUE_EN): void {
  for (let i = 0; i < MAX_INTRO_CLICKS; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (intro === null) return;
    const button = screen.queryByRole<HTMLButtonElement>("button", { name: label });
    if (button !== null && !button.disabled) {
      fireEvent.click(button);
      return;
    }
    fireEvent.click(intro);
  }
  throw new Error("the chapter intro did not offer its continue button");
}
