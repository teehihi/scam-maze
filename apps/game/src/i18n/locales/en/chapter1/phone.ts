/** English source text for the `chapter1` namespace, `phone` area. Owns one top-level key group. */
const phone = {
  phone: {
    overlay: {
      name: "Phone",
      close: "Close phone",
      closeLabel: "Close",
      decidePrompt: "You can decide what to do about the call now.",
      decide: "Decide",
    },
    routes: {
      home: "Home",
      messages: "Messages",
      calls: "Calls",
    },
    home: {
      heading: "Home",
      messages: "Messages",
      calls: "Calls",
      unread_one: "{{number}} unread",
      unread_other: "{{number}} unread",
    },
    messages: {
      heading: "Messages",
      back: "Back",
      backToList: "Back to messages",
      empty: "No messages.",
      unread: "Unread",
      recorded: "Recorded in your journal",
      from: "From",
    },
    calls: {
      heading: "Calls",
      back: "Back",
      empty: "No calls yet.",
      inspectNumber: "Inspect number",
      recorded: "Recorded in your journal",
      incoming: "Incoming",
      outgoing: "Outgoing",
      status: {
        ringing: "Ringing",
        answered: "Answered",
        ended: "Answered",
        declined: "Declined",
        missed: "Missed",
      },
    },
    bank: {
      back: "Back",
    },
    incomingCall: {
      caption: "Incoming call",
      accept: "Accept",
      decline: "Decline",
    },
    call: {
      status: "Call in progress",
      hangUp: "Hang up",
      connecting: "Connected. Waiting for the caller to speak.",
      duration: "Call duration",
      mute: "Mute",
      unmute: "Unmute",
      replay: "Replay",
      listening: "Listening to the caller.",
      showReplies: "Show replies now",
      notice: {
        autoplayBlocked: "Sound is blocked by the browser. Press Replay to hear this line.",
        devPreview: "Development preview voice. This is not a recording.",
        englishVoice: "This line is spoken in English. The caption is in Vietnamese.",
        noAudio: "There is no audio for this line. Read the caption.",
      },
    },
    sound: {
      ringing: "Phone ringing",
      connected: "Call connected",
    },
    callPresentation: {
      name: "Phone call",
      screenLabel: "Phone screen",
    },
  },
};
export default phone;
