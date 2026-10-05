---
title: 'Step 3 — Engine: sortClusters resolves its comparator per column'
type: task-step
issue: 87
---

# Step 3 — Engine: `sortClusters` resolves its comparator per column

**PR scope:** `ClusterOpts.groupOrder` (one comparator, applied at every depth) becomes
`ClusterOpts.groupOrderByColumn` (a `columnId → comparator` map); `sortClusters` looks up the
right comparator for each node list by its own `columnId` instead of receiving one function for
the whole tree. Every caller inside `engine/grouping.ts` updates in the same step so the file
keeps compiling.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions

**Depends on:** Step 1 — needs `GroupOrder<TRow>`.

**Parallel-safe with:** Step 2 — both depend only on Step 1 and touch disjoint files.

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

Today `sortClusters` recurses with **the same** comparator function at every depth — correct only
because `WithGroupingConfig.groupOrder` is one table-wide slot. `buildClusters`'s recursion
already guarantees every node in one array shares a `columnId` (`const [columnId, ...rest] =
levels` — one column per array), so "look up this array's comparator by its own `columnId`" is a
map read, not a new traversal. Design: `design-group-admission.md` § `groupOrder` moves to the
schema.

## What To Do

### 1. `ClusterOpts`

```ts
export interface ClusterOpts<TRow> {
  readonly groupOrderByColumn?: ReadonlyMap<string, GroupOrder<TRow>>;
  readonly when?: GroupWhen<TRow>;
  readonly columnWhen?: ReadonlyMap<string, GroupWhen<TRow>>;
}
```

Add `GroupOrder` to the `../api/types` import at the top of the file.

### 2. `sortClusters` — per-list lookup, not a single passed-down function

Replace the `groupOrder` parameter with `groupOrderByColumn`, and move the "does this list have a
comparator" decision inside the function, keyed by the list's own `columnId` (every node in
`nodes` shares one — read it off `nodes[0]`, guarding the empty-array case):

```ts
export function sortClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupOrderByColumn: ReadonlyMap<string, GroupOrder<TRow>> | undefined,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean },
): ClusterNode<T>[] {
  const comparator = nodes.length > 0 ? groupOrderByColumn?.get(nodes[0].columnId) : undefined;
  const ordered = comparator
    ? orderWithComparator(nodes, comparator, toRows, reported)
    : partitionByAdmission(nodes);
  return ordered.map((node) => ({
    ...node,
    children: sortClusters(node.children, groupOrderByColumn, toRows, reported),
  }));
}

/** The try/sort/catch-and-fall-back-to-input-order half of what `sortClusters` used to do
 * unconditionally — now only reached when this node list's own column has a comparator. */
function orderWithComparator<T, TRow>(
  nodes: ClusterNode<T>[],
  comparator: GroupOrder<TRow>,
  toRows: (items: T[]) => TRow[],
  reported: { done: boolean },
): ClusterNode<T>[] {
  try {
    const summaries = nodes.map((node) => ({
      node,
      summary: {
        columnId: node.columnId,
        key: node.value,
        rows: toRows(node.items),
        admitted: node.admitted,
      } satisfies GroupSummary<TRow>,
    }));
    return [...summaries]
      .sort((a, b) => comparator(a.summary, b.summary))
      .map((entry) => entry.node);
  } catch {
    if (!reported.done) {
      reported.done = true;
      reportGroupOrderError();
    }
    return nodes;
  }
}
```

`partitionByAdmission` is unchanged (already reference-preserving when nothing is dissolved).
Deleting the old `if (!groupOrder) return partitionAndRecurse(nodes);` early-return and its
`partitionAndRecurse` helper is correct **only if** every remaining call path routes through the
new `sortClusters` recursion above — check both:

- `partitionAndRecurse` was `sortClusters`'s whole no-comparator body (own reference-preserving
  recursion). The rewritten `sortClusters` above already recurses and calls
  `partitionByAdmission` per level when there's no comparator for that level, so
  `partitionAndRecurse` is now dead code — delete it, don't keep it unused.
- Re-verify the reference-identity guarantee: with `groupOrderByColumn` `undefined` (or a map
  with no entry for this tree's columns), every level takes the `partitionByAdmission` branch,
  which returns `nodes` itself when nothing is dissolved — so the whole tree is still reference-
  identical to the input when nothing dissolves and nothing has a comparator. Confirm this by
  running the existing reference-identity tests (Step 6 rewrites their call shape, not this
  guarantee).

### 3. Callers inside this file

Three call sites construct or pass `ClusterOpts`/call `sortClusters` directly — update all three:

- `clusterRows`: `sortClusters(admitted, opts?.groupOrderByColumn, (items) => items, { done: false })`
- `buildGroupRenderRows`: same substitution.
- `collectGroupIds`: same substitution.

No signature changes needed on `clusterRows`/`buildGroupRenderRows`/`collectGroupIds` themselves —
they already take `opts?: ClusterOpts<TRow>` and just forward the field through.

## Implementation Notes

- **`reported` stays one flag for the whole recursive walk**, exactly as today — "reported once
  per evaluation" (D15) means once per `clusterRows`/`buildGroupRenderRows`/`collectGroupIds`
  call, not once per level and not once per column. Do not key it by `columnId`; that's
  `admitClusters`'s `reportedColumns` pattern (admission), a different dedupe granularity for a
  different callback (D15 vs the admission table in `2-decisions.md`).
- **A comparator that throws still falls back to _that level's_ pre-sort order only** — the
  `catch` returns `nodes` (this list), and recursion into `children` continues independently per
  child list, each resolving its own comparator by its own `columnId`. This is unchanged behavior,
  just now keyed per-column instead of applying to a single global comparator.
- **`reportGroupOrderError` stays a flat, non-column message** — D15 is once-per-evaluation, not
  once-per-column like `reportGroupWhenError`/`reportAggregateError`. Don't add a `columnId`
  parameter to it.

## Risks / Watchouts

- **Don't collapse `orderWithComparator` back into `sortClusters`'s try block inline** — Step 6's
  tests call `sortClusters` directly with a `Map`, not `orderWithComparator`, so the split isn't
  required for testability, but keeping the try/catch isolated from the recursion makes the
  "which level are we even in" question answerable from the stack, which the flat inline version
  before this step didn't need to worry about (it was one function, one comparator, no lookup).
- **`nodes[0].columnId` assumes `buildClusters`'s per-array invariant still holds.** It does not
  change in this step — don't add a runtime check for "what if siblings have mixed `columnId`s",
  that would be a symptom of a `buildClusters` bug this step doesn't touch, not something
  `sortClusters` should degrade around.

## Non-Goals

- No `withGrouping()`/`WithGroupingConfig` changes — Step 4.
- No test file edits — Step 6. (`engine/grouping.spec.ts`'s existing `sortClusters` calls will not
  compile against this new signature until Step 6 lands; that's expected mid-slice breakage,
  consistent with `#85`/`#86`'s own step ordering — see this workspace's other step plans.)

## Acceptance Checks

- [ ] `ClusterOpts.groupOrder` is renamed `groupOrderByColumn: ReadonlyMap<string, GroupOrder<TRow>>`.
- [ ] `sortClusters` takes `groupOrderByColumn` and resolves the comparator per node list by that
      list's own `columnId`.
- [ ] `partitionAndRecurse` is deleted (dead after the rewrite), not left unused.
- [ ] `clusterRows`/`buildGroupRenderRows`/`collectGroupIds` all pass `opts?.groupOrderByColumn`
      through unchanged in shape.
- [ ] `nx run shared-table:typecheck` clean **for this file's own compilation** — `libs/table/src`
      as a whole will not typecheck clean until Step 4 (the config-level `groupOrder` field is
      still `(a,b)=>number`-shaped there until then) and Step 6 (spec files). Confirm this file's
      exports match the new signature by reading the diff, not by a clean whole-project run.

---

← [Step 2: applyGroupOrder schema sugar](step-2-apply-group-order-sugar.plan.md) | [Step 4: Wire into withGrouping()](step-4-wire-with-grouping.plan.md) →
