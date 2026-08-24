## 2026-08-23 — pointer/keyboard active-row conflict fix

Row highlight was double-driven: `.search-row:hover` (CSS, native pointer state) and
`[data-active]` (JS `activeResultIndex`, keyboard nav). Bug: hover a row, then arrow-key away —
old row stayed highlighted too, since mouse never moved so `:hover` stayed true. Fixed by
dropping `:hover` from CSS entirely; highlight now painted only from `[data-active]`.

Rows keep both `(mouseenter)` and `(mousemove)` so any real pointer movement — even within a
row the cursor is already inside — reclaims the highlight, not just crossing into a new row.
Checked this against how `ng-primitives` solves the same conflict in its `listbox` primitive
(`activeDescendantManager`, `ng-primitives-a11y`): it uses `mouseenter` only, but adds a ~200ms
"ignore pointer" window after any keyboard-origin move, guarding against a keyboard-triggered
scroll-into-view firing a synthetic pointer event under a still cursor. Adopted that guard here
too (`ignoringPointer` signal, `activateFromPointer()`), layered on top of our `mouseenter` +
`mousemove` pair rather than replacing it — ng-primitives' `mouseenter`-only approach doesn't
reclaim on in-row movement, which is a real requirement here. Generic writeup + Angular/React
snippets: `~/.claude/skills/pointer-keyboard-active-state/SKILL.md` (reusable, not project-local).

# Decisions — search (search-field, search-overlay)

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/ng-table/docs/CONVENTIONS.md`.

## 2026-08-23 — second-pass gap decisions (user calls) — implemented, see entry below

Item 11's own gap-doc entry was updated after these calls were made, to clarify it covers both
the "Documentation" and "Recent" group labels identically — the accent-color call below already
matches that.

Resolving the open items from `docs/gaps-ngp-reference.md`'s deeper scrape pass:

- **Item 6 (field focus ring):** keep icon-only color change on `:host(:focus-visible)`. Explicit
  user call, made knowing this is no longer a reference-match claim (see the dedicated entry
  above) — it's this app's own design preference. a11y sign-off (WCAG 2.4.7) stays open.
- **Item 10 (panel/row/footer shadow):** switch to the hairline style, **search-component-local
  only** — a new shadow value scoped to `search-overlay.css`, not a change to the shared
  `--ngpt-sys-elevation-level2` token. Other modals/overlays using that token are unaffected.
- **Item 12 (trailing action icon size):** match reference — 22px, one size step above the 20px
  leading icons.
- **Item 13 (scrim):** change the **shared** `--ngpt-sys-scrim` / `--ngpt-sys-scrim-blur` tokens
  app-wide to the reference's solid `rgba(9,10,17,.8)`, no blur. Biggest-blast-radius option,
  chosen deliberately — affects every modal/overlay using these tokens, not just search. Needs a
  sweep of other scrim consumers before/while implementing to confirm none rely on the blur
  specifically.
- **Item 14 (no-results state):** full parity — add the 40px search-with-slash icon **and** the
  "Try searching for:" prefill-suggestion chip list. The suggestions need a small new data source
  (which queries to suggest) — not just a style change, needs its own design pass on what that
  list contains for this app (likely top-level nav sections, mirroring the reference's own
  "Documentation" suggestion).

## 2026-08-23 — implementation of items 9–17 (refactor pass)

Closes out the remaining open items from `docs/gaps-ngp-reference.md` (9, 10, 11, 12, 13, 14, 15,
16, 17). Item 6 stays open (a11y sign-off only, no code change needed or made).

- **Item 9 (input-row well):** `.search-input-row` gained its own margin, `border-radius:
  var(--ngpt-sys-shape-corner-extra-small)`, and background. No existing token is an exact
  "lighter than panel" surface — reused `--ngpt-bg-active` (0.24) rather than inventing a
  literal, since it's the nearest existing token lighter than the panel's `--ngpt-bg-elevated`
  (0.2) and already used elsewhere in this DS for "hover on an elevated surface." The
  `border-bottom` separator is gone; `.search-results` now carries top padding
  (`--ngpt-sys-space-300`) in its place.
- **Item 10 (hairline shadow, search-local):** new `--_ngpt-search-shadow-hairline` custom
  property defined on `:host` (`0 0 0 1px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.2)`, matching the
  reference's measured value exactly), applied to `.search-panel`, `.search-input-row`,
  `.search-row`, and `.search-footer`, replacing their `--ngpt-sys-elevation-level2` usage.
  `--ngpt-sys-elevation-level2` itself is untouched — no other consumer in this app was changed.
- **Item 11 (group-label accent color):** `.search-group-label` — `color: var(--ngpt-accent)`,
  `line-height: 32px`, `padding: var(--ngpt-sys-space-200) var(--ngpt-sys-space-100) 0` (8px/4px,
  exact token matches), `margin: 0 calc(-1 * var(--ngpt-sys-space-100))` (-4px). One class shared
  by both the "Documentation" result-group label and the "Recent" label, so both get the change
  for free — no per-state branching needed.
- **Item 12 (trailing icon 22px):** `.search-row__action` bumped to 22px in the template. Applies
  to result rows' return-arrow and the new recent-row save/remove action icons alike, since item
  17 unified both onto `.search-row`.
- **Item 13 (scrim, app-wide):** `--ngpt-sys-scrim` → `rgba(9, 10, 17, 0.8)`;
  `--ngpt-sys-scrim-blur` removed entirely (not zeroed — the reference has no blur, permanently)
  along with the `backdrop-filter` declaration in `search-overlay.css`. Swept `src/app` via
  `grep -rl "\-\-ngpt-sys-scrim\b"` excluding `search/`: no other live consumer exists. The
  foundations doc (`src/styles/docs/Radius and Elevation.md`) and its front-matter token list
  were updated to match, including a note that the not-yet-built mobile drawer (which the doc
  already earmarks as a future scrim consumer) should not reintroduce a blur token when built.
- **Item 14 (no-results parity):** added a 40px `lucideSearchX` icon and a "Try searching for:"
  chip row. Reused `ngptPillButton` (already attribute-hosted on `<button>`/`<a>`) for the chips
  instead of writing new chip CSS. New `SEARCH_SUGGESTIONS_MOCK: readonly string[]` in
  `search.mock.ts` — reuses `SEARCH_INDEX_MOCK`'s existing section labels (`Primitives`,
  `Guides`) as the best available proxy for "top-level nav sections," since this app's navbar
  doesn't have doc-section links (`Discord`/`GitHub`/`Documentation` only). Open to revision once
  `Search Index.md`'s real indexing lands. Clicking a chip calls `selectSuggestion()`, which sets
  `query` and refocuses the input — same shape as `selectRecent()`.
- **Item 15 (height bump):** `--ngpt-comp-search-input-height` 52px → 56px in `sizing.css`.
  `.search-row` gained `min-height: var(--ngpt-comp-search-input-height)` (reused the token
  rather than adding a new one) instead of relying on padding alone.
- **Item 16 (clear-button bare/ghost) — corrected 2026-08-23:** the transparent-on-hover
  treatment below (matching the reference exactly) turned out to give no visible hover feedback
  in practice. Per explicit user follow-up, hover/focus-visible now fills solid
  `--ngpt-bg-accent-solid` with `--ngpt-text-on-accent` icon color — the same AA-checked pair
  used for active rows (item 2) — instead of a transparent background with only an accent-colored
  icon. Border stays removed in all states (the original "no outline" ask). Applied identically
  to the clear-query button and the recent-row save/remove action buttons
  (`.search-row__actions button`), which got the same bare-then-filled-hover treatment for
  consistency even though they weren't explicitly covered by item 16's original text.
- **Item 16 (clear-button bare/ghost):** confirmed no bare/ghost `IconButton` variant exists
  anywhere in the DS today (`icon-button.ts`/`.css` only has `data-size`/`data-copy-state`
  variants) — this is the first bare use case. Used a scoped override in `search-overlay.css`
  (`.search-input-row__clear` and its `:hover`/`:focus-visible`) rather than generalizing
  `icon-button`. If a second bare-button use case shows up elsewhere in the DS, that's the
  trigger to promote this to a real `IconButton` variant instead of a second scoped override.
- **Item 17 (unified recent-row listbox):** `RecentSearchEntry` gained an `id` field
  (`search.types.ts`/`search.mock.ts`) so recent rows can share the `search-result-{id}`
  `aria-activedescendant` scheme with query results. Recent rows now render as
  `.search-row[role="option"]` — `lucideHistory` leading icon (not file/hash), title, and a
  trailing two-button action slot (`lucideStar` save, `lucideX` remove) instead of the old bare
  title-only `<button>`. `search-overlay.ts` gained a private `flatSelectable` computed
  (`hasQuery() ? flatResults() : recentSearches()`) that `moveActive()`, `activeResultId`, and
  `onPanelKeydown`'s Enter case now key off, so arrow keys and Enter reach recent entries when
  there's no query. `saveSearch()` is a deliberate UI-only no-op (`event.stopPropagation()` only)
  — no "saved searches" feature exists yet, matching the same out-of-scope-wiring treatment
  `selectResult()`'s non-navigation already got. `removeRecent()` filters the `recentSearches`
  signal. This fully supersedes the "Recent-search items aren't part of the
  keyboard/activedescendant model" entry below (already flagged as superseded by the correction
  entry above it) — that entry is left as historical record, not deleted.

## 2026-08-23 — gap analysis against Angular Primitives reference (open items)

`docs/spec.md` was revised against a live scrape of the Angular Primitives (Algolia DocSearch)
⌘K overlay — see `docs/gaps-ngp-reference.md` for the full checklist and scrape evidence. Two
items in that revision are marked TBD in the spec and need a call before implementation:

### Active row: solid accent fill — resolved 2026-08-23

Superseded here: the field-trigger vs. overlay-row focus/active distinction below no longer
applies to the row's own active state. The reference renders the active row as a **solid**
`--docsearch-highlight-color` fill (`#FF4651`, full-bleed, no left border), not our tint +
left-border-accent treatment.

Resolved as: new `--ngpt-bg-accent-solid` token (`src/styles/tokens/color.css`), aliased to
another token rather than a duplicate literal — "solid" just means "use an accent-family value as
a background," not a new color value. Paired with a new `--ngpt-text-on-accent`.

**Revised 2026-08-24, accent re-hue to magenta 328.** The alias now points at
`var(--ngpt-accent-surface)` (`oklch(0.55 0.25 328)`), not `var(--ngpt-accent)`: the accent is now
the *text* tier at `oklch(0.68 0.22 328)`, too light to carry white text (3.21:1). The pairing
inverts with it — `--ngpt-text-on-accent` is now **white** at 5.60:1 over the fill, where the
near-black neutral it replaces would land at 3.51:1. Under the previous orange accent the result
ran the other way (white ~3.9:1, near-black ~5.1:1), which is why this token was a dark neutral
until now. The reference ships white-on-`#FF4651` at a marginal ~3.4:1; we land on the same text
color by a different route, with AA headroom the reference does not have.

Applied in `search-overlay.css`: `.search-row:hover, .search-row[data-active]` now sets
`background: var(--ngpt-bg-accent-solid)` and recolors title/path/icons/connector to
`var(--ngpt-text-on-accent)`. The `border-inline-start` left-accent rule (and its base
`transparent` default) is removed entirely, per the reference's full-bleed, no-left-border
treatment — see "Token substitutions" below for the now-obsolete `--ngpt-comp-nav-border-width`
reuse this replaces.

### Kbd glyphs: SVG per key, not shared literal text (supersedes "Icons" below) — resolved 2026-08-23

The "Icons" section further down states the `⌘K`/`↑↓`/`↵`/`esc` keyboard-chip glyphs are
"literal text/Unicode inside `<kbd>`, not icons" and that this was a deliberate call because they
weren't in `Iconography.md`'s placeholder table. The reference scrape shows DocSearch renders each
footer key as a distinct hand-drawn SVG (Enter, Arrow-down, Arrow-up, Escape — four icons, not one
combined `↑↓`). That original call is superseded for the **footer legend** specifically; the `⌘K`
trigger-hint chip on the field itself was not part of this scrape and is unchanged.

Resolved via lucide equivalents rather than new inline SVGs: `lucideCornerDownLeft` (Enter),
`lucideArrowDown`/`lucideArrowUp` (arrow keys), `lucideX` (Escape — no dedicated "escape" glyph
exists in the lucide set, per the spec mock's own "placeholder icon name" note). `Kbd`
(`kbd.ts`/`.html`) needed no API change — it already only wraps `<ng-content>`, so each footer/esc
call site in `search-overlay.html` simply projects `<ng-icon>` instead of text. The `esc` chip on
the input row (line 30) got the same treatment for consistency, even though only the footer legend
was in scope of the scrape.

## 2026-08-23 — search-field focus ring moved to icon color (confirmed, not a reference match)

Per `docs/gaps-ngp-reference.md` item 6: `:host(:focus-visible)` box-shadow ring removed from
`search-field.css`; replaced with `:host(:focus-visible) ng-icon { color: var(--ngpt-accent); }`,
matching the pattern already used in `select-trigger.css:48-51`. This is a visual-parity fix
against the two reviewed screenshots, **not** an independently scraped DocSearch pattern — a
deeper scrape pass found the reference has no focus treatment on its own trigger at all, so the
"matches reference" framing this decision originally carried doesn't hold. Re-confirmed by
explicit user decision on 2026-08-23 to keep the icon-only treatment anyway, as this app's own
design choice rather than a parity fix.

**Still open:** a11y sign-off — an icon-color-only change is a weaker focus indicator than a
full-control ring; needs confirmation this still satisfies WCAG 2.4.7 (Focus Visible) before
considered fully closed.

## 2026-08-23 — overlay's own search input: no focus treatment (reverted)

The `:focus-within` icon-color rule added to `search-overlay.css`'s `.search-input-row` under the
original item 7 has been **reverted** — confirmed via live scrape that the reference genuinely has
no focus indicator on its overlay input (blur/focus produce zero computed-style change on the
form, icon, or input). The overlay's original spec line was correct: the panel itself is already
the focused surface once open, so the input needs nothing further. This is a real reference match,
unlike item 6 above.

## 2026-08-23 — overlay input row gains the same focus-icon treatment

Per `docs/gaps-ngp-reference.md` item 7: chose "add icon-color treatment for consistency" over
leaving the overlay's `.search-input` ring-less. `search-overlay.css`: `.search-input-row:focus-within
ng-icon { color: var(--ngpt-accent); }` — `:focus-within` on the row (not `:focus-visible` on the
input) since the icon is a sibling of the input, not a descendant. Spec's "no border or ring on
the input itself" line still holds (no box-shadow added) — only the icon recolors, matching the
trigger button's item-6 pattern. Since `searchInput` autofocuses on open, the icon is accent-colored
for essentially the whole time the overlay is open — accepted as correct, the input is the active
surface.

## 2026-08-23 — correction: overlay input row focus-icon treatment reverted (supersedes entry above)

The entry immediately above ("overlay input row gains the same focus-icon treatment") is
**reverted**. `docs/gaps-ngp-reference.md` item 7 was corrected after this decision was made:
live-tested `.focus()`/`.blur()` on the reference's overlay input produces zero computed-style
change anywhere (no ring, no icon-color shift) — the reference genuinely has no focus
indicator on the overlay input, confirming the *original* spec line ("no border or ring on the
input itself — the panel is already the focused surface") was correct all along. Removed
`.search-input-row:focus-within .search-input-row__icon { color: var(--ngpt-accent); }` from
`search-overlay.css` and the now-unused `search-input-row__icon` class from the leading
`<ng-icon>` in `search-overlay.html`. Item 6 (the field-trigger's icon-only focus treatment) is
unaffected — that's a separate, still-kept design decision on `search-field.css`, not a
reference-match claim.

## 2026-08-23 — real clear-query button added (separate from the Escape hint)

Per `docs/gaps-ngp-reference.md` item 8: `search-overlay.html`'s input row previously only had
the static Escape-hint `<kbd>` chip; the reference's `.DocSearch-Reset` is a real, separately
interactive clear button. Added `<button ngptIconButton size="24" ...>` (reused `IconButton`,
`../icon-button/icon-button`, rather than a bespoke button — it's already attribute-hosted with
no icon registry of its own, exactly this use case) between `.search-input` and the esc `<kbd>`,
shown only `@if (hasQuery())`. Wired to a new `SearchOverlay.clearQuery()` — resets `query` and
`activeResultIndex`, refocuses the input, same shape as the existing `selectRecent()`. The
Escape-hint kbd chip is untouched and stays a separate element, per the gap doc's explicit
instruction not to collapse the two.

The input row's `:focus-within` icon-color rule (item 7, above) needed narrowing to
`.search-input-row__icon` (a class added to the leading search icon specifically) — otherwise it
would have also recolored the new clear button's icon and the esc kbd's icon on every keystroke,
which isn't the intended scope of that fix.

## Final public API

```ts
// search-field.ts — attribute-hosted, see "§ search-field becomes attribute-hosted" below
@Component({ selector: 'button[ngptSearchField]', host: { 'aria-label': 'Search docs' }, ... })
export class SearchField {
  readonly variant = input<SearchFieldVariant>('default'); // 'default' | 'on-band'
  // no outputs — the host IS the button, consumers bind the native (click)
}

// search-overlay.ts
@Component({ selector: 'ngpt-search-overlay', ... })
export class SearchOverlay {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();
  // Internal only (query, resultGroups, recentSearches, keyboard/focus-trap handlers) —
  // not part of the public surface, listed here only because they're the observable behavior:
  // Escape / scrim click / Tab-trap / ⌘K-independent (parent owns the shortcut and `open`).
}
```

No additions beyond the fixed contract at original build time. `search-field`'s selector and its
`open` output have since changed under ADR-0005 — that supersedes `CONVENTIONS.md`'s
`ngpt-search-field` row for the field. `search-overlay` is unchanged.

## Persistence and ranking — explicitly out of scope

- `search.mock.ts` ships `RECENT_SEARCHES_MOCK` as a static 3-entry in-memory fixture. It isn't
  persisted (no `localStorage`) and isn't written back to by the running app.
- `SEARCH_INDEX_MOCK` (2026-08-23) is now a small fixture of fake page/heading records —
  populated so the result list (icons, active-row fill, keyboard nav, the 5-per-group cap) could
  be manually verified against something. **Not real doc content** — Content Model.md still
  isn't wired, so this is test data, not indexing.
- `SearchOverlay.resultGroups` (2026-08-23) now runs a real case-insensitive substring match
  (`search-overlay.utils.ts`'s `groupSearchResults`) against `SEARCH_INDEX_MOCK`, grouped by
  section in `entryOrder`, capped at 5 per group (closes gap #5). This is intentionally the
  simplest possible matching — no fuzzy match, no ranking/scoring, no highlighting of the
  matched substring in the title (spec's "Query match highlight" row is still unimplemented).
  `Search Index.md`'s full matching/ranking rules are still deferred until Content Model.md
  replaces the fixture with real records.
- `SearchOverlay.selectResult()` closes the overlay and syncs `activeResultId`, but does not
  navigate. `Search Index.md` § Selecting a result specifies `record.id` as the target, which
  requires `Routing and Page State.md` — not wired this round, and this dead code path never
  executes anyway since the index is always empty.
- Recent-search entries are not appended to on submit — there's no meaningful "committed
  search" event yet (no index to search against), so recording new entries would misrepresent
  unimplemented behavior. `selectRecent()` only replays a stored query string into the input.

## Scroll-lock vs. page `aria-hidden` — split responsibility

`Focus and Keyboard.md` requires both "the page behind is scroll-locked" and "its content is
`aria-hidden` while the surface is open." `SearchOverlay` implements the scroll lock itself
(`document.body.style.overflow = 'hidden'` on open, restored on close/destroy) since that's
self-contained. It does **not** reach outside its own template to mark sibling app content
`aria-hidden` — this component only owns its own scrim+panel subtree, and the task brief
explicitly scoped this build to the `search/` folder only. Marking the rest of the page
`aria-hidden` is an app-composition concern for whichever Wave 2 task mounts
`<ngpt-search-overlay>` alongside the rest of the app.

## Focus trap wired onto `ng-primitives/focus-trap`

Was hand-rolled (`SearchOverlay.trapFocus()` + `search-overlay.utils.ts`'s
`getFocusableElements`/`FOCUSABLE_SELECTOR`), citing "no `@angular/cdk` dependency in this repo"
as the reason to hand-roll rather than use `cdk/a11y`'s `FocusTrap`. That reasoning doesn't rule
out `ng-primitives/focus-trap` (`ngpFocusTrap`), which is already a repo dependency (see
`dropdown-menu`/`dropdown-pill`/`select-trigger`/`tab-switcher`) and needed for a plain
Tab/Shift+Tab cycle: `<div ngpFocusTrap [ngpFocusTrapDisabled]="!open()">` on `#panel` replaces
the `Tab` case in `onPanelKeydown` and the whole selector-based focusable-element scan.

Verified against the primitive's source (`ng-primitives/focus-trap`'s `NgpFocusTrap`) before
wiring: outside an `NgpOverlay` context (this component has none — no portal/dialog wrapper),
`setupFocusTrap()` runs once at directive construction and arms global `focusin`/`focusout`/
`keydown` listeners immediately, but every handler checks `disabled()` at call-time — so toggling
`ngpFocusTrapDisabled` off `!open()` correctly arms/disarms live Tab-trapping and focus
containment without needing the panel to unmount, matching this component's existing
always-mounted-plus-`inert` model (see below). The directive's own initial-auto-focus path is
skipped while `disabled` is `true` at construction (the overlay starts closed) and never
re-triggers later, so it doesn't race the component's own `queueMicrotask`-based initial-focus
effect on open.

Full `ng-primitives/dialog` was considered and rejected: it's built around `NgpDialogTrigger` +
an `ng-template` + `NgpDialogManager` owning create-on-open/destroy-on-close portal mount, which
conflicts with this component's `open` being externally/parent-controlled (⌘K) rather than
locally triggered, and with the "DOM stays mounted" decision below. Scrim-click, Escape, body
scroll-lock, and focus-restore-on-close have no ng-primitives equivalent and stay hand-rolled.

## DOM stays mounted; `inert` gates interactivity instead of `@if`

`search-overlay.html` doesn't conditionally render the scrim/panel with `@if (open())`. They're
always in the DOM; `[attr.data-open]` on the host drives the CSS transition (opacity + a
vertical transform per the spec's mock) and `[attr.inert]` (present when closed) removes the
whole subtree from focus, hit-testing, and the accessibility tree. This was necessary so the
`viewChild` refs used for initial-focus-on-open and the Tab-trap are always resolvable —
`@if`-toggling the panel would race the ref against Angular's render cycle on every open.

## Icons

`lucideSearch` is the leading icon on the field and the overlay's input row, per
`Iconography.md`'s mapping table (⌕ → `lucideSearch`). Registered locally in each component's
own `viewProviders` (ADR-0004) — `search-field.ts` and `search-overlay.ts` each carry their own
`provideIcons()` rather than sharing one registration. As of the 2026-08-23 gap-closure round,
`search-overlay.ts`'s registration grew to also cover `lucideFile`/`lucideHash` (row leading
icon, keyed off `SearchResultRecord.kind`), `lucideCornerDownLeft` (row trailing action + Enter
kbd), and `lucideArrowDown`/`lucideArrowUp`/`lucideX` (footer + esc kbd glyphs) — see "Kbd
glyphs" above, this supersedes the original "literal text/Unicode, not icons" call for those four
keyboard chips.

## on-band variant: frame-sourced, not spec-sourced

`Search.md`'s own body only specs the `default` field variant. The on-band "translucent white
well" is only described in prose in `CONVENTIONS.md`'s navbar contract row, with no values —
the actual treatment (background/border/hover alpha values) came from the `Home Page.dc.html`
reference frame's inline styles (its hero navbar's search button). Per the ground rule ("spec
wins over frame" only applies where they conflict — here the spec is simply silent), the frame
fills the gap. Values are hardcoded oklch literals in `search-field.css`
(`oklch(1 0 0 / 0.12|0.18|0.28|0.45)`) since no `--ngpt-*` token covers a translucent-white
surface — same precedent as `pill-button.css`'s own on-band block. The on-band text/icon color
does reuse `--ngpt-text-primary` (exact value match with the frame's `white`), and the on-band
kbd chip drops its background (transparent) per the frame, keeping only the translucent border.

## Token substitutions beyond the spec's own front-matter list

`Search.md`'s front-matter `tokens:` array is incomplete in a few places where the token file
has an exact-value match the spec table didn't cite (mirrors the token-vs-restated-literal gap
`pill-button/docs/decisions.md` already flagged once). Used the token in every case, per
CONVENTIONS.md's unconditional "never hardcode a value that has a token" rule:

- **`--ngpt-sys-scrim-blur`** (2px) for the scrim's `backdrop-filter: blur()` — defined in
  `shape.css`, not listed in Search.md's front matter, but an exact match.
- **`--ngpt-sys-typescale-label-large-sm`** (13px/1.4/400 Inter) for the field's own text —
  matches "Search docs" placeholder's stated 13px/Inter exactly.
- **`--ngpt-sys-typescale-label-large`** (13.5px/1.4/400 Inter) for `.search-row__title` and
  the empty-state title — matches the spec's stated "Inter 13.5px" for both exactly.
- **`--ngpt-comp-nav-border-width`** (2px) — was reused for the active row's left border width
  at original build time. Removed 2026-08-23: the gap-closure round replaces the tint +
  left-border active treatment with a full-bleed solid fill (see "Active row: solid accent
  fill" above), which has no left border at all.
- **`--ngpt-sys-space-900`** (36px) for the footer row's height, and **`--ngpt-sys-space-800`**
  (32px) inside the sub-640px panel-width `calc()` — both exact matches to spacing-scale steps
  the spec's prose gave as bare pixel numbers.
- Group-label padding (`10px 10px 6px`) and result-row padding (`10px 12px`) are written as
  `var(--ngpt-sys-space-250) var(--ngpt-sys-space-250) var(--ngpt-sys-space-150)` and
  `var(--ngpt-sys-space-250) var(--ngpt-sys-space-300)` respectively — exact matches, the
  second pair is explicitly in the front matter, the first isn't but resolves the same way.
- Icon and placeholder colors that the spec states as `oklch(0.55 0.01 260)` (input-row icon,
  input placeholder) are rendered via `--ngpt-text-muted`, whose real defined value is
  `oklch(0.6 0.01 260)` — the token, not the spec table's slightly-stale restated literal, is
  the source of truth per `token_values_resolve_in`.

## Remaining untokenized literals

No token exists anywhere in `src/styles/tokens/` for these, so they're hardcoded, matching the
spec's own CSS mock:

- Keyboard-chip horizontal padding (`5px` — the vertical `2px` does use `--ngpt-sys-space-050`).
- Result-row path / empty-state hint text (`12px`, no matching typescale entry at 400 weight).
- Footer legend text (`11px` at 400 weight — `--ngpt-sys-typescale-label-small-alt` is the same
  11px but at 600 weight, so it doesn't fit).
- The four on-band translucent-white oklch values (see above).

## Below-md / below-sm breakpoints stay literal pixel values

`@media (max-width: 1023px)` and `@media (max-width: 639px)` restate `--ngpt-sys-breakpoint-md`
/ `-sm` as bare numbers — CSS media features can't reference custom properties, so this isn't a
hardcode-rule violation, just a platform limitation. Matches how `Search.md`'s own CSS mock
does the same thing.

## 2026-08-23 — correction: recent-search items ARE part of the keyboard/activedescendant model in the reference

The entry immediately below ("Recent-search items aren't part of the keyboard/activedescendant
model") was a build-time judgment call made without reference evidence. A live scrape of the
Angular Primitives search (populated by an actual click-through + reopen, not synthetic state)
shows the opposite: `<li id="docsearch-recentSearches-item-0" role="option" aria-selected="true"
class="DocSearch-Hit">`, inside the same `<ul id="docsearch-list">` as query results — same
listbox, same `aria-selected`/arrow-key model, not a separate Tab-only affordance. See
`docs/gaps-ngp-reference.md` item 17 for the full markup and task. The original entry below is
left as historical record of the original (unevidenced) call, not deleted.

## [Superseded by the entry above] Recent-search items aren't part of the keyboard/activedescendant model

The spec's keyboard table (↑/↓/Enter/Tab) and its `role="combobox"` / `aria-activedescendant`
contract are written for the **results** listbox. Recent-search entries render as plain
`<button>`s (real interactive elements, not `role="option"` rows) and aren't reachable via
↑/↓ — only via Tab, same as any other button in the panel. This keeps the accessibility
contract exactly as specced rather than extending it to a state the spec doesn't describe.

## `search-field` becomes attribute-hosted — ADR-0005 (post-shipped revision)

`ngpt-search-field` → **`button[ngptSearchField]`**. Was an element component whose template root
was a `<button>` it existed to style — exactly ADR-0005's test for attribute-hosted ("if the
template's root is a semantic native element"). The wrapper is gone; the component now hosts on the
consumer's `<button>`.

`<a[ngptSearchField]>` was deliberately **not** added to the selector (unlike `pill-button`, which
gained one). The field opens an overlay in place; it never navigates, so an anchor host would be
wrong semantics.

### What stayed in the template

The leading `lucideSearch` icon, the "Search docs" placeholder span, and the `⌘K` `<kbd>` chip
remain in `search-field.html` — only the wrapping `<button>` was deleted. This is a pre-composed
widget, not a generic styling wrapper: that fixed content *is* the field's identity, there is
nothing for a consumer to project, and the glyph is chosen by the component, so the local
`viewProviders: [provideIcons({ lucideSearch })]` registration stays (ADR-0004). This is the
difference from `icon-button`, which lost its `icon` input and its icon registry precisely because
its glyph was the consumer's choice.

### `open` output dropped

`open = output<void>()` is gone; consumers bind the native `(click)`.

On the old wrapper the output was mechanically necessary — `(click)` fired on the inner `<button>`
and had to be re-surfaced on the host. Now the host is that button, so `(click)` already lands
where it should, with Enter/Space handled natively.

The judgment call was whether `open` still earns its keep as self-documenting API. It does not.
The spec gives it no meaning beyond "the trigger was activated" — the field owns no open state
(`SearchOverlay.open` is a separate input driven by the page), applies no guard, and does no work
before emitting. The only call site confirms this: `navbar.html` bound
`(open)="forwardOpenSearch()"`, and `Navbar.forwardOpenSearch()` is a bare `this.openSearch.emit()`
pass-through. That is a plain click re-emit, which is what ADR-0005 rules out ("`icon-button` …
loses `pressed: output<void>()` — consumers bind the native `(click)`"). Keeping it would also make
`(click)` and `(open)` both work and both correct, with nothing declaring which is the contract.

If a later round gives activation real semantics (e.g. the field owning debounce, or opening on
focus as well as click, per `Search.md`'s "clicking *or focusing* it opens the overlay"), that is
the point to reintroduce a named output — it would then carry meaning `(click)` cannot.

### `aria-label="Search docs"` stays fixed, on the host

Moved from the inner `<button>` to a **static host attribute**, not an input. The spec's a11y
front-matter specifies ARIA only for the overlay (`role="dialog"`, activedescendant listbox); for
the field, "Search docs" is fixed copy — it's the accessible name for a control whose visible
placeholder text is the same string, hardcoded in this component's own template. An input could
therefore only let the two drift apart. Static (not `[attr.aria-label]`) so a consumer with a
genuinely different context can still override it on the element without fighting a binding, the
same reasoning `pill-button` used for its `type` default.

`type="button"` follows `pill-button` exactly: applied imperatively in the constructor when the
consumer hasn't set one, rather than as a host binding that would clobber an explicit
`type="submit"`. No `tagName` guard is needed here since the selector already restricts the host to
`<button>`.

### Call-site change (applied by the separate call-sites pass, not here)

```html
<!-- before -->
<ngpt-search-field (open)="forwardOpenSearch()" />
<ngpt-search-field variant="on-band" (open)="forwardOpenSearch()" />

<!-- after -->
<button ngptSearchField (click)="forwardOpenSearch()"></button>
<button ngptSearchField variant="on-band" (click)="forwardOpenSearch()"></button>
```

`navbar.ts`'s `imports: [SearchField, …]` is unchanged. `navbar.css` never selected
`ngpt-search-field`, so it needs no change either.

### CSS: `.search-field` folded into `:host`

`:host { display: contents; }` (the wrapper opt-out) is deleted. Every `.search-field` rule moved
onto `:host`, and its pseudo-class rules onto `:host(:hover)` / `:host(:focus-visible)` /
`:host([data-variant='on-band']:hover)`. Descendant rules (`.search-field__placeholder`, `.kbd`)
are unchanged apart from losing their now-absent `.search-field` ancestor qualifier. No visual,
token, or breakpoint change — the below-md icon-only collapse now sizes `:host` directly.

### `search-overlay` intentionally left as an element component

`search-overlay` keeps `selector: 'ngpt-search-overlay'` and was **not** touched by this pass.
ADR-0005 names it explicitly among the domains for which an element selector remains correct: it
composes real structure of its own (scrim + panel + input row + result list + footer) and shadows
no single native element, so the attribute-host test doesn't apply. It is additionally earmarked
for a later `NgpDialog` pass (ADR-0005 § Sequencing), which will own its focus trap, scrim, and Esc
handling — converting its shape now would be rework. Its `open` input and `closed` output are
unaffected by the field's dropped `open` output; the two were never wired to each other directly
(the page composition mediates).
