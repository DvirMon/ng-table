---
title: "Step 1 — GroupOrder type, GroupOrderRule, and the per-column collector"
type: task-step
issue: 87
---

# Step 1 — `GroupOrder` type, `GroupOrderRule`, and the per-column collector

**PR scope:** The vocabulary `applyGroupOrder` (Step 2) and the engine (Step 3) both need — a
named comparator type, a third rule kind alongside `GroupingRule`/`GroupingAsyncRule`, and the
`Map<columnId, GroupOrder>` collector that mirrors `collectGroupPredicates`. No behavior change:
nothing constructs a `GroupOrderRule` yet.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming, file-organization

**Depends on:** None — first step of this slice. `#84`/`#85`/`#86` (config reshape, table-wide
`when`, per-column `when`) are already landed on `main`.

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/schema/grouping-schema.types.ts` (edit)
- `libs/table/src/engine/grouping-rules.ts` (edit)

## Why This Step Exists

`applyGroupOrder(path.x, cmp)` records through the same recorder session as `applyGrouping`
(`schema/column-schema.ts`'s `record()`), which is generic over one fixed `TRule` per session —
`AnyGroupingRule<TRow>`. A per-column comparator has to become a member of that union before
`applyGroupOrder` can call `assertPathIsCurrent(path).record({...})`, and `foldGroupingRules`
(level order) must keep ignoring it, exactly the way it already ignores `when` — a new kind, not
a new field on the existing ones. Design: `design-group-admission.md` § `groupOrder` moves to the
schema, § `when` does not flow through `foldGroupingRules` (same reasoning, new kind).

## What To Do

### 1. `GroupOrder<TRow>` — name the comparator

In `api/types.ts`, beside `GroupWhen`:

```ts
/** What `applyGroupOrder` compares: two siblings from the same level, after admission is
 * decided. `admitted: false` ⇒ that cluster emits flat, no header. */
export type GroupOrder<TRow> = (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
```

`WithGroupingConfig.groupOrder`'s current inline signature
(`(a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number`) becomes `GroupOrder<TRow>` at every
site that uses it (Steps 3-4) — one name, not a repeated inline type.

### 2. `GroupOrderRule<TRow>` — the third rule kind

In `schema/grouping-schema.types.ts`:

```ts
/** One column's `applyGroupOrder(path.x, cmp)` declaration. Unlike `GroupingRule`/
 * `GroupingAsyncRule`, this kind never activates or deactivates a level — it only orders that
 * level's siblings once it's active. */
export interface GroupOrderRule<TRow = unknown> {
  readonly kind: 'group-order';
  readonly columnId: string;
  readonly comparator: GroupOrder<TRow>;
}

export type AnyGroupingRule<TRow = unknown> =
  | GroupingRule<TRow>
  | GroupingAsyncRule<TRow>
  | GroupOrderRule<TRow>;
```

Import `GroupOrder` from `../api/types` alongside the existing `GroupWhen` import.

### 3. `isGroupOrderRule` guard + `collectGroupOrder`

In `engine/grouping-rules.ts`, beside `isGroupingRule`/`isGroupingAsyncRule`:

```ts
export function isGroupOrderRule<TRow>(
  rule: AnyGroupingRule<TRow>
): rule is GroupOrderRule<TRow> {
  return rule.kind === 'group-order';
}
```

And beside `collectGroupPredicates` — same shape, same "last write wins" note, reading
`comparator` instead of `when`:

```ts
/**
 * Static per-column ordering comparators, collected off the same `rules` array `withGrouping()`
 * builds — independent of `foldGroupingRules` (level order) and `collectGroupPredicates`
 * (admission), exactly the way those two are independent of each other. Last write wins for a
 * duplicate `columnId` (undocumented edge case, not validated).
 */
export function collectGroupOrder<TRow>(
  rules: readonly AnyGroupingRule<TRow>[]
): Map<string, GroupOrder<TRow>> {
  const comparators = new Map<string, GroupOrder<TRow>>();
  for (const rule of rules) {
    if (isGroupOrderRule(rule)) {
      comparators.set(rule.columnId, rule.comparator);
    }
  }
  return comparators;
}
```

Import `GroupOrder` and `GroupOrderRule` alongside the existing type imports at the top of the
file.

## Implementation Notes

- **`GroupOrderRule` has no `enable`.** It never contributes to `foldGroupingRules`'s
  `string[] | undefined` fold — `buildGroupingRuleEntries` and `buildAsyncGroupingRuleEntry` stay
  untouched, and `with-grouping.ts`'s `rules.filter(isGroupingRule)` /
  `rules.filter(isGroupingAsyncRule)` already exclude it by construction (a `group-order` rule
  fails both `kind` checks). No filter needs updating there — only a third `collectGroupOrder(rules)`
  call needs adding (Step 4).
- **A `GroupOrderRule` on a column with no active level is a silent no-op**, same reasoning as
  `when` on an inactive level — `collectGroupOrder`'s map entry is just never looked up because
  no `ClusterNode` carries that `columnId`.

## Risks / Watchouts

- Don't fold `GroupOrderRule` into `collectGroupPredicates` or vice versa — they read different
  fields (`when` vs `comparator`) off different rule kinds and feed different engine slots
  (admission vs ordering). Keep them as two functions, matching `foldGroupingRules` vs
  `collectGroupPredicates` today.
- Don't touch `WithGroupingConfig`/`ClusterOpts` in this step — that's Steps 3-4. This step only
  adds vocabulary nothing calls yet.

## Non-Goals

- No `applyGroupOrder()` function (Step 2).
- No engine wiring — `sortClusters`/`ClusterOpts` unchanged (Step 3).
- No removal of `WithGroupingConfig.groupOrder` (Step 4).

## Acceptance Checks

- [ ] `GroupOrder<TRow>` is exported from `api/types.ts`.
- [ ] `GroupOrderRule<TRow>` (`kind: 'group-order'`) is exported from `schema/grouping-schema.types.ts`
      and included in the `AnyGroupingRule<TRow>` union.
- [ ] `isGroupOrderRule` and `collectGroupOrder` are exported from `engine/grouping-rules.ts`.
- [ ] `collectGroupOrder([])` returns an empty `Map`; a `GroupOrderRule` for a duplicate `columnId`
      overwrites the earlier entry (last write wins).
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.

---
[Step 2: `applyGroupOrder` schema sugar](step-2-apply-group-order-sugar.plan.md) →
