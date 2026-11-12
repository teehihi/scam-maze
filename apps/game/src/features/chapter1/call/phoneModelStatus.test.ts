// Unit tests for the phone model session status (Requirements 8.5, 8.8).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasPhoneModelFailed,
  reportPhoneModelFailure,
  resetPhoneModelStatusForTests,
} from "./phoneModelStatus";

const ASSET_PATH = "/assets/3d/props/phone/call-phone.glb";

describe("phoneModelStatus", () => {
  beforeEach(() => {
    resetPhoneModelStatusForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetPhoneModelStatusForTests();
  });

  it("reports no failure before any report", () => {
    expect(hasPhoneModelFailed()).toBe(false);
  });

  it("logs exactly one warning containing the asset path for repeated failures", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    reportPhoneModelFailure(ASSET_PATH, new Error("first"));
    reportPhoneModelFailure(ASSET_PATH, new Error("second"));
    reportPhoneModelFailure(ASSET_PATH, new Error("third"));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(ASSET_PATH);
  });

  it("marks the model as failed after the first report", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    reportPhoneModelFailure(ASSET_PATH, new Error("load failed"));

    expect(hasPhoneModelFailed()).toBe(true);
  });

  it("clears the failure and allows a new warning after the test reset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    reportPhoneModelFailure(ASSET_PATH, new Error("first"));
    resetPhoneModelStatusForTests();

    expect(hasPhoneModelFailed()).toBe(false);

    reportPhoneModelFailure(ASSET_PATH, new Error("again"));

    expect(hasPhoneModelFailed()).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
