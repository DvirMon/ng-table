---
title: "Step 3 — groupOrder on WithGroupingConfig"
type: task-step
issue: 58
---

# Step 3 — `groupOrder` on `WithGroupingConfig`

**PR scope:** Depends on Step 2's engine wiring.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions

**Scaffolding agent:** angular-implementer

**Depends on:** Step 2
**Parallel-safe with:** none

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)

## Why This Step Exists

`withGrouping()` currently only exposes `initialGrouping` (issue #6). This step is the public
entry point for D4 — the config surface a consumer actually sets `groupOrder` through — and closes
the loop by passing it into the two engine calls Step 2 just added a param for.

Spec: `../../3-spec.md`, "Public surface" — `WithGroupingConfig<TRow>`'s `groupOrder` field.

## What To Do

In `api/features/with-grouping.ts`:

```ts
import type { ColumnId, GroupingUpdater, GroupSummary } from '../types';

export interface WithGroupingConfig<TRow> {
  /** Seeds `grouping` at construction. An id naming no known column throws — a wiring error,
   * parallel to `engine/rows.ts`'s `trackBy` throw site (D14). */
  initialGrouping?: ColumnId<TRow>[];
  /** Orders clusters by their contents at every depth, siblings only (D4/D9). Omitted: today's
   * stable first-occurrence order, unchanged. Throws: falls back to stable order for the
   * affected level and reports once per evaluation via `console.error` (D15, ADR-0014). Fully
   * decoupled from `sorting` — sorting the currently-grouped column is a no-op on cluster order
   * by construction (D5). */
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
}
```

Update both stage calls to pass it through:

```ts
stages: {
  group: (rows) => clusterRows(rows, baseGrouping(), core.columns(), config.groupOrder),
},
renderStages: {
  group: (rows) => buildGroupRenderRows(rows, baseGrouping(), core.columns(), config.groupOrder),
},
```

## Implementation Notes

- `config.groupOrder` is read directly from the closed-over `config`, the same way
  `initialGrouping` already is — no signal wrapping needed. `groupOrder` is static per feature
  instance, like `ColumnDef.sortFn`/`aggregateFn`; it is not meant to change after
  `createTable()` runs, and D4 gives it no update path.
- Update the function doc comment's summary line to mention `groupOrder`, matching the existing
  style that lists what the feature claims/reads (currently ends "...`table.grouping` reads
  `baseGrouping` directly — the D6 base+overlay fold (`groupingRule`) is issue #60, out of scope
  here").

## Risks / Watchouts

- Don't add `groupOrder` reactivity (e.g. wrapping it in a `signal`/`computed`) — that's scope
  creep beyond D4, which specs it as static config, and no acceptance criterion or Testing
  Decision asks for a dynamic `groupOrder`.

## Non-Goals

- No `groupingRule` base+overlay fold, no `rules`/schema-fn declarative sugar (D6–D8) — issue #60.
- No header-click routing of a grouped column's sort to `groupOrder` — out of scope in the spec's
  own "Out of Scope" section, a UI-layer/directive concern.

## Acceptance Checks

- [ ] `WithGroupingConfig<TRow>.groupOrder` typed exactly as `GroupSummary<TRow>`-based, matching
      Step 1.
- [ ] Both the pipeline `group` stage and render `group` stage receive `config.groupOrder`.
- [ ] `tsc --noEmit` passes.

---
← [Step 2: sortClusters() + wiring into clusterRows/buildGroupRenderRows](step-2-engine-sort-clusters.plan.md) | [Step 4: Tests](step-4-tests.plan.md) →
