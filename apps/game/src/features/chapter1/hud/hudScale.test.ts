import { describe, expect, it } from "vitest";
import { HUD_BASE_SCALE, computeHudScale, hudScaleStyle } from "./hudScale";

describe("computeHudScale", () => {
  it("is 80% at the reference viewport", () => {
    expect(computeHudScale(1280, 720)).toBe(0.8);
  });
  it("shrinks on small windows down to a floor of 0.64", () => {
    expect(computeHudScale(1024, 576)).toBe(0.64);
    expect(computeHudScale(640, 360)).toBe(0.64);
  });
  it("grows on large monitors up to a ceiling of 1.0", () => {
    expect(computeHudScale(1600, 900)).toBe(1);
    expect(computeHudScale(3840, 2160)).toBe(1);
  });
  it("follows the limiting side, so tall or wide windows do not oversize the HUD", () => {
    expect(computeHudScale(2560, 720)).toBe(0.8);
    expect(computeHudScale(1280, 400)).toBe(0.64);
  });
  it("falls back to the base scale for an unknown viewport", () => {
    expect(computeHudScale(0, 0)).toBe(HUD_BASE_SCALE);
  });
  it("builds a corner-anchored transform", () => {
    expect(hudScaleStyle(0.8, "top right")).toEqual({ transform: "scale(0.8)", transformOrigin: "top right" });
  });
});
