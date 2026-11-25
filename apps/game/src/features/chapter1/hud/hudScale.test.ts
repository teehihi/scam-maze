import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { HUD_BASE_SCALE, MENU_REFERENCE_SCALE, computeHudScale, hudScaleStyle, useHudScale } from "./hudScale";

describe("computeHudScale", () => {
  it("is 80% at the reference viewport", () => {
    expect(computeHudScale(1280, 720)).toBe(0.8);
  });
  it("matches the shipped look around 1024 x 576", () => {
    expect(computeHudScale(1024, 576)).toBe(0.64);
    expect(MENU_REFERENCE_SCALE).toBe(0.61);
  });
  it("is proportional, so a viewport shrunk by browser zoom shrinks the HUD by the same factor", () => {
    expect(computeHudScale(640, 360)).toBe(0.4);
    expect(computeHudScale(1920, 1080)).toBe(1.2);
    expect(computeHudScale(960, 540)).toBe(0.6);
    expect(computeHudScale(1920, 1080) / 2).toBeCloseTo(computeHudScale(960, 540));
  });
  it("keeps text legible on small windows with a floor of 0.4", () => {
    expect(computeHudScale(512, 288)).toBe(0.4);
    expect(computeHudScale(360, 640)).toBe(0.4);
  });
  it("caps huge monitors at 2.4", () => {
    expect(computeHudScale(3840, 2160)).toBe(2.4);
    expect(computeHudScale(7680, 4320)).toBe(2.4);
  });
  it("follows the limiting side, so tall or wide windows do not oversize the HUD", () => {
    expect(computeHudScale(2560, 720)).toBe(0.8);
    expect(computeHudScale(1280, 400)).toBe(0.44);
  });
  it("falls back to the base scale for an unknown viewport", () => {
    expect(computeHudScale(0, 0)).toBe(HUD_BASE_SCALE);
  });
  it("builds a transform anchored to a corner or an edge centre", () => {
    expect(hudScaleStyle(0.8, "top right")).toEqual({ transform: "scale(0.8)", transformOrigin: "top right" });
    expect(hudScaleStyle(0.5, "top center")).toEqual({ transform: "scale(0.5)", transformOrigin: "top center" });
    expect(hudScaleStyle(0.5, "bottom center")).toEqual({ transform: "scale(0.5)", transformOrigin: "bottom center" });
  });
});

describe("useHudScale", () => {
  const original = { w: window.innerWidth, h: window.innerHeight };
  const setViewport = (w: number, h: number) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
  };
  afterEach(() => {
    setViewport(original.w, original.h);
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });

  it("updates on window resize", () => {
    setViewport(1280, 720);
    const { result } = renderHook(() => useHudScale());
    expect(result.current).toBe(0.8);
    act(() => {
      setViewport(960, 540);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(0.6);
  });

  it("follows visualViewport when available, including its resize event", () => {
    setViewport(1280, 720);
    const vv = Object.assign(new EventTarget(), { width: 1280, height: 720 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    const { result } = renderHook(() => useHudScale());
    expect(result.current).toBe(0.8);
    act(() => {
      vv.width = 640;
      vv.height = 360;
      vv.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(0.4);
  });
});
