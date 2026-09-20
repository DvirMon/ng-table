---
title: Coverage re-audit — 0-product/grouping.md against the eight-story set
type: audit
capability: grouping
date: 2026-09-19
---

# Coverage re-audit — grouping stories

Re-derives every coverage mark in [`0-product/grouping.md`](../../../0-product/grouping.md)
against the story set that came out of [`3-lesson-audit.md`](3-lesson-audit.md). The product doc
still names `grouping-static/`, `grouping-regressions/` and `grouping-crud/` in every "Covered
by" line; all three were deleted. This is the input to fixing that, and §4b of the lesson audit
is the task it feeds.

Two earlier documents, neither superseded:

- [`work/grouping-doc-audit/report.md`](../../../work/grouping-doc-audit/report.md) audited the
  product doc against **the engine** (2026-09-19, resolved). It found 15 stale claims about how
  the code behaves. This audit is the other axis — the doc against **the stories** — and
  assumes that one's fixes are in place.
- [`1-gap-analysis.md`](1-gap-analysis.md) was the pre-restructure coverage pass.

**The headline: the restructure traded coverage breadth for lesson clarity, and four marks
regressed.** That trade was deliberate at each step, but nobody added up the total until now.

## Inputs read

| Input | Path | Used for |
|---|---|---|
| Product user stories | `0-product/grouping.md` | the marks being re-derived |
| Peer capability inventory | `1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md` | what affordance peers render (cited, not re-read in full) |
| Community pain | `.../research-grouping-community-pain.md` | which failure paths a story owes |
| Story conventions | `3-ui/stories.md` | the shape any new/extended story takes |
| Lesson convention | `3-lesson-audit.md` §5 | one story, one lesson |

All nine host components were read directly, not their `.mdx` sections.

## 1. Inventory — what the eight stories actually demonstrate

`grouping-keys/` is written but **uncommitted** at the time of this audit. It is listed because
several marks below turn on it; every mark it carries is flagged *pending commit*.

| Story | Composes | Actually demonstrates |
|---|---|---|
| `grouping-basic/` | `withGrouping({ initial })`, `plainGroupingConfig` | Headers with value and count at every depth; a tab strip toggling a column as a level; pills reading `groupingLevels()` with ◀ ▶ to re-rank and × to drop; Reset levels. Array order is nesting order. No second feature. |
| `grouping-when/` | `withGrouping({ initial, when, schema })`, per-column `applyGrouping(category, { when })` | Table-wide admission AND-combined with a per-column one; an editable min-size threshold on canvas; rejected clusters' rows staying flat at the parent's depth; a depth-0-orphan count as the readout. |
| `grouping-aggregates/` | `withGrouping({ initial })`, `groupingConfig` | `aggregateFn` as a **column** option; per-subtree totals at every depth; a control that patches one row to a negative so `sumAmount` throws — only the affected groups' totals blank, per ADR-0014. |
| `grouping-async-rule/` | `withGrouping({ initial, schema })`, `applyGroupingAsync(rep)` | Pending holds the last explicit grouping; resolved replaces it outright; `onError` returning `false` = grouped by nothing. Real intercepted request, `forceFailure`/`latencyMs` args. |
| `grouping-order/` | `withGrouping({ initial, schema })`, `applyGroupOrder` ×3 | One comparator closure, five modes: `first-occurrence`, `by-label`, `by-count`, `external-list`, `throwing`. A third `applyGroupOrder` on `rep` — inert until `rep` is added as a level, which is the split from `applyGrouping`. |
| `grouping-columns/` | `withGrouping({ initial })` + `toggleColumnVisibility`/`reorderColumns` | `groupedColumnMode` as consumer code over the public column updaters: `keep` / `hide` / `move-to-front`, plus a readout naming which columns `hide` took away. |
| `grouping-collapsible/` | `withGrouping()` + `withExpansion()` | Chevron as a real `<button>` with `aria-expanded`, whole header row as hit area, three-level subtree collapse; Expand All through `groupIds()`; Collapse All; Refetch over a real request with `forceFailure`; Regroup re-nesting every id at once. |
| `grouping-selection/` | `withGrouping()` + `withSelection()` + `withFiltering()` | `cascade` as `self` \| `descendants` off one `rowsOf()` call; tri-state derived per render; a rep filter proving counts and `rowsOf()` are post-filter; a readout of group headers in the selection, always `0`; Ungroup leaving the selection untouched. |
| `grouping-keys/` *(uncommitted)* | `withGrouping({ initial: [{ key, label }], schema })`, `applyGroupKey(closedAt)` | Key extraction — twelve timestamps bucketed to five months, toggleable; the three-tier label resolution (explicit `initial` label → matching column's label → raw field name) in one table; a `territory` level naming a field no row carries. |

## 2. Re-derived marks

Legend: **→** is the change from the product doc's current mark.

### §1 — See the data grouped at all

| Story | Was | Now | Why |
|---|---|---|---|
| 1.1 boundaries | ✅ | ✅ | Every story. Ungroup half relocated `grouping-static/` → `grouping-selection/` (unchanged host). |
| 1.2 counts | ✅ | ✅ | Nested count → `grouping-basic/` (2 levels) and `grouping-collapsible/` (3). Post-filter → `grouping-selection/`. `showCount` survives on seven hosts. |
| 1.3 summaries | ✅ | ✅ **improved** | Relocated to `grouping-aggregates/`, which now carries the happy path *and* the ADR-0014 failure in one story. Previously the failure control sat in `grouping-static/`, a host advertised as copyable. |
| 1.4 know what it's grouped by | ✅ | **🟡** | Pills/order → `grouping-basic/`; `groupedColumnMode` → `grouping-columns/`. Both fine. **The failure criterion lost its demo**: "a saved grouping refers to a column that no longer exists" was `grouping-regressions/`'s *Group by a column that isn't there*. It returns with `grouping-keys/`'s `territory` toggle — **pending commit**. |

### §2 — Move around a grouped table

| Story | Was | Now | Why |
|---|---|---|---|
| 2.1 fold a group away | ✅ | ✅ | `grouping-collapsible/`, untouched. |
| 2.2 collapse/expand all | 🟡 | 🟡 | Unchanged — S4 ("is everything expanded") still does not exist, so neither button can label itself. |
| 2.3 open at a depth | ❌ | ❌ | Unchanged. S6 is a design gap. |
| 2.4 sticky headers | 🟡 | **❌** | **Regression.** `stickyHeaders` was a `grouping-static/` arg. No current host applies `grouping-story__table--sticky`; the CSS rule survives in `grouping-story.css:176-178` as dead code. Nothing on any canvas sticks. |
| 2.5 collapse survives change | ✅ | **🟡** | Refetch ✅ and Regroup ✅ remain. **The sort attack is gone** — `withSorting()` was removed from `grouping-collapsible/` and the claim moved to `feature.spec.ts`. The doc's own bar for ✅ is "demonstrable today in `src/stories/`", which a spec test is not. Deliberate (lesson audit D5), but it is a downgrade. |

### §3 — Control the grouping myself

| Story | Was | Now | Why |
|---|---|---|---|
| 3.1 change the grouping | ✅ | ✅ | `grouping-basic/` (group by / ungroup / reset) + `grouping-selection/`'s whole-grouping toggle for the selection-untouched criterion. |
| 3.2 multi-level, re-nest | ✅ | ✅ | `grouping-basic/`'s pills; `grouping-collapsible/` three deep with Regroup. The duplicate-level failure is now *prevented* rather than *harmless* — the button is a toggle, so the double-add is unreachable. Criterion reads "either prevented or harmless", so the mark holds. |
| 3.3 order the groups | ✅ | ✅ **improved** | `grouping-regressions/` → `grouping-order/`, its own story, with the inactive-level no-op added. |
| 3.4 order by size | ✅ | **🟡** | `by-count` still renders. **Criterion 2 lost its demo**: "the ordering reflects the filtered rows" was checkable because the old host composed a rep filter. `grouping-order/` composes `withGrouping()` alone. |

### §4 — When the data does not cooperate

| Story | Was | Now | Why |
|---|---|---|---|
| 4.1 blank values | 🟡 | 🟡 | Relocated cleanly to `grouping-when/`. Still 🟡 for the original reason — the library ships no default (S7). |
| 4.2 non-text keys | 🟡 | **✅** *pending commit* | This was 🟡 precisely because "no story declares `applyGroupKey`". `grouping-keys/` declares one, with a Date level bucketed to months and the label resolution beside it. Closes the mark the moment it lands. |
| 4.3 single-row group | ✅ | ✅ | South still renders as a group in `grouping-basic/`/`grouping-collapsible/`; the below-N escape hatch relocated to `grouping-when/`. |
| 4.4 saved grouping no longer fits | 🟡 | **❌** | The only demo was `grouping-regressions/`. Returns to 🟡 — not ✅; the "I can tell it happened" criterion stays story-local — with `grouping-keys/`. **Pending commit.** |

### §5 — Cross-feature

| Story | Was | Now | Why |
|---|---|---|---|
| X-G1 group checkbox | ✅ | ✅ | `grouping-selection/`. `cascade` trimmed from three modes to two (D7): `descendants+parents` took the identical code path as `descendants`, so flipping it changed nothing on screen. MUI X's both-directions behaviour is still explained on canvas and still *happens* — it is derived, not written. The doc's "all three peer defaults render" wording needs correcting to two modes plus the derived third. |
| S-G1 sorting the grouped column | ✅ | **❌** | **Regression.** The whole mark rested on `grouping-collapsible/` composing `withSorting()`. No grouping story composes sorting any more. |
| S-G2 sorting rows inside a group | 🟡 | **❌** | Same cause. The rows half was the half that worked. |
| F-G1 filtering a grouped table | 🟡 | 🟡 | Unchanged — `grouping-selection/` still the only host composing `withFiltering()`. |
| F-G2 / P-G1 / P-G2 / D-G1 | ❌ | ❌ | Unchanged, all forward-looking. |
| E-G1 groups + expandable rows | ✅ | ✅ | `grouping-collapsible/` still composes `withExpansion()` over a fixture carrying `children`. |
| G-2 add a row into a group | ✅ *(in `row-editing.md` §5)* | **❌** | **Regression.** `grouping-crud/`'s *Add row to group* was G-2's only demo. The story was removed (lesson audit D8) and the four facts moved to `feature.spec.ts`. **Correction (see §3d):** the claim that `row-editing.md` §5 "still claims the story exists" was wrong — it already marked G-2 ❌ *(forward-looking)* and never cited `grouping-crud/`. The dead claim was in `0-product/grouping.md` §5 itself, fixed there directly. |

### Tally

| | ✅ | 🟡 | ❌ |
|---|---|---|---|
| Doc claims today | 11 | 5 | 1 |
| Actual, on `main` | 8 | 5 | 4 |
| Actual, once `grouping-keys/` commits | 9 | 5 | 3 |
| After this migration (2026-09-20, `grouping-keys/` still uncommitted) | 9 | 6 | 2 |

§1–§4 after the migration: 1.1/1.2/1.3/2.1/3.1/3.2/3.3/3.4/4.3 ✅; 1.4/2.2/2.4/2.5/4.1/4.2 🟡;
2.3/4.4 ❌. `grouping-keys/` still stays out — it is written but uncommitted, so 4.2 stays 🟡 and
4.4 stays ❌ rather than the "once committed" row's 9/5/3. Cross-feature, tracked separately in §2
above (not part of this table's 17-item base), settles at X-G1/S-G1/S-G2/E-G1 ✅, F-G1 🟡,
F-G2/P-G1/P-G2/D-G1 ❌ — the sorting regression (S-G1, S-G2) fully closed by 3a, not merely
unchanged from "Doc claims today."

Cross-feature moved from `X-G1, S-G1, E-G1 ✅; S-G2, F-G1 🟡` (doc claims) through
`X-G1, E-G1 ✅; F-G1 🟡; S-G1, S-G2, F-G2, P-G1, P-G2, D-G1 ❌` (actual, on `main`, before this
migration) to `X-G1, S-G1, S-G2, E-G1 ✅; F-G1 🟡; F-G2, P-G1, P-G2, D-G1 ❌` (after this
migration) — S-G1 and S-G2 recovered by 3a, not left regressed. G-2's mark in `row-editing.md`
was never actually regressed; see 3d's correction above.

## 3. Plan — closing the four regressions

Ordered by cost. Each folds into an existing story; none needs a new folder.

### 3a. Restore sorting — one composition, three marks

> **Decided 2026-09-19: yes, into `grouping-order/`.** The row sort is the contrast that defines
> group order — without it the story cannot answer "isn't this just sorting?", which is the first
> question `applyGroupOrder` raises. Sorting's role here is the subject, not instrumentation,
> which is what separates it from the `withSorting()` removed from `grouping-collapsible/`.

| Product story covered | Covered by |
|---|---|
| S-G1 sorting the grouped column | **extend `grouping-order/`** — add `withSorting()` and a sortable Amount / Region header |
| S-G2 sorting rows inside a group | same |
| 3.3 criterion 4 (row sort does not disturb group order) | same |
| 2.5 criterion 2 (survives a sort) | **not this** — see below |

`grouping-order/` is the right host, not `grouping-collapsible/`. S-G1 and S-G2 are both about
*group order versus row sort* — which is `grouping-order/`'s own lesson, not a second one bolted
on. The product doc already says as much: S-G2's fix "wants that composition", naming
`withGrouping({ groupOrder })` + `withSorting()` specifically. It also makes 3.3's fourth
criterion demonstrable, which the doc currently defers to S-G2 to avoid counting twice.

This does **not** restore 2.5's sort attack — that one needs sorting beside `withExpansion()`,
which is the composition the lesson audit deliberately removed. Recommend leaving 2.5 at 🟡 with
a pointer to the spec test, and amending the doc's ✅ bar to say so, rather than re-adding
`withSorting()` to `grouping-collapsible/`.

> **Outcome, 2026-09-20 (grouping-coverage step 4, doc side step 5).** Shipped exactly as decided:
> `withSorting()` composes trailing in `grouping-order/`, bare (`multi` defaults `false`). S-G1
> lands ✅, but with the criterion-2 trade named explicitly rather than marked silently: under
> `first-occurrence` the click moves headers (criterion 2 never arises); under any comparator mode
> the header shows a sort indicator while the table does not change — the exact anti-pattern
> criterion 2 names — **and the story exhibits it on purpose**, because the user story's own verb
> is "I want to understand why nothing moved." This is not a reversal of D5: it is the same
> carve-out `3-lesson-audit.md:187-189` already made for `withFiltering()` staying on
> `grouping-selection/` — a feature stays composed only where it makes an otherwise-invisible
> outcome visible, and here *which thing moved* is the entire content of `applyGroupOrder`. S-G2
> and 3.3's fourth criterion land ✅ too, both via the same composition, exactly as planned. 2.5
> was left at 🟡 with a pointer to the spec assertion, as recommended.

### 3a-bis. Only `grouping-aggregates/` shows totals

> **Decided 2026-09-19.** `grouping-async-rule/`, `grouping-collapsible/` and
> `grouping-selection/` all switch to `plainGroupingConfig`. The rule is absolute: a group total
> appears on exactly one canvas, the story that owns `aggregateFn`.
>
> **Accepted cost:** F-G1's first criterion is "counts **and** summaries are computed over the
> rows that survived the filter", and `grouping-selection/` was the only host composing
> `withFiltering()`. The counts half still renders; the summaries half becomes an argument from
> `PIPELINE_ORDER` rather than something on screen. F-G1 stays 🟡 — it was already 🟡 for its
> third criterion — but it is now 🟡 on two counts, not one. Recorded here so the next coverage
> pass does not read it as an accident.

> **Outcome, 2026-09-20.** Shipped as decided: `grouping-async-rule/`, `grouping-collapsible/` and
> `grouping-selection/` all carry `plainGroupingConfig`; `grouping-aggregates/` is the only canvas
> with an `aggregateFn`. The accepted cost landed exactly as predicted — F-G1's summaries half left
> the canvas, and `0-product/grouping.md` §5's F-G1 entry (step 5) states both reasons rather than
> one.

### 3b. Restore sticky headers — one arg, one class

| Product story covered | Covered by |
|---|---|
| 2.4 sticky group headers | **extend `grouping-basic/`** — a `stickyHeaders` Storybook arg binding `grouping-story__table--sticky` |

> **Decided 2026-09-19: add the arg to `grouping-basic/`.** Sticky is a CSS recipe over
> `data-row-kind`, not a grouping API option, so it is the same category as `showCount` and adds
> no second lesson. §2.4 returns to 🟡; U5 (nested stacking) stays unmet either way.

The CSS already exists and is currently dead. Sticky headers are a CSS recipe over
`data-row-kind`, not a grouping API option, so this does not violate "one story, one lesson" —
it is a display property of the baseline grouped table, the same category as `showCount`.
2.4 returns to 🟡, not ✅; the nested-stacking criterion (U5) stays unmet either way.

Alternative, if you would rather not carry it: delete the dead CSS rule and move 2.4 to ❌
explicitly, with U5 absorbing the whole story. Cheaper, and honest — but it loses a demo that
costs two lines.

> **Outcome, 2026-09-20.** Shipped as decided, the carry-it option: `stickyHeaders` is a
> Storybook arg on `grouping-basic/`, binding `grouping-story__table--sticky`. §2.4 returns to
> 🟡 in `0-product/grouping.md` (step 5); U5's per-depth stacking gap is unchanged.

### 3c. Commit `grouping-keys/`

| Product story covered | Covered by |
|---|---|
| 4.2 non-text group keys | existing, uncommitted — `applyGroupKey` with a Date level |
| 4.4 saved level naming no column | existing, uncommitted — the `territory` toggle |
| 1.4 failure criterion | existing, uncommitted — same toggle |

No work beyond landing it. It is the single highest-value item here: three marks.

### 3d. Correct `row-editing.md` §5

| Product story covered | Covered by |
|---|---|
| G-2 adding a row into a group | **nothing on canvas** — mark ❌, point at `feature.spec.ts` |

Not a story to build. Whether G-2 deserves a row-editing story is that doc's call, not grouping's.

> **Correction, checked 2026-09-20 (grouping-coverage step 6).** This section's premise was wrong.
> `row-editing.md` §5 does **not** cite `grouping-crud/` and already marked G-2 ❌
> *(forward-looking)* before this migration — it needed no edit. The dead claim — a coverage
> assertion for G-2 against the deleted `grouping-crud/` folder, one sentence after crediting
> `row-editing.md` with owning the mark — was in `0-product/grouping.md` §5 itself, a
> self-contradiction in grouping's own doc. Fixed there directly (grouping-coverage step 5),
> deleting the sentence; `row-editing.md` was left untouched, as it should be.

### 3e. Criteria that cannot fail are tests, not stories

> **Decided 2026-09-19.** Three acceptance criteria are deleted from `0-product/grouping.md` and
> replaced by one spec assertion.

`PIPELINE_ORDER` is `['filter', 'group', 'sort', 'expand']`. Group clusters are built from rows
that have already been filtered, so three criteria in the product doc describe outcomes no data,
config or user action can make false:

| Criterion | Where | Why it cannot fail |
|---|---|---|
| "The ordering reflects the filtered rows" | §3.4 crit. 2 | Clustering runs on post-filter rows |
| "The ordering updates when the data does" | §3.4 crit. 3 | The whole chain is `computed()` over the rows signal |
| "A group with no surviving rows disappears rather than rendering empty" | F-G1 crit. 2 | An empty cluster is unrepresentable — nothing constructs one |

A story can only show these being true, which teaches a reader nothing about the API the story
exists to teach. They are in the doc because **AG Grid gets the first one wrong** —
`initialGroupOrderComparator` runs before filtering and aggregation — and §8.4 already records
that as a differentiator. A competitive claim is not a user story.

§3.4's own design status said so already: *"Ordering must run after clustering and filtering for
that to hold — worth a test, not a decision."* The coverage mark demanded an on-canvas demo
anyway. The design status was right.

**What is actually missing is the test.** Nothing pins ordering-after-filter, so the one genuine
risk — someone reordering `PIPELINE_ORDER` — is unguarded today. A story would never have caught
that edit; an assertion does, immediately.

> **Correction, checked 2026-09-20 (grouping-coverage step 6).** This section originally named
> `clusters.spec.ts` as the assertion's home. It landed in
> [`with-grouping/feature.spec.ts`](../../../../src/api/features/with-grouping/feature.spec.ts)
> instead: `clusterRows` takes `rows` as a parameter and has no filter stage of its own, so an
> assertion at that level would only restate `Array.prototype.filter`. The pipeline-order
> guarantee is a `withFiltering()` + `withGrouping()` composition fact, which is `feature.spec.ts`'s
> level, not `clusters.spec.ts`'s.

Resulting marks: §3.4 → ✅ on its one remaining criterion. F-G1's third criterion (collapse state
restored with the groups) is unaffected by this section. **Note (see 3a-bis):** F-G1 stays 🟡 for
two reasons overall once 3a-bis's aggregate-canvas consolidation is accounted for, not one — this
section's "not two reasons" referred only to the count within *this* decision (one criterion
deleted here, not two), not the story's final tally. Read 3a-bis for the second reason.

**Convention.** Before writing an acceptance criterion, ask what would have to change for it to
be false. If the answer is "an edit to the engine's own stage order" rather than "some data, or
something a person does", it is a regression guard, not a story requirement. Put it in the spec
and cite the competitor it differentiates against — do not spend a story's clarity demonstrating
an invariant.

> **Outcome, 2026-09-20.** Shipped as decided: all three criteria deleted from
> `0-product/grouping.md` (step 5), one assertion added (step 3, corrected home above). §3.4 reads
> ✅ on its single remaining criterion; F-G1's entry states both of its 🟡 reasons per 3a-bis.

## Left out on purpose

| Item | Why not a story |
|---|---|
| 2.3 initial expansion depth | S6 — no depth concept exists; `groupIds()` carries no level. Design gap, not a demo gap. |
| 2.2's self-labelling button | S4 — no "is everything expanded" signal to read. |
| 2.4's nested stacking | U5 — needs a per-depth offset, and collides with virtual scroll. |
| F-G2 filter by a group's summary | Deliberately out of scope; no aggregation capability to filter on (§9.1). |
| P-G1 / P-G2 | Pagination unbuilt; virtual scroll drafted. |
| D-G1 row drag-and-drop | No feature exists. |
| 2.5's sort attack | Moved to `feature.spec.ts` by decision (lesson audit D5). Re-adding `withSorting()` to `grouping-collapsible/` would reopen the lesson the audit closed. |

## Summary

All four decisions are recorded inline above. Resulting work, by story:

| Target story | Status | Standalone because |
|---|---|---|
| `grouping-basic/` | extend — `stickyHeaders` arg | — |
| `grouping-when/` | existing | — |
| `grouping-aggregates/` | existing — the one host showing totals | — |
| `grouping-async-rule/` | edit — `groupingConfig` → `plainGroupingConfig` | — |
| `grouping-order/` | extend — `withSorting()` | Group order vs. row sort is one question; S-G1/S-G2 belong to whichever host owns group order |
| `grouping-columns/` | existing | — |
| `grouping-collapsible/` | edit — `plainGroupingConfig`; deliberately no sorting | — |
| `grouping-selection/` | edit — `plainGroupingConfig` | — |
| `grouping-keys/` | commit it | — |

Plus, outside the stories: one `feature.spec.ts` assertion (§3e), three criteria deleted from
`0-product/grouping.md`, and the dead `grouping-crud/` claim removed from `0-product/grouping.md`
§5 itself — `row-editing.md` §5 needed no correction; see 3d.

Then rewrite `0-product/grouping.md`'s §0 table, every "Covered by" line, and the frontmatter
tally — that is lesson-audit §4b, and this document is its input.

**Convention this audit suggests recording.** A "one story, one lesson" split does not preserve
coverage for free: every cross-feature mark rests on a *composition*, and splitting stories by
API option is exactly the move that dissolves compositions. Two of the four regressions here
(S-G1, S-G2) came from removing one `withSorting()` call. When a story is trimmed, check which
cross-feature marks were resting on the thing being removed before removing it — not afterwards.
