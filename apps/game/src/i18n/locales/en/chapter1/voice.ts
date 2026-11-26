/**
 * English source text for the `chapter1` namespace, `voice` area: the captions of Alex's Mission 01
 * and Mission 02 voice lines. Each text is the transcript of the clip with the same cue
 * (`alex_<cue>_en.mp3`, Mission 02: `alex_m02_<stem>_en.mp3`), line for line. Owns the `voice` key group.
 */
const voice = {
  voice: {
    alex: {
      intro:
        "Seventy-two hours.\n" +
        "That's all I have left.\n" +
        "Three days to finish my thesis, get my professor's approval, and submit everything before Friday at five.\n" +
        "I've been working on this for months.\n" +
        "And somehow, I'm still not ready.\n" +
        "My savings are almost gone. I have to move out of the dorm soon. And I still haven't figured out what I'm going to do after graduation.\n" +
        "I thought the hardest part would be writing the thesis.\n" +
        "Maybe I was wrong.\n" +
        "Anyway...\n" +
        "It's Tuesday. Five in the afternoon.\n" +
        "I should get back to work.",
      thesisStart: "Okay. One section at a time. I can do this.",
      emailReceived: "Graduation clearance? Wait... Is something wrong with my submission account?",
      emailSuspicious: "I don't remember the university mentioning this fee. But what if it's real?",
      verify: "I should check the university portal first. Better to hear it from them directly.",
      securityBreach: "What? I didn't authorize that transaction.\nOkay... I need to contact the bank. Right now.",
      easyMoney: "That much money for a few simple tasks?\nSounds convenient.\nMaybe a little too convenient.",
      investment: "If those returns are real, that could solve a lot of my problems.\nBut... how does this actually work?",
      exhausted: "I keep reading the same paragraph over and over.\nI really need some rest.",
      overnight: "I missed the deadline for the draft.\nGuess I'm not getting much sleep tonight.",
      // --- Mission 02 "THE RIDE" (cues in `features/chapter1/voice/mission02AlexVoice.ts`) ---
      m02Briefed: "Chapter 3 is done, but Section 3.3 still has a gap.\nI need Cô Ba's answer: how shopkeepers spot a fake transfer receipt.",
      m02Open: "Eleven o'clock. Cô Ba is at half past eleven, in Chợ Lớn.\nMy last interview. I can't be late for this one.",
      m02Prepare: "Main entrance of the market office, not the alley.\nI should decide how I'm getting there before I go.",
      m02DriverOffer: "Sixty thousand, cash, and he'll stop wherever I say.\nNo app, no trip record... Nobody would know where I went.",
      m02RouteChecked: "Seven thousand, three stops, and the route is on record.\nSlower, maybe. But I know exactly where it ends.",
      m02Confirmed: "Main entrance, market side. And she's expecting me.\nGood thing I called the number I already had.",
      m02OnBus: "Fare paid, and it's on the record.\nThirty-four minutes to Chợ Lớn. Time to go over my questions.",
      m02WrongStop: "This isn't the market office.\nThree blocks short, and now he wants thirty thousand more?",
      m02Arrived: "Made it. Chợ Lớn.\nMain entrance, not the alley. Let's find Cô Ba.",
      m02ArrivedLate: "It's after twelve thirty. I missed the slot.\nShe waited for me. The least I can do is go and apologize.",
      m02Rescheduled: "She's still willing to do it.\nI'm not wasting this second chance.",
      m02LeftWithout: "I came all the way to Chợ Lớn, and I'm leaving with nothing.\nChapter three is going to have a gap.",
      m02InterviewDone: "Check it yourself, in your own account. That's the quote my chapter needed.\nBack to the draft. Friday isn't moving.",
      m02Failed: "Two o'clock. No interview.\nNow I have to explain to my supervisor why chapter three is missing a source.",
    },
  },
};
export default voice;
