# Step 2 — Wire `withSorting({ schema })`

**PR scope:** standalone. **Depends on:** Step 1, for the declarators and
`runSortingSchemaFn`.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-sorting.ts` → `libs/table/src/api/features/with-sorting/feature.ts` (move + edit)
- `libs/table/src/api/features/with-sorting/index.ts` (new; re-exports `feature.ts` only, like `with-grouping/index.ts`)

## Why This Step Exists

SO19/SO21: all per-column sorting config comes from the feature's own
schema. This step switches the reads over. `sortRows` and `toggleSort`
stop reading `column.sortFn`, `column.enableSorting` and the `SORT_NULLS`
metadata. The old fields remain until Step 3 deletes them, so this step
compiles.

## What To Do

**1. Move the file.** `index.ts` re-exports `withSorting`,
`SortingMembers`, `WithSortingConfig` and the Step 1 public types. Every
current importer (`'./with-sorting'`, `'../with-sorting'`, the story
hosts) already points at the folder, so import paths don't change.

**2. Add `schema` to the config**, typed through the value map, the way
`withGrouping` does it:

```ts
export interface WithSortingConfig<TRow, TValues extends ColumnValueMap = ColumnValueMap> {
  manual?: boolean;
  multi?: boolean;
  schema?: SortingSchemaFn<TRow, TValues>;
}
```

The overloads take `WithSortingConfig<RowOf<In>, ColumnValuesOf<In>>`.
Keep the derive-first overload.

**3. `buildSortingSpec` compiles the schema once, at construction:**

- `rules = config.schema ? runSortingSchemaFn(config.schema) : []`.
- `assertDeclarationsAreKnown(rules.map(r => r.columnId), input.columns().map(c => c.id), 'withSorting')`.
- **Duplicate check.** A second rule of the **same kind** on one column
  throws: `[withSorting] <kind> declared twice on column '<id>'`.
  This extends SO15, which covered `sortNulls` only. It is a
  construction error, so it throws and is not dev-gated
  ([[classify-errors-construction-vs-runtime]]); unlike the unknown-id
  check, it doesn't depend on which ids happen to appear in dev. Rules of
  different kinds on one column are fine.
- Fold into three maps keyed by column id: `nullsByColumn`,
  `compareByColumn`, `enableByColumn`.

**4. Change the reads:**

- `readSortNulls(column)` becomes `nullsByColumn.get(column.id)`.
  `isEmpty` and `nullsOrderFor` take the opts, not the column.
- In `sortRows`, `compareByColumn.get(id) ?? detectComparator(...)`.
  It still goes through `guardCompare` (ADR-0014, SO24), unchanged.
- In `toggleSort`, the column is sortable when it is declared and
  `enableByColumn.get(id)?.() ?? true`. Everything is sortable by default.

**5. Update the `withSorting` JSDoc.** Replace "Reads `sortFn` /
`enableSorting` directly off `columns`" with one line about `schema`,
plus the example from #100's body using the three declarators.

## Implementation Notes

- **Pass the maps into `sortRows`; don't have it read `columns` for config.**
  `sortRows(rows, rules, columns, config)` still needs `columns` for the
  `accessor` (`readAccessor`), and nothing else.
- **`enable` is read at call time, inside `toggleSort`**, so a signal read
  inside it is live. It must not be cached at construction.
- **An `enable` that throws** is a consumer callback at runtime (ADR-0014).
  Treat it as `true`, meaning still sortable, which is the visible
  direction. Report it once per column with the same `console.error` floor
  as `reportComparatorError`. Add a row for it to ADR-0014's fallback table
  in Step 6.

## Risks / Watchouts

- **Specs go red here, by design.** The `sortNulls` fixtures in
  `with-sorting.spec.ts` declare through `createColumns(…, schema)` and
  nothing reads `SORT_NULLS` any more. The `sortFn`/`enableSorting`
  fixtures on `ColumnDef` are silently ignored. Step 4 owns the migration;
  don't patch specs here.
- **`setSorting()` stays unguarded.** A programmatic write may name a
  column whose `enable` is false. That matches today's `enableSorting`
  behavior; don't add a guard.

## Non-Goals

- **No `isSortable(columnId)` member.** The 09-17 plan proposed one. It
  isn't in #100's acceptance criteria.
- **An active sort isn't dropped when `enable` flips to false.**
  `enableSorting` never did that either.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] `feature.ts` has no reads of `column.sortFn`, `column.enableSorting`
      or `SORT_NULLS`.
- [ ] `withSorting({ schema })` naming an undeclared column id throws at
      construction with the `withSorting` label (Step 4 tests it).

---

← [Step 1: The sorting schema module](step-1-sorting-schema-module.plan.md) | [Step 3: Delete the old surface](step-3-delete-old-surface.plan.md) →
