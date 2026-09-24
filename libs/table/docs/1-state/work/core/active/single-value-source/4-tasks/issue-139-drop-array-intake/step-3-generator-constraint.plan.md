# Step 3 — Generator constraint, regenerated

**PR scope:** standalone. **Depends on:** Step 2.
**Parallel-safe with:** Step 4, Step 5.

**Task type:** chore

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/tools/generate-overloads.ts` (edit —
  `baseGenerics`, `:61`; `imports`, `:57`)
- `libs/table/src/api/create-table.overloads.ts`
  (**regenerated, never hand-edited**)

## Why This Step Exists

The generated call signatures must declare the same `TCols`
constraint as `TableConfig`. Step 2 moved it to
`readonly ColumnDecl<TRow, string, unknown>[]`. #139's AC: the
generated file is regenerated, and it differs only in the column
type parameter's constraint.

## What To Do

1. `baseGenerics`: change
   `'TCols extends readonly ColumnDefInput<TRow, string>[]'` to
   `'TCols extends readonly ColumnDecl<TRow, string, unknown>[]'`,
   the exact string from Step 2's `TableConfig`.
2. `imports` (`:57`): add `ColumnDecl`. Drop `ColumnDefInput`
   only if no other generated line names it. Re-check `base`
   and `leadingParams` first.
3. `npm run table:overloads`, then `npm run table:overloads:check`.
4. `git diff libs/table/src/api/create-table.overloads.ts`:
   every changed line must be a `TCols extends …` line or the
   import line. Anything else → stop and report.

## Risks / Watchouts

- A diff in the `Feature<…>` slot lines means the constraint
  leaked into `base`. Revert, and confirm
  `TableStore<TRow, ColumnValues<TRow, TCols>>` is untouched.
- `COMPOSE_FEATURES` spec needs no change. It has no `TCols`.

## Non-Goals

- No hand edit of the generated file.

## Acceptance Checks

- [ ] Generated diff confined to the `TCols` constraint (and
      its import line).
- [ ] `npm run table:overloads:check` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.

---
← [Step 2: `TableConfig` takes a `ColumnSet` only](step-2-narrow-config-to-set.plan.md) | [Step 4: Array-rejection proofs](step-4-array-rejection-proofs.plan.md) →
