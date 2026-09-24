# Step 2 — Runtime spec: `create-columns.spec.ts`

**PR scope:** standalone. **Depends on:** Step 1.
**Parallel-safe with:** Step 3 — different file, disjoint
assertions (runtime vs. compile-time).

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-columns.spec.ts` (create)

## Why This Step Exists

The set is what #131 will unpack, so its runtime shape is a
contract before anything reads it. Asserting it now, while
`createColumns` is a standalone pure call, keeps a later
intake failure diagnosable as "intake" rather than "set".

This spec covers the #130 part of spec § "The seams" item 1.
The three construction checks named there arrive with #132
and get their cases then.

## What To Do

Plain `vitest`, no `TestBed` — `createColumns` touches no
signal and no injection context. Declare a local row
interface; do not import a story fixture. Pass the data
witness as a `vi.fn()` returning rows.

Cases — assert observable output only (spec § "What a good
test is here"), never how the builder stores a declaration or
how the brand is spelled:

1. **Shape.** The result has exactly the keys `columns` and
   `rules` — no data reference, no `kind`.
2. **Order.** `columns` preserves declaration order.
3. **`data` is never called.** The `vi.fn()` witness has
   zero calls after `createColumns` returns. Also pass a
   witness returning `undefined` (the resource pre-load case)
   and assert the set is still built.
4. **No default accessor.** `col('amount')` yields a
   declaration with no `accessor` key. The engine, not the
   builder, owns the `row[id]` default (D6).
5. **Options carried.** `col('x', { label, visible, accessor })`
   carries all three.
6. **Variant.** `col.from(decl, { id: 'y', label: 'Y' })`
   carries the new id and options, keeps `decl`'s other
   fields, and leaves `decl` itself unchanged (`toEqual` a
   snapshot taken before the call; not the same reference).
   A `from` without `id` keeps the original id.
7. **Empty list.** `createColumns(data, () => [])` returns
   `{ columns: [], rules: [] }` and does not throw (D9).
8. **Schema forms.** An inline schema fn and the same body
   wrapped in `columnSchema()` produce equal `rules`, each
   carrying the declared `columnId`. No schema → `rules: []`.

## Implementation Notes

- Use a `metadata()` rule with a local
  `createColumnMetaKey()` for case 8 — deterministic, no
  async factory.
- Case 3's zero-call assertion is the runtime half of the
  issue's "never invoked" criterion; Step 3 carries the type
  half (the `undefined`-yielding witness is accepted).

## Risks / Watchouts

- Don't assert the brand's absence or presence at runtime —
  it is type-only by decision (D7), and asserting it would
  pin an implementation detail.
- Don't add throw cases: nothing throws in #130. A throw
  case written now would pin behavior #132 changes.

## Non-Goals

- No `createTable` call (#131).
- No construction-check cases (#132).
- No type assertions (Step 3).

## Acceptance Checks

- [ ] All eight cases present.
- [ ] `nx test shared-table` — this file passes; no existing
      spec modified.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 1: Declaration types and the data-first builder](step-1-declaration-types-and-builder.plan.md) | [Step 3: Type proofs](step-3-type-proofs.plan.md) →
