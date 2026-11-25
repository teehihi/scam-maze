// Tests for RoomStoryBridge (task 8.3): defaults, attach/detach order, forwarding, door lock and
// the import boundary (no React, three or @react-three at runtime).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomStoryBridge } from "./roomStoryBridge";

describe("RoomStoryBridge defaults (not attached)", () => {
  it("returns neutral values and ignores events", () => {
    const bridge = new RoomStoryBridge();
    expect(bridge.attached).toBe(false);
    expect(bridge.label("phone")).toBeNull();
    expect(bridge.inspectLines("phone")).toBeNull();
    expect(bridge.actions("phone")).toBeNull();
    expect(bridge.canLeaveInspect("phone")).toBe(true);
    expect(bridge.onInspectKey("phone", "F")).toBe(false);
    expect(bridge.doorLocked()).toBe(false);
    expect(bridge.overlayOpen()).toBe(false);
    expect(bridge.commands).toBeNull();
    expect(() => bridge.onProp("note", "interact")).not.toThrow();
  });

  it("uses the same defaults for handlers that omit a member", () => {
    const bridge = new RoomStoryBridge();
    bridge.attach({});
    expect(bridge.attached).toBe(true);
    expect(bridge.label("door")).toBeNull();
    expect(bridge.canLeaveInspect("door")).toBe(true);
    expect(bridge.doorLocked()).toBe(false);
    expect(bridge.overlayOpen()).toBe(false);
    expect(() => bridge.onProp("door", "interact")).not.toThrow();
  });
});

describe("RoomStoryBridge forwarding", () => {
  it("forwards prop events in order with their phase", () => {
    const bridge = new RoomStoryBridge();
    const seen: string[] = [];
    bridge.attach({ onProp: (id, phase) => seen.push(`${id}:${phase}`) });
    bridge.onProp("laptop", "interact");
    bridge.onProp("laptop", "inspect-ready");
    bridge.onProp("laptop", "inspect-end");
    expect(seen).toEqual(["laptop:interact", "laptop:inspect-ready", "laptop:inspect-end"]);
  });

  it("forwards labels, lines, actions, keys and leave checks", () => {
    const bridge = new RoomStoryBridge();
    const actions = [{ key: "F", label: "Answer" }];
    const onInspectKey = vi.fn((_id: string, key: string) => key === "F");
    bridge.attach({
      label: (id) => (id === "phone" ? "Phone is ringing" : null),
      inspectLines: () => ["Line one"],
      actions: () => actions,
      canLeaveInspect: (id) => id !== "phone",
      onInspectKey,
      overlayOpen: () => true,
    });
    expect(bridge.label("phone")).toBe("Phone is ringing");
    expect(bridge.label("mug")).toBeNull();
    expect(bridge.inspectLines("note")).toEqual(["Line one"]);
    expect(bridge.actions("phone")).toBe(actions);
    expect(bridge.canLeaveInspect("phone")).toBe(false);
    expect(bridge.canLeaveInspect("note")).toBe(true);
    expect(bridge.onInspectKey("phone", "F")).toBe(true);
    expect(bridge.onInspectKey("phone", "R")).toBe(false);
    expect(onInspectKey).toHaveBeenCalledWith("phone", "R");
    expect(bridge.overlayOpen()).toBe(true);
  });

  it("reads handler state on every call", () => {
    const bridge = new RoomStoryBridge();
    let open = false;
    bridge.attach({ overlayOpen: () => open });
    expect(bridge.overlayOpen()).toBe(false);
    open = true;
    expect(bridge.overlayOpen()).toBe(true);
  });
});

describe("RoomStoryBridge attach and detach", () => {
  it("stops forwarding after detach and returns to defaults", () => {
    const bridge = new RoomStoryBridge();
    const onProp = vi.fn();
    bridge.attach({ onProp, label: () => "x", canLeaveInspect: () => false, overlayOpen: () => true, doorLocked: () => true });
    bridge.onProp("photo", "interact");
    bridge.detach();
    bridge.onProp("photo", "interact");
    expect(onProp).toHaveBeenCalledTimes(1);
    expect(bridge.attached).toBe(false);
    expect(bridge.label("phone")).toBeNull();
    expect(bridge.canLeaveInspect("phone")).toBe(true);
    expect(bridge.overlayOpen()).toBe(false);
    expect(bridge.doorLocked()).toBe(false);
  });

  it("detach without attach is safe and repeatable", () => {
    const bridge = new RoomStoryBridge();
    expect(() => {
      bridge.detach();
      bridge.detach();
    }).not.toThrow();
  });

  it("a later attach replaces earlier handlers (attach A, detach, attach B)", () => {
    const bridge = new RoomStoryBridge();
    const a = vi.fn();
    const b = vi.fn();
    bridge.attach({ onProp: a });
    bridge.detach();
    bridge.attach({ onProp: b });
    bridge.onProp("mug", "interact");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith("mug", "interact");

    const c = vi.fn();
    bridge.attach({ onProp: c });
    bridge.onProp("mug", "interact");
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it("keeps commands across attach and detach", () => {
    const bridge = new RoomStoryBridge();
    const commands = { chime: vi.fn() } as unknown as RoomStoryCommands;
    bridge.commands = commands;
    bridge.attach({});
    bridge.detach();
    expect(bridge.commands).toBe(commands);
    bridge.commands?.chime();
    expect(commands.chime).toHaveBeenCalledTimes(1);
    bridge.commands = null;
    expect(bridge.commands).toBeNull();
  });
});

describe("RoomStoryBridge transit events", () => {
  it("forwards Bus 06 events to the layer and ignores them when detached", () => {
    const bridge = new RoomStoryBridge();
    const onTransit = vi.fn();
    expect(() => bridge.transit({ type: "boarded", at: 0, route: "06" })).not.toThrow();
    expect(onTransit).not.toHaveBeenCalled();
    bridge.attach({ onTransit });
    bridge.transit({ type: "fare-paid", at: 60, route: "06", amount: 7000 });
    expect(onTransit).toHaveBeenCalledWith({ type: "fare-paid", at: 60, route: "06", amount: 7000 });
  });
});

describe("RoomStoryBridge story conversations", () => {
  it("forwards conversation start and returns the layer's context patch", () => {
    const bridge = new RoomStoryBridge();
    const onStoryStart = vi.fn(() => ({ flags: { interviewStarted: true } }));
    bridge.attach({ onStoryStart });
    expect(bridge.storyStart("interviewee_q5")).toEqual({ flags: { interviewStarted: true } });
    expect(onStoryStart).toHaveBeenCalledWith("interviewee_q5");
  });

  it("returns undefined when the layer has no context patch and after detach", () => {
    const bridge = new RoomStoryBridge();
    bridge.attach({ onStoryStart: () => undefined });
    expect(bridge.storyStart("minh")).toBeUndefined();
    bridge.detach();
    expect(bridge.storyStart("minh")).toBeUndefined();
  });

  it("forwards replies and returns their context patch", () => {
    const bridge = new RoomStoryBridge();
    bridge.attach({ onStoryReply: () => ({ flags: { interviewCompleted: true } }) });
    expect(bridge.storyReply("interviewee_q5", "coba_transfer_check")).toEqual({
      flags: { interviewCompleted: true },
    });
  });
});

describe("RoomStoryBridge door lock", () => {
  it("follows the attached handler and unlocks when detached", () => {
    const bridge = new RoomStoryBridge();
    let locked = true;
    bridge.attach({ doorLocked: () => locked });
    expect(bridge.doorLocked()).toBe(true);
    locked = false;
    expect(bridge.doorLocked()).toBe(false);
    locked = true;
    bridge.detach();
    expect(bridge.doorLocked()).toBe(false);
  });
});

describe("roomStoryBridge.ts import boundary", () => {
  const source = readFileSync(join(import.meta.dirname, "roomStoryBridge.ts"), "utf8");
  // Drop comments, then type-only imports (erased at build time).
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
    .replace(/\b(?:import|export)\s+type\b[^'"`;]*?\bfrom\s*(['"])[^'"]+\1;?/g, "");
  const specifiers = [
    ...[...code.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g)].map((m) => m[2]),
    ...[...code.matchAll(/\bimport\s*(['"])([^'"]+)\1/g)].map((m) => m[2]),
    ...[...code.matchAll(/\b(?:import|require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g)].map((m) => m[2]),
  ];
  const forbidden = ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei", "i18next", "react-i18next", "zustand"];

  it("has no runtime import of React, three, @react-three, i18n or zustand", () => {
    const offenders = specifiers.filter((s) => forbidden.some((pkg) => s === pkg || s.startsWith(`${pkg}/`)));
    expect(offenders).toEqual([]);
  });

  it("has no runtime import at all, and its only type import comes from roomv2 outside.ts", () => {
    expect(specifiers).toEqual([]);
    const typeImports = [...source.matchAll(/\bimport\s+type\b[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
    expect(typeImports).toEqual(["../../roomv2/game/outside"]);
  });
});
