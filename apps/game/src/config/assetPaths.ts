/**
 * Public URLs of shared 3D assets. Scenes and the chapter asset manifests import these
 * constants so that both always point at the same file (and the same HTTP cache entry).
 */

/** Optimized street environment (Meshopt + WebP, produced by scripts/optimize-environment.cjs). */
export const STREET_ENVIRONMENT_GLB = "/assets/3d/optimized/MenuBG.optimized.glb";

/** Equirectangular sky texture used by the sky dome. */
export const SKY_TEXTURE = "/assets/3d/textures/sky.webp";

/** Static cinematic artwork shown behind loading and chapter screens. */
export const LOADING_BACKGROUND_WEBP = "/assets/ui/loading_bg.webp";
export const LOADING_BACKGROUND_JPG = "/assets/ui/loading_bg.jpg";
/** SCAMMAZE logo (1400 × 439, transparent) used on the main menu and loading screens. */
export const BRAND_LOGO_WEBP = "/assets/branding/scammaze-logo.webp";
export const BRAND_LOGO_PNG = "/assets/branding/scammaze-logo.png";

/** Call phone (Meshopt + WebP, produced by scripts/optimize-call-phone.cjs). */
export const CALL_PHONE_GLB = "/assets/3d/optimized/call-phone.optimized.glb";

/**
 * Low-poly city backdrop (Meshopt + WebP, produced by scripts/optimize-city-packs.cjs):
 * curated buildings from Low Poly City, Low Poly City Game-Ready and Low Poly City Asset Pack,
 * and the single cars of Low Poly Cars Pack.
 */
export const CITY_DISTRICT_GLB = "/assets/3d/optimized/city-district.optimized.glb";
export const CITY_CARS_GLB = "/assets/3d/optimized/city-cars.optimized.glb";

/** Base URL of the Chapter 1 voice clips: `<base>/<locale>/<nodeId>.mp3` (locale is `en` or `vi`). */
export const CHAPTER1_VOICE_BASE = "/audio/chapter01";
/**
 * Banh mi cart, battery-swap station and trash bin cut out of the street environment
 * (Meshopt + WebP, produced by scripts/extract-street-props.cjs). Used by the neighborhood world.
 */
export const STREET_PROPS_GLB = "/assets/3d/optimized/street-props.optimized.glb";
/** Base URL of the prologue voice clips: `<base>/<locale>/prologue_home<n>_<locale>.mp3` (locale is `en` or `vi`). */
export const PROLOGUE_VOICE_BASE = "/audio/prologue";
