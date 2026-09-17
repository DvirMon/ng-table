# Step 4 — Member audit: `matcher()`/`dirty()` go internal, `predicates` is deleted

**PR scope:** PR 1 of 1 (`#90`). **Depends on: Step 3.** **Blocks Step 5.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `classify-errors-construction-vs-runtime`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/table/src/api/features/with-filtering.ts` | — | edit — `predicates` and `applyPredicateTerms` deleted |
| `libs/table/src/filters/types.ts` | `:30-47` | edit — `FilterNode.dirty` marked internal |
| `libs/table/src/filters/types.ts` | `:49-79` | edit — `FiltersRoot.matcher`/`dirty` marked internal |

## Why This Step Exists

`matcher()` was promoted to the public surface for one reason: `withFiltering` was decoupled from
the filter model, so the consumer needed a way to hand the table a predicate. The whole bridge was
`predicates: () => [filters().matcher()]`. With the feature owning the model, the bridge has no
ends left to connect — the table calls the matcher itself.

`predicates` goes with it, and no `where()` replaces it (R54). A predicate with no criterion is a
**scope**, not a filter, and a scope is expressed by narrowing the rows signal handed to
`createTable`. Because `filter` precedes `group`/`sort`/`expand` in `PIPELINE_ORDER`, the pipeline
output is identical either way — this is a surface deletion, not a capability loss. Say that in the
PR description; a reviewer will otherwise read it as one.

The public surface lands at **eight members** (spec §Members): root `value`/`criteria()`/
`isActive()`/`reset()`, and per key `value`/`criterion()`/`isActive()`/`reset()`.

## What To Do

1. Delete `predicates` from `WithFilteringConfig`, leaving `{ manual?: boolean }`. Delete
   `applyPredicateTerms` and `reportPredicateError` from `with-filtering.ts`.
2. The `filter` stage becomes: when `manual`, pass rows through; otherwise request one matcher from
   the owned model and filter with it. **One matcher per stage evaluation, not per row** — the
   matcher carries its own error-dedup scope and memoized narrowing set, and requesting it inside
   the row loop would reset both on every row.
3. Mark `FiltersRoot.matcher()` and `FiltersRoot.dirty()` `@internal`, and `FilterNode.dirty()`
   likewise. They stay on the interface — `state.ts` builds them and the feature calls `matcher()`
   — they stop being part of the documented consumer contract, and Step 5 stops exporting the paths
   that would let a consumer reach them.
4. Check whether anything in `state.ts` still needs `dirty` composed at the root. If the root's
   `dirty` exists only for the old public surface, it may still be cheap to keep; do not delete
   reactive plumbing this step, only its public standing.

## Implementation Notes

- ADR-0014's per-filter / per-evaluation degradation is **unchanged**. `createFilterEvaluatorFrom`
  keeps its `reportedKeys`/`droppedKeys` sets and its once-per-filter reporting. The deleted
  `applyPredicateTerms` had a *parallel* degradation story for raw predicates; deleting it removes
  a second mechanism, not the surviving one. Verify the surviving path still reports on a throwing
  predicate.
- The `matcher()` comment in `state.ts` explains why it is deliberately **not** a `computed()` —
  memoizing it would share one error-dedup scope across every caller. That reasoning holds exactly
  as much now that the caller is the feature. Do not "optimize" it into a `computed` while it has
  a single caller.

## Risks / Watchouts

- **The manual check must come before the matcher request**, or a manual table builds an evaluator
  it never uses on every pipeline pass.
- Removing the public `matcher()` is what makes a consumer's own `filters().matcher()` call a
  compile error. Any story host still doing that breaks — expected, `#91` migrates them.

## Non-Goals

- A raw-predicate escape hatch under any name. Out of scope by decision (R54), not by omission.
- Barrel edits — Step 5.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating in `src/filters/*.ts` or
      `src/api/features/with-filtering.ts`. Run twice.
- [ ] No `predicates` in `WithFilteringConfig`; no `applyPredicateTerms` under `src/`.
- [ ] The public surface is eight members — root and per-key `value`/`criteria`-or-`criterion`/
      `isActive`/`reset`, and nothing else documented as consumer-facing.
- [ ] A filter whose predicate throws stops narrowing for that evaluation, reports once, and leaves
      sibling filters narrowing (ADR-0014 unchanged).
- [ ] `manual: true` returns rows untouched and constructs no evaluator.

---
← [Step 3: `withFiltering` owns the model](step-3-with-filtering-owns-model.plan.md) | [Step 5: Barrels](step-5-barrels.plan.md) →
