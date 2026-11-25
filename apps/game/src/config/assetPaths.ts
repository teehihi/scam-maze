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
 * Typing motion for the first-person arms: finger and wrist rotations only, retargeted from a Mixamo
 * `Typing.fbx` onto the arms rig by `scripts/retarget-typing-hands.mjs` (animation-only GLB).
 */
export const TYPING_HANDS_GLB = "/assets/3d/characters/typing-hands.glb";

/**
 * Laptop keypress clips, cut from the owner-supplied Freesound recording 799122 by
 * `scripts/extract-keyboard-sfx.py`. The recording has no key labels: "space", "enter" and
 * "backspace" are the presses with the matching sound character, not recordings of those keys.
 */
export const KEYBOARD_SFX = {
  key: ["/assets/audio/keyboard/key-1.wav", "/assets/audio/keyboard/key-2.wav", "/assets/audio/keyboard/key-3.wav"],
  space: "/assets/audio/keyboard/key-space.wav",
  enter: "/assets/audio/keyboard/key-enter.wav",
  backspace: "/assets/audio/keyboard/key-backspace.wav",
} as const;

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
/**
 * Scooter with rider for the neighborhood traffic: 3 levels of detail, rigid parts, no skin
 * (Meshopt, produced by scripts/optimize-bike-rider.cjs).
 */
export const BIKE_RIDER_GLB = "/assets/3d/optimized/bike-rider.optimized.glb";
/** The reckless rider ("Bao Thu"): same layout as BIKE_RIDER_GLB (`optimize-bike-rider.cjs baothu`). */
export const BAOTHU_GLB = "/assets/3d/optimized/baothu.optimized.glb";
/**
 * Folder of the animated character models (skinned, Meshopt + WebP, produced by
 * scripts/optimize-characters.cjs). The files are listed in features/khupho/world/humans.ts.
 */
export const CHARACTERS_GLB_BASE = "/assets/3d/optimized/characters";
/**
 * Folder of the street furniture and parked vehicle models (instanced in the neighborhood,
 * produced by scripts/optimize-street-props.cjs). The files are listed in features/khupho/world/streetFurniture.ts.
 */
export const STREET_PROPS_MODELS_BASE = "/assets/3d/optimized/props";
/**
 * Mast-arm traffic signal model with role-named nodes (pole, arm, head_low, head_a, head_b and their lamps), in the
 * signal frame of world/mastArmSignal.ts. Produced by scripts/optimize-traffic-signal.cjs from assets-src/dengiaothong.glb.
 */
export const TRAFFIC_SIGNAL_GLB = `${STREET_PROPS_MODELS_BASE}/traffic-signal.optimized.glb`;
/** Base URL of the prologue voice clips: `<base>/<locale>/prologue_home<n>_<locale>.mp3` (locale is `en` or `vi`). */
export const PROLOGUE_VOICE_BASE = "/audio/prologue";
/** Base URL of Auntie Mai's street conversation clips: `<base>.<locale>/mai.<nodeId>.mp3` (locale is `en` or `vi`). */
export const MAI_VOICE_BASE = "/assets/audio/mai";
/** Base URL of the Mission 01 voice of Alex: `<base>/en/alex_<cue>_en.mp3`. Only English clips exist. */
export const MISSION01_VOICE_BASE = "/audio/mission01";
/** Base URL of Mission 02 recorded conversation lines: `<base>/<locale>/lines/<stem>.mp3`. */
export const MISSION02_VOICE_BASE = "/audio/mission02";
