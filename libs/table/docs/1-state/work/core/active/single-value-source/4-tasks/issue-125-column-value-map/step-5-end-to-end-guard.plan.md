# Step 5 — The end-to-end guard

**PR scope:** standalone. **Depends on:** Step 4 (the map does not reach a
feature slot or the returned store until the overloads are regenerated, so
every case here would assert the `ColumnValueMap` default instead).
**Parallel-safe with:** nothing — this is the gate.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-table.types.spec.ts` (edit)

## Why This Step Exists

Step 2 proved the derivation. This step proves the **carriage** — that the
map survives `TableConfig`, the 16 generated signatures, the composed
store and the arity escape hatch, and comes back out of
`ColumnValuesOf<typeof table>` intact. Those are different failures with
different causes, and only this one gates #115, #100 and the grouping
retrofit.

The issue's acceptance criterion is explicit about where it lands: _"A
`_.types.spec.ts`proves the map resolves both arms and rejects a typo'd
column id, **extending`api/create-table.types.spec.ts`rather than
sitting beside it**"*. That file is already the seam for "what a`createTable()` call returns, at the type level" — a second file asserting
the same domain would split ownership of one statement across two places.

## What To Do

**1. Cases 1–4 stay byte-identical.** They are #113's guarantee — the
literal id union, the typo rejection, the pinned widening failure mode,
and carriage through `composeFeatures`. State this as a check, not a hope:
if one of them had to change to make this step pass, the slice broke
something #113 shipped, and **the fix belongs in Step 3 or Step 4, not
here**. Do not adjust an existing assertion to accommodate a new type
parameter.

**2. New cases, each calling `createTable(...)` inline** the way the
existing four do.

- **The map comes back off the store.** Build columns with
  `createColumns<Row>()([...])`, hoisted, and assert
  `expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{…}>()` —
  the whole map, not member by member. In the same case, assert
  `ColumnIdOf<typeof table>` is still the literal id union. That second
  assertion is what proves the issue's claim that **`TId` stays derivable
  as `keyof TValues & string`**: one parameter now carries what two used
  to, and `ColumnIdOf` was not edited to make it work.

- **Both arms resolve off the store, not only off the columns value.** A
  declared-`accessor` column and a defaulted column, read through
  `ColumnValuesOf<typeof table>[...]`. Step 2 asserts these against
  `ColumnValues<Row, typeof cols>` directly; the point here is that the
  round trip through the config and the overloads does not flatten them.

- **A typo'd column id is rejected at the call site.** Reuse the existing
  `withProbe` feature — it already puts `ColumnIdOf<In>` in a consumer's
  hands via `schema` — and keep the case in its own `it`, with the
  surrounding call's type re-asserted, exactly as case 2 documents today.

- **Carriage through `composeFeatures`.** Extend the existing case 4
  shape — `composeFeatures(withComputed(…), withProbe({…}))` in one
  `createTable()` slot — so the assertion covers the **map**, not only the
  union. This is the evidence that Step 4's "no `COMPOSE_FEATURES`
  change" call was right; if it fails, Step 4 reopens rather than this
  assertion softening.

## Implementation Notes

- **Call `createTable(...)` inline in every case.** Routing through a
  shared generic helper is what broke
  `with-filtering/feature.types.spec.ts` — an extra generic wrapper left a
  default parameter undischarged and `toEqualTypeOf` reported a spurious
  `Actual: unknown`. The file's existing header comment already records
  this; do not re-derive it.
- **Hoist the `createColumns<Row>()([...])` fixture** into a module-level
  `const` or a helper with no return annotation, alongside the existing
  `makeColumns()` / `makeWidenedColumns()` pair. Hoisting is the case that
  matters — inline capture was never in doubt — and putting it next to the
  other two fixtures keeps the three declaration styles readable side by
  side.
- **Add a comment on the new fixture saying why it has no return
  annotation**, in the same voice as the two comments already above
  `makeColumns()` and `makeWidenedColumns()`. Those comments exist because
  a reader "fixing" the missing annotation silently disarms the case.
- **Recover off the returned store, not off the fixture.** Naming
  `ColumnValues<Row, typeof cols>` here would re-assert Step 2 and prove
  nothing about carriage. Every assertion's subject is `typeof table`.

## Risks / Watchouts

- **`@ts-expect-error` is satisfied by any error on the next line.** Every
  new negative case must be paired with a positive assertion on the
  surrounding call, so an error caused by something other than the typo
  surfaces as a second failure rather than passing quietly. Case 2 is the
  model.
- **This file must fail before Step 4 and pass after.** If the new cases
  pass against a pre-Step-4 tree, they are asserting the
  `ColumnValueMap` default and the guard is worthless. Worth checking once,
  deliberately — the same check #113 Step 3 asked for.
- **`toEqualTypeOf` on a mapped type compares keys too.** An extra or
  missing key fails, which is the behaviour wanted. Do not reach for
  `toMatchTypeOf` when it does.
- **`*.spec.ts` is excluded from `tsconfig.lib.json`** — verify with
  `nx run shared-table:typecheck-spec`, not the lib target.

## Non-Goals

- **No runtime assertions.** Every case here is compile-time; the file
  contributes no behaviour coverage.
- **No probe for #115 / #100 / the grouping retrofit's actual config
  shapes.** Those specs belong to those issues — a spec asserts its own
  domain only (`.claude/rules/spec-files-assert-own-domain-only.md`).
- **No guard making a widened config throw at runtime.** A type-level fact
  has no runtime witness; case 3 pins the behaviour instead, and that call
  was already made and recorded under #113.
- **No edits to `api/create-columns.types.spec.ts`.** Step 2 owns it.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean, with the new cases
      present.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx test shared-table` passes.
- [ ] `git diff` shows cases 1–4 unchanged.
- [ ] The `composeFeatures` case passes — or, if it does not, Step 4
      reopens and `COMPOSE_FEATURES` gains the parameters. Do not soften
      the assertion to make it pass.

---

← [Step 4: The generator carries the map into every slot](step-4-generator-carries-the-map.plan.md) | [Step 6: Record the decision](step-6-record-the-decision.plan.md) →
