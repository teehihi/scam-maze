# Accessibility

Scams target everyone, including people who use a keyboard, a screen reader, a
small phone or reduced motion. SCAMMAZE aims to be usable by all of them.

## Our target

We aim for **[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA** on the landing
page and on every playable scenario. This is a goal, not a certified claim: the
site has **not yet been formally audited**.

## What is in place today

- Semantic landmarks (`header`, `nav`, `main`, `footer`) and one `h1` per page.
- Page language declared (`lang="en"`).
- Visible keyboard focus ring on every interactive element.
- All game choices and the URL checker are native `button` / `input` elements,
  usable with keyboard only.
- Results of the game and of the URL checker are announced through
  `aria-live` regions.
- A "skip to main content" link is the first focusable element.
- The URL input has a visible label.
- No emoji or icon fonts; list markers are decorative shapes hidden from
  assistive technology (`aria-hidden`).
- Text color pairs are chosen for at least 4.5:1 contrast (calculated from the
  design tokens in `src/index.css`, not yet measured on the live site).
- No decorative animation; smooth scrolling and transitions are disabled when
  the user prefers reduced motion.
- Status is never shown by color alone: each warning also has text.
- Responsive layout from small phones to desktop.

## Chapter 1 voice, captions and comfort settings

These features belong to the game (`apps/game`). They are set in the Settings
modal, under "Voice and comfort", and stored with the other settings. Voice,
captions and sound never change the game state, the evidence, the decisions or
the outcome. The chapter is fully playable with sound off.

- **Captions.** Every spoken line is also shown as text on the phone screen.
  The "Captions" setting is on by default. If you turn it off, the caption still
  appears whenever the line is not audible (muted, sound off, volume 0, blocked
  by the browser, or no audio for that line), so no line is ever silent and
  invisible. Caption changes are announced through a polite `aria-live` region.
- **Mute.** The phone screen has a Mute / Unmute button. It is a real button
  with `aria-pressed` and a text label that changes with the state. Mute applies
  to the call voice only, and it is reset to "not muted" when a new call starts.
  Master sound, sound volume and voice volume are separate settings.
- **Replay.** The phone screen has a Replay button that plays the current line
  again. It is disabled when there is nothing to play (sound off, volume 0, or
  no clip and no preview voice).
- **Notices.** A short text notice explains when sound is blocked by the
  browser, when a line is a development preview voice (not a recording), when a
  line is spoken in English while the caption is in Vietnamese, and when a line
  has no audio. Notices are in a polite `aria-live` region.
- **Reduced-stress mode.** Off by default. When on, the ringtone and the tension
  sound are quieter, and tense lines (impatient and pressuring tones) get a
  longer pause before them. The story does not change. In the code, this setting
  affects sound and pauses only; it does not change motion (use "Reduce motion"
  for that).
- **Reduce motion: Follow the system / On / Off.** "Follow the system" (the
  default) uses the operating system "reduce motion" setting. "On" always
  reduces motion. "Off" never reduces motion, even if the system asks for it.
  For the 3D phone call, reduced motion removes the slide-in and the ringing
  vibration.
- **Keyboard flow for a call.** The call is a modal dialog. Focus starts on
  "Accept" while the phone rings, on the first reply while replies are shown,
  and on "Hang up" when there are no replies. Tab moves between the call
  buttons. Arrow Down and Arrow Up move between replies and wrap around. Home
  and End jump to the first and last reply. Keys 1 to 9 choose the reply at that
  position (they are ignored with Alt, Ctrl or Meta, while typing in a field,
  while the game is paused, and while replies are held back). Escape does not
  close an active call; use "Hang up".
- **Choice gate ("Show replies now").** On some lines the replies appear only
  after the caller has finished speaking, so you can listen first. The gate is
  only used while the voice is audible. While it waits, a status message says
  "Listening to the caller." and the "Show replies now" button is the focused
  element, so keyboard users can skip the wait at once. Activating it shows the
  replies and moves focus to the first reply. The wait also ends by itself a
  short time after the clip ends, after the clip length plus 1.5 seconds, or at
  once if the audio is muted, blocked, missing or failed. Playback ending never
  chooses a reply for you.

### Not verified for the voice features

Automated tests cover the logic of these features. They do not prove the
following, and no one has checked them yet:

- Screen reader behavior (NVDA, VoiceOver, TalkBack). The `aria-live` regions,
  the dialog focus handling and the "Show replies now" focus moves have not
  been tested with a screen reader, so we do not know how often or how clearly
  they are announced.
- Sound quality: loudness balance, how clear the voices are, the phone speaker
  effect, the ringtone and the tension sound.
- Playback of the MP3 voice clips in real browsers, including autoplay rules on
  each browser and device.
- Known gap: on the 2D fallback phone screen, the ringing icon wobble follows
  the operating system "reduce motion" setting only, not the in-game "Reduce
  motion" setting. Choose "On" in the game and also check your system setting if
  you want to avoid it there.
- The Settings text for reduced-stress mode mentions "no ring vibration". The
  code that turns off the 3D ring vibration is controlled by "Reduce motion",
  not by reduced-stress mode.

## Supported environments

Tested goal: recent versions of Chrome, Edge, Firefox and Safari on desktop,
and Chrome on Android / Safari on iOS.

## Known limitations

- No automated audit (axe, Lighthouse) or screen-reader testing (NVDA,
  VoiceOver, TalkBack) has been run yet.
- The landing page is English only. The game interface is available in English
  and Vietnamese.

## Report a barrier

If something blocks you, please
[open an issue with the `accessibility` label](https://github.com/teehihi/scam-maze/issues/new?labels=accessibility&template=bug_report.yml).
Tell us the page, what you tried, your browser and any assistive technology.
We treat accessibility barriers as bugs, not feature requests.
