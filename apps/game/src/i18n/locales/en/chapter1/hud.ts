/** English source text for the `chapter1` namespace, `hud` area. Owns one top-level key group. */
const hud = {
  titleCard: {
    // `number` is already formatted for the locale.
    eyebrow: "Chapter {{number}}",
    preparing: "Preparing the street",
    ready: "The street is ready",
    begin: "Begin",
    continue: "Continue",
  },
  hud: {
    phone: "Phone",
    journal: "Journal",
    // `count` selects the plural form; `number` is the same count, formatted for the locale.
    unreadMessages_one: "{{number}} unread message",
    unreadMessages_other: "{{number}} unread messages",
    newEntries_one: "{{number}} new entry",
    newEntries_other: "{{number}} new entries",
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
