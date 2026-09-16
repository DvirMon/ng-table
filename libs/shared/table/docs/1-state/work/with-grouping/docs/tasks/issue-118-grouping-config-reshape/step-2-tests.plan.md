---
title: "Step 2 — tests for the combined config shape"
type: task-step
issue: 118
---

# Step 2 — tests for the combined config shape

**PR scope:** New coverage for what the reshape makes possible, plus the type-level assertions that
keep the deleted overload deleted.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 1 — the config type and the schema-fn call shape must already exist.

**Parallel-safe with:** Step 3.

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

Step 1's sweep proves the rename compiles and changes nothing. It does not prove the one thing the
slice was cut for: seed levels and declarative rules arriving in the **same** call and both taking
effect. That combination had no call shape before, so it has no test.

Testing Decisions (`../../../3-spec.md` § Testing Decisions): external behaviour only, through the
public store — compose through the table factory and assert on `table.grouping` / `table.renderRows`.
No test reaches into the fold's internals or counts recomputations.

## What To Do

Add to the existing `describe` covering the rule layers (around the current schema-fn / rules-array
/ lambda equivalence test at ~line 1170).

### 1. `initial` and `schema` in one call

The headline case, impossible before this slice:

```ts
const store = inContext(() =>
  createTable(
    signal<GroupingMockRow[]>(mockGroupingRows),
    { trackBy: mockGroupingTrackBy, columns: makeColumns() },
    withGrouping({
      initial: ['region'],
      schema: (path) => {
        applyGrouping(path.category, { when: () => categoryActive() });
      },
    }),
  ),
);
```

Assert both halves are live, not just the one that happens to win:

- With `categoryActive()` false, the schema fold resolves to `[]` and `grouping()` is `[]` — the
  rule layer overrides the seed, per D6/D7's base/overlay contract. `initial` is a seed, not a
  floor.
- With `categoryActive()` true, `grouping()` is `['category']`.
- A second table built with `schema` only (no `initial`) and the rule pending (`when` returns
  `undefined`) abstains to its own seed — `[]` — while the same table built with
  `initial: ['region']` abstains to `['region']`. This is the assertion that proves `initial` is
  actually reaching `baseGrouping` through the new key name rather than being silently dropped.

### 2. `schema` and `rules` both reach the fold, in that order

One config passing both; assert `grouping()` carries the schema-recorded level before the
hand-written one, matching "call order is level order" (D8).

### 3. The deleted overload is a compile error

```ts
// @ts-expect-error — the either/or first positional is gone (#118); a schema fn belongs in
// `config.schema`.
withGrouping((path) => {
  applyGrouping(path.region, { when: () => true });
});
```

Put this in the existing type-level `describe` alongside the other `expectTypeOf` cases, not in a
runtime test — it must never actually be called.

### 4. Construction-time validation still fires through the new key

- An unknown id in `initial` throws at construction, with a message naming `initial` (D14).
- An unknown id recorded by `schema` throws through the same `rules name unknown column id(s)`
  guard as a hand-written `rules` entry — the schema path must not bypass it.

### 5. Slot 2 is unaffected

The existing `withComputed()` composition tests already cover this; confirm they still assert
against the new first-argument shape rather than being deleted with it. Add nothing new unless one
of them was passing a schema fn positionally.

## Implementation Notes

- **`applyGrouping` is already imported in this spec** for the schema-fn tests Step 1 migrated —
  reuse that import rather than adding a second one.
- **Do not assert on `renderRows()` for the level-order case.** `grouping()` is the observable that
  states level order; render rows restate it more expensively and couple the test to clustering.
- **A pending rule abstains for the whole set**, not per level (`foldGroupingRules`). Test 1's
  abstain case has exactly one rule, so this does not bite — but do not extend it to two rules and
  expect a partial fold.

## Risks / Watchouts

- **The `@ts-expect-error` in test 3 must fail the build if the overload comes back.** If the
  assertion stops erroring, `@ts-expect-error` itself becomes the error — that is the intended
  tripwire, do not soften it to `@ts-ignore`.
- **Do not add a test asserting `schema` rules are recorded eagerly at factory time.** That is an
  internal-timing fact, not external behaviour, and the Testing Decisions rule it out explicitly.

## Non-Goals

- No new coverage for `groupWhen` — #119 and #120 own their own tests.
- No engine-level (`engine/grouping.spec.ts`) changes; nothing in the engine moved.

## Acceptance Checks

- [ ] A single `withGrouping({ initial, schema })` call seeds levels and records rules, and both
      are observable through `table.grouping`.
- [ ] `schema`-recorded levels precede `rules`-array levels in the folded order.
- [ ] Passing a schema fn as the first positional is a compile error, asserted with
      `@ts-expect-error`.
- [ ] An unknown column id throws at construction from both `initial` and `schema`.
- [ ] `nx test shared-table` passes.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.

---
← [Step 1: Reshape the config and sweep call sites](step-1-reshape-config-and-sweep.plan.md) | [Step 3: Documentation](step-3-docs.plan.md) →
