import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { applyLocale, initI18n } from "../i18n";

// Every test starts in English, the default locale.
initI18n("en");

afterEach(() => {
  cleanup();
  applyLocale("en");
});
