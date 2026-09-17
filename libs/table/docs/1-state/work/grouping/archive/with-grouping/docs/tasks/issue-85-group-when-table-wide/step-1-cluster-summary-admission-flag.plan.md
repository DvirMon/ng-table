---
title: "Step 1 — ClusterSummary, the admitted flag, and admission-aware ordering"
type: task-step
issue: 119
---

# Step 1 — `ClusterSummary`, the `admitted` flag, and admission-aware ordering

**PR scope:** The types the predicate and the comparator speak, the marking pass that sets
`admitted`, and `sortClusters` learning about it. Nothing emits differently yet.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming, file-organization

**Depends on:** #84 Step 1 — this slice adds a member to the reshaped `WithGroupingConfig`, and
the two must not race on that type.

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/types.ts` (edit)
- `libs/shared/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

`groupWhen` **decides** admission, so it cannot be handed a summary that already states it — that
is why the design splits one type into two rather than adding a flag to `GroupSummary` and reusing
it for both callbacks (`design-group-admission.md` § The mechanism). The comparator, by contrast,
runs *after* admission is decided and needs to see it, because ordering is what replaces an
`ungroupedPlacement` config key.

Landing the vocabulary and the marking pass before anything dissolves keeps the behavioural change
(Step 2) reviewable on its own: this step is observably a no-op, because nothing supplies a
predicate until Step 3.

Design: `design-group-admission.md` § The mechanism, § Ordering.

## What To Do

### 1. The two summary types

In `api/types.ts`, beside the existing `GroupSummary`:

```ts
/** What `groupWhen` judges: a built cluster's own contents, before admission is decided. */
export interface ClusterSummary<TRow> {
  readonly columnId: string;
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}

/** What `groupOrder` compares: the same cluster, after admission is decided. `admitted: false`
 * ⇒ this cluster emits flat, no header. */
export interface GroupSummary<TRow> extends ClusterSummary<TRow> {
  readonly admitted: boolean;
}

export type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>) => boolean;
```

`GroupSummary` gains two members. That is additive for every existing consumer — the one comparator
in the repo (`grouping-regressions-story-host.component.ts`) reads `key` and `rows` and keeps
compiling.

### 2. `ClusterNode` carries its verdict

```ts
export interface ClusterNode<T> {
  readonly columnId: string;
  readonly value: unknown;
  readonly items: T[];
  readonly children: ClusterNode<T>[];
  /** Set by `admitClusters`. `buildClusters` leaves it `true` — an unjudged tree is fully
   * admitted, which is what makes a table with no `groupWhen` byte-identical to today. */
  readonly admitted: boolean;
}
```

`buildClusters` sets `admitted: true` on every node it builds. Do not make the member optional —
an optional flag means every reader has to decide what `undefined` means, and they will not all
decide the same way.

### 3. `admitClusters` — the marking pass

A sibling of `sortClusters`, with the same `toRows` bridge so it works for both the raw-`TRow`
pipeline tree and the render-row tree:

```ts
export function admitClusters<T, TRow>(
  nodes: ClusterNode<T>[],
  groupWhen: GroupWhen<TRow> | undefined,
  toRows: (items: T[]) => TRow[],
  reportedColumns: Set<string>,
): ClusterNode<T>[];
```

- `groupWhen` undefined ⇒ return `nodes` unchanged, by reference, at every level. Same shape as
  `sortClusters`' early return.
- Otherwise, per node: build a `ClusterSummary` (`columnId`, `key: node.value`,
  `rows: toRows(node.items)`) and call the predicate.
- **A node judged not admitted does not have its descendants judged.** Q1 says its rows leave the
  grouping tree entirely, so its children are never emitted — evaluating a consumer callback
  against clusters nobody will render is wasted work and a confusing thing to see in a debugger.
  Recurse into `children` only for an admitted node.
- **Throws ⇒ admit** (`admitted: true`), and report once per column per evaluation via
  `reportedColumns`, matching `computeAggregates`' dedupe rather than the comparator's
  once-per-evaluation flag.

Add the reporter beside the two existing ones:

```ts
function reportGroupWhenError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] groupWhen threw for column "${columnId}". Admitting the cluster (rendering ` +
      'it as a group) for the affected cluster(s) in this evaluation.',
  );
}
```

### 4. `sortClusters` sees admission

Two changes, both in the summary it builds and the default it applies:

```ts
const summary = {
  columnId: node.columnId,
  key: node.value,
  rows: toRows(node.items),
  admitted: node.admitted,
} satisfies GroupSummary<TRow>;
```

And the no-comparator path stops being an unconditional pass-through. When a level contains a
dissolved sibling, apply a **stable partition** — admitted siblings in first-occurrence order, then
dissolved ones in first-occurrence order:

```ts
if (!groupOrder) {
  return partitionByAdmission(nodes);   // reference-identical when every node is admitted
}
```

`partitionByAdmission` must return `nodes` itself, unchanged, when nothing is dissolved — the
reference-preserving no-op is load-bearing for the "composing `withGrouping()` with no extra config
changes nothing" guarantee, and `engine/grouping.spec.ts` already asserts reference identity for
the omitted-comparator case.

Recursion into `children` keeps applying the same rule at every depth.

## Implementation Notes

- **Order of operations is admit → order → emit.** The comparator reads `admitted`, so marking has
  to precede ordering; dissolution has to follow it, so the position a comparator gave a dissolved
  cluster is the position its flat rows occupy. Step 2 does the emitting half; do not move
  dissolution into this step to "finish the thought".
- **`admitClusters` returns a new tree, it does not mutate.** `ClusterNode` members are `readonly`
  and the existing `sortClusters` already rebuilds nodes with spread — match it.
- **Tail-by-default is a consequence, not a rule.** Do not write a comparator, a config key, or a
  constant named after "ungrouped last". It falls out of the stable partition, and a consumer
  comparator that ignores `admitted` is entitled to interleave them.
- **`reportedColumns` is one `Set` per caller evaluation**, created by the caller (Step 3) and
  threaded down, exactly like `computeAggregates`' set.

## Risks / Watchouts

- **Do not reuse the comparator's `reported: { done: boolean }` flag for `groupWhen`.** The design
  states per-column dedupe for admission and once-per-evaluation for ordering — two mechanisms
  because the comparator has no single column to attribute a failure to and the predicate does.
- **Do not give `ClusterSummary` an `admitted` member "for symmetry".** Handing the deciding
  callback the decision is the exact mistake the split exists to prevent.
- **The reference-identity assertion in `engine/grouping.spec.ts:169` must still pass** — it is the
  cheapest possible guard against this step quietly becoming observable.

## Non-Goals

- No dissolution — no change to `emitGroupRows`, `flattenLeaves`, or `collectClusterGroupIds`
  (Step 2).
- No `config.groupWhen` — nothing calls `admitClusters` yet (Step 3).
- No per-column predicate map — #86.

## Acceptance Checks

- [ ] `ClusterSummary`, `GroupSummary extends ClusterSummary`, and `GroupWhen` are exported from
      `api/types.ts`; `GroupSummary` carries `columnId` and `admitted`, `ClusterSummary` carries
      `columnId` and not `admitted`.
- [ ] `buildClusters` marks every node `admitted: true`.
- [ ] `admitClusters` with no predicate returns its input by reference at every level.
- [ ] `admitClusters` does not evaluate the predicate against a dissolved node's descendants.
- [ ] A throwing predicate admits the cluster and reports once per column, not once per cluster.
- [ ] `sortClusters` hands the comparator `columnId` and `admitted`.
- [ ] With every node admitted, `renderRows()` output is byte-identical to before this step.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.
- [ ] `shared-table` suite green in CI on the PR, with no existing assertion changed. Not run
      locally; the byte-identical claim above is unverified until it passes.

---
[Step 2: Emission honours admission](step-2-emission-honors-admission.plan.md) →
