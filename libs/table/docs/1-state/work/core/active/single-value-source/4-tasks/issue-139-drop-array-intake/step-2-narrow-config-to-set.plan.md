# Step 2 — `TableConfig` takes a `ColumnSet` only

**PR scope:** standalone. **Depends on:** Step 1.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit — `TableConfig`, `:204-212`)
- `libs/table/src/api/create-table.ts` (edit — intake + comment
  block, `:38-54`)
- `libs/table/src/engine/columns-schema/resolve.ts` (**delete**)
- `libs/table/src/engine/columns-schema/index.ts` (edit — drop
  the `resolve` re-export)
- `libs/table/src/engine/types.ts` (maybe — `TableEngineConfig.columns`,
  `:22`)

## Why This Step Exists

This is #139's contract change (D11): the array intake is removed
outright. No shim, overload or deprecated alias.

It also settles the shaping question the issue left open, per
the user ruling of 2026-09-24: **the compile step folds into the
intake.** After #132, `resolveColumnsConfig` only turns a schema
fn into rules, and a `ColumnSet` already carries resolved rules.
Nothing is left for it to do.

## What To Do

1. **`TableConfig`** — constrain on the declaration type and take
   the set only:

   ```ts
   export interface TableConfig<
     TRow,
     TCols extends readonly ColumnDecl<TRow, string, unknown>[] =
       readonly ColumnDecl<TRow, string, unknown>[],
   > {
     trackBy: TrackByConfig<TRow>;
     columns: ColumnSet<TRow, TCols>;
     injector?: Injector;
   }
   ```

   Re-read the `// Note:` above it (`:200-203`). It explains
   why the config is keyed on `TCols` rather than `TValues`,
   using the array's id inference as the reason. Keep the
   `TCols` keying. Rewrite the note so it no longer names a
   plain array.
2. **Intake** in `create-table.ts`: replace the
   `resolveColumnsIntake` call and the comment block
   (`:38-42`) with a direct unpack:
   `const { columns, rules } = config.columns;`
   Drop the `resolveColumnsIntake` import.
3. **Readonly spread**: `TableEngineConfig.columns` is a
   mutable `ColumnDefInput<TRow>[]`. Check `createTableCore`.
   If it never mutates the input array, widen the field to
   `readonly ColumnDefInput<TRow>[]` and pass `columns`
   straight through (architecture: "drop the readonly
   spread"). If it does mutate, keep `[...columns]` and add
   a one-line `//` saying why.
4. **Delete `resolve.ts`**, meaning `isColumnSchema`,
   `resolveColumnsConfig` and `resolveColumnsIntake`. Also
   drop its line from `engine/columns-schema/index.ts`.
   Re-grep for `columnSchema`/`ColumnsSchemaFn`/`ColumnSchema`
   imports that were only there for `resolve.ts`.
5. JSDoc on `createTable` (`:10-28`): its example passes
   `columns`. Make sure the example reads as a `createColumns()`
   set, not an array.

## Risks / Watchouts

- **`ColumnDefInput` stays.** It is the engine's
  resolved-input shape (`TableEngineConfig.columns`,
  `setColumns`, `ColumnValues`'s constraint). Deleting or
  renaming it is out of scope. #139's AC checks that it
  survives.
- `ColumnValues`'s constraint (`ColumnDefInput<any, string>[]`)
  still accepts a `ColumnDecl[]`. Don't retarget it here. The
  generated file must change only in the `TCols` constraint.
- `index.ts` (public barrel): confirm nothing public
  re-exports `resolveColumnsConfig`/`resolveColumnsIntake`.
- **Expected failure:** `typecheck-spec` fails in
  `create-table.types.spec.ts` (cases 13/14 pass plain arrays).
  Step 4 fixes that. Any failure **outside** that file means
  a caller #137/#138 missed. Stop and report it; don't
  migrate it here.

## Non-Goals

- No generator edit or regeneration (Step 3).
- No type-proof changes (Step 4).
- No prose docs (#141).

## Acceptance Checks

- [ ] `libs/table/src/engine/columns-schema/resolve.ts` does
      not exist; `grep -rn "resolveColumns" libs/table/src` → no hits.
- [ ] `TableConfig.columns` is `ColumnSet<TRow, TCols>` — no
      union, no array arm.
- [ ] `ColumnDefInput` still exported and still the type of
      `TableEngineConfig.columns`.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx run shared-table:typecheck-spec`: errors confined to
      `create-table.types.spec.ts` (and `create-table.overloads.ts`
      until Step 3, if the constraint mismatch surfaces there).

---
← [Step 1: Move specs off `resolveColumnsConfig`](step-1-move-specs-off-resolve.plan.md) | [Step 3: Generator constraint, regenerated](step-3-generator-constraint.plan.md) →
