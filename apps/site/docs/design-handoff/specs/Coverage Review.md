---
id: coverage
kind: meta
atomic: —
spec: specs/Coverage Review.md
frame: null
owns:
  - "The record of what was reviewed, decided, deferred, and why"
does_not_own:
  - "Any build instruction — this file is history, not spec"
depends_on: []
states: []
a11y: []
tokens: [--ngpt-bg-deep, --ngpt-status-, --ngpt-bg-active, --ngpt-bg-hover, --ngpt-comp-tab-item-active-bg, --ngpt-text-primary, --ngpt-focus-ring]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Coverage Review — can we replicate the site?

Developer review of all 24 spec files + 13 components, 2026-08-19.

## Verdict

**Yes for the static page, no for a working site.** Anything visible in a screenshot is buildable today: the 3-column grid, navbar, sidebar (incl. mobile drawer), TOC, footers, and all 13 atoms/molecules have box models, colors, and states. What's missing is almost entirely *stateful* — surfaces that only exist after a click, and behavior tokens.

Two systemic holes behind the individual gaps:

1. **No overlay/popover foundation.** Four separate specs imply a floating surface (dropdown menu, ⌘K search, select listbox, mobile drawer overlay) and none defines one. Drawer overlay z-index is the only floating value written down anywhere.
2. **No behavior tokens.** Every component lists hover colors; none lists a transition. Same for scroll, focus order, and reduced motion.

## Decided in review

| # | Gap | Decision |
| --- | --- | --- |
| 1 | Interactive data table UI (sort/filter/select/paginate/resize) | **Out of scope.** Docs chrome only; demo tables inherit library styling. |
| 2 | Preview Window interactive states | **Spec all three:** Source panel, open dropdown menu, copy confirmation. |
| 3 | Search | **Spec both surfaces as one:** navbar search field that opens a ⌘K overlay. |
| 4 | Motion | **Full foundation:** duration + easing tokens, per-pattern table (hover, drawer, overlay, tab, scroll), `prefers-reduced-motion`. |
| 5 | Code syntax highlighting | **Shiki at build time, used as shipped.** Container stays ours (`--ngpt-bg-deep`, border, radius); syntax colors are Shiki's built-in dark theme — the one deliberate exception to the palette. Chrome: line-number gutter (CSS counter) + Shiki meta line highlighting. Copy button lives in the Preview Window toolbar, not in the block. |
| 6 | Docs content patterns | **In:** callouts (note/warning/tip), H3/H4 + nested TOC, list & blockquote styling, heading anchor links. **Out:** version selector, light-theme toggle, breadcrumbs, edit-this-page meta. |

## Spec backlog — closed 2026-08-19

New files, all written:

- `specs/foundations/Motion.md` — 3 durations, 3 easings, per-pattern table, exits-run-faster rule, reduced-motion.
- `specs/Dropdown Menu.md` — surface, option rows, hover/focus/selected/disabled, full keyboard + ARIA. Serves both the "Example CSS" pill and Select Trigger.
- `specs/Search.md` — navbar field (a button, not an input) + ⌘K overlay, grouped results, empty/no-match states, footer legend, focus trap.
- `specs/Callout.md` — note (neutral) / warning (hue 85) / tip (hue 150), extending `--ngpt-status-*` into surface tints.
- `specs/Content Prose.md` — H3/H4, trailing heading anchors, lists, blockquote, shared 72px scroll offset.

The planned `Elevation and Overlays.md` was **folded into the existing `foundations/Radius and Elevation.md`** instead — that file already owned elevation, so a second file would have split one concern across two. It now carries the z-index scale, the scrim, and the floating-surface recipe.

Amendments, all applied:

- `Code Block.md` — Shiki ownership boundary, line-number gutter, highlighted-line treatment.
- `Preview Window.md` — Source tab panel, dropdown-open and copy-confirm toolbar states, tabpanel ARIA.
- `Top Navbar.md` — search slot; the mobile open question is now answered with a per-breakpoint table.
- `TOC Column.md` — nested H3 items, scroll-spy rule with its edge cases.
- `Icon Button.md` — copy confirmation variant (glyph swap, 1400ms hold, live region).
- `Iconography.md` — `lucideSearch`, `lucideCheck`, `lucideInfo`, `lucideTriangleAlert`, `lucideLightbulb`.

## Decisions worth knowing about

Three judgment calls made while writing, in case you want them reversed:

1. **Hover inside floating surfaces uses `--ngpt-bg-active` (0.24), not `--ngpt-bg-hover` (0.20).** Menus sit at 0.20, so the hover token is invisible on them. This is the only place a hover state borrows the active token.
2. **Callout "note" is neutral, not accent-tinted.** Accent (hue 60) already means link/active/identifier; a note in that hue reads as interactive.
3. **Copy and tab-switch give no toast and no height animation.** In-place glyph swap and an opacity crossfade — a toast needs its own overlay layer for one word, and a height tween on every tab click is worse than an instant jump.

## Confirmed constraints

- **Dark-only.** No light theme, no theme toggle. Every token is a single value; nothing needs a light counterpart.

## Still open

- **Focus order / skip link** — closed 2026-08-21, `foundations/Focus and Keyboard.md`.
- **Sidebar and TOC scroll independence** — closed 2026-08-21: both sticky at the scroll offset with
  their own overflow scroll.
- ~~Code block wrap vs. horizontal scroll on mobile~~ **resolved 2026-08-21:** always horizontal scroll, never wrap — wrapping breaks indentation. Container is focusable. Owned by `Code Block.md`.
- **404 / empty page.** No spec.
- ~~Token collisions~~ **resolved 2026-08-19:** `--ngpt-bg-hover` is now `oklch(0.2 0.005 260)` everywhere (the nav item's 0.21 folded in); `--ngpt-bg-active` stays 0.24, and Tab Switcher's 0.30 moved to its own `--ngpt-comp-tab-item-active-bg` since 0.24 gives no lift against that control's 0.22 track.
- ~~Color.md CSS syntax errors~~ **fixed** — `--ngpt-text-primary` and `--ngpt-focus-ring` are now valid; the block is copy-pasteable.
