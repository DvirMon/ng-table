# Pagination — decisions

## Icon mapping

`←` / `→` → `lucideArrowLeft` / `lucideArrowRight` per `src/styles/docs/Iconography.md`'s mapping
table ("pagination arrows" row). Size `--ngpt-sys-icon-size-sm` (13px) — no size token is named in
this spec's front-matter, chose `sm` as the closest scale to the 12.5px eyebrow label the arrow sits
inline with. Registered locally via `viewProviders: [provideIcons({ lucideArrowLeft, lucideArrowRight })]`
per ADR-0004 — `app.config.ts` untouched.

## Spec-vs-mock: outer divider/padding not owned by this component

The spec's HTML/CSS mock wraps both cards in `.pagination-footer` with `padding-top: 24px` and a
`border-top` divider. Front-matter `owns` scopes this component to "Prev/next card pair ... border,
radius, eyebrow, title, arrow shift on hover" — the Build spec table (the authoritative per-property
contract per this app's conventions: spec wins over frame/mock) has no row for a top divider or top
padding, and neither `--ngpt-sys-space-600` nor a divider token appears in the spec's own token list.
Treated the mock's outer wrapper as page-composition context, not part of this molecule:
`ngpt-pagination`'s host renders only the two-card row (`display:grid; grid-template-columns:1fr 1fr;
gap:var(--ngpt-sys-space-400)`). Whatever page composes this component owns the divider/spacing above
it — consistent with `does_not_own: "the site-wide footer"`.

## One-side-only layout: grid, not flex

"One side only" requires the remaining card to keep its own half of the row rather than stretching to
fill it. `flex:1` on each card would stretch a lone card to 100% width once its sibling is absent (the
"never a placeholder for the missing side" rule cuts both ways — no placeholder card, but also no
stretch). Used CSS Grid instead: `grid-template-columns: 1fr 1fr`, each card explicitly placed via
`[data-side='prev'] { grid-column: 1 }` / `[data-side='next'] { grid-column: 2 }` (state as
`data-*`, per this app's convention #4). A missing side leaves its grid column empty — no reflow.

## Reduced motion

No extra `prefers-reduced-motion` override added. The hover transition (bg lift + arrow shift) already
runs at `--ngpt-sys-motion-duration-fast` (120ms) — the same value `global.css`'s reduced-motion
media query forces globally — so the override would be a no-op here. Judged different from
dropdown-menu/search-overlay (ADR-0003's named examples), which animate a larger open/close transform.

## Input shape

No spec.md front-matter fixed an input contract for pagination beyond "leaf this round, no consumers
yet" (`docs/CONVENTIONS.md` fixed-contracts table). Chose:

```ts
export interface PaginationEntry {
  readonly label: string;
  readonly href: string;
}
```

`prev` / `next`: `input<PaginationEntry | null>(null)`. `null` (not omitted/undefined) is the explicit
"no side" signal, matching the spec's own language ("one side is `null`", `Content Model.md` § Order).
Rendering uses `@if (prev(); as prevEntry)` / `@if (next(); as nextEntry)` — the absent side renders
nothing, never a placeholder.

`href` (not `slug`) — this round has no router wiring for pagination (mirrors nav-item's fixed
contract, which also explicitly skips router wiring this round), so cards are plain `<a [href]>`
elements. `pagination.mock.ts` ships `PAGINATION_BOTH_SIDES_MOCK`, `PAGINATION_PREV_ONLY_MOCK`, and
`PAGINATION_NEXT_ONLY_MOCK` fixtures covering all three states named in the spec's front-matter
(`prev-only`, `next-only`, plus the default both-sides case).

## Title per spec's resolved decision

Card titles render `label` alone (`{{ prevEntry.label }}` / `{{ nextEntry.label }}`) — not a composed
"Section + Label" string — per the spec's restated `Content Model.md` decision.

---

# Inversion to attribute-hosted primitives (2026-08-23)

## Old vs. new shape

| | Before | After |
|---|---|---|
| Selector(s) | `ngpt-pagination` (element) | `nav[ngptPagination]` + `a[ngptPaginationLink]` |
| Inputs | `prev`/`next`: `input<PaginationEntry \| null>(null)` | `side: input.required<PaginationSide>()` on the card only |
| DOM | the component built the `<nav>` and both `<a class="page-card">` blocks from its inputs | the consumer authors the `<nav>` and each `<a>`; the primitives style them |
| `href` | read off `PaginationEntry` | native, set by the consumer |
| Card title | `{{ entry.label }}` | projected (`<ng-content />`) |

## Why

ADR-0005: a primitive whose job is to style an existing native element is attribute-hosted, never
an element wrapper — `<ngpt-pagination>` emitted a non-semantic host around a `<nav>` it also
built, and foreclosed the element (the cards could never be a `routerLink`-driven `<a>` the
consumer controls, nor carry `target`/`rel`/`download`).

More directly, this domain violated the invariant in `libs/table/CLAUDE.md`: **"Attribute-only
directives — never insert/remove/reorder DOM. Structural logic lives in the template (consumer's
responsibility)."** The old component's `@if (prev())` / `@if (next())` *was* structural logic, and
it lived here rather than in the consumer's template. That decision is now the consumer's: omitting
a side means omitting its `<a>`.

## The seam: container styles, card renders its eyebrow

Two primitives, split at the grid cell:

- `nav[ngptPagination]` owns only the two-column track and the gap. Template is `<ng-content />`.
- `a[ngptPaginationLink]` keeps a **real template** — the eyebrow's arrow glyph *and* its
  "Previous"/"Next" label are both a pure function of `side`, spec-fixed copy the consumer has no
  say in, so projecting them would invite drift. Only the card **title** is projected. This is the
  `callout` precedent (attribute-hosted, but composes its own icon + content column), and it keeps
  `provideIcons({ lucideArrowLeft, lucideArrowRight })` local per ADR-0004.

**Why the card is a primitive at all, rather than descendant rules in the container's CSS:** under
emulated encapsulation, projected nodes carry the *consumer's* encapsulation id, so a container
rule like `:host > a` never matches — the same mechanic ADR-0005 records for `prose`. Every rule
that styles a card therefore has to live in a component hosted *on* that card. That includes its
grid placement: `grid-column: 1 / 2` is keyed on `data-side` in `pagination-link.css`, i.e. the
item places itself in its parent's track.

`side` is `input.required` — it drives grid placement and the direction copy, so there is no
defensible default, and a card without one would silently stack in column 1.

## `aria-label` as a static host attribute

The spec's a11y front-matter fixes the label to "Pagination" for every instance, so it is a static
host attribute on `nav[ngptPagination]` rather than an input — the `callout` `role="note"`
precedent. This does not contradict ADR-0005's "never re-declare native capability as an input":
it is not an input, and no consumer-visible affordance is being shadowed.

## Spec wording the inversion invalidated

- Front-matter `a11y` said only `nav element with aria-label="Pagination"` — amended to name the
  primitive that sets it, since the consumer now authors the `<nav>` and could otherwise assume the
  label is theirs to supply.
- The `## One side only` section's *rendering* claim (the component drops the absent card) is now a
  consumer responsibility; the *layout* claim (the remaining card keeps its own half) still holds
  and is still implemented here, via `grid-column`. Rewritten as such in the new `## API` section
  rather than edited in place — the section is a design requirement, and it survives.
- The `## HTML/CSS mock` is now reference-only for the visual contract: its `.page-card--prev` /
  `--next` classes are `data-side` in the implementation, and its outer `.pagination-footer`
  wrapper was already excluded from this molecule (see § Spec-vs-mock above). Flagged with a note
  above the mock rather than rewritten.

## `PaginationEntry` kept

Nothing consumes it now. Kept anyway: a docs page still needs a typed shape for the `{ label, href }`
pair it feeds into the authored `<a>` — the same role `FooterLink` plays for Home. `pagination.mock.ts`
is unchanged and still valid (three fixtures: both sides, prev-only, next-only).
