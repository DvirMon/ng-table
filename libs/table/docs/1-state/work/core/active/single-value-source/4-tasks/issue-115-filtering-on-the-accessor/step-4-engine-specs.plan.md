# Step 4 — Engine specs

**PR scope:** standalone. **Depends on:** Step 2.
**Parallel-safe with:** Step 3.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/engine/filters/build.spec.ts` (edit)
- `libs/table/src/engine/filters/state.spec.ts` (edit)
- `libs/table/src/table.mock.ts` (edit, only if a fixture column set is
  missing)

## Why This Step Exists

Both specs call `buildFilterModel(schema)` with one argument and type
`path` as `FiltersPath<Invoice>`. They must move to the columns getter,
and the engine's new behaviour needs its own cases. Pure engine — plain
`vitest`, no `TestBed`.

## What To Do

**1. Migrate.** Each spec's `build()` helper takes a column list and
passes `() => columns`. Declare the fixture's columns once via
`createColumns()`; `path` is typed off `ColumnValues<Invoice, …>`. No
existing assertion is softened.

**2. New cases in `build.spec.ts`:**

- **Derived accessor.** A column `id: 'owner'`, `accessor: r =>
r.owner.name`; `equals(path.owner)` set to `'Ada'` matches the row whose
  cell shows `Ada`, not by the raw `owner` object.
- **Carrier column.** A column declared `visible: false` is filterable
  like any other.
- **Throwing accessor.** The predicate sees `undefined`; the filter
  still evaluates; one `[createTable]` report per evaluation.
- **Removed column.** The columns getter stops returning a filtered
  column: that filter does not narrow, reports once per evaluation, and
  other filters still narrow.
- **`anyOf` over two derived columns** reads both accessors.

## Non-Goals

- No `createTable()` — that's Step 5.
- No type-level assertions — Step 6.

## Acceptance Checks

- [ ] `nx test shared-table` for `engine/filters/**` green.
- [ ] `nx run shared-table:typecheck-spec` clean for these two files.
- [ ] Each new case fails if `evaluator.ts` reverts to `rowRecord[path]`.

---

← [Step 3: Widen `withFiltering`'s input](step-3-widen-feature-input.plan.md) | [Step 5: Feature spec](step-5-feature-spec.plan.md) →
