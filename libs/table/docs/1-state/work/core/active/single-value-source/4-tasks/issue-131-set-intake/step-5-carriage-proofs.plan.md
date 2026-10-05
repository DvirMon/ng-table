# Step 5 — Carriage proofs: `create-table.types.spec.ts`

**PR scope:** standalone. **Depends on:** Step 2, Step 4.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-table.types.spec.ts` (edit — add
  a new `describe` block; leave cases 1-8 alone)

## Why This Step Exists

Derivation is already proven in
`create-columns.types.spec.ts` (#130). This file owns
**carriage**: that the map survives the config boundary, the
generated signatures (Step 2) and a composed slot. #131's AC
explicitly rejects asserting against the derivation alone.

It also pins the scope amendment: `columnsSchema` is gone
from the config type.

## What To Do

Follow the file's conventions: `typecheckOnly(...)`,
`toEqualTypeOf` (never `toMatchTypeOf`), and a locally
declared row with one object-valued field. The existing
cases 1-8 use the curried `createColumns<Row>()([...])`. Leave
them. #138 rewrites them.

Hoist the set to module scope, deliberately, as #130's
case 1 does: `const set = createColumns(data, (col) => [...])`.
An inline set proves only what was never in doubt.

### Cases

9. **Map off the store.** `ColumnValuesOf<typeof store>` for
   a set-built table: one `toEqualTypeOf` on the whole map.
   Include an accessor column whose value differs from the
   field type, plus a defaulted column.
10. **Through a composed slot.** The same map, recovered
    inside a `composeFeatures(...)` bundle passed to
    `createTable`.
11. **Typo in a composed slot.** A feature inside the
    bundle names an undeclared id → `@ts-expect-error`,
    paired with the positive case beside it.
12. **Typo at a direct slot.** The same, without
    `composeFeatures`.
13. **Array form unchanged.** A `createColumns<Row>()`
    array (no set) still yields the literal map. Guards
    Step 1's union against widening the array branch.
14. **`columnsSchema` rejected.** Passing it on the config
    → `@ts-expect-error` (excess property), for both the
    array and the set form.
15. **Row-type mismatch.** A set built for `OtherRow`,
    passed to a table over `Row` → `@ts-expect-error`
    (design brief P5e). If it compiles, record it in the
    hand-off and pin the observed behaviour. Don't soften
    Step 1's types.

## Implementation Notes

- Pair every `@ts-expect-error` with a positive assertion
  on the surrounding expression.
- Only `typecheck-spec` sees this file. A green `nx test`
  proves nothing about it.

## Risks / Watchouts

- If case 9 resolves an accessor column to the field type,
  the set's `TCols` didn't carry `ColumnDecl`'s `V`. That
  sends you back to Step 1's shape. Don't adjust the
  assertion.
- If case 10 holds but 11 doesn't fail, the slot is typed
  against `string` ids. Check Step 2's generated constraint.

## Non-Goals

- No rewrite of cases 1-8 (#138).
- No runtime assertions (Step 3).
- No edits to the two feature `*.types.spec.ts` files
  (#138).

## Acceptance Checks

- [ ] Cases 9-15 present in a new `describe` block.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] Hand-off states case 15's observed behaviour.

---

← [Step 4: Delete `columnsSchema`](step-4-delete-columns-schema.plan.md) | [Step 6: Record the amendment](step-6-record-the-amendment.plan.md) →
