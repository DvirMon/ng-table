---
title: Gap analysis — Storybook stories vs. product expansion stories
type: plan
status: >
  proposed 2026-09-30. Four new story folders under a new `expansion/` feature folder; no existing
  story absorbs any of it. Target: 12 of 12 product stories ✅ plus E-G1's panel half and E-T1.
  1.3 is a consumer recipe in A (OQ-exp-4); single-open (OQ-exp-1) and the side panel (1.6,
  OQ-exp-7) are shown in D. The panel ships no CSS (OQ-exp-6). Panels unmount on close by default
  (`animate.leave`); A's 2.3 demos the opt-in keep-mounted recipe (OQ-exp-8, resolved: E39–E42).
  The library ships panel a11y directives (E41, #199); the stories use
  them. Blocked by #199 (#195 closed).
date: 2026-09-30
parent: ../../architecture.md
---

# Expansion (detail panel) — Story Coverage Report

Measures [`0-product/expansion.md`][product] against the 26 story hosts in `src/stories/`, then
proposes the target set. Story shape follows [`3-ui/stories.md`](../../stories.md). Structure
reused from [`selection-stories/1-gap-analysis.md`](../selection-stories/1-gap-analysis.md), the
other feature that started from zero stories.

Inputs, all 2026-09-30:

- [`research-expansion-ux-capabilities.md`][ux] — what a person clicks, across AG Grid, MUI X,
  PrimeNG, TanStack, Angular Material. **Decides every affordance below.**
- [`research-expansion-community-pain.md`][pain] — which failure paths a story must show.
- [`research-expansion-product-ux.md`][pux] — end-user products; used only for keys and the
  "don't lose my place" rule, since none of them expands inline.
- [`research-expansion-internal-coverage.md`][internal] — what ships, and which docs are stale.

[product]: ../../../0-product/expansion.md
[ux]: ../../../1-state/work/expansion/active/story-discovery/research-expansion-ux-capabilities.md
[pain]: ../../../1-state/work/expansion/active/story-discovery/research-expansion-community-pain.md
[pux]: ../../../1-state/work/expansion/active/story-discovery/research-expansion-product-ux.md
[internal]: ../../../1-state/work/expansion/active/story-discovery/research-expansion-internal-coverage.md

## Step 1 — Existing stories that touch the panel

**None.** Grepping `src/stories/**` for `withExpansion|\.expansion\b|everExpanded` returns zero
hits ([internal] §E). The table has no rows to fill.

| Story | Composes | Actually demonstrates for the panel |
|---|---|---|
| `grouping/grouping-collapsible/` | `withGrouping()` + `withTree({ parentId })` | Nothing. Group/tree collapse only. Three docs call it a `withExpansion()` story; it isn't |
| `row-edit/external-write/` | `withRowEdit()` | Nothing — but it is the **markup precedent**: a second consumer `<tr colspan>` inside the same `@for`, gated per row |

What ships without any affordance:

| Ships today | On screen anywhere |
|---|---|
| `table.expansion()` open set; `toggle` / `expand` / `collapse` / `set` (E11) | no |
| `expand()` / `collapse()` with no ids = all rows in `rows()` / everything | no |
| `everExpanded` keep-mounted ledger (E7) | no |
| `initial`, seeding both sets silently (E14) | no |
| Pruning on row removal (ADR-0012 D4) | no |
| Toggle directive, `aria-expanded`, slide, `inert` | **not shipped** — no expansion directive in `src/directives/` |

**Redundancy / merge candidates: none.** No existing host should take a panel: every one is at
full scope for its own lesson, and `stories.md` forbids bolting a second feature onto a
single-lesson host.

## Step 2 — Cross-reference against the product doc

The product doc's marks are all ❌ and hold on re-derivation. Split by what closing each takes:

| Product story | Now | Mechanism | What closes it |
|---|---|---|---|
| 1.1 Open one row's detail | ❌ | shipped | A story |
| 1.2 Keyboard + `aria-expanded` | ❌ | unbuilt | A story binding it by hand (no directive), per OQ-exp-2 (APG disclosure) |
| 1.3 Rows with nothing to show | ❌ | consumer-owned (OQ-exp-4) | The recipe, shown in A: per-row chevron gate + filtered ids for expand-all |
| 1.4 Several open | ❌ | shipped | A story |
| 1.5 Open / close all | ❌ | shipped | A story; label derived in the host |
| 1.6 Detail beside the list | ❌ | consumer recipe (OQ-exp-7, OQ-exp-1) | A story: single-open via `set([id])`, a drawer beside the table |
| 2.1 Panel follows its row on sort | ❌ | shipped | A story that can reorder rows |
| 2.2 Refetch keeps panels open | ❌ | shipped | A story with a refetch |
| 2.3 Panel keeps its inner state | ❌ | shipped | A story whose panel has state of its own. Shown without `release()`; a "free kept panels" button follows [#200](https://github.com/DvirMon/ng-table/issues/200) |
| 3.1 Loading / failure in the panel | ❌ | consumer-owned (OQ-exp-5) | The recipe (OQ-exp-5), shown in a story |
| 3.2 Smooth open, no jump | ❌ | unbuilt | The slide recipe in the feature stylesheet |
| 3.3 Opens already open | ❌ | shipped | A story passing `initial` |
| E-G1 Panel under a collapsed group (grouping-owned) | ✅ — **wrong** | holds by construction | A story composing groups + panel; mark drops to ❌ until then |
| E-T1 Panel and tree chevron on one row | ❌ | shipped | Same story as E-G1 |

## Conventions from peer libraries

From [ux], applied to every target story below.

| Axis | Peers | This plan | Why |
|---|---|---|---|
| Toggle | Dedicated button/cell in all five | Chevron `<button>` in its own leading column | The only affordance all five agree on |
| Placement | AG Grid first column; Material last; MUI/PrimeNG configurable | **Leading** | Control before the content it reveals; matches the tree chevron in `grouping-collapsible/` |
| Icon | Chevron right → down (PrimeNG), rotated arrow (Material), + (MUI) | Chevron, rotated by `[data-expanded]` | Majority; one glyph, CSS-rotated |
| Row click | Recipe only (MUI, Material example); collides with selection (`mui/mui-x#19149`) | **Not bound** | No peer defaults to it |
| Keys | Enter (AG), Space (MUI source), native button elsewhere | Native `<button>` — Enter and Space both | The safe floor; no peer agreement beyond it |
| ARIA | MUI `aria-expanded` on button; PrimeNG + `aria-controls`; AG Grid failed on the row | `aria-expanded` + `aria-controls` on the button; nothing on the row | APG Disclosure pattern; `aria-expanded` on a row means treegrid child rows (OQ-exp-2, resolved) |
| Open mode | Multi by default (MUI, PrimeNG, TanStack) | Multi | Shipped default |
| Expand all | API or recipe everywhere; PrimeNG demo puts buttons outside the table | Toolbar buttons | No header/row gesture covers it, so `stories.md` rule 5 allows them |
| Height | Natural in non-virtualized tables | Natural; `grid-template-rows: 0fr → 1fr` slide | Matches Material's example and the UI spec's recipe |
| Collapsed content | AG destroys (`keepDetailRows` opt-in); Material keeps hidden | Default: unmount on close via `animate.leave`. Opt-in per row: keep mounted (`everExpanded`), `inert` + hidden when closed | OQ-exp-8 part 1 (2026-10-01) — matches AG Grid's default + opt-in; `inert` closes Material's tabbable-hidden gap for kept panels |

**Deliberate non-goals** (no story implies them): Esc-to-close on the *inline* panel (a side-panel
convention; an inline panel closes from its button — D's drawer does take Esc), step-to-next-row
(OQ-exp-9, #201, product doc §7.1). The side panel itself is supported (OQ-exp-7) and shown in D.

## Step 3 — Target story set

New feature folder `src/stories/expansion/`, title `Table / Expansion`, one `expansion.mdx` at its
root, per `stories.md`.

```
src/stories/expansion/
├── fixtures/          ← types.ts, mock.ts, schema.ts — shared by detail-panel/, lazy-panel/, side-panel/
├── expansion-story.css ← chevron rotation, detail-row colspan, the 0fr→1fr slide classes
├── expansion.mdx
├── detail-panel/      ← baseline
├── lazy-panel/        ← + local http.ts, handlers.ts (one importer; promote on a second)
├── panel-in-groups/   ← reuses grouping/fixtures, like filtering-selection reuses filtering's
└── side-panel/        ← single-open + a story-local drawer beside the table
```

No *panel* toggle directive ships, so every host binds `aria-expanded`/`aria-controls` by hand on
a `<button>`. The tree has one: `ngpTableTreeToggle` (`directives/ngp-table-tree-toggle.directive.ts`,
exported from `index.ts`), used by `grouping-collapsible/`'s group headers — only its data-row
line-item chevron is still hand-written.

**Panel a11y directives (OQ-exp-8 part 3, E41, 2026-10-01).** The library will ship a toggle
directive (`aria-expanded` + `aria-controls`) and a panel-content directive (`id`, `inert` while not
open, focus return on close). The stories use them — hand-writing that a11y in the hosts would
teach the pattern the library now owns. **Sequencing decided 2026-10-01:** the directives come
first, in [#199](https://github.com/DvirMon/ng-table/issues/199) (which also rewrites
`3-ui/directives/expansion.md`); #190 is blocked by #199 only (#195 closed 2026-10-01; `release()` is #200, non-blocking).

### Story A — `detail-panel/` (baseline) — **new**

Composes `withExpansion()` + `withSorting()`. Order rows (id, customer, date, total) with line
items; each row's panel shows them. Some fixture rows have no detail (no line items), for 1.3.

| Product story covered | Covered by |
|---|---|
| 1.1 Open one row's detail | **new** — leading chevron `<button>` per row; a detail `<tr>` with `colspan` directly under it, rendered inside the same `@for` over `renderRows()`; `table.expansion.toggle(row.id)`. Default gate (OQ-exp-8 part 1): `@if (table.expansion().has(row.id))` with `animate.enter`/`animate.leave` — unmounts on close |
| 1.2 Keyboard + state announced | **new** — native `<button>`; `[attr.aria-expanded]="table.expansion().has(row.id)"`; `aria-controls` → the detail row's id; accessible name "Show details for order N". Panel content follows the button in DOM order, so Tab goes into the panel before the next row |
| 1.3 Rows with nothing to show | **new** — consumer recipe (OQ-exp-4): rows with no detail render no chevron (`@if` on the row's own data) and no detail `<tr>`. No library gate |
| 1.4 Several open | **new** — nothing to add; multi-open is the default. Hint text says so |
| 1.5 Open / close all | **new** — toolbar component with `Expand all` → `expand(expandableIds())`, where `expandableIds` is a host `computed()` over `rows().filter(hasDetail).map(trackBy)`; `Collapse all` → `collapse()`. Label/disabled state from an `allExpanded` `computed()` comparing the open set against `expandableIds()`, not `rows().length` |
| 2.1 Panel follows its row on sort | **new** — two sortable headers (`withSorting()` bare, trailing). Open a panel, sort, the panel moves with its row. The product doc's one-line why (the category's signature bug) lives in the mdx, not the host |
| 2.3 Panel keeps its inner state | **new** — the opt-in keep-mounted recipe (OQ-exp-8 part 1). A host `keepMounted(row)` predicate (only rows with the tabbed panel persist) widens the gate: `@if (expansion().has(id) \|\| (keepMounted(row) && everExpanded().has(id)))`. Only kept panels carry `[inert]="!isOpen"` and `[data-expanded]` visibility. The kept body is a story-local component with two tabs (items / shipping) holding its own `signal`; pick a tab, close, reopen — still on it. A default-gated row resets, side by side |
| 3.2 Smooth open | **new** — `animate.enter`/`animate.leave` classes driving the slide recipe in `expansion-story.css` (the library ships no CSS, OQ-exp-6): `grid-template-rows` 0fr→1fr. Default panels leave via `animate.leave`, then unmount; kept panels use the same slide via `[data-expanded]` |

Why `withSorting()` belongs here: 2.1 needs *something* to reorder rows, and a header click is the
conventional one. A "shuffle" toolbar button would be an invented affordance.

### Story B — `lazy-panel/` — **new**

Composes `withExpansion({ initial: [<one id>] })`. Same order rows; each panel fetches its line
items from `GET /api/orders/:id/items` (MSW). `forceFailure` / `latencyMs` Storybook controls, per
the `server-filtering/` precedent — the transport is the lesson here. Exports `Default` and
`ForcedFailure`; the on-canvas hint branches on `forceFailure()`.

| Product story covered | Covered by |
|---|---|
| 3.1 Loading / failure in the panel | **new** — each panel body is its own component holding an `httpResource` for its row's items, created when it mounts — i.e. when the panel opens, not on a `changed` event. Under the default gate a closed panel unmounts, so reopening fetches again — expected, not a bug. Renders pending / error + `Retry` (`resource.reload()`) / items, inside the panel only. Other panels and the table keep working |
| 3.3 Opens already open | **new** — `initial` seeds one row open. It shows on first paint *and its content loads*, because `initial` seeds the open set and the panel fetches on mount — the PrimeNG open-but-empty bug (`primefaces/primeng#7526`) cannot happen |
| 2.2 Refetch keeps panels open | **new** — a `Refetch` toolbar button reloading the table's rows (`httpResource` + `linkedSignal` bridge, per `stories.md`). The handler returns fresh objects, same ids, and drops one row on the second fetch. Open panels on surviving rows stay open; the dropped row's open state is pruned |

Panel markup: A's default gate (`expansion().has(id)` + `animate.leave`); no keep-mounted, no `inert`.

No expand-all here, on purpose: with fetch-on-mount it would show N simultaneous requests as the
normal path.

**Why standalone** rather than folded into A: an end-to-end flow with several states worth seeing
in sequence (pending → loaded / failed → retried), plus MSW knobs. In A those knobs would be
demo-harness noise on a host whose lesson is the toggle (`stories.md` "What a host may not
contain" #1).

### Story C — `panel-in-groups/` — **new**

Composes `withGrouping()` + `withTree({ parentId })` + `withExpansion()` over `grouping/fixtures`
(the deal rows; d4 has flat `parentId` children d4-a and d4-b). Panel markup: A's default gate
(`expansion().has(id)` + `animate.leave`); no keep-mounted, no `inert`.

| Product story covered | Covered by |
|---|---|
| E-G1 Panel under a collapsed group ([`grouping.md`](../../../0-product/grouping.md) §5, grouping-owned) | **new** — open a deal's panel, collapse its group: the panel goes with its row. Reopen: still open |
| E-T1 Panel and child rows on one row | **new** — d4 (parent of d4-a, d4-b) has both chevrons, visibly different: the tree chevron is `ngpTableTreeToggle` inside `ngpTableTreeRow`, in the name cell with indent; the panel chevron is hand-written (no panel directive yet), in the leading column |

**Why standalone:** it composes three features, and its lesson is how two expansion-shaped
features coexist — which neither `grouping-collapsible/` (tree only) nor A (panel only) can show
without taking on a second lesson.

### Story D — `side-panel/` — **new**

Composes `withExpansion()` (used single-open) + `withSorting()` over the shared
`expansion/fixtures`. Each row has a "View" `<button>`; a story-local drawer component sits beside
the table (not inside it) and renders the row whose id is in `table.expansion()`. No inline panel
markup, no `everExpanded` gate — the drawer renders only while a row is open, so nothing stays
mounted closed and no `inert` is needed.

| Product story covered | Covered by |
|---|---|
| 1.6 Detail beside the list | **new** — row button → `table.expansion.set([id])`; clicking another row swaps the drawer's content. × and Esc → `collapse()`. The table keeps its width; the drawer is a sibling in the layout. Open a row, sort: the drawer still shows the same row (keyed by id) |
| 1.6 failure: shown row deleted | **new** — a `Delete` row button (`updateRows` removing the row). `onRowsRemoved` prunes the open set, so the drawer closes with no stale content |
| OQ-exp-1 single-open recipe | **new** — the row button toggles with `set(isOpen ? [] : [id])` instead of `toggle(id)`; the host's doc comment names the recipe |

**Why standalone:** a different layout lesson from the inline panel — the detail lives outside the
table. Bundling it into A would teach that one feature is two UIs at once.

## Left out on purpose

| Item | Why not a story |
|---|---|
| Single-open in the inline stories (1.4 variant) | OQ-exp-1 resolved: a recipe, not a mode. Shown once, in D; A stays multi-open, the shipped default |
| 2.1's filter half | Same id-keying as the sort half; filtering's 1.1 owns it. A quick filter in A would add a second lesson |
| Expand-all in `lazy-panel/` | Would present one request per row as the normal path; expand-all stays in `detail-panel/`, where panels are local |
| Row click to toggle | No peer defaults to it; collides with selection (`mui/mui-x#19149`) |
| Step to next/previous row (in D or A) | OQ-exp-9 resolved: core keyboard navigation (ADR-0029 cat. 5), built in [#201](https://github.com/DvirMon/ng-table/issues/201); not a story concern |
| Esc-to-close on the inline panel | Side-panel convention; the inline panel closes from its button |
| Panel + row-reorder animation (U6) | Unverified interaction; `ngpTableRowAnimation` is not composed in any target story. Verify separately before a story shows it |
| The panel a11y directives (E41) | Library UI work (`3-ui/directives/expansion.md` rewrite), not a story. Built in #199, which blocks #190; the stories use its directives |

## Also owed — doc fixes, not stories

- [`grouping.md`](../../../0-product/grouping.md) E-G1: drop ✅ → ❌ until C ships.
- `grouping-collapsible/` wrongly called a `withExpansion()` story in `0-product/sorting.md:89`,
  `3-ui/stories.md:282,522`, `0-product/grouping.md:42,50,77`.
- `3-ui/directives/expansion.md`: stale banner added 2026-10-01; the rewrite is #199's, before
  any directive is built ([`0-product/expansion.md`][product] §6.2 U2).
- `3-ui/stories.md`: register `expansion/` in the file layout and reference implementations once
  built.
- `docs/status.md`: regenerate so the product column links `0-product/expansion.md`.

## Summary

| Story | Status | Why its own file |
|---|---|---|
| `expansion/detail-panel/` | new | Baseline — the feature has no story at all |
| `expansion/lazy-panel/` | new | Multi-state async flow with MSW knobs; would clutter the baseline |
| `expansion/panel-in-groups/` | new | Composes three features; its lesson is two expansion-shaped features side by side |
| `expansion/side-panel/` | new | Different layout lesson (detail outside the table); bundling would teach that one feature is two UIs |
