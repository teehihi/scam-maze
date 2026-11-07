---
inclusion: always
---

# Icons and imagery

## Rule

**Never use emoji as icons.** This is absolute and applies everywhere in the
repository: UI components, scenario data, documentation, issue/PR templates and
commit messages. That includes bullets, status markers, decoration, buttons and
section headers (for example 🚩 ✅ ⚠ 🎃 👻 🔗 ☑).

## Allowed sources for icons

Use one of these, in this order of preference:

1. **An icon library that is already installed** in `package.json`.
   Preferred library: [`lucide-react`](https://lucide.dev). If no icon library
   is installed yet, add `lucide-react` with `pnpm add lucide-react` rather than
   introducing a different one.
2. **A PNG or SVG file chosen by the developer**, placed in `public/` or
   `src/assets/`. Do not download or invent third-party artwork without a
   license; record the source of any third-party asset.
3. **A hand-written SVG** for simple shapes, as a component in
   `src/components/icons/` (one component per icon, `currentColor` for fill or
   stroke so it follows the text color).

Simple CSS shapes (for example the square list `Marker` in
`src/components/Section.tsx`) are fine for purely decorative markers.

## Accessibility

- Decorative icons get `aria-hidden="true"` and no accessible name.
- Icons that carry meaning on their own (icon-only buttons, status) need an
  accessible name (`aria-label` or visually hidden text).
- Never rely on an icon or its color alone to convey status; pair it with text.

## Not covered by this rule

Typographic characters are text, not icons, and are allowed: `→`, `·`, `—`,
`“ ”`, `×`.
