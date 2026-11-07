---
inclusion: always
---

# Language

## Rule

**Everything committed to this repository is written in English.** This covers:

- all user-facing text on the website (UI copy, scenario content, URL checker
  messages, `index.html` title and meta tags),
- documentation (`README.md`, `CONTRIBUTING.md`, plans, specs in `.kiro/specs/`),
- code comments, identifiers, URL anchors / section ids,
- commit messages, branch names, pull request and issue text.

The page language is declared as `<html lang="en">`.

This rule is about repository content only. Chat replies to the team follow the
language the person is writing in.

## Localization comes later

Multi-language support (English + Vietnamese) is planned but **not started**.
Until it is explicitly requested:

- do not add Vietnamese (or any other language) strings to the UI or docs;
- do not add an i18n library or translation framework;
- keep user-facing strings in plain string literals or data objects
  (for example `src/data/scenario.ts`) so they are easy to extract later;
  avoid building sentences by concatenating fragments, because word order
  differs between languages.

## Exceptions

Detection data may contain other languages when it reflects real scam traffic,
for example Vietnamese URL keywords such as `xacminh` or `trungthuong` in
`src/lib/urlCheck.ts`. Keep these in clearly named data constants, never in UI
copy.
