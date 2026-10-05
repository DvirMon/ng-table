# Step 1 — The sorting schema module

**PR scope:** standalone, additive. Nothing reads the new files yet, so
the tree stays green. **Depends on:** none. `schema/run.ts` and
`schema/validate.ts` (#111) and the value map (#125) have already shipped.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-sorting/types.ts` (new)
- `libs/table/src/api/features/with-sorting/schema.ts` (new)

## Why This Step Exists

SO21: `withSorting()` gains a schema fn in the recording form, sharing
`runRecordedSchema`. It does not get a private copy of that runner.
The declarators must exist before Step 2 can wire them into the feature.

Rulings made while planning, on 2026-09-25 (Step 6 records them):

- **Three declarators, not one options object.** SO22 stands:
  `sortNulls`, `sortFn`, `sortable`. An options object
  `sorting(path, { enable, compare, nulls })` was considered and rejected.
  It would reverse SO22 and the ADR-0025 names, and depart from grouping's
  split (G39).
- **`sortable` takes `{ enable }`**, not `{ when }`. Here `enable` means
  "a gate that doesn't read row data". ADR-0018 today reserves `enable` for
  rules that also carry `when`, so Step 6 amends it.
- **Reuse goes through a `sortingSchema<Row>(fn)` identity helper.**
  It does nothing at runtime; it exists only so the handle's type is
  inferred. The consumer calls the helper on each column:
  `money(path.total)`. **No `apply()` function.** On a flat path,
  `apply(path.x, fn)` would just be `fn(path.x)`. Signal Forms needs
  `apply` because its paths nest and its schemas can recurse; ours do
  neither.

## What To Do

**1. `types.ts`.** Mirror `with-grouping/types.ts` and filtering's
`FiltersPath`:

```ts
export interface SortingHandle<TRow, K extends string = string, V = unknown> {
  readonly id: K;
  /** @internal phantom — the column's resolved value type (#117's `valueOf`). */
  readonly __value?: V;
}

export type SortingPath<TRow, TValues extends ColumnValueMap> = {
  readonly [K in ColumnIdIn<TValues>]: SortingHandle<TRow, K, TValues[K]>;
};

export type SortingSchemaFn<TRow, TValues extends ColumnValueMap> = (
  path: SortingPath<TRow, TValues>,
) => void;

export interface SortNullsOpts {
  order?: 'first' | 'last';
  emptyString?: 'is-empty';
}
export interface SortableOpts {
  enable: () => boolean;
}

// Rule union: 'sort-nulls' | 'sort-fn' | 'sortable', each with `columnId`.
export type AnySortingRule<TRow> = SortNullsRule | SortFnRule<TRow> | SortableRule;
```

Move `SortNullsOpts` here with its JSDoc. Step 3 deletes the copy in
`columns-schema/rules.ts`. The handle also needs the recorder symbol
member that `GroupingHandle` carries, so copy that shape exactly.

**2. `schema.ts`.** Model it on `with-grouping/schema.ts`:

- `buildSortingPath(recorder)`: one `createPathProxy` cast, no more.
- `runSortingSchemaFn(fn)`: calls `runRecordedSchema`.
- `sortNulls(path, opts)`, `sortFn(path, compare)`,
  `sortable(path, { enable })`: each calls `recorderOf(path).record(…)`.
  `sortFn` takes its comparator as a positional argument, the way
  `groupOrder` does. Its comparator type is
  `(a: TRow, b: TRow) => number`, unchanged from `ColumnDef.sortFn`.
- `sortingSchema`:

```ts
/** Types a reusable per-column sorting schema. Identity at runtime —
 * call the result on a handle: `money(path.total)`. */
export function sortingSchema<TRow>(
  fn: (column: SortingHandle<TRow>) => void,
): (column: SortingHandle<TRow>) => void {
  return fn;
}
```

## Implementation Notes

- **Take the simplest signature that works** ([[simplest-signature-first]]).
  Try a plain `SortingHandle<TRow>` parameter first, which is
  `K = string, V = unknown`. Only make the helper generic in `K` if
  `SortingHandle<Row, 'total', number>` turns out not to be assignable to
  it. Step 5's types spec settles this.
- **JSDoc stays terse.** Say what each declarator records and what a
  duplicate does. Don't retell the SO21/SO22 history in source comments;
  Step 6 records it.
- **Export nothing from `index.ts` yet.** The name `sortNulls` is still
  exported from `columns-schema/rules.ts`, and Step 3 swaps the two.

## Risks / Watchouts

- **Name clash inside `with-sorting/`.** Step 2 moves in `feature.ts`,
  which reads the old `column.sortFn` until Step 3. The declarator
  `sortFn` and the field `sortFn` don't collide as identifiers, but keep
  import aliases out of it; nothing should need one.
- **Don't make `schema/run.ts` or `schema/path-proxy.ts` aware of sorting.**
  They import nothing from their callers (#111).

## Non-Goals

- **No `ctx` argument to the comparator.** `ctx.valueOf(path.x, row)` is
  #117's; this step only supplies the `path`.
- **No `groupingSchema` helper.** It could come later, as a follow-up.
- **No table-wide `withSorting({ nulls })` option.** SO17 stays open.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] `schema.ts` calls `runRecordedSchema`, and has no recorder session
      code of its own.
- [ ] `sortingSchema` returns its argument unchanged.

---

[Step 2: Wire `withSorting({ schema })`](step-2-wire-with-sorting.plan.md) →
