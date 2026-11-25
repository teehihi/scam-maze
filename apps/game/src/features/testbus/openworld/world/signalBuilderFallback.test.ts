import * as T from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaigonRoadGraph } from "../traffic";
import { buildIntersectionSignals } from "./signalBuilder";
import { WorldStreamer } from "./WorldStreamer";

vi.mock("./trafficSignalModel", async (orig) => ({
  ...(await orig<typeof import("./trafficSignalModel")>()),
  loadTrafficSignalTemplate: vi.fn(() => Promise.reject(new Error("offline"))),
}));

describe("signal builder when the GLB cannot load", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("binds every signal immediately and fills the containers with the procedural model", async () => {
    const graph = new SaigonRoadGraph();
    const calls: { redMat: T.Material; countdown: unknown }[] = [];
    const trafficMgr = { graph, bindSignalVisual: (b: never) => calls.push(b) };
    const loaded: T.Object3D[] = [];
    const built = buildIntersectionSignals({ graph, trafficMgr: trafficMgr as never, streamer: new WorldStreamer(), solids: [], parent: new T.Group(), onAssetLoaded: (o) => loaded.push(o) });
    expect(calls).toHaveLength(built.approaches.length);
    const containers = [...built.groups.values()].flatMap((g) => g.children);
    expect(containers).toHaveLength(built.approaches.length);
    await vi.waitFor(() => expect(loaded).toHaveLength(containers.length));
    for (const c of containers) {
      expect(c.children).toHaveLength(1);
      const lensMats = new Set<unknown>();
      c.traverse((o) => {
        const m = o as T.Mesh;
        if (m.isMesh) lensMats.add(m.material);
      });
      expect(calls.some((b) => lensMats.has(b.redMat))).toBe(true);
    }
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
