---
inclusion: always
---

# Language

## Rule

**Repository content is written in English.** This covers:

- documentation (`README.md`, `CONTRIBUTING.md`, plans, specs in `.kiro/specs/`),
- code, code comments, identifiers, URL anchors / section ids,
- commit messages, branch names, pull request and issue text,
- the source text of all user-facing strings (English is the source language).

This rule is about repository content only. Chat replies to the team follow the
language the person is writing in.

## Localization of the game (`apps/game`)

Localization has started for the game. It supports two locales: English (`en`)
is the source and the fallback, and Vietnamese (`vi`) is the second locale.

- **UI text** lives in the Locale_Dictionaries in
  `apps/game/src/i18n/locales/{en,vi}/**`, loaded through `i18next` and
  `react-i18next`. Write the English text first in `locales/en/`; the
  Vietnamese files are typed against the English ones. A key that is missing in
  Vietnamese falls back to English.
- **Chapter 1 narrative** stays authored in English in the scenario data. The
  Vietnamese text lives in the narrative overlay
  (`apps/game/src/i18n/narrative/chapter1.vi.ts` and the parts in
  `apps/game/src/i18n/narrative/chapter1.vi/`), keyed by stable content IDs.
  The overlay is display-only: it never changes IDs, rules, evidence, decisions,
  outcomes or game state. Missing overlay text falls back to English.
- Do not hard-code user-facing text in game components; add a translation key
  in both locales instead.
- The game sets `<html lang>` at runtime to match the selected locale. The
  `index.html` title and meta tags stay English.
- Do not add any other language until it is explicitly requested.

## Landing app (`apps/landing`)

The landing app stays **English-only** until localization is explicitly
requested for it:

- do not add Vietnamese (or any other language) strings to the landing app;
- do not add an i18n library to the landing app;
- keep its user-facing strings in plain string literals or data objects so
  they are easy to extract later;
- its page language is declared as `<html lang="en">`.

## No string concatenation

Never build user-facing sentences by concatenating fragments, because word
order differs between languages. Use one complete string per sentence, with
interpolation variables (for example `{{name}}`) for the parts that change.

## Exceptions

Detection data may contain other languages when it reflects real scam traffic,
for example Vietnamese URL keywords such as `xacminh` or `trungthuong` in
`apps/landing/src/lib/urlCheck.ts`. Keep these in clearly named data constants,
never in UI copy.
