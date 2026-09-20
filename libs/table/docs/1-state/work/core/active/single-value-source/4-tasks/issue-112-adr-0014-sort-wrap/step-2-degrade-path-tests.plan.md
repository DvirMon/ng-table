# Step 2 — Cover the two degrade paths

**PR scope:** depends on Step 1. Parallel-safe with Step 3 — both
depend only on Step 1, not on each other.

**Depends on:** Step 1

**Parallel-safe with:** Step 3

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-sorting.spec.ts` (edit)

## Why This Step Exists

Step 1 changes `sortRows`'s runtime-error behavior; #112's acceptance
criteria name two behaviors that must be locked in by a test, not left
to manual verification: an accessor throw degrading to "row treated as
empty", and a `sortFn` throw degrading to "affected pair unordered",
both reporting once per column per evaluation.

## What To Do

Add a new `describe('runtime error handling (ADR-0014)', ...)` block
in `with-sorting.spec.ts`, alongside the existing `describe('null
ordering', ...)` block. Follow the `vi.spyOn(console, 'error')` /
`try`/`finally` `mockRestore()` pattern from `engine/cells.spec.ts`
(`readAccessor` describe block) — this repo's existing convention for
asserting the dedupe contract.

Cases to cover:

1. **A throwing accessor sorts that row as empty, without throwing.**
   Use `makeColumns()` with one column's `accessor` replaced by a
   function that throws for one specific row (e.g. by `row.id`) and
   returns a normal value for the others. Sort ascending; assert the
   throwing row lands where an empty value would under the default
   `nulls: 'last'` (matches the existing "keeps empties on the same
   end" test's shape), and `expect(() => store.toggleSort(...)).not.toThrow()`.

2. **The accessor error reports once per column across many rows.**
   A column whose `accessor` always throws, evaluated over 3+ rows —
   assert `errorSpy` was called exactly once (mirrors
   `cells.spec.ts`'s "reports once per column across many rows sharing
   one reportedColumns set").

3. **A throwing `sortFn` does not propagate; the affected pair's
   order falls back to input order.** A column with `sortFn: () => {
   throw new Error('boom'); }` — assert `toggleSort` does not throw
   and `store.rows()` comes back in the original input order for that
   column (the guard returns `0` for every comparison, so the stable
   sort preserves it).

4. **The `sortFn` error reports once per column even across many
   comparisons.** 3+ rows sorted by an always-throwing `sortFn` —
   `Array.prototype.sort` calls the comparator multiple times for 3+
   elements, so this asserts the dedupe, not just a single call.
   Assert `errorSpy` was called exactly once.

5. **Accessor errors and comparator errors report independently.** A
   column whose `accessor` throws for a `sortFn`-bearing column would
   never reach the comparator (short-circuited by `isEmpty`), so this
   case instead uses two *different* columns in one multi-sort
   (`multi: true`) — one with a throwing `accessor`, one with a
   throwing `sortFn` — and asserts `errorSpy` was called exactly
   twice, once per column, distinguishing the two messages if useful.

Use `errorSpy.mock.calls` or a message-substring assertion only if it
adds real signal; call-count assertions (per the existing `cells.spec.ts`
style) are enough for most of these.

## Implementation Notes

- Reuse `makeColumns()` / `makeRows()` already in the file; add
  per-case column overrides via the existing `overrides` parameter
  rather than a new fixture builder.
- Wrap every case that spies on `console.error` in `try { ... } finally
  { errorSpy.mockRestore(); }`, matching the existing style in this
  file's other tests and in `cells.spec.ts`.

## Risks / Watchouts

- Don't assert on the exact `console.error` message text unless a
  case specifically needs to distinguish the accessor error from the
  comparator error (case 5) — coupling every test to exact wording
  makes the message impossible to reword later.

## Non-Goals

- No test for the built-in comparator throwing from mismatched sample
  types (Date vs. string) — covered implicitly by the `guardCompare`
  wrap; not called out as its own scenario in #112's acceptance
  criteria.
- No changes to `with-sorting.ts` itself — implementation is Step 1.

## Acceptance Checks

- [ ] All new spec cases pass.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 1: Guard sortRows per ADR-0014](step-1-guard-sort-rows.plan.md) | [Step 3: Name the fallback, close SO24](step-3-docs-and-decisions-log.plan.md) →
