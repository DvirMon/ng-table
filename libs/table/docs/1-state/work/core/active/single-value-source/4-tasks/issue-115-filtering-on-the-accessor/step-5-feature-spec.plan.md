# Step 5 — Feature spec

**PR scope:** standalone. **Depends on:** Step 3.
**Parallel-safe with:** Steps 4, 6, 7.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-filtering/feature.spec.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.spec.ts` (edit —
  spelling only)
- `libs/table/src/api/features/with-selection/utils.spec.ts` (edit —
  spelling only)

## Why This Step Exists

The public-surface ACs are asserted through `createTable()`, not the
engine: the construction throw needs a real column list, and the
derived-accessor case must prove the table's `filter` stage (not only
`matcher()`) reads the accessor.

## What To Do

**1. `with-filtering/feature.spec.ts` — migrate + add:**

- **Undeclared column id throws at construction.** A schema naming
  `path.territory` over columns without `territory` → throws, message
  names `withFiltering` and the id. Cover a single rule and an `anyOf`
  child.
- **Derived accessor.** `rows()` narrows by the accessor output.
- **Carrier column (`visible: false`)** narrows `rows()`.
- **Multi-path `anyOf`** folds two columns into one declaration and
  matches on either.
- **Public verbs, matchers and state shape unchanged** — existing
  `filters().value()`, `criteria()`, `reset()` cases keep passing
  untouched.

Where the spec types a schema as its own variable, the spelling is
`FiltersPath<Row, ColumnValues<Row, typeof set.columns>>`, or inline.

**2. The other two specs** — spelling migration only: move their
`FiltersPath<Row>` to the two-argument form (or inline). No new
assertions: they belong to grouping and selection, not filtering.

## Non-Goals

- No type-level assertions — Step 6.
- No engine edge cases already covered in Step 4.

## Acceptance Checks

- [ ] `nx test shared-table` for these three files green.
- [ ] `nx run shared-table:typecheck-spec` clean for these files.
- [ ] The construction-throw case fails if Step 3's
      `assertDeclarationsAreKnown` call is removed.

---
← [Step 4: Engine specs](step-4-engine-specs.plan.md) | [Step 6: Type specs](step-6-type-specs.plan.md) →
