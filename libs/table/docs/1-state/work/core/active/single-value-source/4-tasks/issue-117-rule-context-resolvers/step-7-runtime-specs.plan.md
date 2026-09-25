# Step 7 — Runtime specs: grouping, sorting, column rules

**PR scope:** standalone. **Depends on:** Step 2, Step 3, Step 5, Step 6.
**Parallel-safe with:** Step 8.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-grouping/feature.spec.ts` (edit)
- `libs/table/src/engine/grouping/clusters.spec.ts` (edit)
- `libs/table/src/api/features/with-sorting/feature.spec.ts` (edit)
- `libs/table/src/engine/columns-schema/wire-columns-schema.spec.ts`
  (edit)

## Why This Step Exists

Covers the issue's own runtime acceptance criteria across all three
domains this issue touches. Kept as one step (not three) since all three
are additive runtime specs with no shared code between them and no
cross-file assertions — each spec still asserts only its own domain
([[spec-files-assert-own-domain-only]]); they're batched here purely as
one PR-scoped unit of test work, not because they share a fact.

## What To Do

**Grouping** (`with-grouping/feature.spec.ts` + `clusters.spec.ts`):

- A `when` reading `ctx.valueOf(path.margin, cluster.rows[0])` for a
  carrier column (a column whose accessor derives from other fields,
  with no matching row field) admits/rejects clusters correctly.
- `ClusterSummary` passed to `when` still has exactly
  `columnId`/`key`/`rows` — a spec asserting `Object.keys(summary)` (or
  equivalent structural check) has no fourth key.
- An existing-shape regression: a `when` reading only `cluster.key` or a
  plain row field, written as a 1-argument function (no `ctx` param),
  still gets admitted/rejected identically to before this issue.
- A `when` naming an undeclared column id via `ctx.valueOf` throws with
  `withGrouping` in the message (dev-gated — Step 6).

**Sorting** (`with-sorting/feature.spec.ts`):

- A `sortFn` comparator reading `ctx.valueOf(path.total, a)` /
  `ctx.valueOf(path.total, b)` for its own column, or a different
  column, sorts correctly.
- An existing-shape regression: a 2-argument `sortFn` comparator (no
  `ctx` param) still sorts identically to before this issue.
- A `sortFn` naming an undeclared column id via `ctx.valueOf` throws
  with `withSorting` in the message (Step 6).

**Column rules** (`wire-columns-schema.spec.ts`):

- A rule's `ctx.stateOf(path.other)` reads another column's `{ visible,
  label, meta }` without a `ctx.columns().find(...)` lookup — assert the
  rule body itself never calls `.find(` (or simply assert the resulting
  behavior matches an equivalent hand-written `.find()`-based rule,
  proving parity).
- `stateOf`'s returned object has no `order` key.
- A rule's `ctx.stateOf` naming an undeclared column id throws.
- Existing D8 test ("a rule reading `ctx.columns()` resolves against
  base state, never its own rule result") still passes unchanged —
  `columns` wasn't removed.

## Implementation Notes

- Follow each file's existing `describe`/mock-data conventions
  (`table.mock.ts`, existing fixtures) — don't introduce new inline data
  sets where an existing fixture already fits.
- Spy on `console.error` for the ADR-0014 degrade-and-report cases,
  matching this codebase's existing pattern (see
  `with-sorting/feature.spec.ts`'s existing ADR-0014 cases).
- The "undeclared id throws" cases are dev-gated
  (`assertDeclarationsAreKnown`) — Vitest runs with `ngDevMode` on
  already, matching every other feature spec's existing assumption (see
  #100's own Step 4 plan, "Risks / Watchouts").

## Risks / Watchouts

- Don't write a fourth spec file for a "shared" resolver behavior —
  `engine/resolvers.ts`'s own behavior (ADR-0014 wrap, per-call column
  lookup) is exercised indirectly through each domain's own spec above;
  it has no consumer-facing surface of its own to unit-test in isolation
  beyond what grouping/sorting already cover.

## Non-Goals

- No filtering spec here — filtering's rename (Step 4) is covered by its
  own existing specs passing unchanged, not new cases.
- No cross-domain spec — Step 8 owns the cross-domain types-spec.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] All four edited spec files pass.
- [ ] `rg -n "\.find\(\(c\) => c\.id ===" libs/table/src/columns-schema
      libs/table/src/engine/columns-schema` shows the existing spec-only
      lookups unaffected (this repo's own tests still use `.find()` to
      *assert* results — that's fine; only a *rule's own body* using
      `.find()` instead of `stateOf` is what the acceptance criterion is
      about).

---
← [Step 6: Construction check](step-6-construction-check.plan.md) | [Step 8: Cross-domain types-spec](step-8-types-spec.plan.md) →
