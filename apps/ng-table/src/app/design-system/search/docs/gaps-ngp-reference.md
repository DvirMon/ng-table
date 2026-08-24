# Search overlay — gap analysis vs. Angular Primitives reference (Algolia DocSearch)

Reference scraped live from `https://angularprimitives.com/` (⌘K search, Algolia DocSearch default
theme) via chrome-devtools MCP on 2026-08-23. Compares against `ngpt-search-overlay` /
`ngpt-search-field` as currently built. No code changed by this doc — refactor checklist only.
Corresponding `docs/spec.md` sections already updated to the target state below; this file is the
task list to bring `search-overlay.ts/.html/.css` and `search-field.css` into line with it.

Ranked most-impactful first. **Struck-through items are implemented** — kept for the scrape
evidence trail, not for action. Unstruck items are still open.

## Full internal composition of a result row — box-model map (reference)

Deep-dive requested to fully understand the `<li>` internals before implementing items 18/20/21.
Live-scraped full computed box model (display/position/box-sizing/dimensions/margin/padding/
border-radius/flex) for every element in the active row and an idle child (heading) row, plus a
real-pointer hover test. This corrects two earlier entries below (item 1, item 18/21) — see the
"Corrections" callouts under each.

```
ul#docsearch-list                         display:block, width:536px, height:300px (5×60), NO padding/margin/gap
└─ li.DocSearch-Hit                       display:flex, position:relative, width:536, height:60
                                           padding: 0 0 4px 0   ← THE 4px LIVES HERE, on the <li>, not a gap/margin
                                           border-radius: 4px (redundant with <a>'s own radius below)
   └─ a (no href shown to bots, real href in practice)
                                           display:block, width:536 (full li width), height:56 (=60-4)
                                           padding: 0 0 0 12px  (left-inset only)
                                           border-radius: 4px   ← this is where bg/box-shadow actually paint
      └─ div.DocSearch-Hit-Container      display:flex, align-items:center, width:524 (536-12), height:56
                                           padding: 0 12px 0 0  (right gutter, spacing before the action icon)
         ├─ svg.DocSearch-Hit-Tree        (child/heading rows only) width:24, height:56 — spans FULL row height
         ├─ div.DocSearch-Hit-icon        20×20, display:block
         │  └─ svg                        20×20, overflow:hidden
         ├─ div.DocSearch-Hit-content-wrapper
         │                                display:flex, flex-direction:column, justify-content:center,
         │                                flex:1 1 auto, margin: 0 8px (gutter both sides)
         │                                width 454px (page rows, title only) or 430px (child rows, title+path
         │                                — narrower because the tree SVG + its own icon eat 24+20+8 more px)
         │  ├─ span.DocSearch-Hit-title   display:block, ~16.8px line height
         │  └─ span.DocSearch-Hit-path    (child rows only) display:block, ~16.8px, sits below title via the
         │                                 parent's flex-column + justify-content:center
         └─ div.DocSearch-Hit-action      display:flex, align-items:center, width:22, height:22 (item 12)
            └─ svg                        width:18, height:18 — 2px inset within its 22px box
                                           **display:none when the row is idle, display:block only when
                                           active/hovered** — see correction below
```

**Correction to item 1 (already marked done):** item 1's original claim — "trailing action icon,
every row regardless of active state (`opacity:1`, `visibility:visible` confirmed on both active
and inactive rows)" — was wrong. That check inspected the 22×22 **wrapper div**, which does stay
in the DOM at fixed size on every row (so there's no layout shift when it appears/disappears).
The **inner `<svg>`** itself is `display: none` on idle rows and `display: block` only on the
active/hovered row — live-confirmed via a real pointer hover (not synthetic), toggling correctly
between rows as hover moved. So the trailing arrow icon should only be *visible* on the
active row, not present-but-transparent on every row as item 1's fix currently implements. Needs
a follow-up fix: keep the wrapper's fixed 22×22 box on every row (so nothing shifts), but only
render/show the arrow icon inside it when `[data-active]`/`:hover` — e.g. `.search-row__action {
visibility: hidden; }` + `.search-row:hover .search-row__action, .search-row[data-active]
.search-row__action { visibility: visible; }` (using `visibility`, not `display`, keeps the
22×22 box space reserved either way — matches the reference's own fixed-wrapper-plus-hidden-svg
approach without needing a conditional `@if` that could shift layout).

**Correction to items 18/21 (row spacing):** the real mechanism is now clear, and it's a
**two-box trick, not padding alone**. `<li>` elements touch each other with zero space between
(no `<ul>` gap, no `<li>` margin) — but the `<li>` itself paints **no background**. The `<a>`
nested inside it (the element that actually paints background/shadow/radius) is only 56px tall
inside the 60px `<li>`. So the `<li>`'s `padding-bottom: 4px` is empty, unpainted space — it
shows through as a real visible gap precisely *because* the painted box (`<a>`) is shorter than
its unpainted parent (`<li>`) and doesn't stretch to fill the padding. Padding on the *same*
element that paints a background never creates a visible gap (it's rendered *behind*, filling the
padding too) — this only works as a two-box split.

**Task, matching this structure exactly (depends on item 20's `<li>` wrapper landing first):**
- `<li>` (or its Angular equivalent, the row's outer element once item 20 introduces one): no
  background, `padding-bottom: var(--ngpt-sys-space-100)` (4px), `height`/`min-height` un-set
  (grows to content + padding).
- The inner painted element — `.search-row`, still carrying `background`, `border-radius`,
  `box-shadow` (items 2/19), explicit `min-height: var(--ngpt-comp-search-input-height)` (item
  15, 56px) — stays a fixed height *shorter* than its `<li>` parent, exactly like the reference's
  `<a>` inside `<li>`.
- `.search-results`'s `gap` goes to `0` (item 18) — the 4px no longer comes from a flex gap at
  all, it comes from this padding/two-box structure instead.

This is the same reason a plain `margin-bottom` on a single painted box would have been a simpler
fix but wouldn't match the reference's actual DOM shape — matching the structure means the outer
wrapper and inner painted row have to be two separate elements, not one element with padding.

**Both corrections implemented 2026-08-23.** `search-result-row.html`/`.css` and
`search-recent-row.html`/`.css`: `:host` (`<li>`) reduced to `display: block; width: 100%;
padding-block-end: var(--ngpt-sys-space-100);` — no paint. Existing row content wrapped in a new
`<span class="search-row__surface">`, which now carries every painted property (`display: flex`,
`background`, `border-radius`, `box-shadow`, `min-height`) that used to live on `:host`.
`[data-active]` selectors retargeted from `:host([data-active])` to `:host([data-active])
.search-row__surface`. `.search-row__action` (the trailing return-arrow, result rows only) gained
`visibility: hidden` at rest and `visibility: visible` under `:host([data-active])` — fixed-size
wrapper stays reserved, icon itself only shows on the active/hovered row now, matching the
live-confirmed reference behavior. `npx nx run ng-table:build` passes clean.

## ~~1. Row missing leading/trailing icons and hierarchy connector — done 2026-08-23~~

~~**Current:** `.search-row` renders title + path text only, no icon markup at all
(`search-overlay.html`).~~

~~**Reference (exact DOM/SVG scraped):**
- Top-level page result: `.DocSearch-Hit-icon` — 20×20 file/doc SVG
  (`M17 6v12c0 .52-.2 1-1 1H4c-.7 0-1-.33-1-1V2c0-.55.42-1 1-1h8l5 5zM14 8h-3.13c-.51 0-.87-.34-.87-.87V4`)
- Child/heading result (`DocSearch-Hit--Child`): `.DocSearch-Hit-Tree` — 24×54 connector SVG,
  `stroke` only, no fill (`M8 6v42M20 27H8.3`), plus its own `.DocSearch-Hit-icon` — 20×20 hash
  SVG (`M13 13h4-4V8H7v5h6v4-4H7V8H3h4V3v5h6V3v5h4-4v5zm-6 0v4-4H3h4z`)
- Trailing, **every row regardless of active state** (`opacity:1`, `visibility:visible` confirmed
  on both active and inactive rows): `.DocSearch-Hit-action` — 20×20 return-arrow SVG
  (`M18 3v4c0 2-2 4-4 4H2` + `M8 17l-6-6 6-6`)~~

~~**Task:** add `result.kind: 'page' | 'heading'` (or reuse existing type field) to
`SearchResultRecord`, render the matching leading icon + tree connector conditionally, and add the
always-visible trailing action icon to `.search-row` in `search-overlay.html`. All three as
`<ng-icon>` (lucide equivalents — file icon, hash icon, corner-down-left/return icon), following
the same `provideIcons()` pattern already used for `lucideSearch`.~~

## ~~2. Active row: solid fill, not tint + left border — done 2026-08-23~~

~~**Current:** `.search-row[data-active]` → `background: var(--ngpt-bg-active)` (a low-alpha tint)
+ `border-inline-start-color: var(--ngpt-accent)` (2px left accent).~~

~~**Reference:** solid fill, no left border. Scraped computed style on the active `<a>`:
`background-color: rgb(255, 70, 81)` = `--docsearch-highlight-color` (`#FF4651`), full-bleed,
`border-radius: 4px`, no left-border accent anywhere in the ruleset.~~

~~**Task:** open decision — see `docs/decisions.md` § "Active row: solid accent fill (open)". No
existing token in `src/styles/tokens/` covers "solid on-accent row fill" with matching
"text-on-accent" color; needs either a new pair of tokens or confirmation that `--ngpt-accent`
itself is meant to run at full opacity here (current usage elsewhere is text-only, per
`decisions.md`'s "Query match highlight" note in the old spec — check contrast before shipping,
title text must recolor to something AA-safe against a solid accent fill, not assumed white).~~

## ~~3. Border-radius: split panel/row values, not flat — done 2026-08-23~~

~~**Current:** panel uses `--ngpt-sys-shape-corner-medium` (needs value audit — spec previously
said 12px), rows use `--ngpt-sys-shape-corner-extra-small-alt` (previously documented as 6px).~~

~~**Reference (scraped computed `border-radius`):**
| Element | Value |
|---|---|
| `.DocSearch-Modal` (panel) | 6px |
| `.DocSearch-Form` (input row) | 4px |
| `.DocSearch-Hit a` (row, active and inactive) | 4px |~~

~~**Task:** `docs/spec.md` now specs panel = 6px, row = 4px (see spec diff). Confirm
`--ngpt-sys-shape-corner-small` resolves to 6px and `--ngpt-sys-shape-corner-extra-small` resolves
to 4px in `src/styles/tokens/`; if not, this is a foundations-token value question, not a
component one — flag back rather than hardcoding.~~

## ~~4. Footer hints: real SVG glyphs per key, not shared text `<kbd>` — done 2026-08-23~~

~~**Current:** `<kbd ngptKbd>↑↓</kbd>`, `<kbd ngptKbd>↵</kbd>`, `<kbd ngptKbd>esc</kbd>` — literal
Unicode/text content, one shared `Kbd` wrapper.~~

~~**Reference:** each footer key is `<kbd class="DocSearch-Commands-Key">` wrapping a **distinct**
15×15 hand-drawn SVG (not text) — separate glyphs for Enter, Arrow-down, Arrow-up, and Escape (4
SVGs total, not 3 — up/down are two separate icons, not one combined `↑↓` glyph). Full paths
captured in the chat transcript scrape; re-fetch via the same chrome-devtools call if needed.~~

~~**Task:** `Kbd` component (`kbd.ts`/`.html`) currently only projects `<ng-content>` — needs either
an icon-only render mode or the footer switches to composing `<kbd ngptKbd><ng-icon .../></kbd>`
per key. Update `docs/decisions.md` § Icons (currently says kbd glyphs are "literal text/Unicode
… not icons" — that decision is superseded by this gap, needs its own follow-up entry, not a
silent edit, since it was a deliberate call at build time).~~

## ~~5. Result list capped at 5, not scroll-to-fit — done 2026-08-23 (unblocked by mock index fixture, see decisions.md)~~

~~**Current:** `resultGroups`/`flatResults` render unbounded, `.search-results` scrolls within
`--ngpt-comp-search-panel-max-height` (60vh).~~

~~**Reference:** confirmed via live query ("combobox") — exactly 5 `<li>` under
`#docsearch-list`, hard cap, not "scroll after N". DocSearch's own `hitsPerPage` config default.~~

~~**Task:** cap `flatResults` (or the render loop) at 5 per section. `docs/spec.md`'s "Max visible"
row updated accordingly — scroll behavior for >5 results needs a decision (truncate silently vs.
"N more results" affordance — DocSearch just truncates, no affordance).~~

## 6. Search field focus ring should highlight the icon, not the whole control — REOPENED 2026-08-23

~~**Current:** `:host(:focus-visible) { box-shadow: 0 0 0 2px var(--ngpt-focus-ring); }` — rings the
entire button.~~

**Correction from deeper scrape:** item 6/7's "icon recolors on focus, no ring" fix was based on
inference from the two reviewed screenshots, not verified against the live reference. Just tested
live on `angularprimitives.com`: toggling `.blur()`/`.focus()` on `.DocSearch-Input` produces
**zero visible change** anywhere — `.DocSearch-Form`'s box-shadow, border, and the search icon's
color are all bit-for-bit identical blurred vs. focused. The reference's overlay input has **no
focus treatment at all**. Also tested the nav's own "Search (Command+K)" trigger button the same
way — same result, no visible ring/shadow/color change on focus in computed styles (though this
specific test method via scripted `.focus()` may not reliably trigger `:focus-visible` the way a
real Tab keypress does — flagged as lower-confidence than the input test, which used the same
method and is corroborated by the input row's own CSS having no focus rule at all).

**Task — re-evaluate before implementing:** the original user ask (screenshot review) said the
field's full-outline ring reads too heavy and only the icon should react. That's still a
reasonable design opinion independent of what DocSearch does. But "the reference does this" is
**not** the justification anymore — it doesn't. Needs a call: keep the icon-only-color fix as our
own choice (drop the "matches reference" framing), or revert to a conventional focus ring on the
trigger button, consistent with every other focusable control in this DS. Either way, the
`decisions.md` entry for this item needs its "why" corrected — it currently doesn't claim scrape
backing, so no correction needed there, but the a11y-sign-off flag stands regardless of the final
call.

## ~~7. Overlay's own search input focus treatment — CLOSED, was a false gap — reverted 2026-08-23~~

~~`search-field.css` (navbar trigger button) got the icon-focus fix in item 6. The **overlay's**
`.search-input` (`search-overlay.html`, once the panel is open) is a separate element with no
`:focus`/`:focus-visible` rule anywhere in `search-overlay.css` — not a box-shadow ring, not an
icon-color change, nothing.~~

**Correction:** this was never actually a gap. Confirmed live — the reference's overlay input has
no focus indicator by design (the whole panel already reads as "the focused surface" the moment it
opens). Our **original** spec line ("No border or ring on the input itself — the panel is already
the focused surface") was correct before this pass touched it. The `:focus-within` icon-color rule
added to `search-overlay.css` under this item should be **reverted** — it was solving a gap that
doesn't exist in the reference.

## ~~8. Input row's trailing X is a static Escape hint, not a functional clear button — done 2026-08-23~~

~~**Current:** `search-overlay.html:30` — `<kbd ngptKbd><ng-icon name="lucideX" /></kbd>`, always
rendered regardless of query state, non-interactive (a `<kbd>`, not a `<button>`), no hover state.
This is the Escape-key hint chip (per item 4's resolution, which reused the X glyph for "esc"),
not a clear-query control.~~

~~**Reference:** `.DocSearch-Reset` — a real `<button type="reset" title="Clear the query"
aria-label="Clear the query">`, X icon, sibling to the input inside the `<form>`. Only meaningful
while there's a query to clear; DocSearch toggles it via its own state, not CSS-only. Has normal
button affordances (`cursor: pointer`, hover state) — confirmed by element role, not yet by
scraping its exact hover computed-style.~~

~~**Task:** add a real `<button type="button" class="search-input-row__clear" [hidden]="!hasQuery()">`
(or `@if (hasQuery())`) next to `.search-input`, wired to reset `query`/`activeResultIndex` and
refocus the input (same pattern as `selectRecent()` already does). Needs `cursor: pointer` +
`:hover` background per normal icon-button convention. The Escape-hint kbd chip (item 4) is a
separate, independent element — kept both, didn't collapse them into one.~~

Resolved via the existing `IconButton` (`../icon-button/icon-button`, attribute-hosted, no icon
registry of its own) rather than a bespoke button — see `docs/decisions.md`.

## 9. Input isn't a flat full-width row — reference wraps it in its own inset "well" — done 2026-08-23

**Current:** `.search-input-row` is a flat, full-width row inside the panel, no border/radius of
its own, separated from the results below by a single `border-bottom`.

**Reference (measured):** `.DocSearch-Form` is a distinct box, inset 12px from the panel edges on
all sides (`.DocSearch-SearchBar` header has `padding: 12px 12px 0`), with its **own**
`border-radius: 4px`, its **own** lighter background (`lab(15.7...)`, panel itself is
`lab(8.3...)` — visibly lighter than the panel, not the same surface), and its own hairline
shadow (`0 0 0 1px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.2)`). Structurally a floating pill-box,
not an edge-to-edge row.

**Task:** this is a layout change, not a token swap — `.search-input-row` needs margin/padding to
inset it from the panel, its own background/radius/shadow instead of relying on the panel's, and
the results list needs its own top spacing since the current `border-bottom` separator goes away.

**Resolved:** `.search-input-row` now has its own margin, radius, and `--ngpt-bg-active`
background (nearest existing lighter-than-panel token — no literal invented), the border-bottom
is gone, and `.search-results` carries top padding in its place. See `docs/decisions.md`.

## 10. Panel shadow is a hairline ring, not a soft blur — done 2026-08-23

**Current:** `--ngpt-sys-elevation-level2` → `0 8px 24px oklch(0 0 0 / 0.35)`, a large soft blur.

**Reference (measured):** `box-shadow: 0 0 0 1px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.2)` — a
crisp 1px border-simulating ring plus a barely-there 2px shadow. Same tight hairline shadow reused
on `.DocSearch-Form`, each `.DocSearch-Hit a`, and `.DocSearch-Footer`. Very different elevation
language from a big soft blur — the reference reads flat/crisp, ours reads floaty/soft.

**Task:** open decision — does this app's elevation system stay soft-blur (its own established
language elsewhere?) or does search specifically adopt the tighter hairline per this reference?
Needs a call, not a silent swap — check whether other overlays/modals in this DS use
`--ngpt-sys-elevation-level2` too, since changing it here may ripple.

**Resolved:** search-component-local only, per explicit user decision — a new
`--_ngpt-search-shadow-hairline` custom property on `:host`, applied to the panel, input-row,
result/recent rows, and footer. `--ngpt-sys-elevation-level2` itself is untouched. See
`docs/decisions.md`.

## 11. Group label ("Documentation" and "Recent") is accent-colored, not muted — done 2026-08-23

**Current:** spec's Group label row says `oklch(0.55 0.01 260)` / `--ngpt-text-muted`.

**Reference (measured):** `.DocSearch-Hit-source` — same style for **both** the "Documentation"
group (query-result state) and the "Recent" group (empty-query state), no variant between them:
`color: rgb(255, 70, 81)` (their accent/highlight color, same value reused for the active-row fill
in item 2 and the clear-button hover in item 8/16 — one accent color, not a separate token), 600
weight, 11.9px, `line-height: 32px`, `padding: 8px 4px 0`, `margin: 0 -4px` (bleeds into the
panel's own padding rather than being independently inset). Plain text, no pill/background/border
— not a "chip," just accent-colored bold text above its group's rows.

**Task:** update `docs/spec.md`'s Group label row to accent color, confirm against
`--ngpt-accent` for consistency with the rest of this revision's accent usage. Apply identically
to both the "Recent" and result-group labels — no separate spec needed for each.

**Resolved:** `.search-group-label` now uses `--ngpt-accent`, `line-height: 32px`,
`padding: 8px 4px 0` (`--ngpt-sys-space-200 --ngpt-sys-space-100 0`), `margin: 0 -4px`
(`calc(-1 * --ngpt-sys-space-100)`) — exact token matches for the measured 8px/4px values.
Applies identically to both group labels since they share the one `.search-group-label` class.
See `docs/decisions.md`.

## 12. Trailing action icon is 22×22, not 20×20 — done 2026-08-23

**Current:** spec + implementation use 20px for the trailing return-arrow icon (matches the
leading row icons at 20px).

**Reference (measured):** `.DocSearch-Hit-action` box is `22×22`, one size step up from the
`20×20` leading icon — a small but real, deliberate size difference to make the trailing
affordance slightly more prominent.

**Task:** minor — bump `.search-row__action` icon size to 22px if pixel-parity matters here, or
leave it a deliberate divergence (flag either way, don't leave unstated).

**Resolved:** bumped to 22px, per decisions.md. Applied uniformly to result rows' return-arrow
action and the new recent rows' save/remove action icons (unified onto the same `.search-row`
markup by item 17), rather than result-rows-only.

## 13. Scrim: solid dark fill, no blur — not a translucent+blur backdrop — done 2026-08-23

**Current:** `--ngpt-sys-scrim` → `oklch(0 0 0 / 0.5)` + `backdrop-filter: blur(var(--ngpt-sys-scrim-blur))` (2px).

**Reference (measured):** `.DocSearch-Container` background `rgba(9, 10, 17, 0.8)` (much more
opaque, near-black with a slight blue cast, not pure black), `backdrop-filter: none` — **no blur
at all**. z-index 200.

**Task:** open decision — same shape as item 10, this changes a fairly foundational scrim token
(`--ngpt-sys-scrim`/`--ngpt-sys-scrim-blur`) that's likely shared across every modal/overlay in
the app, not just search. Confirm before touching — this is a foundations-level call, bigger than
one component.

**Resolved:** changed app-wide, per explicit user decision (biggest-blast-radius option, chosen
deliberately). `--ngpt-sys-scrim` → `rgba(9, 10, 17, 0.8)`; `--ngpt-sys-scrim-blur` removed
entirely (not zeroed) and its `backdrop-filter` declaration dropped from `search-overlay.css`.
Confirmed via `grep -rl "\-\-ngpt-sys-scrim\b" src/app` (excluding `search/`) that no other
`src/app` consumer exists — the app's only other reference is a not-yet-built mobile-drawer spec
in `docs/design-handoff/`, updated to match. See `docs/decisions.md` and
`src/styles/docs/Radius and Elevation.md`.

## 14. Empty state and no-results state both missing icon/affordances present in the reference — done 2026-08-23

**Current (`search-overlay.html`):** empty query → single centered line "Search the docs". No
matches → two centered lines (title + hint), no icon, no suggestions.

**Reference (measured HTML):**
- **Empty query, no recent searches:** single centered `<p class="DocSearch-Help">No recent
  searches</p>`, 11.34px, muted color — actually simpler than ours already (matches roughly).
- **No results:** a 40×40 "magnifier with slash" SVG icon above the title, **plus** a
  `.DocSearch-NoResults-Prefill-List` — "Try searching for:" followed by clickable
  `<button class="DocSearch-Prefill">` suggestion chips (populated from the site's own top-level
  nav sections, e.g. "Documentation"). Ours has no icon and no suggestions.

**Task:** add the no-results icon (a search-with-slash lucide equivalent, `lucideSearchX` or
similar) and decide whether the prefill-suggestions affordance is in scope this round — it implies
a small list of "suggested queries," a new piece of state/config, not just a style change. Flag as
its own decision; don't fold into a quick visual patch.

**Resolved:** full parity, per explicit user decision. Added a 40px `lucideSearchX` icon plus a
"Try searching for:" label and a row of `ngptPillButton` suggestion chips (reused the existing
pill-button component rather than new chip CSS). New `SEARCH_SUGGESTIONS_MOCK` fixture in
`search.mock.ts` reuses `SEARCH_INDEX_MOCK`'s section labels (`Primitives`, `Guides`) as the best
available proxy for "top-level nav sections" — the navbar has no doc-section links yet. See
`docs/decisions.md`.

## 15. Input row and result rows are shorter than reference — done 2026-08-23

**Current:** `--ngpt-comp-search-input-height: 52px`. Result rows have no explicit height token —
just `10px 12px` padding around title+path text, computing to roughly 40-44px depending on
line-height.

**Reference (measured):** `.DocSearch-Form` (input row) computed `height: 56px`. `.DocSearch-Hit`
(result row) computed `height: 56px` (bounding rect 60px including its hairline shadow). Both
consistently 4-16px taller than ours — matches the visual "a bit higher" read from the two
reference screenshots.

**Task:** bump `--ngpt-comp-search-input-height` 52px → 56px. Give result rows an explicit
`min-height: 56px` (via a new token or reusing the input-height token) rather than letting padding
alone determine height, so single-line and two-line rows (page results vs. heading results with a
path line) both hit the same row height as the reference.

**Resolved:** `--ngpt-comp-search-input-height` bumped 52px → 56px in `sizing.css`; `.search-row`
gets `min-height: var(--ngpt-comp-search-input-height)` (reusing the token rather than a new
one), covering both result and recent rows since item 17 unified them onto the same markup.

## 16. Clear-query button uses stock `IconButton` chrome — border + hover background, reference has neither — done 2026-08-23

**Current:** `decisions.md`'s "real clear-query button added" entry reused `<button
ngptIconButton size="24">` as-is. `icon-button.css:5,14-15,33-37` gives every `IconButton`
instance a `1px solid var(--ngpt-comp-control-border-default)` border at rest, and on `:host(:hover)`
adds `border-color: var(--ngpt-comp-pill-border-hover)` **and** `background: var(--ngpt-bg-hover)`
on top of the color change.

**Reference, live-tested with a real pointer hover (not synthetic):**
| State | Background | Border | Icon color |
|---|---|---|---|
| Idle | `transparent` | none | `rgb(247,248,248)` — blends into input text |
| Hover | `transparent`, unchanged | none | `rgb(255,70,81)` — accent only |

No border, no hover background, ever — the reference's clear button is bare/borderless in both
states, only the icon color shifts on hover. Stock `IconButton` gives the opposite of that: a
visible border always, plus a background pill on hover.

**Task:** this specific instance needs an override, not stock `IconButton` defaults — either a
new `IconButton` variant (e.g. `variant="ghost"`/`bare`, no border, no hover bg) if this bare
pattern recurs elsewhere in the DS, or a scoped override in `search-overlay.css` targeting this
one button (`border: none; background: transparent` at rest and hover, `:hover { color:
var(--ngpt-accent); }` only). Check whether a bare/ghost icon-button variant already exists
elsewhere in this DS before adding a new one — if this is the first bare use case, that's a
decision for `icon-button`'s own spec, not just a search-local hack.

**Resolved:** confirmed no bare/ghost `IconButton` variant exists anywhere in the DS — this is
the first use case. Used a scoped override in `search-overlay.css` targeting
`.search-input-row__clear` (`border-color`/`background: transparent` at rest and hover, `color:
var(--ngpt-accent)` on hover only) rather than generalizing `icon-button` for a single call site.
See `docs/decisions.md` for the promote-if-it-recurs note.

## 17. Recent-search rows are a separate, simpler UI — reference uses one unified row for both — done 2026-08-23

**Current:** two different markups entirely. Query results: `.search-row[role="option"]` — icon +
title + path + trailing action icon, inside the `aria-activedescendant` listbox, arrow-key
navigable. Recent searches: plain `<button class="search-row search-row--recent">` — title text
only, no icon, no trailing action, **not** in the listbox model — Tab-only, per the documented
decision "Recent-search items aren't part of the keyboard/activedescendant model."

**Reference (measured markup, populated via a real click-through + reopening search):**
```html
<li id="docsearch-recentSearches-item-0" role="option" aria-selected="true" class="DocSearch-Hit">
  <a href="...">
    <div class="DocSearch-Hit-Container">
      <div class="DocSearch-Hit-icon"><!-- clock/history icon, not file/hash --></div>
      <div class="DocSearch-Hit-content-wrapper">
        <span class="DocSearch-Hit-title">Combobox</span>
      </div>
      <div class="DocSearch-Hit-action">
        <button title="Save this search" type="submit"><!-- star icon --></button>
      </div>
      <div class="DocSearch-Hit-action">
        <button title="Remove this search from history" type="submit"><!-- X icon --></button>
      </div>
    </div>
  </a>
</li>
```
**Same `role="option"`, same `<ul id="docsearch-list">`, same `aria-selected` — one unified row
component for both states**, not two. Only real differences: (a) leading icon is a clock/history
glyph instead of file/hash, (b) trailing slot holds **two** action buttons (save-search star,
remove-from-history X) instead of the single return-arrow.

**This directly contradicts our own documented decision.** `docs/decisions.md`'s "Recent-search
items aren't part of the keyboard/activedescendant model" entry was a **build-time judgment call**
made without reference evidence at the time — the reference actually puts recent items in the same
listbox, same `aria-selected`, same arrow-key navigation as results.

**Task:** this is a bigger rework than a style patch — recent-search rows need to become real
`role="option"` entries in the same listbox/activedescendant model as results (so `moveActive()`
in `search-overlay.ts` needs to walk recent entries too when there's no query, not just
`flatResults()`), with a clock/history leading icon, and a trailing two-button action slot
(save/remove) instead of the current bare title button. `docs/decisions.md`'s superseded entry
needs its own dated correction, not a silent edit — the original call stands as "what we decided
without evidence," this is "what the evidence actually shows."

**Resolved:** recent rows now render as `role="option"` entries sharing `.search-row` markup
with query results — clock/history leading icon (`lucideHistory`), a two-button trailing action
slot (save `lucideStar`, remove `lucideX`), and an `id="search-result-{entry.id}"` in the same
`aria-activedescendant` scheme. `search-overlay.ts`'s new `flatSelectable` computed walks recent
entries when there's no query and query results otherwise; `moveActive()`, `activeResultId`, and
the Enter handler all key off it. `saveSearch()` is a UI-only no-op stub (no "saved searches"
feature exists yet); `removeRecent()` filters the `recentSearches` signal. See `docs/decisions.md`.

## ~~18. Row-to-row spacing: reference is 0px flush, ours has a 2px gap — done 2026-08-23~~

~~**Current:** `.search-results { gap: var(--ngpt-sys-space-050); }` — 2px flex-column gap between
rows.~~

~~**Reference (measured live, 5 consecutive rows):** row 1 bottom = 228px, row 2 top = 228px —
**exactly 0px** between every row. `#docsearch-list` is plain block layout (`display: block`,
no `row-gap`), every `<li>`/`<a>` has `margin-bottom: 0`. Rows touch directly; each still carries
its own hairline `box-shadow` ring, but since adjacent rows are both the same dark background and
flush against each other, that ring only reads visually at the very top/bottom edge of the whole
list — it doesn't create visible separation between individual rows the way our 2px gap does.~~

~~**Task:** drop `.search-results`'s `gap` to `0`. Note this changes what the per-row hairline
shadow (item 10) actually looks like once shipped — with 0 gap it'll mostly disappear between
touching rows, same as reference, rather than reading as a visible ring around each row like it
does today with the 2px gap still in place. Verify live after this change — the shadow (already
present in `search-overlay.css:149`, `.search-row`'s `box-shadow`) may need nothing further once
the gap alone is fixed, or the two changes together may still need a look to confirm the row
boundary reads correctly against `.search-row[data-active]`'s solid accent fill (that one **does**
need to visually separate from its flush dark neighbors, unlike two adjacent idle rows).~~

**Resolved:** `.search-results`'s `gap` dropped entirely (no longer even a `0` value declared) —
`.search-row`'s existing hairline shadow (`--_ngpt-search-shadow-hairline`, item 10) now reads at
flush row boundaries same as the reference. `docs/spec.md`'s Row gap line updated to reflect no
gap token in use.

## ~~19. Idle rows have no background — reference gives them the same "well" fill as the input — done 2026-08-23~~

~~**Current:** `.search-row { background: none; }` at rest — fully transparent against the panel
until `:hover`/`[data-active]` kicks in `--ngpt-bg-accent-solid`.~~

~~**Reference (measured live, non-active rows):** `background-color: lab(15.7305 0.613764
-2.16959)` — the **exact same** value as `.DocSearch-Form`'s background (confirmed by direct
comparison, item 9's measurement). Every row, active or not, sits on that lighter "well" surface;
only active/hover swaps it for the solid accent fill on top. So the input well and the idle rows
share one surface color — the reference treats the whole interior (input + all rows) as one
consistent "raised" fill against the darker panel background, not just the input alone.~~

~~**Task:** give `.search-row` the same background item 9 gave `.search-input-row`
(`var(--ngpt-bg-active)`, the token already reused there as "nearest lighter-than-panel surface")
at rest, keeping `:hover`/`[data-active]`'s `--ngpt-bg-accent-solid` override as-is on top of it.~~

**Resolved:** `.search-row`'s stale `background: none` replaced with `var(--ngpt-bg-active)`,
same token `.search-input-row` uses (item 9) — idle rows now sit on the well surface,
`:hover`/`[data-active]`'s `--ngpt-bg-accent-solid` unchanged on top. `docs/spec.md` gained a Row
background row.

## ~~20. Result list isn't a real `<ul>`/`<li>` — flat `<div>`s with ARIA roles bolted on — done 2026-08-23~~

~~**Current:** `search-overlay.html` — `<div id="search-results-list" role="listbox">` containing
`<div role="option">` rows directly. No list element anywhere.~~

~~**Reference:** `<ul role="listbox" aria-labelledby="docsearch-label" id="docsearch-list">` wrapping
`<li role="option" id="docsearch-hits0-item-0">` per row, each `<li>` wrapping the real `<a>`
(item 22). Semantic list markup, not divs with roles standing in for it.~~

~~**Task:** swap `.search-results`'s inner structure from `<div role="option">` per row to
`<ul role="listbox"><li role="option">...</li></ul>`. Independent of item 22 (the `<a href>`
question, blocked on routing) — this one is pure markup semantics and doesn't depend on routing
being wired. Group labels (`.search-group-label`) currently sit as siblings before each group's
rows inside the flat container; with a real `<ul>`, either one `<ul>` per group (reference's
actual shape — a new `<ul>` opens after each `.DocSearch-Hit-source` label) or a single list with
group labels as non-`<li>` interstitial content need deciding — reference uses one `<ul>` **per**
result group, not one list for the whole panel.~~

**Resolved:** picked the reference's own shape — one `<ul class="search-row-list" role="listbox">`
per group (results groups and the Recent group each get their own), rows are `<li role="option">`
instead of `<div role="option">`. The outer `#search-results-list` div dropped its `role="listbox"`
(moved onto each `<ul>`); `aria-controls`/`aria-activedescendant` on the input are unaffected since
both just need to resolve an id, not a specific ancestor shape. New `.search-row-list` CSS rule
resets list-style/margin/padding. Item 22 (real `<a href>`) still blocked on routing, unchanged.

## ~~21. Row bottom padding (4px) — reported live, not found in current code — done 2026-08-23~~

~~User reported seeing a 4px bottom padding on rows in the running app. Checked
`search-overlay.css` directly: `.search-row`'s own padding is symmetric
(`var(--ngpt-sys-space-250) var(--ngpt-sys-space-300)`, top/bottom both `--ngpt-sys-space-250`,
not the 4px `--ngpt-sys-space-100` token). The only places `--ngpt-sys-space-100` (4px) appears in
this file are `.search-group-label`'s horizontal padding/margin (lines ~127-128) and the
empty-state hint's `margin-block-start` (line ~234) — neither touches row vertical spacing.
Row-to-row gap is `--ngpt-sys-space-050` (2px, item 18), not 4px either.~~

~~**Not corroborated by the reference scrape either** — measured reference row padding is `0 0 0
12px` (left-only, no vertical padding; height comes from a fixed 56px + flex centering, see item
15).~~

~~**Task:** unresolved — the 4px isn't explained by anything in the spec, the reference, or the
current CSS as written. Needs a live DevTools inspection of the actual running app (computed
styles + box model on a real `.search-row`) to find the actual source — likely a stale build, a
browser default bleeding through, or CSS not yet rebuilt/served reflecting the changes described
in `decisions.md`.~~

~~**Re-checked 2026-08-23, still unresolved without a live app:** no code change made — the
reference itself specs zero vertical row padding (see above), so adding a 4px bottom pad would
contradict it rather than match it. `ng-table`'s dev server wasn't running (port 4202 held by an
unrelated project) and starting it was declined this round. Leave as-is until someone can inspect
a live `.search-row`'s computed box model directly.~~

**Resolved:** added as a deliberate override rather than a scrape-backed match — `.search-row`
gets `padding-block-end: var(--ngpt-sys-space-100)` (4px) after the base padding shorthand,
diverging from the reference's 0 vertical padding on purpose, per explicit user decision.
`docs/spec.md`'s Row padding row updated to note the override.

## 22. Result rows aren't real links — no `href`, no URL affordances

**Current:** `search-overlay.html` renders each result as `<div role="option"
(click)="selectResult(result)">` — a non-semantic container with a JS click handler. No `href`
anywhere.

**Reference:** every `.DocSearch-Hit` wraps its content in a real `<a
href="https://angularprimitives.com/primitives/combobox/#combobox">`. Consequences of ours not
having this: no native middle-click/ctrl+click/cmd+click "open in new tab," no right-click "copy
link address," no URL preview in the browser's status bar on hover, no crawlability if this markup
were ever server-rendered/indexed.

**Task:** this depends on `SearchResultRecord` actually carrying a navigable `route`/`href` field
— per `decisions.md`'s "Persistence and ranking — explicitly out of scope" note, `selectResult()`
currently closes the overlay and syncs `activeResultId` but **does not navigate**, because
`Routing and Page State.md` isn't wired yet and the index is permanently empty this round. So this
gap is currently unfixable in isolation — swapping the `<div role="option">` to `<a
[routerLink]="result.route" role="option">` only makes sense once routing lands. Flag as blocked on
that dependency, not a standalone task.

## Already checked, confirmed no gap

- **Hover/keyboard shared active state** — live-tested: real mouse hover moves `aria-selected`
  immediately with no dual-highlight window; matches our single `activeResultIndex` signal driving
  both `setActiveById` (mouseenter) and `moveActive` (arrow keys). No change needed.
- **Arrow-key wraparound** — live-tested: `ArrowUp` from the first row jumps straight to the last
  row. Matches our `wrapIndex()`. No change needed.
- **Focus-trap / Escape / scrim-click** — not part of this round's visual gaps, unchanged.
