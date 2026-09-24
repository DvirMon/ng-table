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

`columns` is **core configuration** on `createTable()` — not an opt-in feature. Every table requires it, the same way `trackBy` is required. Column definitions are static config declared upfront, but the *state* derived from them (visibility, order) is runtime-mutable. A second, opt-in declarative way to configure columns — `columnsSchema` — layers on top of this core config; see `../2-columns/architecture.md`.

## Registration

`columns` accepts `ColumnDefInput<TRow>[]` — only `id` is required. `accessor`/`visible`/`order` are
optional and resolved at store construction (see State Shape below):

```ts
createTable(
  data,
  { trackBy: 'id', columns: [{ id: 'name' }, { id: 'status' }] },  // accessor/visible/order all defaulted
  /* withSorting(), withGrouping(), etc. */
);

// Override only what needs it — e.g. a computed accessor or a non-default initial order.
createTable(
  data,
  {
    trackBy: 'id',
    columns: [
      { id: 'fullName', accessor: (row) => `${row.first} ${row.last}` },
      { id: 'status', visible: false },
    ],
  },
  /* ...features */
);

// Or, with the declarative schema layered on top (opt-in) — see ../2-columns/architecture.md
createTable(
  data,
  {
    trackBy: 'id',
    columns: [{ id: 'name' }, { id: 'status' }],
    columnsSchema: (path) => { applyVisible(path.status, { when: () => role() === 'admin' }); },
  },
  /* ...features */
);
```

Not registered via a `withColumns()` feature — always present as core config, fully known at store creation.

## State Shape

Single source of truth: mutable flags live directly on each `ColumnDef`. No separate `columnOrder[]` / `columnVisibility{}` slices.

The **resolved** state (`store.columns()`, always a full `ColumnDef[]`) and the **author-facing
input** (`ColumnDefInput<TRow>`, what `columns`/`setColumns()` accept) are two related types — only
`id` is required on the input, everything else is optional and defaulted at resolution:

```ts
interface ColumnDef<TRow = unknown> {
  id: string;
  accessor: (row: TRow) => unknown;   // function only — no string shorthand
  visible: boolean;                    // mutated by toggleColumnVisibility()
  order: number;                       // mutated by reorderColumns()

  // Feature-contributed fields (populated when the relevant feature is registered)
  sortFn?: (a: TRow, b: TRow) => number;
  enableSorting?: boolean;             // default true
  filterFn?: (value: unknown, filterValue: unknown) => boolean;
  enableFiltering?: boolean;           // default true

  // `aggregateFn` no longer lives here — it moved to `applyAggregate(path.x, aggregateFn)`,
  // declared through `withGrouping({ schema })` (#114). See `features/grouping.md`.
}
```

`ColumnDefInput<TRow>` — what `columns` and `setColumns()` actually accept — is the same shape with
`accessor`/`visible`/`order` optional (only `id` required); `resolveColumnDefs()` (`api/create-table.ts`)
fills the defaults in once at resolution, so `store.columns()` is always the full `ColumnDef` above:

```ts
type ColumnDefInput<TRow> = Pick<ColumnDef<TRow>, 'id'> & Partial<Omit<ColumnDef<TRow>, 'id'>>;
```

**Rejected alternative:** separate `columns[]` + `columnOrder[]` + `columnVisibility{}` slices — would have preserved "reset to default" capability, but that was explicitly ruled out as unneeded. Single-source-of-truth on the def itself was chosen for simplicity.

## Methods

| Method | Description |
|---|---|
| `setColumns(defs: { id, accessor?, visible?, label? }[])` | Replace the full column list by id — `order` and `meta` are not writable through this path |
| `updateColumns(updater: (columns: ColumnDef[]) => ColumnDef[])` | Derive the next column list from the current one — the `.update()` counterpart to `setColumns()`'s `.set()`. This is also the method `columnsSchema`'s store-owned reactive/async rules call under the hood (see `../2-columns/reference/ownership-model.md`'s snapshot-diff patcher). |
| `reorderColumns(ids: string[])` | Re-assign `order` per the given id sequence |
| `toggleColumnVisibility(id: string)` | Flip a column's `visible` flag |

Columns are runtime-mutable — this was a deliberate choice over static/immutable columns.

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

## Declarative Column Schemas — `columnsSchema`

An opt-in declarative layer on top of the core `columns` config, modeled on Angular Signal Forms
(`form(model, schemaFn)`). A `columnsSchema` fn receives a typed `path` proxy and layers `apply*`
rules (visibility, order, and — per tier — sizing/pinning/sort/filter/group seeds) onto columns
instead of hand-rolled `effect()` + `updateColumns()` wiring. Full design: `../2-columns/architecture.md`
and the per-concern detail in `../2-columns/reference/`.

## Async / Permission-Driven Column Changes

Two patterns, depending on whether `columnsSchema` is used:

**Pattern A (default, always available)** — reactivity to async sources (e.g. a permission check
resolving from an HTTP call) belongs in the **consumer**, not the store. The store does not accept
a reactive/async columns input on the plain `columns` array — columns remain plain,
store-mutation-based state (see Executive Summary above). The recommended pattern is
an `effect()` in the consuming component that reacts to an async source (e.g. Angular `resource()`)
and calls `updateColumns()`:

```ts
const permission = resource({ loader: () => checkColumnPermission() });

effect(() => {
  const allowed = permission.value();
  if (allowed === undefined) return;
  store.updateColumns((columns) =>
    columns.map((c) => (c.id === 'salary' ? { ...c, visible: allowed } : c))
  );
});
```

See `apps/demo/src/app/table-demo/` in the acme monorepo for a working illustration of this pattern.

**Pattern B (opt-in, via `columnsSchema`)** — `applyVisibleAsync` moves this `effect()` +
`resource()` + `updateColumns()` wiring into the store instead (a scoped exception to the
consumer-owns-reactivity default above). See
`../2-columns/reference/tier-1-intrinsic.md` (`applyVisibleAsync`) and
`../2-columns/reference/ownership-model.md`. Pattern A stays the default here.

## Accessor Contract

`accessor: (row) => value` is **optional, function-only** on the author-facing `ColumnDefInput` —
defaults to `(row) => row[id]`. Most columns are a straight key read and need no explicit accessor;
supply one only for computed/derived values (`fullName`, a formatted price, a nested path). Still no
string-key shorthand (unlike `trackBy`) — an explicit accessor, when provided, is always a function.
The resolved `ColumnDef` (`store.columns()`) always has `accessor` populated, default or explicit.

`accessor` is the write side of a column's value; `store.renderRows()[i].cells[columnId]` is the
read side — the resolved value, stamped centrally per render row. A `kind: 'group'` row's `cells`
carries its aggregates instead, and its header text is `groupKey.label`, not a `cells` entry. Full
contract, including the id-uniqueness constraint `cells` depends on:
[`../2-columns/reference/tier-1-intrinsic.md`](../2-columns/reference/tier-1-intrinsic.md#accessor--the-value-contract--decided-2026-09-19)
and [ADR-0022](../adr/0022-render-row-cell-values.md).

## Consumed By

Other features read `columns` directly rather than declaring a compile-time feature dependency on it (since it's core config, always present, not an optional feature):

- `withSorting()` — reads `sortFn`, `enableSorting`
- `withGrouping()` — reads `accessor` (ADR-0024); `aggregateFn` is declared through
  `withGrouping({ schema })`'s own `applyAggregate`, not read off the column (#114)
- `withFiltering()` — reads `filterFn`, `enableFiltering`

> **Note (retroactive fix):** Earlier drafts described `withSorting()`/`withGrouping()` as having a "compile-time dependency on `withColumns()`." Since `columns` was subsequently decided to be core config rather than an opt-in feature, this has been corrected — those features simply read the core `columns` config; there is no feature dependency to declare.

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

**Verdict: ahead** on visibility — `toggleColumnVisibility` plus `columnsSchema`'s declarative,
async-resolved, multi-writer `applyVisible`/`applyVisibleAsync` rules exist in none of the four.

**Verdict: missing** on sizing and pinning — all four ship both in core, and neither is implemented
here (see [features/column-sizing.md](./features/column-sizing.md) and
[features/column-pinning.md](./features/column-pinning.md)).

Full reasoning: [gap-analysis.md](./work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
