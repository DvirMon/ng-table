# Step 2 — The capture guard

**PR scope:** standalone. **Depends on:** Step 1 (nothing to assert until
`ColumnValues` and `createColumns` exist).
**Parallel-safe with:** Step 3, Step 4 — this file never calls
`createTable()`, so it neither reads nor is read by the store plumbing.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-columns.types.spec.ts` (create)

## Why This Step Exists

The mechanism can fail silently in two directions and neither has a
runtime witness. If `createColumns()` does not actually capture literal
ids, every downstream map degrades to an index signature and *everything
still compiles*. If the `ColumnValues` conditional picks the wrong arm, a
column maps to the wrong type and the first thing anyone learns about it
is a wrong criterion type in #115.

Proving the derivation **here**, against the types alone, is what keeps
the diagnosis cheap. Once Steps 3 and 4 land, a failure is a failure of
`createColumns` + the store shape + the generated overloads together, and
telling which one broke costs a bisect. Before them, it is one mapped type
and one identity function.

This is also why the step is parallel-safe with Step 3: it asserts Step
1's domain only (`.claude/rules/spec-files-assert-own-domain-only.md`), so
it can be written and reviewed while the plumbing is in flight.

## What To Do

Create `libs/table/src/api/create-columns.types.spec.ts` following the
existing compile-time-assertion convention
(`api/create-table.types.spec.ts`, `with-filtering/feature.types.spec.ts`):
a local `typecheckOnly(assertions: () => void)` wrapper, `expectTypeOf`,
and a file-level doc comment stating that **`nx run
shared-table:typecheck-spec` is what enforces this file** — the vitest
runner executes `expectTypeOf` and `@ts-expect-error` without typechecking
either, so a green `nx test` proves nothing about it.

**The fixture row.** Declare it locally. It needs one object-valued field,
because that is the case the whole map exists for:

```ts
interface DealRow {
  id: string;
  amount: number;
  owner: { name: string; email: string };
}
```

**Five cases.**

1. **A hoisted declaration keeps its literal ids.** Assign
   `createColumns<DealRow>()([...])` to a module-level `const`, then assert
   `typeof cols[number]['id']` is the literal union, **not** `string`.
   This is the whole point of the helper: if this case passes while the id
   is `string`, the mechanism is dead and every case below is asserting a
   fallback. Hoist it deliberately — an inline array would prove the one
   thing that was never in doubt.

2. **The accessor arm.** A column declared
   `{ id: 'owner', accessor: (row) => row.owner.name }` maps to `string`,
   **not** to `{ name: string; email: string }`. Comment that this is
   precisely the case ADR-0024 exists to close, and precisely the case the
   obvious patch — `K extends keyof TRow ? TRow[K] : unknown` — gets
   wrong: `owner` *is* a `keyof DealRow`, so that guess returns the object
   and lies. Also assert the accessor param needs no annotation: the
   curried form has already bound `TRow`, so `(row) => row.owner.name`
   typechecks with `row: DealRow`.

3. **The defaulted arm.** A column declared `{ id: 'amount' }`, with no
   accessor, maps to `number` — `TRow['amount']`. Comment that this arm is
   exact rather than a fallback, because the engine's documented default
   accessor *is* `(row) => row[id]`.

4. **The carrier arm.** A column whose id is not a `keyof DealRow` and
   which declares no accessor maps to `unknown`. This is the carrier-column
   shape (`{ id, accessor, visible: false }`) minus its accessor — the one
   combination the map genuinely cannot resolve, and `unknown` is the
   honest answer rather than an error.

5. **The degradation, pinned.** A plain `ColumnDefInput<DealRow>[]` built
   by a helper with an explicit return-type annotation — no
   `createColumns` — yields an index-signature map, so
   `ColumnIdIn<ColumnValues<DealRow, typeof widened>>` is `string`. Mirror
   case 3 of `api/create-table.types.spec.ts` in spirit, and say in the
   comment that this **pins the failure mode, it does not endorse it**: a
   change in either direction (a widened case tightening, or a literal case
   widening) fails the run.

## Implementation Notes

- **Put the captured and widened fixtures side by side, each with a
  comment saying why it is written the way it is.** `create-table.spec.ts`
  and `create-table.types.spec.ts` both already do this for the `as
  const` / annotated pair, and for the same reason: a future reader
  "fixing" case 1 by adding a return-type annotation would silently disarm
  it, and the comment is the only thing standing in the way.
- **Assert with `toEqualTypeOf`, not `toMatchTypeOf`.** The failure mode
  here is a type being *wider* than expected (`string`, `unknown`, an index
  signature), and `toMatchTypeOf` passes on exactly those.
- **Assert the whole map in at least one case**, not only individual
  members — `expectTypeOf<ColumnValues<DealRow, typeof cols>>()
  .toEqualTypeOf<{ owner: string; amount: number; … }>()`. A per-key
  assertion cannot catch an extra or missing key.
- **Define the row interface locally; do not import a story fixture.**
  Importing `DealRow` from `src/stories/grouping/fixtures/types.ts` would
  couple this spec to a fixture that exists to serve Storybook and is free
  to change shape.

## Risks / Watchouts

- **Case 1 is the load-bearing one.** If it fails, do not soften it — the
  curried signature or the `readonly` constraint is wrong, and Step 1
  reopens. A `const` modifier with a mutable constraint fails exactly this
  way, silently falling back to the constraint.
- **`@ts-expect-error` is satisfied by any error on the next line.** If any
  case here uses one, pair it with a positive assertion on the surrounding
  expression so an unrelated failure shows up as a second failure rather
  than passing quietly.
- **`*.spec.ts` is excluded from `tsconfig.lib.json`** — verify with
  `nx run shared-table:typecheck-spec`, not the lib target. The lib target
  cannot see this file at all.

## Non-Goals

- **No `createTable()` call in this file.** End-to-end carriage — the map
  surviving the config, the overloads and the composed store — is Step 5's,
  in `api/create-table.types.spec.ts`. Asserting it here would make this
  spec depend on Steps 3 and 4 and cost the parallel-safe edge.
- **No runtime assertions.** `createColumns` is the identity function;
  there is no behaviour to cover.
- **No edits to any existing spec.** This is a new sibling file.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean, with all five cases
      present.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx test shared-table` passes; no existing spec modified.
- [ ] Case 1 asserts the literal union and would fail against `string` —
      confirm once by temporarily widening the fixture, then revert.

---
← [Step 1: `ColumnValues<>` and the `createColumns()` capture point](step-1-column-values-and-create-columns.plan.md) | [Step 3: The store shape carries the map](step-3-store-carries-the-map.plan.md) →
