---
title: "Step 3 — wire withGrouping() to expandedRows"
type: task-step
issue: 59
---

# Step 3 — wire `withGrouping()` to `expandedRows`

**PR scope:** The public feature wiring. Needs both engine changes.

**Task type:** code

**Skills used:** angular-developer, file-organization, typescript-conventions

**Depends on:** Step 1, Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)

## Why This Step Exists

This is the whole of the optional `withExpansion()` coupling (D11): `withGrouping()` reads
`expandedRows` **optionally**, via the `composed` feature-to-feature seam, rather than declaring a
hard dependency on `withExpansion()`. `CLAUDE.md` notes no feature currently reads `composed` — the
two editing features deliberately avoid it by calling each other's factory directly — so this is
the first real use of that seam, and it's read-only.

Decision: `../../../2-decisions.md` D11. Spec: `../../../3-spec.md` D11.

## What To Do

### 1. Widen the core slice; drop `renderRows`, add `rows`

`rowsOf` no longer reads `core.renderRows()` (Step 2 moved it to `core.rows()`):

```ts
type GroupingInput<TRow> = Pick<TableCore<TRow>, 'columns' | 'rows'>;
```

### 2. Accept the `composed` seam and read `expandedRows` optionally

```ts
import type { Signal } from '@angular/core';
// ...
import type { ColumnId, GroupingUpdater, GroupSummary, RenderRow, RowId } from '../types';

function isExpandedRowsSignal(value: unknown): value is Signal<ReadonlySet<RowId>> {
  return typeof value === 'function';
}

export function withGrouping<TRow = unknown>(
  config: WithGroupingConfig<TRow> = {}
): (
  core: GroupingInput<TRow>,
  composed: Record<string, unknown>
) => TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  return (core: GroupingInput<TRow>, composed: Record<string, unknown>) => {
    // ...unchanged initialGrouping validation, baseGrouping, grouping WritableView...

    const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
      rowsBeneathGroup(core.rows(), baseGrouping(), core.columns(), group.id);

    return {
      members: { grouping, rowsOf },
      stages: {
        group: (rows) => clusterRows(rows, baseGrouping(), core.columns(), config.groupOrder),
      },
      renderStages: {
        group: (rows) => {
          const member = composed['expandedRows'];
          const expandedRows = isExpandedRowsSignal(member) ? member() : undefined;
          return buildGroupRenderRows(
            rows,
            baseGrouping(),
            core.columns(),
            config.groupOrder,
            expandedRows
          );
        },
      },
    };
  };
}
```

`RowId` joins the existing `import type { ... } from '../types'` line; `Signal` is added to the
`@angular/core` import.

## Implementation Notes

- **Read `composed['expandedRows']` inside the render stage closure, not at factory time.**
  `composeTable()`'s `foldFeatures()` calls every feature's factory once, in `features` array
  order — at that moment `composed` holds only *earlier* features' members. The returned
  `renderStages.group` function is stored and called later, on every render pass, by which point
  `composed` is complete regardless of where `withExpansion()` sits in the array. This is exactly
  what makes the optional read order-independent (`CLAUDE.md`, "read later ... it holds
  everything").
- **`isExpandedRowsSignal` is intentionally a shallow duck-type check** (`typeof value ===
  'function'`), not a full runtime validation of "is this a `Signal<Set<RowId>>`". That's the
  documented contract — `grouping.md`'s Compile-Time Dependencies section: "detected at runtime
  (e.g. an optional prop/method check), not enforced via a `type<>` compile-time contract." A
  custom type guard (not a bare `as`) is what makes this typecheck cleanly per
  `typescript-conventions.md`.
- **`stages.group` (the pipeline stage) is unchanged.** Collapse is a render-only concern (Step 1);
  the raw pipeline clustering has no reason to read `expandedRows`.
- Don't rename the render stage's key away from `'group'` — it's still the same
  `RENDER_ORDER` slot, just now collapse-aware.

## Risks / Watchouts

- **Don't widen `GroupingInput` to the full `TableCore<TRow>`.** Keep declaring exactly the slice
  this feature reads (`columns`, `rows`) — the point of the per-file `*Input<TRow>` alias is
  self-documentation of what a feature actually touches, even though every feature physically
  receives the same core object.
- **A second feature also claiming `'group'` in `renderStages` still throws at construction**
  (`SlotRegistry`, unchanged) — this step doesn't touch collision behavior, only what the already-
  owned `'group'` stage does internally.
- Don't add a compile-time dependency on `withExpansion()` (no import of `with-expansion.ts`, no
  `ExpansionMembers` type reference) — the whole point of D11 is that `withGrouping()` composes
  standalone.

## Non-Goals

- No stamping of `isExpanded` onto group header `RenderRow`s (Step 1's Non-Goals — still applies
  here, this step only threads the value through).
- No new public config option — `expandedRows` is discovered, not configured.
- No `ADR-0012` (proposed `withTree()` split) implementation — the optional read is written to stay
  correct on either side of that split, per D11, without pre-building for it.

## Acceptance Checks

- [ ] `withGrouping()` composed alone (no `withExpansion()`): `renderRows()` unchanged from #7 —
      every cluster flat and fully expanded, no throw, no console warning.
- [ ] `withGrouping()` + `withExpansion()` composed, in either array order: collapsing a group id
      (i.e., it is absent from `expandedRows()`) omits its descendants from `renderRows()`.
- [ ] `table.rowsOf(header)` still returns the full leaf set for a collapsed header.
- [ ] `tsc --noEmit` passes with no new errors.

---
[← Step 2: Collapse-independent rowsOf](step-2-rows-of-collapse-independent.plan.md) | [Step 4: Tests →](step-4-tests.plan.md)
