---
title: Research — who owns filter state, and how server-supplied defaults arrive
type: research
status: complete
date: 2026-09-09
audience: developers
---

# Who owns filter state

> **⚠️ The applied verdict below is superseded (2026-09-09). The survey is not.**
> This doc concluded `query` is consumer-owned and `columnFilters` is **store-owned, seeded +
> setter**. The design that followed has no table-owned filter slice at all: `createFilters()` is
> a standalone, consumer-held primitive, forced by server-side mode where the filters feed the
> request that *produces* the data. See
> [design-options-hybrid-api.md](design-options-hybrid-api.md), R10 and R11.
>
> Everything else here stands, and the origination rule is what the new design rests on — it just
> resolves differently once `createFilters()` exists, because the criteria then originate in a
> consumer-held object rather than inside the table. The seven-library survey, the
> server-supplied-default findings, and the `filterFn`-vs-`value` split are unaffected.

Run during the `withFiltering()` grill to settle the source-of-truth question: does the
consumer own filter state and the table read it, or does the feature own it and expose a write
API? Secondary question that forced the issue: a **server-supplied default filter state** that
arrives *after* the table is constructed.

Every claim below was read from published docs or released source, not from memory. URLs per row.

## Findings

| Library | Who owns filter state | Seed at construction | Late / server-supplied state |
|---|---|---|---|
| TanStack Table v8 | **Consumer's choice, per slice.** Uncontrolled by default; `state.columnFilters` + `onColumnFiltersChange` opts one slice into consumer ownership | `initialState.columnFilters` — a snapshot, retained for `resetColumnFilters()` | `setColumnFilters(updater)` — works in **both** modes |
| Material React Table | Pass-through to TanStack; same two modes | `initialState` | same as TanStack |
| AG Grid | **Grid.** No controlled mode exists | `initialState` — "only read once when the grid is created" | `setFilterModel()` + `onFilterChanged()`; community pattern applies it in `onFirstDataRendered` |
| PrimeNG Table | **Table.** `@Input() filters` has no `filtersChange` output, so `[(filters)]` is impossible — the table mutates the consumer's object in place | `[filters]` object, seeded before first `onLazyLoad` | seed before first lazy load; `onFilter` / `onLazyLoad` report changes |
| Angular Signal Forms | **Consumer.** `form()` never copies state — the developer's `WritableSignal` *is* the source of truth | n/a — the model *is* the state | `validateAsync({ params, factory: () => resource(...), onSuccess, onError })` — async config as a declarative rule, never an awaited initial value |
| NgRx SignalStore | **Store, always.** No "controlled slice" concept exists | `withState(state)` or `withState(() => inject(TOKEN))` — factory overload runs in an injection context | `patchState` |
| `MatTableDataSource` | **Data source.** Library-owned `_filter` BehaviorSubject + consumer-supplied `filterPredicate` | — | `filter` setter |

Sources: [TanStack table-state](https://tanstack.com/table/v8/docs/framework/react/guide/table-state) ·
[TanStack column-filtering](https://tanstack.com/table/v8/docs/guide/column-filtering) ·
[MRT state management](https://www.material-react-table.com/docs/guides/table-state-management) ·
[AG Grid filter-api](https://www.ag-grid.com/angular-data-grid/filter-api/) ·
[AG Grid grid-state](https://www.ag-grid.com/angular-data-grid/grid-state/) ·
[PrimeNG table.ts](https://raw.githubusercontent.com/primefaces/primeng/master/packages/primeng/src/table/table.ts) ·
[Angular Signal Forms](https://angular.dev/essentials/signal-forms) ·
[NgRx with-state.ts 19.0.0](https://raw.githubusercontent.com/ngrx/platform/19.0.0/modules/signals/src/with-state.ts) ·
[NgRx custom store features](https://ngrx.io/guide/signals/signal-store/custom-store-features) ·
[MatTableDataSource source](https://raw.githubusercontent.com/angular/components/main/src/material/table/table-data-source.ts)

## The rule that explains the split

Four of the seven own the state; two delegate; one delegates optionally. The divide is **not**
framework or taste — it tracks *who naturally originates the value*:

- **Signal Forms delegates** because the model pre-exists the form. The form is a structured
  interface over state the consumer already had.
- **NgRx, AG Grid, PrimeNG and `MatTableDataSource` own** because the slice has no life outside
  the store / grid / data source.
- **TanStack delegates optionally**, and frames it as scope of access, not ideology:
  uncontrolled unless you need the value outside the table — then control *that one slice*.
  "It is recommended to only control the state that you need on a case-by-case basis."

Applied to `withFiltering()`, the two halves land on opposite sides:

| Slice | Originates where | Verdict |
|---|---|---|
| `query` (global search) | The consumer's own search input — often shared with a URL param or toolbar. Pre-exists the table | **Consumer-owned**, read through |
| `columnFilters` | Meaningless without the table's columns. No life outside it | **Store-owned**, seeded + setter |

## Consequences for the API

1. **Seed shape.** Mirror NgRx's two `withState` overloads: accept `FilterRule[]` (static) or
   `() => FilterRule[]` (factory, runs in the injection context — so `() => inject(FILTER_DEFAULTS)`
   works). `createTable()` already composes inside `runInInjectionContext`, so the factory
   overload needs no new machinery.
2. **Server-supplied defaults arriving after construction → the setter.** Every library
   researched converges here: TanStack `setColumnFilters()`, AG Grid `setFilterModel()`, NgRx
   `patchState`, Material's `filter` setter. None of them re-seed; all of them expose a write
   API called when the data lands. A `columnFilters` setter is therefore load-bearing, not
   optional sugar.
3. **Never accept the same slice both ways.** TanStack's documented failure mode: state set in
   both `state` and `initialState` silently lets one overwrite the other, and a change callback
   supplied without its matching state value **freezes** that slice. If `columnFilters` is
   store-owned, it takes a seed and nothing else.
4. **`filterFn` vs `value` is the standard split, independently confirmed.**
   `MatTableDataSource` pairs a library-owned `_filter` slot with a consumer-supplied
   `filterPredicate` — the same match-logic / criterion separation. It is not an arbitrary
   shape.

## On modeling a filter as a Signal-Forms-style rule

Considered: express filters as declarative rules (`applyFilter(path.status, fn)`) mirroring
`applyVisible()` / Signal Forms' `validate()`. Two blockers, both already committed to in this
repo:

- **`ColumnRuleContext<TRow>` is `{ columns: () => ColumnDef<TRow>[] }`** — column-scoped, no
  row. `applyVisible`'s `when` answers "should this column show," evaluated once. A filter
  predicate evaluates per row. The existing rule mechanism carries no row.
- **The criterion must stay serializable.** `state-persistence.md` already commits to
  `filters?: { columnFilters: FilterRule[]; globalFilter: string }`, and `manual` mode has to
  hand filters to a server. A closure cannot be serialized into a layout snapshot or a query
  string.

**Verdict: a filter is a rule with an externalized operand.** The *predicate* can be declarative
(`filterFn` today, or an `applyFilter()` schema rule later). The *criterion* cannot live in the
closure. That is the structural difference from a validator: validation matches a field against
its own value; a filter matches against a user-chosen criterion that must survive a reload and a
server round-trip.

Worth noting for later: Signal Forms expresses *async config* as a resource-backed rule
(`validateAsync`), which this repo already mirrors in `applyVisibleAsync` / `metadataAsync`. If
declarative server-seeding of filters is ever wanted, that is the shape — not an imperative
setter in an `effect()`. Out of scope for issue #5.
