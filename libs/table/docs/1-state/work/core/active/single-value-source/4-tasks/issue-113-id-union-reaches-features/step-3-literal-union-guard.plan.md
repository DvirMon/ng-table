# Step 3 — The literal-union guard

**PR scope:** standalone. **Depends on:** Step 2 (the union does not reach
a feature slot until the overloads are regenerated, so every case here
would assert the `string` fallback instead).

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-table.types.spec.ts` (create)

## Why This Step Exists

This is the gate the rest of the epic waits on. #114, #115 and #100 all
key their declarations by column id; if the union silently widens to
`string`, every one of them still compiles and every path becomes an index
signature with no error. ADR-0019 records this under Consequences —
_"Literal inference is required, and its absence is silent"_ — and the
epic's `decisions.md` names it the one risk K1 carries.

A spec is the only place this can be caught, because the failure has no
runtime expression: at runtime `buildColumnsPath`'s `get` trap fabricates a
handle for any string, widened or not. AC #3 asks for the failure mode to
be _covered_, not documented.

## What To Do

Create `libs/table/src/api/create-table.types.spec.ts`, following the
existing compile-time-assertion convention
(`api/types.types.spec.ts`, `with-filtering/feature.types.spec.ts`):
a `typecheckOnly(assertions: () => void)` wrapper, `expectTypeOf`, and a
file-level doc comment stating that **`nx run shared-table:typecheck-spec`
is what enforces this file** — the vitest runner executes `expectTypeOf`
and `@ts-expect-error` without typechecking either.

**The probe feature.** Declare it locally in this file — nothing here ships
on the public API:

```ts
const withProbe = <In extends Shape>(cfg: {
  schema: (path: ColumnsPath<RowOf<In>, ColumnIdOf<In>>) => void;
}) => createTableFeature<In, {}>(() => ({}));
```

It stands in for #114/#115/#100's real configs. Its only job is to sit in
a `createTable()` slot and put `ColumnIdOf<In>` in a consumer's hands.

**Four cases.**

1. **A declared id is nameable.** Build `columns` the way
   `create-table.spec.ts:20-36` does — a helper with **no**
   `ColumnDef<Row>[]` return annotation, `id: '…' as const`, closed with
   `satisfies ColumnDef<Row>[]`. Call
   `createTable(data, { trackBy: 'id', columns: makeColumns() }, withProbe({ schema: (path) => { path.status; } }))`
   and assert `expectTypeOf<ColumnIdOf<…>>().toEqualTypeOf<'name' | 'status'>()`
   — the union is the literal set, which is AC #2.

2. **A typo is rejected at the call site.** The same call with
   `path.statuss`, under `// @ts-expect-error — 'statuss' was never
declared in columns`. This is AC #1. Keep it in its own `it` so the
   expected error cannot be absorbed by an unrelated failure on an
   adjacent line.

3. **The widening failure mode is pinned.** A second fixture whose helper
   _is_ annotated `: ColumnDef<Row>[]`, and an assertion that the recovered
   union is exactly `string`. Two things must hold and both are asserted:
   the union is `string`, **and** `path.anythingAtAll` compiles under it —
   the index-signature degradation, stated rather than implied. This is
   AC #3: a change in either direction (widening the literal case, or
   accidentally tightening the widened one) fails the run.

4. **The arity escape hatch carries the union.** The same probe reached
   through `composeFeatures(withComputed(…), withProbe({…}))` in one
   `createTable()` slot, asserting the union is still `'name' | 'status'`
   and that a typo inside the composite is still rejected. This is the
   evidence for AC #4 — Step 4 records the decision that cites it.

## Implementation Notes

- **Call `createTable(...)` inline in every case.** Routing the probe
  through a shared generic helper is what broke
  `with-filtering/feature.types.spec.ts` — an extra generic wrapper left a
  default parameter undischarged and `toEqualTypeOf` reported a spurious
  `Actual: unknown`. That file's header records it; do not re-derive it.
- **`ColumnIdOf<…>`'s argument in the assertions** is the composed store
  type the call returns. Recovering it off the returned store (rather than
  naming `TId` directly) is the point — it proves cross-argument recovery,
  which is the exact path ADR-0019's spike tested.
- **Put the two fixtures side by side, with a comment on each** saying why
  one is annotated and one is not. A future reader deleting the "missing"
  annotation on fixture 1 would silently disarm case 1.
- Case 4 uses `withComputed()` as the composite's other member because it
  is the one existing feature with no column-id surface of its own — it
  keeps the case about carriage, not about a second feature's config.

## Risks / Watchouts

- **`@ts-expect-error` is satisfied by _any_ error on the next line.** In
  case 2, assert the surrounding call still produces a store of the
  expected type, so an error caused by something other than the typo shows
  up as a second failure rather than passing quietly.
- **This file must fail before Step 2 and pass after.** If it passes
  against the pre-Step-2 tree, cases 1 and 4 are asserting the `string`
  fallback and the guard is worthless. Worth checking once, deliberately.
- **`*.spec.ts` is excluded from `tsconfig.lib.json`** — verify with
  `nx run shared-table:typecheck-spec`, not the lib target.

## Non-Goals

- **No runtime assertions.** Every case here is compile-time; the file
  contributes no behaviour coverage.
- **No edits to existing specs.** `api/create-table.spec.ts` keeps its own
  `expectTypeOf` blocks; this is a sibling file, not a replacement.
- **No guard that makes a widened config throw at runtime.** ADR-0019's
  Consequences ask that widening be made "loud"; a type-level fact has no
  runtime witness, and a heuristic that guesses at it would fire on
  legitimate `setColumns()` columns. Case 3 pins the behaviour instead, and
  Step 4 records the non-goal.
- **No probe for #114/#115/#100's actual config shapes.** Those specs
  belong to those issues — a spec asserts its own domain only
  (`.claude/rules/spec-files-assert-own-domain-only.md`).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean, with all four cases
      present.
- [ ] `nx test shared-table` passes; no existing spec modified.
- [ ] Case 4 passes — or, if it does not, Step 2 reopens and Step 4's
      decision is written the other way. Do not soften the assertion to
      make it pass.

---

← [Step 2: The generator carries `TId` into every slot](step-2-generator-carries-tid.plan.md) | [Step 4: Record the escape-hatch decision](step-4-record-escape-hatch-decision.plan.md) →
