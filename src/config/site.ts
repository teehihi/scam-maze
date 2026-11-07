/**
 * Single source of truth for where "ENTER THE GAME" leads.
 *
 * The game is a separate application that will be deployed on its own domain
 * (planned: https://play.scammaze.com). This marketing site never hardcodes
 * that domain. Set VITE_GAME_URL at build time once the game is live.
 *
 * - Unset or invalid: visitors see the "world is being prepared" entry state.
 * - Valid http(s) URL: every entry button becomes a plain link to that URL.
 */

export const REPO_URL = "https://github.com/teehihi/scam-maze";

function parseGameUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const url = new URL(raw.trim());
    // Only web destinations: rejects javascript:, data:, etc.
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Absolute URL of the game application, or null while it is not available. */
export const GAME_URL: string | null = parseGameUrl(import.meta.env.VITE_GAME_URL);

export const isGameAvailable = GAME_URL !== null;
