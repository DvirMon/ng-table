---
title: Research — what people actually struggle with in table row grouping
type: research
status: complete
date: 2026-09-10
audience: product, developers
issue: null
---

# What people actually struggle with in table row grouping

Evidence gathering for the `withGrouping()` user-stories doc. **No API design here** — this
records what integrators and end users complain about, not what we should build.

Every row below was read from the issue/discussion/doc page itself (`gh api` against the public
issue JSON, or a direct page fetch), never from memory. Issue numbers, dates, open/closed state,
comment counts and 👍 counts are as returned by the GitHub API on 2026-09-10. Where a claim could
not be verified from a page, it is marked **unverified** inline rather than dropped or asserted.

Repos mined: `mui/mui-x`, `TanStack/table`, `ag-grid/ag-grid`, `primefaces/primeng`, plus one
Telerik feedback-portal item. Reddit and long-form UX blog posts were searched and produced
nothing citable — see [Not researched](#not-researched).

**Caveat on ag-grid counts.** AG Grid triages GitHub into a private tracker and closes issues
fast; `state: closed` there means "moved to our tracker or answered", not "fixed". Its 👍 counts
are near-universally zero and carry no signal. MUI X, by contrast, uses a `waiting for 👍` label
as an explicit demand vote, so 👍 there is real signal.

---

## Findings — the seven recurring themes

| #   | Theme                                                                                                                         | Strongest evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Recency                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| T1  | Expand/collapse state is lost whenever data or another feature's state changes                                                | mui-x [#21398](https://github.com/mui/mui-x/issues/21398) (open), [#13962](https://github.com/mui/mui-x/issues/13962); ag-grid [#600](https://github.com/ag-grid/ag-grid/issues/600), [#1564](https://github.com/ag-grid/ag-grid/issues/1564)                                                                                                                                                                                                                                                             | 2015 → **still open 2026**      |
| T2  | Aggregation is wrong, blank, or unreachable below the top group level                                                         | TanStack [#3323](https://github.com/TanStack/table/issues/3323), [#6228](https://github.com/TanStack/table/issues/6228), [#5769](https://github.com/TanStack/table/issues/5769) + [disc. #5768](https://github.com/TanStack/table/discussions/5768)                                                                                                                                                                                                                                                       | 2021 → **2026**                 |
| T3  | Selection semantics on a group header row are ambiguous and keep regressing                                                   | ag-grid [#11203](https://github.com/ag-grid/ag-grid/issues/11203), [#11209](https://github.com/ag-grid/ag-grid/issues/11209); TanStack [#5700](https://github.com/TanStack/table/issues/5700), [#4879](https://github.com/TanStack/table/issues/4879)                                                                                                                                                                                                                                                     | 2023 → 2025                     |
| T4  | Grouping × (sorting \| filtering \| pagination \| virtual scroll \| editing \| reorder) is broken or explicitly unimplemented | mui-x [#4821](https://github.com/mui/mui-x/issues/4821) (**381 👍**), [#16540](https://github.com/mui/mui-x/issues/16540), [#10417](https://github.com/mui/mui-x/issues/10417); TanStack [#4929](https://github.com/TanStack/table/issues/4929), [#6025](https://github.com/TanStack/table/issues/6025); primeng [#18171](https://github.com/primefaces/primeng/issues/18171), [#11764](https://github.com/primefaces/primeng/issues/11764), [#19293](https://github.com/primefaces/primeng/issues/19293) | 2022 → **2026, mostly open**    |
| T5  | Server-side / manual grouping is documented but not actually usable                                                           | TanStack [disc. #4990](https://github.com/TanStack/table/discussions/4990) (**19 👍, 11 comments**), [disc. #3551](https://github.com/TanStack/table/discussions/3551) (9 👍), [disc. #2656](https://github.com/TanStack/table/discussions/2656) (11 👍)                                                                                                                                                                                                                                                  | 2020 → 2024, never resolved     |
| T6  | The group key itself is the failure point — nulls, objects, arrays, single-member groups                                      | mui-x [#10729](https://github.com/mui/mui-x/issues/10729), [#9094](https://github.com/mui/mui-x/issues/9094), [#13204](https://github.com/mui/mui-x/issues/13204), [#9032](https://github.com/mui/mui-x/issues/9032); ag-grid [#13347](https://github.com/ag-grid/ag-grid/issues/13347)                                                                                                                                                                                                                   | 2023 → **2026**                 |
| T7  | End-user ergonomics: too many clicks, no totals where you look, header scrolls away                                           | mui-x [#11421](https://github.com/mui/mui-x/issues/11421), [#10671](https://github.com/mui/mui-x/issues/10671), [#16766](https://github.com/mui/mui-x/issues/16766); [Telerik 1525732](https://feedback.telerik.com/blazor/1525732-expand-collapse-a-group-by-clicking-on-the-grouping-row-group-header-not-only-the-arrow-icon)                                                                                                                                                                          | 2021 → 2025, all open/unplanned |

---

## T1 — Expand/collapse state is lost, and it has been lost for eleven years

The single most durable complaint in the corpus. Same bug shape, four libraries, 2015 to 2026.

| Source                                                               | Opened     | State                          | What the user said                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ---------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ag-grid [#600](https://github.com/ag-grid/ag-grid/issues/600)        | 2015-12-16 | closed (12 comments)           | Live data via `setRowData` every 10s. "While updating the data … grouped rows again collapse together. If user expand the row means he cant see the inner rows more then 10 sec." Scroll also jumps to top. |
| ag-grid [#1564](https://github.com/ag-grid/ag-grid/issues/1564)      | 2017-04-01 | closed                         | FR: "Allow to get and set the expand/collapse state of the groups; Keep them in the grid state." Only `onRowGroupOpened` existed; state wasn't in `getColumnState()`.                                       |
| mui-x [#13962](https://github.com/mui/mui-x/issues/13962)            | 2024-07-24 | closed (`waiting for author`)  | "When the rows' data is updated, the row groups auto-collapse."                                                                                                                                             |
| mui-x [#21398](https://github.com/mui/mui-x/issues/21398)            | 2026-02-19 | **open**, labelled `type: bug` | Server-side: "1. Sort model changes 2. `getRows` is called and new data returned 3. Expanded state is lost." Notes the docs only demonstrate persistence "triggered from a button click".                   |
| primeng [#19398](https://github.com/primefaces/primeng/issues/19398) | 2026-02-16 | **open**                       | Can't even get groups open on first paint: "When the page is displayed, all collapse elements must be open."                                                                                                |

**Recency matters here — the 2017 ag-grid request was eventually granted.** The current AG Grid
grid-state docs list `rowGroupExpansion` and `ssrmRowGroupExpansion` as first-class state keys,
with a documented caveat that server-side restore needs `serverSideInitialRowCount` set "to a
value which includes the rows to be shown"
([grid-state docs](https://www.ag-grid.com/javascript-data-grid/grid-state/)). So T1's _client-side_
half is a solved problem in the market leader; the _server-side_ half is the still-open 2026
complaint (mui-x #21398).

Two sub-shapes worth separating, because they need different answers:

- **Data churned underneath the groups** (ag-grid #600, mui-x #13962) — the group set is
  recomputed and expansion keyed off identity that no longer matches.
- **Another feature's state changed** (mui-x #21398 — sort model; mui-x
  [#16495](https://github.com/mui/mui-x/issues/16495) — the grouping column itself changed). In
  #16495 (opened 2025-02-06, **open**, last touched 2025-09-09) a detail panel survives the
  change _visually inconsistently_: "The row's icon remains as a minus icon (-), indicating that
  the detail panel is expanded. However, the content of the detail panel is not visible."
  Half-restored is worse than fully reset.

Related, and cheap to overlook: mui-x [#9392](https://github.com/mui/mui-x/issues/9392)
(2023-06-19, closed, 14 comments) wanted an expand/collapse **event hook** purely to lazy-fetch a
group's detail on open — the state isn't only for restoring, consumers want to react to it.

---

## T2 — Aggregation is wrong below depth 0, and the callback can't see enough to fix it

Three independent reports across five years, all the same root shape: **nested groups do not
aggregate like top-level groups.**

| Source                                                                     | Opened     | State         | Finding                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack [#3323](https://github.com/TanStack/table/issues/3323)            | 2021-06-15 | closed        | `aggregateValue` results "only available for aggregations on top level groups (depth = 0)". Reporter located the `!depth` check and proposed removing it.                                                                               |
| TanStack [#5769](https://github.com/TanStack/table/issues/5769)            | 2024-10-02 | closed, 4 👍  | `childRows` is the same as `leafRows` in `aggregationFns`.                                                                                                                                                                              |
| TanStack [disc. #5768](https://github.com/TanStack/table/discussions/5768) | 2024-10-02 | **6 upvotes** | Same author states the assumption plainly: subRows should be "the immediate children of the current grouping which might include other grouping rows" — they aren't. Adds: "I kinda wish the aggregationFn was passed the current row." |
| TanStack [#6228](https://github.com/TanStack/table/issues/6228)            | 2026-04-08 | closed, 1 👍  | Grouping by Department + Age with `aggregationFn: 'min'`: works at the Age-group level, but "at the **Department group level (top-level row)**, the Age cell is **completely blank**".                                                  |

The aggregation _callback contract_ is a second, distinct complaint — the function isn't given
enough to compute anything cross-column:

- mui-x [#11491](https://github.com/mui/mui-x/issues/11491) (2023-12-22, **open**): the custom
  aggregation function gets `{field, groupId, values}` only. "my funky aggregation depends on
  values from _other columns_ than the field in question. When I'm in a grouped grid, I need to
  know the subset of rows that go along with the subset of values that I'm getting passed."
- mui-x [#13027](https://github.com/mui/mui-x/issues/13027) (2024-05-06, **open**, 9 comments):
  server already computed the aggregate; the consumer wants the group row to display _its own_
  value rather than the grid's recomputed one. There is no opt-out per group.

**Aggregation over filtered vs. collapsed rows** — the specific worry in the brief — has one
directly verified hit and one adjacent one:

- TanStack [#1903](https://github.com/TanStack/table/issues/1903) (2020-02-13, closed, react-table
  v7 rc): "column filter should work even rows are collapsed"; filtering on non-grouped columns
  only worked while groups were expanded. Old and on a pre-v8 line — treat as historical.
- ag-grid [#11209](https://github.com/ag-grid/ag-grid/issues/11209) (2025-07-03, closed) is the
  live version of the same class: with an external filter applied, "the group row select box is
  using all the [children]" including filtered-out ones, so the group shows partially-selected
  when every _visible_ child is selected. That is aggregation-over-the-wrong-row-set, expressed
  through selection.
- mui-x [#20897](https://github.com/mui/mui-x/issues/20897) (2026-01-13, **open**,
  `waiting for 👍`) asks for the inverse: "a second 'filter mode' … that won't filter the actual
  rows and filter aggregated values instead" — e.g. `sum(Donation) = 0`. Filtering _by_ an
  aggregate is a capability nobody ships.

---

## T3 — Selection on a group header row has no settled semantics

Every library has shipped this and every library has broken it. Notably, ag-grid broke it as a
**regression across a major version**, which suggests the semantics were never pinned down.

| Source                                                            | Opened     | State                            | Finding                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ag-grid [#11203](https://github.com/ag-grid/ag-grid/issues/11203) | 2025-07-01 | closed (internal ref `ag-15361`) | With `groupHideOpenParents`: clicking a parent checkbox selects "Only the line that was checked". Reporter was on 29.3.5 with `groupSelectsChildren: true`, upgraded to 32.3.4, behavior changed.                                |
| ag-grid [#11209](https://github.com/ag-grid/ag-grid/issues/11209) | 2025-07-03 | closed                           | Group shows partial selection when all filter-visible children are selected (see T2).                                                                                                                                            |
| TanStack [#4879](https://github.com/TanStack/table/issues/4879)   | 2023-05-25 | closed, 2 👍                     | Group rows don't react to sub-row selection state on flat data.                                                                                                                                                                  |
| TanStack [#5700](https://github.com/TanStack/table/issues/5700)   | 2024-08-08 | closed, 5 👍                     | `getIsSomeRowsSelected` inconsistent under grouping. Reporter's diagnosis is the useful part: "the grouped row being considered in the selected state object of the table, even if it not a 'real' row coming from the dataset." |
| mui-x [#13962](https://github.com/mui/mui-x/issues/13962)         | 2024-07-24 | closed                           | "When selecting a row group using the checkbox, it does not select all rows within that group."                                                                                                                                  |

**The design question all five expose:** is a group header row a _row_ (selectable, counted,
present in the selection set) or a _view over rows_ (its checkbox is a bulk action, and it never
appears in the selection set)? TanStack #5700 shows what happens when you never answer: the group
row lands in the selection map and every downstream count is off by the number of groups.

---

## T4 — Feature interaction is where grouping actually breaks

This is the largest theme by volume and the one with the highest single demand signal in the
whole corpus.

### Grouping + drag-reorder — the single biggest vote in this research

mui-x [#4821](https://github.com/mui/mui-x/issues/4821), opened 2022-05-10, **still open**, last
updated 2026-09-01: **381 👍, 66 comments**, labelled `umbrella` + `waiting for 👍`.

The maintainers' own framing is the valuable bit:

> "Currently, when Row Grouping or Tree Data is used, the row reordering feature is disabled.
> This was intentionally made so in order to ship the feature quicker. Also, at the time, there
> were a few unanswered questions regarding how the reordering will work when you try to move a
> child row out of the parent as well as moving a parent to become a child of another parent."

Four years later it is still disabled. Its server-side sibling
[#18947](https://github.com/mui/mui-x/issues/18947) (2025-07-29, open, 2 👍) was split out and
remains open too. **This is the clearest "library authors failed to anticipate it, deferred it,
and the demand never went away" case in the corpus.**

### Grouping + sorting

- mui-x [#16540](https://github.com/mui/mui-x/issues/16540) (2025-02-11, **open**, `type: bug`):
  sort a column, then group by that same column → "The sorting is lost when grouping is applied…
  The sorting indicator (arrow) disappears from the column header." The reporter names the cost
  directly: "Users expect the sorting to [persist]" and calls it "an inconsistent user experience".
- TanStack [#4211](https://github.com/TanStack/table/issues/4211) (2022-07-22, closed, 5 👍):
  columns inside nested groups don't re-sort.
- TanStack [disc. #2428](https://github.com/TanStack/table/discussions/2428) (2020-06-09) is the
  precedence-confusion complaint stated from the end user's side. `@TimMcCauley`: "I group a
  column A and column B sums up the integers within that group. If I now sort column B it will
  consider all the subRows, too. However, this behaviour is slightly confusing for the user who
  would rather want to sort by the grouped sum."
- mui-x [#5650](https://github.com/mui/mui-x/issues/5650) (2022-07-29, **open**): with
  `sortingMode: server`, "the rows are rendered at the top and groups at the bottom".

**Group ordering is the one item on the brief's list that a competitor has genuinely solved.**
AG Grid's [grouping-sorting docs](https://www.ag-grid.com/javascript-data-grid/grouping-sorting/)
document that with no sort applied "the groups are ordered by the order in which they appear in
the data"; `initialGroupOrderComparator` overrides that but "executes before filtering and
aggregation" so it "cannot use post-filtered data, or aggregated values as comparison criteria";
`autoGroupColumnDef.comparator` unlinks group sorting from the source column entirely (e.g. sort
groups by descendant count); and `groupMaintainOrder: true` stops a leaf-column sort from
reordering the groups themselves. The stated cost of the comparator route: "sorting the `Group`
column no longer impacts the columns with row grouping, and vice versa."

So the real remaining gap in group ordering is narrow and specific: **you cannot order groups by
an aggregate, because ordering runs before aggregation.**

### Grouping + pagination

- mui-x [#10417](https://github.com/mui/mui-x/issues/10417) (2023-09-20, **open**) is a pure
  end-user complaint dressed as a feature request: 15k records in a 3-tier group model paginated
  by _groups_, so "I have some pages with hundreds of rows and others with maybe 15." Wants
  page-size counted in rows, with a group that straddles a page boundary repeating its header at
  the top of the next page.
- TanStack [#6025](https://github.com/TanStack/table/issues/6025) (2025-05-28, closed, 2 👍):
  adding `getGroupedRowModel()` to the stock pagination example makes `pageIndex` reset to 0
  immediately.
- primeng [#11764](https://github.com/primefaces/primeng/issues/11764) (2022-08-01, **open**, 8
  comments): lazy `p-table` — "On the first page, it correctly groups… but on all subsequent
  pages the grouping stops and each line is shown individually." Regression introduced in
  PrimeNG 14, open four years.
- mui/material-ui [#36413](https://github.com/mui/material-ui/issues/36413) (2023-03-03, closed):
  with controlled (server) pagination, grouped values could not be expanded at all; client-side
  pagination was fine.

### Grouping + virtual scroll

- TanStack [#4929](https://github.com/TanStack/table/issues/4929) (2023-06-23, **open**, 5 👍,
  last updated 2026-01-09): combining virtual scrolling and row grouping produces an infinite
  loop — "endless console messages and the browser tab will freeze." Three years open.
- primeng [#19293](https://github.com/primefaces/primeng/issues/19293) (2026-01-16, **open**,
  auto-labelled `Resolution: Stale`): "When virtual scrolling is enabled for a grouped table, the
  header and footer rows do not appear" — reproducible on PrimeNG's own documentation examples.
- TanStack [#6265](https://github.com/TanStack/table/issues/6265) (2026-05-16, closed) asked for
  exactly this as a feature: "a built-in row grouping API optimized for virtualization."

### Grouping + inline editing

mui-x [#5355](https://github.com/mui/mui-x/issues/5355) (2022-06-30, **open**, 14 comments,
12 👍, `waiting for 👍`) — "Is there a way to make a grouped row / cell editable?" Four years, no
answer. mui-x [#17940](https://github.com/mui/mui-x/issues/17940) (2025-05-21, **open**, 7
comments, 2 👍) is the sharper version: "Inline editing works fine on the column but as soon as
it's the leaf node the inline editing disappears and I cannot find any mechanism to re-enable it."

### Grouping + expansion (detail panels / tree)

primeng [#18171](https://github.com/primefaces/primeng/issues/18171) (2025-04-26, **open**, last
touched 2026-09-02) is the cleanest statement that these two features collide: "The combination of
row grouping and expandable rows does not work properly. 1. The group header gets shown after the
first row. 2. The `pRowToggler` toggles the expansion of _all_ rows of the group." Both group
expansion and row expansion want the same toggle affordance and the same row-level state slot.

mui-x [#16495](https://github.com/mui/mui-x/issues/16495) (see T1) is the same collision from the
state-reconciliation side.

### Grouping + row pinning / row spanning

- TanStack [#5822](https://github.com/TanStack/table/issues/5822) (2024-12-03, closed): pin an
  aggregation row, then ungroup → hard error, because `table.getRow(rowId, true)` is called "on an
  aggregation row that no longer exists". Synthetic group rows leaking into other features' id
  stores.
- mui-x [#16805](https://github.com/mui/mui-x/issues/16805) (2025-03-03, closed): grouping + row
  spanning + footer-positioned aggregation "causes some rows to span to rows outside of the group".

---

## T5 — Server-side / manual grouping: documented, not usable

The highest-engagement grouping thread in the TanStack repo is
[discussion #4990, "[v8] Manual grouping on server"](https://github.com/TanStack/table/discussions/4990)
— opened 2023-07-25, **19 upvotes, 11 comments**, never resolved by a maintainer. The whole thread
is people discovering the option exists and does nothing usable:

- `@tkfmed` (2023-09, 5 👍): quotes the `manualGrouping` doc text, then — "Ok. I'm expected to
  manually group the rows. But what does it mean in `the table` environment[?]"
- `@charl0tee` (2023-12): "There is no documentation or example of how the data should be passed
  for `manualGrouping` which we really need on our current project."
- `@waltershewmake` (2024-01, 3 👍): "Any update on this? Crazy that there is no info available"
- `@deshiknaves` (2024-03): after digging in — "there is no way to pass something that is pre
  grouped in the shape that the table internals expect."
- `@Eliav2` (2024-06): "If this property doesn't do anything why it's in the docs? It should be
  removed."

It was ultimately answered by a _community member_ publishing an external example repo, not by the
library. Two older discussions asked the same thing and also went unanswered:
[#2656 "Manual Grouping"](https://github.com/TanStack/table/discussions/2656) (2020-08-20,
**11 upvotes**) and [#3551](https://github.com/TanStack/table/discussions/3551) (2021-11-19,
**9 upvotes**, "Cannot find examples of sever-side grouping, usage of manualGroupBy option").

The [current grouping guide](https://tanstack.com/table/v8/docs/guide/grouping) confirms the state
of it in the library's own words:

> "There are not currently many known easy ways to do server-side grouping with TanStack Table.
> You will need to do lots of custom cell rendering to make this work."

**This is the strongest unimplemented-but-recurring signal in the corpus** (39 upvotes across
three threads, six years, zero maintainer resolution). It is also the theme with the most direct
bearing on this repo — see the sibling
[research-grouping-state-ownership.md](research-grouping-state-ownership.md), which reaches the
same conclusion structurally rather than from community evidence.

Adjacent, verified on ag-grid's SSRM path: [#13347](https://github.com/ag-grid/ag-grid/issues/13347)
(2026-03-20, **open**) — expanding a group whose value is `null` passes `groupKeys` as `[]`
instead of `[null]` to `getRows()`, described as a regression "from earlier versions". The
server can't tell "top level" from "the null group".

---

## T6 — The group key is where grouping actually fails

Every library assumes the grouped value is a primitive that stringifies usefully. Real data
isn't.

| Source                                                            | Opened     | State                 | Finding                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ---------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mui-x [#10729](https://github.com/mui/mui-x/issues/10729)         | 2023-10-19 | **open**, 10 comments | Object-valued fields: "If you have a value that is an object the group key is `autogenerategroupORwhatever-[Object Object]`." Reporter: "it feels like there is a contradiction occuring when trying to use all the grids capabilities when it comes to object values." |
| mui-x [#9094](https://github.com/mui/mui-x/issues/9094)           | 2023-05-23 | **open**              | null/undefined are deliberately _not_ grouped by MUI's design; consumer renders `"---"` via `valueGetter` and wants those rows grouped under that key.                                                                                                                  |
| mui-x [#13204](https://github.com/mui/mui-x/issues/13204)         | 2024-05-22 | **open**, 1 👍        | Same, expressed as a UX defect: null-valued rows render inline rather than as a group, "so that they can be expanded in the same way as other groups".                                                                                                                  |
| mui-x [#15833](https://github.com/mui/mui-x/issues/15833)         | 2024-12    | open                  | Grouping on an array-of-strings column. **Unverified** — surfaced in search results, body not fetched.                                                                                                                                                                  |
| ag-grid [#13347](https://github.com/ag-grid/ag-grid/issues/13347) | 2026-03-20 | **open**              | `null` group key collapses to an empty `groupKeys` array on the wire (see T5).                                                                                                                                                                                          |

And the single-member-group ergonomics complaint, which is a key-cardinality problem wearing a UX
hat — mui-x [#9032](https://github.com/mui/mui-x/issues/9032) (2023-05-18, **open**,
`waiting for 👍`):

> "If the group size is 1 this creates an unnecessary extra click when navigating the data. It is
> possible to auto-expand the group based on the group size, but then it feels like the group row
> is wasting vertical space."

---

## T7 — End-user ergonomics (as opposed to integrator complaints)

Harder to source directly — end users file bugs through their developers — but four items are
unambiguously written from the person-in-front-of-the-table's point of view.

**No cheap way to collapse everything.** mui-x
[#11421](https://github.com/mui/mui-x/issues/11421) (2023-12-15, **open**, 9 comments, 8 👍,
`waiting for 👍`): "Currently there is no native method to expand/collapse all grouped rows."
The reporter built two workarounds and reports both fail: "sadly, none of them is performant
enough to provide a good user experience for more than one grouping column." ag-grid
[#8621](https://github.com/ag-grid/ag-grid/issues/8621) (2024-08-29, closed) is the adjacent
problem — even with `expandAll()`/`collapseAll()` available, there's no way to know whether all
nodes are currently expanded, so an Expand All / Collapse All button can't render its own state.

**The group header scrolls away and you lose your place.** mui-x
[#10671](https://github.com/mui/mui-x/issues/10671) (2023-10-13, **open**, 7 comments, 16 👍,
`waiting for 👍`) — this is the purest end-user complaint found:

> "When using row grouping as you scroll you lose all context of what the value is for your
> current group if you have a lot of rows in each group. A great feature would be for the summary
> row of each group to stick to the top as you scroll so you can always see the current group (or
> groups if nested) that you are in."

**Totals are in the wrong place to be read.** mui-x
[#16766](https://github.com/mui/mui-x/issues/16766) (2025-02-28, **open**) argues from real
finance usage that group subtotals belong at the _bottom_ of the group:

> "showing financial or sales data, which is what we are using it for, it really doesn't make any
> sense to have the sub-totals at the top of the group. Furthermore, our users do not want to
> expand every row, they want to see every row, so they are auto-expanded by default."

Same request, TanStack side, unanswered:
[disc. #6066](https://github.com/TanStack/table/discussions/6066) (2025-07-30) — "Is it possible
to render a row for each grouping of rows, located at the bottom of each grouping and containing
totals for some of the columns[?]"

**The click target is only the chevron.** Telerik feedback portal item
[1525732](https://feedback.telerik.com/blazor/1525732-expand-collapse-a-group-by-clicking-on-the-grouping-row-group-header-not-only-the-arrow-icon)
(2021-06-28, status **Unplanned**, 8 votes): "I would like to click on the grouping row and expand
the Group." A commenter adds it "makes it consistent with most websites that offer this type of
functionality." A template-based workaround was posted by a Telerik admin in 2022; the core
behavior remains unimplemented.

**No group counts** — the brief lists this; **not verified**. Searches surfaced only vendor docs
showing counts are achievable via a group-header template (Angular SlickGrid's `g.count`, Telerik
`GroupHeaderTemplate`), not a complaint that they're missing. Treat "users want counts in the
group header" as plausible-but-unevidenced from this pass.

---

## Cross-cutting observations

1. **Grouped rows are synthetic rows, and every other feature assumes rows are real.** TanStack
   #5700 (selection map), #5822 (pinning holds a dead group-row id), mui-x #6735 (the auto group
   column is absent from `initialState`, so a saved user view can't restore its width — 2022-11-04,
   **open**, 7 comments), and mui-x #16495 (detail-panel state keyed to a row that regrouped) are
   four instances of the same underlying problem in three libraries.

2. **The grouped column vanishing is a deliberate default, not a bug — and people still trip on
   it.** TanStack's `groupedColumnMode` defaults to `'reorder'`, which per the
   [grouping guide](https://tanstack.com/table/v8/docs/guide/grouping) means "the grouped columns
   will be moved to the start of the table"; `'remove'` deletes them; `false` leaves them alone.
   AG Grid's variant produced a stream of "how do I hide/show the group column" traffic —
   [#7994](https://github.com/ag-grid/ag-grid/issues/7994) (2024-05-20) and the older
   [#1590](https://github.com/ag-grid/ag-grid/issues/1590) (2017-04-13), where "Group Column
   Disappears When Hiding Any Other Column."

3. **Group _display_ order and group _nesting_ order get conflated.** ag-grid
   [#14635](https://github.com/ag-grid/ag-grid/issues/14635) (2026-07-28, **open**, last updated
   2026-09-08) — with `groupDisplayType: 'multipleColumns'`, "the last groping column shifted to
   index 0 every time", against the expectation that "Grouping should follow the same order in
   which the columns are grouped." The most recent open grouping bug in the corpus.

4. **"Add a row into a group" was never designed anywhere.** Three ag-grid issues, all closed
   without a feature: [#2089](https://github.com/ag-grid/ag-grid/issues/2089) (2017-11-30) —
   adding `rowGroup: true` makes `addIndex` ignored and new rows always land at the bottom;
   [#2815](https://github.com/ag-grid/ag-grid/issues/2815) (2018-12-05) — insert by index "always
   appends at the end", with the reporter pointing at `insertOneNode` pushing to the end of
   `childrenAfterGroup`; and [#1672](https://github.com/ag-grid/ag-grid/issues/1672) (2017-05-29),
   which names the real requirement — add/remove rows _without re-applying grouping_, because "user
   input will get scattered in grid, and hard to review for user" if the new row immediately jumps
   to whichever group its typed value now matches. That last one is a genuine product question
   (when does a row re-group?) that no library in this survey answers.

5. **Grouping performance complaints exist but are thinner than expected.** TanStack
   [#4551](https://github.com/TanStack/table/issues/4551) (2022-11-22, closed, 9 comments) —
   v8's groupBy measured "much" slower than v7's. mui-x
   [#9197](https://github.com/mui/mui-x/issues/9197) (2023-06-02, closed, `performance` label) —
   100k rows grouped by two columns. Both are closed and neither has a live successor; the
   _interaction_ bugs (T4) outnumber pure perf complaints by roughly ten to one in this corpus.

---

Sources: mui/mui-x issues [#4821](https://github.com/mui/mui-x/issues/4821),
[#5355](https://github.com/mui/mui-x/issues/5355), [#5650](https://github.com/mui/mui-x/issues/5650),
[#6735](https://github.com/mui/mui-x/issues/6735), [#9032](https://github.com/mui/mui-x/issues/9032),
[#9094](https://github.com/mui/mui-x/issues/9094), [#9197](https://github.com/mui/mui-x/issues/9197),
[#9392](https://github.com/mui/mui-x/issues/9392), [#10417](https://github.com/mui/mui-x/issues/10417),
[#10671](https://github.com/mui/mui-x/issues/10671), [#10729](https://github.com/mui/mui-x/issues/10729),
[#11421](https://github.com/mui/mui-x/issues/11421), [#11491](https://github.com/mui/mui-x/issues/11491),
[#13027](https://github.com/mui/mui-x/issues/13027), [#13204](https://github.com/mui/mui-x/issues/13204),
[#13962](https://github.com/mui/mui-x/issues/13962), [#15605](https://github.com/mui/mui-x/issues/15605),
[#16495](https://github.com/mui/mui-x/issues/16495), [#16540](https://github.com/mui/mui-x/issues/16540),
[#16766](https://github.com/mui/mui-x/issues/16766), [#16805](https://github.com/mui/mui-x/issues/16805),
[#17940](https://github.com/mui/mui-x/issues/17940), [#18947](https://github.com/mui/mui-x/issues/18947),
[#20897](https://github.com/mui/mui-x/issues/20897), [#21398](https://github.com/mui/mui-x/issues/21398) ·
mui/material-ui [#36413](https://github.com/mui/material-ui/issues/36413) ·
TanStack/table issues [#1903](https://github.com/TanStack/table/issues/1903),
[#3323](https://github.com/TanStack/table/issues/3323), [#4211](https://github.com/TanStack/table/issues/4211),
[#4551](https://github.com/TanStack/table/issues/4551), [#4879](https://github.com/TanStack/table/issues/4879),
[#4929](https://github.com/TanStack/table/issues/4929), [#5594](https://github.com/TanStack/table/issues/5594),
[#5700](https://github.com/TanStack/table/issues/5700), [#5769](https://github.com/TanStack/table/issues/5769),
[#5822](https://github.com/TanStack/table/issues/5822), [#6025](https://github.com/TanStack/table/issues/6025),
[#6228](https://github.com/TanStack/table/issues/6228), [#6265](https://github.com/TanStack/table/issues/6265)
and discussions [#2428](https://github.com/TanStack/table/discussions/2428),
[#2656](https://github.com/TanStack/table/discussions/2656),
[#3551](https://github.com/TanStack/table/discussions/3551),
[#4990](https://github.com/TanStack/table/discussions/4990),
[#5768](https://github.com/TanStack/table/discussions/5768),
[#6066](https://github.com/TanStack/table/discussions/6066) ·
ag-grid/ag-grid issues [#600](https://github.com/ag-grid/ag-grid/issues/600),
[#1564](https://github.com/ag-grid/ag-grid/issues/1564), [#1590](https://github.com/ag-grid/ag-grid/issues/1590),
[#1672](https://github.com/ag-grid/ag-grid/issues/1672), [#2089](https://github.com/ag-grid/ag-grid/issues/2089),
[#2815](https://github.com/ag-grid/ag-grid/issues/2815), [#7994](https://github.com/ag-grid/ag-grid/issues/7994),
[#8621](https://github.com/ag-grid/ag-grid/issues/8621), [#11203](https://github.com/ag-grid/ag-grid/issues/11203),
[#11209](https://github.com/ag-grid/ag-grid/issues/11209), [#13347](https://github.com/ag-grid/ag-grid/issues/13347),
[#14635](https://github.com/ag-grid/ag-grid/issues/14635) ·
primefaces/primeng issues [#11764](https://github.com/primefaces/primeng/issues/11764),
[#18171](https://github.com/primefaces/primeng/issues/18171),
[#19293](https://github.com/primefaces/primeng/issues/19293),
[#19398](https://github.com/primefaces/primeng/issues/19398) ·
[Telerik feedback 1525732](https://feedback.telerik.com/blazor/1525732-expand-collapse-a-group-by-clicking-on-the-grouping-row-group-header-not-only-the-arrow-icon) ·
docs pages: [TanStack grouping guide](https://tanstack.com/table/v8/docs/guide/grouping),
[AG Grid grid state](https://www.ag-grid.com/javascript-data-grid/grid-state/),
[AG Grid grouping sorting](https://www.ag-grid.com/javascript-data-grid/grouping-sorting/),
[MUI X server-side row grouping](https://mui.com/x/react-data-grid/server-side-data/row-grouping/).

Issue metadata (state, dates, comment and 👍 counts) read via `gh api repos/<owner>/<repo>/issues/<n>`
on 2026-09-10; discussion upvote counts via the GitHub GraphQL API the same day.

## Not researched

- **Reddit and long-form UX writing.** Searched r/reactjs, r/Angular2, r/webdev and general
  "grouped table UX" blog queries; every result was either vendor documentation or a GitHub issue
  already captured above. No citable community-forum or design-blog source was found, so **no
  Reddit claim appears in this doc**. A manual pass through Reddit search (rather than a web
  search engine) might surface material this missed.
- **Stack Overflow.** `site:stackoverflow.com` queries consistently returned GitHub and vendor
  docs instead of SO answers. SO question volume by tag (`ag-grid` + grouping, etc.) would be a
  better proxy for "what integrators get stuck on" than issue counts, and was not obtained.
- **Group counts in group headers.** The brief lists it; no complaint was found. Marked
  unevidenced in T7 rather than asserted.
- **Keyboard and screen-reader behavior on group rows.** ag-grid has a cluster of ARIA issues
  touching grouped grids ([#12892](https://github.com/ag-grid/ag-grid/issues/12892),
  [#15012](https://github.com/ag-grid/ag-grid/issues/15012)) that were surfaced but not read. A11y
  of a group header row (`role`, `aria-expanded`, `aria-level`, whether it is a focus stop) is its
  own research question and is not covered here.
- **Pivoting.** Deliberately excluded — it shares machinery with grouping but is a distinct
  product surface. Several ag-grid and mui-x pivot issues were seen and skipped.
- **AG Grid Enterprise closed-tracker outcomes.** AG Grid closes GitHub issues into a private
  tracker, so for every ag-grid item above, "closed" does not establish "fixed". Only
  [#1564](https://github.com/ag-grid/ag-grid/issues/1564) was confirmed shipped, by reading the
  current grid-state docs. The rest carry unknown resolution status.
- **How often each complaint reaches a paying customer.** MUI X labels several of these
  `support: premium standard`, meaning they arrived through paid support rather than open
  reporting — a stronger demand signal than 👍 count, but not quantifiable from the public API.
- **Whether any of the closed TanStack issues were fixed in v9.** Several closed items were
  last updated in mid-2026 during what looks like a bulk triage sweep; no fix commit was traced.
