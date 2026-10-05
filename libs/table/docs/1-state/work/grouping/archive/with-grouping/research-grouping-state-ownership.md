---
title: Research — who owns grouping state, and does manual mode force it out of the table
type: research
status: complete
date: 2026-09-09
audience: developers
issue: null
---

# Who owns grouping state

Companion question to [research-filter-state-ownership.md](../../../filtering/archive/with-filtering/research-filter-state-ownership.md):
does `withGrouping()`'s `manual: true` (server-side) mode create the same forcing function that
pushed filtering out of the table entirely into a standalone `createFilters()` primitive
([design-options-hybrid-api.md](../../../filtering/archive/with-filtering/design-options-hybrid-api.md), R10)?

Every table-library claim below was read from published docs or released source, not from
memory. Versions/URLs per row. Non-table state-owner conclusions (NgRx SignalStore, Signal Forms,
`MatTableDataSource`) are reused from the filtering doc's own survey rather than re-derived —
the "does this slice have life outside its host" test that doc establishes applies unchanged to
a group-by column choice, and re-running that survey would just reproduce it.

## Findings

| Library              | Version / source                                                                                                               | Where group-by state lives                                                                                                                                                                                                                                | External/standalone precedent?                                                                                                                                                                                                                         | Manual / server-side mode                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TanStack Table       | v8 docs (`tanstack.com/table/v8/docs/guide/grouping`)                                                                          | `state.grouping: string[]` — table state slice, ordered (multi-level)                                                                                                                                                                                     | **Optional controlled mode only** — `onGroupingChange` + your own `useState`, same mechanism as `columnFilters`. The value still has to be fed back in as `state.grouping`; there is no domain object that stands alone the way `createFilters()` does | `manualGrouping: true` — docs state the table then expects rows "manually grouped... before passing them to the table," and call the required custom implementation "substantial." No resource-shaped contract                                                                                                                       |
| AG Grid              | Community/Enterprise docs (`ag-grid.com/javascript-data-grid/grouping/`, `.../grid-state/`, `.../server-side-model-grouping/`) | `colDef.rowGroup: boolean` + `rowGroupIndex` (column-definition flags), snapshotted into `GridState.rowGroup`                                                                                                                                             | No — only whole-grid `gridApi.getState()`/`setState()`, no separate grouping-only API                                                                                                                                                                  | **SSRM**: grid still owns `rowGroup`/`rowGroupIndex` on colDefs; it calls `datasource.getRows(params)` with `rowGroupCols` + `groupKeys` in the params. This is an **imperative pull callback**, not a declarative `resource()` — the grid never has to exist "after" its own data, so there is no construction-order cycle to solve |
| PrimeNG `p-table`    | `primeng.dev/table`                                                                                                            | `groupRowsBy` — single-field `@Input`, plus `rowGroupMode`                                                                                                                                                                                                | No — no injectable grouping service (unlike `FilterService` for filters)                                                                                                                                                                               | Not documented; no lazy/server-side grouping contract found                                                                                                                                                                                                                                                                          |
| Material React Table | `material-react-table@3.2.1`, verified from source (`dist/index.js:1507`, `:1536`)                                             | Pass-through: `manualGrouping`/`state.grouping` forwarded unchanged into TanStack's `useReactTable` options. `groupedColumnMode` (`'remove'\|'reorder'\|false`) is MRT's own addition, but it's a column-visibility UX flag, not a state-ownership change | No                                                                                                                                                                                                                                                     | Identical to TanStack — passed straight through, same caveats                                                                                                                                                                                                                                                                        |

Sources: [TanStack grouping guide](https://tanstack.com/table/v8/docs/guide/grouping) ·
[AG Grid row grouping](https://www.ag-grid.com/javascript-data-grid/grouping/) ·
[AG Grid grid state](https://www.ag-grid.com/javascript-data-grid/grid-state/) ·
[AG Grid SSRM grouping](https://www.ag-grid.com/javascript-data-grid/server-side-model-grouping/) ·
[PrimeNG table docs](https://primeng.dev/table) ·
material-react-table 3.2.1 `dist/index.js` (npm-packed and read directly, lines cited above).

## Is there any precedent for a standalone grouping primitive?

**No — not in any of the four.** Grouping is universally a column-definition flag or a table-state
slice, never a domain object living outside the table/grid instance the way `createFilters()`
now does. Say this plainly rather than hedge it: none of TanStack, AG Grid, PrimeNG, or MRT model
group-by choice as anything other than "part of the table."

**But that absence doesn't answer the actual question**, because none of these four share the one
constraint that forced `createFilters()` out in the first place.

## Why "no precedent" doesn't settle it — R10's argument is architecture-specific, and transfers anyway

R10's forcing reasoning (`design-options-hybrid-api.md`, read directly): if filter state lived
inside `withFiltering()`, and server mode needs `resource({ params: () => table.filters() })` to
build the request that produces the data, you hit a construction cycle — `table` needs `data`,
`data` (the resource) needs `filters`, and `filters` would need to come from `table`. The code
cannot be written.

None of the four researched libraries have this problem, and it's not because they solved it —
it's because none of them share this repo's `createTable(data, optsFn)` shape, where `data` is a
**required constructor argument** resolved before the feature's own state exists:

- **AG Grid avoids it structurally.** `datasource.getRows(params)` is an imperative pull callback
  the grid invokes whenever its own state changes — the grid is already fully constructed with
  `rowGroup` colDefs before it ever calls the datasource. There is no "build the grid from data
  that depends on the grid" step.
- **TanStack/MRT avoid it by not solving server-mode at all.** `manualGrouping` just skips the
  client-side `getGroupedRowModel()` call and leaves you to construct rows however you want,
  before or after the table — React's `useReactTable(options)` doesn't have Angular's
  injection-context-at-construction constraint forcing a specific build order.

**The R10 argument is not "filters are special," it's "a manual/server-mode feature whose state
must feed the request that produces `data` cannot live inside a feature composed on
`createTable(data, ...)`."** `withGrouping({ manual: true })` is exactly that shape: to fetch
server-grouped rows you need `resource({ params: () => table.grouping() })`, which needs `table`,
which needs `data`, which is the resource's own output. Identical cycle, same root cause,
independent of what any competitor does — because the competitors don't share the constraint that
creates it.

Client-side grouping does not have this problem (`data` already exists locally; `withGrouping()`
composing on the already-known `data` signal is fine), exactly as client-side filtering never
had it either — R10 only bites in `manual: true` mode.

## Consequences for the API

1. **The "does this slice have life outside the table" test alone would say store-owned**, same
   conclusion filtering's Options A–D reached before R10 overturned it — a group-by column choice
   is meaningless without knowing the table's columns, same category as `columnFilters`, not
   `query`. Don't stop at this test; it's necessary but not sufficient, exactly as it was for
   filtering.
2. **Manual/server-side grouping needs the same treatment R10 gave filters** — either a
   standalone `createGrouping()`-shaped primitive the consumer holds and feeds into a `resource`,
   or some other way to resolve `grouping` before `data` is constructed. Client-side grouping can
   stay a normal `with*()` feature composed on `createTable(data, ...)`; only the manual path is
   structurally blocked as currently spec'd (`grouping.md`'s manual contract — "consumer's own
   `effect()` fetches pre-grouped data" — is the same effect-based shape R10's doc explicitly
   calls out as wrong: "an effect writing a signal is not" the reactive shape a resource wants).
3. **No competitor API to borrow the shape from** — if a standalone primitive is built, its shape
   has to come from this repo's own `createFilters()`/`createTable()`/`columnSchema()` precedent
   (as R10's own doc did), not from AG Grid/TanStack, since none of them needed one.

## Not researched

- Whether `manualGrouping` is genuinely used server-side in production TanStack apps, or is a
  rarely-exercised escape hatch (the docs' own "substantial custom implementation" language
  suggests the latter, but that's a strength-of-precedent point, not a settled fact).
- AG Grid's SSRM group ordering/aggregation request shape beyond `rowGroupCols`/`groupKeys` — out
  of scope for state ownership; a sibling doc covers ordering.
- Whether a `withGrouping({ manual: true })` cycle could be avoided by a smaller fix (e.g. an
  optional `grouping` seed argument to `createTable()` itself) rather than a full standalone
  primitive — worth a design pass, not a research question.
