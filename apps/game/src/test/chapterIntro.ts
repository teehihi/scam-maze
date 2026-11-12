import { fireEvent, screen } from "@testing-library/react";
import enHud from "../i18n/locales/en/chapter1/hud";
import viHud from "../i18n/locales/vi/chapter1/hud";

/** Visible text of the intro overlay's continue button, per language. */
export const INTRO_CONTINUE_EN = enHud.intro.continue;
export const INTRO_CONTINUE_VI = viHud.intro.continue;

/**
 * Gets past the chapter intro overlay: the first click shows all the typed text, the second
 * click on the continue button starts the story. The scene must already be ready.
 */
export function passIntro(label: string = INTRO_CONTINUE_EN): void {
  // With "reduce motion" the text is already complete, so this first click already continues.
  fireEvent.click(screen.getByTestId("chapter-intro"));
  const button = screen.queryByRole("button", { name: label });
  if (button) fireEvent.click(button);
}
