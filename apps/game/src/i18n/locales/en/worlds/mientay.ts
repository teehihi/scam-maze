/** English source text for the `worlds` namespace, `mientay` area. Owns one top-level key group. */
// Place names ("Sông Nước Cửu Long", "Sông Hậu", the zones and quick-travel spots) are proper
// nouns. They stay in code (`features/mientay/placeNames.ts`, `engine/bookmarks.ts`) and arrive
// here through interpolation where a sentence needs them.
const mientay = {
  mientay: {
    loading: {
      title: "Entering the {{region}}",
      hint: "The delta is built once on this visit, so it can run smoothly afterwards.",
      stages: {
        renderer: "Starting the 3D engine",
        materials: "Weathering wood, brick and plaster",
        terrain: "Shaping the river banks",
        water: "Filling the river",
        flora: "Planting palms, orchards and reeds",
        boats: "Mooring the floating market",
        village: "Raising the stilt houses",
        mansion: "Building the heritage house",
        shrine: "Raising the Khmer pagoda",
        bridges: "Laying bridges and footpaths",
        optimize: "Tidying the scene",
        pipeline: "Setting up light and shadow",
        shaders: "Warming up the graphics",
      },
    },
    backToMenu: "Back to Main Menu",
    header: "{{region}} · MEKONG DELTA",
    pointer: {
      locked: "MOUSE LOCKED (Ctrl: unlock)",
      unlocked: "MOUSE UNLOCKED (Click: lock)",
    },
    lockHint: "Click the screen or press <kbd>Ctrl</kbd> to control the camera",
    mode: {
      label: "Way of travelling",
      walk: "On foot",
      boat: "Paddle (B)",
      fly: "Fly (V)",
    },
    boardPrompt: "Press <kbd>B</kbd> to step into the sampan and drift along the river",
    audio: {
      on: "Sound: on",
      off: "Sound",
      title: "River ambience",
    },
    performance: {
      on: "Graphics: light",
      off: "Graphics: full",
      title: "Switch between full graphics and the lighter mode",
    },
    hud: {
      hide: "Hide interface (H)",
      show: "Show interface (H)",
      fps: "{{fps}} FPS",
    },
    time: {
      label: "Time of day",
      dawn: "Dawn",
      noon: "Midday",
      dusk: "Dusk",
      night: "Firefly night",
    },
    places: {
      label: "Places to visit",
      subtitles: {
        "ben-do": "The river junction and the floating market boats",
        "cho-noi": "Drifting between the produce boats",
        "xom-nha-san": "Plank bridges, hammock stalls and life along the creek",
        "nha-co": "Three-entrance gate, brick courtyard and yin-yang roof tiles",
        "chua-khmer": "Tiered main hall and the Naga statues",
        "cau-khi-vuon": "Coconut creek, bamboo bridge and orchard gardens",
      },
    },
    zones: {
      label: "Location",
    },
    controls: {
      toggle: "Controls",
      move: "Move",
      sprint: "Sprint / paddle fast",
      jump: "Jump",
      punch: "Punch",
      block: "Block",
      boat: "Board or leave the sampan",
      fly: "Fly",
      mouse: "Mouse",
      leftMouse: "Left Mouse",
      rightMouse: "Right Mouse",
      hideHud: "Hide the interface",
    },
    stats: {
      speed: "Speed:",
      position: "Position:",
    },
  },
};

export default mientay;
