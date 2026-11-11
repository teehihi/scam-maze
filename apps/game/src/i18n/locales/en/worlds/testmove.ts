/** English source text for the `worlds` namespace, `testmove` area. Owns one top-level key group. */
const testmove = {
  testmove: {
    loadingMap: "Loading the 3D street map...",
    backToMenu: "Back to Main Menu",
    mouseLocked: "MOUSE LOCKED (Ctrl: unlock)",
    mouseUnlocked: "MOUSE UNLOCKED (Click: lock)",
    lockPrompt: {
      title: "3D Movement Test Mode",
      // `<kbd>` wraps the key name; keep the tag in every translation.
      body: "Click the screen or press <kbd>Ctrl</kbd> to lock the mouse and look around.",
      start: "Start Controls",
    },
    controls: {
      title: "Controls:",
      // Key names (W A S D, Shift, Space, E, Ctrl) stay in code; only mouse-button labels are text.
      leftClickOrF: "Left Click / F",
      rightClick: "Right Click",
      move: "Move",
      sprint: "Sprint",
      jump: "Jump",
      punch: "Punch",
      block: "Block",
      interact: "Interact",
      inspect: "Inspect hands",
      toggleMouse: "Show/Hide mouse",
    },
    // `<strong>` and `<key>` wrap styled parts; keep the tags in every translation.
    trackpadTip:
      "<strong>Mac Trackpad tip:</strong> Swipe with one finger to move the camera smoothly, and press <key>F</key> to punch without tapping the trackpad hard!",
    telemetry: {
      // `speed` and `z` are numbers already formatted by the page.
      speed: "Speed: <value>{{speed}} m/s</value>",
      sprint: "[SPRINT]",
      positionZ: "Position Z: <value>{{z}}m</value> (District 4 street)",
      stateGrounded: "State: On the ground",
      stateAirborne: "State: In the air",
    },
  },
};
export default testmove;
