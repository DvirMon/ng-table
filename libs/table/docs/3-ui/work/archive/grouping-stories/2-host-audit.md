---
status: audit complete, no changes applied
date: 2026-09-15
scope: the four grouping story hosts that were not part of the grouping-static three-way split
---

# Grouping story hosts — audit against the static-split criteria

## Why this exists

`grouping-static/` was split three ways on 2026-09-15 because its host had grown to carry three
lessons, and its source is what the mdx's TS tab shows verbatim. Four diagnostic criteria drove
that split. This file applies the same four to the remaining hosts, to answer whether they need
the same treatment.

The four criteria — a host meant to be copied must not contain:

1. **Demo-harness knobs** — transport toggles and latency dials that drive the demo rather than
   demonstrate the API.
2. **Display formatting in host methods** — a method that turns a value into a string. Belongs in
   a pipe (`grouping-story.pipes.ts`).
3. **Regression-demo arithmetic** — code that injects or measures a known-wrong state.
4. **Decision-narration JSDoc** — D-numbers, P-numbers, S-numbers, §ancestry, competitor issue
   links. Belongs in `docs/`, per `.claude/rules` and the per-project no-decision-narration rule.

## Verdict

**No host needs a split.** Static was the only one carrying more than one lesson; each sibling
composes grouping with exactly one more feature and teaches exactly that. Splitting any of them
would produce a fragment with no lesson of its own.

**Two hosts never received the other two changes from that session** — the pipe migration
(commit `2da7921`) and the JSDoc strip. Both landed on `grouping-static/` only.

| Host | Lines (ts) | 1. Harness | 2. Formatting | 3. Regression | 4. Narration | Action |
|---|---|---|---|---|---|---|
| `grouping-async-rule/` | 90 | inherent | pipes ✅ | — | ✅ clean | none |
| `grouping-regressions/` | 133 | — | pipes ✅ | **by design** | acceptable | none |
| `grouping-collapsible/` | 200 | borderline | ❌ 7 methods | — | ❌ 31-line block | **migrate** |
| `grouping-selection/` | 194 | inherent | ❌ 7 methods | borderline | ❌ 29-line block | **migrate** |

## Per host

### `grouping-async-rule/` — clean

Born from the split, so it already has the target shape. Imports `GROUPING_STORY_PIPES`. JSDoc is
four lines of mechanism with no decision ancestry. `forceFailure`/`latencyMs` are harness knobs but
the rule's own `params: () => ({ forceFailure: …, latencyMs: … })` reads them — that is the async
rule's API surface, not a demo dial bolted on. The one issue link (`#81` on `columnLabelById`) is
the allowed kind: a pointer to why a workaround exists.

### `grouping-regressions/` — clean, and criterion 3 is its job

Marked "do not copy" on canvas and in its JSDoc. `BREAKABLE_ROW_ID`, `toggleBrokenSummary`,
`droppedLevels` and the throwing comparator are the product. ADR-0014 and `#45` references are the
allowed kind — they name the constraint the demo exists to show.

`formatValue` is imported but not for display: `externalRank` and the `by-label` comparator use it
to coerce an unknown group key into something comparable. That is key coercion, and it stays.

### `grouping-collapsible/` — migrate

**Criterion 2 — seven formatting methods, and no pipes import at all.** `groupLabel`,
`isBlankGroup`, `groupRowCount`, `groupAggregate`, `cellValue`, `chevronLabel`, `sortArrow`. Five
are the exact methods `grouping-story.pipes.ts` was created to replace; `cellValue` is the one that
produced the `[object Object]` bug in static and was fixed there by the column `accessor` plus a
`@switch`. This host still has the pre-fix shape, so **the Owner column bug may be live here** —
verify on canvas before assuming the accessor fix covers it.

`chevronLabel` and `sortArrow` are not pure formatting: they compose an accessible label and read
`sortDirections()`. They need their own decision, not a blanket pipe.

**Criterion 4 — a 31-line JSDoc block**, the largest remaining in the folder. Carries P2, P3, P11,
S3, S4, S5, U3, OQ-4, C3, E-G1, ADR-0006, and four competitor references (mui-x #16495, primeng
#18171, Telerik 1525732, plus AG Grid/MUI X key bindings). Same block type stripped from static.
Destination is `docs/0-product/grouping.md`, which already owns §2.5, S3–S5 and P2/P3/P11.

**Criterion 1 — borderline, keep.** `forceFailure`/`latencyMs` drive Refetch, and Refetch is this
story's own attack on collapse state — the transport *is* the lesson. But `refetchStatus` holds two
hardcoded English paragraphs inside the class ("Replaced all N rows with freshly-constructed
objects — every row above is a different object than it was."). Narration in source; belongs in the
template.

### `grouping-selection/` — migrate

**Criterion 2 — seven methods, no pipes import.** The same five as collapsible, plus
`rowCheckboxLabel` and `groupCheckboxLabel`. `cellValue` again carries the pre-accessor shape, so
the same Owner-column check applies.

**Criterion 4 — a 29-line JSDoc block** plus inline narration on five members. Carries D16, P10,
P10b, §6, ag-grid #11209, TanStack #5700 and #5822. `docs/0-product/grouping.md` §6 and D16 already
own all of it.

**Criterion 1 — keep the filter.** `createDealFilters()`/`onFilterRep` is this story's own lesson:
a selected row a filter hides stays selected. It is also now the only grouping story that filters,
which is what §4.3's coverage rests on.

**Criterion 3 — borderline, keep.** `selectedGroupHeaderCount` is always 0 by construction and
rendered anyway, which is measuring the absence of a bug (TanStack #5700). That is this story's
evidence rather than injected misuse, and the readout is only meaningful because it is on screen.

## Follow-on: does `fixtures/utils.ts` survive?

Current consumers:

| Export | Used by |
|---|---|
| `formatAmount` | `grouping-story.pipes.ts`, collapsible, selection |
| `isBlankGroupValue` | `grouping-story.pipes.ts`, collapsible, selection |
| `formatValue` | collapsible, selection, **regressions** (key coercion, legitimate) |
| `readRepCriterion`, `repFilterNode` | selection only |

After migrating the two hosts, `formatAmount` and `isBlankGroupValue` have one consumer each — the
pipes file. `formatValue` keeps regressions as a real consumer. The file does not disappear, but its
role narrows to "what the pipes are built on, plus key coercion", and its doc comment should say so.

## What this does not cover

The mdx code tabs for both hosts show their current source verbatim, so migrating either changes
what `grouping.mdx` publishes. No mdx prose claims a method name, so no doc edit is implied beyond
the JSDoc destinations named above.
