# Step 1 — `createTable` accepts a `ColumnSet` beside the array

**PR scope:** standalone. **Depends on:** none (#130 shipped).
**Parallel-safe with:** —

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit — `TableConfig`)
- `libs/table/src/api/create-table.ts` (edit — intake)
- `libs/table/src/engine/columns-schema/resolve.ts` (edit, only
  if the intake needs a new entry point)

## Why This Step Exists

This slice opens the intake the migration slices (#137, #138)
walk through. It must land first, and alone, so a broken
carriage proof is never confused with a mis-migrated fixture.

**Scope amendment (2026-09-24, user ruling):** `columnsSchema`
is removed from `createTable` **in #131**, not in #139. That
deletion is Step 4. This step leaves `columnsSchema` alone,
so every existing caller keeps compiling while Step 3 moves
the three specs that use it.

## What To Do

### 1. `TableConfig.columns` — two accepted inputs

```ts
columns: TCols | ColumnSet<TRow, TCols /* see below */>;
```

`ColumnSet`'s own constraint
(`readonly ColumnDecl<TRow, string, unknown>[]`) is #130's
settled surface. **Don't change it.** An array-form `TCols`
of plain `ColumnDefInput` does not satisfy it, so the set
branch needs a shape that type-checks for both inputs. Try
these in order and stop at the first that passes the probes
below, per `simplest-signature-first`:

1. `ColumnSet<TRow, TCols & readonly ColumnDecl<TRow, string, unknown>[]>`.
   Inference to an intersection with a bare type parameter
   usually infers that parameter directly.
2. Change the `TCols` constraint on `TableConfig` to a union
   both forms satisfy. **This is the constraint Step 2 copies
   into the generator.**

Never go through a conditional type. Inference stops at one.

**Probes (scratch file, deleted before hand-off):**

- A set built by `createColumns(data, (col) => [...])` gives
  `ColumnValues<TRow, TCols>` exact per-id values off the
  returned store.
- An inline array literal still infers exactly as today.

Record the shape you chose, and why the other one failed,
in the hand-off. Step 2 and Step 6 depend on it.

### 2. The intake — one path, two inputs

In `create-table.ts`, normalize before anything else runs:

- `Array.isArray(config.columns)` → the columns are
  `[...config.columns]`, and the rules come from
  `config.columnsSchema` exactly as today.
- Otherwise it is a set → the columns are
  `[...set.columns]`, and the rules are `set.rules`.
  They are already resolved: `createColumns` ran
  `columnSchema()`.

Both branches then feed the **same**
`assertRuleColumnIdsAreKnown` + `assertMetadataKeysAreUnique`
calls and the same `composeTable` call. No second resolver.
A set's unknown rule id must still throw at construction.
The asserts move into `createColumns` with #132, not before.

How `resolveColumnsConfig` reshapes to allow this is the
implementer's call (architecture open question 4). The only
rule: the two asserts run once, on the normalized
`{ columns, rules }`, for both inputs.

The set path reads neither `config.columnsSchema` nor the
set's `data`.

## Implementation Notes

- `Array.isArray` narrows a `readonly` array union cleanly.
  Don't add a type guard for the set.
- `set.columns` elements are `ColumnDecl`s, which are
  structurally `ColumnDefInput`s at runtime, so no cast is
  needed going into `resolveColumnDefs`. Its default
  accessor still owns `row[id]`.
- Keep the stale comment at `:40-44` accurate for now, not
  deleted. Step 4 rewrites it.

## Risks / Watchouts

- **Don't touch `tools/generate-overloads.ts` or
  `create-table.overloads.ts`.** That is Step 2. This step
  must compile against the current generated file. If shape
  2 is chosen, confirm the old overload constraint is still
  assignable to the new `TableConfig` constraint.
- A set passed together with `columnsSchema` is left
  undefined in this step, not handled. Step 4 deletes the
  property.

## Non-Goals

- No `columnsSchema` removal (Step 4).
- No spec edits (Steps 3, 5).
- No construction-check relocation or `ngDevMode` gating
  (#132).

## Acceptance Checks

- [ ] `createTable` accepts a `ColumnSet` on `columns`, and
      still accepts the array form.
- [ ] One normalization point; both inputs reach the same
      asserts and the same `composeTable` call.
- [ ] `create-table.overloads.ts` unchanged;
      `npm run table:overloads:check` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean. No spec
      edited.
- [ ] Hand-off names the chosen `TableConfig` shape.

---

[Step 2: Generator constraint](step-2-generator-constraint.plan.md) →
