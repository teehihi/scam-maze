/**
 * Remembers a phone model load failure for the page session (module lifetime) and logs
 * exactly one developer warning. Pure TypeScript: no React, three or i18n imports.
 */

let failed = false;

/** True after the phone model failed to load once in this page session. */
export function hasPhoneModelFailed(): boolean {
  return failed;
}

/** First call logs one `console.warn` containing the asset path; later calls do nothing. */
export function reportPhoneModelFailure(url: string, error: unknown): void {
  if (failed) return;
  failed = true;
  // Developer log, not user-facing text.
  console.warn(`Phone model could not be loaded: ${url}`, error);
}

/** Clears the session memory. Tests only. */
export function resetPhoneModelStatusForTests(): void {
  failed = false;
}
