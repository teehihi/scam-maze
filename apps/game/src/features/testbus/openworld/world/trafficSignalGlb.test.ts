import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO, type Document, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { LENS_PUSH } from "./trafficSignalModel";
import { beforeAll, describe, expect, it } from "vitest";

const FILE = resolve(__dirname, "../../../../../public/assets/3d/optimized/props/traffic-signal.optimized.glb");
const TRIANGLE_BUDGET = 30_000;
const TOTAL_HEIGHT = 6.6;
const HEADS = ["head_low", "head_a", "head_b"] as const;
const COLOURS = ["red", "amber", "green"] as const;

let doc: Document;
const find = (name: string): Node => {
  const node = doc.getRoot().listNodes().find((n) => n.getName() === name);
  if (!node) throw new Error(`node ${name} missing`);
  return node;
};

/** Bounding box of a node's mesh in the model frame (the node chain only translates or scales). */
function box(node: Node) {
  const m = node.getWorldMatrix();
  const pos = node.getMesh()!.listPrimitives()[0].getAttribute("POSITION")!;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], v = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v);
    const w = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
  }
  return { min, max, centre: min.map((a, k) => (a + max[k]) / 2) };
}

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  doc = await io.readBinary(new Uint8Array(readFileSync(FILE)));
  await doc.transform(dequantize());
});

describe("traffic-signal.optimized.glb", () => {
  it("has every role node", () => {
    for (const name of ["pole", "arm", ...HEADS, ...HEADS.map((h) => `${h}_body`), ...HEADS.flatMap((h) => COLOURS.map((c) => `${h}_${c}`)), "head_a_countdown", "head_b_countdown"]) {
      expect(() => find(name), name).not.toThrow();
    }
    expect(doc.getRoot().listNodes().find((n) => n.getName() === "head_low_countdown")).toBeUndefined();
  });

  it("stays within the triangle and size budget", () => {
    const triangles = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + p.getIndices()!.getCount() / 3, 0), 0);
    expect(triangles).toBeLessThanOrEqual(TRIANGLE_BUDGET);
    expect(statSync(FILE).size).toBeLessThan(1_572_864);
  });

  it("is 6.6 m tall with the pole axis on x = z = 0 and the base on y = 0", () => {
    const pole = box(find("pole"));
    expect(pole.min[1]).toBeCloseTo(0, 1);
    expect(pole.max[1]).toBeCloseTo(TOTAL_HEIGHT, 1);
    const arm = box(find("arm"));
    expect(Math.abs(pole.centre[0])).toBeLessThan(1.5);
    expect(arm.min[1]).toBeGreaterThan(5);
    expect(arm.max[1]).toBeLessThan(TOTAL_HEIGHT);
  });

  it("runs the arm along +X and hangs the heads from it", () => {
    const arm = box(find("arm"));
    const length = find("arm").getExtras().length as number;
    expect(arm.max[0]).toBeGreaterThan(5);
    expect(arm.min[0]).toBeGreaterThanOrEqual(-0.5);
    expect(length).toBeCloseTo(arm.max[0], 1);
    const a = find("head_a").getTranslation(), b = find("head_b").getTranslation();
    expect(a[0]).toBeGreaterThan(0);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(b[0]).toBeLessThanOrEqual(length);
    // The overhead heads hang from the arm, the low head is mounted on the pole.
    expect(find("head_low").getTranslation()[1]).toBeLessThan(a[1]);
  });

  it("faces the lenses and countdown boxes toward -Z", () => {
    for (const head of HEADS) {
      const body = box(find(`${head}_body`));
      for (const colour of COLOURS) expect(box(find(`${head}_${colour}`)).centre[2], `${head}_${colour}`).toBeLessThan(body.centre[2]);
      const lensY = COLOURS.map((c) => box(find(`${head}_${c}`)).centre[1]);
      expect(lensY[0]).toBeGreaterThan(lensY[1]);
      expect(lensY[1]).toBeGreaterThan(lensY[2]);
    }
    for (const head of ["head_a", "head_b"]) {
      const extras = find(`${head}_countdown`).getExtras() as { faceCenter: number[]; faceSize: number[] };
      const countdown = box(find(`${head}_countdown`));
      expect(extras.faceSize[0]).toBeGreaterThan(0.3);
      expect(extras.faceSize[1]).toBeGreaterThan(0.3);
      const parent = find(head).getTranslation();
      expect(extras.faceCenter[2] + parent[2]).toBeCloseTo(countdown.min[2], 2);
    }
  });

  it("leaves no housing face in front of any lens once the runtime pushes the lenses forward", () => {
    for (const head of HEADS) {
      const bodyNode = find(`${head}_body`);
      const m = bodyNode.getWorldMatrix();
      const pos = bodyNode.getMesh()!.listPrimitives()[0].getAttribute("POSITION")!;
      const idx = bodyNode.getMesh()!.listPrimitives()[0].getIndices()!;
      const world = (i: number) => {
        const v = [0, 0, 0];
        pos.getElement(i, v);
        return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
      };
      const tris: number[][][] = [];
      for (let t = 0; t < idx.getCount(); t += 3) tris.push([world(idx.getScalar(t)), world(idx.getScalar(t + 1)), world(idx.getScalar(t + 2))]);
      for (const colour of COLOURS) {
        const lens = box(find(`${head}_${colour}`));
        const [cx, cy] = lens.centre;
        // Frontmost (most negative z) housing surface over the lens centre.
        let face = Infinity;
        for (const [A, B, C] of tris) {
          const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
          if (Math.abs(d) < 1e-12) continue;
          const l1 = ((B[1] - C[1]) * (cx - C[0]) + (C[0] - B[0]) * (cy - C[1])) / d;
          const l2 = ((C[1] - A[1]) * (cx - C[0]) + (A[0] - C[0]) * (cy - C[1])) / d;
          if (l1 < 0 || l2 < 0 || 1 - l1 - l2 < 0) continue;
          face = Math.min(face, l1 * A[2] + l2 * B[2] + (1 - l1 - l2) * C[2]);
        }
        expect(lens.min[2] - LENS_PUSH, `${head}_${colour} lens front vs housing face`).toBeLessThan(face - 0.01);
      }
    }
  });
});
