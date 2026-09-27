---
title: Product — Grouping User Stories
type: product
capability: grouping
status: >
  Eight stories cover grouping: `grouping-basic/`, `grouping-when/`, `grouping-aggregates/`,
  `grouping-async-rule/`, `grouping-order/`, `grouping-columns/`, `grouping-collapsible/`,
  `grouping-selection/`. §1–§4: 9 ✅, 6 🟡, 2 ❌. Cross-feature: X-G1, S-G1, S-G2, E-G1 ✅;
  F-G1 🟡; F-G2, P-G1, P-G2, D-G1 ❌.
date: 2026-09-19
audience: product, design, engineering
---

# Grouping — user stories

What a person sitting in front of a grouped table needs to be able to do, and what they should
experience when the data does not cooperate. Engineering derives API from this document, not the
reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it — coverage marks here are updated from the product side as capabilities
> land.

> **This doc was written after the spec, not before it.** `1-state/work/grouping/archive/with-grouping/3-spec.md`
> is `status: ready` and carries 24 user stories — **22 of which begin "As a developer"**, the
> last two "As a maintainer". That is not a criticism of the spec; it is the correct voice for a
> spec. It does mean the person-in-front-of-the-table half had never been written down, which is
> what this document is. Where the two disagree, §8 says so explicitly rather than leaving it to
> be discovered at implementation time.

## Scope

**Grouping means: rows that share a value are gathered together, and the table shows me that.**
A person perceives four things, and does not care which layer produces them:

1. Rows that belong together are adjacent, with a visible boundary between one group and the next.
2. Each group announces what it is — the value, and how many rows are in it.
3. Each group can carry a summary of its own rows (a total, an average, a count).
4. Groups can nest, and I can change what nests inside what.

The codebase splits this across a `'group'` pipeline stage, a `'group'` render stage, an optional
`withExpansion()`, and `aggregate` declared through `withGrouping({ schema })`. That split is
invisible to the person using the table and is ignored here.

Two modes, genuinely different products:

| Mode | What the person sees |
|---|---|
| **Static** (`withGrouping()` alone) | Groups are visible boundaries with headers and summaries. Everything is always shown. There is no collapse affordance, because there is nothing to collapse into. |
| **Collapsible** (`withGrouping()` + `withExpansion()`) | Every group header is a control. A group can be folded away to its header line, and the table becomes a navigable outline rather than a long list. |

Where the two need different answers to the same need, they get separate stories rather than one
story that papers over the difference. **The static mode is not a degraded version of the
collapsible one** — a 40-row grouped report that is always fully visible is a legitimate product,
and §7 records the finance case where auto-expanded is what users actually want.

## Coverage marks

| Mark | Meaning |
|---|---|
| ✅ **covered** | Demonstrable today in `src/stories/` or a demo app, with the failure path included |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not — no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

Eight stories exist, all read as host components rather than `.mdx` wrappers. `grouping-basic/`
is the one to copy — plain grouping API usage; admission, aggregation, ordering and column
disposition each get their own story rather than crowding onto the baseline one:

| Story | Composes | What it demonstrates |
|---|---|---|
| [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) | `withGrouping({ initial })` alone — no second feature, no schema, no predicate | Headers carrying value and count at every depth; a tab strip that toggles a column as a level and pills that reorder and remove them; `stickyHeaders` |
| [`grouping-when/`](../../src/stories/grouping/grouping-when/) | `withGrouping({ initial, when })` + a per-column `grouping({ when })` | Group **admission** — a table-wide `when` AND-combined with a per-column one; a toggle that keeps blank-region rows flat instead of clustering them; an editable minimum-size threshold on `category`; a rejected cluster's rows staying flat at the parent's depth |
| [`grouping-aggregates/`](../../src/stories/grouping/grouping-aggregates/) | `withGrouping({ initial, schema })` declaring `aggregate(path.amount, sumAmount)` | The only canvas showing group totals: `amount` summed at every depth; a control that patches one row to a negative so `sumAmount` throws, and only the affected groups' totals go blank, per ADR-0014 |
| [`grouping-async-rule/`](../../src/stories/grouping/grouping-async-rule/) | `withGrouping()` with a `groupingAsync()`-shaped rule | A grouping level decided by the server over a real intercepted request: the pending window holding the last explicit grouping, the resolved set replacing it outright, and `onError` resolving to `[]` — grouped by nothing, distinct from abstaining |
| [`grouping-order/`](../../src/stories/grouping/grouping-order/) | `withGrouping()` with a `groupOrder` comparator, composed with `withSorting()` | Deliberate misuse, not example code: `groupOrder` across five modes including a throwing comparator and a level naming no column; a sortable header that contrasts group order against row sort — headers move under `first-occurrence`, hold under every comparator mode |
| [`grouping-columns/`](../../src/stories/grouping/grouping-columns/) | `withGrouping()` + `table.columns()` | `groupedColumnMode` as a consumer `computed()` over the columns and levels, rendering all three peer dispositions — `keep` / `hide` / `move-to-front` — without writing to `table.columns()` |
| [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) | `withGrouping()` + `withExpansion()` | A real `<button>` chevron with `aria-expanded`, the whole header row as hit area, subtree collapse, and two attacks on the collapse state — Refetch with freshly-constructed rows and a Regroup that changes every id at once. A deal carrying `children` renders a second, separately-keyed chevron from the `'tree'` stage |
| [`grouping-selection/`](../../src/stories/grouping/grouping-selection/) | `withGrouping()` + `withSelection()` + `withFiltering()` | Two peer cascade defaults off one `rowsOf()` call, plus the third derived rather than written; tri-state group checkboxes derived, never stored; a readout that counts rows and a second one proving no group header is ever in the selection; Ungroup leaving the selection untouched |

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
resulting gap into state, UI, or both, because that difference decides who does the work — and §9
collects the ones that belong to no existing feature at all.

Where a competitor's behavior is cited, it comes from
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md)
or
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).
Neither is restated here beyond what a story needs.

---

# 1. See the data grouped at all

Ordered by how badly the person is hurt if it is missing.

## 1.1 — See my rows gathered into groups, with a visible boundary — ✅ covered

> As someone looking at four hundred orders across a dozen regions, I want the orders for one
> region together under a heading that names it, so I can read the list a region at a time instead
> of scanning for where one region stops and the next begins.

**Acceptance criteria**

- Rows sharing the grouped value are contiguous, and a header line marks where each group starts.
- The header states the value plainly — "North East", not the raw field name, not an id.
- Adding grouping to a table does not change which rows are present, only their order and the
  headers between them. Nothing is filtered out as a side effect.
- Removing grouping returns the table to exactly what it showed before.

**Failure behavior**

- If every row has the same value in the grouped column, I get one group containing everything,
  not an error and not an unhelpful ungrouped table with a stray header.
- If the grouped column has hundreds of distinct values, the table still renders — I may not like
  the result, but it does not hang. See §6, P-G2.

**Mode note.** Identical in both modes. This is the story that makes grouping worth composing at
all.

**Covered by:** every story. Headers carry the value plainly ("North East", not the field
name), rows beneath them are contiguous, and `data-row-kind` / `data-depth` mark the boundary at
every level. [`grouping-selection/`](../../src/stories/grouping/grouping-selection/)'s Ungroup
returns the table to a plain list with nothing else changed, which is the removal half. Both failure
paths are reachable in the fixture: the South region holds one row and still renders as a group, and
grouping by Owner or Closed — near-unique columns — renders rather than hanging.

**Design status:** covered by D3/D9 and the `'group'` render stage design. No gap.

## 1.2 — See how many rows are in each group — ✅ covered

> As someone scanning a grouped list of open tickets, I want each group heading to tell me how
> many tickets are in it, so I can tell at a glance where the volume is without expanding
> anything.

**Acceptance criteria**

- The group header shows a count of its own rows, next to the value.
- Under an active filter, the count is the number of rows **I can see**, not the number that exist
  in the underlying data. A count I cannot reconcile against the rows below it is worse than no
  count.
- For a nested group, the count is of leaf rows in that whole subtree, not of immediate child
  groups — "Europe (240)", not "Europe (6)" when it holds six countries.

**Failure behavior**

- If the count cannot be computed for some reason, the header renders without it rather than
  showing `NaN`, `undefined`, or a stale number from a previous render.

**Covered by:** every story — the count is `rowsOf(row).length`, which is derived from the
pipeline's rows and so is post-filter and collapse-independent by construction. Type in "rep
contains" in [`grouping-selection/`](../../src/stories/grouping/grouping-selection/), the one story
that composes `withFiltering()`, and every count follows the visible rows;
[`grouping-basic/`](../../src/stories/grouping/grouping-basic/) shows the nested count itself two
levels deep and [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) three —
the whole subtree's leaves, not the child-group count.
[`grouping-basic/`](../../src/stories/grouping/grouping-basic/) carries the hide-the-count switch
every peer that renders a count also ships (P6), default on. The "cannot be computed" failure is
unreachable rather than undemonstrated — `rowsOf()` returns an array or nothing at all.

**Design status:** covered — the count is `rowsOf(group).length` (D16), needing no new state; it
exists whether or not the grouping declares an `aggregate` for any column. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).

## 1.3 — See a summary for each group — ✅ covered

> As someone reviewing sales by region, I want each region's heading to carry that region's total,
> so the number I actually came for is on screen without expanding the group and adding it up
> myself.

**Acceptance criteria**

- A column can carry a per-group summary value, shown on the group header row.
- The summary is computed over that group's own rows, at every depth — a region's total is correct
  whether or not it is subdivided by country.
- The summary reflects the **filtered** rows. If a filter hides half the group, the total does not
  silently include what I cannot see.
- A column with no summary defined shows nothing in that position, not a blank-looking zero.

**Failure behavior**

- If the summary calculation throws on one group's rows, that group shows no summary and the rest
  of the table is unaffected. One bad group does not blank every total on screen.
- A summary that cannot be computed is visibly absent, not shown as `0` — a wrong number is worse
  than a missing one, because a wrong number gets used.

**Covered by:** [`grouping-aggregates/`](../../src/stories/grouping/grouping-aggregates/) — the
only canvas that declares an `aggregate`, carrying both the happy path and the failure.
`amount` gets `aggregate(path.amount, sumAmount)` through `withGrouping({ schema })` and its
total renders on the header row at every depth, so a region's total is the sum of its subtree;
every column with no declared aggregate renders an empty cell rather than a zero. *Break one
group's summary* demonstrates the stated failure behavior: a throwing `aggregateFn` leaves only
the affected group's total empty. No story on this canvas composes `withFiltering()`, so the
third criterion — the summary reflecting filtered rows — is an argument from `PIPELINE_ORDER`
(`filter` precedes `group`), not something on screen; see F-G1.

**Design status:** covered — D9 fixes aggregates to leaf rows at every depth; per-group aggregation
failure falls back per ADR-0014 ([#45](https://github.com/DvirMon/ng-table/issues/45)), reported once
per column per evaluation. `aggregateFn` receives whole rows, not just the one column's values. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).

## 1.4 — Know what the table is grouped by — 🟡 partly covered *(the failure half lost its demo)*

> As someone who opened a report someone else configured, I want to see what it is grouped by,
> in what order, without reading the code or guessing from the shape of the data.

**Acceptance criteria**

- The active grouping is visible somewhere persistent — not inferable only from the headers.
- When grouping is nested, the order is visible: region *then* category, not just "both".
- The column I grouped by does not silently disappear from the table, and does not silently
  appear twice.

**Failure behavior**

- If a saved grouping refers to a column that no longer exists, I see the grouping that *could*
  be applied, not an error and not a blank table (D14 handles the state; this story is about
  whether I am told).

**Covered by:** [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) — the active
levels render as pills, in order, each with ◀ ▶ to re-rank it and × to drop it, so nesting order is
visible rather than inferred from the headers. [`grouping-columns/`](../../src/stories/grouping/grouping-columns/)'s
`groupedColumnMode` renders all three peer dispositions as a control rather than picking one:
`keep` / `hide` / `move-to-front` (U2, P12). The library ships no default for any of this; both
stories are recipes, not shipped controls.

**Why it is 🟡:** the failure half — a saved level naming a column that no longer exists — has no
current demo. Its former demo, *Group by a column that isn't there*, lived on a story that has
since been deleted; it returns with [`grouping-keys/`](../../src/stories/grouping/grouping-keys/)'s
`territory` toggle, which is written but uncommitted (see 4.4). Until then this story cannot show
whether I am told, only that the state degrades correctly underneath.

**Design status — gap.** State (`grouping: string[]`) is readable; what happens to the grouped
column on screen is undecided. See [`3-ui/directives/grouping.md`](../3-ui/directives/grouping.md).

---

# 2. Move around a grouped table

## 2.1 — Fold away a group I do not care about — ✅ covered *(collapsible mode)*

> As someone working through a grouped list, I want to collapse the groups I have finished with,
> so the ones I have not finished with fit on one screen.

**Acceptance criteria**

- Every group header carries a control that folds and unfolds that group.
- **The whole header row is the target, not only the chevron.** A person aiming at a 12px arrow
  when the entire line reads as clickable is a papercut every single time.
- Collapsing a parent hides its child groups as well as its leaf rows — one action, the whole
  subtree.
- The control shows which state it is in, and that state is announced.
- Nothing above the collapsed group moves. My scroll position stays anchored to what I was
  reading.

**Failure behavior**

- Collapsing a group never changes what is selected, what is being edited, or what is in the
  underlying data — it is a view operation and nothing else.

**Mode note.** Static mode has no equivalent and needs none. What it must not do is render a
control that does nothing.

**Covered by:** [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/). The
chevron is a real `<button>` carrying `aria-expanded`, so both Enter and Space work; the whole
header row is the hit area — the chevron carries no click handler of its own, its activation
bubbles to the row's one listener, so there is no double-fire to suppress. Collapsing a parent takes
its whole subtree, three levels deep. *Not demonstrated:* that collapsing changes nothing selected —
no story composes `withExpansion()` with `withSelection()`. Collapse leaving the underlying data
alone is demonstrated, through Refetch.

**Design status:** covered. [ADR-0017](../adr/0017-engine-owned-descendant-prune.md) (#98) moved
descendant hiding into an engine-owned `'prune'` render stage; `withGrouping()` no longer walks
subtrees itself and no longer reads `expandedRows` at all, so it composes with expansion in any
argument order. Gap: click-target size is a UI-layer decision, not yet in
[`3-ui/directives/grouping.md`](../3-ui/directives/grouping.md).

## 2.2 — Collapse or expand everything in one action — 🟡 partly covered *(collapsible mode; the verb landed, the state signal did not)*

> As someone opening a report grouped three levels deep, I want one control that folds the whole
> thing to its top level, so I can choose where to go instead of scrolling past everything.

**Acceptance criteria**

- One control collapses every group; one expands every group. Reaching them costs one action, not
  a loop over groups I have to write myself.
- The control reflects the current state — if everything is already expanded, it offers Collapse
  All, and it knows which to offer.
- On a large table the operation is perceptibly immediate, or it tells me it is working.

**Failure behavior**

- Expand All on a table large enough to hurt either stays responsive or refuses with a reason. It
  does not freeze the tab. (See §6, P-G2 and `0-product/performance.md`.)

**Covered by:** [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) — both
buttons exist and both are one call. `collapseAll()` empties `expandedRows`, needing no knowledge of
what a group is. `expandAll()` takes explicit ids and `withGrouping()` publishes them, so the story
writes `table.expandAll(table.groupIds())` — the consumer loop this section used to describe is
gone (#97). The first criterion is met.

**Why it is 🟡:** the second criterion — the control reflects the current state and knows which to
offer — is unmet. There is still no "is everything expanded" signal (S4), so neither button can
render its own label.

**Design status — gap narrowed.** The verb and group discovery shipped (`groupIds()`, #97).
`3-spec.md` scopes out the UI; the state half that remains is S4 alone — the button cannot label
itself without it.
See [`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).
Raised as **OQ-3**.

## 2.3 — Open the table already at the depth I want — ❌ not covered *(collapsible mode; blocked on S6)*

> As someone who always works region-by-region, I want the report to open showing regions
> collapsed, not two thousand rows I then have to fold up myself.

**Acceptance criteria**

- The initial expanded state is configurable: all collapsed, all expanded, or expanded to a
  depth.
- Expanding to depth 2 of a 4-level grouping shows levels 1 and 2 open and everything below shut.
- The initial state applies on first paint. The table does not render fully expanded and then
  visibly collapse.

**Covered by:** nothing. [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/)
opens fully collapsed, but that is `withExpansion()`'s default rather than a configured depth —
there is no `groupDefaultExpanded` equivalent to render a control for. Of the three acceptance
criteria only "all collapsed" happens to hold, by accident of the default.

**Design status — gap, no longer blocked.** `groupIds()` (#97) removed the discovery blocker: a
consumer can already expand an arbitrary set of groups. What is missing is a *depth* concept — the
ids carry no level — and any decision about initial expansion state. S6 is now a design gap, not a
mechanism gap.

## 2.4 — Keep my place while scrolling a long group — 🟡 partly covered *(sticks, but nested paths overlap)*

> As someone scrolling through two hundred rows inside one region, I want to still be able to see
> which region I am in, because by row sixty the heading is long gone and every row looks the
> same.

**Acceptance criteria**

- The group header stays visible while any of its rows are on screen.
- With nested groups, the visible headers describe the full path — region *and* country — not just
  the innermost one.
- The stuck header hands off to the next group's header as I scroll past the boundary, without
  overlapping it or flickering.

**Covered by:** [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) — `stickyHeaders`
is an opt-in arg, and it is one CSS class keyed off `data-row-kind`. Turn it on and a group header
stays visible while its rows are.

**Why it is 🟡:** every depth sticks to `top: 0`. With nested groups the inner header lands on the
outer one instead of stacking beneath it, so the second and third criteria — the full path, and a
clean hand-off — are not met. Making them work needs a per-depth offset the story does not attempt,
and it collides with virtual scroll.

**Design status — gap.** Sticky headers work as pure CSS; nested paths need a per-depth offset, not
built. AG Grid is the only surveyed library shipping the stacked version. See
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).
Raised as **OQ-3**.

## 2.5 — Not have my expand/collapse thrown away — 🟡 partly covered *(collapsible mode; the sort attack moved to a spec)*

> As someone who has folded a report down to the three groups I care about, I do not want a
> background refresh, a sort, or my own edit to fling the whole thing open again.

**Acceptance criteria**

- Expand/collapse state survives new data arriving, provided the group still exists.
- It survives a sort change, a filter change, and a change to another feature's state.
- When the grouping itself changes, the old expansion state is discarded honestly and completely
  — the table does not come back half-restored.
- A group that disappears and later returns comes back in the state I left it in, or plainly
  collapsed. It does not come back looking expanded while showing nothing.

**Failure behavior**

- If state cannot be preserved across a change, everything collapses consistently. A mixed result
  — some groups restored, some not, with no way to tell which — is the worst outcome and the one
  libraries actually ship.

**Covered by:** [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) —
attacked from two directions on canvas. **Refetch** replaces every row with a freshly-constructed
object and reports how many, so "the collapse state did not move" is read against rows that are
provably not the same objects. **Regroup** re-nests Region → Category → Rep as Category → Region →
Rep, so every `group:>col:type:value` id changes at once and the state is discarded wholesale —
this story's third criterion. The `forceFailure` arg is the failure path: the request errors,
nothing is replaced, and the outline stays exactly where it was.

**Why it is 🟡:** the second criterion's sort half — expand/collapse surviving a sort change — is
no longer demonstrated on canvas. `withSorting()` was removed from
[`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) (composing sorting
beside expansion was the composition the lesson audit deliberately closed); the claim now lives as
`'a sort change leaves expandedRows untouched'` in
[`with-grouping/feature.spec.ts`](../../src/api/features/with-grouping/feature.spec.ts). The
doc's own ✅ bar is "demonstrable today in `src/stories/`", which a spec test does not meet —
deliberate, not an oversight.

**Design status — gap, high-value.** `expandedRows`' synthetic group ids survive a refetch (never
pruned, ADR-0006); stability across a regroup is undecided. Full citations:
[`research-refetch-state-loss.md`](../1-state/work/grouping/archive/grouping-expansion-coupling/research-refetch-state-loss.md).
Raised as **OQ-4**.

---

# 3. Control the grouping myself

## 3.1 — Change what the table is grouped by — ✅ covered

> As someone looking at a list grouped by region, I want to switch it to group by status instead,
> from the table, without someone shipping me a new report.

**Acceptance criteria**

- Changing the grouping is one action and takes effect immediately.
- Turning grouping off entirely is equally cheap, and returns the table to a plain list.
- My scroll position and my selection are not silently destroyed by the change.
- If I had a choice active and something else changes the grouping under me, I can tell that it
  happened.

**Failure behavior**

- If the new grouping produces one group per row (a near-unique column), I get that result rather
  than a hang — and ideally I can see that is what happened and undo it.

**Covered by:** [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) — a tab strip
toggles any column as the last grouping level, on or off, and *Reset levels* returns to the
declared set. [`grouping-selection/`](../../src/stories/grouping/grouping-selection/) gives the
whole-grouping toggle and is where the third criterion is checkable — Ungroup leaves the selection
completely untouched, because no group header id was ever in it. Failure: grouping by Owner or
Closed produces near-one-group-per-row, and the table renders it.

**Design status:** state side covered by D1's four updater factories (set, add, remove, reorder a
level); the affordance is `grouping-basic/`'s controls — a recipe, not a shipped control.
`3-ui/directives/grouping.md:29`'s rejection of a header directive predates D3's multi-level array
and warrants revisiting. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).

## 3.2 — Group by more than one thing, and change what nests inside what — ✅ covered

> As someone reading a sales report, I want region at the top level and category inside it — and
> when that is the wrong way round for the question I am asking, I want to flip it without
> rebuilding the report.

**Acceptance criteria**

- Several grouping levels can be active at once, in an order I can see.
- The nesting order is changeable, and changing it re-nests the data rather than requiring me to
  start over.
- Removing a middle level leaves the levels around it intact and correctly nested.
- Each level's summaries stay correct when the order changes — a region total is a region total
  regardless of what it is subdivided by.

**Failure behavior**

- Grouping by the same column twice is either prevented or harmless. It never produces a level
  containing exactly one child group repeated forever.

**Covered by:** [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) — the level pills
are the visible order, ◀ ▶ re-nest through `reorderGroupLevels` and the data re-nests rather than
resetting, and × removes a level including a middle one with the levels either side left correctly
nested. [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) runs three
levels deep and its Regroup swaps the outer two. Summaries staying correct across a re-nesting
(D9's leaf-rows-at-every-depth aggregation) is no longer on either canvas — neither declares an
`aggregate` — and is argued rather than demonstrated; see 1.3. Failure: re-toggling a column
that is already a level in [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) is a
no-op — `addGroupLevel` refuses the duplicate.

**Design status:** covered by D3, D9, and `reorderGroupLevels`. The ordered array avoids the
reorder-instability bug class seen elsewhere (AG Grid
[#14635](https://github.com/ag-grid/ag-grid/issues/14635)). Worth a test rather than a decision.

## 3.3 — Decide the order the groups themselves appear in — ✅ covered

> As someone whose product categories have a meaningful order that is not alphabetical, I want the
> groups to appear in *my* order — the one I arranged in the settings dialog — not sorted by
> whatever the group happens to be called.

**Acceptance criteria**

- Group order is controllable independently of how rows sort inside a group.
- An externally-defined order (a list a person arranged elsewhere) can drive it.
- A group whose value is not in that external list still appears, in a defined place, rather than
  vanishing.
- Changing the row sort does not disturb the group order, and vice versa.

**Failure behavior**

- If the ordering logic fails, groups appear in a stable, predictable order — the order they
  occur in the data — rather than randomly or not at all.

**Covered by:** [`grouping-order/`](../../src/stories/grouping/grouping-order/) —
`groupOrder` renders as five modes through **one** comparator closure reading a signal, never a
comparator per mode: `first-occurrence` (the default, and a constant `0` that a stable sort leaves
alone), `by-label`, `by-count`, and `external-list` — a caller-supplied ranking, which is the third
criterion's "order a person arranged elsewhere", with values absent from the list sorting last
rather than vanishing. Failure: the `throwing` mode makes the comparator throw on every sibling pair;
the table stays up, `sortClusters` falls back to stable first-occurrence order and reports once per
evaluation (D15) via `console.error`; the story's amber notice stands in for the missing affordance.
The fourth criterion — changing the row sort does not disturb the group order, and vice versa — is
now demonstrable directly: the story composes `withSorting()`, and under any comparator mode but
`first-occurrence` a header click reorders rows inside a group while the headers hold (see S-G2).

**Design status:** covered — D4's `groupOrder` compares `GroupSummary` objects that carry their
rows; D5 decouples group order from row sort; D15 names the first-occurrence fallback. `groupOrder`
is developer config, not an end-user control — no surveyed library lets an end user place group
instances by hand. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).

## 3.4 — Order groups by how big they are — ✅ covered

> As someone triaging tickets grouped by assignee, I want the biggest queues at the top, because
> that is the whole reason I grouped them.

**Acceptance criteria**

- Groups can be ordered by a property of their contents — row count, or a summary value — not only
  by their label.

**Covered by:** [`grouping-order/`](../../src/stories/grouping/grouping-order/)'s `by-count` mode
— sibling groups re-rank by their own `rows.length`, not their label. `GroupSummary` carrying its
own `rows` is what makes both count-based and aggregate-based ordering fall out.

**Design status:** covered, and pinned by a regression test rather than a canvas demo. Two other
acceptance criteria this story used to carry — that the ordering reflects the filtered rows, and
that it updates when the data does — describe outcomes no data, config or user action can make
false: clustering always runs on post-filter rows, and the whole chain is `computed()` over the
rows signal. AG Grid's `initialGroupOrderComparator` runs before filtering and aggregation and
gets the first one wrong; that competitive fact is what put the criteria here in the first place.
`'filter -> group pipeline order: cluster order ranks by post-filter size, not raw size'` in
[`with-grouping/feature.spec.ts`](../../src/api/features/with-grouping/feature.spec.ts) pins the
invariant a story could never have caught — someone reordering `PIPELINE_ORDER`.

---

# 4. When the data does not cooperate

The group *key* is where grouping actually fails in production. Every library assumes the grouped
value is a primitive that stringifies usefully; real data is not.

## 4.1 — Rows with nothing in the grouped column — 🟡 partly covered *(admission ships; the default is still undecided — S7)*

> As someone grouping by department in a table where three people have not been assigned one, I
> want those three in a group I can see and collapse like any other, not scattered loose or
> silently dropped.

**Acceptance criteria**

- Rows with a missing value form a group, with a label a person can read.
- That group behaves like every other: it collapses, it counts, it summarises, it orders.
- Its position is predictable and stable — always first or always last, not wherever it lands.
- No row disappears because its grouped value was empty. Every row is in exactly one group.

**Failure behavior**

- `null`, `undefined`, and `""` are either the same group or clearly different groups. They are
  never three groups that all render with an empty label and cannot be told apart.

**Covered by:** [`grouping-when/`](../../src/stories/grouping/grouping-when/), through **group
admission** rather than a blank-group label. The fixture holds all three blank keys: a `null`
region, a row with no `region` at all, and an `''` region. `withGrouping({ when })` takes a
cluster-level predicate, and a rejected cluster's rows **stay flat** instead of forming a group —
the story's `keepBlankRegionsFlat` toggle is exactly that, AND-combined with a per-column `when` on
`category` that rejects clusters below a row-count threshold. Both halves are reactive: the
predicates read signals, so toggling rebuilds nothing.

**Why it is 🟡:** the acceptance criteria ask for blank rows to form *a group with a readable
label*, and that is the one answer not available. With the toggle off they cluster as **three
separate unlabelled groups** a person cannot tell apart; with it on they stay flat, ungrouped. No
row is lost either way, and the mechanism is sound — but the library still ships no default, and
"one group, labelled, in a fixed position" is unrepresentable without the consumer writing it.

**Design status — gap, highest bug-report risk.** D14 covers an unknown column id, not a missing
value — a different thing. Group admission (`when`/`enable`, ADR-0018) gives the consumer the
lever; no decision picks the library's own answer for missing/empty group values. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).
Raised as **OQ-5**.

## 4.2 — A grouped column whose values are not text — 🟡 partly covered *(`groupKey` owns extraction; no story declares one)*

> As someone grouping by assignee where each assignee is an object with a name and an id, I want
> to see the names.

**Acceptance criteria**

- A group's label is derived through the same path a cell's display value is, so a column that
  renders a name in its cells shows that name in its group header.
- Two rows referencing the same entity land in the same group, even if they are not the same
  object.
- Dates, booleans and numbers group and label sensibly without per-column configuration.

**Failure behavior**

- A value with no sensible text form produces a stated fallback label, never `[object Object]`.

**Covered by:** the mechanism, not a story. **Grouping does not read a column's `accessor`** — D7
settled that a grouping level names a *row field*, read by bracket access
(`engine/grouping/clusters.ts`, `readGroupFieldValue`). `groupKey` is the supported path for
bucketing: `groupKey(path.owner, (o) => o.name)` fixes the group key, and an `initial` entry's
own `label` fixes the header, resolving explicit → a column whose id matches the field → the raw
field name (D7a, D9). `Date` and number levels need neither — `toGroupKey` tags the key with its
`typeof`, so `1` and `"1"` do not collide.

**Why it is 🟡:** no story declares `groupKey` for an object-valued level. The shared
fixture's `owner` column carries an `accessor` for its *cells* only, so grouping by Owner today
lands every row in one `object:[object Object]` bucket — the criterion's stated failure,
happening, unreported under ADR-0014. The contract exists and is unit-tested
(`with-grouping/schema.spec.ts`); the person's experience of it does not.

**Design status — gap narrowed.** `groupKey` + `initial`'s `label` (D7a, D9) answer the label
and bucketing halves. What remains: nothing detects an object key that survived without an
`groupKey`, so the merge is silent. See [#80](https://github.com/DvirMon/ng-table/issues/80).
Raised as **OQ-5** with 4.1 — one decision.

## 4.3 — A group with exactly one row in it — ✅ covered *(stated 2026-09-19 — OQ-6)*

> As someone with a list where half the categories have a single item, I do not want to click
> twice to see one row.

**Acceptance criteria**

- Whatever happens to single-row groups is consistent and stated: they either always render as a
  group, or always collapse into their row.
- If they render as groups, they do not cost more interaction than the row is worth.

**Covered by:** [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) and
[`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) for the default —
the South region holds exactly one deal and renders as an ordinary group at every level, counting
and ordering like any other. [`grouping-when/`](../../src/stories/grouping/grouping-when/)'s
per-column row-count threshold on `category` is the escape hatch for the second criterion: a
consumer who *does* want single-row (or below-N-row) groups to skip the extra click rejects them
at admission and they render flat instead.

**Stated answer:** always a group, unless a `when`/`enable` admission predicate says otherwise
(ADR-0018, #86/#87). No size threshold applies by default — `buildClusters` builds one cluster per
distinct value regardless of size, and admission is what a consumer bolts on to change that. This is
the deliberate policy, not an accident of construction.

**Design status:** covered — admission (`when`/`enable`) shipped 2026-09-19, closing the mechanism
question. Whether the extra click is bad enough in practice to justify a library-shipped default
(vs. requiring an explicit `when`) is a separate UX question, not blocking this story — see OQ-6.

## 4.4 — A saved grouping that no longer fits the table — ❌ not covered *(the story that demonstrated it was deleted)*

> As someone returning to a saved view after the report changed, I want to see the data, grouped by
> as much of my saved arrangement as still applies — not an error, and not a blank page.

**Acceptance criteria**

- A saved level naming a column that no longer exists degrades; the remaining levels apply.
- The table renders. Losing a grouping level is never a reason to show nothing.
- I can tell that something happened, rather than quietly getting a different report than the
  one I saved.

**Covered by:** nothing on canvas today. Its former demo, *Group by a column that isn't there* —
adding a level naming no column — lived on a story that has since been deleted. It returns, at
🟡 not ✅, with [`grouping-keys/`](../../src/stories/grouping/grouping-keys/)'s `territory`
toggle, which is written but uncommitted (see 1.4).

**Underlying mechanism (unaffected by the demo's removal):** the engine **does not drop** the
level. An unknown level names a row field no row carries, so every row reads `undefined` for it
and lands in one **phantom cluster per parent** — never a throw, never a dropped row (D7,
asserted in `with-grouping/feature.spec.ts`). So the first criterion is not met as written, and
the third needs a story computing it itself, diffing `grouping()` against the known column ids and
rendering its own notice — the library has no channel to report a degraded level.

**Design status — gap.** The degradation is defined and tested (phantom cluster, not a drop), but
nothing tells the person. Whether "one uninformative cluster" or "drop the level" is the right
product answer is undecided — the doc previously assumed the drop, which is not what ships.

---

# 5. Cross-feature interactions

Grouping collides with nearly everything — interaction bugs are the majority of the community
corpus here. See
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to grouping. That is this repo's existing convention (`row-editing.md` §5)
and it is why two grouping stories already live in the row-editing doc.

## Owned by row editing *(unbuilt — both G-1 and G-2 are ❌ in `row-editing.md`)*

**G-1 and G-2** exist at [`row-editing.md`](row-editing.md) §5 — G-1, a row moving to another group
when its grouped value is edited; G-2, adding a row into a specific group. They are **linked, not
restated**; that file owns their coverage marks. When an
edited row re-groups is unresolved industry-wide (ag-grid
[#1672](https://github.com/ag-grid/ag-grid/issues/1672)); the state side already flagged the
insertion half (`with-mutations/2-decisions.md:331-343`). Raised as **OQ-8**.

## Owned by selection *(built)*

### X-G1 — Ticking a group's checkbox — ✅ covered *(as the consumer recipe D16 calls for)*

> As someone selecting everything in a region so I can act on it in bulk, I want to tick the
> region's checkbox once, and I want to know exactly what I just selected.

**Acceptance criteria**

- What a group checkbox does is stated, consistent, and the same everywhere in the app.
- When a filter is active and I tick a collapsed group, what I select matches what the group's
  count says — I never select rows I cannot see and was never told about.
- A partly-selected group is visibly partly selected.
- The selection count I am shown counts rows, never group headers.

**Failure behavior**

- Ungrouping, or regrouping by something else, never leaves phantom entries in my selection that
  correspond to groups that no longer exist.

**Covered by:** [`grouping-selection/`](../../src/stories/grouping/grouping-selection/) — the
reference wiring D16 said the directive layer should eventually ship as its default, standing in
until that layer exists. All four criteria render:

- **Stated and consistent.** The `cascade` arg renders two peer defaults off **one** `rowsOf()`
  call, each with its own on-canvas explanation: `self` (AG Grid) writes nothing, because there is
  no group node to write — a group is a view, not a record (§6) — so the box stays a read-only
  tri-state readout; `descendants` (TanStack) is one `select(rowsOf(group).map(trackBy))`. MUI X's
  third default, `descendants+parents`, is not a separate mode: propagating upward costs no extra
  code once ancestor state is derived rather than stored, so it happens automatically under
  `descendants` — the two written modes and the third, derived one together cover all three peer
  defaults.
- **Filtered and collapsed groups select what their count says.** `rowsOf()` is re-derived from
  `table.rows()`, not scanned out of `renderRows()`, so it is post-filter by construction and
  collapse-independent.
- **Partly selected is visibly partly selected,** derived from `selectionStateOf(rowsOf(group))`
  every render.
- **The count counts rows.** A second readout renders the number of group headers in the selection,
  which is always `0`.

Failure: Ungroup, and the selection survives untouched. Nothing prunes because no header id was ever
there to dangle.

**What this mark does not claim.** The cascade is consumer-owned by D16, so the story proves a
recipe, not a library guarantee.

**Design status:** the library ships no cascade semantics (D16) — three majors ship three mutually
incompatible defaults, no majority to inherit. `table.rowsOf(group)` (issue #31) hands back the
group's member rows; the consumer builds whatever cascade it wants
(`select(rowsOf(group).map(r => r.id))`), the same flat pattern `withSelection()` already uses (D1).
See [`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).

## Owned by sorting *(built)*

### S-G1 — Sorting by the column I grouped by — ✅ covered *(criterion 2 is knowingly violated under a comparator — see below)*

> As someone who grouped by region and then clicked the region header expecting the regions to
> reorder, I want to understand why nothing moved.

**Acceptance criteria**

- Either the click reorders the groups, or it visibly does nothing and the header shows why.
- What does not happen: the header shows a sort indicator while the table does not change.

**Covered by:** [`grouping-order/`](../../src/stories/grouping/grouping-order/), which composes
`withSorting()` beside `groupOrder` specifically to contrast the two. Under `first-occurrence` (no
effective comparator), group order is first-occurrence over the *sorted* rows: clicking Region
reorders the rows, which reorders the first occurrences, which reorders the group headers —
criterion 1 met, and criterion 2 does not arise because something visibly moved. Under any of the
other three modes (`by-label`, `by-count`, `external-list`), the comparator pins sibling order:
clicking Region shows a sort indicator and **nothing else changes** — rows can't reorder within a
group of one value, and the comparator holds the headers. **This is the anti-pattern criterion 2
names, exhibited on purpose.** The user story's actual verb is "I want to understand why nothing
moved," and the story's title and notices state exactly that reason next to the dead indicator.
Criterion 1 is met on both sides; criterion 2 is met under `first-occurrence` and knowingly
violated under a comparator, re-attributed here from the composition that used to (incorrectly)
claim it never occurred.

**Design status:** D5's accepted cost — decoupling group order from row sort makes sorting by the
grouped column a visible no-op when no comparator overrides sibling order (`2-decisions.md:74-76`),
and a dead header when one does. Routing that click to `groupOrder` instead was considered and
deferred as a UI-layer convenience (`2-decisions.md:269-271`); AG Grid needed a dedicated flag
(`groupMaintainOrder`) to make the two coexist. `withFiltering()` staying composed on
`grouping-selection/` while `withSorting()` was pulled from other canvases is not a reversal of
this convention — see `3-lesson-audit.md:187-189`: a feature stays composed only where it makes an
otherwise-invisible outcome visible, and here *which thing moved* is the entire content of
`groupOrder`. See
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).

### S-G2 — Sorting rows inside a group — ✅ covered

> As someone reading orders grouped by region, I want to sort by date within each region and have
> the regions stay where they are.

**Covered by:** [`grouping-order/`](../../src/stories/grouping/grouping-order/) — under any of the
three comparator modes (`by-label`, `by-count`, `external-list`), sorting **Amount** orders rows
inside each group and leaves them contiguous, because the `'group'` render stage re-clusters after
the pipeline's sort — the thing TanStack cannot express at all — while the comparator holds the
group headers exactly where they were. Also counted as 3.3's fourth criterion, not twice.

**Design status:** covered by construction — D5, a stable sort, and the fixed
`filter → group → sort → expand` order. TanStack cannot express this at all.

## Owned by filtering *(built, uncommitted)*

### F-G1 — Filtering a grouped table — 🟡 partly covered *(counts yes, summaries argued not shown, collapse restoration not composed)*

> As someone filtering a grouped report down to open items, I want the groups to reflect what is
> left — and I do not want a heading claiming forty rows sitting above six.

**Acceptance criteria**

- Counts and summaries are computed over the rows that survived the filter.
- Clearing the filter restores the groups, and my expand/collapse state with them (§2.5).

**Covered by:** [`grouping-selection/`](../../src/stories/grouping/grouping-selection/) for the
first criterion's counts half: "rep contains" narrows the rows, and every count follows the
surviving rows. It is the only grouping story that composes `withFiltering()`, and it no longer
declares an `aggregate` — the summaries half of the first criterion is not on this canvas.

**Why it is 🟡:** on two counts now, not one. The first criterion's summaries half is an argument
from `PIPELINE_ORDER` (`filter` precedes `group`, so a summary can only ever see post-filter rows)
rather than something on screen — see 1.3. The second criterion — clearing the filter restores the
groups **and the expand/collapse state with them** — is still not demonstrated, because no story
composes `withExpansion()` with `withFiltering()`.

**Design status:** structurally covered — `filter` precedes `group` in `PIPELINE_ORDER`, so a group
with no surviving rows is unrepresentable rather than rendering empty; the aggregation half is
resolved in `filtering.md`. AG Grid's opt-in `groupAggFiltering` reverses this and drags in
non-matching descendants — deliberately not this library's position.

### F-G2 — Filtering by a group's summary — ❌ not covered *(forward-looking)*

> As someone reviewing donations by campaign, I want to see only campaigns whose total is over a
> threshold — a filter on the group, not on the rows.

**Design status — gap, deliberately out of scope, worth recording.** A genuinely different
operation from row filtering; the aggregation contract should not make it impossible later. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md)
(AG Grid's `groupAggFiltering`, MUI X open request).

## Owned by tree *(unbuilt — #163)*

With a `parentId` tree (`withTree({ parentId })`), grouping has to see the hierarchy. The `group`
stage reads `withTree()`'s parent-link slot ([ADR-0028](../adr/0028-tree-parent-link-slot.md)).
Collapsible groups (`withTree()` with no `parentId`) are unchanged. Tree-side stories live in
[`tree.md`](tree.md).

### G-T1 — Grouping never splits a family — ❌ not covered

> As someone grouping a task list by status, I want each subtask to stay under its task, even
> when its own status differs.

**Acceptance criteria**

- Only top-level rows are placed into groups; each branch follows its root, whatever its own
  values.
- Grouping every row by its own value is still possible: compose `withGrouping()` without
  `parentId`.

**Failure behavior**

- A row whose parent link is broken is grouped as a top-level row by its own value (tree.md 4.1).

**Covered by:** nothing. Under flat data today's clustering would place each child by its own
value, away from its parent.

**Design status:** decided — D13 (#163 work folder
[`1-decisions.md`](../1-state/work/tree/active/tree-flat-data/1-decisions.md)). No surveyed
library splits a child from its parent; products offer per-row grouping only as an opt-in flat
mode.

### G-T2 — A group's count includes every row in it — ❌ not covered

> As someone reading "Active (12)", I want 12 to be the rows I'd select by ticking that group.

**Acceptance criteria**

- A group's count includes descendants, open or closed.
- Selecting a group selects the number the count shows.

**Failure behavior**

- The count never changes when I open or close a parent inside the group.

**Covered by:** nothing.

**Design status:** decided — D14. Wrike, the only product that documents it, counts top-level
rows only; AG Grid and MUI X count all descendants.

### G-T3 — A group total that matches my data model — ❌ not covered

> As someone summing budgets per region, I want a total that doesn't double-count a parent whose
> amount is already its teams' sum, and doesn't drop one whose amount is its own.

**Acceptance criteria**

- `aggregateFn` receives every row in the group, descendants too.
- Whether a parent's value is its own or a roll-up is the page's call, inside `aggregateFn`.

**Failure behavior**

- A throwing `aggregateFn` degrades per ADR-0014, as today.

**Covered by:** nothing. The shipped fixture's `d4` (42000 = 25000 + 17000) is a roll-up and
would double-count; #163 changes it so parents carry their own amounts.

**Design status:** decided — D15. No new mechanism.

## Owned by pagination and virtual scroll *(pagination unbuilt; virtual scroll drafted)*

### P-G1 — A group that straddles a page boundary — ❌ not covered *(forward-looking)*

> As someone paging through a grouped report, I do not want a group's heading at the bottom of one
> page and its rows at the top of the next with nothing telling me what I am looking at.

**Acceptance criteria**

- Either a page holds a fixed number of rows and a split group repeats its heading on the
  continuation page, or a page holds whole groups and page lengths vary. One or the other, stated.
- Whichever is chosen, a person is never shown rows without a visible heading above them.

**Design status — gap, binary choice not made.** AG Grid and TanStack ship opposite defaults for the
same trade. `RENDER_ORDER` already puts `'paginate'` last, so either is mechanically available. See
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).
Raised as **OQ-7**.

### P-G2 — A grouped table large enough to hurt — ❌ not covered *(forward-looking)*

> As someone opening a three-level grouped report over ten thousand rows, I want it to be usable.

**Design status:** owned by [`performance.md:44-48`](performance.md), which names grouping as where
performance bites first (D12). `virtual-scroll.md` already asks whether variable-height group
headers break CDK's fixed `itemSize` — the same collision found independently in the community
research.

## Owned by row drag-and-drop *(unbuilt)*

### D-G1 — Dragging a row while the table is grouped — ❌ not covered *(forward-looking)*

> As someone reordering a grouped list by hand, I want to know what happens when I drag a row out
> of its group — does it join the new one, or snap back?

**Design status — gap, no feature exists yet, nothing blocked.** See
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md)
(mui-x #4821 — 381 👍, open since 2022). Worth deciding the question early rather than shipping it
disabled by default the way every surveyed library did.

## Owned by expansion *(built)*

### E-G1 — A table with both collapsible groups and expandable rows — ✅ covered

> As someone using a grouped table where individual rows also open to show detail, I want the two
> controls to do different things.

**Acceptance criteria**

- Collapsing a group and opening a row's detail are visibly different affordances and never
  trigger each other.
- Collapsing a group hides its rows' open detail panels; reopening the group restores them, or
  clearly does not.

**Covered by:** [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) — the
fixture's Services deal carries `children`, so the `'group'` and `'tree'` render stages both run
over the same table and put two visibly different chevrons on screen: one on a group header, keyed
by its synthetic group id, and one on a data row, keyed by the row's own id. Opening the deal never
opens a group and opening a group never opens the deal. Collapsing a group hides the deal along with
its subtree and reopening brings it back in the state it was left in, because group collapse never
writes to the row's own entry in `expandedRows`.

**Design status:** covered by ADR-0011's ordered render chain plus
[ADR-0017](../adr/0017-engine-owned-descendant-prune.md) (#98), which moved descendant hiding into
an engine-owned `'prune'` stage — the two chevrons stay independent because neither feature prunes
the other's rows. [ADR-0012](../adr/0012-split-expansion-into-panel-and-tree.md) (splitting
`withExpansion()` into a detail panel plus `withTree()`) would re-home the row chevron; the
affordance question is unresolved.

---

# 6. What a group header *is*

Not a story — a question that sits underneath five of them, recorded here because answering it
once answers all five.

**Is a group header a row, or a view over rows?**

| If it is a **row** | If it is a **view** |
|---|---|
| It appears in the selection set | Its checkbox is a bulk action; selection only ever holds real rows |
| It has an id other features can hold | Only real ids circulate; a group id never leaks into another feature's store |
| It counts toward "3 of 40 selected" | Counts are always of real rows |
| It can be pinned, dragged, edited | Those features never see it |

Every library that never answered this shipped the same class of bug — group rows entering
selection counts, ids surviving past ungrouping, saved state losing the group column. See
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md).

**A view, with one named exception ([D16](../1-state/work/grouping/archive/with-grouping/2-decisions.md)).**
`RenderRow.kind: 'group'` with `data: null` says *view*; `expandedRows` holding synthetic
`group:${columnId}:${value}` ids says *row*. Both stay, and the exception is principled: `expandedRows`
is a set of **toggles**, not of records. Selection, editing, pinning and mutations are sets of
records, and a group is not a record — so a group id never enters any of them. The exception is also
load-bearing: it is what gives §2.5 (expansion surviving a refetch) for free, since ADR-0006 never
prunes those ids.

---

# 7. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-3 — Which grouping affordances does the library own, and which does the consumer build? —
open.**
*Recommendation:* the library owns the state each needs and ships none of the UI in v1. Two of the
three have landed — the group-level expand/collapse verb (`expandAll(ids)` + `groupIds()`, #97) and
the updater factories. What is still owed is the "is everything expanded" signal (ag-grid #8621 is
what happens without one).
*~~To decide: whether sticky headers are achievable purely in CSS~~ — closed.* They are:
`stickyHeaders` on [`grouping-basic/`](../../src/stories/grouping/grouping-basic/) is exactly that,
a CSS recipe over `data-row-kind`, and it is now a documented recipe rather than an open question
(§2.4). What OQ-3 still owes is only the "is everything expanded" signal named above.
*Sequencing:* the state is in scope for `withGrouping()`; the UI belongs to
`3-ui/directives/grouping.md`, whose "no new directive" decision predates D3's multi-level array and
should be revisited.

**OQ-4 — Does expand/collapse state survive a data refresh, a sort, and a regrouping? — open.**
*Recommendation:* survives a refresh and a sort; discarded wholesale on a grouping change — the
half-restored result is worse than a reset.
*To decide:* whether `group:${columnId}:${value}` is stable enough to carry this — it survives a
refetch by construction, but nothing tests it, and a value that formats differently between renders
would silently break it.
*Sequencing:* `expandedRows` already keeps synthetic group ids and ADR-0006 deliberately never
prunes them, so this may already work by accident. Confirm it, then make it a stated guarantee with
a test.

**OQ-5 — What is a group key, and what happens when the value is missing or is not text? —
mechanism resolved 2026-09-19; display half open.**
§4.1 and §4.2 are one decision.
*Closed by:* group admission (`when`/`enable`, ADR-0018, #85/#86) — a consumer can reject a blank or
non-primitive-keyed cluster and its rows stay flat instead of forming an unlabelled group. That is
the mechanism half, demonstrated in `grouping-when/`.
*Still open, deliberately not closed here:* the library ships no default of its own for a missing
value (one labelled group, three unlabelled ones, or flat — S7) — a consumer opinion, not a library
one, today. What a header *displays* for a missing or non-primitive value is [#80](https://github.com/DvirMon/ng-table/issues/80)'s accessor-contract
work, not this one. Do not read this entry as OQ-5 closed whole.

**OQ-6 — What happens to a group containing exactly one row? — resolved 2026-09-19.**
*Closed by:* §4.3 — always a group, unless a `when`/`enable` predicate rejects it (ADR-0018).
Consistent by construction and now stated on canvas via `grouping-when/`'s per-column threshold.
*Remaining, non-blocking:* whether the extra click is bad enough in the real category-list case to
justify the library shipping an opinionated default (vs. requiring an explicit `when`). A UX
preference question, not a mechanism gap — ask a user rather than guess.

**OQ-7 — Do groups split across pages, or do page sizes vary? — open, and blocked.**
*Recommendation:* whole groups, variable page length — a person paging through a grouped report is
navigating by group; a heading orphaned at the bottom of a page serves nobody.
*To decide:* whether a very large single group makes a page unusable.
*Sequencing:* pagination is unbuilt. Nothing is blocked today; record the position so pagination is
not designed as if grouping did not exist.

**OQ-8 — When does an edited row move to its new group? — open.**
*Recommendation:* immediately, with the row scrolled into view and highlighted — G-1's existing
acceptance criteria.
*To decide:* whether a person filling in several rows in a grouped table finds instant re-grouping
useful or disorienting.
*Sequencing:* owned by row editing; needs G-1 and sorting's row-hold decided together, because they
are the same mechanism applied to two different reasons a row moves.

---

# 8. Gap analysis, split by owning layer

The point of writing this after `3-spec.md` was to find these. Listed plainly so they are absorbed
rather than discovered.

**The stories above are deliberately layer-free** — a person does not perceive layers, and a story
that names one has drifted back into being a spec. The gaps are a different thing: each is work
someone has to do, and the first question about any piece of work is who does it. So every gap
below is tagged **state**, **UI**, or **both**, and where it is both, what each layer owes.

## 8.1 State-layer gaps

Owned by `1-state/work/grouping/archive/with-grouping/` and the feature docs it supersedes.

| # | Gap | Story | Note |
|---|---|---|---|
| S4 | No "is everything expanded" signal | 2.2 | Without it an Expand All control cannot label itself — ag-grid #8621 is exactly this |
| S6 | No initial expansion depth | 2.3 | AG Grid and MUI X both model this as a depth; TanStack has no depth concept. No longer blocked on discovery — `groupIds()` ships (#97); the ids just carry no level |
| S7 | Missing / null group values have no library default | 4.1 | D14 covers an unknown column *id*, not a missing *value*. Group admission (`when`/`enable`, ADR-0018) lets a consumer reject blank clusters so those rows stay flat — demonstrated in `grouping-when/`. What is undecided is the library's own answer: one labelled blank group, three unlabelled ones, or flat. OQ-5 |
| S8 | An object group key with no `extractValue` merges silently | 4.2 | `RenderRow.groupKey` ships (`api/types.ts:51`), carrying `label`; the rule's own `extractValue` + `label` (D7a) are the supported path — **not** `ColumnDef.accessor`, which grouping no longer reads (D7). A rule declaring neither falls through `toGroupKey`'s `` `${typeof value}:${String(value)}` `` and merges every distinct object into one bucket, with no report under ADR-0014. Pairs with U8. [#80](https://github.com/DvirMon/ng-table/issues/80), OQ-5 |
| S9 | ~~Single-row group behavior unstated~~ — resolved 2026-09-19 | 4.3 | Always a group unless `when`/`enable` rejects it (ADR-0018). OQ-6 closed |
| S10 | A degraded grouping level is unreportable | 4.4 | An unknown level yields one phantom cluster per parent (D7) rather than being dropped. The behavior is defined and tested; nothing tells the person, and whether the phantom or a drop is the right product answer is undecided |
| S12 | `rowsOf()` call-site form unsettled | X-G1 | Shipped as `table.rowsOf(g)`, flat (issue #31). Whether it stays flat or moves under `table.grouping.rowsOf(g)` is open — [ADR-0015](../adr/0015-feature-member-namespacing.md), accepted 2026-09-13, unimplemented |

**Closed since this section was written — do not re-file.** S5 (no group-level expand/collapse
verb) shipped as `expandAll(ids)` + `groupIds()` in #97. The two "live contradictions" listed here
are both fixed: `state-persistence.md`'s `TableSnapshot.grouping` became `string[]` on 2026-09-10,
and `features/grouping.md`'s "do not 'fix' the scope by adding depth" sentence carries its own
correction note from the same date. S4 is the one state gap from §2.2 that remains.

## 8.2 UI-layer gaps

Owned by `3-ui/directives/grouping.md` (`spec: stub`) — whose scoping decision to add no new
directive (`:16`, `:29`) was made when grouping was single-level and imperative, and predates D3's
ordered multi-level array a person is expected to manipulate. That decision should be revisited,
not inherited.

| # | Gap | Story | Note |
|---|---|---|---|
| U1 | Group header cell structure undecided | 1.3, 1.4 | `3-ui/directives/grouping.md:41` — one spanning `<td>` vs one per column, called "mutually exclusive layouts". Per-column renders on canvas across every current story. The full-width banner variant had its own demo on a story that has since been deleted; it is undemonstrated again, not just undecided |
| U2 | What happens to the grouped column on screen | 1.4 | Four libraries, four answers — hidden, moved to front, shown twice, or cells merged vertically |
| U4 | No expand-all / collapse-all control | 2.2 | `3-spec.md` scopes out the UI. Defensible — but it must not also scope out S4 (S5 shipped in #97) |
| U5 | Sticky group headers stick, but do not **stack** | 2.4 | Every depth uses `top: 0`, so a nested header lands on its parent instead of beneath it, and 2.4's full-path and clean-hand-off criteria stay unmet. Needs a per-depth offset, and it collides with virtual scroll |
| U7 | No affordance to order the groups | 3.3 | The differentiator story, and the one with no prior art to copy |
| U8 | Group-label formatting for an unknown value | 4.2 | Already open at `3-ui/directives/grouping.md:41-45`; pairs with S8 |

## 8.3 Gaps needing both layers

Each is a case where the UI half is easy and wrong without the state half.

| Gap | State owes | UI owes |
|---|---|---|
| Expand-all control (2.2) | S4's signal — S5's verb shipped (`expandAll(groupIds())`, #97) | the button, and its label reflecting the signal |
| Sticky group headers (2.4) | nothing — CSS suffices, one class on `data-row-kind` | U5, narrowed to the per-depth offset that makes nested headers stack instead of overlap |
| Telling a person a saved level was dropped (4.4) | expose that it happened | show it |

## 8.4 Confirmed right — do not re-litigate

- **Aggregates over leaf rows at every depth (D9)** — the exact bug TanStack has carried since 2021.
- **`groupOrder` over `GroupSummary` (D4)** — beats AG Grid, whose comparator runs before filtering
  and aggregation and so cannot order by count or by an aggregate.
- **`aggregateFn` receiving whole rows** — answers MUI X's longest-running aggregation complaint by
  construction.
- **Filter before group** — makes an empty group unrepresentable, and makes AG Grid's
  `groupAggFiltering` failure mode (a passing group dragging in all its descendants) unavailable.
- **Deferring `manual: true`** — matches the state of the art; TanStack's equivalent request has no
  maintainer resolution after six years.

Full citations:
[`research-grouping-community-pain.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-community-pain.md),
[`research-grouping-ux-capabilities.md`](../1-state/work/grouping/archive/with-grouping/research-grouping-ux-capabilities.md).

---

# 9. Capabilities with no owner

Distinct from the gaps above: these are not missing paragraphs in an existing spec, they are
**features with no doc at all**. Checked against `docs/status.md` (the generated capability
registry) rather than against memory.

### 9.1 Aggregation and totals — **state**, and it is not the same feature as grouping

`aggregate` is grouping-owned infrastructure — declared through `withGrouping({ schema })`,
read by nothing outside grouping's own render stage. Three capabilities need an aggregation
primitive and two of them do not involve grouping at all:

- **Grand total row** — a whole-table summary. D9 scopes it out of `withGrouping()`, correctly, and
  nothing else claims it.
- **Group footer / subtotal rows** — distinct from a grand total, and currently not representable:
  `RenderRow.kind` is `'row' | 'group'`, with no footer kind. See mui-x
  [#16766](https://github.com/mui/mui-x/issues/16766).
- **The person choosing the function at runtime** — AG Grid and MUI X both let a user pick sum vs.
  avg vs. count per column. Ours is fixed by the developer.

Also downstream of this: **F-G2**, filtering by a group's summary, has no aggregation capability to
filter on.

### 9.2 Column menu — **UI**

No doc, no directive, nothing in the registry. It is the delivery vehicle both majors use for
group-by, ungroup, aggregation choice, and filter entry. Its absence is why §3.1 has no affordance.

### 9.3 Group panel / toolbar — **UI**

AG Grid's Row Group Panel: drag columns in, reorder the pills, remove them. Natural home for §3.2
(change the nesting order) and §3.3 (arrange the groups themselves) — the latter being the one story
in this document with no prior art anywhere, and therefore design work rather than porting.

### 9.4 Row pinning — **state + UI**

`column-pinning.md:89` is explicit that pinning "never touches row count, row order or row
content." There is no row equivalent. Two stories need one: sticky group headers (§2.4) and a
pinned grand total row (§9.1). Both are row-pinning-shaped, and treating each as a bespoke grouping
feature is how a general mechanism gets missed.

### 9.5 Server-side / manual mode as an architecture — **state, cross-cutting**

Three features hit the same wall independently: filtering was pushed out to a standalone
`createFilters()` primitive; grouping deferred `manual: true` for the identical structural reason;
`infinite-scroll` is a stub. One cause — `createTable(data, …)` resolves `data` before a feature's
own state exists, so any feature whose state must feed the request producing `data` cannot live
inside it. Three deferrals, no ADR, no owner.

---

# 10. Not user-facing

Real problems, but the integrating developer's, not the person using the table. Listed so they are
not mistaken for missing stories.

- **Whether grouping state lives on the feature or on `ColumnDef`** (D2) — the person cannot tell.
- **Whether writes go through an updater factory or a setter** (D1) — invisible; what is visible is
  that four affordances exist (§3.1, §3.2).
- **Whether the grouping rule is sync or async** (D13) — invisible when it works. Its *failure* is
  visible and is specified: a pending rule holds the last explicit choice rather than flashing
  ungrouped, which is §1.4's "not silently getting a different report."
- **Whether `TRow` is inferable** (D10) — a developer ergonomics concern with no on-screen form.
- **That `'group'` precedes `'tree'` in the render chain** (D11, ADR-0011) — plumbing. Its
  consequence (groups and expandable rows compose at all) is E-G1.
- **An unknown column id throwing at construction** (D14) — a build-time error for the developer.
  The runtime half of D14 *is* user-facing and is §4.4.
- **Whether a group header renders one spanning cell or one cell per column** — currently open
  (`3-ui/directives/grouping.md:41`), a layout decision rather than a product one, except where it
  determines whether 1.3's summaries can appear on the header row at all.
- **The absence of `groupChanged` as an event** — `features/grouping.md:178` claims one exists; no
  decision and no code has it. An API-surface question, not a story, but it should be settled rather
  than left claimed-and-absent.
