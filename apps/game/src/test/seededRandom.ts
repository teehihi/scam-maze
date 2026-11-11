/**
 * Seeded random helpers for property tests. No property-based testing library is installed, so
 * cases come from a small fixed-seed linear congruential generator (LCG). The same seed always
 * yields the same sequence, so a failing case can be reproduced from its printed values.
 *
 * This module has no imports, so pure core tests (for example game/narrative) can use it without
 * pulling in React or Testing Library.
 */

/** Numerical Recipes LCG. Returns numbers in [0, 1). */
export function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Integer in [min, max] (both inclusive) from an LCG produced by createLcg. */
export function randomInt(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

/** One element of a non-empty list, chosen by an LCG produced by createLcg. */
export function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}
