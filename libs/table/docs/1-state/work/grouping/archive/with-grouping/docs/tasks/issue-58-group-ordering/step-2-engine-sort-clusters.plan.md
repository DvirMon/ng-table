---
title: "Step 2 — sortClusters() + wiring into clusterRows/buildGroupRenderRows"
type: task-step
issue: 58
---

# Step 2 — `sortClusters()` + wiring into `clusterRows`/`buildGroupRenderRows`

**PR scope:** Depends on Step 1's types only.

**Task type:** code

**Skills used:** typescript-conventions, file-organization, declarative-naming

**Scaffolding agent:** angular-implementer

**Depends on:** Step 1
**Parallel-safe with:** none

## Files

- `libs/shared/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

D4 runs `groupOrder` inside the existing `'group'` pipeline/render stages: bucket by key → sort
buckets → flatten. D9's second invariant (siblings only, never across depths) needs to fall out of
the recursion mechanically, not be special-cased. D15 requires the callback to degrade (fall back
to stable order) and report **once per evaluation**, never per comparison — this is the first
runtime-callback wrap site in `engine/` (ADR-0014 flags `sortFn`/`accessor`/`aggregateFn` as still
unguarded; `groupOrder` does not inherit an existing wrap to copy from there, but
`api/filters/evaluator.ts`'s `evaluateRecord`/`reportFilterError` — already on this branch — is the
established shape: `try`/`catch` around the callback, `console.error` with an
`eslint-disable-next-line no-console -- ADR-0014` comment, dedup via a flag closed over the whole
evaluation).

Spec: `../../3-spec.md`, D4/D5/D9/D15 in "Decisions"; Testing Decisions' `groupOrder` bullets.

## What To Do

Add to `engine/grouping.ts`, after `buildClusters` and before `flattenLeaves`:

```ts
import type { GroupSummary } from '../api/types';

// ... (near the top, with the other module-level helpers)

function reportGroupOrderError(): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    '[withGrouping] groupOrder threw while ordering group siblings. Falling back to stable ' +
      'first-occurrence order for the affected level(s) in this evaluation.'
  );
}

/**
 * Recursively re-orders each node list's own siblings by `groupOrder` (D4) — never a node's
 * `children` against a *different* parent's children, which falls out of only ever sorting one
 * `nodes` array (one parent's direct children) per call (D9). `toRows` bridges `T` (raw `TRow` for
 * the pipeline stage, a render-row wrapper for the render stage) down to the `TRow[]`
 * `GroupSummary.rows` needs. `reported` is one mutable flag shared across the whole recursive
 * walk for one `clusterRows`/`buildGroupRenderRows` call — "once per evaluation," not once per
 * depth or per comparison (D15).
 */
export function sortClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupOrder: ((a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number) | undefined,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean }
): ClusterNode<T>[] {
  if (!groupOrder) {
    return nodes;
  }
  let ordered = nodes;
  try {
    const summaries = nodes.map((node) => ({
      node,
      summary: { key: node.value, rows: toRows(node.items) } satisfies GroupSummary<TRow>,
    }));
    ordered = [...summaries]
      .sort((a, b) => groupOrder(a.summary, b.summary))
      .map((entry) => entry.node);
  } catch {
    if (!reported.done) {
      reported.done = true;
      reportGroupOrderError();
    }
    ordered = nodes;
  }
  return ordered.map((node) => ({
    ...node,
    children: sortClusters(node.children, groupOrder, toRows, reported),
  }));
}
```

Then thread an optional `groupOrder` param through both exported entry points:

```ts
export function clusterRows<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (row, columnId) =>
    columnById.get(columnId)!.accessor(row)
  );
  const ordered = sortClusters(nodes, groupOrder, (items) => items, { done: false });
  return flattenLeaves(ordered);
}
```

```ts
export function buildGroupRenderRows<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number
): Omit<RenderRow<TRow>, 'index'>[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (item, columnId) => {
    if (!isRowData(item.data)) {
      throw new Error(
        "[withGrouping] buildGroupRenderRows received a row with null data — the 'group' render " +
          "stage must run first in RENDER_ORDER, before anything can synthesize a null-data row."
      );
    }
    return columnById.get(columnId)!.accessor(item.data);
  });
  const ordered = sortClusters(
    nodes,
    groupOrder,
    (items) => items.map((item) => item.data).filter(isRowData),
    { done: false }
  );
  return emitGroupRows(ordered, 0, '', columns);
}
```

`emitGroupRows` itself is unchanged — it already just walks whatever tree it's handed.

## Implementation Notes

- **Do not sort inside `buildClusters`.** Its doc comment ("`Map` preserves insertion order...do
  not swap for a plain object or a sort") is about the *default*, groupOrder-omitted path — keep
  that function untouched and do the ordering as a separate post-pass, exactly like this step does.
  This also keeps `sortClusters` independently testable against a plain `ClusterNode[]` fixture.
- **`{ done: boolean }` fresh per call, not module-level.** `clusterRows` and `buildGroupRenderRows`
  each create their own `{ done: false }` literal — the pipeline stage and the render stage are two
  independent evaluations (D15's "once per evaluation" is scoped to one computed re-run, matching
  `api/filters/evaluator.ts`'s `createFilterEvaluator` docblock: "one evaluator instance is one
  evaluation").
- `node.value satisfies GroupSummary<TRow>['key']` needs no cast — `GroupKey = unknown` (Step 1)
  accepts `node.value: unknown` structurally.
- A throwing `groupOrder` degrades **the affected level only** — if it throws while sorting a
  depth-2 node's children, depth-0/1 siblings that already sorted successfully keep their sorted
  order; only that one level (and, since `ordered = nodes` falls back to the pre-sort input) its
  own siblings fall back to stable order. This still satisfies D15 ("falls back to stable
  first-occurrence order") without discarding sorting that already succeeded elsewhere in the
  tree — a stronger degrade (aborting the whole tree's ordering) is not required by the spec and
  would blank more than the fault warrants.

## Risks / Watchouts

- `Array.prototype.sort` can throw mid-sort in some engines with an inconsistent comparator; the
  copy-then-sort (`[...summaries].sort(...)`) means a caught throw never mutates `nodes` itself,
  so `ordered = nodes` is always a clean fallback.
- Don't forget the `import type { GroupSummary } from '../api/types';` — `engine/grouping.ts`
  currently only imports from `../api/types` as `import type { ColumnDef, RenderRow }`; extend
  that same import line rather than adding a second one.

## Non-Goals

- No change to `resolveGroupingLevels`, `toGroupKey`, `computeAggregates`, or `emitGroupRows` — all
  D9 depth mechanics they implement are unaffected by ordering.
- No `groupOrder` support in `api/features/with-grouping.ts` yet — that's Step 3.

## Acceptance Checks

- [ ] `sortClusters` exported, recurses into `children` unconditionally (even when `groupOrder` is
      defined and the top level throws, deeper levels still get their own sort attempt).
- [ ] `clusterRows`/`buildGroupRenderRows` both accept the new optional 4th param and are
      backward-compatible when it's omitted (existing call sites, e.g. `with-grouping.ts`'s current
      two call sites, still compile unchanged until Step 3 updates them).
- [ ] `tsc --noEmit` passes.

---
← [Step 1: GroupKey / GroupSummary types](step-1-group-summary-types.plan.md) | [Step 3: groupOrder on WithGroupingConfig](step-3-with-grouping-config.plan.md) →
