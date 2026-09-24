# Step 2 — Generator constraint, regenerated

**PR scope:** standalone. **Depends on:** Step 1.
**Parallel-safe with:** Step 3, Step 4.

**Task type:** chore

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/tools/generate-overloads.ts` (edit —
  `baseGenerics`, line ~61)
- `libs/table/src/api/create-table.overloads.ts`
  (**regenerated, never hand-edited**)

## Why This Step Exists

The generated call signatures must declare the same `TCols`
constraint as `TableConfig`. Otherwise a set reaches
`createTable` through a signature narrower than the config
it passes into. #131's AC: the generated file changes in
exactly one place, the column type parameter's constraint.
The composed-features signatures need no change. They
carry the value map structurally.

## What To Do

1. Read Step 1's hand-off for the chosen `TableConfig`
   shape.
2. **Shape 2** (`TableConfig`'s constraint changed): copy
   that exact constraint into `baseGenerics`'
   `'TCols extends …'` string, and add any type it names to
   the generator's `import type` line (~57).
3. **Shape 1** (constraint unchanged): the generator needs
   no edit. Run the check, record "no diff — shape 1"
   in the hand-off, and stop. Don't invent a change to
   satisfy the AC's wording.
4. `npm run table:overloads`, then
   `npm run table:overloads:check`.
5. `git diff libs/table/src/api/create-table.overloads.ts`:
   every changed line is a `TCols extends …` line, plus at
   most the import line. Anything else → stop and report.

## Risks / Watchouts

- A diff in the `Feature<…>` slot lines means the
  constraint leaked into the base string. Revert, and
  re-check that `base` (`TableStore<TRow, ColumnValues<TRow, TCols>>`)
  was left alone.

## Non-Goals

- No hand edit of the generated file.
- No type proofs (Step 5).

## Acceptance Checks

- [ ] Generated diff confined to the `TCols` constraint
      (and its import), or empty with shape 1 recorded.
- [ ] `npm run table:overloads:check` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 1: Accept a set](step-1-accept-a-set.plan.md) | [Step 3: Move specs off `columnsSchema`](step-3-move-specs-off-columns-schema.plan.md) →
