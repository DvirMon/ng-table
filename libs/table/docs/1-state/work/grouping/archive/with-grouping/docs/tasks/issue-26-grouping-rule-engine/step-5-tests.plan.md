---
title: 'Step 5 — tests through the public createTable() surface'
type: task-step
issue: 60
---

# Step 5 — tests through the public `createTable()` surface

**PR scope:** Test coverage for everything Steps 1–4 shipped. No production code changes except
fixes surfaced by a failing test.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 4

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/grouping-rules.spec.ts` (extend — created empty-ish in Step 2,
  fill out fully here if not already complete)
- `libs/shared/table/src/schema/grouping-rules.spec.ts` (extend, same note)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit — new `describe('groupingRule
declarative sugar (#26)', ...)` block)

## Why This Step Exists

The parent spec's Testing Decisions section is explicit: "Only external behavior, through the
public store... No test reaches into the fold's internals." Steps 2/3's pure-function specs cover
the internal fold/recorder mechanics directly (they're pure engine/schema code, per this table's
own rule that pure logic needing `TestBed` is a sign it's in the wrong file); this step is the
public-surface coverage the spec requires before the feature can be called done.

Spec: `../../../3-spec.md`, Testing Decisions section — every bullet there not already covered by
issues #7/#58/#59/#65's existing suites is this step's scope.

## What To Do

Add to `with-grouping.spec.ts`, composing `withGrouping()` via the real `createTable()` factory in
every case (never constructing a feature spec by hand):

1. A `groupingRule` returning a value overrides `baseGrouping`; returning `undefined` falls back to
   it; returning `[]` groups by nothing, distinct from abstain.
2. The schema-fn, rules-array, and lambda config layers each produce the same resulting fold for an
   equivalent rule, and call order in the schema fn determines level order.
3. A pending rule (`when` returns `undefined`) makes the whole rule set abstain; a resolved rule
   contributes its boolean; an errored rule's `onError` result is never treated as abstention.
4. `applyGroupingAsync` without `onError` is a compile error (`// @ts-expect-error` case — this one
   may already be covered in `grouping-rules.spec.ts` from Step 3; don't duplicate, cross-reference
   instead).
5. A `when` predicate that throws makes that level not apply and reports once per evaluation, not
   once per row (per ADR-0014's reporting-once contract — check how `groupOrder`'s existing throw
   test in this same file reports, and match that reporting mechanism/assertion style).
6. An updater write is correctly shadowed while an active rule is returning a value (not
   abstaining) — assert this as documented behavior (D7's accepted consequence), not a bug.
7. An unknown column id in `rules`/the schema fn throws at construction (mirrors the existing
   `initialGrouping` unknown-id test already in this file).

## Implementation Notes

- **Reuse the existing async-resource test-double pattern already in this codebase** for the
  `applyGroupingAsync` cases — search `applyVisibleAsync`'s spec (`column-rules`-adjacent tests, if
  any) or `wire-columns-schema.spec.ts` for how a fake `Resource`/signal-backed status is stubbed,
  rather than inventing a new harness.
- **The "reports once per evaluation" assertion** should follow whatever mechanism `groupOrder`'s
  existing throwing test in `with-grouping.spec.ts` (line ~368: "a throwing groupOrder falls back
  to stable order...") uses to assert reporting — likely a spy on `console.error` or an injected
  reporter; match it exactly rather than introducing a second reporting-assertion style in the same
  file.
- Group new tests under one `describe('groupingRule declarative sugar (#26)', () => { ... })`
  block, matching this file's existing per-issue `describe` convention (`describe('collapse/expand
(#25)', ...)`).

## Risks / Watchouts

- **Don't assert on which signal primitive backs `grouping`/`groupingRule`** (no reading
  `computed`/`linkedSignal` internals) — the spec's Testing Decisions section forbids this
  explicitly; assert on `table.grouping()`/`table.renderRows()` only.
- **Don't skip the "no groupingRule/rules configured" regression case** — confirm byte-identical
  `renderRows()` output to pre-Step-4 behavior for a table with only `initialGrouping`/updater
  writes and no rule config at all.

## Non-Goals

- No new coverage for `groupOrder`, collapse/expand, or `rowsOf`'s existing behavior — those are
  #24/#59/#65's tests, already shipped and passing; this step only adds #26's slice.
- No E2E/story-level tests — this is store-layer only, per the parent spec's scope.

## Acceptance Checks

- [ ] `nx test shared-table` passes.
- [ ] Every bullet in "What To Do" above has at least one corresponding `it(...)` block.
- [ ] No test reaches into fold internals (spot-check: no import of `foldGroupingRules`/
      `buildGroupingRuleEntries` inside `with-grouping.spec.ts` — those stay in Step 2's own spec
      file).

---

← [Step 4: Wire withGrouping() feature](step-4-wire-with-grouping-feature.plan.md) | [Step 6: Docs →](step-6-docs.plan.md)
