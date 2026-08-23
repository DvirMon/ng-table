# Search overlay — gap analysis vs. Angular Primitives reference (Algolia DocSearch)

Reference scraped live from `https://angularprimitives.com/` (⌘K search, Algolia DocSearch default
theme) via chrome-devtools MCP on 2026-08-23. Compares against `ngpt-search-overlay` /
`ngpt-search-field` as currently built. No code changed by this doc — refactor checklist only.
Corresponding `docs/spec.md` sections already updated to the target state below; this file is the
task list to bring `search-overlay.ts/.html/.css` and `search-field.css` into line with it.

Ranked most-impactful first.

## 1. Row missing leading/trailing icons and hierarchy connector

**Current:** `.search-row` renders title + path text only, no icon markup at all
(`search-overlay.html`).

**Reference (exact DOM/SVG scraped):**
- Top-level page result: `.DocSearch-Hit-icon` — 20×20 file/doc SVG
  (`M17 6v12c0 .52-.2 1-1 1H4c-.7 0-1-.33-1-1V2c0-.55.42-1 1-1h8l5 5zM14 8h-3.13c-.51 0-.87-.34-.87-.87V4`)
- Child/heading result (`DocSearch-Hit--Child`): `.DocSearch-Hit-Tree` — 24×54 connector SVG,
  `stroke` only, no fill (`M8 6v42M20 27H8.3`), plus its own `.DocSearch-Hit-icon` — 20×20 hash
  SVG (`M13 13h4-4V8H7v5h6v4-4H7V8H3h4V3v5h6V3v5h4-4v5zm-6 0v4-4H3h4z`)
- Trailing, **every row regardless of active state** (`opacity:1`, `visibility:visible` confirmed
  on both active and inactive rows): `.DocSearch-Hit-action` — 20×20 return-arrow SVG
  (`M18 3v4c0 2-2 4-4 4H2` + `M8 17l-6-6 6-6`)

**Task:** add `result.kind: 'page' | 'heading'` (or reuse existing type field) to
`SearchResultRecord`, render the matching leading icon + tree connector conditionally, and add the
always-visible trailing action icon to `.search-row` in `search-overlay.html`. All three as
`<ng-icon>` (lucide equivalents — file icon, hash icon, corner-down-left/return icon), following
the same `provideIcons()` pattern already used for `lucideSearch`.

## 2. Active row: solid fill, not tint + left border

**Current:** `.search-row[data-active]` → `background: var(--ngpt-bg-active)` (a low-alpha tint)
+ `border-inline-start-color: var(--ngpt-accent)` (2px left accent).

**Reference:** solid fill, no left border. Scraped computed style on the active `<a>`:
`background-color: rgb(255, 70, 81)` = `--docsearch-highlight-color` (`#FF4651`), full-bleed,
`border-radius: 4px`, no left-border accent anywhere in the ruleset.

**Task:** open decision — see `docs/decisions.md` § "Active row: solid accent fill (open)". No
existing token in `src/styles/tokens/` covers "solid on-accent row fill" with matching
"text-on-accent" color; needs either a new pair of tokens or confirmation that `--ngpt-accent`
itself is meant to run at full opacity here (current usage elsewhere is text-only, per
`decisions.md`'s "Query match highlight" note in the old spec — check contrast before shipping,
title text must recolor to something AA-safe against a solid accent fill, not assumed white).

## 3. Border-radius: split panel/row values, not flat

**Current:** panel uses `--ngpt-sys-shape-corner-medium` (needs value audit — spec previously
said 12px), rows use `--ngpt-sys-shape-corner-extra-small-alt` (previously documented as 6px).

**Reference (scraped computed `border-radius`):**
| Element | Value |
|---|---|
| `.DocSearch-Modal` (panel) | 6px |
| `.DocSearch-Form` (input row) | 4px |
| `.DocSearch-Hit a` (row, active and inactive) | 4px |

**Task:** `docs/spec.md` now specs panel = 6px, row = 4px (see spec diff). Confirm
`--ngpt-sys-shape-corner-small` resolves to 6px and `--ngpt-sys-shape-corner-extra-small` resolves
to 4px in `src/styles/tokens/`; if not, this is a foundations-token value question, not a
component one — flag back rather than hardcoding.

## 4. Footer hints: real SVG glyphs per key, not shared text `<kbd>`

**Current:** `<kbd ngptKbd>↑↓</kbd>`, `<kbd ngptKbd>↵</kbd>`, `<kbd ngptKbd>esc</kbd>` — literal
Unicode/text content, one shared `Kbd` wrapper.

**Reference:** each footer key is `<kbd class="DocSearch-Commands-Key">` wrapping a **distinct**
15×15 hand-drawn SVG (not text) — separate glyphs for Enter, Arrow-down, Arrow-up, and Escape (4
SVGs total, not 3 — up/down are two separate icons, not one combined `↑↓` glyph). Full paths
captured in the chat transcript scrape; re-fetch via the same chrome-devtools call if needed.

**Task:** `Kbd` component (`kbd.ts`/`.html`) currently only projects `<ng-content>` — needs either
an icon-only render mode or the footer switches to composing `<kbd ngptKbd><ng-icon .../></kbd>`
per key. Update `docs/decisions.md` § Icons (currently says kbd glyphs are "literal text/Unicode
… not icons" — that decision is superseded by this gap, needs its own follow-up entry, not a
silent edit, since it was a deliberate call at build time).

## 5. Result list capped at 5, not scroll-to-fit

**Current:** `resultGroups`/`flatResults` render unbounded, `.search-results` scrolls within
`--ngpt-comp-search-panel-max-height` (60vh).

**Reference:** confirmed via live query ("combobox") — exactly 5 `<li>` under
`#docsearch-list`, hard cap, not "scroll after N". DocSearch's own `hitsPerPage` config default.

**Task:** cap `flatResults` (or the render loop) at 5 per section. `docs/spec.md`'s "Max visible"
row updated accordingly — scroll behavior for >5 results needs a decision (truncate silently vs.
"N more results" affordance — DocSearch just truncates, no affordance).

## 6. Search field focus ring should highlight the icon, not the whole control

**Current:** `:host(:focus-visible) { box-shadow: 0 0 0 2px var(--ngpt-focus-ring); }` — rings the
entire button.

**Reference:** not independently scraped from DocSearch (its trigger is app-specific, not a
generic pattern) — this item comes from direct user review of the two screenshots, not the live
scrape. Kept as a gap per that review: full-control ring reads heavier than intended; only the
leading search icon should recolor/highlight on focus.

**Task:** move the focus treatment from `:host(:focus-visible)` box-shadow to a `color` change on
the icon (e.g. `:host(:focus-visible) ng-icon { color: var(--ngpt-accent); }`), drop the
box-shadow ring. Needs a decision on whether this satisfies WCAG 2.4.7 (focus visible) on its own
— an icon-color-only change is a weaker focus indicator than a ring; flag for a11y sign-off before
landing, don't ship silently.

## Already checked, confirmed no gap

- **Hover/keyboard shared active state** — live-tested: real mouse hover moves `aria-selected`
  immediately with no dual-highlight window; matches our single `activeResultIndex` signal driving
  both `setActiveById` (mouseenter) and `moveActive` (arrow keys). No change needed.
- **Arrow-key wraparound** — live-tested: `ArrowUp` from the first row jumps straight to the last
  row. Matches our `wrapIndex()`. No change needed.
- **Focus-trap / Escape / scrim-click** — not part of this round's visual gaps, unchanged.
