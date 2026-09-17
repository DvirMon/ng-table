---
title: "Step 4 — withGrouping(): drop config.groupOrder, collect per-column comparators"
type: task-step
issue: 87
---

# Step 4 — `withGrouping()`: drop `config.groupOrder`, collect per-column comparators

**PR scope:** Removes the table-wide `groupOrder` config slot (breaking, pre-1.0, per the design's
Migration note) and wires `collectGroupOrder(rules)` into the same `ClusterOpts` object the
per-column `when` map already flows through.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions

**Depends on:** Step 1 (`collectGroupOrder`), Step 3 (`ClusterOpts.groupOrderByColumn`).

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-grouping.ts` (edit)

## Why This Step Exists

`WithGroupingConfig.groupOrder` is **replaced**, not supplemented — design: `design-group-
admission.md` § Migration. There is no table-wide counterpart to keep (unlike `when`): a
comparator over `GroupSummary` never receives two clusters from different columns, so the
config-level slot was always the same per-level operation, declared in a place that hid which
level it applied to.

## What To Do

### 1. Remove the config field

Delete `WithGroupingConfig.groupOrder` entirely (the field, its doc comment, and the `GroupSummary`
import if nothing else in this file still needs it — check before removing the import).

### 2. Collect group-order rules the same way `columnWhen` is collected

`buildGroupingSpec` already computes `const columnWhen = collectGroupPredicates(rules);` from the
same `rules` array that `schemaRules`/`config.rules` fold into. Add, right beside it:

```ts
const groupOrderByColumn = collectGroupOrder(rules);
```

Import `collectGroupOrder` from `../../engine/grouping-rules` alongside the existing
`collectGroupPredicates` import.

### 3. Update `clusterOpts`

```ts
const clusterOpts: ClusterOpts<TRow> = {
  groupOrderByColumn: groupOrderByColumn.size > 0 ? groupOrderByColumn : undefined,
  when: config.when,
  columnWhen: columnWhen.size > 0 ? columnWhen : undefined,
};
```

Match the existing `columnWhen.size > 0 ? columnWhen : undefined` pattern exactly — an empty map
becomes `undefined`, not an empty map, so `sortClusters`'s `groupOrderByColumn?.get(...)` reads
stay a plain optional-chain rather than every caller having to distinguish "empty map" from "no
map."

## Implementation Notes

- **`rules` already includes `GroupOrderRule` entries** — `buildGroupingSpec`'s
  `[...schemaRules, ...(config.rules ?? [])]` construction doesn't filter by `kind`, so
  `collectGroupOrder(rules)` sees everything `collectGroupPredicates(rules)` sees. No new
  plumbing needed to get group-order rules into this function; only the new collector call.
- **The existing `unknownRuleIds` validation already covers `GroupOrderRule`** — it maps
  `rules.map((rule) => rule.columnId)`, and every `AnyGroupingRule` variant (including the new
  one) has `columnId`. Nothing to add there.

## Risks / Watchouts

- **This is the breaking removal.** `WithGroupingConfig.groupOrder` disappearing means every
  existing caller passing it stops compiling — that's Step 5's job to fix
  (`grouping-regressions-story-host.component.ts`, the one consumer per the design doc), not
  something to soften with a deprecated-but-still-accepted field. Pre-1.0, one call site, no
  deprecation window (design doc's own Migration note).
- Don't leave `GroupSummary` imported if the removed field was its only use in this file — check
  with a search, don't assume.

## Non-Goals

- No story migration (Step 5).
- No test rewrites (Step 6) — this step's own file has no spec; `with-grouping.spec.ts`'s
  `groupOrder`-config tests will not compile until Step 6.

## Acceptance Checks

- [ ] `WithGroupingConfig` no longer has a `groupOrder` member.
- [ ] `buildGroupingSpec` collects `groupOrderByColumn` via `collectGroupOrder(rules)` and passes
      it into `clusterOpts`, empty-map-to-`undefined` exactly like `columnWhen`.
- [ ] `nx run shared-table:typecheck` clean for `with-grouping.ts`'s own source — whole-project
      typecheck stays red until Step 5 fixes the one broken call site.

---
← [Step 3: Engine — per-column ordering](step-3-engine-per-column-ordering.plan.md) | [Step 5: Migrate grouping-regressions story](step-5-migrate-grouping-regressions-story.plan.md) →
