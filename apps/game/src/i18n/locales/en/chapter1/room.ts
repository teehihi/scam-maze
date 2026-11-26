/** English source text for the `chapter1` namespace, `room` area. Owns one top-level key group. */
const room = {
  room: {
    laptop: {
      badge: {
        new: "New",
        opened: "Opened",
      },
      headline: {
        new: "Security alert: unusual account activity",
        opened: "Security alert: opened",
      },
    },
    // Captions while looking at a device or the wall calendar in "LAST SUBMISSION: 72 GIỜ CUỐI".
    inspect: {
      phone: "Your phone. Messages, calls, the bank and your calendar are here.",
      laptop: "Your laptop. Mail, the bank, your calendar and your thesis files are here.",
      calendar: "The wall calendar. The final deadline is Friday, 17:00.",
    },
    prompt: {
      phoneRinging: "Answer the call",
      phoneDecline: "Decline the call",
      phoneRecords: "Open the phone records",
      laptopUse: "Use the laptop",
      doorLocked: "The door is locked for now.",
      doorBusy: "Finish what you are doing first.",
    },
    records: {
      heading: "Phone records",
      dialogLabel: "Phone records",
      close: "Close the phone records",
      tabs: {
        calls: "Calls",
        messages: "Messages",
        voicemail: "Voicemail",
      },
      calls: {
        heading: "Call history",
        empty: "No calls yet.",
        incoming: "Incoming",
        outgoing: "Outgoing",
        missed: "Missed",
        declined: "Declined",
        answered: "Answered",
        row: "{{name}} · {{number}} · {{time}}",
        detailsHeading: "Call details",
        detailsOpen: "Open the call details",
        callerIdLabel: "Number shown",
        durationLabel: "Duration",
        summaryLabel: "Call summary",
      },
      messages: {
        heading: "Messages",
        empty: "No messages.",
        unread: "Unread",
      },
      voicemail: {
        heading: "Voicemail",
        empty: "No voicemail.",
        summary: "Voicemail",
        recordOpen: "Open the record of the first call",
      },
      back: "Back",
      callSaved: {
        called: "You called the saved contact.",
        label: "Call the saved contact",
        unavailable: "No saved contact is available yet.",
        hint: "This calls the number you saved before tonight.",
      },
      numbersPlain: "Numbers are shown as plain text.",
    },
    incomingCall: {
      ringing: "{{name}} is calling",
      missed: "Missed call from {{name}}. You can call back from Calls.",
    },
    progressSaved: "Draft saved · thesis {{percent}}%",
    objectiveToast: {
      new: "New objective: {{objective}}",
      done: "Objective complete: {{objective}}",
      hintLabel: "Hint",
    },
    hints: {
      heading: "Hint",
      show: "Show a hint",
      hide: "Hide the hint",
      none: "No hint is available right now.",
      answerOrDecline: "A call is coming in. You can answer it or decline it.",
      checkLaptop: "Something new may have reached your laptop.",
      investigate: "Look at the note, the receipts, the calendar, the phone records and the laptop.",
      answerRecovery: "Another call may come in. You can answer or decline it.",
      decide: "When you are ready, open the decision panel and choose what to do.",
      review: "Read the debrief to see how the events connect.",
    },
    ending: {
      transitionLabel: "Chapter ending",
      transitionLine: "The room is quiet again.",
      continue: "See what happened",
      skip: "Skip",
      simulation: "This was a simulation.",
    },
    status: {
      overlayOpen: "An overlay is open. Press Escape to close it.",
      callActive: "A call is in progress.",
    },
    announce: {
      notification: "A new security alert reached your laptop.",
      evidence: "New evidence recorded: {{title}}",
      deduction: "Deduction recorded: {{statement}}",
    },
    hud: {
      hintPanelLabel: "Hint for the current objective",
      mouseKeyHint: "Use the mouse",
      mouseLockedHint: "Press Ctrl to use the mouse.",
      controlsLabel: "Movement controls",
      moveHint: "Move",
      lookHint: "Look around",
    },
    call: {
      moreReplies: "More replies are below. Scroll or use the arrow keys.",
      toolsLabel: "Call tools",
      notes: "Notes",
      notesLabel: "Open your notes. The call keeps going.",
    },
  },
};
export default room;
