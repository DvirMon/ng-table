# Decisions — search (search-field, search-overlay)

Build-time judgment calls not spelled out verbatim in `docs/spec.md` or the fixed contract in
`apps/ng-table/docs/CONVENTIONS.md`.

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
