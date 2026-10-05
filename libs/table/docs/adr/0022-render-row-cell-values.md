# ADR-0022 — Resolved cell values live on the render row

**Status:** accepted
**Date:** 2026-09-19
**Related:** ADR-0011 (chained render stages — where `cells` is stamped),
ADR-0005 (central stamping precedent), ADR-0014 (the `accessor` wrap),
ADR-0021 (column ids vs. row fields — why `cells` is column-keyed on both row kinds)

**Source:** `../1-state/work/core/active/render-row-cell-values/decisions.md` (D1–D11)

## Context

[#80](https://github.com/DvirMon/ng-table/issues/80): the only path from a render row to a
rendered value is `ColumnDef.accessor`, and calling it lives in the template — unmemoised, once
per cell per change-detection pass. Neither `RenderRow` nor `ColumnDef` exposes a resolved value,
so every consumer re-derives one of two workarounds: a host method
(`cellValue(column, row)`, unmemoised, run per cell per CD pass) or a parallel view model in a
`computed()`, duplicating render rows the engine already built. Every grouping story host reads
through the resolved `RenderRow.cells` record today; `grouping-basic/` is the baseline
demonstration.

## Decision

```ts
interface RenderRow<TRow> {
  readonly cells: Readonly<Record<string, unknown>>;
}
```

| Question (#80)                          | Decision                                                   | Source |
| --------------------------------------- | ---------------------------------------------------------- | ------ |
| Eager array, or lazy `cellsOf(row)`?    | **Eager**, built inside the existing `renderRows` computed | D1, D2 |
| Ordered array, or a record?             | **Record keyed by `columnId`**                             | D3     |
| Follows column visibility/order?        | **No** — the consumer's own `visibleColumns()` loop stays  | D3     |
| Formatted or raw?                       | **Raw** — formatting stays in pipes                        | D6     |
| Replaces `accessor`, or sits beside it? | **Beside** — `accessor` defines, `cells` reads             | D7     |
| Typed per column?                       | **No** — `unknown`, narrowed by the consumer's own pipes   | D8     |

**Eager (D1/D2).** `renderRows` already is the memo boundary, so per-cell signals would add N×M
graph nodes and buy no extra memoization. A lazy `cellsOf` cannot live on `RenderRow` without
allocating a closure per row — which breaks "`rows()` never returns wrapper objects" — so it would
have to be a store method; uncached that is the same per-CD-pass cost as today, and cached it
needs a `Map<RowId, Cell[]>` plus a second computed building the identical eager array.

**Record, not ordered array (D3).** The engine owns _resolving the value_; the consumer keeps
owning which columns render and in what order. An ordered array would promote every story host's
local `visibleColumns` computed into core. The tradeoff dissolves on inspection: `renderRows`
gains a `columns()` dependency either way, so "hiding a column recomputes every row" is a cost of
building values in `renderRows` at all, not a cost of declining to filter.

**Group rows (D5, as amended).** A `kind: 'group'` row's `cells` carries its aggregates only —
`cells = { ...aggregates }`. The group's own label is `groupKey.label`, never a `cells` entry.
ADR-0021 is load-bearing here: `aggregates` is keyed by _declared column id_, while
`groupKey.columnId` has named a _row field_ since grouping's D7. Merging them would write entries
no template loops over, and would put a group value in an unrelated column whenever a field name
happened to match a column id. `cells` stays wholly column-keyed on both row kinds.

**Raw values (D6).** `{{ row.cells[column.id] | dealAmount }}` — one pure pipe per formatting
concern, as `grouping-story.pipes.ts` already does.

**`unknown`, no value generic (D8).** `row.cells[column.id]` indexes by a runtime `string`, so a
per-column mapped type collapses to the union of every column's value type — narrowing only pays
when indexing by a literal, which a loop over columns never does. Generifying `ColumnDef` would
ripple through the columns config, `columnSchema()`, the `ColumnsPath` proxy, `setColumns` and the
generated overloads for no gain.

**Duplicate column ids throw (D10).** Keying `cells` by column id makes uniqueness load-bearing:
two columns sharing an id collapse to last-wins, and _both_ table cells then render the same
value. Validated in `resolveColumnDefs`, at construction, `ngDevMode`-guarded. Scope is the `id`,
never the `accessor` — two columns reading one field under different headers stays legal. Prior
art: Angular CDK throws in `_cacheColumnDefs()`; AG Grid auto-suffixes in `buildColumnTree`;
TanStack v8 and MUI X ship no check and reproduce exactly the last-wins symptom.

**The `accessor` wrap (D9).** Reading `accessor` to build a cell is a consumer callback under
ADR-0014, whose table already names the fallback: the cell reads `undefined`, reported once per
column per evaluation. This ADR does not restate that policy — it cites ADR-0014 and records that
the new build pass is a wrap site.

## Alternatives considered

1. **Lazy `cellsOf(row)` as a store method** (TanStack's `row.getVisibleCells()` shape). Rejected
   — D2: uncached it is the same per-CD-pass cost the issue exists to remove; cached it needs its
   own `Map` plus a second computed rebuilding the same eager array `cells` already is.
2. **An ordered `{ columnId, value }[]`, filtered by visibility.** Rejected — D3: it moves column
   render order into the engine, which the engine does not own today.
3. **A forms-like cell object** (value + dirty/touched/valid/disabled). Rejected — D4:
   `accessor` is an arbitrary read-only derivation with no inverse, so a form field maps to a cell
   but never the reverse, and a computed column has no field at all. Extension path if cell-level
   state is ever wanted: a feature contributes its own optional `RenderRow` field, the way
   `isExpanded`/`hasChildren`/`aggregates` already do, rather than thickening `cells`.

## Consequences

- `renderRows` now depends on `columns()`; any column change (visibility, reorder, `setColumns`)
  recomputes every render row.
- `cells` is **required** on `RenderRow`, so the stage-internal row type becomes
  `Omit<RenderRow<TRow>, 'index' | 'cells'>` — named `StagedRow<TRow>`. Third-party stage authors
  (ADR-0020) type against it.
- `accessor` is now documented as the value contract, in
  `docs/2-columns/reference/tier-1-intrinsic.md`.
- `aggregates` stays on `RenderRow` — `cells` reads through it for a group row, it is not removed.
  Templates stop indexing it directly.
- `ngDevMode` enters `src/` for the first time. **Noted inconsistency:** this is the only
  dev-guarded construction throw in the library; every other one is unconditional. Whether they
  should all be guarded is its own ADR, not this one.
- One legacy unguarded `accessor` site remains — `api/features/with-sorting.ts:117-118`.
  Deliberately not fixed here: ADR-0014's `accessor` row ("the cell reads `undefined`") and its
  `sortFn` row ("that column's sort does not apply") give contradictory answers inside a sort
  comparator, and picking one quietly inside a cell-value change is how the wrong one ships.
  Follow-up issue.
