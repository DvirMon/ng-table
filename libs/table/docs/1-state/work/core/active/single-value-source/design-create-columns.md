# Design brief — `createColumns()`: one call declares a column's presentation, accessor and rules

**Date:** 2026-09-22 · **Status:** direction chosen, not planned, not implemented ·
**Decided in:** [`proposal-column-value-mechanics.md`](proposal-column-value-mechanics.md) (A1, full form) ·
**Premises:** ADR-0019 (key by declared column id), ADR-0024 (the accessor is the single value source)

This file is what a session implementing the design needs. The proposal doc holds the evidence and
the alternatives; open it only for a "why".

## The shape

```ts
// Data first — `col`, `row` and `path` typed with nothing written. The signal is read for its
// type only; the builder runs synchronously, so headers exist before any row arrives.
const dealColumns = createColumns(
  this.deals,
  (col) => [
    col('region', { label: 'Region' }),
    col('amount'),
    col('owner', { label: 'Owner', accessor: (row) => row.owner.name }),
    col('selected', { visible: false }),
  ],
  (path) => {
    applyVisible(path.region, () => true);
    metadata(path.owner, WIDTH_KEY, 120);
  }
);

// Builder first — for a declaration shared across data sources: one annotation on `col`.
const dealColumns = createColumns((col: ColumnBuilder<DealRow>) => [...], hideRegion);

// Inline — the row type flows back from `data`, nothing annotated.
createTable(this.deals, { trackBy: 'id', columns: createColumns((col) => [...]) });
```

```ts
declare function createColumns<TRow, TCols extends readonly AnyDecl<TRow>[]>(
  data: TableDataInput<TRow>,
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?: ColumnsSchemaFn<TRow, ColumnIdIn<ValuesOf<TCols>>> | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;
declare function createColumns<TRow, TCols extends readonly AnyDecl<TRow>[]>(
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?: ColumnsSchemaFn<TRow, ColumnIdIn<ValuesOf<TCols>>> | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;

interface ColumnBuilder<TRow> {
  <K extends string, V>(
    id: K,
    opts: Presentation & { accessor: (row: TRow) => V },
  ): ColumnDecl<TRow, K, V>;
  <K extends string>(
    id: K,
    opts?: Presentation,
  ): ColumnDecl<TRow, K, K extends keyof TRow ? TRow[K] : unknown>;
}
// TableConfig: { trackBy; columns: ColumnSet<TRow, TCols> }. `columnsSchema` is removed.
```

The value map is `{ [C in TCols[number] as C['id']]: V }` over an array-of-union; no tuple. It
reaches every feature slot through `TableStore<TRow, ColumnValues>` exactly as #125 wired it.

## What is settled, and by which probe

| Fact                                                                                                      | Probe |
| --------------------------------------------------------------------------------------------------------- | ----- |
| Data first: `col`, `row`, `path` typed; typos rejected in the schema fn and in a feature slot; map exact  | P5a   |
| Builder first with `col` annotated; a standalone `columnSchema()` value as the second argument            | P5b   |
| Builder first with `col` unannotated is a compile error (`row` is `unknown`), never silent                | P5c   |
| Inline inside `createTable` with nothing annotated: the row type flows back from `data`                   | P5d   |
| A column set built for one row type is rejected on a table over another                                   | P5e   |
| A plain object literal in the builder's array is rejected, once `ColumnDecl` carries a brand              | P3c   |
| Feature slots see the ids after a context-sensitive `columns` only because `Feature<In, Out>` is callable | P1j   |

## Invariants the design rests on

- **`ColumnDecl` is branded** (a `unique symbol` key). Without it a hand-written `{ id, accessor }`
  passes structurally and its `id` widens silently.
- **`Feature<In, Out>` stays callable.** A generic feature returning a plain object is resolved
  before `TCols` is inferred. Record this in `libs/table/CLAUDE.md`'s invariants.
- **`data` is a type witness.** `createColumns` never reads it. Skeleton UIs that render headers
  while `data()` is `[]` are unaffected.
- **The schema fn is positional, after the builder.** That is what removes the sibling-order limit;
  do not move it into an options object next to `build`.

## Open for the implementing session

1. **`ColumnSet` runtime shape** — `{ columns: ColumnDecl[]; rules: ColumnRule[] }` is the
   probe's; decide whether it also carries the `data` reference (it should not need to).
2. **Where the throws live** — duplicate ids and unknown rule ids move from
   `resolveColumnDefs`/`resolveColumnsConfig` into `createColumns`. `createTable` still validates
   on a `setColumns()` write.
3. **`createTable` intake** — `resolveColumnsConfig` consumes a `ColumnSet` instead of
   `columns` + `columnsSchema`. Decide whether a plain `ColumnDefInput[]` is still accepted for one
   release (it would need B1's literal-preserving `id` to stay typed) or removed outright.
4. **Migration order** — 5 inline `columns: [` in specs, ~20 spec factories returning
   `ColumnDef<Row>[]`, 5 story fixtures, every story host, `create-table.types.spec.ts` and
   `create-columns.types.spec.ts` rewritten against the new call. The generated overloads change
   only in the `TCols` constraint.
5. **ADR-0019 amendment** — `ColumnsPath` is now keyed from `createColumns`, not `TableConfig`;
   consequence 1 ("literal inference is required, and its absence is silent") becomes a structural
   guarantee. Retire the curried `createColumns<TRow>()([...])` rows in `decisions.md` (K0).
6. **`FiltersPath` and `SortingPath`** key by `ColumnIdIn<ColumnValuesOf<In>>` when #115 and #100
   land; the map is already on the store.

## Not this design

- B1 (literal-preserving `id` default, non-breaking) — the fallback if the migration is refused.
- Row-agnostic columns with a `values` field on `createTable` — recorded, not pursued.
- Record columns — fails array order.
  Each is in the proposal doc with its probes.
