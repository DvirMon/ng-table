# Step 6 — Migrate `create-filters.spec.ts` off `createFilterEvaluator(filters)`

**PR scope:** PR 1 of 3 (`#71`). **Blocks Step 7.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/shared/table/src/api/create-filters.spec.ts` | `:4` import | edit — drop `createFilterEvaluator` |
| `libs/shared/table/src/api/create-filters.spec.ts` | `:358`, `:372`, `:386`, `:397`, `:408`, `:429`, `:474` | edit — 7 evaluator construction sites |

## Why This Step Exists

`#71` deletes `createFilterEvaluator(filters)` — the overload that reads the compiled state back
out of a built `Filters` object through the internal symbol. Seven sites in
`create-filters.spec.ts` construct an evaluator that way today, so the deletion in Step 7 breaks
the spec file unless this lands first.

It is sequenced **before** the deletion, not after, because `matcher()` already exists
(shipped in `#68`). The migration is green on its own; reversing the two would leave a revision
of the branch that does not compile.

The tests themselves are not the target — they assert the filter model's own evaluation semantics
(OR within `anyOf`, AND across the root, the null-cell policy, per-filter error dedup) and all of
that stays exactly where it is. Only the entry point changes.

## What To Do

Replace each `createFilterEvaluator(filters)` + `evaluator.matchesRow(row)` pair with the public
entry point the filter model now exposes:

```ts
// before
const evaluator = createFilterEvaluator(filters);
expect(evaluator.matchesRow(invoice({ … }))).toBe(true);

// after
const matches = filters().matcher();
expect(matches(invoice({ … }))).toBe(true);
```

Then drop `createFilterEvaluator` from the import at `:4`, leaving `createFilters`.

## Implementation Notes

- **Hoist the `matcher()` call, do not inline it.** `matcher()` returns
  `createFilterEvaluatorFrom(internal).matchesRow` (`api/filters/state.ts:194`) — a **new**
  evaluator instance per call. The two error-dedup tests (`:429`, `:474`) depend on one instance
  across several row evaluations: `:429` asserts three `matchesRow` calls report once, `:474`
  asserts the filter stays dropped for the rest of the pass. Calling `filters().matcher()` once
  and reusing the returned function preserves that; calling it per assertion resets the dedup sets
  and both tests pass for the wrong reason or fail outright.
- Each `matcher()` call must come **after** the `value.set(…)` lines in its test, matching where
  `createFilterEvaluator(filters)` sits today. The evaluator memoizes its narrowing records on
  first use, so construction order is load-bearing.
- `matcher()` reads criteria through signals. Keep the calls on the existing
  `TestBed.runInInjectionContext` path the `build<TState>()` helper (`:62`) already establishes.

## Risks / Watchouts

- A blind find-and-replace that inlines `filters().matcher()(row)` at every call site silently
  breaks the dedup tests. Those two are the reason this step is not mechanical.
- Do not rename `evaluator` to `matcher` — `matcher` is already the name of a domain concept in
  this file (the `isEqual`/`isContaining` family). Use `matches`.

## Non-Goals

- Deleting `createFilterEvaluator` itself, or anything in `evaluator.ts` — Step 7 owns that.
- Touching `api/filters/matchers.spec.ts` or `api/filters/state.spec.ts` — unaffected.
- Adding coverage for `matcher()` as a contract; `create-filters.spec.ts` already owns it.

## Acceptance Checks

- [ ] `create-filters.spec.ts` imports only `createFilters` from `./create-filters`
- [ ] No `createFilterEvaluator` reference remains in the file
- [ ] Both error-dedup tests hoist one `matcher()` result and reuse it
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` is clean
- [ ] `npx nx test shared-table` passes for `create-filters.spec.ts`
- [ ] No source file changes in this step

---
← [Step 5: Update the prose that describes the old config shape](step-5-update-prose.plan.md) | [Step 7: Delete the coupled filtering surface](step-7-delete-coupled-surface.plan.md) →
