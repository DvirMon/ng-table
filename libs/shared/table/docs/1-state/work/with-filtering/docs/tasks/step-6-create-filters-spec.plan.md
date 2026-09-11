---
title: "Step 6 — createFilters() spec"
type: task-step
issue: 61
---

# Step 6 — `createFilters()` spec

**PR scope:** Depends on Steps 4 and 5 — this is the end-to-end spec exercising the public
factory with real rules.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/create-filters.spec.ts` (new)

## Why This Step Exists

Most of the interesting semantics in this issue (duplicate-path throws, key derivation,
`dirty`/`active` reconciliation) are only observable through the public `createFilters()` factory
— `rules.ts` in isolation has nothing to assert against. This is the bulk of this issue's test
coverage, run via `TestBed` (or `runInInjectionContext` directly) since `createFilters()` requires
an injection context.

## What To Do

Cover, per `filters.md`:

1. **Schema declaration** — construct with a mix of rules from the running `Invoice` example
   (`equals`, `contains`, `inRange`, `inDateRange`, `hasAny`/`hasNone`, `filter`, `anyOf`,
   `applyWhen`); assert each produces a correctly-keyed node reachable as `filters.<key>`.
2. **Keys** — borrowed key from a single path; `as` override (string literal); `anyOf`'s
   positional key never borrows from a path.
3. **One filter per path** — two rules on the same path throw at construction, even with
   different `as` values; a compound `filter()` predicate over the same path does not.
4. **Duplicate keys** — two `as` values colliding, or an `as` colliding with a borrowed key, throw
   at construction.
5. **`anyOf` without a key** — throws (or fails to compile, if enforced at the type level —
   document which and test accordingly).
6. **State semantics** — `value()` (complete shape), `active()` (empties omitted per each rule's
   `isEmpty`), `reset()`'s three behaviors (no-arg → source or empty, `null` → empty, value →
   that value), `dirty()` (false when untouched or matching source, true once written or cleared
   away from source).
7. **Sources** — reproduce the table from `filters.md`'s Sources section: untouched+no source →
   not dirty, not in `active()`; untouched+source present → not dirty, **is** in `active()`; user
   write → dirty, in `active()`; user writes the source's own value → not dirty (harmless), still
   in `active()`; `reset(null)` → dirty, not in `active()`. A later source change must not stomp a
   dirty filter's value.
8. **Combination semantics** — `anyOf`'s sub-predicates OR within the group; separate filters AND
   across the root (test via the safe-evaluate guard from Step 4, calling it directly with a
   fabricated row, not through a table).
9. **Null/undefined cells** — a filter over a nullable column follows the R27 policy end-to-end
   (positive matchers fail, `hasNoneOf` passes), and a custom `filter()` predicate can override
   this by receiving the cell unguarded.
10. **Errors (ADR-0014)** — a predicate that throws deactivates only that filter for one
    evaluation call; other filters are unaffected; the failure is reported once per filter per
    evaluation (assert the report call count, not just the return value); the filter still
    appears in `active()` despite failing.
11. **`applyWhen`** — the gated rule is excluded from evaluation/`active()` while its condition is
    false, included once true; changing the condition doesn't require re-declaring the schema.

## Implementation Notes

- Construct filters inside `TestBed.runInInjectionContext(() => createFilters(...))` (or this
  package's existing DI-context test helper, if one already exists — check `create-table.spec.ts`
  for the established pattern first).
- For the "reported once per filter per evaluation" checks, spy on whatever reporting mechanism
  Step 4 landed on (`console.error` or otherwise) rather than asserting on a specific message
  string that's likely to drift.

## Risks / Watchouts

- Don't test the per-row filtering *loop* here — that's issue #62's `withFiltering()` spec. This
  file tests `createFilters()`'s own state/validation/evaluator-building contract only, calling
  the Step 4 evaluator directly with hand-built rows where a "does it filter" assertion is needed.

## Non-Goals

- No `createTable()`/`withFiltering()` integration — standalone `createFilters()` only, per
  `filters.md`'s "usable with no table at all" framing.

## Acceptance Checks

- [ ] All eleven areas above have at least one passing test
- [ ] `nx test shared-table` passes

---
← [Step 5: Rules + public exports](step-5-filters-rules-and-exports.plan.md)
