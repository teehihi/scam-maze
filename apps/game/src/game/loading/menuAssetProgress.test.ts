import { describe, expect, it } from "vitest";
import { createByteProgressStore, type ByteProgressEvent } from "./menuAssetProgress";
import { collectPropertyFailures, createLcg, PROPERTY_SEED, randomInt } from "../../test/loadingRuns";

/** Number of seeded cases per property for this pure store. */
const STORE_PROPERTY_RUNS = 200;

type StoreOp = { kind: "report"; event: ByteProgressEvent } | { kind: "complete" } | { kind: "reset" };

function describeOp(op: StoreOp): string {
  if (op.kind !== "report") return op.kind;
  const { loaded, total, lengthComputable } = op.event;
  return `report(${loaded}/${total}, ${lengthComputable})`;
}

/** Progress events of every shape the store must handle, including malformed ones. */
function randomEvent(next: () => number): ByteProgressEvent {
  const total = randomInt(next, 1, 30_000_000);
  // Up to 120% of total, so compressed transfers (`loaded > total`) are covered.
  const loaded = randomInt(next, 0, Math.floor(total * 1.2));
  switch (randomInt(next, 0, 7)) {
    case 0:
      return { loaded, total, lengthComputable: false };
    case 1:
      return { loaded, total: 0, lengthComputable: true };
    case 2:
      return { loaded: Number.NaN, total, lengthComputable: true };
    case 3:
      return { loaded: -loaded - 1, total, lengthComputable: true };
    case 4:
      return { loaded, total: Number.POSITIVE_INFINITY, lengthComputable: true };
    default:
      return { loaded, total, lengthComputable: true };
  }
}

/** Reference candidate percent, written independently of percentFromEvent. */
function modelCandidate(event: ByteProgressEvent): number | null {
  const { loaded, total, lengthComputable } = event;
  const known =
    lengthComputable && Number.isFinite(total) && total > 0 && Number.isFinite(loaded) && loaded >= 0;
  if (!known) return null;
  return Math.min(99, Math.max(0, Math.floor((loaded / total) * 100)));
}

/** Applies one operation to the reference model. */
function modelStep(current: number | null, op: StoreOp): number | null {
  if (op.kind === "reset") return null;
  if (op.kind === "complete") return 100;
  const candidate = modelCandidate(op.event);
  if (candidate === null) return current;
  return current === null ? candidate : Math.max(current, candidate);
}

function applyOp(store: ReturnType<typeof createByteProgressStore>, op: StoreOp): void {
  if (op.kind === "report") store.report(op.event);
  else if (op.kind === "complete") store.markComplete();
  else store.reset();
}

describe("createByteProgressStore examples", () => {
  it("starts with null", () => {
    expect(createByteProgressStore().getPercent()).toBeNull();
  });

  it("stays null while the total is unknown", () => {
    const store = createByteProgressStore();
    store.report({ loaded: 500, total: 0, lengthComputable: false });
    store.report({ loaded: 500, total: 0, lengthComputable: true });
    expect(store.getPercent()).toBeNull();
  });

  it("caps loaded > total at 99", () => {
    const store = createByteProgressStore();
    store.report({ loaded: 1500, total: 1000, lengthComputable: true });
    expect(store.getPercent()).toBe(99);
  });

  it("gives 100 on markComplete", () => {
    const store = createByteProgressStore();
    store.report({ loaded: 250, total: 1000, lengthComputable: true });
    store.markComplete();
    expect(store.getPercent()).toBe(100);
  });

  it("returns to null on reset", () => {
    const store = createByteProgressStore();
    store.report({ loaded: 250, total: 1000, lengthComputable: true });
    store.markComplete();
    store.reset();
    expect(store.getPercent()).toBeNull();
  });
});

describe("createByteProgressStore properties", () => {
  it("Feature: startup-loading-percentage, Property 1: Store matches the running-max model", async () => {
    // **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9**
    const next = createLcg(PROPERTY_SEED);
    const cases = Array.from({ length: STORE_PROPERTY_RUNS }, (_, index) => {
      const length = randomInt(next, 0, 30);
      const ops: StoreOp[] = Array.from({ length }, () => ({ kind: "report", event: randomEvent(next) }));
      // Optional Download_Complete at any position, including first and last.
      if (next() < 0.6) ops.splice(randomInt(next, 0, ops.length), 0, { kind: "complete" });
      return { id: `#${index}`, ops };
    });

    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} [${c.ops.map(describeOp).join(", ")}]`,
      async ({ ops }) => {
        const store = createByteProgressStore();
        let expected: number | null = null;
        if (store.getPercent() !== null) return `initial value ${store.getPercent()}, expected null`;
        for (let step = 0; step < ops.length; step += 1) {
          applyOp(store, ops[step]);
          expected = modelStep(expected, ops[step]);
          const actual = store.getPercent();
          if (actual !== expected) return `after step ${step} (${describeOp(ops[step])}): got ${actual}, expected ${expected}`;
        }
        return null;
      },
    );

    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("Feature: startup-loading-percentage, Property 2: One notification per change", async () => {
    // **Validates: Requirements 2.7, 2.8**
    const next = createLcg(PROPERTY_SEED ^ 0x2);
    const cases = Array.from({ length: STORE_PROPERTY_RUNS }, (_, index) => {
      const length = randomInt(next, 1, 30);
      const ops: StoreOp[] = Array.from({ length }, (): StoreOp => {
        const roll = next();
        if (roll < 0.1) return { kind: "complete" };
        if (roll < 0.2) return { kind: "reset" };
        return { kind: "report", event: randomEvent(next) };
      });
      const listenerCount = randomInt(next, 1, 3);
      // Step before which each listener unsubscribes; ops.length means it stays subscribed.
      const unsubscribeAt = Array.from({ length: listenerCount }, () => randomInt(next, 0, ops.length));
      return { id: `#${index}`, ops, unsubscribeAt };
    });

    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} unsubscribeAt=[${c.unsubscribeAt.join(", ")}] [${c.ops.map(describeOp).join(", ")}]`,
      async ({ ops, unsubscribeAt }) => {
        const store = createByteProgressStore();
        const calls = unsubscribeAt.map(() => 0);
        const expectedCalls = unsubscribeAt.map(() => 0);
        const unsubscribes = unsubscribeAt.map((_, i) => store.subscribe(() => (calls[i] += 1)));

        for (let step = 0; step < ops.length; step += 1) {
          unsubscribeAt.forEach((at, i) => {
            if (at === step) unsubscribes[i]();
          });
          const before = store.getPercent();
          applyOp(store, ops[step]);
          const changed = store.getPercent() !== before;
          unsubscribeAt.forEach((at, i) => {
            if (changed && step < at) expectedCalls[i] += 1;
          });
          for (let i = 0; i < calls.length; i += 1) {
            if (calls[i] !== expectedCalls[i]) {
              return `after step ${step} (${describeOp(ops[step])}): listener ${i} notified ${calls[i]} times, expected ${expectedCalls[i]}`;
            }
          }
        }
        return null;
      },
    );

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
