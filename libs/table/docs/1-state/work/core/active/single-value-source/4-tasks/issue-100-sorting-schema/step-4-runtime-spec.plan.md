# Step 4 — Runtime spec

**PR scope:** standalone. **Depends on:** Step 3. **Parallel-safe with:**
Step 5, Step 6.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-sorting.spec.ts` → `libs/table/src/api/features/with-sorting/feature.spec.ts` (move + edit)

## Why This Step Exists

The existing spec declares per-column config on `ColumnDef` and through
the columns schema, and neither compiles after Step 3. The recount on
2026-09-24 found six `sortFn` authors and one `enableSorting` author, plus
the `sortNulls` block at `:320`–`:412`. The spec also has to pin the new
construction checks and the new reactive gate.

## What To Do

**1. Migrate; don't rewrite.** Every existing case keeps its assertion.
Only where it declares config changes:

- `makeColumns({ x: { sortFn } })` / `{ enableSorting: false }` →
  `withSorting({ schema: (path) => sortFn(path.x, …) })` /
  `sortable(path.status, { enable: () => false })`.
  `makeColumns` loses its `overrides` parameter if nothing else uses it.
- The `sortNulls` block (`:320`, `:412`) moves from
  `createColumns(data, build, schema)` to `withSorting({ schema })`.
- The ADR-0014 cases (`:540`, `:568`, `:612`): a throwing comparator
  still degrades to `0` and reports once per column. Change only the
  declaration.

**2. New cases:**

- A `sortFn`, `sortNulls` or `sortable` naming an undeclared column id
  throws at construction with `withSorting` in the message.
- Two `sortFn` calls on one column throw. `sortFn` plus `sortNulls` on
  one column doesn't.
- `sortable(path.x, { enable })` backed by a `signal(true)`:
  `toggleSort('x')` sorts; after `set(false)` it is a no-op; after
  `set(true)` it sorts again.
- A column with no `sortable` rule is sortable (the default).
- An `enable` that throws: the column stays sortable, and it reports once
  (Step 2's fallback).
- `sortingSchema`: one helper called on two columns declares rules on
  both. Both columns sort with the helper's comparator and null placement.

## Implementation Notes

- Keep the existing `describe` layout. Put the new cases under one
  `describe('schema')`.
- Mock rows come from `table.mock.ts` / the file's existing fixtures;
  don't write new inline data sets.
- Spy on `console.error` the way the existing ADR-0014 cases do.

## Risks / Watchouts

- **The unknown-id check is dev-gated** (`assertDeclarationsAreKnown`).
  Vitest runs with `ngDevMode` on, and the other feature specs rely on
  that too, so no setup is needed.
- **Specs outside this file** (`with-filtering/feature.types.spec.ts`,
  `with-grouping/feature.spec.ts`, `with-selection/feature.spec.ts`,
  `with-tree.spec.ts`) import `withSorting` but, per the survey, none sets
  `sortFn`/`enableSorting`. If `typecheck-spec` flags one, migrate it here
  and name it in the report.

## Non-Goals

- No new tests of `detectComparator` (SO7 stays open).
- No type assertions. Step 5 owns those.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `with-sorting/feature.spec.ts` passes.
- [ ] Nothing in `src/**/*.spec.ts` references `enableSorting`,
      `SORT_NULLS`, or `sortNulls` from `columns-schema`.

---

← [Step 3: Delete the old surface](step-3-delete-old-surface.plan.md) | [Step 5: Types spec](step-5-types-spec.plan.md) →
