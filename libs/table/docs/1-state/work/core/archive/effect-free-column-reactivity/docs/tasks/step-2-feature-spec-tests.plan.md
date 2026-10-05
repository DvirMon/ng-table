# Step 2: `feature.spec.ts` — required-`onError` rewrite plus D2/D5/D8/D9 cases

**PR scope:** `api/features/with-columns-schema/feature.spec.ts` only.

**Task type:** test

**Depends on:** Step 1

## Files

- `libs/shared/design-system/src/ui/table/api/features/with-columns-schema/feature.spec.ts` (edit)

## Why This Step Exists

Step 1 makes `applyVisibleAsync`'s `onError` required and switches column state from
effect-driven writes to a derivation. The existing spec has one case that specifically tests the
now-impossible "no `onError`" configuration, and needs new cases proving the behavior changes
the spec (`3-spec.md`) calls out as deliberate: rule-vs-imperative precedence (D2), async
retention across a column-list replacement and a rule targeting an added/removed column (D9),
and rules never observing their own derived output (D8).

Per `3-spec.md`'s Testing Decisions: assert external behavior at the highest available seam
(public factory in, public `columns` signal out, drive the consumer's own signals). Don't reach
into rule wiring internals or assert a derivation is a particular primitive — this refactor
changes the implementation on purpose while preserving behavior; internal-shape assertions would
be false failures.

## What To Do

- **Rewrite** `'applyVisibleAsync without onError keeps the last-resolved visible on error'`
  (currently asserts the no-`onError` case holds its last value). Since `onError` is now
  required, rewrite this to assert the _with_-`onError` behavior stays correct on repeated
  errors (or delete if it's now fully redundant with the existing "applies onError on failure
  when provided" case — check for actual duplication before deciding).
- **Add — D2 (rule wins over imperative toggle):** build a store with a reactive `applyVisible`
  rule on a column, call `updateColumns(store, toggleColumnVisibility(id))` (or the store's
  public equivalent) to imperatively flip it, then assert the rule's value stands, not the
  imperative toggle.
- **Add — D2 (imperative survives on unruled state):** reorder columns and toggle visibility on a
  column with no rule, re-evaluate a rule on a _different_ column, assert the reorder and the
  unruled toggle both survived.
- **Add — D9 (column list replacement while rules are active):** with a rule targeting column A,
  replace the whole column list via `setColumns` to a list that drops A and adds a new column B;
  assert no error is thrown and A's rule is simply inert. Then add a rule targeting B _after_ B
  exists in the list; assert it applies on the next evaluation.
- **Add — D5 (retention across in-flight refetch):** using the existing controllable-resource
  test double, resolve once, trigger a second in-flight state (`status` back to `'loading'` or
  `'reloading'` without a resolved value yet), assert the column still shows the previously
  resolved `visible` — not a reset to declared default — until the second resolution lands.
- **Add — D8 (no cycle):** a rule whose `when`/`params` reads `ctx.columns()` and returns a value
  derived from the _current_ base state (e.g. checking another column's declared `visible`);
  assert it never observes its own rule's result even after several re-evaluations, and the test
  doesn't hang/loop (a cycle would manifest as `TestBed.tick()` looping or a stack overflow, not
  a silent wrong value — the test should fail loudly if this regresses, not report a quiet wrong
  number).

## Implementation Notes

- Reuse the existing `makeStore`, `makeColumns`, `makeControllableResource` helpers — don't
  duplicate them.
- `update-columns.spec.ts` is untouched and must keep passing unmodified — that's the regression
  evidence that imperative writes survived the refactor (per `3-spec.md`). Don't add anything
  there.

## Risks / Watchouts

- Don't assert on `baseColumns` directly or reach into the rule registry — every assertion goes
  through `store.columns()`, matching the existing style in this file.
- The D9 "column list replacement" case needs a `columnsSchema` or public `setColumns`-equivalent
  call site that actually exists on the public API — confirm what's available (`updateColumns` +
  `setColumns` updater from `api/update-columns.ts`) before writing the case; don't invent a new
  public method.

## Non-Goals

- Production code changes — this step is test-only. If a Step 1 assumption turns out wrong while
  writing these tests, flag it and fix Step 1's file, not this one's scope.

## Acceptance Checks

- `feature.spec.ts` gains D2 (two cases), D5, D8, D9 cases per above.
- The no-`onError` case is rewritten or removed to match the new required signature — no dangling
  reference to an optional `onError`.
- `update-columns.spec.ts` passes unmodified (verify, don't just assume).
- Full lib test suite green.

---

← [Step 1: Wire column state as derivation — the atomic production swap](step-1-derive-column-state.plan.md) | [Step 3: `CLAUDE.md` + ADR-0003 corrections](step-3-docs-corrections.plan.md) →
