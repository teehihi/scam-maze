// Feature: game-phone-call-ui-redesign, Property 4: Call timer format
// Validates: Requirements 1.4
import { describe, expect, it } from "vitest";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { formatCallDuration } from "./callTimer";

const SEED = 0x7a11e4;
const RUNS = 200;
const PROPERTY_TIMEOUT_MS = 60_000;
const TEXT_PATTERN = /^\d{2,}:[0-5]\d$/;

const EDGE_VALUES = [0, 1, 59, 60, 61, 3599, 3600, 3661, 359_999, 360_000, 86_400, 10_000_000];
const INVALID_VALUES = [-1, -59, -3600, -0.5, NaN, Infinity, -Infinity, -1e9];

function assertValid(input: number, label: string): void {
  const { text, iso } = formatCallDuration(input);
  const context = `seed=${SEED} case=${label} input=${input} text=${text} iso=${iso}`;
  expect(TEXT_PATTERN.test(text), context).toBe(true);
  const [mm, ss] = text.split(":");
  expect(Number(mm) * 60 + Number(ss), context).toBe(input);
  expect(iso, context).toBe(`PT${Number(mm)}M${Number(ss)}S`);
}

describe("Property 4: Call timer format", () => {
  it(
    "formats seeded non-negative integers as mm:ss that round-trips, with a matching ISO duration",
    () => {
      const next = createLcg(SEED);
      for (const value of EDGE_VALUES) assertValid(value, `edge-${value}`);
      for (let i = 0; i < RUNS; i++) {
        const max = pick(next, [120, 3600, 100_000, 10_000_000]);
        assertValid(randomInt(next, 0, max), String(i));
      }
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    "gives 00:00 for negative, NaN and infinite input",
    () => {
      const next = createLcg(SEED);
      const inputs = [...INVALID_VALUES];
      for (let i = 0; i < RUNS; i++) inputs.push(-randomInt(next, 1, 10_000_000));
      for (const input of inputs) {
        const { text, iso } = formatCallDuration(input);
        const context = `seed=${SEED} input=${input} text=${text} iso=${iso}`;
        expect(text, context).toBe("00:00");
        expect(iso, context).toBe("PT0M0S");
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
