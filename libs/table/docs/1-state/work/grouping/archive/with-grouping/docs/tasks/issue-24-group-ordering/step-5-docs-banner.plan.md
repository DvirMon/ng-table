---
title: 'Step 5 — Docs banner update'
type: task-step
issue: 58
---

# Step 5 — Docs banner update

**PR scope:** Depends on Step 3 (the code the doc describes). Parallel-safe with Step 4 — neither
touches the other's files.

**Task type:** docs

**Skills used:** none

**Scaffolding agent:** none (main thread)

**Depends on:** Step 3
**Parallel-safe with:** Step 4

## Files

- `libs/shared/table/docs/1-state/features/grouping.md` (edit)

## Why This Step Exists

`features/grouping.md`'s banner (lines 15–34) is a living per-D-number shipped/unbuilt tracker —
issue #7 already updated it for D1/D3/D9 when those shipped. This step is the identical update for
D4, now that `groupOrder` ships. Full rewrite of the superseded `## State Shape`/`## Behavior`
sections below stays deferred (per the spec's "Documentation updates this work owes") until every
D-number in `2-decisions.md` has shipped — this step does **not** touch those sections.

## What To Do

Edit the banner's opening line and bullet:

```diff
-> **⚠️ Two sections superseded — D1/D3/D9 shipped (issue #7, 2026-09-10); D4/D6–D8/D11 still
-> unbuilt, read the decisions first for those.**
+> **⚠️ Two sections superseded — D1/D3/D4/D9 shipped (issues #7, #24); D6–D8/D11 still
+> unbuilt, read the decisions first for those.**
```

And the "Still current, unshipped" paragraph — drop the `groupOrder`/D4/#58 clause:

```diff
-> Still current, unshipped: group ordering via `groupOrder` (D4, #24), the `groupingRule`
-> base+overlay fold and `applyGrouping()`/`applyGroupingAsync()` sugar (D6–D8, #26), and
-> collapse/expand coupling via `withExpansion()`'s `expandedRows` (D11, #25) — every cluster
-> currently renders fully expanded, unconditionally. Read the decisions doc before building any
-> of these.
+> Still current, unshipped: the `groupingRule` base+overlay fold and
+> `applyGrouping()`/`applyGroupingAsync()` sugar (D6–D8, #26), and collapse/expand coupling via
+> `withExpansion()`'s `expandedRows` (D11, #25) — every cluster currently renders fully expanded,
+> unconditionally. Read the decisions doc before building any of these.
```

Also add one line inside the first superseded bullet (the "Methods" one, which already documents
D1) noting `groupOrder` shipped, matching how that bullet already threads in D1's shipped detail
inline rather than as a separate bullet — insert after the existing "A `groupingRule` overlay and
declarative `applyGrouping()` sugar (D6–D8) are still unbuilt (#26)." sentence:

```diff
> - **Methods** — `setGrouping()`/`clearGrouping()` never shipped. The real write surface is
>   `table.grouping.update(updater)` with pure updater factories in `mutations/update-grouping.ts`
>   (D1, shipped) — `setGroupLevels`/`addGroupLevel`/`removeGroupLevel`/`reorderGroupLevels`. A
>   `groupingRule` overlay and declarative `applyGrouping()` sugar (D6–D8) are still unbuilt (#26).
+>   Cluster order is `groupOrder` on `withGrouping()`'s config (D4, shipped, issue #24) — omitted,
+>   stable first-occurrence order; supplied, orders siblings within a parent by their contents,
+>   fully decoupled from `sorting` (D5).
```

## Implementation Notes

- Frontmatter (`spec: drafted`, `code: partial`) stays unchanged — D6–D8/D11 remain unbuilt, so the
  capability is still `partial`, not `shipped`. Don't flip it.
- Don't touch `## Executive Summary`, `## State Shape`, or `## Behavior` below the banner — those
  describe the pre-#7 single-level contract deliberately left as-is until the whole spec ships
  (same reasoning issue #7 already applied).

## Risks / Watchouts

- Keep the diff scoped to the banner only — a broader rewrite here duplicates work the spec
  explicitly defers to whenever D6–D8/D11 land, and risks drifting from what issue #7's edit
  already established as the pattern.

## Non-Goals

- No `docs/status.md` regen (`npm run table:status`) — that's driven by `features/grouping.md`'s
  frontmatter, which this step doesn't change.
- No edit to `docs/1-state/architecture.md` — its `withGrouping()` row is capability-level, not
  D-number-level, and doesn't need a per-decision update.

## Acceptance Checks

- [ ] Banner's first line lists D4 under shipped, not unbuilt.
- [ ] "Still current, unshipped" paragraph no longer names `groupOrder`/D4/#58.
- [ ] Frontmatter `spec`/`code` fields unchanged.

---

← [Step 4: Tests](step-4-tests.plan.md)
