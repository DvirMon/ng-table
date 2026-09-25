# Step 5 — Types spec

**PR scope:** standalone. **Depends on:** Step 3. **Parallel-safe with:**
Step 4, Step 6.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-sorting/feature.types.spec.ts` (new)
- `libs/table/src/api/types.types.spec.ts` (edit, only if it lists `ColumnDef` keys)

## Why This Step Exists

N9: `SortingPath` keys by the declared column-id union, so a typo is a
compile error, not a construction throw. The `sortingSchema` helper
exists only for its types. If it doesn't infer the handle, it has no
reason to exist. Both claims are compile-time claims, and only
`typecheck-spec` enforces them.

## What To Do

Assertions (`expectTypeOf` / `@ts-expect-error`) on a table built with
`createColumns`:

1. `withSorting({ schema: (path) => sortFn(path.nope, …) })` is an error.
   `path.name` is accepted.
2. `path.total` is `SortingHandle<Row, 'total', number>`: the value
   map reaches the handle (#125's edge on #100).
3. `sortingSchema<Row>((col) => …)`: `col` is inferred with no
   annotation, and the result accepts both `path.total` (number) and
   `path.dueDate` (Date | null).
4. `sortFn`'s comparator parameters are `Row`, not `unknown`.
5. `sortable(path.x, { when: … })` is an error, because the key is `enable`.
6. `ColumnDef` has no `sortFn` / `enableSorting` key
   (`expectTypeOf<keyof ColumnDef>()`), and a `col()` declaration can't
   pass them.

## Implementation Notes

- Assertion 3 is what Step 1's "simplest signature" note depends on. If it
  only passes with a generic helper, that's the finding; report it rather
  than weakening the assertion.
- Follow the shape of `with-grouping/feature.types.spec.ts` and
  `with-filtering/feature.types.spec.ts`.

## Risks / Watchouts

- `nx test` runs this file without checking it. A green test run says
  nothing; only `typecheck-spec` counts.

## Non-Goals

- No runtime behavior. Step 4 owns that.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] Every `@ts-expect-error` in the file is actually needed (remove it
      and the check fails).

---
← [Step 4: Runtime spec](step-4-runtime-spec.plan.md) | [Step 6: Docs, decisions and `llms.txt`](step-6-docs-and-decisions.plan.md) →
