# Gap analysis: libs/shared/table vs. the competitive audit

Compares [audit.md](audit.md)'s inventory (TanStack Table, AG Grid, Material
React Table, PrimeNG) against the current `libs/shared/table/src` state layer,
as of 2026-09-05. Verdict legend: **ahead** (does something the four libraries
don't, or does it more deliberately), **on par**, **gap** (present but
narrower/weaker), **missing** (nothing in `src/`).

## Data handling — on par, narrower by design

| Concern                                | libs/shared/table                                                                                                                        | vs. the four                                                                                                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model                             | Plain `WritableSignal<TRow[]>`, no internal copy                                                                                         | Same shape as TanStack's `data` input                                                                                                                                                                                                                |
| Row identity                           | `trackBy` → `RowId`, `indexById` map                                                                                                     | Same role as `getRowId`/`dataKey`                                                                                                                                                                                                                    |
| Mutation without full re-render        | `insertRow`/`removeRow`/`patchRow` verbs + ADR-0006 removal reconciliation (diffs `indexById`, prunes feature state via `onRowsRemoved`) | **Ahead of TanStack/MRT/PrimeNG** (none of the three have any transaction/patch API — "not built in, consumer-owned" per audit). Roughly comparable in intent to AG Grid's `applyTransaction`, though narrower in scope (no batch/async variant yet) |
| Reactive/computed data source as input | Not supported — must be a plain signal                                                                                                   | Matches the deliberate constraint already documented in the PRD, not a gap vs. competitors (none support this either)                                                                                                                                |
| Server-side / lazy row models          | None                                                                                                                                     | **Missing** vs. AG Grid (SSRM, Enterprise) and PrimeNG (`[lazy]`+`onLazyLoad`) — no equivalent contract exists for any feature except sorting (see Server-side below)                                                                                |

## Columns — mixed: ahead on visibility rules, missing on sizing/pinning/persistence

| Concern                   | libs/shared/table                                                                                                                                                          | vs. the four                                                                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Definitions               | `ColumnDef` (id/accessor/visible/order/label + feature-contributed fields)                                                                                                 | On par                                                                                                                                                                                                                                                                                      |
| Ordering/reordering       | `reorderColumns(ids)` verb                                                                                                                                                 | On par (state-only, like TanStack; no built-in drag, same as TanStack)                                                                                                                                                                                                                      |
| Visibility                | `toggleColumnVisibility(id)` + declarative `columnsSchema` DSL: `applyVisible`/`applyVisibleAsync` (resource()-backed, permission/async-driven, AND-combined multi-writer) | **Ahead of all four** — none of TanStack/AG Grid/MRT/PrimeNG have a declarative, async-resolved, multi-writer visibility rule system. This is a genuinely new mechanism, not a re-implementation of anyone else's.                                                                          |
| Sizing/resizing           | **Not implemented** — `ColumnDef.width` "typed, sketched, not used," blocked on a presentation-fields ADR                                                                  | **Missing** vs. all four (all ship sizing in core)                                                                                                                                                                                                                                          |
| Pinning                   | **Not implemented** — `withColumnPinning()` "not yet started"                                                                                                              | **Missing** vs. all four (all ship pinning in core)                                                                                                                                                                                                                                         |
| Filter variants           | N/A (no filtering feature)                                                                                                                                                 | **Missing**, see Filtering below                                                                                                                                                                                                                                                            |
| Atomic layout persistence | **Not implemented** — no persistence of any column state                                                                                                                   | **Missing.** Ironically low-stakes right now since there's no sizing/pinning to lose yet — but per the audit's #3 cross-cutting gap, this is worth designing correctly from the start rather than retrofitting once sizing/pinning ship, given every competitor's retrofit attempt has bugs |

## Rows — selection and pinning missing; expansion on par; reordering missing

| Concern                                    | libs/shared/table                                                                                              | vs. the four                                                                                                                                                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection (single/multi)                   | **Not implemented** — no `withSelection()`, no selection state anywhere in `src/`                              | **Missing.** This is the single biggest baseline gap — all four libraries ship row selection in core, and it's the audit's #2-ranked developer pain point overall (selection × pagination/filtering scope). Nothing to even have the scope bug yet, but also nothing developers can build on. |
| Pinning (top/bottom)                       | Not implemented                                                                                                | **Missing** — though PrimeNG also has none, so this isn't uniquely behind                                                                                                                                                                                                                     |
| Expansion / tree data                      | `withExpansion()` — sub-rows, `everExpanded` ledger, ADR-0012 proposes splitting panel vs. tree (not yet done) | On par with TanStack/MRT; ahead of the "detail panel is a separate MRT-only concept" split in that `withExpansion()` already covers panel-like use today, though ADR-0012 flags this as needing a real split eventually                                                                       |
| Row reordering (drag)                      | Not implemented — `moveRow` has no verb, blocked on `withDragDrop()`                                           | Same gap as TanStack; behind AG Grid/PrimeNG (both ship built-in drag reorder)                                                                                                                                                                                                                |
| Row-removal reconciliation across features | ADR-0006 diff-and-prune mechanism                                                                              | **Ahead** — no competitor documents an equivalent generalized "notify every feature when rows disappear" hook; this is closer to solving the audit's #5 cross-cutting gap (edit rollback / state consistency) than anything in the four libraries                                             |

## Sorting — on par, ahead on null-ordering rigor

| Concern                     | libs/shared/table                                                                                            | vs. the four                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single/multi sort           | `withSorting({ multi })`, three-state toggle, `sortDirections`, `sortChanged`                                | On par with all four (same array-of-rules shape)                                                                                                                                                     |
| Custom comparator           | Per-column `sortFn`, `detectComparator` fallback                                                             | On par                                                                                                                                                                                               |
| Manual/server mode          | `withSorting({ manual: true })`                                                                              | On par — same shape as TanStack's `manualSorting`                                                                                                                                                    |
| Null/empty value ordering   | Explicit, shipped: `nulls: 'last'` default, `''` treated as real value unless opted out via `applySortNulls` | **Ahead** — none of the four libraries' docs mention a deliberate null-ordering contract; this is usually silent/undefined behavior elsewhere                                                        |
| Sort × grouping interaction | N/A — grouping doesn't exist yet                                                                             | Can't yet inherit the sort×grouping bug class the audit flags in TanStack/MUI X/AG Grid (#6 sentiment item) — worth testing for explicitly once grouping ships, as a chance to _not_ repeat that bug |

## Filtering — missing entirely

**Not implemented.** No `withFiltering()`, no column/global filter state, no
consumption of the already-typed `filterFn`/`enableFiltering` `ColumnDef`
fields. A full spec exists (`docs/1-state/features/filtering.md`, "drafted")
but zero code. This matches every competitor's baseline feature — TanStack,
AG Grid (Community tier), MRT, and PrimeNG all ship column + global filtering
in their free tier. **This is a real baseline gap**, not a nuance.

## Grouping & Aggregation — missing entirely (the feature that prompted this audit)

**Not implemented.** No `withGrouping()`, no `aggregateFn` consumption, no
`'group'` pipeline/render stage claimed (both slots reserved by
`PIPELINE_ORDER`/`RENDER_ORDER` but empty). A spec exists
(`docs/1-state/features/grouping.md`, "drafted") describing single-level
grouping (`grouping: string | null`) with per-column `aggregateFn`, composing
optionally with `withExpansion()` for collapse — this is a smaller, more
disciplined scope than any of the four libraries' full grouping models
(single-level vs. TanStack/AG Grid's arbitrary-depth nesting), which
sidesteps the audit's #4 cross-cutting gap (multi-level aggregation
correctness — TanStack's own unresolved depth-0 bug) by not attempting depth
at all in v1.

**This is the feature you originally flagged as unclear ("aggravation") and
confirmed as missing.** It's confirmed missing in `src/`, matching PrimeNG
(also computation-free) rather than TanStack/AG Grid (which compute it, with
TanStack having correctness bugs and AG Grid gating it behind Enterprise).

## Pagination — missing entirely

**Not implemented.** `docs/1-state/features/pagination.md` is a stub
("not yet drilled") — even the design isn't settled, let alone the code.
`RENDER_ORDER` reserves a `'paginate'` slot. All four competitors ship
pagination in their free/core tier — this is a baseline gap.

## Editing — the codebase's clear strength, ahead of all four

| Concern                                     | libs/shared/table                                                                                                                                                                                        | vs. the four                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cell/row edit state model                   | `withOptimistic()` (always-editable, rollback-only) and `withRowEdit()` (gated single/multi-row sessions with a commit-boundary `draft` signal), sharing one `EditingState` core                         | **Ahead of all four.** TanStack/MRT/PrimeNG/AG Grid all have _some_ edit-state model, but none separate "optimistic live editing" from "gated session editing" as two composable, independently-testable features sharing one core                                                                                                                                 |
| Dirty tracking / optimistic rollback / undo | `RowRestorePoint` (`row`, `at`, `detached`) makes rollback structurally sound including re-inserting a removed row at its original position; `swapRowId` handles the temp-id → server-id handoff cleanly | **Directly answers the audit's #5/#3 cross-cutting gap** — "nobody has a good answer for dirty tracking/rollback/undo-vs-server-rejection" was the single strongest sentiment finding (dev.to XState article, no vendor has shipped this). This codebase has a considered answer already in production via the `gated-*-optimistic`/`gated-*-pessimistic` stories. |
| Validation                                  | Deliberately not owned by the table (commit-boundary pattern via consumer's own Angular Signal Forms + `debounce`)                                                                                       | Same non-goal as all four (none ship validation state either) — but the _reason_ here is documented as a deliberate boundary (D1/D20/D43), not an oversight                                                                                                                                                                                                        |
| Bulk edit                                   | `createRow` bulk-add overload (array), but no bulk `removeRow`/`patchRow` (needs `withSelection()`, doesn't exist)                                                                                       | Blocked on the Rows-section selection gap above — worth sequencing selection before extending bulk-edit further                                                                                                                                                                                                                                                    |
| Move/reorder rollback                       | **G5 gap** — no rollback representation for a reordered row (blocked on `withDragDrop()`)                                                                                                                | N/A — no competitor supports row-order rollback either                                                                                                                                                                                                                                                                                                             |

## State persistence — missing entirely, unlike PrimeNG

**Not implemented.** No serialize/restore of any table state (sort, columns,
filters, pagination) to URL/localStorage/server. PrimeNG is the only
competitor with a _named_ API here (`stateStorage`/`stateKey`), and even it
has multiple confirmed correctness bugs (order-restore broken until 17.12.0,
width corruption, spurious restores). **The gap here isn't "behind PrimeNG" so
much as "nothing to compare yet"** — but per the audit's #3 cross-cutting gap,
this is worth designing as one atomic, round-trippable object from the start
once sizing/pinning/filtering/pagination exist, rather than retrofitting
piecemeal the way every competitor did.

## Server-side / manual modes — sorting only; two adjacent patterns are strong

| Concern                    | libs/shared/table                                                                                                                                          | vs. the four                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual` flag pattern      | Only `withSorting({ manual: true })` is real; filtering/grouping/pagination's planned `manual` contracts don't exist because the features themselves don't | **Behind** PrimeNG's single consolidated `[lazy]`/`onLazyLoad` contract and AG Grid's SSRM — but also avoids PrimeNG's specific bug class (duplicate `onLazyLoad` firing, #5480/#12595/#16182) simply by not having built it yet |
| Async column visibility    | `applyVisibleAsync()` — `resource()`-backed, required `onError`, no silent stale-hold                                                                      | **Ahead** — no competitor has an equivalent async, permission-driven column-state primitive                                                                                                                                      |
| Optimistic save round trip | `withOptimistic()`/`withRowEdit()` capture/release/revert cycle, battle-tested via stories                                                                 | **Ahead**, same as the Editing section above — this is effectively "server-side mode for row data," done well, while none of the four libraries' _state_ (sort/filter/group) server modes handle rollback this cleanly           |

## Priority ranking for what to build next

Ranked by (a) how foundational the gap is — do other features/consumers need
it — and (b) how directly it maps to the audit's cross-cutting pain points.

1. **Row selection** (`withSelection()`) — missing entirely, blocks bulk edit
   verbs already stubbed out (`removeRow(id[])`/`patchRow(id[], partial)`),
   and is every competitor's baseline feature. Design the selection-scope
   concept (page/filtered/all) deliberately from day one — the audit's #2
   sentiment finding is that nobody else has done this cleanly; there's a real
   chance to lead here rather than inherit the ambiguity.
2. **Grouping & aggregation** (`withGrouping()`) — the feature that prompted
   this audit. Spec already drafted, deliberately scoped to single-level
   (avoids the multi-depth correctness bugs plaguing TanStack). Composes with
   existing `withExpansion()`.
3. **Filtering** (`withFiltering()`) — spec already drafted, matches every
   competitor's baseline. `ColumnDef.filterFn`/`enableFiltering` fields
   already exist and are typed, just unconsumed.
4. **Pagination** (`withPagination()`) — currently just a stub doc; needs
   actual design work before it can be built, unlike filtering/grouping which
   are spec-complete.
5. **Column sizing + pinning** — both "not yet started," blocked on a
   presentation-fields ADR. Lower urgency than the four state-behavior
   features above since they're more visual/layout than state-behavior, but
   needed before column-state persistence has anything real to persist.
6. **State persistence** — deliberately last: design it once there's an
   actual "layout" (sizing/pinning/filters/pagination) worth persisting,
   informed directly by PrimeNG's `stateStorage` bug list in the audit so the
   same mistakes (order not restored, width corruption, spurious restores)
   aren't repeated.

## What's already a differentiator, worth protecting

- The optimistic/gated editing model (`withOptimistic()` + `withRowEdit()` +
  `RowRestorePoint` + ADR-0006 reconciliation) is a more considered answer to
  "dirty tracking, rollback, undo" than anything in the four libraries
  researched. Don't let future features (selection, grouping) bolt on in a
  way that weakens this.
- The declarative async column-visibility rule system (`columnsSchema` +
  `applyVisibleAsync`) has no equivalent in TanStack/AG Grid/MRT/PrimeNG —
  worth documenting as a selling point, not just an internal mechanism.
