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
    // `{{car}}` is the vehicle model name, kept in code and never translated.
    enterCarPrompt: "Get in the {{car}} (drive)",
    controls: {
      title: "Controls:",
      drivingTitle: "Driving Controls:",
      // Key names (W A S D, Shift, Space, E, Ctrl) stay in code; only mouse-button labels are text.
      leftClickOrF: "Left Click / F",
      rightClick: "Right Click",
      move: "Move",
      sprint: "Sprint",
      jump: "Jump",
      punch: "Punch",
      block: "Block",
      interact: "Interact / Get in car",
      inspect: "Inspect hands",
      toggleMouse: "Show/Hide mouse",
    },
    driving: {
      accelerate: "Accelerate",
      brakeReverse: "Brake / Reverse",
      steer: "Steer",
      handbrake: "Handbrake",
      exit: "Get out (when stopped)",
    },
    // `<strong>` and `<key>` wrap styled parts; keep the tags in every translation.
    walkingTip: "<strong>Mac Trackpad tip:</strong> Walk up to the door of the {{car}} and press <key>E</key> to get in and drive!",
    drivingTip: "<strong>Tip:</strong> Press <key>E</key> when the car has stopped to get out. Move the mouse to look around the cabin!",
    telemetry: {
      // `speed` and `z` are numbers already formatted by the page.
      speed: "Speed: <value>{{speed}} m/s</value>",
      speedLabel: "Speed:",
      sprint: "[SPRINT]",
      positionZ: "Position Z: <value>{{z}}m</value> (District 4 street)",
      stateGrounded: "State: On the ground",
      stateAirborne: "State: In the air",
      gearStarting: "P - STARTING...",
      engineStarting: "Engine: Starting (waiting for ignition)...",
      engineRunning: "Engine: V8 Twin-Turbo running",
    },
  },
};
export default testmove;
