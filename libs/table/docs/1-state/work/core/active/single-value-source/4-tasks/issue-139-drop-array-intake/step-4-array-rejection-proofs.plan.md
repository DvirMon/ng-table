# Step 4 — Array-rejection proofs: `create-table.types.spec.ts`

**PR scope:** standalone. **Depends on:** Step 2.
**Parallel-safe with:** Step 3, Step 5.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-table.types.spec.ts` (edit —
  case 13 `:410-422`, case 14 `:424-…`, and any fixture that
  is a plain array: `capturedValueColumns`, `makeColumns()`)

## Why This Step Exists

#138 left two cases that guard the array arm of the expand
union (13: literal id map through an array; 14: `columnsSchema`
rejected "array and set form alike"). After Step 2, those cases
fail to compile. #139's first AC turns the guard around: the
array form must now be a compile error.

## What To Do

1. **Case 13** → rename to "the array form is a compile error".
   Keep one `createTable(data, { trackBy: 'id', columns: <array> })`
   under `// @ts-expect-error — TableConfig.columns takes a
   ColumnSet only (#139)`. Keep the directive on the `columns`
   line so it pins the right error. Follow the file's
   "own `it` + re-assert the surrounding call" pattern (`:111`,
   `:233`).
2. **Case 14**: drop its array arm (the "array form alone is
   legal" positive). Keep the set arm. Retitle it so it no
   longer says "array and set form alike".
3. Any remaining plain-array fixture in this file used only
   by 13/14: delete it if nothing else reads it; else move it
   onto `createColumns()`.
4. Re-read the file header (`:1-20`) and any comment naming
   "Step 1"/"the array arm" of #131. Rewrite them to the
   one-intake world.

## Risks / Watchouts

- Don't weaken a surviving assertion to get it to compile.
  If a set-form rewrite loses literal precision, that is a
  real regression. Report it.
- `@ts-expect-error` over a multi-line call can match an
  unrelated error. Put it on the `columns:` line.

## Non-Goals

- No other `*.types.spec.ts` unless the typecheck names it.
  If it does, that is a missed #138 caller. Report it.

## Acceptance Checks

- [ ] A `@ts-expect-error` proves the array form is rejected.
- [ ] `grep -n "array arm\|array form" libs/table/src/api/create-table.types.spec.ts`
      → only the rejection case.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.

---
← [Step 3: Generator constraint, regenerated](step-3-generator-constraint.plan.md) | [Step 5: Record the ruling](step-5-record-the-ruling.plan.md) →
