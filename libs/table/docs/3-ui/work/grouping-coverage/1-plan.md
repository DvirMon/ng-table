---
title: Plan — close the grouping story coverage regressions
type: plan
capability: grouping
date: 2026-09-19
---

# Grouping stories — close the coverage regressions

## Context

The grouping story set was restructured to "one story, one lesson"
([`3-lesson-audit.md`](../grouping-stories/3-lesson-audit.md)): five mixed-purpose hosts became
eight single-lesson ones, and `grouping-regressions/` + `grouping-crud/` were deleted. Each
removal was individually right. Nobody added up the total.

The coverage re-audit ([`4-coverage-reaudit.md`](../grouping-stories/4-coverage-reaudit.md))
re-derived every mark in [`0-product/grouping.md`](../../../0-product/grouping.md) against the
new set and found the doc claims **11 ✅ / 5 🟡 / 1 ❌** while the actual state on `main` is
**8 / 5 / 4**. Four marks regressed, and the cause is structural rather than careless: **every
cross-feature mark rests on a composition, and splitting stories by API option is exactly the
move that dissolves compositions.** Two of the four came from deleting a single `withSorting()`
call.

This plan executes four decisions taken with the user, one at a time, plus the doc corrections
that follow.

## Decisions being executed

| # | Decision | Why |
|---|---|---|
| D1 | `grouping-order/` composes `withSorting()` | The row sort is the *contrast that defines* group order. Without it the story cannot answer "isn't this just sorting?" — the first question `applyGroupOrder` raises. Distinct from the `withSorting()` removed from `grouping-collapsible/` in `3af4fcf`, where sorting was instrumentation against collapse state. |
| D2 | Only `grouping-aggregates/` shows totals | Three hosts kept `groupingConfig` after the config split. A group total now appears on exactly one canvas. |
| D3 | `stickyHeaders` arg on `grouping-basic/` | The CSS rule survives in `grouping-story.css` with nothing applying it. Sticky is a CSS recipe over `data-row-kind`, not a grouping API option — same category as `showCount`, so it adds no second lesson. |
| D4 | Criteria that cannot fail become a spec assertion | Three product-doc criteria rest on `PIPELINE_ORDER = ['filter','group','sort','expand']`; no data, config or user action can make them false. They are regression guards, not story requirements. |

### D4 in detail

| Criterion | Where | Why it cannot fail |
|---|---|---|
| "The ordering reflects the filtered rows" | §3.4 crit. 2 | Clustering runs on post-filter rows |
| "The ordering updates when the data does" | §3.4 crit. 3 | The chain is `computed()` over the rows signal |
| "A group with no surviving rows disappears" | F-G1 crit. 2 | An empty cluster is unrepresentable |

The first is in the doc because **AG Grid gets it wrong** — `initialGroupOrderComparator` runs
before filtering and aggregation. §8.4 already records that as a differentiator; a competitive
claim is not a user story. §3.4's own design status said *"worth a test, not a decision"* while
the coverage mark demanded an on-canvas demo. The design status was right.

**Nothing currently pins filter-before-group.** The one genuine risk — someone editing
`PIPELINE_ORDER` — is unguarded, and a story would never have caught it.

## Accepted costs

- **F-G1 loses its summaries demo.** Its first criterion is "counts *and* summaries are computed
  over the rows that survived the filter", and `grouping-selection/` was the only host composing
  `withFiltering()`. After D2 the counts half still renders; the summaries half becomes an
  argument from `PIPELINE_ORDER`. F-G1 stays 🟡, now for two reasons rather than one.
- **`grouping-order/` becomes a two-feature host** (D1) — the shape the lesson audit spent a
  session removing. The audit supplies its own precedent at
  [`3-lesson-audit.md:187-189`](../grouping-stories/3-lesson-audit.md), which kept
  `withFiltering()` in `grouping-selection/` because it produces *a visible state change*. In
  `grouping-collapsible/` the sort's outcome was "the screen is unchanged" — an invariant you
  have to notice not happening. Here both sides move, and which thing moved is the whole content
  of `applyGroupOrder`. Recorded so the next audit does not read this as a D5 reversal.
- **S-G1's second criterion is deliberately violated.** It reads *"What does not happen: the
  header shows a sort indicator while the table does not change."* Under a real comparator,
  clicking the grouped column in `grouping-order/` does exactly that. The user story's verb is
  *"I want to understand why nothing moved"*, so the mark stands at ✅ — but step 5 must name the
  trade in a sentence rather than marking it silently. The product doc already predicts this at
  `:740` and traces it to D5's accepted cost.
- **S-G1 and S-G2 are currently ✅/🟡 on paper and uncovered in fact.** Their coverage cites
  `grouping-collapsible/`, whose `withSorting()` was removed in `3af4fcf`. Step 4 restores the
  demo and step 5 re-attributes the citation.
- **§2.5 stays 🟡.** Its sort attack moved to `feature.spec.ts` by decision (lesson audit D5).
  Re-adding `withSorting()` to `grouping-collapsible/` would reopen the lesson that closed.

## Two corrections to the audit, found while planning

Both are applied in step 6:

1. **G-2 is not `row-editing.md`'s problem.** That doc already marks G-2 ❌ *(forward-looking)*
   and never mentions `grouping-crud/`. The dead claim is in **`0-product/grouping.md:664-666`**,
   in grouping's own §5 — which also contradicts itself, asserting a coverage claim for G-2 one
   sentence after saying `row-editing.md` owns the mark. Deleting that sentence fixes the dead
   folder link and the contradiction at once. No edit to `row-editing.md`.
2. **The spec assertion belongs in `feature.spec.ts`, not `clusters.spec.ts`.** `clusterRows`
   (`engine/grouping/pipeline.ts`) takes `rows` as a parameter and has no filter stage, so an
   assertion there would restate `Array.prototype.filter`. Only `feature.spec.ts` composes a
   real `createTable()` with `withFiltering()` + `withGrouping()`, making "the comparator saw
   post-filter rows" observable. It already holds the twin assertion for aggregates at `:226-244`.

## Out of scope

- **`grouping-keys/`** — written and uncommitted in the working tree alongside the declarator
  split. Lands in its own session. Its three marks (4.2 → ✅, 1.4 and 4.4 restored) stay
  recorded as pending, not claimed.
- **`row-editing.md`** — untouched, per correction 1.
- **`9859423`'s red object-form `initial` tests** — resolve when the declarator split lands.
- **`grouping.mdx`'s failed-refetch claim** — a `/code-review` Spec-axis finding; folded into
  step 4's mdx pass where it overlaps, otherwise a separate small fix.

## Steps

See [`4-tasks/`](4-tasks/). Seven steps, one commit each, path-scoped — the working tree carries
a parallel declarator split, so every `git add` names files explicitly.

Dependency graph:

```
  S1 ─┐
  S2 ─┤
  S3 ─┼──> S5 ──> S6
  S4 ─┘
  S7  (independent)
```

Parallel-safe: S1, S2, S3, S4, S7. S5 depends on all four code steps landing, because it
records what they actually shipped. S6 depends on S5.

## Verification

- `nx run shared-table:typecheck` — templates change in S1, S2 and S4; `ngc` is the only thing
  that reads them. Run twice if the first reports `.ts` errors: it aborts before the template
  phase, so a source-clean second run is the one that proves anything.
- `nx run shared-table:typecheck-spec` — S3 adds a spec.
- S3's assertion is the only behavioural claim here. It runs in CI, not locally.
- S1, S2 and S4 change what is on canvas: `Basic` (sticky toggle), `Order` (sort headers),
  `Collapsible` and `GroupSelection` (totals gone). Worth opening Storybook once at the end —
  not run by the agent.
