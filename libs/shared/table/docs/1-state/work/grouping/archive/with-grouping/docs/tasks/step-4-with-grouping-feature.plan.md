---
title: "Step 4 — with-grouping.ts feature plugin + barrel export"
type: task-step
issue: 6
---

# Step 4 — `with-grouping.ts` feature plugin + barrel export

**PR scope:** Depends on Step 1 (types + pipeline stage) and Step 2 (render stage). Not
dependent on Step 3 — the feature never imports the updater factories, consumers call them
separately against `table.grouping.update(...)`.

**Task type:** code

**Skills used:** angular-developer, file-organization

**Scaffolding agent:** angular-implementer

**Depends on:** Step 1, Step 2

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (new)
- `libs/shared/table/src/index.ts` (edit)

## Why This Step Exists

This is where the pure pieces (Steps 1–2) become a composable `createTable()` feature: a
`baseGrouping` signal, the `table.grouping` `WritableView` (D1), construction-time validation of
`initialGrouping` (D14's throw branch), and the two stage registrations.

Spec: `../../3-spec.md`, "Public surface" and D1/D14. Decisions: `../../2-decisions.md`.

**Scope note, read before starting:** the spec's D6 (base + overlay fold: `grouping =
groupingRule() ?? baseGrouping()`) is real, but its `groupingRule` config doesn't exist until
issue #60. Building the fold now with no config to drive it would be scaffolding for a config
surface that isn't specced here yet. This step ships `table.grouping` reading `baseGrouping`
**directly** — #60 swaps that one read site for the fold and adds `groupingRule`/`rules` to
`WithGroupingConfig`, which is additive to this step's shape, not a rework of it.

## What To Do

### 1. Config + members, matching the spec's D1/D14 subset only

```ts
import { signal } from '@angular/core';
import { buildGroupRenderRows, clusterRows } from '../../engine/grouping';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import type { ColumnId, GroupingUpdater } from '../types';

type GroupingInput<TRow> = Pick<TableCore<TRow>, 'columns'>;

export interface WithGroupingConfig<TRow> {
  /** Seeds `grouping` at construction. An id naming no known column throws — a wiring error,
   * parallel to `engine/rows.ts`'s `trackBy` throw site (D14). */
  initialGrouping?: ColumnId<TRow>[];
}

export interface GroupingMembers<TRow> {
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
}
```

### 2. The factory

```ts
export function withGrouping<TRow = unknown>(
  config: WithGroupingConfig<TRow> = {}
): (core: GroupingInput<TRow>) => TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  return (core: GroupingInput<TRow>): TableFeatureSpec<TRow, GroupingMembers<TRow>> => {
    const initial = (config.initialGrouping ?? []) as string[];
    const knownIds = new Set(core.columns().map((c) => c.id));
    const unknownIds = initial.filter((id) => !knownIds.has(id));
    if (unknownIds.length > 0) {
      throw new Error(
        `[withGrouping] initialGrouping names unknown column id(s): ${unknownIds.join(', ')}.`
      );
    }

    const baseGrouping = signal<string[]>(initial);
    const grouping = createWritableView<string[], GroupingUpdater<TRow>>(
      () => baseGrouping(),
      (updater) => baseGrouping.update(updater)
    );

    return {
      members: { grouping },
      stages: {
        group: (rows) => clusterRows(rows, baseGrouping(), core.columns()),
      },
      renderStages: {
        group: (rows) => buildGroupRenderRows(rows, baseGrouping(), core.columns()),
      },
    };
  };
}
```

`core.columns()` is read **twice** independently at construction (validating `initialGrouping`)
and at every pipeline/render evaluation (inside the two stage closures) — not cached, since
`columns()` can change at runtime (`setColumns`/column rules) and the stages must reflect that.

### 3. Barrel export — `index.ts`

Match the existing export block style (see `withExpansion`/`withSelection`):

```ts
export { withGrouping } from './api/features/with-grouping';
export type { WithGroupingConfig, GroupingMembers } from './api/features/with-grouping';
export type { ColumnId } from './api/types';
```

Check whether `GroupingUpdater` needs its own export too — export it if `ColumnsUpdater`/
`RowUpdater` are already exported from `index.ts` (match that precedent exactly, don't
introduce a new asymmetry).

## Implementation Notes

- No `onRowsRemoved` (ADR-0006) — `withGrouping()` stores column ids, never `RowId`s. That hook
  is for `RowId`-keyed state only; don't add it here on the assumption every feature needs one.
- No `columnRules`, no `setup`/`onDestroy` — this feature has no side channel into `columns`,
  no DI-context work, and nothing to tear down (no `Subject`, no subscription).
- Annotate `TableCore`/`TableFeatureSpec` directly rather than going through
  `createTableFeature` — this package's `CLAUDE.md` notes internal `with-*()` files do this
  since `engine/` is already in scope (same as `with-expansion.ts`/`with-selection.ts`).

## Risks / Watchouts

- **Don't validate `initialGrouping` against `core.baseColumns`.** Use `core.columns()` — the
  folded, rule-applied list (matches what the pipeline/render stages read) — not the pre-fold
  `baseColumns`, or a column added only via a `columnsSchema` rule would incorrectly throw as
  "unknown."
- **The construction throw fires once, synchronously, at feature-factory time** (same timing as
  the existing `trackBy` throw) — not inside a `computed()`. Don't wrap it in a signal read
  that only evaluates lazily, or a table with grouping composed but never rendered would never
  surface the error.

## Non-Goals

- No `groupingRule`, no `rules` array, no schema-fn layer (#60).
- No `groupOrder` (#58).
- No collapse/expand, no `expandedRows` read (#59).

## Acceptance Checks

- [ ] `withGrouping<TRow>()` composes into `createTable()`'s `features` array with no other
      engine changes.
- [ ] `table.grouping` is a `WritableView<string[], GroupingUpdater<TRow>>`.
- [ ] An `initialGrouping` naming an unknown column id throws at construction, before any data
      renders.
- [ ] The `'group'` pipeline and render stages are registered and behave per Steps 1–2.
- [ ] Exported from `index.ts` alongside its public types.
- [ ] `tsc --noEmit` passes with no new errors.

---
← [Step 3: mutations/update-grouping.ts](step-3-update-grouping-mutations.plan.md) | [Step 5: Tests](step-5-tests.plan.md) →
