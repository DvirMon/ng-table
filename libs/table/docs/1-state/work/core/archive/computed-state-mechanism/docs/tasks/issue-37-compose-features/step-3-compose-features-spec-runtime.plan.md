---
title: "Step 3 — compose-features.spec.ts + slots.spec.ts: runtime visibility, collisions, hooks"
type: task-step
issue: 71
---

# Step 3 — `compose-features.spec.ts` + `slots.spec.ts`: runtime visibility, collisions, hooks

**PR scope:** The feature-level spec colocated with `compose-features.ts` (spec "Testing
Decisions": one spec per feature), plus one label case in `slots.spec.ts`. Runtime only —
type assertions are Step 4.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 2
**Parallel-safe with:** Step 4

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/compose-features.spec.ts` (new)
- `libs/shared/table/src/engine/slots.spec.ts` (edit — one `describeInnerFeature` case)

## Why This Step Exists

Issue AC 3, 4, 6, 7 are observable only through a composed store: which members a factory
sees, what a collision message says, whether every inner hook fires. Assert what a consumer
observes — never how many times a factory ran or what the inner registry holds.

## What To Do

Fixtures, in the spec file (test-only, not `*.mock.ts`): `MockRow` / `mockRows` /
`mockTrackBy` from `table.mock.ts`; a `makeStore(data, ...features)` wrapper with a
per-arity `MakeStore` overload interface, copied from `with-computed.spec.ts` (extend to
three slots). Synthetic features via `createTableFeature()`, each given a `displayName` with
`Object.assign` so messages can be matched: `fA()` → `a: Signal<number>`
(`rows().length * 10`), `fB()` → `b: Signal<string>`, `fC()` → reads `a` and `b`.
Shipped `with-*` features are **not** used (unconverted until #38–#40).

### Visibility

1. **Following slot sees the composite** — `makeStore(data, composeFeatures(fA(), fB()),
   fC())` where `fC`'s factory reads `input.a()` and `input.b()` at factory time; assert
   `store.a()`, `store.b()`, `store.c()` values.
2. **Inner sees earlier inner + earlier outer slot** — `makeStore(data, fA(),
   composeFeatures(fB(), fReadsAB()))`; the last inner factory reads both at factory time.
3. **Deferred read sees a later outer slot** — `composeFeatures(fLazy())` in slot 1 where
   `fLazy` returns `lazy: computed(() => input.z())`, then `fZ()` in slot 2; `store.lazy()`
   resolves (the prototype-chain choice under test).
4. **Nested composite** — `composeFeatures(fA(), composeFeatures(fB(), fC()))`; `store.c()`
   correct; a following slot sees all three.
5. **Members recompute** — `data.set([...])` → `store.a()` updates through the composite.

### Construction errors

Match messages with `toThrow(/…/)`. Prior art: `compose-table.spec.ts` lines 140–210.

6. Two inner features both declaring `a` → message contains
   `composeFeatures inner feature 1 (fA) and composeFeatures inner feature 2 (fA2) both provide the "a" store member`.
7. Two inner features both declaring `stages: { filter }` → `"filter" pipeline stage` with
   both inner labels.
8. Two inner features both declaring `renderStages: { group }` → `"group" render stage`.
9. Inner feature declaring `members: { rows: … }` → names `core` and
   `composeFeatures inner feature 1`.
10. **Cross-boundary**: `makeStore(data, fA(), composeFeatures(fA()))` → names
    `feature 1 (fA)` and `feature 2 (composeFeatures)` (outer registry is the authority).
11. An inner feature whose factory throws → the error propagates unwrapped.

### Merge

12. **Stages from two inner features both apply** — one contributes `filter`, another
    `sort`; `store.rows()` shows both transforms (fold order is `PIPELINE_ORDER`, so the
    filter runs first regardless of inner order — assert against a fixture where order is
    observable).
13. **Column rules from two inner features both apply** — build two `ColumnRuleEntry`s the
    way `columns.spec.ts` does; assert on `store.columns()`.
14. **Composite as a trailing derive block** — `createTableFeature(fAFactory,
    composeFeatures(withComputed(...), withComputed(...)))` composes without tripping the
    "declared pipeline behaviour" guard; both derived members present. Proves the
    "absent, not `{}`" rule from Step 2.

### Hooks (AC 7)

15. `setup` of every inner feature runs, after every outer feature is composed (spy records
    order; a `setup` reads a later outer slot's member successfully).
16. `onDestroy` of every inner feature runs when the injector is destroyed — use
    `config.injector` with a throwaway `Injector.create(...)` as `compose-table.spec.ts`
    line 256 does.
17. `onRowsRemoved` of every inner feature fires with the removed ids after
    `data.update(...)` + `TestBed.tick()` — `compose-table.spec.ts` line 391 pattern.

### `slots.spec.ts`

18. `describeInnerFeature(2)` → `composeFeatures inner feature 2`;
    `describeInnerFeature(1, 'withSorting')` → `composeFeatures inner feature 1 (withSorting)`.
    Sit next to the `describeInternalFeature` block.

## Implementation Notes

- Keep every fixture feature single-purpose and named for what it contributes
  (`fA`, `fReadsAB`, `fLazy`, `fFilterStage`); label assertions rely on `displayName`.
- Case 3 asserts the runtime-only guarantee. Do not "fix" the types to make `input.z`
  typecheck — annotate the fixture's `input` as `Shape & { z: Signal<number> }` the way
  `compose-table.spec.ts` line 240 does.
- Do not assert on the number of `claimMember` calls or on the inner `SlotRegistry`.

## Risks / Watchouts

- `TestBed.tick()` (not `flushEffects`) is what the existing removal specs use — match it.
- A `filter` stage fixture must not depend on `withFiltering` (unconverted).

## Non-Goals

- No type assertions (Step 4). No shipped-feature composition (#43).

## Acceptance Checks

- [ ] Cases 1–18 present and named as above.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` passes for the two files.
- [ ] Worth running by the user: `npx nx test shared-table -- compose-features slots`.

---
← [Step 2: compose-features.ts + index.ts — composeFeatures()](step-2-compose-features.plan.md) | [Step 4: create-table.spec.ts — types](step-4-create-table-spec-types.plan.md) →
