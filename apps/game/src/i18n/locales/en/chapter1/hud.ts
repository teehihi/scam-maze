/** English source text for the `chapter1` namespace, `hud` area. Owns one top-level key group. */
const hud = {
  // Opening screen of a chapter. It never names the chapter, so the player is not told what is
  // coming. The voice is a friendly guide greeting an old acquaintance.
  intro: {
    heading: "Welcome back",
    preparing: "Walking back to the street",
    welcome: {
      p1: "Oh, there you are! It has been so long. I was starting to think you had forgotten the way back to this street.",
      p2: "Nothing has changed much. Scooters hum past, the bakery on the corner is already warm, and the neighbors still wave at you the way they always do. You belong here. Everyone knows your face.",
      p3: "So take your time today. Look around, wander wherever you like, and talk to anyone you meet. The street is yours to explore.",
      // One paragraph per voice clip (`intro/introScript.ts`). English has three clips, so its
      // script stops at p3. p4 belongs to the four-clip Vietnamese script; this English text is
      // its translation and the fallback if the Vietnamese line is missing.
      p4: "Let's go! I'll be right here with you. Take your time exploring; there is plenty waiting for you up ahead.",
    },
    resume: "Welcome back! I kept your place for you. Whenever you are ready, we can pick up right where you left off.",
    skip: "Click to show all the text",
    next: "Click for the next part",
    continue: "Click to continue",
    controls: {
      heading: "Controls",
      move: "Move",
      look: "Look around",
      interact: "Interact",
      phone: "Phone",
      journal: "Journal",
      pause: "Pause",
      mouse: "Mouse",
    },
    simulation: "Everything in this game is a simulation.",
  },
  hud: {
    phone: "Phone",
    journal: "Journal",
    // `count` selects the plural form; `number` is the same count, formatted for the locale.
    unreadMessages_one: "{{number}} unread message",
    unreadMessages_other: "{{number}} unread messages",
    newEntries_one: "{{number}} new entry",
    newEntries_other: "{{number}} new entries",
    act: {
      label: "Act {{number}}: {{title}}",
    },
    saveTrimmed: {
      message:
        "Your saved progress was updated for a new version of this chapter. It was restored to the last point that still fits.",
      dismiss: "Dismiss",
    },
  },
  objectives: {
    heading: "Objectives",
    empty: "No active objectives",
  },
  toast: {
    activated: "New objective",
    completed: "Objective complete",
  },
  notice: {
    evidenceRecorded: "New evidence recorded:",
  },
  resume: {
    prompt: "Click to resume",
  },
  saveFailure: {
    message: "Progress cannot be saved on this device.",
    dismiss: "Dismiss notice",
  },
  page: {
    announce: {
      objectiveCompleted: "Objective complete: {{objective}}",
    },
  },
};
export default hud;
