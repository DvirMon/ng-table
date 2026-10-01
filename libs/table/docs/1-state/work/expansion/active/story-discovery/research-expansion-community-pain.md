# What hurts people about row expansion / detail panels today?

**Date:** 2026-09-30 · **Mode:** community-pain

Feature: a row opens an inline panel of arbitrary markup beneath it
(master/detail). Tree / nested child rows (`withTree`) are excluded,
except where reporters confuse or collide the two (Theme 7).

## Answer

- **Expanded state that follows position, not the row, is the oldest
  and most repeated pain.** After a sort, refetch, grouping change or
  infinite-scroll append, the panel opens on the wrong row, stays open
  with nothing in it, or needs two clicks. Reported 2017-2025 in all
  four open-source libraries. Angular Material's version has been open
  since 2018.
- **Keyboard and screen-reader access has no settled pattern.** Every
  vendor has at least one a11y report. AG Grid got the same
  `aria-expanded`-on-a-`grid`-row axe failure four times (2023-2026).
  In 2026 it switched master/detail to `role="treegrid"`.
- **By volume, the biggest cluster is panels vs virtual scrolling:**
  scroll jumps, blank space after sort, "sticky" panels.
- The **policy knobs** keep coming back as requests, one at a time:
  expand-all, only one panel open, whole-row click to toggle,
  per-row "can this row expand", animation.
- **Category-level failure:** Angular Material shipped this as a
  workaround (`multiTemplateDataRows` + `when`), never as a feature.
  Requests for a real detail row started in 2017. The docs issue
  stayed open until 2026.

## Method and source reliability

- All issue rows below were read one at a time on 2026-09-30.
- First batch: `api.github.com/repos/<owner>/<repo>/issues/<n>` via
  WebFetch. This gives state, `state_reason`, dates, comment count
  and reactions.
- After about 55 unauthenticated calls, the API returned HTTP 403
  (rate limit). The remaining rows were read from the `github.com`
  HTML issue page. Those rows carry state and dates but **no reaction
  counts**, and are marked "(HTML)".
- Search-API listings (`/search/issues`) were used **only to find
  candidates**. WebFetch's summariser **rewrote issue titles** in those
  listings, so no title or count is cited from a listing. Every title
  below is from the issue itself.
- TanStack discussions were read from the discussions search page.
  That page shows upvotes and dates but no discussion numbers, so
  those rows are marked secondary.

**Reliability notes that change how a number reads**

| Tracker | Note |
|---|---|
| `mui/mui-x` | 👍 is real demand. The `waiting for 👍` label is an explicit vote. `support: premium standard` / `pro standard` / `commercial` means the report came through paid support, which is stronger than 👍 but not countable. |
| `ag-grid/ag-grid` | **`closed` does not mean fixed.** AG Grid moves issues to a private tracker (labels like `AG-14592`) and closes them. 👍 is almost always 0 and carries no signal. |
| `TanStack/table` | **Bulk-closure sweep seen:** #5110 (opened 2023) and #5935 (opened 2025) were both closed by KevinVandy on 2026-07-24 / 2026-08-04, around the v9 release PR (#6512, 2026-08-04). A fix was not traced, so "closed" there does not show that anything was fixed. |
| `angular/components` | **Close-candidate sweep seen:** #12793 and #25859 both carry `action: close-candidate` and were closed 2026-05-29 as `completed`. Read that as housekeeping, not a fix. |
| `primefaces/primeng` | #7526 (and, from the listing only, #7225 / #7286) closed 2020-03-18..20 — looks like a sweep. Not confirmed. Open items here are long-lived by habit, so age is informative. |

- The 👍 counts below are **not comparable across trackers**. MUI's
  368 on #211 and AG Grid's 0s measure different things.
- **Inconsistent count, not reported:** mui/mui-x#13505 showed 26
  comments in the search listing and 0 on the HTML page.

## Findings

### Theme 1 — Expanded state follows position, not the row

The shape: expansion is stored by index, or recomputed once. After
the data reorders, three things can go wrong:

- the open panel moves to a different row;
- the toggle shows "expanded" but the panel is empty;
- the next click is swallowed.

| Source | Opened | State (read 2026-09-30) | What was said |
|---|---|---|---|
| [TanStack/table#483](https://github.com/TanStack/table/issues/483) | 2017-09-11 | closed completed 2017-10-01 · 6 comments · 3 👍 | "If you expand a row while maintaining a expanded control state, then sort the data, the wrong row will be expanded." / "was expanded row state intentionally tied to a row index or should it really map to the actual data" |
| [TanStack/table#1593](https://github.com/TanStack/table/issues/1593) | 2019-10-14 | closed completed 2019-11-20 · 10 comments · 7 👍 | "if the data for the table changes, item at index 0 will still have an open sub-component state, even if the item at index 0 is a different item." |
| [angular/components#11990](https://github.com/angular/components/issues/11990) | 2018-06-29 | closed completed 2018-09-18 · 13 comments · 7 👍 | "When I click on a column it sorts, but when it finishes sorting some of the rows are open." / "you have to click on a row multiple times to get it to open." |
| [angular/components#13431](https://github.com/angular/components/issues/13431) | 2018-10-04 | **open**, last update 2023-06-13 · 11 comments · 6 👍 · P4 | "After clicking on a column with sort capabilities and sorting the table, the expandable rows do not open on first click." |
| [angular/components#13835](https://github.com/angular/components/issues/13835) | 2018-10-26 | closed completed 2018-10-29 · 2 comments | "the rows that 'move up' in the array can no longer toggle secondary template row expansion." |
| [angular/components#9527](https://github.com/angular/components/issues/9527) | 2018-01-22 | **open** · 8 comments · 18 👍 · P2 | Root mechanism for the detail-row pattern: "The table uses the row when predicate to determine which row template to use … but only once when inserting a new row." |
| [primefaces/primeng#5574](https://github.com/primefaces/primeng/issues/5574) | 2018-04-17 | closed completed 2018-12-17 · 2 comments · 1 👍 | The **inverse** complaint. PrimeNG requires `dataKey`, and a reactive-forms user without ids asked: "Can we use index of the row as a mean to tell the expander which row it should expand?" |
| [TanStack/table#5935](https://github.com/TanStack/table/issues/5935) | 2025-02-27 | closed 2026-08-04 (sweep, see Method) · 1 comment · 2 👍 | Infinite scroll: the default for newly loaded rows flips once any row is collapsed — "the new rows will be collapse by default, but should be expanded." (Panel vs subRows not stated in the post.) |
| [mui/mui-x#16495](https://github.com/mui/mui-x/issues/16495) | 2025-02-06 | **open** · 2 comments · premium support | After a grouping change: "The row's icon remains as a minus icon (-) … However, the content of the detail panel is not visible." |
| [Retool community 33910](https://community.retool.com/t/expandable-table-rows-automatically-close-a-row-expansion-when-a-new-row-is-selected/33910) | 2024-02-07 | staff replied with added `expandRows`/`collapseRows` | Panel content bound to *selection* instead of its own row: "the expansion from the previous row remains open and now displays data from my current row selection." (Out of the competitor set; a low-code app builder.) |

### Theme 2 — Panels vs virtual scrolling and scroll geometry

Largest cluster by volume. It sits mostly in MUI, the only surveyed
vendor that virtualises panels by default. Variable-height content
breaks row-offset math.

| Source | Opened | State | What was said |
|---|---|---|---|
| [mui/mui-x#6378](https://github.com/mui/mui-x/issues/6378) | 2022-10-04 | closed completed 2022-11-08 · 7 comments · regression | Scrolling back up to an open panel, "the scroll location of the grid will jump back down, so that you never actually see it." / "our users would perceive this scroll bug as a regression in our product." |
| [mui/mui-x#13073](https://github.com/mui/mui-x/issues/13073) (HTML) | 2024-05-10 | closed (PR #13456) | "When the detail panel exits the viewport, it jumps back to the top and covers the rows below it. Only happens if focus is in the master row." |
| [mui/mui-x#14356](https://github.com/mui/mui-x/issues/14356) | 2024-08-26 | **open** · 2 comments · pro support | After sorting an open panel out of view, the virtual scroller "assumes the detail panel is still in view after sorting, causing a blank space at the bottom." |
| [mui/mui-x#20410](https://github.com/mui/mui-x/issues/20410) | 2025-11-20 | closed completed 2026-01-21 · 21 comments · 2 👍 · premium support | "Scroll position jumps when scrolling, especially when new rows are virtualized into view" — auto-height panels with dynamic content. |
| [mui/mui-x#7811](https://github.com/mui/mui-x/issues/7811) | 2023-02-03 | closed completed 2023-04-19 · commercial | "the `getDetailPanelContent` callback is fired for all of the 4058 rows, and this happens on every re-render". Reason given: "our users expect this data based on what this table is replacing." |
| [primefaces/primeng#16438](https://github.com/primefaces/primeng/issues/16438) | 2024-09-26 | closed completed 2024-11-22 · 10 comments | "When the content of the expanded area is quite high, you cannot scroll to the end of the table" / "the scroll jumps ahead a couple of rows more than it should." |
| [ag-grid/ag-grid#10911](https://github.com/ag-grid/ag-grid/issues/10911) | 2025-06-20 | closed completed (community-support) | "each expanded detail grid is continuously added to the DOM and is not destroyed, which causes the page to crash when there is a large amount of data." |

### Theme 3 — Keyboard and screen-reader access

Two separate complaints:

- **The toggle does not announce its state.**
- **Focus and the virtual cursor cannot get into the panel,** or
  reach it in the wrong order.

Vendors disagree on the ARIA role (see Synthesis).

| Source | Opened | State | What was said |
|---|---|---|---|
| [angular/components#15020](https://github.com/angular/components/issues/15020) | 2019-01-30 | **open**, last update 2025-02-19 · `help wanted` P4 | Tested with NVDA + Firefox and VoiceOver iOS: "It must be possible to expand and collapse table rows in the example by using only a keyboard". The official example fails both. |
| [mui/mui-x#4219](https://github.com/mui/mui-x/issues/4219) | 2022-03-17 | **open**, last update 2025-03-01 · 9 comments | "When we add a detail panel and there are clickable items in other columns, user cannot tab to the detail panel in the correct order." |
| [mui/mui-x#18455](https://github.com/mui/mui-x/issues/18455) | 2025-06-20 | **open** · filed by a MUI member | "After expanding an expandable row, VoiceOver is unable to move into the expanded details row." |
| [mui/mui-x#17082](https://github.com/mui/mui-x/issues/17082) | 2025-03-22 | closed completed 2025-05-19 | Title: "Master detail toggle button missing `aria-expanded` attribute" — "shouldn't they also have the aria-expanded attribute like the accordion and tree view?" |
| [ag-grid/ag-grid#4861](https://github.com/ag-grid/ag-grid/issues/4861) | 2022-01-08 | closed completed 2022-02-17 | "Screen reader is **NOT** announcing the role of the 'collapse/expand' button, and its 'collapsed/expanded' state." |
| [ag-grid/ag-grid#7338](https://github.com/ag-grid/ag-grid/issues/7338) | 2023-12-11 | closed 2023-12-12 · AG-10179 | axe: "Elements must only use supported ARIA attributes" on the master/detail expand cell. |
| [ag-grid/ag-grid#7409](https://github.com/ag-grid/ag-grid/issues/7409) | 2024-01-09 | closed same day | "ARIA attribute is not allowed: aria-expanded" in the detail cell. |
| [ag-grid/ag-grid#10080](https://github.com/ag-grid/ag-grid/issues/10080) | 2025-03-17 | closed 2025-03-31 · AG-14592 | axe: "This attribute is supported with treegrid rows, but not grid: aria-expanded". |
| [ag-grid/ag-grid#15012](https://github.com/ag-grid/ag-grid/issues/15012) | 2026-08-29 | closed 2026-09-17 · AG-18571 | "fix(a11y): master/detail grids should use role="treegrid" not role="grid"" — "`aria-expanded` is only valid on `row` elements inside a `treegrid`." |

### Theme 4 — Lazy panel content and interaction inside the panel

| Source | Opened | State | What was said |
|---|---|---|---|
| [primefaces/primeng#7526](https://github.com/primefaces/primeng/issues/7526) | 2019-04-08 | closed completed 2020-03-20 (likely sweep) · 2 👍 | With saved table state: "the row toggler keeps the state but the details are empty because I have no means to trigger the loading of the details data." / "content fetching is triggered by onRowExpand event and that is never fired." |
| [mui/mui-x#18451](https://github.com/mui/mui-x/issues/18451) | 2025-06-20 | closed **not_planned** 2025-07-02 (stale) | "the entire table resets to its initial state whenever any action is performed inside an expanded detail panel" — opening a modal from the panel sends the table "back to page 1, all expanded detail panels to collapse". |
| TanStack discussion "Fetch Data from API when sub component is expanded" ([discussions search](https://github.com/TanStack/table/discussions?discussions_q=sub+component+expanded)) — secondary | 2021-01-04 | 5 upvotes · 2 comments | Title only read. |
| [TanStack/table#1203](https://github.com/TanStack/table/issues/1203) | 2018-11-20 | closed completed 2019-01-31 · 3 👍 | Panel unmounts on collapse: "Currently I can only animate when the subcomponent appears but cannot animate subcomponent exit/hide since its unmounted". Also bears on Theme 6. |

### Theme 5 — Policy knobs: expand-all, one-open-only, toggle target, per-row eligibility

None of these is a bug. Each is a product choice the library left to
the integrator, and each keeps coming back.

| Source | Opened | State | What was said |
|---|---|---|---|
| [mui/mui-x#6041](https://github.com/mui/mui-x/issues/6041) | 2022-09-06 | **open**, docs recipe label | "I'm trying to implement an expand all-button … cannot find it." / "I want to put it in the little column header". |
| [ag-grid/ag-grid#2940](https://github.com/ag-grid/ag-grid/issues/2940) | 2019-02-07 | closed 2019-02-13 | "expandAll and collapseAll does not work on Master Details grid" — "Actual: does nothing". |
| [mui/mui-x#17449](https://github.com/mui/mui-x/issues/17449) | 2025-04-18 | closed **not_planned** 2025-05-06 (stale) | "is there an easy way to only show one detail row content at a time? I got it working by saving the old ColRowId". |
| [angular/components#6095](https://github.com/angular/components/issues/6095) | 2017-07-27 | closed 2017-08-02 · **80 comments** · 15 👍 | "when the user clicked on particular row, the row should expand and show card with the row information in detail". Comments: pantonis (2017-07-28) "99% of applications need this feature"; shlomiassaf (2017-11-29) "forcing developers to duplicate rows just to be able to apply a detail row is upside down… The `when` feature is not suitable for this scenario". |
| [TanStack/table#349](https://github.com/TanStack/table/issues/349) | 2017-06-16 | closed 2017-06-19 · 12 comments | "I'm not sure how to allow clicking any part of a row will expand the subcomponent." |
| [mui/mui-x#7596](https://github.com/mui/mui-x/issues/7596) (HTML) | 2023-01-17 | closed via PR #14666 (2024) | "I would like to save on space on mobile view by making it possible to click on row rather than on specific column to display details." |
| [mui/mui-x#19149](https://github.com/mui/mui-x/issues/19149) (HTML) | 2025-08-12 | closed **not planned** | Row click collides with selection: "there is no differentiation between a row that is selected through a checkbox and one that is selected by clicking on it." |
| [mui/mui-x#19146](https://github.com/mui/mui-x/issues/19146) (HTML) | 2025-08-12 | closed | "several steps are necessary when only some rows have a master detail panel" / "what I don't like right now is the use of the internal selectors". |

### Theme 6 — Animation

| Source | Opened | State | What was said |
|---|---|---|---|
| [mui/mui-x#10240](https://github.com/mui/mui-x/issues/10240) | 2023-09-05 | **open**, updated 2026-06-01 · 12 comments · 12 👍 · `waiting for 👍` · commercial | "The animation should get triggered when you click on a row and it should expand to show the master detail." |
| [angular/components#15491](https://github.com/angular/components/issues/15491) | 2019-03-14 | **open** · 8 comments · 6 👍 · P3 | Title: "Expandable table's animation is lagging". |
| [primefaces/primeng#5612](https://github.com/primefaces/primeng/issues/5612) | 2018-04-23 | closed completed 2019-01-03 · 4 👍 | "There is no animation when row expands/collapses in Turbo Table". |

### Theme 7 — Panel collides with, or is confused with, tree / grouping

| Source | Opened | State | What was said |
|---|---|---|---|
| [TanStack/table#3333](https://github.com/TanStack/table/issues/3333) (HTML) | 2021-06-18 | closed, no maintainer reply seen | "both are using the same row.isExpanded flag to display subComponent and Aggegated data, so when I try to visualize grouped column's data the first row Sub component is displayed too". |
| [mui/mui-x#12088](https://github.com/mui/mui-x/issues/12088) | 2024-02-16 | **open** · 9 comments · `waiting for 👍` · commercial | "On some rows we would like to show both, tree data child rows and underneath detail panel" / "detail panel overrides and set somehow `childrenExpanded` to false". |
| [mui/mui-x#19589](https://github.com/mui/mui-x/issues/19589) | 2025-09-16 | **open** · `waiting for 👍` | "Detail panels (getDetailPanelContent) work for regular rows but cannot be opened on group rows." |
| [TanStack/table#1884](https://github.com/TanStack/table/issues/1884) | 2020-02-04 | closed completed 2020-02-14 · 4 👍 | **Confusion example.** Titled "Lazy loading expanded rows", but it is about `getSubRows` (tree), wanting "a loading indicator in the child row". |

### Theme 8 — Panel content is invisible to the table's own operations

| Source | Opened | State | What was said |
|---|---|---|---|
| [mui/mui-x#13505](https://github.com/mui/mui-x/issues/13505) (HTML) | 2024-06-16 | **open** | "I want to search on the top table and it should also return and filter the child table" / "when it finds something in the child table not in parent then it does not return anything." |
| [ag-grid/ag-grid#4903](https://github.com/ag-grid/ag-grid/issues/4903) | 2022-02-03 | closed (community-support) | "the detail grids don't exist … until the master is expanded" — so master rows cannot be filtered by detail content. |

### Theme 9 — Paywall

| Source | Opened | State | What was said |
|---|---|---|---|
| [mui/mui-x#211](https://github.com/mui/mui-x/issues/211) | 2020-08-22 | closed completed 2022-02-03 · 21 comments · **368 👍 (523 total reactions)** · `plan: Pro` | The original master/detail request. The highest count in this whole corpus. Shipped behind Pro. |
| [ag-grid/ag-grid#7905](https://github.com/ag-grid/ag-grid/issues/7905) + [its reply](https://github.com/ag-grid/ag-grid/issues/7905#issuecomment) | 2024-04-30 | closed next day | "Would it be possible to have a 'Master/Detail' in the community version?" / "just to expand/collapse row". AG-Zoheil (2024-05-01): master/detail requires the enterprise plan. |

## Synthesis — where they disagree

**Identity key.** TanStack v6/v7 and Angular Material's example keyed
expansion by index or object reference and got Theme 1 bugs.
PrimeNG requires `dataKey` up front, and got the opposite complaint
(#5574: "let me use index"). MUI keys by row id and still hits the
same shape one layer down: grouping change (#16495) and sort under
virtualisation (#14356). So a row id is necessary but not enough:
every derived view (sort, group, page, virtual window) has to
re-read the state, not cache it.

**ARIA role.**

- MUI treats the toggle like an accordion button (`aria-expanded`
  on the button, #17082).
- AG Grid put `aria-expanded` on the row, failed axe four times
  under `role="grid"`, then moved to `role="treegrid"` (#15012,
  2026).
- Angular Material ships an example with neither (#15020, open).

Neither shipped answer yet lets a screen-reader user reach the
panel content (MUI #18455 open; AG Grid not verified). No vendor
treats this as settled.

**Panel lifecycle.** TanStack unmounts on collapse, which blocks exit
animation (#1203). AG Grid destroys detail grids on collapse (#4903),
yet leaked them under virtual scrolling (#10911). MUI called the
content callback for every row (#7811). Mount/unmount timing drives
three themes at once: animation, lazy loading, and scroll math.

**Policy knobs.** Expand-all, one-open-only, whole-row toggle and
per-row eligibility are each asked for separately, with no shared
answer:

- MUI closed one-at-a-time as not planned (#17449).
- MUI added row-click toggle (#7596), then refused to split it from
  row-click selection (#19149).
- Angular Material's official example is single-open with a
  row-click toggle by construction.

The requests suggest one expansion state that the consumer can
write to freely, not a flag per policy.

**Panel vs tree.** TanStack shares one `isExpanded` flag between
sub-components and grouping, and got a collision (#3333). MUI keeps
them separate, and got "let me open both" (#12088) and "let me put a
panel on a group row" (#19589). Both choices produced complaints.
Separate state produced *feature requests*; shared state produced a
*bug*.

**Paywall.**

- MUI: Pro.
- AG Grid: Enterprise.
- PrimeNG, Angular Material, TanStack: free.

The only two vendors with a turnkey feature both charge for it. Its
free implementations are either a template slot (PrimeNG) or a
documented workaround (Material, TanStack `renderSubComponent`).
MUI's 368 👍 is the demand ceiling measured in this run.

**Closed-as-workaround, resurfacing (highest-value signal).** Angular
Material closed #6095 (2017) by pointing to the `when` predicate.
The same need came back as:

- #6081 "Material Data table master detail view" (2017);
- #5936 "Possibility to add html in between table rows?" (2017);
- #8332 "more rows for item with second row colspan" (2017-2019);
- #12793 "Document multiTemplateDataRows" (2018, closed by a 2026
  sweep).

The row-level data for these four came from search listings, not
single reads. See Unverified.

**End-user vs integrator.** No direct end-user voice was found. The
closest are integrators relaying their users:

- MUI #6378: "our users would perceive this scroll bug as a
  regression in our product";
- MUI #7811: "our users expect this data";
- MUI #7596: mobile screen space;
- an accessibility specialist testing with NVDA and VoiceOver
  (Angular #15020).

End-user pain shows up as scroll jumps, a panel on the wrong row,
and no keyboard path. Integrator pain is API friction: internal
selectors (#19146), and no expand-all API (#6041).

## Not researched

- Stack Overflow question volume by tag. One `site:stackoverflow.com`
  search returned DataTables/Retool/Radzen forums instead, matching
  the source file's note that forum searches produce little.
- Reddit, the Telerik feedback portal, DevExtreme / Syncfusion /
  Handsontable trackers.
- TanStack discussion upvotes via GraphQL. No authenticated tool was
  available; the list page was used.
- End-user products (Jira, Airtable, etc.): that is `product-ux`
  mode.
- Editing inside panels (mui/mui-x#15094 seen in a listing only) and
  export of panel content (mui/mui-x#11426, primefaces/primeng#11751
  — both reads returned 403).
- Angular Material's lack of table virtualisation
  (angular/components#10122, 625 👍) — it is related but is not about
  panels.

## Unverified

- **Whether AG Grid's a11y fixes shipped.** All AG Grid rows are
  `closed`, which on that tracker does not mean fixed. To confirm,
  read the `master-detail` `.mdoc` at a pinned `b<version>` tag for
  the ARIA role.
- **Whether MUI #18455 / #4219 remain reproducible** on current MUI.
  Only the issue state was read.
- **TanStack #5935 is about panels or subRows** — the post does not
  say.
- **The Angular Material "workaround, resurfacing" chain** (#6081,
  #5936, #8332): titles, dates and counts came from a search listing
  whose summariser rewrote titles. Read each issue to confirm.
- **PrimeNG 2020-03 closure cluster is a sweep** — inferred from
  closure dates alone.
- **MUI #13505 comment count** — the listing and the page disagree.
- **"Shared flag produced a bug, separate state produced feature
  requests" (Theme 7 synthesis)** is an inference from 4 issues, not
  a vendor statement.

## Sources

| Claim | Source |
|---|---|
| Sort opens wrong row (TanStack, index-keyed) | https://github.com/TanStack/table/issues/483 |
| Data change keeps index-0 open | https://github.com/TanStack/table/issues/1593 |
| Sort leaves rows open / multi-click | https://github.com/angular/components/issues/11990 |
| Sort → first click swallowed, open since 2018 | https://github.com/angular/components/issues/13431 |
| Moved rows can't toggle after sort | https://github.com/angular/components/issues/13835 |
| `when` predicate evaluated once | https://github.com/angular/components/issues/9527 |
| PrimeNG dataKey required; index requested | https://github.com/primefaces/primeng/issues/5574 |
| Infinite-scroll default flips | https://github.com/TanStack/table/issues/5935 |
| Grouping change: icon expanded, panel gone | https://github.com/mui/mui-x/issues/16495 |
| Panel shows selected row's data (Retool) | https://community.retool.com/t/expandable-table-rows-automatically-close-a-row-expansion-when-a-new-row-is-selected/33910 |
| Scroll-back jump; "our users" quote | https://github.com/mui/mui-x/issues/6378 |
| Sticky panel when focus in master row | https://github.com/mui/mui-x/issues/13073 |
| Blank space after sort, virtualised | https://github.com/mui/mui-x/issues/14356 |
| Auto-height scroll jumps | https://github.com/mui/mui-x/issues/20410 |
| Content callback for all 4058 rows | https://github.com/mui/mui-x/issues/7811 |
| PrimeNG virtual scroll + expansion | https://github.com/primefaces/primeng/issues/16438 |
| AG Grid detail grids leak under virtualisation | https://github.com/ag-grid/ag-grid/issues/10911 |
| Material example not keyboard/SR accessible | https://github.com/angular/components/issues/15020 |
| MUI tab order into panel | https://github.com/mui/mui-x/issues/4219 |
| VoiceOver can't enter panel | https://github.com/mui/mui-x/issues/18455 |
| MUI toggle missing aria-expanded | https://github.com/mui/mui-x/issues/17082 |
| AG Grid SR doesn't announce state | https://github.com/ag-grid/ag-grid/issues/4861 |
| AG Grid axe unsupported ARIA (2023) | https://github.com/ag-grid/ag-grid/issues/7338 |
| AG Grid aria-expanded not allowed (2024) | https://github.com/ag-grid/ag-grid/issues/7409 |
| AG Grid aria-expanded grid vs treegrid (2025) | https://github.com/ag-grid/ag-grid/issues/10080 |
| AG Grid switch to treegrid (2026) | https://github.com/ag-grid/ag-grid/issues/15012 |
| Saved state + lazy content → empty panel | https://github.com/primefaces/primeng/issues/7526 |
| Action inside panel resets table | https://github.com/mui/mui-x/issues/18451 |
| TanStack "fetch when sub component expanded" (secondary) | https://github.com/TanStack/table/discussions?discussions_q=sub+component+expanded |
| Unmount blocks exit animation | https://github.com/TanStack/table/issues/1203 |
| Expand-all recipe request | https://github.com/mui/mui-x/issues/6041 |
| AG Grid expandAll no-op on master/detail | https://github.com/ag-grid/ag-grid/issues/2940 |
| One-panel-at-a-time, not planned | https://github.com/mui/mui-x/issues/17449 |
| Material expand-on-click, 80 comments | https://github.com/angular/components/issues/6095 |
| Material maintainer + user comments on #6095 | https://api.github.com/repos/angular/components/issues/6095/comments |
| Whole-row click toggle (TanStack) | https://github.com/TanStack/table/issues/349 |
| Row-click toggle for mobile (MUI) | https://github.com/mui/mui-x/issues/7596 |
| Row click vs selection, not planned | https://github.com/mui/mui-x/issues/19149 |
| Conditional panels need internal selectors | https://github.com/mui/mui-x/issues/19146 |
| Animation request, waiting for 👍 | https://github.com/mui/mui-x/issues/10240 |
| Material animation lagging | https://github.com/angular/components/issues/15491 |
| PrimeNG no expand animation | https://github.com/primefaces/primeng/issues/5612 |
| Shared isExpanded flag collision | https://github.com/TanStack/table/issues/3333 |
| Tree + panel can't open together | https://github.com/mui/mui-x/issues/12088 |
| Panel on group rows | https://github.com/mui/mui-x/issues/19589 |
| subRows lazy-load labelled "expanded rows" | https://github.com/TanStack/table/issues/1884 |
| Filter into panel content | https://github.com/mui/mui-x/issues/13505 |
| Detail grids absent until expanded | https://github.com/ag-grid/ag-grid/issues/4903 |
| MUI master/detail request, Pro, 368 👍 | https://github.com/mui/mui-x/issues/211 |
| AG Grid master/detail enterprise-only | https://github.com/ag-grid/ag-grid/issues/7905 |
| AG Grid enterprise-only reply | https://api.github.com/repos/ag-grid/ag-grid/issues/7905/comments |
| TanStack sweep: #5110 closed by KevinVandy | https://github.com/TanStack/table/issues/5110 |
| Angular sweep: close-candidate #12793 | https://github.com/angular/components/issues/12793 |
| Angular sweep: close-candidate #25859 | https://github.com/angular/components/issues/25859 |
