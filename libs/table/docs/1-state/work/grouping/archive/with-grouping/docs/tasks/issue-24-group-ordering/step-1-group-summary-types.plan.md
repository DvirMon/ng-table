---
title: 'Step 1 — GroupKey / GroupSummary types'
type: task-step
issue: 58
---

# Step 1 — `GroupKey` / `GroupSummary<TRow>` types

**PR scope:** Core — every later step in this issue imports from here.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Scaffolding agent:** angular-implementer

**Depends on:** none (first step)
**Parallel-safe with:** none

## Files

- `libs/shared/table/src/api/types.ts` (edit)

## Why This Step Exists

D4 settles `groupOrder`'s signature as `(a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number`
over group _contents_, not a bare `GroupKey` — the rejected `compareGroups?: (a: GroupKey, b:
GroupKey) => number` sketch couldn't express count-based ordering. Both types are new; nothing in
`src/` defines `GroupKey` yet (`engine/grouping.ts`'s `ClusterNode.value: unknown` is the closest
existing shape it aliases).

Spec: `../../3-spec.md`, "Public surface" (D1, D3, D4, D6, D7, D8, D14 block) — the
`GroupSummary<TRow>`/`groupOrder` lines specifically.

## What To Do

In `api/types.ts`, immediately after the existing `GroupingUpdater<TRow>` type (currently the
line right after `ColumnId<TRow>`), add:

```ts
/** The raw clustering value for one group — `ClusterNode.value` (`engine/grouping.ts`) before
 * `toGroupKey()` stringifies it for bucketing. Opaque to consumers; `GroupSummary.rows` is what
 * makes ordering (e.g. by row count) actually expressible (D4). */
export type GroupKey = unknown;

export interface GroupSummary<TRow> {
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}
```

## Implementation Notes

- `GroupKey = unknown` (not a narrower alias) means no `as` cast is needed anywhere `node.value`
  (already `unknown`) is assigned to a `GroupSummary.key` — the type already accepts it
  structurally. Do not narrow this later without checking every call site that relies on it.
- Do not add `groupOrder` itself here — that's `WithGroupingConfig<TRow>`, which lives in
  `api/features/with-grouping.ts` (Step 3), not `api/types.ts`.

## Risks / Watchouts

- None — this is two type declarations with no runtime code.

## Non-Goals

- No changes to `ClusterNode<T>` (`engine/grouping.ts`) — `GroupKey`/`GroupSummary` are a public
  surface, `ClusterNode` stays engine-internal and unexported.

## Acceptance Checks

- [ ] `GroupKey` and `GroupSummary<TRow>` exported from `api/types.ts`.
- [ ] `tsc --noEmit` passes.

---

[Step 2: sortClusters() + wiring into clusterRows/buildGroupRenderRows](step-2-engine-sort-clusters.plan.md) →
