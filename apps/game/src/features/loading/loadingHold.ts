/**
 * Minimum display times for the loading screens. Presentation-only: they never advance
 * progress or decide whether loading succeeded. Kept in this dependency-free module so tests
 * can import the values without loading React, Three.js or Drei. The loading components
 * re-export them.
 */

/** Minimum time the chapter loading screen stays visible, even when the load is instant. */
export const CHAPTER_LOADING_MIN_DISPLAY_MS = 1500;

/** Minimum time the startup screen stays visible, so a fast (cached) load does not flash. */
export const STARTUP_LOADING_MIN_DISPLAY_MS = 1200;
