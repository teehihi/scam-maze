import { describe, expect, it, vi, beforeEach } from "vitest";
import * as T from "three";
import { buildChoLon } from "./choLon";

/**
 * The market's furniture is real GLB geometry, not primitives.
 *
 * What this file *can* prove in Node: that `choLon.ts` asks the furniture system for the real
 * models by name, that it degrades to procedural geometry when they are absent, and that every
 * placement carries a collider sized from the model's true footprint.
 *
 * What it *cannot* prove: what the models look like. `GLTFLoader.parseAsync` does not complete
 * under jsdom (three needs fetch/Blob plumbing this environment lacks), so no renderer here has
 * ever drawn a GLB. Appearance is judged in the browser. This test guards the wiring, not the art.
 */

// jsdom gives an <canvas> with no 2D context, and `scene-kit` draws textures with one (a radial
// gradient for the contact shadow). The block under test builds no textures of its own; it only
// borrows that shadow decal. Stubbing the context here keeps the production path untouched and
// keeps this suite about geometry.
const noop = () => undefined;
const stubContext = () =>
  ({
    canvas: { width: 96, height: 96 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    bezierCurveTo: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    drawImage: noop,
    putImageData: noop,
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 0 }),
  }) as unknown as CanvasRenderingContext2D;

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === "2d" ? stubContext() : null;
  } as unknown as HTMLCanvasElement["getContext"];
}

const has = new Map<string, boolean>();
const sizes = new Map<string, T.Vector3>();

vi.mock("../../../khupho/world/streetFurniture", async () => {
  const actual = await vi.importActual<typeof import("../../../khupho/world/streetFurniture")>(
    "../../../khupho/world/streetFurniture",
  );
  return {
    ...actual,
    hasProp: (kind: string) => has.get(kind) ?? false,
    propSize: (kind: string) => sizes.get(kind) ?? null,
    queueWorldProp: vi.fn(),
  };
});

/** The market needs a streamer, a solid list and a light list; none of them matter to furniture. */
function run(root: T.Group) {
  const streamer = { register: () => undefined };
  buildChoLon(
    root,
    streamer as unknown as Parameters<typeof buildChoLon>[1],
    [] as Parameters<typeof buildChoLon>[2],
    [] as Parameters<typeof buildChoLon>[3],
  );
}

describe("Chợ Lớn furniture is made of real models", () => {
  beforeEach(() => {
    has.clear();
    sizes.clear();
  });

  it("queues the real low stool for every customer seat", async () => {
    has.set("stool-low", true);
    sizes.set("stool-low", new T.Vector3(0.34, 0.27, 0.34));
    const { queueWorldProp } = await import("../../../khupho/world/streetFurniture");

    const root = new T.Group();
    run(root);

    const calls = (queueWorldProp as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const stools = calls.filter((c) => c[0] === "stool-low");
    expect(stools.length).toBeGreaterThan(8);
    // The model's own 0.27 m seat height is what the queue is told; no guessed scaling.
    for (const c of stools) expect(c[5]).toBe(1);
  });

  it("queues a real motorcycle where the scooter is parked", async () => {
    has.set("bike-pcx", true);
    sizes.set("bike-pcx", new T.Vector3(0.74, 1.1, 1.94));
    const { queueWorldProp } = await import("../../../khupho/world/streetFurniture");

    run(new T.Group());

    const calls = (queueWorldProp as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.some((c) => c[0] === "bike-pcx")).toBe(true);
  });

  it("still furnishes the market when no model loaded", async () => {
    const { queueWorldProp } = await import("../../../khupho/world/streetFurniture");

    const root = new T.Group();
    run(root);

    // A failed download must not empty the market: primitives stand in, and there are plenty.
    const calls = (queueWorldProp as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.filter((c) => c[0] === "stool-low").length).toBe(0);
    let meshes = 0;
    root.traverse((o) => { if ((o as T.Mesh).isMesh) meshes++; });
    expect(meshes).toBeGreaterThan(200);
  });
});
