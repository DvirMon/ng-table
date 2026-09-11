---
title: Product — Grouping User Stories
type: product
status: >
  First pass, 2026-09-10. Written after D1–D15 and `3-spec.md` (`status: ready`), not before — so
  this doc's job is to find what the design does not cover, and it does. §8 splits the gaps by
  owning layer: 11 state, 10 UI, 5 needing both, plus 2 direct contradictions with shipped docs.
  §9 lists 5 capabilities with no doc at all, checked against the generated registry. Coverage is
  ❌ across the board because `withGrouping()` has zero code. OQ-1…OQ-8 all open, none silently
  picked.
date: 2026-09-10
audience: product, design, engineering
---

# Grouping — user stories

What a person sitting in front of a grouped table needs to be able to do, and what they should
experience when the data does not cooperate. Engineering derives API from this document, not the
reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it — coverage marks here are updated from the product side as capabilities
> land.

> **This doc was written after the spec, not before it.** `1-state/work/with-grouping/3-spec.md`
> is `status: ready` and carries 24 user stories — **every one of which begins "As a developer"**.
> That is not a criticism of the spec; it is the correct voice for a spec. It does mean the
> person-in-front-of-the-table half had never been written down, which is what this document is.
> Where the two disagree, §8 says so explicitly rather than leaving it to be discovered at
> implementation time.

## Scope

**Grouping means: rows that share a value are gathered together, and the table shows me that.**
A person perceives four things, and does not care which layer produces them:

1. Rows that belong together are adjacent, with a visible boundary between one group and the next.
2. Each group announces what it is — the value, and how many rows are in it.
3. Each group can carry a summary of its own rows (a total, an average, a count).
4. Groups can nest, and I can change what nests inside what.

The codebase splits this across a `'group'` pipeline stage, a `'group'` render stage, an optional
`withExpansion()`, and `ColumnDef.aggregateFn`. That split is invisible to the person using the
table and is ignored here.

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

**Every story in this document is ❌, and that is not a judgement call.** Verified 2026-09-10
(`1-state/work/with-grouping/research-grouping-internal-coverage.md` §4–§5): there is no
`with-grouping.ts`, no `mutations/update-grouping.ts`, no clustering function, nothing registers
the free `'group'` render stage outside test doubles, `ColumnDef.aggregateFn` is a typed field
with zero readers, and none of the nine story folders branches on `row.kind` or binds
`aggregates`. Grouping appears in `src/` only as a type union, doc comments, mock fixtures, and
stage-order test doubles.

So the marks carry no information yet. What carries information is the **Design status** line on
each story: whether a settled decision already answers it, whether nothing does, or whether the
settled design points the other way. That line is the actual output of this pass.

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
resulting gap into state, UI, or both, because that difference decides who does the work — and §9
collects the ones that belong to no existing feature at all.

Where a competitor's behavior is cited, it comes from
[`research-grouping-ux-capabilities.md`](../1-state/work/with-grouping/research-grouping-ux-capabilities.md)
(version-pinned, 2026-09-10) or
[`research-grouping-community-pain.md`](../1-state/work/with-grouping/research-grouping-community-pain.md)
(issue numbers and 👍 counts read from the GitHub API the same day). Neither is restated here
beyond what a story needs.

---

# 1. See the data grouped at all

Ordered by how badly the person is hurt if it is missing.

## 1.1 — See my rows gathered into groups, with a visible boundary — ❌ not covered

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

**Design status:** covered by D3/D9 and the `'group'` render stage design. No gap.

## 1.2 — See how many rows are in each group — ❌ not covered

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

**Design status — gap.** **No decision covers this, and not rendering one would be the
surprising choice.** AG Grid, MUI X and Material React Table all render a child count by default
and all ship a switch to hide it; TanStack renders nothing, and it is also the only one of the
four with no UI layer at all. `RenderRow` has `hasChildren?: boolean` but no count field, and
`aggregates` is untyped as to whether a count lives there. Raised as **OQ-2**.

## 1.3 — See a summary for each group — ❌ not covered

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

**Design status:** mostly covered. D9 fixes aggregates to leaf rows at every depth (which is
precisely the bug TanStack has carried since 2021 — [#3323](https://github.com/TanStack/table/issues/3323),
[#6228](https://github.com/TanStack/table/issues/6228): aggregation blank at the top level of a
two-level grouping). Filtering-before-grouping is already resolved (`filtering.md:66-67`). **Two
gaps:** the per-group failure fallback above is not among D15's named callback fallbacks, and
`aggregateFn` receives only rows — MUI X's longest-running aggregation complaint
([#11491](https://github.com/mui/mui-x/issues/11491), open since 2023) is that the callback cannot
see other columns' values for the same rows. Ours can, because it receives whole rows. Worth
keeping deliberately.

## 1.4 — Know what the table is grouped by — ❌ not covered

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

**Design status — gap.** The state exists and is readable (`grouping: string[]`), but **what
happens to the grouped column on screen is undecided**, and the four libraries give four different
answers: AG Grid hides the source column and synthesises a group column; TanStack moves it to the
front and keeps it; MUI X leaves it exactly where it was so the value appears twice; PrimeNG can
merge its cells vertically instead of adding headers at all. `3-ui/directives/grouping.md:41-45`
has "group-row cell structure — one spanning `<td>` vs one per column" listed as an open item and
calls them "mutually exclusive layouts". That is this story, unresolved, at the UI layer.

---

# 2. Move around a grouped table

## 2.1 — Fold away a group I do not care about — ❌ not covered *(collapsible mode)*

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

**Design status:** covered by D11 (grouping does its own subtree walk, since `'group'` runs before
`'tree'`) and the optional `expandedRows` read. **One gap:** the click-target size above.
Telerik has carried that request since 2021, unplanned
([feedback 1525732](https://feedback.telerik.com/blazor/1525732-expand-collapse-a-group-by-clicking-on-the-grouping-row-group-header-not-only-the-arrow-icon)),
with a commenter noting it "makes it consistent with most websites that offer this type of
functionality." It is a UI-layer decision and belongs in `3-ui/directives/grouping.md`, which
currently plans no new directive at all.

## 2.2 — Collapse or expand everything in one action — ❌ not covered *(collapsible mode)*

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

**Design status — gap, and an explicitly scoped-out one.** `3-spec.md:371-391` lists "auto-wiring
a header collapse-all/expand-all UI" as out of scope. The evidence says that is the single most
requested missing affordance in this space: MUI X
[#11421](https://github.com/mui/mui-x/issues/11421) (open, 8 👍) — "there is no native method to
expand/collapse all grouped rows", with the reporter reporting **both** hand-rolled workarounds
too slow to use past one grouping column. AG Grid [#8621](https://github.com/ag-grid/ag-grid/issues/8621)
is the second half: even where `expandAll()` exists, nothing tells you whether everything is
currently expanded, so the button cannot render its own label. Material React Table is the only
library in the survey shipping the button by default. **Scoping out the UI is defensible; scoping
out the state that makes the UI possible is not, and those are different decisions.** Raised as
**OQ-3**.

## 2.3 — Open the table already at the depth I want — ❌ not covered *(collapsible mode)*

> As someone who always works region-by-region, I want the report to open showing regions
> collapsed, not two thousand rows I then have to fold up myself.

**Acceptance criteria**

- The initial expanded state is configurable: all collapsed, all expanded, or expanded to a
  depth.
- Expanding to depth 2 of a 4-level grouping shows levels 1 and 2 open and everything below shut.
- The initial state applies on first paint. The table does not render fully expanded and then
  visibly collapse.

**Design status — gap.** No decision covers initial expansion state at all. AG Grid
(`groupDefaultExpanded`) and MUI X (`defaultGroupingExpansionDepth`) both model this as a depth
with `-1` meaning all; TanStack has no depth concept whatsoever — `ExpandedState` is `true` or a
hand-built set of row ids — so "expand the first two levels" is arithmetic the consumer does.
`withExpansion()` today has `expandAll`/`collapseAll` but its `expandAll()` walks
`childrenAccessor` over real rows, so it cannot discover a group at all
(`with-expansion.ts:119-135`).

## 2.4 — Keep my place while scrolling a long group — ❌ not covered

> As someone scrolling through two hundred rows inside one region, I want to still be able to see
> which region I am in, because by row sixty the heading is long gone and every row looks the
> same.

**Acceptance criteria**

- The group header stays visible while any of its rows are on screen.
- With nested groups, the visible headers describe the full path — region *and* country — not just
  the innermost one.
- The stuck header hands off to the next group's header as I scroll past the boundary, without
  overlapping it or flickering.

**Design status — gap.** This is the purest end-user complaint found in the entire corpus, and
it is quoted rather than paraphrased for that reason — MUI X
[#10671](https://github.com/mui/mui-x/issues/10671) (open, 16 👍):

> "When using row grouping as you scroll you lose all context of what the value is for your
> current group if you have a lot of rows in each group. A great feature would be for the summary
> row of each group to stick to the top as you scroll so you can always see the current group (or
> groups if nested) that you are in."

**AG Grid is the only library that ships it** — group rows stick by default
(`suppressGroupRowsSticky` opts out). MUI X does not even publish a recipe. It is a UI-layer
concern, it collides with virtual scroll, and it is named nowhere in our docs. Raised as **OQ-3**
alongside 2.2, because both are "the affordance is missing, and the state layer decides whether it
*can* exist."

## 2.5 — Not have my expand/collapse thrown away — ❌ not covered *(collapsible mode)*

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

**Design status — gap, and the highest-value cheap win in this document.** This complaint is
**eleven years old and unresolved across four libraries**: ag-grid
[#600](https://github.com/ag-grid/ag-grid/issues/600) (2015 — live data every 10s, "if user expand
the row means he cant see the inner rows more then 10 sec"), mui-x
[#13962](https://github.com/mui/mui-x/issues/13962) (2024), mui-x
[#21398](https://github.com/mui/mui-x/issues/21398) (**open, 2026** — sort model changes, refetch,
expansion gone), primeng [#19398](https://github.com/primefaces/primeng/issues/19398) (open, cannot
even get groups open on first paint). **TanStack is the live outlier**: `autoResetExpanded`
defaults to on, so any refetch re-collapses the table. AG Grid solved the client-side half and
made discarding state an explicit call.

Half-restored is specifically worse than reset — mui-x
[#16495](https://github.com/mui/mui-x/issues/16495) (open): "The row's icon remains as a minus icon
(-), indicating that the detail panel is expanded. However, the content of the detail panel is not
visible."

**We are unusually well placed here and it appears to be luck, not design.** `expandedRows` already
holds synthetic `group:${columnId}:${value}` ids alongside real row ids, and ADR-0006 pruning
deliberately never prunes them (`expansion.md:76`, `:270`). A group whose id is stable across a
refetch therefore keeps its state for free. **What is undecided is whether that id is stable** —
it is derived from the column id and the value, so it survives a refetch but not a change to the
grouping. No decision states this, and nothing tests it. Raised as **OQ-4**.

---

# 3. Control the grouping myself

## 3.1 — Change what the table is grouped by — ❌ not covered

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

**Design status:** the state side is covered by D1's four updater factories — set, add, remove,
reorder a level — which name exactly four product affordances. **The gap is that no affordance is
specified anywhere.** AG Grid has three routes (drag a column into a group panel, a column-menu
item, a tool panel); MUI X has a column menu; TanStack has none and is headless. Ours has none and
is not headless. `3-ui/directives/grouping.md:29` explicitly **rejected** an `ngpTableGroupBy`
header directive. That rejection was made when grouping was single-level and imperative; it
deserves re-examination now that D3 makes grouping an ordered multi-level array a person is
expected to manipulate.

## 3.2 — Group by more than one thing, and change what nests inside what — ❌ not covered

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

**Design status:** covered by D3, D9, and `reorderGroupLevels`. AG Grid's most recent open grouping
bug is precisely the failure of this story — [#14635](https://github.com/ag-grid/ag-grid/issues/14635)
(open, 2026): "the last groping column shifted to index 0 every time", against the expectation
that "Grouping should follow the same order in which the columns are grouped." Our ordered array
makes that class of bug hard to write. Worth a test rather than a decision.

## 3.3 — Decide the order the groups themselves appear in — ❌ not covered

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

**Design status:** covered, and it is a genuine differentiator. D4's `groupOrder` compares
`GroupSummary` objects that carry their rows; D5 decouples group order from row sort; D15 names
the first-occurrence fallback. **No library in the survey lets an end user place groups in an
arbitrary order** — AG Grid gets closest with a comparator a developer can close over an external
list with, and even that is Enterprise-only. This is the story that started the whole grill and it
is the one place we would be ahead rather than level. Treat it as design work, not as a feature to
port, because there is no UX to copy.

## 3.4 — Order groups by how big they are — ❌ not covered

> As someone triaging tickets grouped by assignee, I want the biggest queues at the top, because
> that is the whole reason I grouped them.

**Acceptance criteria**

- Groups can be ordered by a property of their contents — row count, or a summary value — not only
  by their label.
- The ordering reflects the filtered rows, consistently with the counts in 1.2 and the summaries
  in 1.3.
- The ordering updates when the data does.

**Design status:** covered, and this is the specific thing the market leader cannot do. AG Grid's
`initialGroupOrderComparator` "executes before filtering and aggregation" and so "cannot use
post-filtered data, or aggregated values as comparison criteria" — its own documentation says so.
D4 puts `rows` on `GroupSummary`, which makes count-based and aggregate-based ordering fall out
for free. **Two things follow that nobody has recorded:** ordering must run *after* clustering and
filtering for that to hold, and it should be tested against the AG Grid limitation explicitly, so
the property is not lost in implementation by someone optimising the stage order.

---

# 4. When the data does not cooperate

The group *key* is where grouping actually fails in production. Every library assumes the grouped
value is a primitive that stringifies usefully; real data is not.

## 4.1 — Rows with nothing in the grouped column — ❌ not covered

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

**Design status — gap, and the most likely source of a first bug report.** No decision addresses
it. D14 covers an unknown *column id*; this is a missing *value*, a different thing entirely. MUI X
carries three open issues here: [#9094](https://github.com/mui/mui-x/issues/9094) (null is
deliberately not grouped, and the consumer wants it to be),
[#13204](https://github.com/mui/mui-x/issues/13204) (null-valued rows render inline "so that they
can be expanded in the same way as other groups"), and on ag-grid's server path
[#13347](https://github.com/ag-grid/ag-grid/issues/13347) (open, 2026) a `null` group key collapses
to an empty key array on the wire, so the server cannot distinguish "top level" from "the null
group". Adjacent and already flagged internally: `sorting.md:167-169` (S9) says an empty row "has
no group to belong to" and where it renders "is undefined". Raised as **OQ-5**.

## 4.2 — A grouped column whose values are not text — ❌ not covered

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

**Design status — gap.** MUI X [#10729](https://github.com/mui/mui-x/issues/10729), open since
2023 with ten comments: "If you have a value that is an object the group key is
`autogenerategroupORwhatever-[Object Object]`", and the reporter's framing is the one that
matters — "it feels like there is a contradiction occuring when trying to use all the grids
capabilities when it comes to object values." Two of our own open items are the same question from
different angles: `3-ui/directives/grouping.md:41-45` asks about "group-label formatting for an
`unknown` value", and `RenderRow` has **no `groupKey` field at all** — `features/grouping.md:108`
specifies one, `src/api/types.ts` does not have it, so what a group header knows about its own
identity is currently unspecified in code. Raised as **OQ-5** with 4.1; they are one decision.

## 4.3 — A group with exactly one row in it — ❌ not covered

> As someone with a list where half the categories have a single item, I do not want to click
> twice to see one row.

**Acceptance criteria**

- Whatever happens to single-row groups is consistent and stated: they either always render as a
  group, or always collapse into their row.
- If they render as groups, they do not cost more interaction than the row is worth.

**Design status — gap.** No decision. MUI X [#9032](https://github.com/mui/mui-x/issues/9032)
(open) states the trade exactly: "If the group size is 1 this creates an unnecessary extra click
when navigating the data. It is possible to auto-expand the group based on the group size, but then
it feels like the group row is wasting vertical space." Raised as **OQ-6** — it is genuinely a
product choice, and the honest answer may be "always a group", stated deliberately.

## 4.4 — A saved grouping that no longer fits the table — ❌ not covered

> As someone returning to a saved view after the report changed, I want to see the data, grouped by
> as much of my saved arrangement as still applies — not an error, and not a blank page.

**Acceptance criteria**

- A saved level naming a column that no longer exists is dropped; the remaining levels apply.
- The table renders. Losing a grouping level is never a reason to show nothing.
- I can tell that something was dropped, rather than quietly getting a different report than the
  one I saved.

**Design status:** the degradation half is covered by D14 — construction config throws, runtime
data skips that level and groups by the rest. **Two gaps.** Telling the person is not specified,
only the degradation. And `state-persistence.md:90` still types `TableSnapshot.grouping?: string |
null`, which **cannot represent a multi-level grouping at all** — a saved two-level arrangement is
not merely degraded, it is unrepresentable. That is a live contradiction with D3, not a
forward-looking note.

---

# 5. Cross-feature interactions

Grouping collides with nearly everything, and the community evidence is emphatic that this is
where grouping actually breaks: **interaction bugs outnumber pure performance complaints by
roughly ten to one** in the corpus.

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to grouping. That is this repo's existing convention (`row-editing.md:592-596`)
and it is why two grouping stories already live in the row-editing doc.

## Owned by row editing *(built)*

**G-1 and G-2 already exist** at [`row-editing.md`](row-editing.md) §5, "Owned by grouping
*(unbuilt)*" — G-1, a row moving to another group when its grouped value is edited; G-2, adding a
row into a specific group. They are **linked, not restated**. That file owns them and updates their
coverage marks from the product side.

One thing they do not resolve, and no library in the survey answers either — **when does an edited
row re-group?** ag-grid [#1672](https://github.com/ag-grid/ag-grid/issues/1672) names the cost of
getting it wrong: if a row jumps groups the instant its value is typed, "user input will get
scattered in grid, and hard to review for user". AG Grid's own answer under editing is the opposite
— `refreshAfterGroupEdit: true` makes the grid "re-evaluate the grouping and move the row to the
correct group instantly". Our own state side already flagged the insertion half
(`with-mutations/2-decisions.md:331-343`, "Deferred — insertion under grouping"). Raised as
**OQ-8**.

## Owned by selection *(built)*

### X-G1 — Ticking a group's checkbox — ❌ not covered *(forward-looking)*

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

**Design status — gap, and the highest-stakes single choice in this document.** The three majors
ship three different defaults, so "what people expect" is unavailable as a tiebreaker: AG Grid
`groupSelects: 'self'` selects *nothing else*; TanStack `enableSubRowSelection: true` selects all
descendants; MUI X propagates **both directions**, so ticking a group's last unticked child
silently ticks the group. And every library has broken it — ag-grid across a major version
([#11203](https://github.com/ag-grid/ag-grid/issues/11203)), TanStack twice
([#4879](https://github.com/TanStack/table/issues/4879),
[#5700](https://github.com/TanStack/table/issues/5700), whose reporter diagnosed it precisely: "the
grouped row being considered in the selected state object of the table, even if it not a 'real'
row"), and ag-grid again on the filtered variant
([#11209](https://github.com/ag-grid/ag-grid/issues/11209) — a group shows partially selected when
every *visible* child is selected).

Internally this is already flagged twice: `selection.md:128`/`:134-137`, and
`with-selection/2-decisions.md:168-173` with an explicit instruction — "**Must be represented in
the product use-cases / story set either way.**" This story is that representation. Raised as
**OQ-1**.

## Owned by sorting *(built)*

### S-G1 — Sorting by the column I grouped by — ❌ not covered *(forward-looking)*

> As someone who grouped by region and then clicked the region header expecting the regions to
> reorder, I want to understand why nothing moved.

**Acceptance criteria**

- Either the click reorders the groups, or it visibly does nothing and the header shows why.
- What does not happen: the header shows a sort indicator while the table does not change.

**Design status — this is D5's accepted cost, and it is a real one.** D5 decouples group order from
row sort, which makes sorting by the grouped column a **visible no-op**
(`2-decisions.md:74-76`). Routing that click to `groupOrder` instead was considered and deferred as
a UI-layer convenience (`2-decisions.md:269-271`). The evidence says people hit this and file it as
a bug: mui-x [#16540](https://github.com/mui/mui-x/issues/16540) (open) — sort a column, then group
by it, "The sorting is lost when grouping is applied… The sorting indicator (arrow) disappears from
the column header", with the reporter calling it "an inconsistent user experience". AG Grid needed a
dedicated flag (`groupMaintainOrder`) to make the two coexist. **The deferral is defensible; leaving
the person with a dead header is not.** At minimum the no-op must be legible.

### S-G2 — Sorting rows inside a group — ❌ not covered *(forward-looking)*

> As someone reading orders grouped by region, I want to sort by date within each region and have
> the regions stay where they are.

**Design status:** covered by construction — D5 plus a stable sort plus the fixed
`filter → group → sort → expand` order. Recorded here because it is the half of S-G1 that works,
and because TanStack cannot express it at all (one recursive pass; sorting a data column always
reorders the groups too).

## Owned by filtering *(built, uncommitted)*

### F-G1 — Filtering a grouped table — ❌ not covered *(forward-looking)*

> As someone filtering a grouped report down to open items, I want the groups to reflect what is
> left — and I do not want a heading claiming forty rows sitting above six.

**Acceptance criteria**

- Counts and summaries are computed over the rows that survived the filter.
- A group with no surviving rows disappears rather than rendering empty.
- Clearing the filter restores the groups, and my expand/collapse state with them (§2.5).

**Design status:** structurally covered — `filter` precedes `group` in `PIPELINE_ORDER`, so an
empty group is unrepresentable, the same guarantee TanStack gets from its row-model order.
`filtering.md:66-67` already resolved the aggregation half. **One thing to keep deliberately:**
AG Grid's opt-in `groupAggFiltering` reverses this, and its documented consequence is that a
passing group "drags all its descendants in with it" regardless of their own match. Our ordering
makes that mistake unavailable, which is the right trade.

### F-G2 — Filtering by a group's summary — ❌ not covered *(forward-looking)*

> As someone reviewing donations by campaign, I want to see only campaigns whose total is over a
> threshold — a filter on the group, not on the rows.

**Design status — gap, deliberately out of scope, worth recording.** AG Grid's `groupAggFiltering`
is the only prior art and comes with two documented caveats; MUI X has it open as a request
([#20897](https://github.com/mui/mui-x/issues/20897), `waiting for 👍`). It is a genuinely
different operation from row filtering and does not belong in a first release — but it is the
natural next thing a person asks for after 1.3, so the aggregation contract should not make it
impossible.

## Owned by pagination and virtual scroll *(pagination unbuilt; virtual scroll drafted)*

### P-G1 — A group that straddles a page boundary — ❌ not covered *(forward-looking)*

> As someone paging through a grouped report, I do not want a group's heading at the bottom of one
> page and its rows at the top of the next with nothing telling me what I am looking at.

**Acceptance criteria**

- Either a page holds a fixed number of rows and a split group repeats its heading on the
  continuation page, or a page holds whole groups and page lengths vary. One or the other, stated.
- Whichever is chosen, a person is never shown rows without a visible heading above them.

**Design status — gap, and unavoidably binary.** AG Grid and TanStack ship **opposite defaults for
the identical trade**: AG Grid `paginateChildRows: false` keeps groups whole and lets pages
overflow; TanStack `paginateExpandedRows: true` keeps the page size exact and splits a group across
pages. AG Grid's own docs flag the latter as "potentially confusing users if the last row of a page
expands". MUI X and PrimeNG document neither, which is a warning rather than permission. The
end-user version of this is mui-x [#10417](https://github.com/mui/mui-x/issues/10417) (open) — 15k
records in a three-tier grouping paginated by *groups*, so "I have some pages with hundreds of rows
and others with maybe 15", asking for row-counted pages with a repeated heading. `RENDER_ORDER`
already puts `'paginate'` last, so the mechanism is available either way; the choice is not made.
Raised as **OQ-7**.

### P-G2 — A grouped table large enough to hurt — ❌ not covered *(forward-looking)*

> As someone opening a three-level grouped report over ten thousand rows, I want it to be usable.

**Design status:** already owned by [`performance.md:44-48`](performance.md), which names grouping
as **where performance bites first**, and D12 makes it a design constraint rather than a follow-up.
Two specifics from the evidence worth carrying in: TanStack
[#4929](https://github.com/TanStack/table/issues/4929) — virtual scrolling plus row grouping
produces an infinite loop that freezes the tab, **open three years**; and PrimeNG
[#19293](https://github.com/primefaces/primeng/issues/19293) — with virtual scrolling on a grouped
table "the header and footer rows do not appear", reproducible on PrimeNG's own docs examples.
`virtual-scroll.md` already asks whether variable-height group headers break CDK's fixed
`itemSize`; that is the same collision, found independently.

## Owned by row drag-and-drop *(unbuilt)*

### D-G1 — Dragging a row while the table is grouped — ❌ not covered *(forward-looking)*

> As someone reordering a grouped list by hand, I want to know what happens when I drag a row out
> of its group — does it join the new one, or snap back?

**Design status — gap, and the single loudest unmet demand in the whole corpus.** mui-x
[#4821](https://github.com/mui/mui-x/issues/4821): **381 👍, 66 comments, open since 2022**, last
updated 2026-09-01. The maintainers' own explanation is the valuable part:

> "Currently, when Row Grouping or Tree Data is used, the row reordering feature is disabled. This
> was intentionally made so in order to ship the feature quicker. Also, at the time, there were a
> few unanswered questions regarding how the reordering will work when you try to move a child row
> out of the parent as well as moving a parent to become a child of another parent."

Four years on it is still disabled and the demand has not decayed. MUI X's newer answer elsewhere
is that dragging a row into another group **writes the grouping value** (`groupingValueSetter()`),
which is a real design position and a better one than "disabled". We have no drag feature yet, so
nothing is blocked — but this is the clearest available evidence of what happens when a grouping
design does not answer the question early: it does not get answered at all.

## Owned by expansion *(built)*

### E-G1 — A table with both collapsible groups and expandable rows — ❌ not covered *(forward-looking)*

> As someone using a grouped table where individual rows also open to show detail, I want the two
> controls to do different things.

**Acceptance criteria**

- Collapsing a group and opening a row's detail are visibly different affordances and never
  trigger each other.
- Collapsing a group hides its rows' open detail panels; reopening the group restores them, or
  clearly does not.

**Design status:** partly covered by D11 (grouping does its own subtree walk; `'group'` precedes
`'tree'`) and by ADR-0011's ordered render chain, which is what makes this composable at all —
this exact collision is why that ADR exists. ADR-0012 (`proposed`, not implemented) routes group
collapse to the *panel* half of expansion. **The unresolved half is the affordance**, and PrimeNG
shows what happens without it — [#18171](https://github.com/primefaces/primeng/issues/18171)
(open): "The group header gets shown after the first row. 2. The `pRowToggler` toggles the
expansion of *all* rows of the group." Both features wanted the same toggle and the same row-level
state slot.

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

Every library that never answered this shipped the same class of bug. TanStack #5700 — group rows
land in the selection map and every count is off by the number of groups. TanStack
[#5822](https://github.com/TanStack/table/issues/5822) — pin an aggregation row, then ungroup, and
the grid hard-errors on an id that no longer exists. mui-x
[#6735](https://github.com/mui/mui-x/issues/6735) — the auto group column is absent from saved
state, so a user's saved view cannot restore it. Four instances, three libraries, one unanswered
question.

**Our current position is split and nobody has noticed.** `RenderRow.kind: 'group'` with
`data: null` says *view*. But `expandedRows` holding synthetic `group:${columnId}:${value}` ids
says *row* — and that is load-bearing, because it is exactly what gives us §2.5 for free. So the
honest answer is "a view everywhere except expansion, deliberately" — which is fine, but it is
currently an accident rather than a decision, and X-G1 cannot be answered without stating it.

---

# 7. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-1 — What does ticking a group's checkbox do? — open.**
The three majors disagree by default, so there is no convention to inherit.
*Recommendation:* select the group's **filtered** descendants; the group header itself never enters
the selection set; a partly-selected group renders indeterminate. This follows from §6's "view, not
row" reading, and it makes the selection count always mean rows. AG Grid's `'self'` default is the
least surprising in a vacuum but makes the checkbox nearly useless; MUI X's upward propagation
mutates state the person did not touch and should not be copied.
*To decide:* whether ticking a collapsed group under an active filter should select what the count
says (filtered) or everything in the group (unfiltered). Recommendation says filtered — the count
and the selection must agree or both are untrustworthy.
*Sequencing:* `withSelection()` ships; this is a change to it, and it is already flagged as owed in
`with-selection/2-decisions.md:168-173`.

**OQ-2 — Does a group header show a row count by default? — open.**
*Recommendation:* yes, with a way to turn it off. AG Grid, MUI X and MRT all render one by default;
TanStack is the only one that does not, and it renders nothing at all. Not showing a count would be
the surprising choice.
*To decide:* whether the count is part of `aggregates` or its own field on `RenderRow` — a count is
the one summary that exists whether or not any column defines an `aggregateFn`, which argues for
its own field.
*Note:* the research pass looked for a community complaint that counts are missing and **did not
find one** — this recommendation rests on convention, not on evidence of demand.

**OQ-3 — Which grouping affordances does the library own, and which does the consumer build? — open.**
Three affordances are missing and grouped here because they are one question: expand-all/collapse-all
(§2.2), sticky group headers (§2.4), and a control to change the grouping (§3.1).
*Recommendation:* the library owns the **state** each needs and ships none of the UI in v1 —
specifically, an "is everything expanded" signal (without which an Expand All button cannot label
itself, per ag-grid #8621), a group-level expand/collapse verb that works on group ids, and the
already-settled updater factories. `3-spec.md` scopes out the UI, which is defensible; it must not
also scope out the state.
*To decide:* whether sticky headers are achievable purely in CSS from `data-row-kind`/`data-depth`,
in which case they cost nothing and should be a documented recipe rather than an open question.
*Sequencing:* the state is in scope for `withGrouping()`; the UI belongs to
`3-ui/directives/grouping.md`, whose "no new directive" decision (`:16`, `:29`) predates D3's
multi-level array and should be revisited.

**OQ-4 — Does expand/collapse state survive a data refresh, a sort, and a regrouping? — open.**
*Recommendation:* survives a refresh and a sort; discarded wholesale on a grouping change. The first
two are what people expect and what four libraries have failed to deliver for eleven years; the
third is the case where preserving state produces the half-restored result that is worse than a
reset.
*To decide:* whether `group:${columnId}:${value}` is stable enough to carry this — it survives a
refetch by construction, but nothing tests it, and a value that formats differently between renders
would silently break it.
*Sequencing:* nothing blocks it. `expandedRows` already keeps synthetic group ids and ADR-0006
deliberately never prunes them, so this may already work by accident. Confirm it, then make it a
stated guarantee with a test.

**OQ-5 — What is a group key, and what happens when the value is missing or is not text? — open.**
§4.1 and §4.2 are one decision.
*Recommendation:* every row belongs to exactly one group, including rows with no value; the missing
group gets a stated label and a fixed position (last); a non-primitive value groups by the same
accessor a cell displays with, and falls back to a stated label rather than `[object Object]`.
*To decide:* whether `null`, `undefined` and `""` are one group or three. Recommendation: one,
labelled once, with a per-column opt-out — mirroring `applySortNulls()`, which already solved this
shape for sorting and is the precedent to copy rather than re-derive.
*Action owed either way:* `RenderRow` has no `groupKey` field though `features/grouping.md:108`
specifies one. A group header currently cannot say what it is a group *of*.

**OQ-6 — What happens to a group containing exactly one row? — open.**
*Recommendation:* it renders as an ordinary group. Consistency beats the saved click, and the
alternative — collapsing single-child groups into their row — makes the table's structure depend on
its data, which is harder to explain than an extra click.
*To decide:* whether the extra click is bad enough in the real category-list case (the scenario that
started this feature) to justify auto-expanding single-row groups. Ask a user; do not guess.

**OQ-7 — Do groups split across pages, or do page sizes vary? — open, and blocked.**
*Recommendation:* whole groups, variable page length — AG Grid's default. A person paging through a
grouped report is navigating by group; a heading orphaned at the bottom of a page serves nobody.
*To decide:* whether a very large single group makes a page unusable, which is the failure mode of
this choice and the reason TanStack picked the other side.
*Sequencing:* pagination is unbuilt. Nothing is blocked today; record the position so pagination is
not designed as if grouping did not exist.

**OQ-8 — When does an edited row move to its new group? — open.**
*Recommendation:* immediately, with the row scrolled into view and highlighted — G-1's existing
acceptance criteria. The alternative (defer re-grouping until the edit session ends) is a scoped
version of the row-hold OQ-3 in `row-editing.md` and should be decided **with** it, not separately.
*To decide:* whether a person filling in several rows in a grouped table finds instant re-grouping
useful or disorienting. ag-grid #1672 argues disorienting — "user input will get scattered in grid,
and hard to review" — and AG Grid's editing feature does it instantly anyway.
*Sequencing:* owned by row editing; blocked on nothing but needs G-1 and sorting's row-hold decided
together, because they are the same mechanism applied to two different reasons a row moves.

---

# 8. Gap analysis, split by owning layer

The point of writing this after `3-spec.md` was to find these. Listed plainly so they are absorbed
rather than discovered.

**The stories above are deliberately layer-free** — a person does not perceive layers, and a story
that names one has drifted back into being a spec. The gaps are a different thing: each is work
someone has to do, and the first question about any piece of work is who does it. So every gap
below is tagged **state**, **UI**, or **both**, and where it is both, what each layer owes.

The distinction is not cosmetic. "No summary is computed for a group" is a state gap — no template
can render a value nothing derives. "There is no menu to change the grouping from" is a UI gap —
the verbs are settled (D1) and nothing calls them. Filing the second against the state spec puts it
where the person reading that spec correctly concludes none of it is theirs.

## 8.1 State-layer gaps

Owned by `1-state/work/with-grouping/` and the feature docs it supersedes.

| # | Gap | Story | Note |
|---|---|---|---|
| S1 | Group row count is not derived and has nowhere to live | 1.2 | `RenderRow` has `hasChildren?` but no count; whether it belongs in `aggregates` or its own field is OQ-2 |
| S2 | Per-group aggregation failure has no named fallback | 1.3 | D15 names fallbacks for `groupOrder` and `when`; `aggregateFn` throwing on one group's rows is unaddressed |
| S3 | Expansion survival across refresh/sort/regroup is unstated | 2.5 | May already work — `expandedRows` keeps synthetic group ids, ADR-0006 never prunes them. Unconfirmed, untested, so not a guarantee. OQ-4 |
| S4 | No "is everything expanded" signal | 2.2 | Without it an Expand All control cannot label itself — ag-grid #8621 is exactly this |
| S5 | No group-level expand/collapse verb | 2.2, 2.3 | `withExpansion().expandAll()` walks `childrenAccessor` over real rows (`with-expansion.ts:119-135`) and cannot discover a group at all |
| S6 | No initial expansion depth | 2.3 | AG Grid and MUI X both model this as a depth; TanStack has no depth concept and it shows |
| S7 | Missing / null group values are undefined behavior | 4.1 | D14 covers an unknown column *id*, not a missing *value*. `sorting.md:167-169` already flags the same hole from its side. OQ-5 |
| S8 | Non-primitive group values have no key contract | 4.2 | `RenderRow` has **no `groupKey` field** though `features/grouping.md:108` specifies one — a group header cannot say what it is a group of. OQ-5 |
| S9 | Single-row group behavior unstated | 4.3 | OQ-6 |
| S10 | Group-header selection semantics undecided | X-G1 | Already flagged as owed in `with-selection/2-decisions.md:168-173`. OQ-1 |
| S11 | "Is a group header a row or a view" is unrecorded | §6 | Currently split — `data: null` says view, synthetic ids in `expandedRows` say row. Load-bearing, and X-G1 cannot be answered until it is stated |

**Two direct contradictions, not forward-looking notes:**

- **`state-persistence.md:90`** types `TableSnapshot.grouping?: string | null`. A saved two-level
  grouping is not degraded, it is **unrepresentable**. Contradicts D3, in a shipped doc.
- **`features/grouping.md:154`** still instructs readers "do not 'fix' the scope by adding depth",
  which is precisely what D9 did. Its supersession banner does not cover that line.

## 8.2 UI-layer gaps

Owned by `3-ui/directives/grouping.md` (`spec: stub`) — whose scoping decision to add **no new
directive** (`:16`, `:29`) was made when grouping was single-level and imperative, and predates
D3's ordered multi-level array a person is expected to manipulate. That decision should be
revisited, not inherited.

| # | Gap | Story | Note |
|---|---|---|---|
| U1 | Group header cell structure undecided | 1.3, 1.4 | `3-ui/directives/grouping.md:41` — one spanning `<td>` vs one per column, called "mutually exclusive layouts". Product-facing because AG Grid's full-width group rows **lose inline aggregates**; choosing that layout trades away §1.3 |
| U2 | What happens to the grouped column on screen | 1.4 | Four libraries, four answers — hidden, moved to front, shown twice, or cells merged vertically |
| U3 | Collapse click target is the chevron, not the row | 2.1 | Telerik has carried this request since 2021, unplanned |
| U4 | No expand-all / collapse-all control | 2.2 | `3-spec.md:371-391` scopes out the UI. Defensible — but it must not also scope out S4/S5 |
| U5 | No sticky group headers | 2.4 | The loudest end-user complaint in the corpus (mui-x #10671, 16 👍). AG Grid is the only library shipping it. May be pure CSS from `data-row-kind`/`data-depth` — worth checking before treating it as a feature |
| U6 | No affordance to change the grouping | 3.1, 3.2 | D1's four updaters name four product actions; nothing renders any of them |
| U7 | No affordance to order the groups | 3.3 | The differentiator story, and the one with no prior art to copy |
| U8 | Group-label formatting for an unknown value | 4.2 | Already open at `3-ui/directives/grouping.md:41-45`; pairs with S8 |
| U9 | Sorting the grouped column reads as a dead header | S-G1 | D5's accepted cost. The deferral can stand; a header that shows a sort indicator while nothing moves cannot |
| U10 | Group collapse vs row detail-panel collapse share an affordance | E-G1 | PrimeNG #18171 is what happens without a decision here |

## 8.3 Gaps needing both layers

Each is a case where the UI half is easy and wrong without the state half.

| Gap | State owes | UI owes |
|---|---|---|
| Expand-all control (2.2) | S4's signal + S5's verb | the button, and its label reflecting the signal |
| Sticky group headers (2.4) | nothing, if CSS suffices — confirm first | U5 |
| Changing the grouping (3.1) | nothing; D1 settled it | U6, and the column-menu or panel it lives in (§9) |
| Group selection (X-G1) | S10's semantics + S11's row-or-view answer | tri-state checkbox rendering |
| Telling a person a saved level was dropped (4.4) | expose that it happened | show it |

## 8.4 Confirmed right — do not re-litigate

- **Aggregates over leaf rows at every depth (D9)** is the exact bug TanStack has carried since
  2021 ([#3323](https://github.com/TanStack/table/issues/3323),
  [#6228](https://github.com/TanStack/table/issues/6228)).
- **`groupOrder` over `GroupSummary` (D4)** beats the market leader: AG Grid's comparator "executes
  before filtering and aggregation" and so cannot order by count or by an aggregate. Ours can,
  because `GroupSummary` carries `rows`. Keep the stage order that makes this true.
- **`aggregateFn` receiving whole rows** answers MUI X's longest-running aggregation complaint
  ([#11491](https://github.com/mui/mui-x/issues/11491), open since 2023) by construction.
- **Filter before group** makes an empty group unrepresentable, and makes AG Grid's
  `groupAggFiltering` failure mode — a passing group dragging in all its descendants regardless of
  their own match — unavailable.
- **Deferring `manual: true`** is the state of the art, not a shortfall: TanStack's equivalent has
  39 upvotes across three threads over six years with no maintainer resolution, and its own guide
  says server-side grouping "will need lots of custom cell rendering to make this work."

---

# 9. Capabilities with no owner

Distinct from the gaps above: these are not missing paragraphs in an existing spec, they are
**features with no doc at all**. Checked against `docs/status.md` (the generated capability
registry, 16 capabilities) rather than against memory — none of the five appears there.

A gap analysis that reads every existing spec is structurally blind to these, which is why they
surfaced from the competitor inventory and the community corpus rather than from the internal
audit.

### 9.1 Aggregation and totals — **state**, and it is not the same feature as grouping

`ColumnDef.aggregateFn` is typed, public, and read by nobody. Three capabilities need it and two of
them do not involve grouping at all:

- **Grand total row** — a whole-table summary. D9 scopes it out of `withGrouping()`, correctly, and
  nothing else claims it. AG Grid ships four placements including pinned-while-scrolling.
- **Group footer / subtotal rows** — distinct from a grand total, and currently **not
  representable**: `RenderRow.kind` is `'row' | 'group'`, with no footer kind. mui-x
  [#16766](https://github.com/mui/mui-x/issues/16766) is finance users stating the requirement
  directly — subtotals belong at the *bottom* of a group, with rows auto-expanded, because "our
  users do not want to expand every row, they want to see every row."
- **The person choosing the function at runtime** — AG Grid (`valueAggSubMenu`) and MUI X (column
  menu → Aggregation) both let a user pick sum vs. avg vs. count per column. Ours is fixed by the
  developer.

Also downstream of this: **F-G2**, filtering by a group's summary. No aggregation capability, no
way to express it.

### 9.2 Column menu — **UI**

No doc, no directive, nothing in the registry. It is the delivery vehicle both majors use for
group-by, ungroup, aggregation choice, and filter entry. Its absence is *why* §3.1 has no
affordance, and it is the thing that would have to exist before `3-ui/directives/grouping.md`'s
"no new directive" decision could be right rather than merely unexamined.

### 9.3 Group panel / toolbar — **UI**

AG Grid's Row Group Panel: drag columns in, reorder the pills, remove them. It is the natural home
for §3.2 (change the nesting order) and §3.3 (arrange the groups themselves) — the latter being the
one story in this document with no prior art anywhere, and therefore the one that is design work
rather than porting.

### 9.4 Row pinning — **state + UI**

`column-pinning.md:89` is explicit that pinning "never touches row count, row order or row
content." There is no row equivalent. Two stories need one: sticky group headers (§2.4) and a
pinned grand total row (§9.1). Both are row-pinning-shaped, and treating each as a bespoke
grouping feature is how a general mechanism gets missed.

### 9.5 Server-side / manual mode as an architecture — **state, cross-cutting**

Three features hit the same wall independently: filtering was pushed out to a standalone
`createFilters()` primitive; grouping deferred `manual: true` for the identical structural reason
(`research-grouping-state-ownership.md`); `infinite-scroll` is a stub. One cause —
`createTable(data, …)` resolves `data` before a feature's own state exists, so any feature whose
state must feed the request producing `data` cannot live inside it.

Three deferrals, no ADR, no owner. Nobody in the market has solved it either, which makes it a
permanent gap or a differentiator — and right now it is neither, by default rather than by choice.

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
  (`3-ui/directives/grouping.md:41`), and genuinely a layout decision rather than a product one,
  **except** where it determines whether 1.3's summaries can appear on the header row at all. AG
  Grid's full-width group rows lose inline aggregates for exactly this reason; that consequence is
  product-facing even though the choice is not.
- **The absence of `groupChanged` as an event** — `features/grouping.md:143` claims one exists; no
  decision and no code has it. An API-surface question, not a story, but it should be settled rather
  than left claimed-and-absent.
