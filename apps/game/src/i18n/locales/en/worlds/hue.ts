/** English source text for the `worlds` namespace, `hue` area. Owns one top-level key group. */
// Place and monument names ("Cố Đô Huế", "Hương Giang", "Sông Hương", "Đại Hồng Chung Thiên Mụ")
// are proper nouns. They stay in code (`features/hue/placeNames.ts`) and arrive here through
// interpolation.
const hue = {
  hue: {
    loading: "Loading the {{city}} heritage world...",
    backToMenu: "Back to Main Menu",
    header: "{{city}} · HERITAGE ON THE BANKS OF THE {{river}}",
    pointer: {
      locked: "MOUSE LOCKED (Ctrl: unlock)",
      unlocked: "MOUSE UNLOCKED (Click: lock)",
    },
    lockHint: "Click the screen or press <kbd>Ctrl</kbd> to control the camera",
    bellToast: "The {{bell}} bell rings out across both banks of the {{river}}…",
    controls: {
      toggle: "Controls",
      leftMouse: "Left Mouse / F",
      rightMouse: "Right Mouse",
      move: "Move",
      sprint: "Sprint",
      jump: "Jump",
      punch: "Punch",
      block: "Block",
      interact: "Interact / Get in the car",
      viewHands: "View hands",
      ringBell: "Ring the bell",
      mouse: "Mouse",
      collision: "Collision boxes",
    },
    hud: {
      speed: "Speed:",
      position: "Position:",
    },
  },
};
export default hue;
