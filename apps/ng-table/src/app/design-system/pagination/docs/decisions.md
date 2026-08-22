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
`data-*`, per this app's convention #3). A missing side leaves its grid column empty — no reflow.

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
