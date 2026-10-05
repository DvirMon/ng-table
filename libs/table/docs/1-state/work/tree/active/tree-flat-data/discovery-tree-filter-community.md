# Filtering a tree grid: when a filter matches a child but not its parent (or the reverse), what do people expect, and what hurts today?

**Date:** 2026-09-27 · **Mode:** community-pain

## Answer

- **Keeping a match's ancestors visible as context is the one behavior nobody argues with.** Users
  file bugs when it is missing, and it is the default in every vendor read here.
- **The request that keeps coming back is "the parent matched, so show its children".** It has
  been filed on 7 trackers or forums between 2013 and 2025. Vendors answer it three different
  ways: on by default (AG Grid, PrimeNG), available as an option (DevExtreme, Syncfusion,
  Ignite UI), or not available at all (MUI, Kendo/Telerik). MUI #10024 is still open after 3 years.
- **The second-largest pain is a match hidden under a collapsed ancestor.** One reporter says
  "It looks like there are no results." Vendors disagree on auto-expanding.
- **Collisions are where users disagree with each other.** Selection: do hidden descendants get
  selected? Pagination: count root rows or visible rows? Lazy children: a filter cannot see rows
  that have not loaded yet.
- **Orphans (the parent is filtered out or missing):** only one citable data point. The user
  promoted the orphan to root by hand. No evidence was found for the other options.

## Method and source reliability

Read 2026-09-27. Issues were read from `api.github.com/repos/<owner>/<repo>/issues/<n>`, which
returns state, dates and reaction counts, until the unauthenticated rate limit returned 403
mid-run. Rows marked **(HTML)** were then read from the `github.com` issue page. That page did
**not** return close dates or reaction counts, so those cells say "not returned". Forum threads
and vendor docs were fetched directly. Vendor docs are pinned to a tag where possible:

| Source                                     | Pin       | Where the pin came from                                                   |
| ------------------------------------------ | --------- | ------------------------------------------------------------------------- |
| AG Grid docs                               | `b36.2.0` | raw `.mdoc` at the git tag (tags use a `b` prefix, per discovery-sources) |
| MUI X docs                                 | `v9.14.0` | raw markdown at the git tag                                               |
| PrimeNG                                    | `22.1.1`  | `registry.npmjs.org/primeng/latest`, then the unpkg bundle                |
| DevExtreme, Syncfusion, Telerik, Ignite UI | unpinned  | the live docs sites show no version marker                                |

Reliability notes that change how a number reads:

- **`ag-grid/ag-grid`: `closed` does not mean fixed, and 👍 is zero everywhere, which carries no
  signal.** #2022 was closed with a boilerplate "no capacity for GitHub feature requests"
  comment. #3131 was closed for lacking a reproduction. Neither close is a fix.
- **`mui/mui-x`: 👍 is real signal, and `support: commercial` plus an Order ID means a paying
  customer filed it.** That is stronger than 👍 but cannot be counted. #10024 and #6812 both
  have 0–1 👍 but come from paying customers.
- **`TanStack/table`: watch for sweep closes.** #4724 was closed 2026-07-27 with "was fixed in
  v9". The events API shows **no commit** attached to the close. The fix is unverified.
- **`primefaces/primeng`: #8192 and #9281 were both closed on 2022-11-09, 11 minutes apart.**
  Both were still labelled `Status: Pending Review` after 2–3 years. That pattern fits a triage
  sweep. The closing comments could not be read (403), so the sweep is an inference.
- **`microsoft/vscode`: 👍 is real signal.** #66971 has 171 👍 across 55 comments.
- **Telerik and Syncfusion forums:** staff replies are vendor statements about the product, not
  implementations. DevExpress Support Center ticket pages are rendered by JavaScript, and a fetch
  returned an empty template, so no DevExpress ticket body was read.
- **Search-engine summaries were used as pointers only.** Every row below was re-read from the
  page itself.
- Reaction counts across trackers are **not comparable**. Read them per row, never summed.

## Findings

### T1 — A child matches, its parent does not: people expect the ancestors kept as context

| Source                                                                                                              | Opened     | State (as read)                      | What was said                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [TanStack #4190](https://github.com/TanStack/table/issues/4190)                                                     | 2022-07-20 | closed 2022-11-12, 5 👍, 5 comments  | "If the filter value matches only the sub row, nothing is displayed (maybe an AND where an OR is needed?)". Expected: the matching child and its parent both visible     |
| [TanStack disc. #3828](https://github.com/TanStack/table/discussions/3828)                                          | 2022-04-13 | answered, 0 upvotes                  | "Is there a way to make sub rows filterable from the global filter? Now it ignores and kinda turns off the expansion plugin"                                             |
| [Tabulator #2281](https://github.com/olifolkerd/tabulator/issues/2281)                                              | 2019-08-07 | closed 2020-08-23, 1 👍, 16 comments | Commenter takuy: filtering for "BIG" returns nothing because the parent row does not contain "BIG" (paraphrased by the fetch; not verbatim)                              |
| [Kendo jQuery forum](https://www.telerik.com/forums/treelist-filter-parents-only)                                   | 2016-07-11 | forum                                | Telerik staff: "Filter descriptors are applied against all data items. Then for each node the path back to the root node is rebuild, so that the node can be visualized" |
| [Telerik Blazor TreeList docs](https://www.telerik.com/blazor-ui/documentation/components/treelist/filter/overview) | —          | vendor doc                           | "Filtering keeps an item's parent(s) in the list, so you may see item that do not match the criteria."                                                                   |

Counter-voice: in the same Kendo thread, users in 2020 complained that parent rows **not**
matching were displayed and did not suit their use case. This is the fetch's paraphrase; no
verbatim quote was obtained.

Every vendor read keeps ancestors, by default or as an option: MUI ("a node is included if it
_or_ any of its descendents passes",
[tree-data.md@v9.14.0](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md)),
DevExtreme (`filterMode` default `'withAncestors'`,
[API ref](https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/#filterMode)),
Syncfusion (`Parent` is the default,
[filtering doc](https://help.syncfusion.com/grid-sdk/javascript/tree-grid/filtering/filtering)),
and Ignite UI (`showWithAncestors` is the default,
[igTreeGrid filtering](https://www.igniteui.com/help/igtreegrid-filtering)).

### T2 — A parent matches, its children do not: people want the descendants kept (the resurfacing request)

| Source                                                                                                          | Opened     | State (as read)                                                              | Use case                                          | What was said                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Telerik Silverlight forum](https://www.telerik.com/forums/filter-parent-show-all-children-in-treelistview)     | 2013-05-02 | forum                                                                        | employees → expenses                              | Wanted all children of matching parents. The workaround built huge OR clauses and hit a stack overflow. Staff: "limit your query"                                                    |
| [Kendo jQuery forum](https://www.telerik.com/forums/treelist-filter-parents-only)                               | 2016-07-11 | forum                                                                        | —                                                 | Asked for parent rows plus all their children. Staff confirmed no alternative filter behavior was supported                                                                          |
| [AG Grid #3131](https://github.com/ag-grid/ag-grid/issues/3131)                                                 | 2019-05-13 | closed 2019-06-06 (no reproduction), 0 👍                                    | —                                                 | "Filtering a tree grid and keeping children rows". Wanted the children of filtered parents shown                                                                                     |
| [Tabulator #2281](https://github.com/olifolkerd/tabulator/issues/2281)                                          | 2019-08-07 | closed 2020-08-23                                                            | —                                                 | supportdesk-si (2020-01-08) asked for child rows to show when the parent matches. Maintainer shipped `dataTreeFilter` in 4.8                                                         |
| [MUI X #10024](https://github.com/mui/mui-x/issues/10024)                                                       | 2023-08-13 | **open**, 0 👍, 8 comments, `plan: Pro`, `support: commercial` (Order 56081) | clusters → items                                  | "the rows that are showing are only the filtered row and the parents of that row. Is there a way to also show all the children of that row?"                                         |
| same, maintainer romgrk                                                                                         | 2023-08-28 | —                                                                            | —                                                 | "I think the use-case is rare enough that it would be fine to provide something with a lesser DX … our tree data filtering is kinda slow so I'd be wary of making it even slower"    |
| same, mauretanec                                                                                                | 2024-05-21 | —                                                                            | clusters → items                                  | "I think this use case is not so rare … when editing the filtered items I need to validate these changes with other items in the cluster and show eventual issues for the user."     |
| same, Gijs-W                                                                                                    | 2024-06-21 | —                                                                            | —                                                 | "I also don't think that this use case is rare, seeing that we have a similar issue"                                                                                                 |
| same, kee0624                                                                                                   | 2025-06-28 | —                                                                            | —                                                 | "we currently need this feature on our product … We need the child row to be returned when the parent row is matched with the filter result"                                         |
| [Telerik Blazor forum](https://www.telerik.com/forums/show-children-when-search-filter-treelist-matches-parent) | 2024-01-03 | forum                                                                        | category → items ("Fruit" → Apple, Orange, Grape) | Staff (2024-01-05): keep two collections and write a custom search. The approach is "rather cumbersome due to the mixture of load-on-demand and maintaining of two data collections" |
| [MRT disc. #1225](https://github.com/KevinVandy/material-react-table/discussions/1225)                          | 2024-08-26 | unanswered, 0 upvotes                                                        | —                                                 | With `filterFromLeafRows`, searching for a parent row hides its children                                                                                                             |
| [MudBlazor #10906](https://github.com/MudBlazor/MudBlazor/issues/10906)                                         | 2025-02-19 | **open**, 0 👍, `good first issue`                                           | tree view                                         | "it currently hides children of elements matching filter (when they themselves do not match)." Asks for "a toggle"                                                                   |

- **Age:** the same request runs from 2013 to 2025 across five vendors.
- **Kendo/Telerik has answered it with "write custom code" three times:** 2013, 2016 and 2024.
- **Sibling rows are a sub-request.** MUI #10024's reporter also wants "all the siblings of the
  filtered row". mauretanec needs siblings for cross-row validation. None of the vendor docs read
  here offers a siblings mode.

### T3 — "Filter only one level" (root-only, or leaves-only)

| Source                                                                    | Opened     | State (as read)                                     | What was said                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Tabulator #2281](https://github.com/olifolkerd/tabulator/issues/2281)    | 2019-08-07 | closed 2020-08-23                                   | Expected: "Filtering (as documented) should only affect parent rows, child rows are not filtered, but are available for hide/show on the visible parent rows."                                                                                          |
| [AG Grid #2022](https://github.com/ag-grid/ag-grid/issues/2022)           | 2017-10-31 | closed 2017-12-05 ("no capacity" boilerplate), 0 👍 | "the parent row is not validated against the filter unless at least a child row passes the filter. This makes it impossible to show a parent node for a certain condition that doesn't apply to its children." Use case: car make → model (Ford Mondeo) |
| [AG Grid #1532](https://github.com/ag-grid/ag-grid/issues/1532)           | 2017-03-17 | closed 2017-03-20, 0 👍                             | Parent/group nodes were not matched by a column filter. Searching "child" found rows, "group" found none                                                                                                                                                |
| [MRT #851](https://github.com/KevinVandy/material-react-table/issues/851) | 2023-12-03 | **open**, 0 👍                                      | `maxLeafRowFilterDepth: 0` still searched every level. The user wanted top-level-only search                                                                                                                                                            |

Shipped answers: MUI `disableChildrenFiltering` (root only,
[tree-data.md@v9.14.0](https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md)),
Tabulator `dataTreeFilter` (per the maintainer's comment on #2281), and Ignite UI
`fromLevel`/`toLevel` ([igTreeGrid](https://www.igniteui.com/help/igtreegrid-filtering)).
No request for "filter leaves only, never parents" was found. `fromLevel: 1` is the only
shipped form of it read here.

### T4 — Matches hidden under a collapsed ancestor: auto-expand

| Source                                                                     | Opened     | State (as read)                                     | What was said                                                                                                                                                                                                            |
| -------------------------------------------------------------------------- | ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [PrimeNG #8192](https://github.com/primefaces/primeng/issues/8192)         | 2019-10-02 | closed 2022-11-09 (possible sweep), 0 👍            | "p-treetable filter doesn't expand the results when found, the tree gets collapsed … It is confusing and not user friendly if we have to expand the nodes manually after filtering. It looks like there are no results." |
| [PrimeNG #15190](https://github.com/primefaces/primeng/issues/15190)       | 2024-03-28 | closed 2024-12-25, 1 👍                             | In lenient mode, a matching folder is not expanded when its child also matches. "In lenient mode, all results matching the search must be visible."                                                                      |
| [MUI X #6812](https://github.com/mui/mui-x/issues/6812) (HTML)             | 2022-11-11 | **open**, `support: commercial` (Order 48449)       | "Expand group on quick filter"                                                                                                                                                                                           |
| [MUI X #11906](https://github.com/mui/mui-x/issues/11906)                  | 2024-02-01 | closed **2026-09-09 as duplicate** of #6812, 1 👍   | Auto-expand tree-data rows on a column filter. Maintainer on close: "The feature is not built in yet"                                                                                                                    |
| [MUI X #11892](https://github.com/mui/mui-x/issues/11892)                  | 2024-01-31 | **open**, 0 👍                                      | Asks for an API that expands every ancestor so a deep child becomes visible                                                                                                                                              |
| [TanStack disc. #5703](https://github.com/TanStack/table/discussions/5703) | 2024-08-09 | answered                                            | "auto-expand to 1st found leaf, or, if its too complex, auto-expand all rows"                                                                                                                                            |
| [VS Code #167181](https://github.com/microsoft/vscode/issues/167181)       | 2022-11-24 | closed 2022-11-28 not_planned (duplicate of #66971) | End user, file explorer: "the Explorer Find 'filter' option doesn't automatically unveil files in folded directories". Proposes an expand-then-restore setting                                                           |
| [VS Code #179600](https://github.com/microsoft/vscode/issues/179600)       | 2023-04-10 | closed 2023-04-24 not_planned                       | End user, file explorer: compares VS Code with Xcode. Matches are not auto-expanded ("only a bullet indicator"), and folders with no matches still show                                                                  |

Counter-position, stated deliberately by a vendor: Telerik Blazor says "Filtering keeps the
expanded/collapsed state of items. For example, if filtering leaves a child whose parent is
collapsed, you will only see the collapsed parent."
([docs](https://www.telerik.com/blazor-ui/documentation/components/treelist/filter/overview)).

### T5 — Marking matched rows vs context rows

- Ignite UI ships it: `showWithAncestors` "renders matches in full opacity along with their
  parent nodes with lower opacity", plus a per-record `matchFiltering` flag
  ([igTreeGrid](https://www.igniteui.com/help/igtreegrid-filtering)).
- Community demand is thin. The Kendo 2020 complaints about non-matching parents (T1) and
  VS Code #179600's "only a bullet indicator" are the closest signals. **No issue asking to
  style context rows differently was found** on the seven in-scope trackers.

### T6 — Orphans (the parent is filtered out or missing from data)

| Source                                                                                                                                                                                | Opened     | State (as read)      | What was said                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Syncfusion EJ2 forum #185154](https://www.syncfusion.com/forums/185154/show-data-if-parent-is-not-displayed)                                                                         | 2023-10-26 | resolved by the user | "when I filter the data via predicates model and some result records do not have a parent record (because it's filtered out), the child record is not displayed." Resolution (2023-11-05): "I changed application Logic by delete ParentId value, if parent does not exists." (**the user promoted the orphan to root by hand**) |
| [AG Grid self-referential docs @b36.2.0](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-self-referential/index.mdoc) | —          | vendor doc           | "cycles and missing parent rows are not allowed". The page does not say what the grid does instead                                                                                                                                                                                                                               |

- This is the only citable community data point on orphans. It supports promote-to-root.
- **No evidence was found for "drop the orphan's subtree"** as a user expectation.

### T7 — Collision: selection under a filter

| Source                                                                 | Opened     | State (as read)                                        | What was said                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ---------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AG Grid #1627](https://github.com/ag-grid/ag-grid/issues/1627) (HTML) | 2017-05-05 | closed (date not returned)                             | The top-level checkbox selects filtered-out rows, while mid-level checkboxes do not. "Inconsistent behaviour by making selections at different levels makes it unclear to users what is actually being selected." / "If only visible rows are selected then it would improve confidence."                  |
| [AG Grid #2373](https://github.com/ag-grid/ag-grid/issues/2373) (HTML) | 2018-05-10 | closed (date not returned)                             | With `groupSelectsFiltered`, selecting a group selected 899 rows instead of the 145 filtered ones                                                                                                                                                                                                          |
| [TanStack #4724](https://github.com/TanStack/table/issues/4724)        | 2023-02-24 | closed 2026-07-27, "was fixed in v9" (no commit), 1 👍 | With `filterFromLeafRows`, `getIsAllRowsSelected()`/`getIsSomeRowsSelected()` always return false, so select-all is dead                                                                                                                                                                                   |
| [PrimeNG #18936](https://github.com/primefaces/primeng/issues/18936)   | 2025-09-25 | **open** (reopened), 3 👍, `Resolution: Stale`         | Books by subject (Philosophie → Platon, Aristote). "propagation should be based on the **complete underlying tree structure**, not just the visible nodes after filtering." Selecting a filtered parent should select hidden children too, and selecting a filtered child should **not** select its parent |
| [Kendo #3578](https://github.com/telerik/kendo-ui-core/issues/3578)    | 2017-09-13 | closed 2017-10-03                                      | A Shift+click range selected hidden children of collapsed rows. Expected: "Only the visible higher level rows should be selected"                                                                                                                                                                          |

### T8 — Collision: pagination and counts

| Source                                                                     | Opened     | State (as read)                           | What was said                                                                                                                                                             |
| -------------------------------------------------------------------------- | ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Kendo #5491](https://github.com/telerik/kendo-ui-core/issues/5491)        | 2019-12-23 | closed 2023-12-15, `Bug`, `FP: Completed` | Org chart demo, filter "VP, Engineering": the pager went from "1 - 4 of 4 items" to "1 - 15 of 4 items" after a collapse                                                  |
| [AG Grid #1910](https://github.com/ag-grid/ag-grid/issues/1910)            | 2017-09-13 | closed same day                           | Expected: "Pagination should count only level-0 rows" (fetch paraphrase)                                                                                                  |
| [TanStack disc. #5137](https://github.com/TanStack/table/discussions/5137) | 2023-10-22 | unanswered                                | Address book grouped by letter: "pagination only works for the depth-0 rows. It would render hundreds of rows on the same page". Wants rows and sub-rows counted together |
| [MUI X #8190](https://github.com/mui/mui-x/issues/8190)                    | 2023-03-09 | closed 2023-04-18, `support: commercial`  | How to paginate `treeData`. The maintainer pointed to the `pagination` prop                                                                                               |

**No complaint about an "x of y" count that hides matches under collapsed rows was found** on the
in-scope trackers.

### T9 — Collision: lazy-loaded children

| Source                                                                                                                                          | Opened     | State (as read)                            | What was said                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [VS Code #66971](https://github.com/microsoft/vscode/issues/66971)                                                                              | 2019-01-23 | closed 2024-12-11, **171 👍**, 55 comments | The filter pruning "removes all folders which had not been expanded at least once before-hand, no matter if they contain a match or not"    |
| [VS Code #179600 comment](https://github.com/microsoft/vscode/issues/179600)                                                                    | 2023-04-24 | maintainer                                 | joaomoreno: "We still don't support full find in async trees, so we keep unresolved folders in view."                                       |
| [PrimeNG #18542](https://github.com/primefaces/primeng/issues/18542)                                                                            | 2025-07-01 | **open** (reopened), `Resolution: Stale`   | "If a treetable is filtered with a column or a global filter its nodes aren't lazily expandable through onNodeExpand"                       |
| [AG Grid #4849](https://github.com/ag-grid/ag-grid/issues/4849)                                                                                 | 2021-12-26 | closed 2022-01-11                          | Under a quick filter, lazily fetched children do not load: "Expand is not showing child component only icon is changing with filtered data" |
| [Telerik Blazor feedback 1696203](https://feedback.telerik.com/blazor/1696203-expand-collapse-icon-is-not-visible-after-filtering-the-treelist) | 2025-08-14 | Completed, 1 vote                          | With load-on-demand, expand icons disappear after filtering. Staff saw no workaround "besides loading all data upfront"                     |
| [MUI X #6873](https://github.com/mui/mui-x/issues/6873)                                                                                         | 2022-11-16 | closed same day, 1 👍                      | `filterMode="server"` was blocked with `treeData`. Maintainer: server filtering with tree data means returning the whole tree               |
| [TanStack #4261](https://github.com/TanStack/table/issues/4261) (HTML)                                                                          | 2022-08-03 | closed (date not returned)                 | After a global filter, expansion icons disappear from sub-rows                                                                              |

### T10 — Collision: sorting

| Source                                                               | Opened     | State (as read)   | What was said                                          |
| -------------------------------------------------------------------- | ---------- | ----------------- | ------------------------------------------------------ |
| [PrimeNG #12935](https://github.com/primefaces/primeng/issues/12935) | 2023-04-24 | closed 2024-12-16 | Filter, then expand, then sort: the expansion is reset |

This is thin. It is the only filter-plus-sort tree complaint found.

### Use cases behind the expectations

| Use case                               | Expectation                                                                | Source                           |
| -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| File explorer search (end user)        | Ancestors as context. Auto-expand to matches. Hide folders without matches | VS Code #167181, #179600, #66971 |
| Cluster → items, edited under a filter | Keep siblings / the full branch, for validation                            | MUI #10024 (mauretanec)          |
| Category → items ("Fruit")             | A parent match shows all its children                                      | Telerik Blazor forum 2024        |
| Employees → expenses                   | A parent match shows all its children                                      | Telerik Silverlight forum 2013   |
| Car make → model                       | Evaluate the parent independently of its children                          | AG Grid #2022                    |
| Org chart (Kendo demo)                 | Correct counts under filter + collapse                                     | Kendo #5491                      |
| Subject → books (picker)               | Selection propagates over the full tree, including hidden rows             | PrimeNG #18936                   |
| BOM, WBS/task tree, account hierarchy  | —                                                                          | **not found**                    |

## Synthesis — where they disagree

- **Parent matched, children hidden (T2) is the category's open question.** There are three
  vendor camps:
  - Descendants included by default: AG Grid ("By default, when a group row passes a Filter,
    the children will also be displayed",
    [tree-data-filtering@b36.2.0](https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc)).
    PrimeNG also defaults to `'lenient'`
    ([primeng-treetable.mjs@22.1.1](https://unpkg.com/primeng@22.1.1/fesm2022/primeng-treetable.mjs)),
    but #9281 reports that lenient still filtered a matching parent's children.
  - Descendants available as an option: DevExtreme `fullBranch`, Syncfusion `Child`/`Both`,
    Ignite UI `showWithAncestorsAndDescendants`.
  - Not available: MUI and Kendo/Telerik.

  Users land on the side that includes descendants every time they write in. The one argument
  on record against building it is a MUI maintainer's view that it is rare and slow, and users
  rebutted that in the same thread. **Two vendors default in opposite directions, and a third
  refuses the option.** That means there is no obvious answer, and the choice probably needs a
  config flag, not a fixed rule.

- **Auto-expand (T4) splits by philosophy.** Telerik deliberately keeps the user's collapse
  state. PrimeNG and VS Code users call that "looks like there are no results". MUI accepts the
  request but has not built it in 4 years. The VS Code proposal adds a third option: expand
  while filtering, then **restore** the previous expansion when the filter clears.
- **Selection (T7): users contradict each other.** AG Grid #1627 and Kendo #3578 want hidden
  rows **excluded**. PrimeNG #18936 wants hidden descendants **included** and upward
  propagation to ignore the filter. This is a product decision, not a bug. Whatever is chosen
  needs to be stated in the UI, because the #1627 complaint is about _not knowing_ what was
  selected.
- **Pagination (T8): count roots or count rows.** AG Grid #1910 wants level-0 rows only.
  TanStack #5137 wants rows and sub-rows together. Kendo #5491 shows that getting the count
  wrong under filter plus collapse is a visible bug.
- **Level-restricted filtering (T3) is a minority need, but a stable one.** Shipped as MUI
  `disableChildrenFiltering`, Tabulator `dataTreeFilter` and Ignite `fromLevel`/`toLevel`. It
  goes with the "a parent match shows everything under it" mental model.
- **Orphans (T6):** the one user who hit it promoted orphans to root, and AG Grid simply
  declares missing parents invalid. This is **one data point, not a consensus.** Silence from
  the other trackers is not validation.
- **Lazy children (T9): every vendor breaks the same way.** A filter cannot match rows that were
  never loaded, and expand affordances disappear under a filter. VS Code's maintainer stated the
  constraint outright. Any client-side filter over lazy children inherits it.

## Not researched

- Stack Overflow and Reddit. Per discovery-sources, both produced nothing citable in earlier
  runs, and they were not retried here.
- DevExpress Support Center ticket bodies: T1177736 ("fullBranch is not working as expected"),
  T1155585 ("Restoring TreeList expansion after search/filter") and T557430. The pages are
  rendered by JavaScript and returned an empty template. Only their titles were seen, in search
  results.
- The DevExtreme GitHub issue "TreeList - New Filter Modes" (#7270). The API returned 410 and
  the HTML page returned 404.
- Syncfusion's own issue tracker, and the Kendo/Telerik feedback portal's vote counts for a
  descendants filter mode. No such portal item was found by search.
- Small-repo PRs about stating what a filter hides ("2 hidden by filter" in
  `SoftieSolutions/agentplex#184`, `jlevy/metabrowser#60`). They appeared in search but were
  not read.
- Closing comments on PrimeNG #8192 and #9281, and on MUI #6812. The API returned 403.
- Tree-select and tree-view components (MUI Tree View, PrimeNG Tree) beyond the rows cited.

## Unverified

- **The PrimeNG 2022-11-09 closes being a triage sweep.** This is inferred from two close
  timestamps 11 minutes apart on stale `Pending Review` issues. Reading the closing comments
  would confirm it.
- **TanStack #4724 being "fixed in v9".** The only evidence is the maintainer's close comment,
  with no commit attached. A v9 source read or a changelog entry would confirm it.
- **The Kendo 2020 complaints about non-matching parents being shown (T1).** This is the
  fetch's paraphrase. The thread's posts would need to be read verbatim.
- **Tabulator #2281, takuy's "BIG" comment, and AG Grid #1910's expected-behavior sentence.**
  These are fetch paraphrases, not verbatim quotes.
- **AG Grid's behavior for a child match under a non-matching parent** (whether ancestors are
  kept). It was not quoted from the b36.2.0 tree-data-filtering page. That behavior is a
  reasonable inference from #2022, not a doc-confirmed fact.
- **How AG Grid behaves on a missing parent** (warning, drop, or promote). The docs only say
  "not allowed".
- **What PrimeNG lenient mode does today** after #9281. The filter code was not in the fetched
  excerpt.
- **The close dates and reaction counts** for AG Grid #1627 and #2373 and TanStack #4261. The
  HTML page did not return them.

## Sources

| Claim                                                                                         | Source                                                                                                                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery source reliability notes                                                            | `C:\Users\dmena\.claude\discovery-sources.md` (Axis 2)                                                                                      |
| AG Grid #2022 body and state                                                                  | https://api.github.com/repos/ag-grid/ag-grid/issues/2022                                                                                    |
| AG Grid #2022 "no capacity" close comment                                                     | https://api.github.com/repos/ag-grid/ag-grid/issues/2022/comments                                                                           |
| AG Grid #1532                                                                                 | https://api.github.com/repos/ag-grid/ag-grid/issues/1532                                                                                    |
| AG Grid #3131                                                                                 | https://api.github.com/repos/ag-grid/ag-grid/issues/3131                                                                                    |
| AG Grid #3131 closed for no reproduction                                                      | https://api.github.com/repos/ag-grid/ag-grid/issues/3131/comments                                                                           |
| AG Grid #4849                                                                                 | https://api.github.com/repos/ag-grid/ag-grid/issues/4849                                                                                    |
| AG Grid #1910                                                                                 | https://api.github.com/repos/ag-grid/ag-grid/issues/1910                                                                                    |
| AG Grid #1627                                                                                 | https://github.com/ag-grid/ag-grid/issues/1627                                                                                              |
| AG Grid #2373                                                                                 | https://github.com/ag-grid/ag-grid/issues/2373                                                                                              |
| AG Grid default descendants and `excludeChildrenWhenTreeDataFiltering`                        | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-filtering/index.mdoc        |
| AG Grid missing parents "not allowed"                                                         | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-self-referential/index.mdoc |
| TanStack #4190                                                                                | https://api.github.com/repos/TanStack/table/issues/4190                                                                                     |
| TanStack #4190 comments (custom filter workaround)                                            | https://api.github.com/repos/TanStack/table/issues/4190/comments                                                                            |
| TanStack #4724                                                                                | https://api.github.com/repos/TanStack/table/issues/4724                                                                                     |
| TanStack #4724 "was fixed in v9"                                                              | https://api.github.com/repos/TanStack/table/issues/4724/comments                                                                            |
| TanStack #4724 close without a commit                                                         | https://api.github.com/repos/TanStack/table/issues/4724/events                                                                              |
| TanStack #4261                                                                                | https://github.com/TanStack/table/issues/4261                                                                                               |
| TanStack discussion #3828                                                                     | https://api.github.com/repos/TanStack/table/discussions/3828                                                                                |
| TanStack discussion #3828 comments                                                            | https://api.github.com/repos/TanStack/table/discussions/3828/comments                                                                       |
| TanStack discussion #5703                                                                     | https://api.github.com/repos/TanStack/table/discussions/5703                                                                                |
| TanStack discussion #5137                                                                     | https://api.github.com/repos/TanStack/table/discussions/5137                                                                                |
| MUI X #10024                                                                                  | https://api.github.com/repos/mui/mui-x/issues/10024                                                                                         |
| MUI X #10024 comments (romgrk, mauretanec, Gijs-W, kee0624)                                   | https://api.github.com/repos/mui/mui-x/issues/10024/comments                                                                                |
| MUI X #6812                                                                                   | https://github.com/mui/mui-x/issues/6812                                                                                                    |
| MUI X #11906                                                                                  | https://api.github.com/repos/mui/mui-x/issues/11906                                                                                         |
| MUI X #11906 closed as duplicate, "not built in yet"                                          | https://api.github.com/repos/mui/mui-x/issues/11906/comments                                                                                |
| MUI X #11892                                                                                  | https://api.github.com/repos/mui/mui-x/issues/11892                                                                                         |
| MUI X #6873                                                                                   | https://api.github.com/repos/mui/mui-x/issues/6873                                                                                          |
| MUI X #6873 maintainer: server returns the whole tree                                         | https://api.github.com/repos/mui/mui-x/issues/6873/comments                                                                                 |
| MUI X #8190                                                                                   | https://api.github.com/repos/mui/mui-x/issues/8190                                                                                          |
| MUI X #8190 comments                                                                          | https://api.github.com/repos/mui/mui-x/issues/8190/comments                                                                                 |
| MUI tree data filter semantics and `disableChildrenFiltering`                                 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md                                              |
| MRT discussion #1225                                                                          | https://api.github.com/repos/KevinVandy/material-react-table/discussions/1225                                                               |
| MRT #851                                                                                      | https://api.github.com/repos/KevinVandy/material-react-table/issues/851                                                                     |
| PrimeNG #9281                                                                                 | https://api.github.com/repos/primefaces/primeng/issues/9281                                                                                 |
| PrimeNG #15190                                                                                | https://api.github.com/repos/primefaces/primeng/issues/15190                                                                                |
| PrimeNG #7757 (single-parent filter bug, read, not used as a theme)                           | https://api.github.com/repos/primefaces/primeng/issues/7757                                                                                 |
| PrimeNG #8192                                                                                 | https://api.github.com/repos/primefaces/primeng/issues/8192                                                                                 |
| PrimeNG #18542                                                                                | https://api.github.com/repos/primefaces/primeng/issues/18542                                                                                |
| PrimeNG #12935                                                                                | https://api.github.com/repos/primefaces/primeng/issues/12935                                                                                |
| PrimeNG #18936                                                                                | https://api.github.com/repos/primefaces/primeng/issues/18936                                                                                |
| PrimeNG latest version                                                                        | https://registry.npmjs.org/primeng/latest                                                                                                   |
| PrimeNG `filterMode` default `'lenient'`                                                      | https://unpkg.com/primeng@22.1.1/fesm2022/primeng-treetable.mjs                                                                             |
| Kendo #5491                                                                                   | https://api.github.com/repos/telerik/kendo-ui-core/issues/5491                                                                              |
| Kendo #3578                                                                                   | https://api.github.com/repos/telerik/kendo-ui-core/issues/3578                                                                              |
| Kendo jQuery forum "filter parents only"                                                      | https://www.telerik.com/forums/treelist-filter-parents-only                                                                                 |
| Telerik Blazor forum, children of a matched parent                                            | https://www.telerik.com/forums/show-children-when-search-filter-treelist-matches-parent                                                     |
| Telerik Silverlight forum 2013                                                                | https://www.telerik.com/forums/filter-parent-show-all-children-in-treelistview                                                              |
| Telerik Blazor: parents kept, collapse state kept                                             | https://www.telerik.com/blazor-ui/documentation/components/treelist/filter/overview                                                         |
| Telerik Blazor feedback: expand icon lost after filter                                        | https://feedback.telerik.com/blazor/1696203-expand-collapse-icon-is-not-visible-after-filtering-the-treelist                                |
| DevExtreme `filterMode` default `'withAncestors'`                                             | https://js.devexpress.com/Angular/Documentation/ApiReference/UI_Components/dxTreeList/Configuration/#filterMode                             |
| DevExtreme mode descriptions                                                                  | https://js.devexpress.com/Demos/WidgetsGallery/Demo/TreeList/FilterModes/                                                                   |
| Syncfusion `filterHierarchyMode` values and default                                           | https://help.syncfusion.com/grid-sdk/javascript/tree-grid/filtering/filtering                                                               |
| Syncfusion orphan thread #185154                                                              | https://www.syncfusion.com/forums/185154/show-data-if-parent-is-not-displayed                                                               |
| Syncfusion #150843 (search + collapse-all bug, read, not used as a theme)                     | https://www.syncfusion.com/forums/150843/treegrid-search-results-not-showing-children                                                       |
| Syncfusion #180553 (child missing in the filter popup with `Both`, read, not used as a theme) | https://www.syncfusion.com/forums/180553/treegrid-filter-problems                                                                           |
| Ignite UI dimmed ancestors, `matchFiltering`, `fromLevel`                                     | https://www.igniteui.com/help/igtreegrid-filtering                                                                                          |
| Tabulator #2281                                                                               | https://api.github.com/repos/olifolkerd/tabulator/issues/2281                                                                               |
| Tabulator #2281 comments (`dataTreeFilter` in 4.8)                                            | https://api.github.com/repos/olifolkerd/tabulator/issues/2281/comments                                                                      |
| MudBlazor #10906                                                                              | https://api.github.com/repos/MudBlazor/MudBlazor/issues/10906                                                                               |
| VS Code #66971                                                                                | https://api.github.com/repos/microsoft/vscode/issues/66971                                                                                  |
| VS Code #137555 (duplicate of #66971)                                                         | https://api.github.com/repos/microsoft/vscode/issues/137555                                                                                 |
| VS Code #167181                                                                               | https://api.github.com/repos/microsoft/vscode/issues/167181                                                                                 |
| VS Code #167181 closed as duplicate                                                           | https://api.github.com/repos/microsoft/vscode/issues/167181/comments                                                                        |
| VS Code #179600                                                                               | https://api.github.com/repos/microsoft/vscode/issues/179600                                                                                 |
| VS Code #179600 maintainer on async trees                                                     | https://api.github.com/repos/microsoft/vscode/issues/179600/comments                                                                        |
