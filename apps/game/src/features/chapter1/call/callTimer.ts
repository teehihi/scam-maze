// Pure call timer format. No React, three, i18n or store imports.

/**
 * Formats whole seconds as `mm:ss` (at least two minute digits, for example 125 gives `02:05`)
 * and a matching ISO 8601 duration for `<time dateTime>`. Negative or non-finite input gives
 * `00:00`.
 */
export function formatCallDuration(totalSeconds: number): { text: string; iso: string } {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return {
    text: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    iso: `PT${minutes}M${seconds}S`,
  };
}
