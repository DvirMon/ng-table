# Step 4 — Delete `columnsSchema` from `createTable`

**PR scope:** standalone. **Depends on:** Step 3.
**Parallel-safe with:** Step 2.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit — `TableConfig`, `:215-217`)
- `libs/table/src/api/create-table.ts` (edit — intake + its
  comment block `:40-48`)
- `libs/table/src/engine/columns-schema/resolve.ts` (edit)

## Why This Step Exists

User ruling, 2026-09-24: the separate schema config is no
longer supported. A set is the only way to give a table
column-schema rules. The array intake survives until #139.
It just carries no rules.

## What To Do

1. **`TableConfig`**: delete `columnsSchema`. Drop the
   `ColumnsSchemaFn`/`ColumnSchema` imports if nothing else
   in the file reads them.
2. **Intake**: the array branch now yields `rules: []`. The
   set branch is unchanged. Rewrite the comment block
   at `:40-44` to describe the two inputs, including why the
   array branch carries no rules.
3. **`resolve.ts`**: `resolveColumnsConfig` no longer sees
   an unresolved schema:
   - Delete `isColumnSchema` if it has no reader left
     (re-grep; `createColumns` separates the two with
     `typeof`).
   - Drop the `columnSchema` import if unused.
   - Keep both asserts running on the normalized
     `{ columns, rules }`. They move with #132, not here.
   - Leave the `'columnsSchema'` label and the
     `[columnsSchema]` message prefix as they are.
     Relabelling is #132's (E12).
   - If the function now only runs the two asserts, it may
     collapse into the intake (open question 4). That's
     the implementer's call. Keep the asserts in `resolve.ts`
     either way, where #132 expects to find them.
4. Re-check the `createTable` JSDoc (`:11-30`). Its example
   uses the bare array, which is still valid. No edit unless
   it names `columnsSchema`.

## Risks / Watchouts

- If Step 1 chose shape 2, the union constraint still admits
  plain arrays. Don't narrow it. Deleting the array intake
  is #139's.
- `index.ts` re-exports: confirm nothing public names
  `columnsSchema` as a type or value.

## Non-Goals

- No array-intake removal (#139).
- No construction-check move or dev-only gate (#132).
- No prose docs (#141).

## Acceptance Checks

- [ ] `grep -rn "columnsSchema" libs/table/src --include=*.ts`
      hits only the assert label/message in `resolve.ts`,
      spec titles already renamed in Step 3 excepted.
- [ ] Array form: columns resolve, no rules wired.
- [ ] `npm run table:overloads:check` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean.

---

← [Step 3: Move specs off `columnsSchema`](step-3-move-specs-off-columns-schema.plan.md) | [Step 5: Carriage proofs](step-5-carriage-proofs.plan.md) →
