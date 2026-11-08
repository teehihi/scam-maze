/**
 * Single source of truth for where "ENTER THE GAME" leads.
 *
 * The game is a separate application with its own deployment URL. No custom
 * domain has been purchased; names such as play.scammaze.com are examples
 * only. This marketing site never hardcodes the URL. Set VITE_GAME_URL at build
 * time once a game build is deployed.
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
