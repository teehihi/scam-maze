/** English source text for the `menu` namespace (main menu and prologue). */
const menu = {
  nav: { label: "Game Main Menu" },
  buttons: {
    newGame: { label: "NEW GAME", sublabel: "Begin Chapter {{number}}: {{title}}" },
    continue: { label: "CONTINUE", sublabel: "Resume saved progress" },
    settings: { label: "SETTINGS", sublabel: "Graphics quality, camera FOV & audio" },
    credits: { label: "CREDITS & LICENSES", sublabel: "3D city & vehicle pack attribution" },
  },
  continueReasons: {
    none: "No saved game found.",
    invalid: "Your saved game could not be read. Start a new game instead.",
  },
  prologue: {
    title: "Prologue: An Ordinary Morning",
    subtitle: "Chapter 1 — Street & Digital Intersection",
    location: "A city street · Morning",
    heading: "The notification arrives before breakfast.",
    intro:
      "The sun is rising over the low-poly brick buildings and quiet storefronts along your street. You poured yourself a fresh cup of coffee when your smartphone buzzes with a high-priority alert:",
    alertTitle: "URGENT BANK NOTIFICATION",
    alertBody:
      "\"Account #9284 suspended due to suspicious overseas activity. Confirm your identity within 15 minutes to avoid permanent freeze.\"",
    outro:
      "Downstairs, the street is alive. Neighbors are heading to work, delivery vans are parked along the sidewalk, and the corner shop is opening up. What will you do?",
    howToPlay: {
      heading: "How to play",
      move: "Move with W, A, S and D.",
      look: "Look around with the mouse.",
      interact: "Press E to interact.",
      phone: "Press P to open the phone.",
      journal: "Press J to open the evidence journal.",
      pause: "Press Esc to pause.",
      simulation: "Everything in this chapter is a simulation.",
    },
    duration: "Playable · about 8 to 15 minutes",
    back: "Return to Menu",
    begin: "Begin Chapter {{number}}",
  },
};

export default menu;
