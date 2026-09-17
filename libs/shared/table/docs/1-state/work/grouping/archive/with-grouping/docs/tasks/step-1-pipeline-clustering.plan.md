---
title: "Step 1 — Pipeline clustering engine + shared types"
type: task-step
issue: 6
---

# Step 1 — Pipeline clustering engine + shared types

**PR scope:** Core. Everything else in this issue depends on it.

**Task type:** code

**Skills used:** angular-developer, file-organization

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/types.ts` (edit)
- `libs/shared/table/src/engine/grouping.ts` (new)
- `libs/shared/table/src/engine/grouping.spec.ts` (new)

## Why This Step Exists

Everything in this issue — the updater factories (Step 3), the render-stage header/aggregate
walk (Step 2), and the feature plugin (Step 4) — needs `ColumnId<TRow>`/`GroupingUpdater<TRow>`
and the pure multi-level clustering engine. This step builds both with no engine wiring yet, so
it's independently testable via plain `vitest` (`engine/` is pure, no signals — see this
package's `CLAUDE.md`, Testing section).

Spec: `../../3-spec.md` (D1, D3, D9, D12, D14). Decisions: `../../2-decisions.md`.

## What To Do

### 1. `api/types.ts` — two new public types

Add near `ColumnDefInput`/`ColumnsUpdater` (same neighborhood as the other `*Updater` types):

```ts
/**
 * D14 — known row keys autocomplete; any other string still compiles, so derived columns
 * (`accessor`-only, no matching `keyof TRow`) and columns added later via `setColumns()` stay
 * expressible.
 */
export type ColumnId<TRow> = Extract<keyof TRow, string> | (string & {});

export type GroupingUpdater<TRow> = (grouping: string[]) => string[];
```

`GroupingUpdater<TRow>` sits alongside `ColumnsUpdater`/`RowUpdater` here (not in
`with-grouping.ts`) because `mutations/update-grouping.ts` (Step 3) needs it without importing
the feature file — same reason `ColumnsUpdater` lives here rather than in `with-sorting.ts`.

### 2. `engine/grouping.ts` — new file

Pure, no signals, no Angular. Generic over an item type `T` (not hard-typed to `TRow`) so the
same tree builder serves both the pipeline stage (`T = TRow`) and, in Step 2, the render stage
(`T` = a render row).

```ts
import type { ColumnDef } from '../api/types';

export interface ClusterNode<T> {
  readonly columnId: string;
  readonly value: unknown;
  readonly items: T[];              // every leaf under this node, at any depth
  readonly children: ClusterNode<T>[]; // empty ⇒ this node is the deepest clustered level
}

/** Distinguishes `1` from `"1"` and normalizes `Date` — plain `String(value)` would collide the
 * first and stringify the second inconsistently across engines. */
function toGroupKey(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return `date:${value.getTime()}`;
  return `${typeof value}:${String(value)}`;
}

/** D14 runtime degrade: an id naming no known column is dropped, not thrown on — "group by the
 * rest." Construction-time validation (a bad `initialGrouping` id) is Step 4's job, not this. */
export function resolveGroupingLevels<TRow>(
  grouping: readonly string[],
  columns: ColumnDef<TRow>[]
): string[] {
  const knownIds = new Set(columns.map((c) => c.id));
  return grouping.filter((id) => knownIds.has(id));
}

/**
 * Recursive stable partition. `accessor(item, columnId)` is supplied by the caller so this
 * builder never needs to know whether `T` is a raw `TRow` or a wrapped render row.
 * `Map` preserves insertion order, which is what gives "first-occurrence order when no
 * `groupOrder` is supplied" (#58) for free — do not swap for a plain object or a sort.
 */
export function buildClusters<T>(
  items: T[],
  levels: readonly string[],
  accessor: (item: T, columnId: string) => unknown
): ClusterNode<T>[] {
  const [columnId, ...rest] = levels;
  if (columnId === undefined) {
    return [];
  }
  const buckets = new Map<string, { value: unknown; items: T[] }>();
  for (const item of items) {
    const value = accessor(item, columnId);
    const key = toGroupKey(value);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      buckets.set(key, { value, items: [item] });
    }
  }
  return Array.from(buckets.values()).map(({ value, items: bucketItems }) => ({
    columnId,
    value,
    items: bucketItems,
    children: buildClusters(bucketItems, rest, accessor),
  }));
}

function flattenLeaves<T>(nodes: ClusterNode<T>[]): T[] {
  return nodes.flatMap((node) =>
    node.children.length > 0 ? flattenLeaves(node.children) : node.items
  );
}

/**
 * The `group` pipeline stage (`PIPELINE_ORDER`, `engine/pipeline.ts`) — `TRow[] => TRow[]`,
 * stable clustering, contiguous at every depth. Empty/all-unknown `grouping` is a reference-
 * preserving no-op, matching `withSorting()`'s empty-rules case.
 */
export function clusterRows<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[]
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((c) => [c.id, c]));
  const nodes = buildClusters(rows, levels, (row, columnId) =>
    columnById.get(columnId)!.accessor(row)
  );
  return flattenLeaves(nodes);
}
```

### 3. `engine/grouping.spec.ts` — plain `vitest`, no `TestBed`

Cover:
- `clusterRows` with 1 level: same-key rows land contiguous, first-occurrence order preserved,
  order within each cluster otherwise unchanged.
- `clusterRows` with 2+ levels: leaf clusters contiguous at every depth (e.g. region → category:
  all `US`/`Electronics` rows contiguous, nested correctly inside all `US` rows).
- `clusterRows` with `grouping: []` returns the same array reference (or at least an
  equivalent no-op) — mirrors `withSorting()`'s `rules.length === 0` short-circuit.
- `clusterRows` with an unknown column id in `grouping` drops that level and clusters by the
  rest, without throwing (D14 runtime degrade — construction-time throw is Step 4's test, not
  this file's).
- `buildClusters` directly: a 2-level input produces the right node shape (`columnId`, `value`,
  `items`, nested `children`), and a node's `items` always contains every leaf under it (parent
  node `items.length` equals the sum of its children's `items.length`) — this is the property
  Step 2's per-depth aggregation correctness depends on.

## Implementation Notes

- `columnById` is built once per `clusterRows` call, outside the per-row loop — same shape as
  `with-sorting.ts`'s `sortRows` (`columnById = new Map(columns.map(...))`). D12 makes this a
  real constraint, not just style: a `.find()` per row per level turns clustering quadratic in
  row count.
- `ClusterNode<T>` and `buildClusters`/`resolveGroupingLevels`/`toGroupKey` are **not** exported
  from `index.ts` — engine-internal, consumed by `with-grouping.ts` (Step 4) and by Step 2's
  render-stage code living in this same file.
- Do not reach for `GroupKey`/`GroupSummary` types here — those are `groupOrder`'s public shape
  (#58, D4), out of scope for this issue. `ClusterNode<T>`'s `columnId`/`value` pair is the
  internal equivalent this issue actually needs.

## Risks / Watchouts

- The empty-levels base case (`columnId === undefined` → `return []`) only means "no more
  nesting for this branch" when reached *inside* recursion (a node's `children`). At the
  top-level entry point it would silently drop every row if `buildClusters` were called directly
  with an empty `levels` array — this is why `clusterRows` pre-filters with
  `resolveGroupingLevels` and short-circuits to `return rows` *before* calling `buildClusters`,
  rather than filtering unknown ids one level at a time inside the recursion. Keep that
  structure; don't "simplify" it by moving the unknown-id check into `buildClusters` itself.

## Non-Goals

- No `GroupKey`/`GroupSummary` (#58). No render-stage code (Step 2). No wiring into a feature
  (Step 4) — this step ships an unconsumed, fully-tested pure module.

## Acceptance Checks

- [ ] `ColumnId<TRow>` and `GroupingUpdater<TRow>` exported from `api/types.ts`.
- [ ] `clusterRows` clusters correctly at 1 and 2+ levels, contiguous at every depth.
- [ ] `grouping: []` and an all-unknown `grouping` are both no-ops (return input rows, unclustered).
- [ ] A single unknown id among otherwise-valid levels is dropped, not thrown on.
- [ ] `tsc --noEmit` (or the project's equivalent type-check) passes with no new errors.
- [ ] `engine/grouping.spec.ts` passes under plain `vitest`, no `TestBed`.

---
[Step 2: Render-stage group headers + aggregates](step-2-render-stage-aggregates.plan.md) →
