---
title: 'Step 2 — applyGroupOrder(path.x, cmp) schema sugar'
type: task-step
issue: 87
---

# Step 2 — `applyGroupOrder(path.x, cmp)` schema sugar

**PR scope:** The declarative call site itself — records a `GroupOrderRule` through the schema
recorder, same shape as `applyGrouping`.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming

**Depends on:** Step 1 — needs `GroupOrderRule`/`GroupOrder` to exist.

**Parallel-safe with:** Step 3 — both depend only on Step 1 and touch disjoint files.

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/schema/grouping-rules.ts` (edit)
- `libs/table/src/index.ts` (edit)

## Why This Step Exists

Design: `design-group-admission.md` § `groupOrder` moves to the schema. `sortClusters` only ever
compares siblings, and siblings always share a `columnId` — the comparator was already per-level
in everything but where it was declared. `applyGroupOrder` is the declaration site that matches
that reality, alongside `applyGrouping`/`applyGroupingAsync` in the same file.

## What To Do

Beside `applyGrouping`/`applyGroupingAsync` in `schema/grouping-rules.ts`:

```ts
/**
 * Declares the sibling-ordering comparator for one grouping level. Unlike `applyGrouping`, this
 * does not activate or deactivate the level — a `GroupOrderRule` on a column with no active
 * level is a silent no-op. Comparator receives `GroupSummary` (post-admission, `admitted`
 * included), so it can place a dissolved cluster's flat rows anywhere among its siblings.
 */
export function applyGroupOrder<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  comparator: GroupOrder<TRow>,
): void {
  assertPathIsCurrent(path).record({
    kind: 'group-order',
    columnId: path.id,
    comparator,
  });
}
```

Add `GroupOrder` to the `../api/types` import and `GroupOrderRule` to the
`./grouping-schema.types` import at the top of the file (the latter is inferred by the object
literal's `kind: 'group-order'` discriminant, so an explicit type import is only needed if you
reference `GroupOrderRule` by name — match whatever the file's existing style does for
`GroupingAsyncRule`).

### `index.ts` — add the public export

`applyGrouping`/`applyGroupingAsync` are named exports from `./schema/grouping-rules` on
`index.ts:50` (`GroupOrder`/`GroupOrderRule` need no separate export — `index.ts:9`'s
`export * from './api/types'` already re-exports every type added there in Step 1). Add
`applyGroupOrder` to that same named-export line:

```ts
export { applyGrouping, applyGroupingAsync, applyGroupOrder } from './schema/grouping-rules';
```

## Implementation Notes

- **No `assertOpen`/generic-erasure workaround needed here.** Unlike `applyGroupingAsync`
  (`GroupingAsyncRule`'s contravariant `factory`/`onSuccess` positions), `GroupOrderRule` has no
  generic parameters beyond `TRow`, so the object literal assigns directly to
  `AnyGroupingRule<TRow>` without the double-cast bridge `applyGroupingAsync` needs. If TS
  disagrees, that's a signal the type was shaped wrong in Step 1 — don't paper over it with a cast
  copied from `applyGroupingAsync`.
- **Call order does not matter for this rule kind** — unlike `applyGrouping`, where call order is
  level order via `foldGroupingRules`. `collectGroupOrder` reads a `Map`, so only the last call
  for a given `columnId` survives (Step 1's documented "last write wins").

## Risks / Watchouts

- Don't give `applyGroupOrder` an `opts` object (`{ comparator }`) — every sibling function in
  this file that takes exactly one behavioral argument (there are none yet, but `applyGrouping`'s
  `opts.when` precedent is for _multiple_ orthogonal members) takes it positionally when there's
  only one. Match the design doc's call shape: `applyGroupOrder(path.region, cmp)`, not
  `applyGroupOrder(path.region, { comparator: cmp })`.

## Non-Goals

- No engine changes — `ClusterOpts` and `sortClusters` are Step 3.
- No `withGrouping()` wiring — Step 4.

## Acceptance Checks

- [ ] `applyGroupOrder(path.x, cmp)` records a `GroupOrderRule` with `kind: 'group-order'`,
      `columnId: path.id`, `comparator: cmp`.
- [ ] Calling it outside the schema fn's synchronous execution throws (`assertPathIsCurrent`'s
      existing guard — no new test needed if the shared recorder mechanism already covers it, but
      confirm by inspection).
- [ ] `applyGroupOrder` is exported from `index.ts`, alongside `applyGrouping`/`applyGroupingAsync`.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.

---

← [Step 1: GroupOrder type, GroupOrderRule, and the per-column collector](step-1-group-order-rule-types.plan.md) | [Step 3: Engine — per-column ordering](step-3-engine-per-column-ordering.plan.md) →
