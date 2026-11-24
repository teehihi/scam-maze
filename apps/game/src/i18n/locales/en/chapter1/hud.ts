/** English source text for the `chapter1` namespace, `hud` area. Owns one top-level key group. */
const hud = {
  // Opening screen of a chapter. It never names the chapter, so the player is not told what is
  // coming. The voice is a friendly guide greeting an old acquaintance.
  intro: {
    heading: "Welcome back",
    preparing: "Getting the room ready",
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
    // Opening of "LAST SUBMISSION: 72 GIỜ CUỐI". Facts come from the design brief; no voice clips yet.
    last: {
      p1: "You are Alex, {{age}} years old, an international student in your final year in Ho Chi Minh City. Your thesis is {{progress}}% done.",
      p2: "You have {{hours}} hours left. You must finish the research, get your supervisor's signature, and submit the final version by Friday at 17:00.",
      p3: "Money is tight, your dorm term is ending, and you have no steady job yet. Offers of help will arrive. You decide what to check, what to trust, and what to skip.",
    },
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
      schedule: "Schedule",
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
    settings: "Settings",
    // Task icon on the map: opens the schedule (missions and events).
    tasks: "Tasks",
    // Chapter HUD: the status ring around the map, the clock and cash (evidence is not shown).
    status: {
      label: "Status",
      clock: "Time",
      timeLeft: "{{time}} left to submit the thesis",
      thesisShort: "Thesis {{value}}%",
      cash: "Cash",
      cashUnit: "VND",
      security: "Digital security",
      securityHint: "How safe your email, bank and other accounts are. Giving away a login or a code lowers it.",
      support: "Support network",
      supportHint: "The people and offices who would help you: Minh, your supervisor, the school.",
      fatigue: "Fatigue",
      fatigueHint: "The more tired you are, the longer thesis work takes. Sleep or a short break lowers it.",
      fatigueValue: "{{level}}, {{value}}%",
      fatigueLevel: { rested: "Rested", tired: "Tired", exhausted: "Exhausted" },
      percent: "{{value}}%",
      weekday: {
        "1": "Monday",
        "2": "Tuesday",
        "3": "Wednesday",
        "4": "Thursday",
        "5": "Friday",
        "6": "Saturday",
        "7": "Sunday",
      },
    },
    act: {
      label: "Act {{number}}: {{title}}",
    },
    saveTrimmed: {
      message:
        "Your saved progress was updated for a new version of this chapter. It was restored to the last point that still fits.",
      dismiss: "Dismiss",
    },
  },
  // Schedule: events that wait for an answer, goals and deadlines, and thesis work. No scoring.
  planner: {
    heading: "Schedule",
    chip: "Schedule",
    close: "Close",
    pendingCount_one: "{{number}} event waiting",
    pendingCount_other: "{{number}} events waiting",
    arrival: "New: {{title}}",
    dismiss: "Dismiss",
    eventsHeading: "Waiting for you",
    noEvents: "Nothing is waiting for an answer.",
    missionsHeading: "Goals and deadlines",
    noMissions: "No active goals yet.",
    optional: "Optional",
    due: "Due in {{time}}",
    expires: "Expires in {{time}}",
    noDeadline: "No deadline",
    postponed_one: "Postponed {{number}} time",
    postponed_other: "Postponed {{number}} times",
    responseWithCost: "{{label}} ({{time}})",
    duration: {
      hoursMinutes: "{{hours}} h {{minutes}} min",
      hours: "{{hours}} h",
      minutes: "{{minutes}} min",
    },
    channel: {
      message: "Message",
      call: "Call",
      email: "Email",
      visit: "Visit",
      notification: "Notification",
    },
    thesis: {
      heading: "Thesis",
      progress: "Progress: {{value}}%",
      session: "Each session takes {{time}} and adds {{percent}}%. Other deadlines keep running.",
      work: "Work for {{time}}",
      complete: "The thesis is complete.",
      timeUp: "There is no time left.",
      limit: "Free work stops at {{percent}}%. More progress comes from thesis tasks.",
      tasksHeading: "Thesis tasks",
      noTasks: "No thesis tasks yet.",
      fatigueNote: {
        rested: "You are rested. Thesis work runs at its normal pace.",
        tired: "You are tired. Thesis work takes {{percent}}% longer.",
        exhausted: "You are exhausted. Thesis work takes {{percent}}% longer.",
      },
      restHeading: "Rest",
      restHint: "Resting takes time. Other deadlines keep running.",
      nap: "Take a short break ({{time}}, a little less tired)",
      sleep: "Sleep ({{time}})",
      taskCost: "{{label}} ({{time}}, +{{percent}}%)",
      taskGain: "{{label}} (+{{percent}}%)",
      blocked: {
        done: "Done",
        locked: "Not available now",
        complete: "The thesis is complete",
        time: "No time left",
      },
    },
  },
  // Task system: the tracker under the map, the marker over the prop and the task list (key T).
  taskSystem: {
    heading: "Task",
    newTask: "New task",
    complete: "Complete",
    optional: "Optional",
    where: {
      laptop: "Laptop",
      phone: "Phone",
    },
    distance: "{{meters}} m",
    due: "Due in {{time}}",
    openList: "Open the task list",
    markerLabel: "Task target: {{place}}",
    list: {
      title: "Tasks",
      close: "Close the task list",
      inProgress: "In progress",
      completed: "Completed",
      failed: "Missed",
      empty: "No tasks yet.",
      track: "Track",
      tracking: "Tracking",
      current: "Current step",
      done: "Done",
    },
    announce: {
      newStep: "New task: {{step}}",
      stepDone: "Task complete: {{step}}",
    },
  },
  objectives: {
    heading: "Objectives",
    card: "Objective",
    doneLabel: "Completed:",
    empty: "No active objectives",
  },
  toast: {
    activated: "New objective",
    completed: "Objective complete",
  },
  notice: {
    evidenceRecorded: "New evidence recorded:",
    newEvidence: "New evidence",
    addedToJournal: "Added to the Journal",
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
