# Step 1 — Move specs off `resolveColumnsConfig`

**PR scope:** standalone. **Depends on:** — (but #137 must
be closed before this slice starts).

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-columns.spec.ts` (edit —
  `describe('construction checks')`, `:166`)
- `libs/table/src/columns-schema/metadata.spec.ts` (edit —
  delete `describe('resolveColumnsConfig — duplicate metadata
  registration')`, `:91-117`)
- `libs/table/src/columns-schema/schema.spec.ts` (edit —
  delete `describe('resolveColumnsConfig')`, `:100-135`)

## Why This Step Exists

Step 2 deletes `engine/columns-schema/resolve.ts`. The two
spec files above are its only readers besides the intake.
Moving them first means Step 2 deletes a function nobody
imports.

Ownership (per `spec-files-assert-own-domain-only`):

- The metadata cases ("same key, two columns" and "two keys,
  one column" are both allowed) are the **negative half of
  the duplicate-metadata check**. Since #132 that check lives
  in `createColumns`. They belong beside
  `throws when metadata() is registered twice…` (`:181`).
- The three `resolveColumnsConfig` cases in `schema.spec.ts`
  test intake normalization, which is going away. They are
  already covered by `create-columns.spec.ts` `schema forms`
  (`:134-165`): inline fn ≡ `columnSchema()`, and no rules
  when there is no schema.

## What To Do

1. In `create-columns.spec.ts` `construction checks`, add two
   `it`s that mirror the deleted metadata cases through
   `createColumns(data, build, schema)`:
   - same `ColumnMetaKey` on two different columns → no
     throw, `rules` length 2;
   - two keys on one column → no throw, `rules` length 2.
   Name them the way `:207` names its exemption
   (`does not throw when …`).
2. Delete the `resolveColumnsConfig` describe block in
   `metadata.spec.ts`, and its import if nothing else reads it.
3. Delete the `resolveColumnsConfig` describe block in
   `schema.spec.ts`, and its import. Before deleting, check
   that each case has a `schema forms` counterpart. The
   "accepts a standalone `columnSchema()` value" case must
   match one there. If one has no counterpart, move it; don't
   drop it.

## Risks / Watchouts

- These are negative cases for a check that is
  `ngDevMode`-gated (#132). Run them with `ngDevMode` on, as
  the file's other construction-check cases do.

## Non-Goals

- `resolve.ts` itself is not touched (Step 2).
- No `*.types.spec.ts` (Step 4).

## Acceptance Checks

- [ ] `grep -rn "resolveColumnsConfig" libs/table/src --include=*.spec.ts`
      → no hits.
- [ ] No coverage lost: every deleted case has a
      `create-columns.spec.ts` counterpart.
- [ ] The three touched spec files pass.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
[Step 2: `TableConfig` takes a `ColumnSet` only](step-2-narrow-config-to-set.plan.md) →
