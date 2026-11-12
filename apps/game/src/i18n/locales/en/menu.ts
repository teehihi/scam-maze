/** English source text for the `menu` namespace (main menu). */
const menu = {
  nav: { label: "Game Main Menu" },
  /** Line under the logo. Deliberately names no chapter, so the start is not spoiled. */
  kicker: "A first-person story about scams",
  hints: { navigate: "Select", select: "Confirm" },
  buttons: {
    newGame: { label: "NEW GAME", sublabel: "Start a new story" },
    continue: { label: "CONTINUE", sublabel: "Resume saved progress" },
    settings: { label: "SETTINGS", sublabel: "Graphics quality, camera FOV & audio" },
    credits: { label: "CREDITS & LICENSES", sublabel: "3D city & vehicle pack attribution" },
  },
  continueReasons: {
    none: "No saved game found.",
    invalid: "Your saved game could not be read. Start a new game instead.",
  },
};

export default menu;
