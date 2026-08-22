# Decisions — search (search-field, search-overlay)

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/ng-table/docs/CONVENTIONS.md`.

## Final public API

```ts
// search-field.ts
@Component({ selector: 'ngpt-search-field', ... })
export class SearchField {
  readonly variant = input<SearchFieldVariant>('default'); // 'default' | 'on-band'
  readonly open = output<void>();                          // emits on click (native <button> covers Enter/Space)
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

No additions beyond the fixed contract — both components match `CONVENTIONS.md`'s table exactly.

## Persistence and ranking — explicitly out of scope

- `search.mock.ts` ships `SEARCH_INDEX_MOCK` as a permanently empty array and
  `RECENT_SEARCHES_MOCK` as a static 3-entry in-memory fixture. Neither persists (no
  `localStorage`) and neither is written back to by the running app.
- `SearchOverlay.resultGroups` is a `computed` that reads the (always-empty) index signal and
  returns `[]` unconditionally — no matching, filtering, or ranking logic is implemented. That
  logic belongs to `Search Index.md`'s matching/ranking rules, which depend on Content
  Model.md not being wired this round. The "results" and "no results" render branches both
  exist in `search-overlay.html` so a populated index needs no template rework, only a real
  `resultGroups` computation.
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

## Manual focus trap, no CDK

No `@angular/cdk` dependency in this repo (confirmed against `package.json`) and ADR-0001 keeps
this design system app-local, so the focus trap is hand-rolled in `search-overlay.utils.ts`
(`getFocusableElements`, `wrapIndex`) rather than using `cdk/a11y`'s `FocusTrap`. Tab/Shift+Tab
wrapping is handled in `SearchOverlay.trapFocus()`, keyed off `document.activeElement` against
the panel's first/last focusable descendant.

## DOM stays mounted; `inert` gates interactivity instead of `@if`

`search-overlay.html` doesn't conditionally render the scrim/panel with `@if (open())`. They're
always in the DOM; `[attr.data-open]` on the host drives the CSS transition (opacity + a
vertical transform per the spec's mock) and `[attr.inert]` (present when closed) removes the
whole subtree from focus, hit-testing, and the accessibility tree. This was necessary so the
`viewChild` refs used for initial-focus-on-open and the Tab-trap are always resolvable —
`@if`-toggling the panel would race the ref against Angular's render cycle on every open.

## Icons

Only `lucideSearch` is used (leading icon on the field and the overlay's input row), per
`Iconography.md`'s mapping table (⌕ → `lucideSearch`). Registered locally in each component's
own `viewProviders` (ADR-0004) — `search-field.ts` and `search-overlay.ts` each carry their own
`provideIcons({ lucideSearch })` rather than sharing one registration. The `⌘K`, `↑↓`, `↵`, and
`esc` keyboard-chip glyphs are literal text/Unicode inside `<kbd>`, not icons — they aren't in
the Iconography.md placeholder table, and the spec's own HTML mock renders them as plain text.

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
- **`--ngpt-comp-nav-border-width`** (2px) for the active row's left border width. Reused from
  `nav-item`'s token rather than introducing a new one or hardcoding — same "flush left
  border, active indicator" role `shape.css` already documents for nav rows. Flagged here as
  the one cross-component token reuse in this build, in case a reviewer wants a
  search-specific token instead.
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

## Recent-search items aren't part of the keyboard/activedescendant model

The spec's keyboard table (↑/↓/Enter/Tab) and its `role="combobox"` / `aria-activedescendant`
contract are written for the **results** listbox. Recent-search entries render as plain
`<button>`s (real interactive elements, not `role="option"` rows) and aren't reachable via
↑/↓ — only via Tab, same as any other button in the panel. This keeps the accessibility
contract exactly as specced rather than extending it to a state the spec doesn't describe.
