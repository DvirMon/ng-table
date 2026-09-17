---
title: PRD — NGP Table State Layer (createTable)
type: spec
version: 1.0
date: 2026-07-19
status: ready-for-agent
audience: implementer
source_docs:
  - overview.md
  - 1-state/architecture.md
  - columns.md
  - with-sorting.md
  - with-grouping.md
  - with-expansion.md
  - with-filtering.md
---

# PRD — NGP Table State Layer (`createTable`)

## Problem Statement

Teams building data-heavy screens across the product each hand-roll their own table logic — sorting, filtering, grouping, row expansion — as bespoke component code. This leads to duplicated logic, inconsistent behavior between screens (e.g. one table's sort cycles differently than another's), no shared or tested implementation of common table state concerns, and no established pattern for splitting client-side vs. server-side processing. Every team currently re-solves the same problems independently.

## Solution

Provide `createTable()` — a signal-based, tree-shakeable table state layer in the shared design system. Consumers compose only the features they need (`withSorting()`, `withGrouping()`, `withExpansion()`, `withFiltering()`) alongside required core config (`trackBy`, `columns`). The internal implementation is an in-house composer over Angular signals (`composeTable()`, ADR-0003; originally `@ngrx/signals`, replaced 2026-08-11), but this is never exposed — consumers only ever interact with the `createTable()` public API, so the internal state-management implementation can change without a breaking change. Each feature supports an independent `manual` flag so client-side and server-side processing can be mixed per concern (e.g. server-side filtering with client-side sort).

This PRD covers the **state layer only** — the four already-drilled features (`withSorting`, `withGrouping`, `withExpansion`, `withFiltering`) plus the required `columns` core config. The companion UI/directive layer (Layer 1, native-HTML attribute directives like `ngpTable`/`ngpTableColumn`) and four additional features (`withSelection`, `withPagination`, `withInfiniteScroll`, `withDragDrop`) are explicitly out of scope — see "Out of Scope."

## User Stories

**Core store & columns**

1. As a design-system consumer, I want a single `createTable()` factory, so that I never need to import or understand the underlying state-management engine directly.
2. As a design-system consumer, I want to compose only the table features I need as trailing positional arguments to `createTable()`, so that unused feature code is tree-shaken from my bundle.
3. As a design-system consumer, I want to declare `trackBy` as a string shorthand (e.g. `'id'`) or a function, so that I can support both simple and composite row identities.
4. As a design-system consumer, I want the string-shorthand `trackBy` normalized to a function once at store initialization, so that there's zero branching overhead at render/comparison time.
5. As a design-system consumer, I want `columns` to be required core config rather than an opt-in feature, so that every table has a consistent, always-present column model to build on.
6. As a design-system consumer, I want each column definition to require an explicit `accessor` function (no string-key shorthand), so that value extraction is unambiguous and type-safe even for computed/nested values.
7. As a design-system consumer, I want to call `updateColumns(table, setColumns(defs))` to replace the full column list at runtime, so that I can support dynamic column configuration (e.g. user-customizable table layouts).
8. As a design-system consumer, I want to call `updateColumns(table, reorderColumns(ids))` to change column order at runtime, so that I can support drag-to-reorder column headers without recreating the store.
9. As a design-system consumer, I want to call `updateColumns(table, toggleColumnVisibility(id))` to show/hide a column at runtime, so that I can offer a column-visibility toggle UI.
10. As a design-system consumer, I want a feature that reads another feature's member to be typed only when that feature is composed before it, so that the ordering mistake is a build error rather than a silent runtime bug. *(Settled by #33: argument order governs type-level member visibility; there is no compile-time "requires" declaration, and no feature fails to compile for a missing sibling.)*
11. As a design-system consumer, I want to update my own `data` signal with raw row data, so that the store runs it through the composed pipeline (filter → group → sort → expand) automatically.
12. As a design-system consumer, I want to create each table with `createTable(data, config, ...features)` as a component-level instance (no `providers` / `inject()`), so that multiple tables on one page never share state unintentionally — the instance is owned by the component that creates it. (See ADR-0002; route/root-shared scoping is intentionally not offered.)

**Sorting**

13. As an end user, I want to click a column header to sort ascending, click again for descending, and click again to clear the sort, so that I get predictable three-state control over sort order.
14. As an end user, I want to sort by clicking multiple headers in sequence, so that I can express priority ordering (e.g. sort by status, then by name).
15. As a design-system consumer, I want to supply a custom `sortFn` per column, so that I control comparison logic for complex or non-primitive values.
16. As a design-system consumer, I want a sensible built-in comparator fallback when I don't supply `sortFn`, so that simple string/number/date columns sort correctly with zero configuration.
17. As a design-system consumer, I want to disable sorting on a column via `enableSorting: false`, so that non-sortable columns (e.g. an actions column) ignore header clicks.
18. As a design-system consumer, I want `withSorting({ manual: true })`, so that I can delegate row ordering to my server while the store still tracks sort UI state and fires `sortChanged`.
19. As a design-system consumer, I want `setSorting()` / `clearSorting()`, so that I can drive sort state programmatically (e.g. restoring a saved view).

**Grouping**

20. As an end user, I want to group rows by a single column, so that I can see my data organized into collapsible categories.
21. As an end user, I want each group to show an aggregated summary per column, so that I get at-a-glance totals without manual calculation.
22. As a design-system consumer, I want to supply a custom `aggregateFn` per column, so that I control exactly how group summaries are computed.
23. ~~As a design-system consumer, I want `withGrouping()` to require `withExpansion()` at compile time~~ — **withdrawn 2026-07-31.** `withGrouping()` composes standalone for static grouping and reads `expandedRows` as a lazy guarded read, typed only when `withExpansion()` precedes it.
24. As a design-system consumer, I want `withGrouping({ manual: true })`, so that I can delegate grouping to my server while the store still fires `groupChanged`.
25. As a design-system consumer, I want `setGrouping()` / `clearGrouping()`, so that I can drive the active group-by column programmatically.

**Expansion**

26. As an end user, I want to expand a row to reveal nested child rows, so that I can drill into hierarchical/tree-structured data.
27. As an end user, I want to expand multiple rows simultaneously without others auto-collapsing, so that I can compare several expanded rows/groups at once.
28. As a design-system consumer, I want `toggleExpanded()`, `expandAll()`, and `collapseAll()`, so that I can control expansion state programmatically (e.g. a "collapse all" toolbar action).
29. As a design-system consumer, I want a `rowExpanded` event fired on every expand/collapse change, so that I can lazy-load a row's children on first expand.
30. As a design-system consumer, I want `withExpansion()` to have zero compile-time dependencies beyond the global `trackBy`, so that I can use expansion independently of grouping, sorting, or filtering.
31. As a design-system consumer, I want group-row collapse/expand state to reuse the same `expandedRows` set as row expansion (no separate state in `withGrouping()`), so that the mental model for "expanded" stays single and consistent across the table.

**Filtering**

32. As an end user, I want to filter rows via a per-column filter, so that I can narrow results on a specific field.
33. As an end user, I want a single global/quick-search filter that matches across all columns, so that I can search without knowing which column holds the value.
34. As an end user, I want active column filters and the global filter to combine with AND logic, so that filtering behaves predictably as I narrow further.
35. As a design-system consumer, I want to supply a custom `filterFn` per column, so that I control match logic beyond simple string containment.
36. As a design-system consumer, I want to disable filtering on a column via `enableFiltering: false`, so that non-filterable columns are excluded from both column and global filter matching.
37. As a design-system consumer, I want `setColumnFilter()`, `clearColumnFilter()`, `setGlobalFilter()`, and `clearFilters()`, so that I can drive filter state programmatically (e.g. a "clear all filters" action).
38. As a design-system consumer, I want `withFiltering({ manual: true })`, so that I can delegate filtering to my server while the store still fires `filterChanged`.

**Cross-cutting**

39. As a design-system consumer, I want every in-scope feature to support an independent `manual` flag, so that I can mix client-side and server-side processing per concern.
40. As a design-system consumer, I want the reactive pipeline to run in a fixed, documented order (filter → group → sort → expand), so that behavior is predictable when multiple features are combined on one table.
41. As a design-system consumer, I want the store to never require importing a state-management library in my own code, so that swapping the internal state-management implementation later is not a breaking change for me. **Validated 2026-08-11**: `@ngrx/signals` was swapped out for an in-house engine (ADR-0003) with zero consumer diff.

## Implementation Decisions

- **No runtime dependency:** the state layer runs on `composeTable()`, an in-house composer over Angular signals living beside the table source. (Originally `@ngrx/signals`, added for this feature and removed 2026-08-11 — see ADR-0003 for why.)
- `createTable(data, config, ...features)` returns a live store **instance**, created inside an Angular injection context (a component field is the norm ⇒ component-scoped, torn down with the component). No DI token is produced; route-/root-shared scoping is intentionally not offered. Outside an injection context (service/test), pass `config.injector`. See ADR-0002.
- Core config: `trackBy` (`string` shorthand or `(row) => key` function, normalized to a function once at store init) and `columns: ColumnDef[]` (required — always present, not an opt-in feature).
- `data` is `TableDataInput<TRow> = WritableSignal<TRow[]>` and *is* the row set — the engine holds no internal copy, so there is nothing to drift. A `computed()` or `resource`/`httpResource`-backed source can no longer be passed directly; the consumer copies into a writable signal first (the same `effect()` they already write for the server-side `manual` flow).
- `ColumnDef<TRow>`: `id`, `accessor: (row: TRow) => unknown` (function-only, no string shorthand), `visible: boolean`, `order: number`, plus feature-contributed optional fields populated only when the corresponding feature is registered: `sortFn`, `enableSorting` (default `true`), `aggregateFn`, `filterFn`, `enableFiltering` (default `true`). Single source of truth lives directly on the column def — no separate `columnOrder[]`/`columnVisibility{}` slices (rejected alternative, per architecture doc).
- Column mutation: free functions taking the store first — `updateColumns(table, setColumns(defs))`, `updateColumns(table, reorderColumns(ids))`, `updateColumns(table, toggleColumnVisibility(id))`. Not store methods.
- Feature composition: `withSorting()`, `withGrouping()`, `withExpansion()`, `withFiltering()` are independent tree-shakeable feature functions passed as trailing positional arguments to `createTable(data, config, ...features)`. No feature call carries a row type — it is inferred from `data`. No compile-time dependencies exist among these four features; all read `columns` config directly rather than declaring a feature dependency on it. `withGrouping()` reads `withExpansion()`'s `expandedRows` when it is composed to its left, as a lazy guarded read — optional at runtime, typed only in that order.
- **Reactive pipeline, fixed order:** `data()` (the consumer's own `WritableSignal<TRow[]>`, the single source of truth — no internal copy) → filtering (skipped if `withFiltering({ manual: true })`) → grouping (skipped if manual) → sorting (skipped if manual) → expansion → rendered row output signal. Because filtering always runs before grouping in this pipeline, **`aggregateFn` always receives post-filter rows** — this resolves the open question in `with-grouping.md`/`with-filtering.md` structurally; there is no "aggregate over unfiltered rows" code path to build.
- **`manual` contract (uniform across all four features):** the feature's setter methods (`setSorting`, `setGrouping`, `setColumnFilter`, etc.) still update local state immediately and still fire the feature's `*Changed` event. The store simply skips its own client-side processing stage for that pipeline step. The consumer is responsible for wiring their own `effect()` to react to the emitted event/state and write server-processed data into their own `data` signal. No loader/fetch abstraction exists inside the store itself.
- `withSorting()`: `sorting: SortRule[]` (`{ columnId, direction: 'asc' | 'desc' }`), ordered array = priority order. `toggleSort(columnId)` cycles a column through ascending → descending → unsorted (removes the rule); always additive (no modifier key), array position set by click sequence. `setSorting(rules)`, `clearSorting()`. Built-in comparator fallback when `sortFn` is omitted: inspect the first non-null value for the column — `Date` instance → compare via `.getTime()`; `number` → numeric compare; otherwise → locale string compare via `.toString()`. `enableSorting: false` makes `toggleSort` a no-op for that column.
- `withGrouping()`: single-level only — `grouping: string | null` (one active group-by column, not `string[]`; corrects an earlier multi-level sketch). `setGrouping(columnId | null)`, `clearGrouping()`. No `enableGrouping` opt-out (every column can be grouped by — deliberate). Group collapse/expand state is **not** duplicated in this feature; it is fully delegated to `withExpansion()`'s `expandedRows` set (group rows are tracked by id in the same set as regular row expansion).
- `withExpansion()`: `expandedRows: Set<RowId>`, multi-expand (no auto-collapse of siblings), hierarchical/tree-capable via an optional `children: Row[]` property on row data. `toggleExpanded(rowId)`, `expandAll()`, `collapseAll()`. Fires `rowExpanded` on every expand/collapse change (single event, direction inferable from current `expandedRows` state — no separate collapse event). No compile-time dependencies beyond the store's global `trackBy`.
- `withFiltering()`: `columnFilters: FilterRule[]` (`{ columnId, value }`) + `globalFilter: string`. Column filters use a custom `filterFn(value, filterValue) => boolean`. Global filter default match is **case-insensitive string-contains** against every column's `accessor(row)` value (no custom global override, no fuzzy matching, no built-in debounce — if a consumer wants debounced global search, they debounce their own input before calling `setGlobalFilter`). All active filters (every column filter + the global filter) combine with AND logic. `setColumnFilter(columnId, value)`, `clearColumnFilter(columnId)`, `setGlobalFilter(query)`, `clearFilters()`. `enableFiltering: false` excludes a column from both column-specific and global matching.
- Events owned by the store (not the UI layer, out of scope here): `sortChanged`, `groupChanged`, `filterChanged`, `rowExpanded`.

## Testing Decisions

- **Seam:** test exclusively through the public `createTable()` factory and the signals/methods on its returned store instance. Construct via `TestBed.runInInjectionContext(() => createTable(signal(rows), config, ...features))` — no component rendering, no DOM assertions, no dependency on the (not-yet-specced) UI/directive layer. This is the single, highest-level seam available for this feature: state in via the `data` signal / feature methods, state out via the store's public signals.
- **What makes a good test here:** assert on the store's public output (signals like `sorting()`, `rows()`, `expandedRows()`, emitted events) for a given sequence of public method calls — not on internal engine details (`composeTable()`'s fold, a feature's own signals, or any state/method not exposed on the `createTable()` public surface). Tests should read as "given this store config and these calls, the public signals show this."
- **Modules to test:** one suite per feature (`withSorting`, `withGrouping`, `withExpansion`, `withFiltering`) covering its methods, `manual` contract (state still updates, processing stage skipped, event still fires), and default/fallback behavior (e.g. sort comparator fallback, global filter case-insensitivity). Plus one cross-feature suite covering: fixed pipeline order (filter → group → sort → expand) end-to-end with multiple features composed together, and the argument-order visibility rule between `withGrouping()` and `withExpansion()` (a type-level fixture asserting that `expandedRows` is not typed when expansion follows grouping, since this can't be verified at runtime).
- **Prior art:** none in-repo for store/state testing — the only existing spec in the acme workspace at the time (`apps/demo/src/app/app.spec.ts`) is a generic `TestBed` + rendered-DOM assertion test and isn't representative of this seam. Test runner is `vitest` via the `@nx/vitest:test` executor already configured on `shared-design-system` (`nx test shared-design-system`); this PRD establishes the state-layer testing pattern fresh rather than following an existing convention.

## Out of Scope

- **Layer 1 — UI/directive layer** (`ngpTable`, `ngpTableColumn`, `ngpTableRow`, `ngpTableSort`, etc.): rendering philosophy (native `@for`/`@if`, attribute-only directives) is decided, but the directive-to-store connection pattern is not, and no directive API surface (inputs/outputs/host bindings) has been specced. Follow-up PRD once that's decided.
- **`withSelection()`, `withPagination()`, `withInfiniteScroll()`, `withDragDrop()`:** not yet drilled — only rough state-shape sketches exist. Each has an unresolved cross-cutting open question (selection "select all" scope vs. pagination/filtering; pagination vs. infinite-scroll mutual exclusivity — hard compile-time conflict or convention only; drag-drop behavior while a sort is active). To be specced in follow-up sessions once resolved.
- Styling / CSS token spec for any layer — not started.
- Accessibility / keyboard navigation contract — depends on the not-yet-specced UI/directive layer.
- Column resize (width) state — flagged in `columns.md` as likely a UI-layer/CSS concern, deferred.
- "Reset to default columns" capability — explicitly decided against for now.
- Tightening Nx module-boundary enforcement (`eslint.config.mjs`'s `depConstraints` is currently an unconstrained `sourceTag: '*' → onlyDependOnLibsWithTags: ['*']` placeholder) — out of scope for this PRD.

## Further Notes

- This is the design system's first library-level feature at this depth; there is no existing `@ngrx/signals` usage, ADR, or domain-glossary convention anywhere in the repo to draw from — this PRD establishes the pattern rather than following precedent.
- Source docs (`overview.md`, `1-state/architecture.md`, and the per-feature files under this same `docs/` folder) should be updated to reflect decisions finalized here — in particular the aggregation-over-filtered-rows resolution, the sort auto-detection algorithm, and the global-filter case-insensitivity default — so the architecture docs and this PRD don't drift apart.
- Recommended sequencing after this ships: UI/directive layer (Layer 1) next, then the four undrilled features once their cross-cutting open questions are resolved.
