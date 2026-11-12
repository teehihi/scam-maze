// Motion part of the settings property. Validates: Requirements 11.2, 11.4.
//
// effectiveReducedMotion is checked over every setting and OS combination, and the provider and
// useReducedMotion are checked with seeded random settings. A component outside the provider keeps
// the OS-only behavior. Cases are seeded; a failure prints the seed, the case index and the inputs.
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReducedMotionSetting } from "@scammaze/shared-types";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import { mockReducedMotion, restoreMatchMedia } from "../../../test/loadingRuns";
import { CORE_PROPERTY_RUNS } from "../../../test/chapterRuns";
import { createLcg, pick } from "../../../test/seededRandom";
import { ComfortProvider, effectiveReducedMotion } from "./ComfortProvider";

const PROPERTY_TIMEOUT_MS = 60_000;
const SEED = 0x15_06_15_06;
const SETTINGS: readonly ReducedMotionSetting[] = ["system", "on", "off"];

function Probe() {
  const reduced = useReducedMotion();
  return React.createElement("span", { "data-testid": "probe" }, String(reduced));
}

function renderedValue(settings?: {
  reducedMotion: ReducedMotionSetting;
  reducedStress: boolean;
  subtitlesEnabled: boolean;
}): string {
  const probe = React.createElement(Probe);
  const { container, unmount } = render(
    settings ? React.createElement(ComfortProvider, { settings, children: probe }) : probe,
  );
  const text = container.textContent ?? "";
  unmount();
  return text;
}

afterEach(() => {
  cleanup();
  restoreMatchMedia();
});

describe("comfort motion", () => {
  it("effectiveReducedMotion covers every setting and OS combination", () => {
    for (const os of [false, true]) {
      expect(effectiveReducedMotion("on", os)).toBe(true);
      expect(effectiveReducedMotion("off", os)).toBe(false);
    }
    expect(effectiveReducedMotion("system", true)).toBe(true);
    expect(effectiveReducedMotion("system", false)).toBe(false);
  });

  // Feature: chapter-01-voice-narrative, Property 15: Settings parsing is total, bounded and idempotent
  it(
    "provider and hook follow effectiveReducedMotion; outside the provider the OS value is kept",
    () => {
      const next = createLcg(SEED);
      for (let i = 0; i < CORE_PROPERTY_RUNS; i += 1) {
        const setting = pick(next, SETTINGS);
        const os = next() < 0.5;
        const reducedStress = next() < 0.5;
        const subtitlesEnabled = next() < 0.5;
        const context = `seed=${SEED} case=${i} setting=${setting} os=${os}`;
        mockReducedMotion(os);

        const inside = renderedValue({ reducedMotion: setting, reducedStress, subtitlesEnabled });
        expect(inside, context).toBe(String(effectiveReducedMotion(setting, os)));

        const outside = renderedValue();
        expect(outside, context).toBe(String(os));
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
