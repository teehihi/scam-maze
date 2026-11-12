/** English source text for the `worlds` namespace, `ueh` area. Owns one top-level key group. */
// Track titles ("Mùa Hạ Thứ 18", "Nếu Ngày Mai") and "UEH" are proper nouns. They stay in code
// and arrive here through `{{title}}`.
const ueh = {
  ueh: {
    backToMenu: "Back to Main Menu",
    header: {
      campus: "UEH CAMPUS",
      muaHa: "{{title}} (RAIN SHOWER)",
      ngayMai: "{{title}} (FLYING FLAME TREE BLOSSOMS)",
    },
    pointer: {
      locked: "MOUSE LOCKED (Ctrl: unlock)",
      unlocked: "MOUSE UNLOCKED (Click: lock)",
    },
    seat: {
      sitDown: "Sit down",
      standUp: "Stand up",
    },
    guitar: {
      title: "Strum the Guitar · Change the Melody",
      switchTo: "Switch to: <strong>{{track}}</strong>",
      nextMuaHa: "{{title}} (Summer rain)",
      nextNgayMai: "{{title}} (Flying flame tree blossoms)",
    },
    lockPrompt: {
      title: "Explore the UEH Campus",
      body: "Click the screen or press <kbd>Ctrl</kbd> to lock the mouse and control the camera.",
      start: "Start Controlling",
    },
    controls: {
      heading: "CONTROLS:",
      leftMouse: "Left Mouse / F",
      rightMouse: "Right Mouse",
      move: "Move",
      sprint: "Sprint",
      jump: "Jump",
      punch: "Punch",
      block: "Block",
      interact: "Interact (Guitar / Sit)",
      viewHands: "View hands",
      toggleCursor: "Hide / Show cursor",
      togglePanels: "Hide / Show panels",
      tip: "Walk to the stone bench under the flame tree and press <strong>E</strong> to strum the guitar and change the melody / weather.",
    },
    hud: {
      speed: "Speed:",
      position: "Position:",
      grounded: "Schoolyard ground",
      airborne: "Jumping",
    },
    toast: {
      muaHa: "Now playing: {{title}} — Summer rain drifts gently over the UEH schoolyard",
      ngayMai: "Now playing: {{title}} — Red flame tree blossoms fill the UEH afternoon wind",
    },
  },
};

export default ueh;
