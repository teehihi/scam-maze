/**
 * FNV-1a 32-bit hash of the UTF-8 bytes of `text`, as 8 lowercase hex digits.
 * Pure and deterministic. Used to detect a clip made from an outdated line.
 */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
