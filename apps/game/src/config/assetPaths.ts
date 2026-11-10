/**
 * Public URLs of shared 3D assets. Scenes and the chapter asset manifests import these
 * constants so that both always point at the same file (and the same HTTP cache entry).
 */

/** Optimized street environment (Meshopt + WebP, produced by scripts/optimize-environment.cjs). */
export const STREET_ENVIRONMENT_GLB = "/assets/3d/optimized/MenuBG.optimized.glb";

/** Equirectangular sky texture used by the sky dome. */
export const SKY_TEXTURE = "/assets/3d/textures/sky.png";

/** Static cinematic artwork shown behind loading and chapter screens. */
export const LOADING_BACKGROUND_WEBP = "/assets/ui/loading_bg.webp";
export const LOADING_BACKGROUND_JPG = "/assets/ui/loading_bg.jpg";
