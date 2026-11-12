/** English source text for the `settings` namespace (Settings modal). */
const settings = {
  title: "Display & Audio Settings",
  subtitle: "Configure language, 3D rendering performance and sound settings",
  language: {
    /** Also the accessible name of the language radio group (aria-labelledby). */
    heading: "Language",
  },
  graphics: {
    heading: "Graphics Quality",
    quality: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    description: {
      low: "Lower resolution scale (0.75x) for smoother performance on integrated GPUs.",
      medium: "Native resolution scale (1.0x) with balanced environmental lighting.",
      high: "High-DPI rendering (up to 1.5x) with enhanced shadows and depth.",
    },
  },
  fov: {
    heading: "Field of View (FOV)",
    cinematic: "{{value}} (Cinematic)",
    default: "{{value}} (Default)",
    wide: "{{value}} (Wide)",
  },
  sound: {
    heading: "Sound & Ambience",
    enabled: "ENABLED",
    muted: "MUTED",
    masterVolume: "Master Volume",
  },
  voice: {
    heading: "Voice and comfort",
    volume: "Voice volume",
    captions: "Captions",
    phoneFilter: "Phone speaker effect",
    englishFallback: "Use the English voice when Vietnamese audio is missing",
  },
  comfort: {
    reducedStress: "Reduced-stress mode",
    reducedStressHint:
      "Softer sounds, no ring vibration and longer pauses before tense lines. The story does not change.",
    motion: {
      heading: "Reduce motion",
      system: "Follow the system",
      on: "On",
      off: "Off",
    },
  },
  toggle: {
    on: "On",
    off: "Off",
  },
};

export default settings;
