# State-layer competitive feature audit

Research date: 2026-09-05 (PrimeNG added same day). Scope: state-layer only (data
handling, columns, rows, sorting, filtering, grouping/aggregation, pagination,
editing, state persistence, server-side modes) — UI/rendering/theming excluded.
Sources: TanStack Table v8, AG Grid (Community + Enterprise), Material React
Table (MRT), PrimeNG `p-table` — docs + GitHub issues/discussions for each —
plus developer-sentiment research across GitHub issues, forums, and articles.

This is research input only — **no comparison against `libs/shared/table`'s
current state layer yet**. That comparison is the next step.

PrimeNG was added because it's Angular-native (this repo's framework), unlike
the React-first TanStack/AG Grid/MRT surfaces, and its state model uses
distinct vocabulary (`dataKey`, `stateStorage`, `TableLazyLoadEvent`) worth
comparing directly rather than folding into the others' rows.

## Data handling

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Row model pipeline (filter→group→sort→expand→paginate stages) | Core, composable | Client-Side RM (default) | Same as TanStack | Internal `_value`/`filteredValue`/`processedData` derivation |
| Server-side row model (lazy blocks, delta loading) | Manual flags only | Full SSRM (**Enterprise**) | Manual flags only | `[lazy]` + single `(onLazyLoad)` event carrying page/sort/filter |
| Infinite/viewport row models | Not built-in | Infinite (Community), Viewport (**Enterprise**) | Not built-in | Not built-in — `[virtualScroll]` can combine with `[lazy]` for on-demand fetch |
| Transactions (add/remove/update without full re-render) | Not built-in — consumer-owned | `applyTransaction`/`applyTransactionAsync`, immutable mode via `getRowId` | Not built-in | Not built-in — replacing `[value]` re-derives everything from scratch |
| Faceted values (unique/min-max, feeds filter UI) | `getFacetedUniqueValues`/`getFacetedMinMaxValues` | N/A (set filter handles this internally) | Auto-wires TanStack's faceted fns to filter variants | Not built-in |
| Virtualization state | Explicitly out of scope (delegate to TanStack Virtual) | Built-in (row+column) | Wraps TanStack Virtual, exposes as state | Built-in (`virtualScrollItemSize`) |
| Row identity key | `getRowId` | `getRowId` | `getRowId` | `dataKey` — shared across selection/expansion/editing/reorder/state-persistence |

Gap pattern: transaction/delta fragility is real even in AG Grid (issues #2705, #10206) —
no library has this fully solved. PrimeNG has no transaction API at all; every
`[value]` replacement is a full re-derivation.

## Columns

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Sizing/resizing | Core (`ColumnSizingState`) | Core + auto-size strategies | Same as TanStack | Core, two modes (`fit`/`expand`) |
| Pinning (left/right) | Core | Core | Same as TanStack | "Frozen columns" (`frozenColumns`, `frozenWidth`, per-column `alignFrozen`) |
| Ordering/reordering | Core, no DnD (state only) | Core + built-in drag | Same as TanStack + drag transient state | Core, built-in drag (`reorderableColumns`) |
| Visibility | Core | Core | Same as TanStack | **Not table-internal** — no hidden flag on `Column`; app renders a filtered subset itself |
| Header/column groups | Core | Core | Same | Declarative only (`ColumnGroup`/`colgroup`) — no runtime API to mutate group membership |
| Column state save/restore as one atomic object | No single API — pieces only | `getColumnState()`/`applyColumnState()` — closest to "one coherent object" | No built-in persistence at all | `stateStorage`/`stateKey` persists width/order — but order was broken until 17.12.0 (#14888), width corrupted in `expand` mode (#12398) |
| Filter variants (select/range/date/checkbox mapped to filterFn) | Not built-in | Built-in per filter type | MRT-added, no TanStack equivalent | Built-in `matchMode` per data type |

Gap pattern (biggest one from sentiment research): column-state persistence is
"broken or partial almost everywhere" even where an API exists — AG Grid's own
`applyColumnState` has open bugs (#4405, #4427, #7450), and PrimeNG's
`stateStorage` had a *confirmed* column-order restore bug live until 17.12.0
(#14888) plus an still-open width-corruption bug in `expand` resize mode
(#12398). Worth getting right, not just present.

## Rows

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Selection (single/multi) | Core, sub-row cascade | Core + group-aware/SSRM propagation (**Enterprise** for grouped) | Same as TanStack + `selectAllMode: 'all'\|'page'` | Core — single/multiple/checkbox/radio, range via shift-click, `selectionPageOnly` |
| Selection scope (page vs filtered vs all) | Broken/ambiguous under server pagination (top sentiment complaint) | `selectAll` modes exist for SSRM | `selectAllMode` exists | `selectionPageOnly` flag exists — same shape as MRT/AG Grid's partial answer |
| Pinning (top/bottom) | Core | Core (Community) + UI (Enterprise) | Core + `rowPinningDisplayMode` | **Not supported** — no frozen-row equivalent to frozen columns |
| Expansion / tree data / sub-rows | Core | Tree Data (**Enterprise**) | Same as TanStack + separate detail-panel concept | Core (`expandedRowKeys` keyed by `dataKey`) — but lazy-loaded expansion content doesn't reliably re-fire after state restore (#7526); `expandedRowKeys` binding reported broken in 17.13.0 (#15257, version-specific) |
| Row reordering (drag) | Not built-in — no `RowOrderState` | Built-in (Community) | Transient drag state only, no persisted `rowOrder` | Built-in (`reorderableRows`, `(onRowReorder)` gives `{dragIndex, dropIndex}`) — consumer still commits the reorder to `[value]` |
| Master-detail | N/A | **Enterprise** | N/A | N/A |

Gap pattern: row-selection-scope ambiguity is the single most-cited pain point
across all libraries (TanStack #6079/#4781, Tabulator #3715, DataTables
forums) — PrimeNG's `selectionPageOnly` is the same half-answer as AG
Grid/MRT's scope flags, not a general solution. PrimeNG is also the only
library of the four with **no row-pinning** primitive at all.

## Sorting

All four: core multi-sort array state (`multiSortMeta`/`SortingState`/etc.),
custom comparator/sortingFn (PrimeNG: `customSort` + `(sortFunction)`),
`manualSorting`-style escape hatch (PrimeNG: sort fields folded into the single
`onLazyLoad` payload rather than a separate flag). No meaningful
differentiation. Known cross-cutting bug class: sort × grouping interaction
(secondary-level sort broken) recurs in TanStack, MUI X, AG Grid alike — worth
testing explicitly if grouping+sorting are combined.

## Filtering

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Column filters | Core, custom `FilterFn` | Core (text/number/date), Set filter (**Enterprise**) | Core + `columnFilterFns` (runtime-switchable filter mode per column) | Core, per-data-type `matchMode` enum (contains/startsWith/equals/...) |
| Global/quick filter | Core | Core (Client-Side RM only) | Core | Core (`globalFilterFields`, `filterGlobal()`) |
| External/advanced filter | N/A | External (Community), Advanced (**Enterprise**) | N/A | N/A |
| Combined global+column filter serialization/persistence | Not built-in — explicit doc punt to "roll your own" | Part of `getState()` | Not built-in | Part of `stateStorage` payload — but triggers a redundant internal save-state write on restore (#6969) |

Gap pattern: no library ships a clean serialization format for combined filter
state across navigation — PrimeNG comes closest structurally (it's part of the
same `stateStorage` blob as everything else) but the restore path has its own
correctness bugs, same pattern as column state above.

## Grouping & aggregation

Definition: grouping rows by column value, then computing a rolled-up value
(sum/avg/count/min/max/custom) per group, shown on the group's summary row, at
potentially multiple nesting levels.

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Grouping state | Core (`GroupingState`) | **Enterprise only** | Core (same as TanStack) | Core (`rowGroupMode: 'subheader'\|'rowspan'`, `groupRowsBy`) |
| Built-in agg functions | sum/count/min/max/mean/median/unique/uniqueCount/extent | sum/min/max/count/avg/first/last | Same 9 as TanStack | **None** — footer/summary templates render whatever the consumer pre-computes |
| Custom agg functions | Core registry | Core registry (**Enterprise**) | Core (from TanStack) | N/A — there's no aggregation registry to customize; it's all consumer-side |
| Multi-level nested aggregation | Buggy — only depth-0 resolves correctly (#3323, #3232) | Full support, incl. grand totals | Rendering layer over TanStack's (same depth-0 bug likely inherited) | N/A (no built-in aggregation to be buggy at) |
| Pivoting (rotate grouped values into columns) | Not supported | **Enterprise** | Not supported | Not supported |
| Server-side grouping | Discouraged/awkward in both TanStack and MRT — no robust `manualGrouping` | Full SSRM support (**Enterprise**) | Same gap as TanStack | Not part of `TableLazyLoadEvent` at all — consumer must pre-group server-side data with no contract for it |
| Grouping perf at scale | Weak — was ~30s/50k rows pre-fix, still ~2-10x slower than AG Grid in benchmarks | Fast, designed for it | Inherits TanStack's engine | Untested/unbenchmarked in research — client-side grouping only |

Aggregation is a real, standard state-layer feature — grouping + per-group
summary calculation. It's AG Grid's headline Enterprise differentiator;
TanStack has it in core but with known correctness bugs beyond depth 0.
**PrimeNG has the weakest story of the four here — it provides row grouping as
a state/rendering concept but zero aggregation computation**, pushing 100% of
the "aggravation" work back to the consumer. Likely the biggest actual gap if
`libs/shared/table` doesn't have grouping/aggregation yet.

## Pagination

All four: page-index/page-size state, client vs. manual/lazy server flag
(PrimeNG: `[paginator]`+`[rows]`+`[first]` client-side, `[lazy]`+`[totalRecords]`
server-side). No real differentiation. AG Grid's and PrimeNG's pagination state
both fold into their respective unified state blobs (`getState()` /
`stateStorage`). Note from PrimeNG research: mixing `[lazy]` with client-only
assumptions about `totalRecords` is a common integration bug source — a
state-modeling footgun, not a library defect.

## Editing

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Cell/row edit state model | None — fully DIY | Full (`editable`, full-row mode, `cellEditRequest` for external-owned mutation) | Full (`editingRow`/`editingCell`/`creatingRow`, display modes: modal/row/cell/table) | Full — `pEditableColumn` (cell) and `editMode: 'row'` + `pEditableRow` (row), both with init/complete/cancel lifecycle events |
| Undo/redo | None | Core (cell edits); clipboard/fill undo needs **Enterprise** | None | None |
| Validation state | None | Partial (`valueSetter` returns false, or full-row validation callback) | None built-in — DIY via field handlers | None built-in — DIY via edit-event handlers |
| Dirty tracking / optimistic rollback | None | None documented | None | None |
| Dialog-based editing | N/A (render-agnostic) | Consumer pattern | Modal display mode built-in | **Not built-in** — only inline cell/row editing ships; dialog editing is a fully consumer-built pattern |

Gap pattern (strong signal from sentiment research): dirty-tracking +
optimistic/pessimistic rollback + undo-stack reconciliation is called out as
architecturally unsolved everywhere — cited as needing a state machine (a
dev.to article on a production table editor), not just more props. PrimeNG's
inline edit lifecycle events (`onEditInit`/`onEditComplete`/`onEditCancel`) are
a clean primitive but carry zero validation/dirty/rollback state of their own,
same gap as the other three.

## State persistence

Not previously called out as its own category — PrimeNG is the only one of
the four with an explicit, named persistence feature (`stateStorage`), so it's
worth comparing directly rather than folding into "columns"/"filtering".

| Feature | TanStack | AG Grid | MRT | PrimeNG |
|---|---|---|---|---|
| Named persistence API | None (DIY: `onStateChange` + your own storage) | `getState()`/`setState()`/`initialState` — closest to a real API | None (Discussion #469 requests it, unresolved) | `[stateStorage]="'session'\|'local'"` + `[stateKey]` — auto save/restore on init/destroy |
| Slices actually covered | N/A | Column state, filter, sort, row group, pivot, selection, pagination, scroll, focus, sidebar (~23 slices) | N/A | Pagination, sort, filters, column widths, column order declared — but selection and expansion are **not** part of the persisted slice set (must persist manually) |
| Custom storage backend | N/A | Not built-in — DIY | N/A | Not supported — session/local only, open feature request (#14461) |
| Restore correctness | N/A | Post-init reapply gap (#7445); row order not captured (#11492) | N/A | Multiple confirmed regressions: column order broken until 17.12.0 (#14888); width corrupted in `expand` mode (#12398); spurious restore attempts for properties that don't apply to the current config (#9076); redundant save-state write during restore (#6969); state not resynced when `columns` input array is replaced (#8902) |

PrimeNG shipping a *named* persistence feature and still accumulating this
many correctness bugs is the strongest evidence yet for the cross-cutting gap
below: **atomic, round-trippable layout state is genuinely hard**, not a
solved problem any of these four libraries can be copied wholesale.

## Server-side / manual mode flags

TanStack/MRT: `manual{Sorting,Filtering,Pagination,Grouping,Expanding}`
booleans, pre-processed data assumed. AG Grid: structural via SSRM
(Enterprise-gated). PrimeNG: a single `[lazy]` flag plus one `(onLazyLoad)`
event carrying `TableLazyLoadEvent` (offset/rows/sortField/sortOrder/
multiSortMeta/filters/globalFilter) — the most consolidated shape of the four,
but with its own reliability bugs: `onLazyLoad` reported firing twice on init
when `multiSortMeta` is set (#5480) and again with dynamically-bound
`sortField` (#12595), plus a further open duplicate-firing report (#16182) —
consumers commonly need to debounce/guard the handler. Grouping and row
expansion are notably **not** part of `TableLazyLoadEvent`'s contract, so
lazy+grouping and lazy+expansion are unsupported combinations by default.

## Cross-cutting gaps worth flagging before the comparison step

1. **Selection scope** (page/filtered/all) — universal pain point, no clean primitive anywhere; PrimeNG's `selectionPageOnly` is the same half-answer as the others.
2. **Atomic column-layout persistence** (size+order+pin+visibility+grouping as one round-trippable object) — everyone ships pieces, restore bugs are common even where "supported" (PrimeNG's `stateStorage` included).
3. **Aggregation correctness/existence** — TanStack has depth->0 bugs; PrimeNG has none at all (rendering only). AG Grid is the only one that gets this fully right, and it's paywalled.
4. **Editing dirty-state/rollback/undo** — nobody has a good answer across all four; could be a differentiator rather than a gap to close.
5. **Filter-state serialization** (global+column combined, across navigation) — DIY everywhere except PrimeNG's `stateStorage`, which has its own restore bugs.
6. **Lazy/server-side event reliability** — PrimeNG's single-event lazy contract is the cleanest shape of the four but has multiple duplicate-firing bugs; worth a debounce/guard pattern regardless of implementation.

## Developer sentiment: prioritized pain points (state-layer only)

Ranked by frequency of occurrence across GitHub issues/discussions and articles.

1. **Row selection × pagination/filtering interaction** — most pervasive gap.
   No library has a first-class "selection scope" concept (page vs
   filtered-result vs all-data).
   (TanStack #6079, #4781, #5850, Discussions #3619/#2661; Tabulator #3715/#2428; DataTables forums #79797/#10103)
2. **Column-state persistence (layout save/restore)** — broken or partial almost everywhere.
   No library has one coherent, atomic "layout state" object that round-trips correctly.
   (AG Grid #4405/#4427/#7450/#1540/#823/#1648/#4860; PrimeReact #7742/#3150; PrimeNG #14888/#12398/#6969/#9076/#14461/#8902; TanStack #5097)
3. **Row editing state (dirty tracking, optimistic/pessimistic rollback, undo/redo)** —
   architecturally hard, not just missing. No library has a documented answer
   for "undo stack vs. server rejection" interaction.
   (dev.to "Building a Production-Grade Table Editor with React and XState"; `react-use-table-editor` community package; MRT/AG Grid/PrimeNG gaps as above)
4. **Server-side/async data handling: transaction and delta-update fragility**.
   AG Grid's own internal state described as fragile across page/data-model changes ("the sad internal state of AG Grid," #2932).
   (AG Grid #2705, #10206, #10192, #2713; TanStack #1259, #1316, #2348, Discussion #3401)
5. **Grouping/aggregation correctness and performance, especially nested**.
   (TanStack #3323, #3232, #3968, #5822, PR #4495; sort × grouping bugs: MUI X #16540/#12684/#8493, AG Grid #7850)
6. **Filtering state composition** (global + per-column, plus persistence across navigation) — no serialization format ships anywhere cleanly.
   (TanStack Discussion #5145; PrimeNG #6969)
7. **Duplicate/unreliable server-side event firing** — PrimeNG's `onLazyLoad` firing twice under certain sort/init configs is a distinct failure mode from the transaction fragility above: not stale state, but redundant fetches consumers must guard against.
   (PrimeNG #5480, #12595, #16182)
8. **Virtualization × state recalculation** — every state change forces full virtualized recompute in TanStack; consumers push to manual memoization.
   (TanStack Virtual #729)
9. **Undo/redo / transaction history as a general table concept** — only AG Grid ships built-in undo/redo, and it's edit-scoped only, not spanning selection/filter/sort/data together.

## Next step

Compare this inventory against `libs/shared/table`'s current state layer
(`src/api/`, `src/engine/`) to identify actual gaps and prioritize.
