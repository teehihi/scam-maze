# Accessibility

Scams target everyone, including people who use a keyboard, a screen reader, a
small phone or reduced motion. SCAMMAZE aims to be usable by all of them.

## Our target

We aim for **[WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA** on the landing
page and on every playable scenario. This is a goal, not a certified claim: the
site has **not yet been formally audited**.

## What is in place today

- Semantic landmarks (`header`, `nav`, `main`, `footer`) and one `h1` per page.
- Page language declared (`lang="vi"`).
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

## Supported environments

Tested goal: recent versions of Chrome, Edge, Firefox and Safari on desktop,
and Chrome on Android / Safari on iOS.

## Known limitations

- No automated audit (axe, Lighthouse) or screen-reader testing (NVDA,
  VoiceOver, TalkBack) has been run yet.
- Content is currently Vietnamese only; English is planned.

## Report a barrier

If something blocks you, please
[open an issue with the `accessibility` label](https://github.com/teehihi/scam-maze/issues/new?labels=accessibility&template=bug_report.yml).
Tell us the page, what you tried, your browser and any assistive technology.
We treat accessibility barriers as bugs, not feature requests.
