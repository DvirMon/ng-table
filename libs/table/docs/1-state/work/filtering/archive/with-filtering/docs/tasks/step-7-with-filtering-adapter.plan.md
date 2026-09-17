---
title: "Step 7 — withFiltering() client adapter, retire imperative surface"
type: task-step
issue: 62
---

# Step 7 — `withFiltering()` client adapter, retire imperative surface

**PR scope:** Depends on Step 6 (and, transitively, all of issue #27 — `createFilters()` and
`createFilterEvaluator()` must exist). Breaking public-API change, same PR: the old imperative
surface is deleted in the same step that ships the replacement, so filtering never regresses to
"exists but does nothing" (R26).

**Task type:** code

**Skills used:** typescript-conventions, extract-encapsulated-logic

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/types.ts` (edit)
- `libs/shared/table/src/api/features/with-filtering.ts` (full rewrite)

## Why This Step Exists

`createFilterEvaluator()` (`api/filters/evaluator.ts`, shipped in issue #27) was built
specifically for this consumer — its own JSDoc names `withFiltering()` (issue #28) as the only
caller. This step is the adapter that wires a per-pipeline-run evaluator into the `filter` stage
and deletes the superseded imperative implementation it replaces.

This is one step, not two, even though it touches two files: removing the old type surface from
`types.ts` without also rewriting `with-filtering.ts` leaves the package non-compiling (the old
file references `FilterRule`/`filterFn`/`enableFiltering` directly), so there is no intermediate
state worth shipping alone.

## What To Do

**`api/types.ts`:**
- Delete the `FilterRule` interface.
- Delete `ColumnDef.filterFn` and `ColumnDef.enableFiltering`.

**`api/features/with-filtering.ts` — replace entirely:**

> **Superseded 2026-09-14.** `WithFilteringConfig` now carries a second parameter,
> `TState extends Record<string, unknown> = Record<string, unknown>`, and holds
> `filters: Filters<TRow, TState>`. The shape below pinned `TState` to its default, which made a
> concretely-keyed filter set unassignable (`FilterNode<T>` holds an invariant
> `WritableSignal<T>`) and forced consumers back to `unknown` criteria. See
> `docs/1-state/features/filtering.md` §Config for the current contract. The signature below is
> also pre-#35 in its feature shape (`(core: …)`), superseded separately.

```ts
export interface WithFilteringConfig<TRow> {
  filters: Filters<TRow>;
  manual?: boolean;
}

export function withFiltering<TRow = unknown>(
  config: WithFilteringConfig<TRow>
): (core: ...) => TableFeatureSpec<TRow> {
  const manual = config.manual ?? false;

  return (): TableFeatureSpec<TRow> => ({
    stages: {
      filter: (rows) => {
        if (manual) {
          return rows;
        }
        const evaluator = createFilterEvaluator(config.filters);
        return rows.filter((row) => evaluator.matchesRow(row));
      },
    },
  });
}
```

- Import `createFilterEvaluator` from `../create-filters` (already exported there specifically
  for this file — see its JSDoc in `api/filters/evaluator.ts`).
- **No `members`** — omit the field entirely (`TableFeatureSpec.members` is optional). There is
  no `table.filters`, no table-side mirror; the consumer already holds the `Filters<TRow>`
  object (per `filtering.md`'s "Members Owned: None").
- **One evaluator per pipeline run.** Build it fresh inside the `filter` stage closure, not once
  at feature-construction time — `createFilterEvaluator`'s "reported once per filter per
  evaluation" contract (ADR-0014) is scoped to one evaluator instance's lifetime, and a
  pipeline run is the right grain for "one evaluation."
- Delete every helper this replaces: `upsertFilterRule`, `defaultFilterMatch`,
  `matchesColumnFilter`, `matchesGlobalFilter`, `filterRows`, and the `FilteringState`/
  `FilteringMembers` interfaces.
- Delete the `manual`-config type's old shape (`WithFilteringConfig` had no `filters` field
  before) — the new one is a breaking replacement, not an extension.
- Confirm `TRow` still infers from the enclosing `createTable()` config with no per-call
  generic (matches `5a3a09d`'s existing convention for this file).

**Not touched:** `index.ts` needs no edit — it re-exports this file and `types.ts` via
`export *`, so deleting the old surface at the source removes it from the public API for free.

## Implementation Notes

- `manual: true` skips the client-side filter stage entirely; it does not touch
  `config.filters` in any way — `value()`/`active()`/`dirty()` keep updating because those live
  entirely inside the `Filters<TRow>` object, untouched by this feature either way.
- Empty criteria are already excluded before `matchesRow` sees them — `createFilterEvaluator`
  skips any record whose `node.active()` is `undefined`. Nothing in this file re-implements that
  check.

## Risks / Watchouts

- Don't reach for `core.columns()` for anything — the new feature has zero compile-time
  dependency on the columns config (per `filtering.md`'s "Compile-Time Dependencies: None").
  The old file read `filterFn`/`enableFiltering` off columns; that whole path is gone.
- Don't add a fallback/report inside this file for a throwing predicate — that policy is fully
  owned by `createFilterEvaluator` already (ADR-0014). Adding a second layer here would double
  -report or diverge from the ADR's "once per filter per evaluation" contract.

## Non-Goals

- No `table.filters` member, no event/observable surface (the old `filterChanged` is gone for
  good — a consumer reads `filters().value` directly, since it's already a signal).
- No changes to `PIPELINE_ORDER` or `engine/pipeline.ts` — this feature claims the existing
  `filter` slot, it doesn't add one.

## Acceptance Checks

- [ ] `withFiltering({ filters })` composes into `createTable()`'s `features` array, `TRow`
      inferred from the enclosing config
- [ ] `FilterRule`, `ColumnDef.filterFn`, `ColumnDef.enableFiltering` no longer exist in
      `api/types.ts`
- [ ] Old imperative members (`setColumnFilter`, `clearColumnFilter`, `setGlobalFilter`,
      `clearFilters`, `columnFilters`, `globalFilter`, `filterChanged`) no longer exist anywhere
      in `with-filtering.ts`
- [ ] Package compiles (`tsc`) with no reference to the deleted type surface remaining

---
← [Step 6: createFilters() spec](step-6-create-filters-spec.plan.md) | [Step 8: withFiltering() spec](step-8-with-filtering-spec.plan.md) →
