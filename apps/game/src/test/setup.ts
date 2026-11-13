import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { applyLocale, initI18n } from "../i18n";

// Every test starts in English, the default locale.
initI18n("en");
// jsdom has no media playback (`play` only logs "not implemented"). The intro voice clips use
// HTMLAudioElement, so playback resolves silently here; `duration` stays NaN, and the intro then
// types at its fallback speed.
if (typeof HTMLMediaElement !== "undefined") {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: () => undefined });
}

afterEach(() => {
  cleanup();
  applyLocale("en");
});
