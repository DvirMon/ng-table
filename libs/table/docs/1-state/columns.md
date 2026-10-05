---
title: State Layer Reference — columns (core config)
type: architecture
version: 1.0
date: 2026-07-19
status: drafted
audience: developers
parent: ../1-state/architecture.md
---

# columns (core config)

## Executive Summary

`columns` is **core configuration** on `createTable()` — not an opt-in feature. Every table requires it, the same way `trackBy` is required. It is built via `createColumns(data, build, schema?)` — there is no plain-array form (#139). Declarations are static, but the _state_ derived from them (visibility, order) is runtime-mutable. `createColumns`'s optional third argument, `schema`, layers a declarative rule DX on top of the same call; see `../2-columns/architecture.md`.

## Registration

`columns` is a `ColumnSet<TRow, TCols>`, returned by `createColumns(data, build, schema?)`.
`build` receives a `col()` builder; only `id` is required — `label`/`visible`/`accessor` are
optional and resolved at store construction (see State Shape below). `order` is not a `col()`
option at all — it derives from the builder array's own position.

```ts
createTable(
  data,
  { trackBy: 'id', columns: createColumns(data, (col) => [col('name'), col('status')]) },
  // label/accessor/visible all defaulted; order follows array position
  /* withSorting(), withGrouping(), etc. */
);

// Override only what needs it — e.g. a computed accessor or non-default visibility.
createTable(
  data,
  {
    trackBy: 'id',
    columns: createColumns(data, (col) => [
      col('fullName', { accessor: (row) => `${row.first} ${row.last}` }),
      col('status', { visible: false }),
    ]),
  },
  /* ...features */
);

// Or, with the declarative schema layered on top (opt-in) — see ../2-columns/architecture.md
createTable(
  data,
  {
    trackBy: 'id',
    columns: createColumns(
      data,
      (col) => [col('name'), col('status')],
      (path) => {
        visible(path.status, { when: () => role() === 'admin' });
      },
    ),
  },
  /* ...features */
);
```

Not registered via a `withColumns()` feature — always present as core config, fully known at store creation.

## State Shape

Single source of truth: mutable flags live directly on each `ColumnDef`. No separate `columnOrder[]` / `columnVisibility{}` slices.

The **resolved** state (`store.columns()`, always a full `ColumnDef[]`) and the **declared
input** (`ColumnDecl<TRow, K, V>`, what `col()` mints) are two related shapes — only `id` is
required on the declaration, everything else is optional and defaulted at resolution:

```ts
interface ColumnDef<TRow = unknown> {
  id: string;
  accessor: (row: TRow) => unknown; // function only — no string shorthand
  visible: boolean; // mutated by toggleColumnVisibility()
  order: number; // mutated by reorderColumns()
  label: string;
  meta?: ReadonlyMap<ColumnMetaKey<unknown>, unknown>;

  // No feature-contributed fields — as of #100, `ColumnDef` carries no per-feature config at
  // all. `sortFn`/`enableSorting` moved to `withSorting({ schema })` (`sortFn`/`sortable`);
  // `aggregateFn` moved to `aggregate(path.x, aggregateFn)` via `withGrouping({ schema })` (#114).
  // See `features/sorting.md` and `features/grouping.md`.
}
```

`ColumnDefInput<TRow>` — what the engine's resolver accepts — is the same shape with
`accessor`/`visible`/`order`/`label` optional (only `id` required); a `ColumnDecl` from `col()`
satisfies it structurally. `resolveColumnDefs()` (`engine/core.ts`) fills the defaults in once
at resolution, so `store.columns()` is always the full `ColumnDef` above:

```ts
type ColumnDefInput<TRow> = Pick<ColumnDef<TRow>, 'id'> & Partial<Omit<ColumnDef<TRow>, 'id'>>;
```

**Rejected alternative:** separate `columns[]` + `columnOrder[]` + `columnVisibility{}` slices — would have preserved "reset to default," ruled out as unneeded. Single-source-of-truth on the def itself was chosen for simplicity.

## Methods

| Method                                                          | Description                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setColumns(defs: readonly ColumnWrite<TRow, TId>[])`           | Replace the full column list by id — `ColumnWrite` is `{ id, label?, visible?, accessor? }`; `order` and `meta` are not writable through this path                                                                                                                                                     |
| `updateColumns(updater: (columns: ColumnDef[]) => ColumnDef[])` | Derive the next column list from the current one — the `.update()` counterpart to `setColumns()`'s `.set()`. This is also the method `createColumns`'s schema-argument store-owned reactive/async rules call under the hood (see `../2-columns/reference/ownership-model.md`'s snapshot-diff patcher). |
| `reorderColumns(ids: string[])`                                 | Re-assign `order` per the given id sequence                                                                                                                                                                                                                                                            |
| `toggleColumnVisibility(id: string)`                            | Flip a column's `visible` flag                                                                                                                                                                                                                                                                         |

Columns are runtime-mutable — a deliberate choice over static/immutable columns.

**`setColumns()` resets column order until #128 lands.** `setColumns()` cannot write `order` —
it derives purely from array position, the same as initial `columns` registration — so every
call resets every column to its declaration-array order, and a user's dragged order is lost.
This is recoverable: the app already owns the id list it dragged into, so re-apply
`reorderColumns(ids)` immediately after the write. That is the interim spelling until the
column-order slice ([#128](https://github.com/DvirMon/ng-table/issues/128)) ships its own
ordered-id state.

```ts
table.columns.update(setColumns([{ id: 'name' }, { id: 'status', visible: false }]));
table.columns.update(reorderColumns(draggedColumnIds)); // re-apply the user's order
```

## `renderColumns` — the render-ready projection

`table.renderColumns()` is a read-only `Signal<ColumnDef[]>` holding the _visible_ columns in
_render order_ — the column-side twin of `renderRows` ([#142](https://github.com/DvirMon/ng-table/issues/142)). `store.columns()` stays
unfiltered/unsorted (declaration order, every column including hidden ones); `renderColumns()` is
what a template loop should actually iterate.

- Excludes every column with `visible: false` (including one hidden by a `visible()`/`visibleAsync()`
  schema rule).
- Sorted into render order; columns tied on order keep their declaration order (stable).
- Updates automatically after `toggleColumnVisibility`, `reorderColumns`, `setColumns()`, or a
  `visible()`/`visibleAsync()` schema rule changing — it's a `computed` over the same folded
  `columns()` those all write through.
- Reading it never mutates or reorders `store.columns()` — the sort runs on a fresh array.
- Each element is the same `ColumnDef` `columns()` returns (same `id`/`label`); `id` is typed as
  the declared id union, same as `columns()`.
- Engine-claimed, non-overridable core member (`CORE_MEMBER_KEYS`, ADR-0007) — a feature declaring
  `renderColumns` throws at construction.

```ts
@for (col of table.renderColumns(); track col.id) {
  <th [ngpTableColumn]="col.id">{{ col.label }}</th>
}
```

## Declarative Column Schemas — `createColumns`'s schema argument

An opt-in declarative layer on top of the core `columns` config, modeled on Angular Signal Forms
(`form(model, schemaFn)`). The `schema` fn passed as `createColumns(data, build, schema)`'s third
argument receives a typed `path` proxy and layers bare-named rules (`visible`, `sortNulls`,
`grouping`, and — per tier — sizing/pinning/group seeds) onto columns instead of hand-rolled
`effect()` + `updateColumns()` wiring. Full design: `../2-columns/architecture.md` and the
per-concern detail in `../2-columns/reference/`.

## Async / Permission-Driven Column Changes

Two patterns, depending on whether `createColumns`'s schema argument is used:

**Pattern A (default, always available)** — reactivity to async sources (e.g. a permission check
resolving from an HTTP call) belongs in the **consumer**, not the store. The store does not accept
a reactive/async `columns` input — columns remain plain, store-mutation-based state (see
Executive Summary above). Recommended pattern:
an `effect()` in the consuming component reacting to an async source (e.g. Angular `resource()`)
that calls `updateColumns()`:

```ts
const permission = resource({ loader: () => checkColumnPermission() });

effect(() => {
  const allowed = permission.value();
  if (allowed === undefined) return;
  store.updateColumns((columns) =>
    columns.map((c) => (c.id === 'salary' ? { ...c, visible: allowed } : c)),
  );
});
```

See `apps/demo/src/app/table-demo/` in the acme monorepo for a working illustration of this pattern.

**Pattern B (opt-in, via `createColumns`'s schema argument)** — `visibleAsync` moves this
`effect()` + `resource()` + `updateColumns()` wiring into the store instead (a scoped exception
to the consumer-owns-reactivity default above). See
`../2-columns/reference/tier-1-intrinsic.md` (`visibleAsync`) and
`../2-columns/reference/ownership-model.md`. Pattern A stays the default here.

## Accessor Contract

`accessor: (row) => value` is **optional, function-only** on `col()`'s declared input —
defaults to `(row) => row[id]`. Most columns are a straight key read and need no explicit accessor;
supply one only for computed/derived values (`fullName`, a formatted price, a nested path). Still no
string-key shorthand, unlike `trackBy`. The resolved `ColumnDef` (`store.columns()`) always has `accessor` populated, default or explicit.

`accessor` is the write side of a column's value; `store.renderRows()[i].cells[columnId]` is the
read side — the resolved value, stamped centrally per render row. A `kind: 'group'` row's `cells`
carries its aggregates instead, and its header text is `groupKey.label`, not a `cells` entry. Full
contract, including the id-uniqueness constraint `cells` depends on:
[`../2-columns/reference/tier-1-intrinsic.md`](../2-columns/reference/tier-1-intrinsic.md#accessor--the-value-contract--decided-2026-09-19)
and [ADR-0022](../adr/0022-render-row-cell-values.md).

## Consumed By

Other features read `columns` directly rather than declaring a compile-time feature dependency on it (since it's core config, always present, not an optional feature):

- `withSorting()` — reads `accessor`/`id` (ADR-0024); `sortFn`/`sortable`/`sortNulls` are declared
  through `withSorting({ schema })`'s own declarators, not read off the column (#100)
- `withGrouping()` — reads `accessor` (ADR-0024); `aggregateFn` is declared through
  `withGrouping({ schema })`'s own `aggregate`, not read off the column (#114)
- `withFiltering()` — reads `accessor`; filter predicates are consumer-owned, outside the table
  (ADR-0016) — `filterFn`/`enableFiltering` never existed on `ColumnDef`

> **Note (retroactive fix):** Earlier drafts described `withSorting()`/`withGrouping()` as having a "compile-time dependency on `withColumns()`." Since `columns` is core config, not an opt-in feature, this is corrected: those features read the core `columns` config directly — there is no feature dependency to declare.

## Open Questions

- [ ] No "reset to default columns" capability exists in this shape — confirm this is acceptable long-term (decided: not needed for now).
- [x] **Column resize (width) / pinning state — RESOLVED 2026-07-25.** Width defaults to a
      column-owned config seed (consumer CSS, no store involvement); if made resizable via a drag
      directive, it's promoted to a dedicated `withColumnSizing()` store feature rather than a
      `ColumnDef` field. Pinning is **not** a `ColumnDef` field at all — it lives in a
      `withColumnPinning()` feature's own `columnPinning: { left, right }` state slice, mirroring
      TanStack's `columnPinningFeature.ts`. Neither is part of this file's State Shape. See
      `../1-state/architecture.md` (feature stubs) and `../2-columns/reference/tier-2-layout.md`.

---

## Competitive position

**Verdict: ahead** on visibility — `toggleColumnVisibility` plus `createColumns`'s declarative,
async-resolved, multi-writer `visible`/`visibleAsync` rules exist in none of the four.

**Verdict: missing** on sizing and pinning — all four ship both in core, and neither is implemented
here (see [features/column-sizing.md](./features/column-sizing.md) and
[features/column-pinning.md](./features/column-pinning.md)).

Full reasoning: [gap-analysis.md](./work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
