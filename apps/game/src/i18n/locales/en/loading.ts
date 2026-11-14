/** English source text for the `loading` namespace (loading screens, errors, tips, WebGL fallback). */
const loading = {
  stage: {
    starting: "Getting ready",
    "restoring-save": "Reading your saved game",
    "checking-device": "Checking your device",
    "loading-assets": "Loading chapter files",
    "initializing-state": "Setting up the chapter",
    "validating-save": "Checking your saved progress",
    ready: "Ready",
    error: "Loading failed",
  },
  menuStartup: {
    eyebrow: "Main menu",
    title: "Your street",
    subtitle: "The neighborhood is waking up.",
    startingEngine: "Starting the 3D engine",
    loadingFiles: "Loading the street scene",
    preparingScene: "Preparing the street scene",
    ready: "Ready",
  },
  // The chapter loading screen never names the chapter, so players are not told what is coming.
  newGameEyebrow: "A new story",
  newGameTitle: "Back on your street",
  newGameSubtitle: "The neighborhood is waking up.",
  continueEyebrow: "Saved game",
  continueTitle: "Continue",
  continueSubtitle: "Picking up where you left off.",
  continueToMenu: "Continue to menu",
  tipLabel: "Awareness tip",
  nextTip: "Next tip",
  progressLabel: "Loading progress",
  slowNotice: "This is taking longer than usual. You can keep waiting or reload the page.",
  // `count` selects the plural form; `completed` and `total` are numbers already formatted.
  fileCount_one: "{{completed}} of {{total}} file",
  fileCount_other: "{{completed}} of {{total}} files",
  // Shown while the player walks home from the neighborhood to the apartment.
  // Shown on the "Back on your street" screen while the neighborhood is built behind it.
  prologueStreet: {
    world: "Building the street and the houses",
    life: "Waking up the neighbors",
    optimize: "Tidying up the alley",
    props: "Setting out the banh mi cart",
    hands: "Getting ready to walk",
    shaders: "Preparing the light",
    warmup: "Almost there",
  },
  prologueHome: {
    eyebrow: "On the way home",
    title: "Back to your room",
    subtitle: "The rain is still coming down.",
    stage: {
      room: "Opening the front door",
      hands: "Warming up your hands",
      build: "Switching on the lights",
      ready: "Home",
    },
  },
  errors: {
    "invalid-chapter": {
      title: "Chapter not found",
      message: "This chapter does not exist or is not available yet. Return to the menu to choose again.",
    },
    "asset-missing": {
      title: "Game files are missing",
      message:
        "A file this chapter needs was not found on the server. Try again. If this keeps happening, the game may be updating.",
    },
    "asset-invalid": {
      title: "Game files could not be read",
      message: "A file this chapter needs was damaged or in the wrong format. Try again.",
    },
    network: {
      title: "Connection problem",
      message: "The game files could not be downloaded. Check your internet connection and try again.",
    },
    stalled: {
      title: "Loading stopped",
      message: "The download stopped responding. Check your internet connection and try again.",
    },
    "unsupported-device": {
      title: "This browser cannot show the 3D world",
      message:
        "SCAMMAZE needs WebGL 2, the browser feature that draws 3D graphics. Try a recent version of Chrome, Edge, Firefox or Safari.",
    },
    "webgl-init": {
      title: "3D graphics could not start",
      message:
        "The browser could not start 3D graphics. Turn on hardware acceleration in your browser settings, close other 3D tabs, and try again.",
    },
    "invalid-save": {
      title: "Saved game could not be loaded",
      message:
        "Your saved progress is damaged or from an older version of the game. Return to the menu and start a new game.",
    },
    unknown: {
      title: "Something went wrong",
      message: "Loading failed for an unexpected reason. Try again.",
    },
  },
  /** Awareness tips. Keys are the IDs in `config/loadingTips.ts` (`LOADING_TIP_IDS`). */
  tips: {
    otp: "Banks and delivery companies do not ask for your one-time password (OTP) by message or phone call. Never share it.",
    urgency:
      "Urgency is a pressure tactic. A real organization will still be there if you stop for five minutes to check.",
    trustedChannel:
      "Contact a company through an app or phone number you already trust, not the link or number inside the message.",
    readAddress:
      "Read the whole web address before you type anything. A small spelling change can hide a fake website.",
    payFirst: "If you must pay first to receive a prize, a job or a refund, stop and check with someone you trust.",
    switchApp: "Be careful when a stranger asks you to move the conversation to a different app.",
    familyMessage:
      "A message that sounds like a friend or family member can still be fake. Call them on a number you already know.",
    smallSteps:
      "Many scams use many small steps. Each step feels harmless, so pause and look at where the steps lead.",
  },
  webgl: {
    heading: "WebGL Acceleration Unavailable",
    body: "SCAMMAZE requires 3D WebGL 2.0 acceleration to render the first-person neighborhood environment.",
    troubleshootingTitle: "Quick Troubleshooting:",
    hardwareAcceleration: "Ensure \"Hardware Acceleration\" is enabled in your browser settings.",
    updateDriver: "Update your graphics driver or test in Chrome / Edge / Firefox / Safari.",
    // `<code>` wraps the site name; `{{site}}` is plain text, never a link.
    checkSupport: "Check if your browser supports WebGL at <code>{{site}}</code>.",
    reload: "Reload Experience",
  },
};

export default loading;
