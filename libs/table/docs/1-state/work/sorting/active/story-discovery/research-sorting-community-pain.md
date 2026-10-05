# What do people struggle with when sorting a table?

**Date:** 2026-09-17 · **Mode:** community-pain

Competitor set: TanStack Table, AG Grid, MUI X Data Grid, PrimeNG Table — the set named by the
caller, and the four that dominate the React/Angular grid space per the `data-grid / table` topic
anchors in `~/.claude/discovery-sources.md`.

Scope: sorting only. Filtering, grouping and selection appear here **only** where a complaint is
about their collision with sorting.

## Answer

- The complaint people repeat most, across all four libraries and across a decade, is that **the
  sort control does not offer a way back to "no sort"** — or offers one inconsistently. PrimeNG
  still has no third state in its Table; its official answer is "write it yourself".
- The second is that **null / undefined / empty values have no correct home.** It starts as a
  crash (`.getTime()` on null), becomes a wrong order, and ends as a direction-flip bug: a
  comparator that puts blanks last ascending puts them first descending. Asked of AG Grid in
  **2015**, again in 2022, again in 2023 — still no declarative option in its docs as of today.
- The third is that **multi-column sort is invisible.** It is gated behind Shift/Ctrl+click in all
  four. MUI's own issue quotes the feedback verbatim: _"How can user know if they need to hold
  'ctrl' key for multi-sort?"_ It is also unreachable on touch. AG Grid and MUI have both since
  shipped a no-modifier mode; TanStack and PrimeNG have not.
- Sorting **is announced to nobody.** A JAWS user's verbatim report on MUI's grid is the sharpest
  end-user voice found in this corpus. TanStack declined to own `aria-sort` in core as recently
  as **2026-08-03**.
- The most under-served scenario is **a row moving out from under a person mid-edit**, because
  sort re-applies on every data change. Nobody has shipped an answer; the workaround everywhere is
  "take over sorting yourself".

## Method and source reliability

Every issue row below was read from the GitHub API on **2026-09-17**
(`gh api repos/<owner>/<repo>/issues/<n>`), not from memory. Discussion upvotes were read via the
GraphQL API the same day. Source files were fetched raw from GitHub at the pinned refs stated in
each row. Vendor doc pages were fetched live the same day.

**Reliability notes that change how a number below should be read** — carried from
`~/.claude/discovery-sources.md`:

| Tracker              | How to read its numbers                                                                                                                                                                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ag-grid/ag-grid`    | **`closed` does not mean fixed.** AG Grid triages GitHub into a private tracker (AG-nnnn) and closes fast; `closed` means "moved or answered". 👍 counts are near-universally 0 and **carry no signal**. Every AG Grid capability claim here is confirmed against the live docs page, never against issue state              |
| `mui/mui-x`          | **👍 is real signal** — the `waiting for 👍` label is an explicit demand vote. `support: premium standard` / `support: pro standard` means the item arrived through **paid support** — stronger than 👍 but not quantifiable                                                                                                 |
| `TanStack/table`     | Discussions carry upvotes and are **higher-signal than issues here**: the top sorting discussion has 58 upvotes, more than any sorting issue has reactions. Watch for the bulk triage sweep of **2022-04-08** — a cluster of v7 issues closed on one date with no fix; `closed` on that date means "v7 is over", not "fixed" |
| `primefaces/primeng` | Long-lived regressions are normal and age is informative, not a sign of irrelevance. A `Resolution: Needs Upvote 👍` label plus a bot comment means the item is parked pending community votes                                                                                                                               |

**Cross-tracker comparison of counts is not valid.** A 5-👍 AG Grid issue and a 5-👍 MUI issue do
not mean the same thing. Counts are reported per tracker and compared only within one.

---

## Findings

### Theme 1 — "Let me get back to no sort" is the single most repeated request

A two-state toggle (asc ⇄ desc) strands a person: once they have sorted, they cannot see the data
in its original order again without reloading the page.

| Source                                                                                                                     | Opened     | State (2026-09-17)                                                                           | What was said                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [primefaces/primeng#12553](https://github.com/primefaces/primeng/issues/12553)                                             | 2023-01-25 | **open**, 9 👍, 13 comments, labels `Resolution: Help Wanted`, `Resolution: Needs Upvote 👍` | "Sortable table columns are currently boolean, a two click system… The table sort headers should have 3 clicks… **This has been requested for years and seems to have been closed before ([3217])**"                                                                |
| [primefaces/primeng#12553 comment](https://github.com/primefaces/primeng/issues/12553#issuecomment-1568252310), @glqennova | 2023-05-30 | —                                                                                            | "Is actually uncommon find tables that doesn't have the sort reset at 3rd click, i wonder why they dont add this new feature, it is actually easy to set"                                                                                                           |
| [primefaces/primeng#12553 comment](https://github.com/primefaces/primeng/issues/12553), @hugovlc                           | 2023-06-13 | —                                                                                            | "Makes no sense not having a state with no value. We might want to sort by a different field and forget about the previous one. I don´t wanna code special cases in which I have to reset the state of the table. Please consider doing this. **Is common sense.**" |
| [primefaces/primeng#12553 comment](https://github.com/primefaces/primeng/issues/12553), @GusBeare                          | 2023-09-19 | —                                                                                            | "Any news on this? Just discovered it. **Why anyone would build and release a sort feature without any option to 'reset' is hard to understand.**"                                                                                                                  |
| [primefaces/primeng#8072](https://github.com/primefaces/primeng/issues/8072)                                               | 2019-08-21 | closed 2020-04-22, not merged                                                                | A community PR implementing exactly this: "first 2 click sort ascending / descending; 3rd click sorts the table data in its default order"                                                                                                                          |
| [TanStack/table#1053](https://github.com/TanStack/table/issues/1053)                                                       | 2018-07-11 | closed 2018-10-04, 5 👍                                                                      | "Clear sorting - 3-state sorting… after 3rd click sorting is removed from that column"                                                                                                                                                                              |
| [TanStack discussion #2848](https://github.com/TanStack/table/discussions/2848)                                            | 2020-11-10 | 3 upvotes, unanswered                                                                        | The _inverse_ ask — a user wanting to **disable** removal because the third click surprised them                                                                                                                                                                    |

**Where the libraries land**, read from the docs and source on 2026-09-17:

| Library  | Third state ("none")                                                                                                                                                              | Evidence                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid  | **Yes, default.** Cycle is `ascending -> descending -> none`; `sortingOrder` on colDef accepts `null` in a custom cycle                                                           | [row-sorting docs](https://www.ag-grid.com/javascript-data-grid/row-sorting/)                                                                            |
| MUI X    | **Yes, default.** `sortingOrder` defaults to `['asc', 'desc', null]`; removing `null` makes columns asc/desc only                                                                 | [sorting docs](https://mui.com/x/react-data-grid/sorting/)                                                                                               |
| TanStack | **Yes, default.** `enableSortingRemoval` defaults on; cycle `'none' -> 'desc' -> 'asc' -> 'none'`                                                                                 | [sorting guide](https://tanstack.com/table/v8/docs/guide/sorting)                                                                                        |
| PrimeNG  | **No.** `Table.sort()` in `sortMode: 'single'` does `this._sortOrder = this.sortField === event.field ? this.sortOrder * -1 : this.defaultSortOrder` — a pure flip, no zero state | [`packages/primeng/src/table/table.ts` L1531](https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts), fetched 2026-09-17 |

PrimeNG's official answer is a showcase page titled _removablesort_ whose prose reads: **"The
removable sort can be implemented using the `customSort` property."**
([`apps/showcase/doc/table/removablesort-doc.ts`](https://github.com/primefaces/primeng/blob/master/apps/showcase/doc/table/removablesort-doc.ts),
fetched 2026-09-17). There is no `removableSort` input on the Table — `grep -i removable` over
`table.ts` returns 0 hits. The documented path is "take over sorting entirely and reimplement it".

---

### Theme 2 — The toggle cycle is not stable: it changes depending on the data

This is the highest-reaction sorting bug in the TanStack tracker, and its root cause is a design
choice, not a typo: **the first click's direction is inferred from the type of the first row's
value.**

From `packages/table-core/src/features/RowSorting.ts` at tag `v8.21.3`, fetched 2026-09-17:

```ts
column.getAutoSortDir = () => {
  const firstRow = table.getFilteredRowModel().flatRows[0];
  const value = firstRow?.getValue(column.id);
  if (typeof value === 'string') {
    return 'asc';
  }
  return 'desc';
};
```

```ts
const sortDescFirst =
  column.columnDef.sortDescFirst ??
  table.options.sortDescFirst ??
  column.getAutoSortDir() === 'desc';
```

`undefined` is not a string, so a column whose **first** row happens to be blank flips to
descending-first — and the visible click cycle changes under the person's hands as the data
changes.

| Source                                                                          | Opened     | State (2026-09-17)                                                      | What was said                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [TanStack/table#4289](https://github.com/TanStack/table/issues/4289)            | 2022-08-08 | closed 2024-04-13, **16 reactions (4 👍)**, 10 comments                 | "when an undefined cell value is present in a column, the sorting toggle for that column doesn't follow the `asc-desc-undefined` pattern; instead, it may go `asc-undefined`, `asc-desc`, **`asc-undefined-desc-undefined`, and a multitude of other variations**" |
| [#4289 comment](https://github.com/TanStack/table/issues/4289), @saevarb        | 2023-02-18 | —                                                                       | "the sorting order just goes from nothing to `desc` and back to nothing… After digging through the code and adding some breakpoints, I think I have figured out what the issue is… **avoiding the broken `getAutoSortDir` code**"                                  |
| [#4289 comment](https://github.com/TanStack/table/issues/4289), @JoepKockelkorn | 2024-01-18 | —                                                                       | "This was un extremely unintuitive solution, but `sortDescFirst: false` worked for me. It forces sorting to always follow the `asc-desc-undefined` cycle, even when there is `undefined` data in a cell. **This should be the default, in my opinion.**"           |
| [TanStack/table#5147](https://github.com/TanStack/table/issues/5147)            | 2023-10-30 | closed **2026-08-03** (2 years 9 months open), 7 reactions, 10 comments | "When the data in the table column is all the same value (an empty string), `header.column.getIsSorted()` goes from ascending to false and **never reaches descending**"                                                                                           |
| [TanStack discussion #6142](https://github.com/TanStack/table/discussions/6142) | 2026-01-07 | 1 upvote, **unanswered**                                                | "Does the 'auto' sorting strategy work as intended? What is the spec?"                                                                                                                                                                                             |

A related surprise in the same file: `getAutoSortingFn` names its local `firstRows` but computes
`table.getFilteredRowModel().flatRows.slice(10)` — which **drops** the first ten rows and scans
every row after them to guess the column type. Reported here as observed source, not as a filed
bug; no issue was found stating it.

**TanStack's own guide concedes the trap** rather than fixing it: _"You may want to explicitly set
the `sortDescFirst` column option on any columns that have nullable values"_
([sorting guide](https://tanstack.com/table/v8/docs/guide/sorting), fetched 2026-09-17).

---

### Theme 3 — Null / undefined / empty ordering: three bugs wearing one coat

The complaint arrives in three stages, and the libraries have answered stage 1 and stage 2 but
mostly not stage 3.

**Stage 1 — it crashes.**

| Source                                                                     | Opened     | State                                                                       | What was said                                                                                                                                                                |
| -------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TanStack/table#4041](https://github.com/TanStack/table/issues/4041)       | 2022-06-21 | closed 2022-07-08                                                           | "A column with mostly `Date` values will automatically use the `datetime` sort function, but that function does not handle nulls and **crashes on the call to `getTime()`**" |
| [TanStack/table#3269](https://github.com/TanStack/table/issues/3269)       | 2021-05-13 | closed **2022-04-08** (bulk sweep date — read as "v7 is over", not "fixed") | "`string` sort type crashes when the column contains a null value"                                                                                                           |
| [TanStack/table#3400](https://github.com/TanStack/table/issues/3400)       | 2021-07-22 | closed                                                                      | "Unable to date sort if some values are null"                                                                                                                                |
| [primefaces/primeng#681](https://github.com/primefaces/primeng/issues/681) | 2016-07-29 | closed 2016-11-01, 3 👍                                                     | "when sorting a column which contains some rows with 'value is null', **the sort algorythm just stops**"                                                                     |

**Stage 2 — it does not crash, but the blanks land in the middle.**

| Source                                                                       | Opened     | State                                      | What was said                                                                                                                                                              |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TanStack/table#948](https://github.com/TanStack/table/issues/948)           | 2018-05-04 | closed                                     | "default sort method mixes zeroes and nulls/undefineds (**and doesn't match doco**)"                                                                                       |
| [TanStack/table#1616](https://github.com/TanStack/table/issues/1616)         | 2019-10-28 | closed                                     | "Null and Undefined Values Sorted to the Top"                                                                                                                              |
| [TanStack/table#5191](https://github.com/TanStack/table/issues/5191)         | 2023-12-06 | closed 2024-04-13, **13 reactions (9 👍)** | A regression between `8.5.13` and `8.10.7`: "now, sorting undefined values doesn't work as usual… I decided to try out reverting the lib version, and it worked just fine" |
| [primefaces/primeng#7227](https://github.com/primefaces/primeng/issues/7227) | 2019-02-10 | closed 2020-03-18, 2 👍                    | "The undefined values are sorted **in between** the other values. The sort order is also not correct"                                                                      |
| [TanStack/table#6060](https://github.com/TanStack/table/issues/6060)         | 2025-07-23 | merged 2025-10-08                          | `fix(sort): treat null values the same as undefined in SortUndefined` — i.e. until late 2025, `sortUndefined` did not cover `null`                                         |

**Stage 3 — the direction flip. This is the one nobody has a declarative answer for.**
A symmetric comparator that puts blanks last in ascending necessarily puts them first in
descending. Most people want blanks last _both ways_.

| Source                                                                          | Opened         | State (2026-09-17)                                    | What was said                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ag-grid/ag-grid#351](https://github.com/ag-grid/ag-grid/issues/351)            | **2015-07-30** | closed 2015-08-04                                     | "sorting of the grid put null value on the top. Can you change it that the null value always stays at the bottom?" — maintainer @ceolter: "you can provide your own comparator in the colDef to achieve this??"                                             |
| [ag-grid/ag-grid#4878](https://github.com/ag-grid/ag-grid/issues/4878)          | 2022-01-18     | closed 2022-01-19                                     | Same ask, 7 years later. Answered by another _user_ pasting a hand-written comparator                                                                                                                                                                       |
| [ag-grid/ag-grid#7356](https://github.com/ag-grid/ag-grid/issues/7356)          | 2023-12-16     | closed 2023-12-18, tagged internal ticket **AG-4861** | "Adding nulls last/nulls first specifier to sorting options". AG staff @AG-Zoheil: "**Currently there's no way to implement this behaviour with AG Grid besides using your own custom comparator.** However, we do already have a feature request for this" |
| [TanStack discussion #2371](https://github.com/TanStack/table/discussions/2371) | 2020-05-26     | 3 upvotes, answered                                   | "Force null or empty values to bottom when sorting?"                                                                                                                                                                                                        |
| [TanStack discussion #5930](https://github.com/TanStack/table/discussions/5930) | 2025-02-25     | 2 upvotes, **unanswered**                             | "Issue: Sorting null values to the bottom in @tanstack-table" — same question, five years later                                                                                                                                                             |
| [TanStack/table#6061](https://github.com/TanStack/table/issues/6061)            | 2025-07-23     | **open**                                              | "My problem is to get the null/undefined results always to the bottom of the table. I would have assumed that `sortUndefined` would do the trick but **it did not.**" Carries a hand-built Excel-behaviour compatibility table                              |
| [mui/mui-x#9275](https://github.com/mui/mui-x/issues/9275)                      | 2023-06-08     | closed 2023-06-09, label `support: commercial`        | A paying customer asking to pin an editable row to the bottom regardless of sort direction                                                                                                                                                                  |

**Current state of the art, verified on the live docs 2026-09-17:**

| Library  | Declarative blanks-last-both-ways?                                                                                                                                                                                                                                                               | What is offered                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack | Partial                                                                                                                                                                                                                                                                                          | `sortUndefined: 'first' \| 'last' \| false \| -1 \| 1`, default `1`. `'first'`/`'last'` are direction-independent; `-1`/`1` are not ([sorting guide](https://tanstack.com/table/v8/docs/guide/sorting)) |
| MUI X    | **No option — a documented recipe.** The docs ship an "asymmetric comparator" example using `getSortComparator()` to "keep the `null` values at the bottom when sorting is applied (regardless of the sorting direction)" ([sorting docs](https://mui.com/x/react-data-grid/sorting/))           |
| AG Grid  | **No.** Custom `comparator` only. Its signature `(valueA, valueB, nodeA, nodeB, isDescending)` passes `isDescending`, so an asymmetric comparator is _writable_ — but the doc page shows no null handling at all ([row-sorting docs](https://www.ag-grid.com/javascript-data-grid/row-sorting/)) |
| PrimeNG  | **No.** `customSort` / `sortFunction` only                                                                                                                                                                                                                                                       |

**This is the sharpest gap in the whole corpus: an eleven-year-old, cross-library, still-unmet ask
where the vendor's own answer is "write a comparator".**

---

### Theme 4 — Multi-column sort is invisible, and unreachable on touch

All four libraries gate multi-sort behind a keyboard modifier by default. Nobody finds it.

| Source                                                                 | Opened     | State (2026-09-17)                                     | What was said                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [mui/mui-x#14169](https://github.com/mui/mui-x/issues/14169)           | 2024-08-12 | closed **2026-09-07** as `duplicate`                   | "It is not clear how to sort by multiple columns without checking docs." Quotes user feedback verbatim: **"How can user know if they need to hold 'ctrl' key for multi-sort?"**                                                                              |
| [mui/mui-x#14563](https://github.com/mui/mui-x/issues/14563)           | 2024-09-10 | closed 2025-05-22, labels `accessibility`, `plan: Pro` | "1. **Discoverability**: End users are not familiar with the keyboard modifier, a lot of them might not be aware they can multi-sort. 2. **Can't be used on mobile.**"                                                                                       |
| [mui/mui-x#1196](https://github.com/mui/mui-x/issues/1196)             | 2021-03-09 | **open**, **8 👍**, `waiting for 👍`                   | "Are there plans to add multi-column sorting in the toolbar…? I would expect it to work exactly as in **Notion or Airtable**" — a sorting _panel_, not a header modifier. Open 5½ years                                                                      |
| [ag-grid/ag-grid#4784](https://github.com/ag-grid/ag-grid/issues/4784) | 2021-11-18 | closed 2021-12-03, 5 👍, internal **AG-5421**          | "Clicking on Ctrl / Shift / CMD is **not intuitive**". AG staff: _"AG-5421 [Row Sorting] Allow enabling multi-sort by default so the user doesn't have to hold a key pressed to multi-sort (**this will also enable multi-sort for mobile touch devices**)"_ |
| [TanStack/table#3301](https://github.com/TanStack/table/issues/3301)   | 2021-05-31 | closed **2022-04-08 by the stale bot**, no fix         | A community PR adding `enableMultiSortClick`. Bot: "This pull request has been detected as stale (no activity in the last 14 days) and automatically closed"                                                                                                 |
| [TanStack/table#392](https://github.com/TanStack/table/issues/392)     | 2017-07-20 | closed 2017-07-24                                      | "Multi-Sort without holding shiftkey" — the same ask, four years earlier                                                                                                                                                                                     |
| [mui/mui-x#10866](https://github.com/mui/mui-x/issues/10866)           | 2023-10-31 | **open**, 2 👍, `waiting for 👍`, `plan: Pro`          | "DataGrid has interesting keyboard modifiers for primary and secondary sorting. However, **these are difficult for anybody but heavy users to learn.**"                                                                                                      |

**Who shipped what, verified on the live docs 2026-09-17:**

| Library  | No-modifier multi-sort                                                                                                                                                                                                                                          | Modifier default | Tier                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| AG Grid  | **`alwaysMultiSort`** — "forces multi-column sorting without requiring any keyboard modifier". Also `multiSortKey='ctrl'`, `suppressMultiSort`                                                                                                                  | Shift            | Not marked Enterprise on the [row-sorting page](https://www.ag-grid.com/javascript-data-grid/row-sorting/) |
| MUI X    | **`multipleColumnsSortingMode: "always"`** — "lets users click on multiple column headers to add them as sorting criteria without needing to hold down modifier keys". Shipped by [#17925](https://github.com/mui/mui-x/pull/17925), closing #14563, 2025-05-22 | Ctrl / Shift / ⌘ | **Multi-sorting requires Pro plan or above** ([sorting docs](https://mui.com/x/react-data-grid/sorting/))  |
| TanStack | **No dedicated option.** `isMultiSortEvent` can be overridden to always return true — the workaround @gargroh gave on [#3301](https://github.com/TanStack/table/issues/3301) in 2021                                                                            | Shift            | Free                                                                                                       |
| PrimeNG  | **No.** `Table.sort()` reads `metaKey \|\| ctrlKey` directly from the event ([`table.ts` L1546](https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts), fetched 2026-09-17)                                                     | Ctrl / ⌘         | Free                                                                                                       |

**The tier split is the finding.** MUI meters multi-column sorting behind Pro; AG Grid, the most
aggressively metered of the four, gives it away in Community. That separates "expensive to build"
from "chosen to meter" — multi-sort is evidently cheap enough that AG Grid does not bother to
charge for it, and valuable enough that MUI does.

MUI also considered metering _stable sorting_ — @MBilalShafi on
[#10866](https://github.com/mui/mui-x/issues/10866), 2023-11-07: "We discussed and decided to
consider the stable sort as a **`Pro` option** alongside multi-sorting." Still open, unshipped,
2026-09-17.

**Related sub-complaint — the priority indicator.** Once multi-sort is on, the badge showing which
column ranks first is small and clips.

| Source                                                       | Opened     | State                         | What was said                                                                                                                                   |
| ------------------------------------------------------------ | ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [mui/mui-x#13406](https://github.com/mui/mui-x/issues/13406) | 2024-06-06 | closed 2024-06-26, 8 comments | "Multi Column Sort Indicator Cut off when Column is narrow… **This is easily reproducible on the demo page**"                                   |
| [mui/mui-x#13625](https://github.com/mui/mui-x/pull/13625)   | 2024-06-25 | merged 2024-06-26             | The fix was a CSS nudge — "Sets the multi-sort badge `overlap` prop to `circular`… **hopefully** in most cases will prevent it getting cut off" |

---

### Theme 5 — A sortable column does not look sortable until you hover it

Distinct from multi-sort discoverability: people cannot tell a column is sortable at all.

| Source                                                                                                           | Opened     | State (2026-09-17)                      | What was said                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [mui/mui-x#22188](https://github.com/mui/mui-x/issues/22188)                                                     | 2026-04-24 | **open**, label `accessibility`         | "Sortable Icon Only Displays for Column Headers Upon Mouse Hover… **Arrow Focus Through the Table Columns Headers does not display the sortable icon or give any indication that they are sortable**" |
| [mui/mui-x#1076](https://github.com/mui/mui-x/issues/1076)                                                       | 2021-02-18 | closed 2021-05-13, 4 👍, 12 comments    | "When a sortable column is not sorted is there any way to surface a 3rd icon type…? the sort icon is **removed from the DOM altogether** when a column is unsorted"                                   |
| [TanStack discussion #4723](https://github.com/TanStack/table/discussions/4723)                                  | 2023-02-22 | 2 upvotes, answered                     | "📌 The sort icon should always visible 🕵🏼‍♀️"                                                                                                                                                           |
| [TanStack discussion #5195](https://github.com/TanStack/table/discussions/5195)                                  | 2023-12-09 | 1 upvote                                | "How to display sort icon all the time?"                                                                                                                                                              |
| [mui/mui-x#3886](https://github.com/mui/mui-x/issues/3886)                                                       | 2022-02-07 | **open**, 15 comments, `waiting for 👍` | The mirror complaint: "Headers should not be clickable(mouse) or tabbed into (keyboard) when headers are plain text… **since there is no action that occurs when they click on the headers**"         |
| [mui/mui-x#20189](https://github.com/mui/mui-x/issues/20189) → [#20430](https://github.com/mui/mui-x/pull/20430) | 2025-11-04 | fixed 2025-11-25                        | "Sort buttons in column headers are of **insufficient color contrast**" — "For non-text elements contrast ratio should be at least 3:1"                                                               |

Hover-only affordance fails three groups at once: touch users, keyboard users, and anyone
scanning. #3886 and #22188 are the same design decision read from both directions.

---

### Theme 6 — Sorting announces nothing, and the headless libraries decline to own it

This theme has the best end-user evidence in the corpus and the clearest wontfix.

**The end-user voice.** [mui/mui-x#4124](https://github.com/mui/mui-x/issues/4124), opened
2022-03-08, **still open** on 2026-09-17, label `accessibility`. The reporter pasted a JAWS user's
own words verbatim:

> "If I use standard screen reader commands for navigating up/down/left/right through either of
> the tables, **my screen reader does not tell me that anything can be sorted.** I've eventually
> figured out that you can summon up a sort of menu to choose to sort things, but none of the
> controls that trigger it are announced as anything but plain text."

> "If you use a screen reader to navigate either table like a standard data table, the column
> headers are not exposed as interactive controls, **so you have no idea you can use them for
> something.**"

> "if you experimentally activate one of the column headers the sort does happen, but **it's not
> announced, and neither is the sorted state/order.**"

> "[The W3C APG example] I can use and figured out how to use it fairly easily. The React one not
> so much, which **I assume would likely defeat a lot of people less familiar with the way these
> things are supposed to work.**"

This is the only genuine end-user (rather than integrator) voice found in the whole sorting
corpus, across four trackers.

**The wontfix.** TanStack has been asked for `aria-sort` twice, five years apart, and declined
both times.

| Source                                                                                 | Opened         | State (2026-09-17)                                                                | What was said                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TanStack/table#2992](https://github.com/TanStack/table/issues/2992)                   | 2021-01-17     | closed **2022-04-08** (the bulk sweep date), **11 reactions (7 👍)**, 12 comments | "`useSortBy` should leverage the `aria-sort` attribute… **The demo for `useSortBy` is not keyboard accessible**"                                                                                                                                                                                                             |
| [#2992 comment](https://github.com/TanStack/table/issues/2992), @tannerlinsley         | 2022-08        | —                                                                                 | "It's headless, so you should be able to put your own aria attribute in your markup depending on the table state" — then, to the pushback: "I'm happy to accept any PRs for better aria attrs!"                                                                                                                              |
| [#2992 comment](https://github.com/TanStack/table/issues/2992), @nicklemmon            | 2022-08-12     | —                                                                                 | "It _is_ headless though it does help render relevant HTML attributes for some features of the table but not others. **`col-span` and `row-span`, for example**… For some headless libraries (React ARIA, Downshift, Radix) they are all about adding the right HTML attributes for handling state changes (including ARIA)" |
| [#2992 comment](https://github.com/TanStack/table/issues/2992), @esetnik               | 2022-08-12     | —                                                                                 | The trap named: "Make sure the rendered `th` does **not** have `role='button'` — that would wipe out the semantic meaning of the `th` and make `aria-sort` meaningless"                                                                                                                                                      |
| [TanStack/table#6506](https://github.com/TanStack/table/pull/6506)                     | **2026-08-03** | **closed unmerged the same day** (`merged: false`, base `beta`)                   | The promised PR arrived: `feat: implement and export getAriaSort`. Author: "This function was placed in a lot of examples and we just introduced it into our codebase… this needs to be used anyway all the time if you want to have an accesible table"                                                                     |
| [#6506 comment](https://github.com/TanStack/table/pull/6506), @mstruebing              | 2026-08-03     | —                                                                                 | "hey @KevinVandy can you share why you just closed this? Like, why shouldn't this useful function in this project?"                                                                                                                                                                                                          |
| [#6506 comment](https://github.com/TanStack/table/pull/6506), @KevinVandy (maintainer) | **2026-08-03** | —                                                                                 | **"If we were to add something like this, it would be under a more comprehensive accessibility plugin. Not in core. At this point, it's best to leave this to the component libraries and design system, I think."**                                                                                                         |

`getAriaSort` exists in TanStack today only as copy-pasted example code —
`gh api search/code?q=getAriaSort+repo:TanStack/table` returns 6 hits on 2026-09-17, **all six
under `examples/react/`** (`lib-mantine`, `lib-material-ui`, `lib-chakra-ui`, `kitchen-sink-hero-ui`,
`kitchen-sink-react-aria`, `kitchen-sink-material-ui`), none in a shipped package.

**PrimeNG shipped `aria-sort` and then broke it, twice.**

| Source                                                                         | Opened     | State             | What was said                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [primefaces/primeng#8684](https://github.com/primefaces/primeng/issues/8684)   | 2020-03-28 | closed 2020-03-30 | "pSortableColumn should add aria-sort for readers"                                                                                                                                                                 |
| [primefaces/primeng#11051](https://github.com/primefaces/primeng/issues/11051) | 2022-01-11 | closed 2022-01-11 | "Table multi sort aria attributes are not updated"                                                                                                                                                                 |
| [primefaces/primeng#17090](https://github.com/primefaces/primeng/issues/17090) | 2024-12-17 | closed 2024-12-17 | "**Appears to be a regression of #11051.** When sorting a column on a `p-table` with `sortMode='multiple'`, the `aria-sort` attribute is **stuck as `ascending`**… This can be observed on the PrimeNG showcase"   |
| [primefaces/primeng#18571](https://github.com/primefaces/primeng/issues/18571) | 2025-07-08 | closed 2025-07-08 | The attribute was bound wrong all along: "`pSortableColumn` directive uses `[aria-sort]`, but it should be `[attr.aria-sort]`… `Error: NG0303: Can't bind to 'aria-sort' since it isn't a known property of 'th'`" |

**Where the four stand on sort a11y, verified from source/docs 2026-09-17:**

| Library  | `aria-sort`                                                                                                                                                                                                                                                                                                                                                    | Keyboard activation                                                                                                  | Multi-sort priority announced                                                                                                                                                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PrimeNG  | Yes — `'[attr.aria-sort]': 'sortOrder'`, values `'ascending' \| 'descending' \| 'none'` ([`table.ts` L3672, L3720](https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts))                                                                                                                                                     | Yes — `@HostListener('keydown.space')` + `keydown.enter`, `tabindex=0`, `role=columnheader` (same file, L3739–L3752) | **No** — `updateSortState()` maps a multi-sort entry to plain ascending/descending; the priority index is never exposed                                                                                                                                                                  |
| MUI X    | Yes — `aria-sort={ariaSort}` on the `role="columnheader"` element ([`GridGenericColumnHeaderItem.tsx` L100–L103](https://github.com/mui/mui-x/blob/master/packages/x-data-grid/src/components/columnHeaders/GridGenericColumnHeaderItem.tsx))                                                                                                                  | Yes, since [#1022](https://github.com/mui/mui-x/issues/1022) (closed 2021-04-13)                                     | Not found; [#16456](https://github.com/mui/mui-x/issues/16456) is **open** on the weaker problem that **every** sort button carries the identical label "Sort", "which makes them hard to tell apart from each other" (label `support: pro standard` — reached MUI through paid support) |
| AG Grid  | Yes — `_setAriaSort(element, sort)` with `AriaSortState = 'ascending' \| 'descending' \| 'other' \| 'none'` ([`packages/ag-stack/src/utils/aria.ts` L7, L168](https://github.com/ag-grid/ag-grid/blob/latest/packages/ag-stack/src/utils/aria.ts)). Note the `'other'` state — the only library of the four with a value for "sorted, but not simply asc/desc" | Unverified (see Unverified)                                                                                          | Unverified                                                                                                                                                                                                                                                                               |
| TanStack | **No.** Declined 2022 and again 2026-08-03                                                                                                                                                                                                                                                                                                                     | Example code only                                                                                                    | No                                                                                                                                                                                                                                                                                       |

The AG Grid [row-sorting docs page](https://www.ag-grid.com/javascript-data-grid/row-sorting/) and
the [MUI X sorting docs page](https://mui.com/x/react-data-grid/sorting/), both fetched
2026-09-17, contain **no mention of accessibility, `aria-sort`, or keyboard activation.** The
capability exists in both codebases and is documented in neither sorting guide.

---

### Theme 7 — The row moves out from under the person (sort × editing, sort × live data)

The largest collision theme by volume, and the one with no shipped answer anywhere.

| Source                                                                          | Opened     | State (2026-09-17)                                          | What was said                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TanStack discussion #5217](https://github.com/TanStack/table/discussions/5217) | 2023-12-18 | **7 upvotes, unanswered**, latest comment 2026-07-08        | "How to stop sorting from being reapplied after the table data updates (**input cell fields**)? If I already have a column sorted and then reset sort, the rows will become unsorted (**and still shift positions**)." Replies: "Has anyone found an answer to this? I'm not sure why a feature like this would just be removed in a version upgrade…" / "Also looking for a solution here, other than manageing filtering and sorting myself" |
| [TanStack discussion #5787](https://github.com/TanStack/table/discussions/5787) | 2024-10-31 | 1 upvote, unanswered                                        | "Table auto sorting when row value changes"                                                                                                                                                                                                                                                                                                                                                                                                    |
| [ag-grid/ag-grid#7012](https://github.com/ag-grid/ag-grid/issues/7012)          | 2023-09-05 | closed 2023-10-23 **for inactivity, not fixed**             | "once we applied sort in cell while editing the cell value the table will auto sort based on the new value. How to prevent this behavior. **I would like to keep the row in same index even if value has changed during edit.**"                                                                                                                                                                                                               |
| [ag-grid/ag-grid#7444](https://github.com/ag-grid/ag-grid/issues/7444)          | 2024-01-17 | closed                                                      | "If any sorting is enabled for a column and we are editing any cell of the column, **then the edited row's position automatically changing based on the sorting.** How to suppress this"                                                                                                                                                                                                                                                       |
| [TanStack/table#1188](https://github.com/TanStack/table/issues/1188)            | 2018-11-08 | closed 2019-01-31                                           | The corruption variant: "if you edit a cell in that column in such a way as to re-order it, **both the cell in the position that you edited, and the cell in the new position that it now occupies appear to have the new value**"                                                                                                                                                                                                             |
| [TanStack/table#519](https://github.com/TanStack/table/issues/519)              | 2017-09-29 | closed 2017-10-06                                           | "after column is sorted, edition that occures on the cell applies to another too"                                                                                                                                                                                                                                                                                                                                                              |
| [primefaces/primeng#14494](https://github.com/primefaces/primeng/issues/14494)  | 2024-01-05 | closed 2024-06-15 **as `not_planned`, `Resolution: Stale`** | "A table setup for cell editing **throws `TypeError: Cannot read properties of undefined (reading 'firstChange')`** when sorting"                                                                                                                                                                                                                                                                                                              |
| [ag-grid/ag-grid#4312](https://github.com/ag-grid/ag-grid/issues/4312)          | 2021-01-21 | closed 2021-01-25, 4 👍                                     | The insert variant: "New row inserted on random position when using transaction on a sorted table"                                                                                                                                                                                                                                                                                                                                             |

The adjacent ask — "**keep this row where I put it, whatever the sort says**" — has its own
recurring thread and is also unanswered:

| Source                                                                          | Opened     | State                 | What was said                                                                                                                  |
| ------------------------------------------------------------------------------- | ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [TanStack discussion #2837](https://github.com/TanStack/table/discussions/2837) | 2020-11-04 | 5 upvotes, unanswered | "**Again:** keep one row at the top of the table - regardless of sorting" — the title's "Again" says it had already been asked |
| [TanStack discussion #5039](https://github.com/TanStack/table/discussions/5039) | 2023-08-24 | 3 upvotes, unanswered | "V8 - Pin row to the top of the table, regardless of sorting" — the same ask, three years later, after a major version         |
| [TanStack discussion #2643](https://github.com/TanStack/table/discussions/2643) | 2020-08-14 | 3 upvotes, unanswered | "Constant Secondary Sorted Column"                                                                                             |

AG Grid is the only one of the four that ships a mechanism for this: **`postSortRows`**, documented
with an example that "moves Ireland rows to the top while preserving the underlying sort order"
([row-sorting docs](https://www.ag-grid.com/javascript-data-grid/row-sorting/), fetched
2026-09-17). MUI's answer is a hand-written asymmetric comparator ([#9275](https://github.com/mui/mui-x/issues/9275)).

---

### Theme 8 — Sorting collides with almost every other feature

| Collision           | Source                                                                          | Opened     | State (2026-09-17)                                                                                                                                    | What was said                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Selection**       | [mui/mui-x#14952](https://github.com/mui/mui-x/issues/14952)                    | 2024-10-14 | **open, 17 👍** — the highest-👍 sorting item in the MUI tracker. Labels `waiting for 👍`, `support: premium standard` (arrived through paid support) | "the checkbox column does not support sort feature, which would make it easy for user to **check the selected/unselected items**". Even the workaround breaks layout: "the checkbox column width would be too wide with the sort icon"           |
| **Selection**       | [TanStack discussion #5584](https://github.com/TanStack/table/discussions/5584) | 2024-05-29 | 1 upvote, unanswered                                                                                                                                  | "How to sort a checkbox column"                                                                                                                                                                                                                  |
| **Selection**       | [TanStack discussion #2119](https://github.com/TanStack/table/discussions/2119) | 2020-03-26 | 3 upvotes, unanswered                                                                                                                                 | "Sorting on Selected" — the same ask four years earlier                                                                                                                                                                                          |
| **Row reordering**  | [mui/mui-x#10706](https://github.com/mui/mui-x/issues/10706)                    | 2023-10-17 | **open, 11 👍**, `waiting for 👍`, `plan: Pro`                                                                                                        | The docs say outright "**For now, row reordering is disabled if sorting is applied to the data grid**". User: "we would like the end user to be able to adjust the row order after sorting has been applied - taking it out of the sorted state" |
| **Row reordering**  | [TanStack discussion #5835](https://github.com/TanStack/table/discussions/5835) | 2024-12-17 | 1 upvote, unanswered                                                                                                                                  | "Allow row sorting by column AND dnd?"                                                                                                                                                                                                           |
| **Grouping**        | [mui/mui-x#16540](https://github.com/mui/mui-x/issues/16540)                    | 2025-02-11 | **open**, label `support: premium standard`                                                                                                           | "Enable row grouping and group rows by the same column that was previously sorted. **The sorting is lost… The sorting indicator (arrow) disappears from the column header.**"                                                                    |
| **Grouping**        | [primefaces/primeng#16408](https://github.com/primefaces/primeng/issues/16408)  | 2024-09-19 | **open**, 2 👍, `Resolution: Help Wanted`                                                                                                             | "**This has been reported before and was fixed:** #13773. **But the issue still exists.** When you add `sortField` in combination with `groupRowsBy`, the table is not sorted by the field"                                                      |
| **Grouping**        | [primefaces/primeng#3699](https://github.com/primefaces/primeng/issues/3699)    | 2017-08-18 | closed, 2 👍                                                                                                                                          | "PrimeNg table doesn't support external/internal sorting on grouping rows" — the same complaint, seven years before #16408                                                                                                                       |
| **Grouping**        | [TanStack/table#4414](https://github.com/TanStack/table/issues/4414)            | 2022-09-30 | closed, 5 reactions                                                                                                                                   | "Sorting grouped rows sometimes doesn't work"                                                                                                                                                                                                    |
| **Grouping**        | [ag-grid/ag-grid#13431](https://github.com/ag-grid/ag-grid/issues/13431)        | 2026-03-27 | **open**                                                                                                                                              | "When sorting the auto group column in a grouped grid, the `params.request.sortModel` array contains **duplicate keys**… This causes issues when processing the sort model to send to the backend API"                                           |
| **Column resizing** | [TanStack/table#2359](https://github.com/TanStack/table/issues/2359)            | 2020-05-22 | closed, 3 reactions                                                                                                                                   | "Resizing with `useResizeColumns` can **trigger sorting**" — the drag ends in a click on the header                                                                                                                                              |
| **Column resizing** | [TanStack/table#1638](https://github.com/TanStack/table/issues/1638)            | 2019-11-13 | closed                                                                                                                                                | "Extra sorting action after resizing column"                                                                                                                                                                                                     |
| **Column resizing** | [TanStack discussion #2058](https://github.com/TanStack/table/discussions/2058) | 2020-03-26 | 2 upvotes, answered                                                                                                                                   | "Resizing Columns triggers Column Sorting"                                                                                                                                                                                                       |
| **Pagination**      | [TanStack/table#1040](https://github.com/TanStack/table/issues/1040)            | 2018-07-02 | closed, 3 reactions, 9 comments                                                                                                                       | "Manual Pagination disables the sorting and column filtering"                                                                                                                                                                                    |
| **Pagination**      | [ag-grid/ag-grid#587](https://github.com/ag-grid/ag-grid/issues/587)            | 2015-12-08 | closed, 2 👍, 16 comments                                                                                                                             | "Client side sorting and filtering works **only on current page**"                                                                                                                                                                               |
| **Virtual scroll**  | [TanStack/table#3768](https://github.com/TanStack/table/issues/3768)            | 2022-03-23 | closed 2022-04-08 (bulk sweep), 7 reactions                                                                                                           | "**Without sorting, scroll doesn't change when I update my data. With sorting, it does.**"                                                                                                                                                       |
| **Virtual scroll**  | [primefaces/primeng#13494](https://github.com/primefaces/primeng/issues/13494)  | 2023-08-12 | closed, 3 👍, 11 comments                                                                                                                             | "Virtual Scroll, Lazy Load table **hangs** when sorting, after scrolling to the bottom"                                                                                                                                                          |
| **Filtering**       | [primefaces/primeng#13361](https://github.com/primefaces/primeng/issues/13361)  | 2023-07-21 | closed                                                                                                                                                | "Incorrect behavior when a column is both sortable and filterable, and **user clicks on a certain part of the filter icon**" — the filter control lives inside the sort hit area                                                                 |

PrimeNG's `Table` resets the page on every sort by default: `@Input({ transform: booleanAttribute })
resetPageOnSort: boolean = true` ([`table.ts` L477](https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts),
fetched 2026-09-17) — i.e. sorting on page 7 silently teleports the person to page 1. Opt-out
exists; the default choice is the product decision.

---

### Theme 9 — Server-side sorting has no loading story and an easy infinite loop

| Source                                                                          | Opened     | State (2026-09-17)                                                                                                 | What was said                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TanStack discussion #2033](https://github.com/TanStack/table/discussions/2033) | 2020-03-20 | **58 upvotes** — by far the highest-voted sorting item found anywhere in this corpus — **unanswered**, 14 comments | "It would be great if we could have an example of server-side external sorting and filtering". @Ajaay: "If I watch the table filters state in my useEffect hook and pass it to my fetchData callback **I just get an infinite loop**"                           |
| [mui/mui-x#7583](https://github.com/mui/mui-x/issues/7583)                      | 2023-01-17 | **open, 23 👍**                                                                                                    | "Client to server model mapper solution for filtering, sorting and pagination"                                                                                                                                                                                  |
| [primefaces/primeng#16982](https://github.com/primefaces/primeng/issues/16982)  | 2024-12-08 | **open**, 2 👍, `Resolution: Needs More Information`                                                               | "p-table is having **endless loop** when calling server API (server side sorting)"                                                                                                                                                                              |
| [mui/mui-x#21976](https://github.com/mui/mui-x/issues/21976)                    | 2026-04-03 | closed 2026-04-15, 8 comments                                                                                      | "Loading overlay disappears before loading is false (and **no overlay when sorting or filtering**)" — the person added their own query-loading indicator to observe it: "(`loading === true`) The loading overlay is replaced by a pale grey background 🤔 🐛?" |
| [TanStack/table#5147](https://github.com/TanStack/table/issues/5147)            | 2023-10-30 | closed 2026-08-03, 7 reactions                                                                                     | Manual sorting + all-equal values: the direction toggle stalls (also Theme 2)                                                                                                                                                                                   |
| [TanStack/table#6048](https://github.com/TanStack/table/issues/6048)            | 2025-06-26 | closed 2026-07-30                                                                                                  | "`enableSortingRemoval` doesnt seem to be working with `manualSorting`" — the third state silently stops existing when sorting moves to the server                                                                                                              |
| [ag-grid/ag-grid#760](https://github.com/ag-grid/ag-grid/issues/760)            | 2016-03-03 | closed 2017-10-12, 9 comments                                                                                      | "**it is blinking my grid two times.** The first time when I click (nothing is reordered because I'm doing server side sorting), and again when the data is returned"                                                                                           |
| [ag-grid/ag-grid#13420](https://github.com/ag-grid/ag-grid/issues/13420)        | 2026-03-25 | closed                                                                                                             | "regression calling api refreshserverside to load rows doesn't re-sort **and also doesn't clear the column header sort indicator**"                                                                                                                             |
| [mui/mui-x#792](https://github.com/mui/mui-x/issues/792)                        | 2020-12-28 | closed, 4 reactions                                                                                                | "Sorting order of input rows isn't respected when `sortingMode='server'`"                                                                                                                                                                                       |

The shape of the pain is consistent: the click registers, the indicator changes, and **nothing
visible happens until the server answers** — with no overlay, no skeleton and no disabled state in
between. #760 is the same complaint in 2016 that #21976 is in 2026.

No issue was found in any of the four trackers asking for **debounce** of rapid sort clicks. If
the requirement exists it is not voiced on these trackers (see Unverified).

---

### Theme 10 — Custom comparators: the escape hatch everyone is pushed into, and it bites

Because all four libraries answer Themes 1, 3 and 7 with "write your own comparator", comparator
ergonomics are load-bearing — and they are a complaint cluster in their own right.

| Source                                                                         | Opened         | State (2026-09-17)                                                       | What was said                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [primefaces/primeng#16674](https://github.com/primefaces/primeng/issues/16674) | 2024-10-31     | **open**, 1 👍, `Resolution: Help Wanted`, `Resolution: Needs Upvote 👍` | "the data array **gets sorted also**… If the array was frozen, the sorting fails. **This issue seems to be known since 2017 and was reported several times. Each time, it was closed but not fixed: #2529 #2532 #2630 #8488 #10729**" |
| [primefaces/primeng#2529](https://github.com/primefaces/primeng/issues/2529)   | **2017-04-15** | closed 2017-05-02                                                        | "Datatable sorting should support immutable objects"                                                                                                                                                                                  |
| [primefaces/primeng#2630](https://github.com/primefaces/primeng/issues/2630)   | 2017-04-28     | closed **same day**                                                      | "DataTable sort support for Immutable Data"                                                                                                                                                                                           |
| [primefaces/primeng#8488](https://github.com/primefaces/primeng/issues/8488)   | 2020-01-25     | closed 2020-04-03                                                        | "p-table modifies data array when sorting, errors on frozen array"                                                                                                                                                                    |
| [primefaces/primeng#10729](https://github.com/primefaces/primeng/issues/10729) | 2021-10-08     | closed 2022-11-09, 1 👍                                                  | "Table Component Does Not Support Sorting of Immutable Arrays"                                                                                                                                                                        |
| [mui/mui-x#12853](https://github.com/mui/mui-x/issues/12853)                   | 2024-04-19     | closed                                                                   | "Multi sorting is not working when a custom `sortComparator` is used"                                                                                                                                                                 |
| [mui/mui-x#1511](https://github.com/mui/mui-x/issues/1511)                     | 2021-04-28     | closed, 2 reactions, 10 comments                                         | "How does custom sorting comparators work?" — a documentation gap large enough to generate a ten-comment thread                                                                                                                       |
| [TanStack/table#2349](https://github.com/TanStack/table/issues/2349)           | 2020-05-20     | closed, 5 reactions                                                      | "Cannot overwrite the default sorting method"                                                                                                                                                                                         |
| [TanStack/table#1611](https://github.com/TanStack/table/issues/1611)           | 2019-10-22     | closed, 5 reactions, 13 comments                                         | "Custom Sorting Function"                                                                                                                                                                                                             |
| [TanStack/table#5653](https://github.com/TanStack/table/issues/5653)           | 2024-07-10     | **open**                                                                 | "**Custom `sortingFn` not being run when row key is undefined**" — the escape hatch is bypassed for exactly the values people wrote it to handle                                                                                      |
| [primefaces/primeng#4877](https://github.com/primefaces/primeng/issues/4877)   | 2018-01-19     | closed, 4 👍                                                             | "Add table sort compareFunction feature"                                                                                                                                                                                              |
| [ag-grid/ag-grid#5277](https://github.com/ag-grid/ag-grid/issues/5277)         | 2022-06-14     | closed                                                                   | "Group B after sorting A by **custom comparator causes grid to crash**"                                                                                                                                                               |

**The immutability chain is the sharpest instance of the resurfacing-wontfix pattern in this
corpus**: six PrimeNG issues over nine years (2017-04-15 → still open 2026-09-17) about one
in-place `Array.prototype.sort` on the consumer's own array, closed five times without a fix.

Case sensitivity is the other comparator default people trip over:

| Source                                                                 | Opened     | State                            | What was said                                                                                                                           |
| ---------------------------------------------------------------------- | ---------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [ag-grid/ag-grid#1795](https://github.com/ag-grid/ag-grid/issues/1795) | 2017-07-31 | closed 2017-08-01, 2 👍          | "after updating from v8 to v12 sorting rows by string values is by default **case-sensitive**… 'a', 'B', 'c' will be sorted as B, a, c" |
| [TanStack/table#3137](https://github.com/TanStack/table/issues/3137)   | 2021-03-11 | closed, 5 reactions              | "Sorting - can't sort titlecase and lowercase"                                                                                          |
| [TanStack/table#2202](https://github.com/TanStack/table/issues/2202)   | 2020-04-20 | closed, 3 reactions, 10 comments | "Not Supporting Insensitive case sorting"                                                                                               |
| [TanStack/table#5124](https://github.com/TanStack/table/issues/5124)   | 2023-10-10 | closed, 3 reactions              | "Alphanumeric sorting is broken for **date-formatted strings**"                                                                         |
| [TanStack/table#3450](https://github.com/TanStack/table/issues/3450)   | 2021-09-06 | closed, 4 reactions              | "Sorting does not work correctly with **negative numbers**"                                                                             |
| [mui/mui-x#5049](https://github.com/mui/mui-x/issues/5049)             | 2022-05-30 | closed, 7 comments               | "Allow to customize how the `Intl.Collator` instance is created for sorting operators"                                                  |

AG Grid's answer is `accentedSort`, which its docs pair with an explicit warning: it is "**slower
than default sorting**, particularly with large datasets"
([row-sorting docs](https://www.ag-grid.com/javascript-data-grid/row-sorting/)). Locale-correct
sorting is therefore a deliberate speed/correctness trade the person configuring the table is made
to take, not a default.

---

## Synthesis — where they disagree

**On the third state, three of four agree and PrimeNG is the outlier.** AG Grid, MUI X and
TanStack all ship `asc → desc → none` as the _default_; PrimeNG ships a two-state flip and tells
people to reimplement sorting via `customSort` to get the third. The disagreement resolves cleanly
in favour of the majority: 9 👍 and eleven "+1 / common sense / hard to understand" comments on
[#12553](https://github.com/primefaces/primeng/issues/12553) with no counter-argument anywhere.
**Implication: three-state is table stakes, not an option, and "none" must survive the switch to
server-side sorting** — which is exactly where TanStack lost it
([#6048](https://github.com/TanStack/table/issues/6048)).

**On the starting direction, TanStack disagrees with everyone including itself.** AG Grid, MUI and
PrimeNG start ascending, always, from a static config. TanStack infers it per column from the type
of the first filtered row's value, so the cycle a person sees changes when the data changes. This
produced the highest-reaction sorting bug in its tracker and a guide sentence conceding the trap
rather than fixing it. **Implication: the cycle is part of the UI contract and must be derivable
from the column definition alone, never from a data sample.**

**On multi-sort activation, the vendors have converged on the answer and disagree on the price.**
AG Grid (`alwaysMultiSort`) and MUI X (`multipleColumnsSortingMode: "always"`) both shipped a
no-modifier mode; TanStack and PrimeNG have not. The tier split is the sharp finding: **MUI meters
multi-column sorting behind Pro, AG Grid — otherwise the most aggressively metered of the four —
gives it away in Community.** That is not a build-cost difference; it is a metering decision. MUI
was, on the record, considering metering _stable sorting_ the same way
([#10866](https://github.com/mui/mui-x/issues/10866), 2023-11-07). **Implication: a free library
that ships no-modifier multi-sort and a visible priority indicator is competing exactly where MUI
has drawn its paywall.**

**On multi-sort _discovery_, nobody has an answer and MUI knows it.** The header-modifier is the
only affordance in all four. MUI's [#1196](https://github.com/mui/mui-x/issues/1196) asks for the
Notion/Airtable model — a sorting panel listing the criteria, reorderable — and has sat open with
8 👍 for five and a half years. **Implication: a sort panel is the unclaimed ground in this
category.** It also happens to be the only design that solves touch, discoverability, priority
display and screen-reader exposure at once, instead of one at a time.

**On null/empty ordering, all four agree on the escape hatch and none has the declarative answer.**
TanStack is closest (`sortUndefined: 'first' | 'last'` is direction-independent); MUI documents a
recipe; AG Grid has an eleven-year-old open request tracked as AG-4861 and tells people to write a
comparator; PrimeNG has nothing. **The disagreement that matters is with the people asking**, who
have been asking since 2015 in three different trackers. **Implication: a per-column, direction-
independent `blanks: 'first' | 'last'` is the single highest-value thing available in this feature,
because it is a need the whole category has failed to meet for a decade.** Note the requirement is
not "sort nulls" — it is "blanks stay put when I flip the direction", which a symmetric comparator
API structurally cannot express. AG Grid's `isDescending` parameter and MUI's `getSortComparator`
are both acknowledgements that the symmetric signature was the wrong shape.

**On accessibility, the split is architectural.** AG Grid, MUI and PrimeNG all emit `aria-sort`
from the library; TanStack has now twice declined, most recently on 2026-08-03 with "it's best to
leave this to the component libraries and design system." That is a defensible headless position
and it is also why the only verbatim end-user complaint in this corpus exists. Three further
points where every library is silent:

- **No library announces multi-sort priority.** PrimeNG's `updateSortState()` flattens a multi-sort
  entry to plain `'ascending'`/`'descending'`; the priority number is a visual badge only. AG Grid
  is the only one with an `'other'` `aria-sort` value in its vocabulary, and no issue was found
  showing it used for multi-sort.
- **Neither AG Grid's nor MUI's sorting documentation page mentions accessibility at all**, even
  though both implement `aria-sort`. The capability is undiscoverable to the integrator who has to
  defend it in an audit.
- **Hover-only sort icons** ([mui/mui-x#22188](https://github.com/mui/mui-x/issues/22188), open)
  fail keyboard and touch users identically, and the mirror complaint
  ([#3886](https://github.com/mui/mui-x/issues/3886), open, 15 comments) shows the same design
  also makes non-sortable headers look interactive. Both are open. **Implication: affordance
  visibility is a sorting requirement, not a theming preference.**

**On sort re-applying under a live edit, nobody has shipped anything and the volume is high.**
The only mechanism found in four libraries is AG Grid's `postSortRows`, and it solves the adjacent
problem (pin a row) rather than this one (don't re-rank the row I am editing). Seven upvotes and
three years of unanswered "has anyone found an answer to this?" on
[TanStack #5217](https://github.com/TanStack/table/discussions/5217), plus two AG Grid issues
closed for inactivity, plus a PrimeNG crash closed as `not_planned`. **Implication: "the sort
order freezes while a row is being edited, and re-applies on commit" is a scenario the whole
category has left on the floor.** The related "pin this row regardless of sort" ask has been
re-raised across a major version boundary with the word "Again" in its title.

**On what happens between the click and the data, everyone is equally bad.** Server-side sorting's
own highest-voted artifact is a request for an _example_ (58 upvotes, unanswered, six years).
AG Grid's 2016 "blinking twice" report and MUI's 2026 "no overlay when sorting" report are the same
complaint a decade apart. **Implication: the loading state for a sort is a designed state, not an
afterthought — and it must cover the window where the indicator has moved but the rows have not.**

---

## Not researched

- **Stack Overflow.** Not queried. The source file records that `site:stackoverflow.com` queries
  produced nothing citable twice before across this corpus, and notes that _question volume by tag_
  would be the better proxy for "what integrators get stuck on". That measurement was not taken
  here either.
- **Reddit** (r/reactjs, r/Angular2, r/webdev). Not queried, for the same recorded reason.
- **Telerik / Kendo feedback portal.** Attempted. `feedback.telerik.com/kendo-angular-ui?...&query=sort`
  returned **HTTP 404** on 2026-09-17, so no vote counts or `Unplanned` statuses were obtained from
  it. Kendo is also outside the caller's competitor set.
- **Handsontable, SlickGrid, Material React Table, Angular Material table.** Outside the named
  competitor set; their trackers were not searched.
- **Vendor support forums behind a login** (AG Grid's Zendesk, MUI's paid support queue, PrimeFaces
  PRO). These carry the strongest signal by the source file's own note (`support: premium standard`)
  and are unreadable from here. Only the GitHub-visible _label_ was used.
- **AG Grid's private tracker.** AG-4861 (nulls first/last), AG-5421 (multi-sort without a key) and
  AG-16404 are referenced in public issues but their status is not publicly readable. The
  ag-grid-pipeline page was not fetched.
- **Sort performance at scale** (time-to-sort on 100k rows, re-sort cost on data change). Touched
  only where a complaint mentioned it (`accentedSort` slowness, PrimeNG virtual-scroll hang). No
  systematic look.
- **Sort state persistence / URL round-tripping.** Adjacent and surfaced repeatedly
  ([TanStack discussion #2713](https://github.com/TanStack/table/discussions/2713), 8 upvotes;
  [ag-grid/ag-grid#1785](https://github.com/ag-grid/ag-grid/issues/1785), 24 reactions) but not
  pursued — it reads as a state-management concern, not a sorting one.
- **Internationalized sorting beyond case/accents** — CJK collation, numeric-in-string ordering,
  RTL. Not searched.

## Unverified

- **AG Grid keyboard activation of sort and multi-sort priority announcement.** `_setAriaSort` and
  the `'other'` state were read from
  [`packages/ag-stack/src/utils/aria.ts`](https://github.com/ag-grid/ag-grid/blob/latest/packages/ag-stack/src/utils/aria.ts),
  but the call sites were not traced and the row-sorting docs page is silent on keyboard. Reading
  the header-cell component and AG Grid's dedicated accessibility docs page would confirm it.
- **Whether AG Grid's `alwaysMultiSort` is Community or Enterprise.** The docs fetch reported no
  Enterprise badge on the row-sorting page, which is an _absence of evidence_, not a positive
  confirmation. AG Grid's pricing/feature-comparison page would settle it.
- **Whether AG Grid has shipped a nulls-first/last option since 2023.** The staff answer on
  [#7356](https://github.com/ag-grid/ag-grid/issues/7356) was "no way besides your own comparator",
  and the 2026-09-17 docs page does not mention one — but the docs fetch was summarised by a model,
  not read line by line, so a buried option could have been missed. A `grep` for `nullsFirst` /
  `blanksLast` over the published package would confirm.
- **The `.slice(10)` in `getAutoSortingFn`.** Read directly from `RowSorting.ts` at `v8.21.3` on
  2026-09-17. That it is a bug rather than intentional sampling is **my inference**, not a
  maintainer statement, and no issue reporting it was found. Whether v9 changed it was not checked.
- **Whether MUI's `multipleColumnsSortingMode: "always"` is Pro-gated.** Multi-sorting as a whole is
  documented as Pro-or-above; whether the no-modifier mode carries the same gate was not separately
  confirmed. Reasonable inference: it does, being a mode of a Pro feature.
- **Debounce of rapid sort clicks under server-side sorting.** No issue asking for it was found in
  any of the four trackers. Absence of a filed complaint is weak evidence — the search used the
  terms `sort`, `sorting`, `server`; a term like `throttle` or `race` was not tried.
- **PrimeNG's 2-state flip in `sortMode: 'multiple'`.** Confirmed for `'single'` from `table.ts`
  L1531. The multiple-mode branch (L1546 onward) was read only partially; whether a third state
  exists there is not established.
- **Whether `[TanStack/table#2992](https://github.com/TanStack/table/issues/2992)` was closed on
  its merits or swept.** It closed on **2022-04-08**, the same date as an unrelated stale-bot close
  ([#3301](https://github.com/TanStack/table/issues/3301)) and a v7 issue
  ([#3269](https://github.com/TanStack/table/issues/3269)). The tracker's own reliability note
  warns about bulk sweeps on a single date. The 2026 PR close makes the _position_ unambiguous
  either way, so this does not change the finding.
- **Reaction and upvote counts.** All read 2026-09-17 and correct only as of that date.
  Cross-tracker comparison is invalid per the Method section.

## Sources

| Claim                                                                                                                                                                                                                   | Source                                                                                                                                 | Read       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| PrimeNG has no third sort state; Table sort cycle is a pure flip                                                                                                                                                        | https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts (L1531)                                          | 2026-09-17 |
| PrimeNG's official third-state answer is "use `customSort`"                                                                                                                                                             | https://github.com/primefaces/primeng/blob/master/apps/showcase/doc/table/removablesort-doc.ts                                         | 2026-09-17 |
| PrimeNG binds `aria-sort`, `tabindex`, Enter/Space on `pSortableColumn`; flattens multi-sort to asc/desc                                                                                                                | https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts (L3672, L3720, L3739–L3752)                      | 2026-09-17 |
| PrimeNG resets the page on sort by default                                                                                                                                                                              | https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts (L477)                                           | 2026-09-17 |
| PrimeNG multi-sort reads `metaKey \|\| ctrlKey` from the event                                                                                                                                                          | https://github.com/primefaces/primeng/blob/master/packages/primeng/src/table/table.ts (L1546)                                          | 2026-09-17 |
| Three-state sort requested, open since 2023, 9 👍                                                                                                                                                                       | https://github.com/primefaces/primeng/issues/12553                                                                                     | 2026-09-17 |
| Community PR implementing third-click removal, closed unmerged                                                                                                                                                          | https://github.com/primefaces/primeng/issues/8072                                                                                      | 2026-09-17 |
| PrimeNG sorting mutates a frozen array; known since 2017, closed five times                                                                                                                                             | https://github.com/primefaces/primeng/issues/16674                                                                                     | 2026-09-17 |
| First of the immutability chain                                                                                                                                                                                         | https://github.com/primefaces/primeng/issues/2529                                                                                      | 2026-09-17 |
| Immutability chain, same-day close                                                                                                                                                                                      | https://github.com/primefaces/primeng/issues/2630                                                                                      | 2026-09-17 |
| Immutability chain, frozen array errors                                                                                                                                                                                 | https://github.com/primefaces/primeng/issues/8488                                                                                      | 2026-09-17 |
| Immutability chain, 2021 restatement                                                                                                                                                                                    | https://github.com/primefaces/primeng/issues/10729                                                                                     | 2026-09-17 |
| PrimeNG sort stops on null values (2016)                                                                                                                                                                                | https://github.com/primefaces/primeng/issues/681                                                                                       | 2026-09-17 |
| PrimeNG sorts undefined into the middle                                                                                                                                                                                 | https://github.com/primefaces/primeng/issues/7227                                                                                      | 2026-09-17 |
| PrimeNG `aria-sort` first requested                                                                                                                                                                                     | https://github.com/primefaces/primeng/issues/8684                                                                                      | 2026-09-17 |
| PrimeNG multi-sort aria not updated (2022)                                                                                                                                                                              | https://github.com/primefaces/primeng/issues/11051                                                                                     | 2026-09-17 |
| Same bug again, called a regression of #11051                                                                                                                                                                           | https://github.com/primefaces/primeng/issues/17090                                                                                     | 2026-09-17 |
| PrimeNG bound `[aria-sort]` instead of `[attr.aria-sort]`                                                                                                                                                               | https://github.com/primefaces/primeng/issues/18571                                                                                     | 2026-09-17 |
| PrimeNG sorting lost under row grouping; prior fix regressed                                                                                                                                                            | https://github.com/primefaces/primeng/issues/16408                                                                                     | 2026-09-17 |
| Same grouping complaint, seven years earlier                                                                                                                                                                            | https://github.com/primefaces/primeng/issues/3699                                                                                      | 2026-09-17 |
| PrimeNG cell-edit table throws on sort; closed `not_planned`                                                                                                                                                            | https://github.com/primefaces/primeng/issues/14494                                                                                     | 2026-09-17 |
| PrimeNG server-side sorting endless loop                                                                                                                                                                                | https://github.com/primefaces/primeng/issues/16982                                                                                     | 2026-09-17 |
| PrimeNG virtual scroll + lazy load hangs on sort                                                                                                                                                                        | https://github.com/primefaces/primeng/issues/13494                                                                                     | 2026-09-17 |
| PrimeNG sort/filter hit-area collision                                                                                                                                                                                  | https://github.com/primefaces/primeng/issues/13361                                                                                     | 2026-09-17 |
| PrimeNG compareFunction request                                                                                                                                                                                         | https://github.com/primefaces/primeng/issues/4877                                                                                      | 2026-09-17 |
| TanStack derives first-click direction from the first row's value                                                                                                                                                       | https://github.com/TanStack/table/blob/v8.21.3/packages/table-core/src/features/RowSorting.ts (L308–L344, L453–L457)                   | 2026-09-17 |
| TanStack toggle cycle varies with undefined data; 16 reactions                                                                                                                                                          | https://github.com/TanStack/table/issues/4289                                                                                          | 2026-09-17 |
| TanStack manual sort + equal values stalls the toggle                                                                                                                                                                   | https://github.com/TanStack/table/issues/5147                                                                                          | 2026-09-17 |
| "Does the 'auto' sorting strategy work as intended?" — unanswered                                                                                                                                                       | https://github.com/TanStack/table/discussions/6142                                                                                     | 2026-09-17 |
| TanStack three-state request (2018)                                                                                                                                                                                     | https://github.com/TanStack/table/issues/1053                                                                                          | 2026-09-17 |
| The inverse — a user surprised by third-click removal                                                                                                                                                                   | https://github.com/TanStack/table/discussions/2848                                                                                     | 2026-09-17 |
| TanStack `datetime` sort crashes on `.getTime()` of null                                                                                                                                                                | https://github.com/TanStack/table/issues/4041                                                                                          | 2026-09-17 |
| TanStack string sort crashes on null                                                                                                                                                                                    | https://github.com/TanStack/table/issues/3269                                                                                          | 2026-09-17 |
| TanStack date sort fails on null                                                                                                                                                                                        | https://github.com/TanStack/table/issues/3400                                                                                          | 2026-09-17 |
| TanStack default sort mixes zeroes and nulls, contradicting docs                                                                                                                                                        | https://github.com/TanStack/table/issues/948                                                                                           | 2026-09-17 |
| TanStack nulls/undefined sorted to the top                                                                                                                                                                              | https://github.com/TanStack/table/issues/1616                                                                                          | 2026-09-17 |
| `sortUndefined` regression between 8.5.13 and 8.10.7; 13 reactions                                                                                                                                                      | https://github.com/TanStack/table/issues/5191                                                                                          | 2026-09-17 |
| `sortUndefined` did not cover `null` until this fix                                                                                                                                                                     | https://github.com/TanStack/table/issues/6060                                                                                          | 2026-09-17 |
| `sortUndefined` does not produce Excel-like blanks-last; open                                                                                                                                                           | https://github.com/TanStack/table/issues/6061                                                                                          | 2026-09-17 |
| "Force null or empty values to bottom when sorting?" (2020)                                                                                                                                                             | https://github.com/TanStack/table/discussions/2371                                                                                     | 2026-09-17 |
| Same question, 2025, unanswered                                                                                                                                                                                         | https://github.com/TanStack/table/discussions/5930                                                                                     | 2026-09-17 |
| Custom `sortingFn` skipped when the row key is undefined; open                                                                                                                                                          | https://github.com/TanStack/table/issues/5653                                                                                          | 2026-09-17 |
| TanStack multi-sort-without-shift PR closed by the stale bot                                                                                                                                                            | https://github.com/TanStack/table/issues/3301                                                                                          | 2026-09-17 |
| Same ask, 2017                                                                                                                                                                                                          | https://github.com/TanStack/table/issues/392                                                                                           | 2026-09-17 |
| TanStack multi-sort not cleared on unmodified click                                                                                                                                                                     | https://github.com/TanStack/table/issues/6070                                                                                          | 2026-09-17 |
| `aria-sort` requested 2021; maintainer says put it in your own markup                                                                                                                                                   | https://github.com/TanStack/table/issues/2992                                                                                          | 2026-09-17 |
| `getAriaSort` PR closed unmerged; "Not in core… leave this to the component libraries"                                                                                                                                  | https://github.com/TanStack/table/pull/6506                                                                                            | 2026-09-17 |
| `getAriaSort` exists only in `examples/react/*` (6 hits, 0 in packages)                                                                                                                                                 | `gh api "search/code?q=getAriaSort+repo:TanStack/table"`                                                                               | 2026-09-17 |
| Sort re-applies on data update mid-edit; 7 upvotes, unanswered 3 years                                                                                                                                                  | https://github.com/TanStack/table/discussions/5217                                                                                     | 2026-09-17 |
| Table auto-sorts when a row value changes                                                                                                                                                                               | https://github.com/TanStack/table/discussions/5787                                                                                     | 2026-09-17 |
| "Again: keep one row at the top regardless of sorting"                                                                                                                                                                  | https://github.com/TanStack/table/discussions/2837                                                                                     | 2026-09-17 |
| Same ask after the v8 rewrite                                                                                                                                                                                           | https://github.com/TanStack/table/discussions/5039                                                                                     | 2026-09-17 |
| "Constant Secondary Sorted Column"                                                                                                                                                                                      | https://github.com/TanStack/table/discussions/2643                                                                                     | 2026-09-17 |
| Editing a sorted column writes to two cells                                                                                                                                                                             | https://github.com/TanStack/table/issues/1188                                                                                          | 2026-09-17 |
| Same, 2017                                                                                                                                                                                                              | https://github.com/TanStack/table/issues/519                                                                                           | 2026-09-17 |
| Server-side sorting example request — 58 upvotes, unanswered                                                                                                                                                            | https://github.com/TanStack/table/discussions/2033                                                                                     | 2026-09-17 |
| `enableSortingRemoval` does not work with `manualSorting`                                                                                                                                                               | https://github.com/TanStack/table/issues/6048                                                                                          | 2026-09-17 |
| Sorting changes scroll position on data change                                                                                                                                                                          | https://github.com/TanStack/table/issues/3768                                                                                          | 2026-09-17 |
| Sorting grouped rows sometimes fails                                                                                                                                                                                    | https://github.com/TanStack/table/issues/4414                                                                                          | 2026-09-17 |
| Column resize triggers a sort                                                                                                                                                                                           | https://github.com/TanStack/table/issues/2359                                                                                          | 2026-09-17 |
| Extra sort action after resize                                                                                                                                                                                          | https://github.com/TanStack/table/issues/1638                                                                                          | 2026-09-17 |
| Same, as a discussion                                                                                                                                                                                                   | https://github.com/TanStack/table/discussions/2058                                                                                     | 2026-09-17 |
| Manual pagination disables sorting                                                                                                                                                                                      | https://github.com/TanStack/table/issues/1040                                                                                          | 2026-09-17 |
| "How to sort a checkbox column"                                                                                                                                                                                         | https://github.com/TanStack/table/discussions/5584                                                                                     | 2026-09-17 |
| "Sorting on Selected" (2020)                                                                                                                                                                                            | https://github.com/TanStack/table/discussions/2119                                                                                     | 2026-09-17 |
| "Allow row sorting by column AND dnd?"                                                                                                                                                                                  | https://github.com/TanStack/table/discussions/5835                                                                                     | 2026-09-17 |
| "The sort icon should always visible"                                                                                                                                                                                   | https://github.com/TanStack/table/discussions/4723                                                                                     | 2026-09-17 |
| "How to display sort icon all the time?"                                                                                                                                                                                | https://github.com/TanStack/table/discussions/5195                                                                                     | 2026-09-17 |
| Cannot overwrite the default sorting method                                                                                                                                                                             | https://github.com/TanStack/table/issues/2349                                                                                          | 2026-09-17 |
| Custom sorting function thread (13 comments)                                                                                                                                                                            | https://github.com/TanStack/table/issues/1611                                                                                          | 2026-09-17 |
| Case-sensitivity: titlecase vs lowercase                                                                                                                                                                                | https://github.com/TanStack/table/issues/3137                                                                                          | 2026-09-17 |
| Case-insensitive sorting not supported                                                                                                                                                                                  | https://github.com/TanStack/table/issues/2202                                                                                          | 2026-09-17 |
| Alphanumeric sort broken for date-formatted strings                                                                                                                                                                     | https://github.com/TanStack/table/issues/5124                                                                                          | 2026-09-17 |
| Sorting wrong for negative numbers                                                                                                                                                                                      | https://github.com/TanStack/table/issues/3450                                                                                          | 2026-09-17 |
| Sort state persistence ask (8 upvotes) — noted, not pursued                                                                                                                                                             | https://github.com/TanStack/table/discussions/2713                                                                                     | 2026-09-17 |
| TanStack sorting options, defaults, cycle order, `sortDescFirst` caveat                                                                                                                                                 | https://tanstack.com/table/v8/docs/guide/sorting                                                                                       | 2026-09-17 |
| MUI sorting on the checkbox-selection column; 17 👍, open, via paid support                                                                                                                                             | https://github.com/mui/mui-x/issues/14952                                                                                              | 2026-09-17 |
| Row reordering disabled while sorted; 11 👍, open, Pro                                                                                                                                                                  | https://github.com/mui/mui-x/issues/10706                                                                                              | 2026-09-17 |
| Sorting panel in the toolbar (Notion/Airtable model); 8 👍, open since 2021                                                                                                                                             | https://github.com/mui/mui-x/issues/1196                                                                                               | 2026-09-17 |
| Multi-sorting discoverability + no mobile path                                                                                                                                                                          | https://github.com/mui/mui-x/issues/14563                                                                                              | 2026-09-17 |
| PR that shipped no-modifier multi-sort                                                                                                                                                                                  | https://github.com/mui/mui-x/pull/17925                                                                                                | 2026-09-17 |
| "How can user know if they need to hold 'ctrl' key" — closed as duplicate 2026-09-07                                                                                                                                    | https://github.com/mui/mui-x/issues/14169                                                                                              | 2026-09-17 |
| Stable sorting; modifiers "difficult for anybody but heavy users"; considered as a Pro option                                                                                                                           | https://github.com/mui/mui-x/issues/10866                                                                                              | 2026-09-17 |
| JAWS user's verbatim report on sortable headers                                                                                                                                                                         | https://github.com/mui/mui-x/issues/4124                                                                                               | 2026-09-17 |
| All sort buttons share the label "Sort"; open, via paid support                                                                                                                                                         | https://github.com/mui/mui-x/issues/16456                                                                                              | 2026-09-17 |
| Sort icon only appears on hover, not on keyboard focus; open                                                                                                                                                            | https://github.com/mui/mui-x/issues/22188                                                                                              | 2026-09-17 |
| Non-sortable headers still focusable/clickable; open, 15 comments                                                                                                                                                       | https://github.com/mui/mui-x/issues/3886                                                                                               | 2026-09-17 |
| Sort icon contrast below 3:1                                                                                                                                                                                            | https://github.com/mui/mui-x/issues/20189                                                                                              | 2026-09-17 |
| The contrast fix                                                                                                                                                                                                        | https://github.com/mui/mui-x/pull/20430                                                                                                | 2026-09-17 |
| Keyboard activation of sort added (2021)                                                                                                                                                                                | https://github.com/mui/mui-x/issues/1022                                                                                               | 2026-09-17 |
| `aria-sort` always set, per the MDN default of `none`                                                                                                                                                                   | https://github.com/mui/mui-x/issues/4379                                                                                               | 2026-09-17 |
| MUI emits `aria-sort` on the columnheader element                                                                                                                                                                       | https://github.com/mui/mui-x/blob/master/packages/x-data-grid/src/components/columnHeaders/GridGenericColumnHeaderItem.tsx (L100–L103) | 2026-09-17 |
| No sort indicator on unsorted sortable columns; 4 👍, 12 comments                                                                                                                                                       | https://github.com/mui/mui-x/issues/1076                                                                                               | 2026-09-17 |
| Multi-sort priority badge clips on narrow columns                                                                                                                                                                       | https://github.com/mui/mui-x/issues/13406                                                                                              | 2026-09-17 |
| The CSS-nudge fix for it                                                                                                                                                                                                | https://github.com/mui/mui-x/pull/13625                                                                                                | 2026-09-17 |
| Sorting lost when grouping by a previously sorted column; open, via paid support                                                                                                                                        | https://github.com/mui/mui-x/issues/16540                                                                                              | 2026-09-17 |
| Pinning a row to the bottom regardless of sort direction                                                                                                                                                                | https://github.com/mui/mui-x/issues/9275                                                                                               | 2026-09-17 |
| Multi-sort breaks with a custom `sortComparator`                                                                                                                                                                        | https://github.com/mui/mui-x/issues/12853                                                                                              | 2026-09-17 |
| "How does custom sorting comparators work?" — 10 comments                                                                                                                                                               | https://github.com/mui/mui-x/issues/1511                                                                                               | 2026-09-17 |
| `Intl.Collator` customization request                                                                                                                                                                                   | https://github.com/mui/mui-x/issues/5049                                                                                               | 2026-09-17 |
| No loading overlay while sorting; loading state observed by hand                                                                                                                                                        | https://github.com/mui/mui-x/issues/21976                                                                                              | 2026-09-17 |
| Client-to-server model mapper; 23 👍, open                                                                                                                                                                              | https://github.com/mui/mui-x/issues/7583                                                                                               | 2026-09-17 |
| Input row order not respected under `sortingMode="server"`                                                                                                                                                              | https://github.com/mui/mui-x/issues/792                                                                                                | 2026-09-17 |
| MUI default cycle `['asc','desc',null]`; multi-sorting is Pro+; `multipleColumnsSortingMode`; asymmetric `getSortComparator` recipe; no a11y content                                                                    | https://mui.com/x/react-data-grid/sorting/                                                                                             | 2026-09-17 |
| AG Grid nulls-to-bottom asked in 2015; answer "write a comparator"                                                                                                                                                      | https://github.com/ag-grid/ag-grid/issues/351                                                                                          | 2026-09-17 |
| Same, 2022, answered by another user's comparator                                                                                                                                                                       | https://github.com/ag-grid/ag-grid/issues/4878                                                                                         | 2026-09-17 |
| Nulls first/last request → internal AG-4861; "no way besides your own comparator"                                                                                                                                       | https://github.com/ag-grid/ag-grid/issues/7356                                                                                         | 2026-09-17 |
| Multi-sort without a modifier key → internal AG-5421, incl. touch devices                                                                                                                                               | https://github.com/ag-grid/ag-grid/issues/4784                                                                                         | 2026-09-17 |
| Sort on edit moves the row; closed for inactivity                                                                                                                                                                       | https://github.com/ag-grid/ag-grid/issues/7012                                                                                         | 2026-09-17 |
| "Prevent sorting on edit"                                                                                                                                                                                               | https://github.com/ag-grid/ag-grid/issues/7444                                                                                         | 2026-09-17 |
| Transaction row lands at a random position on a sorted table                                                                                                                                                            | https://github.com/ag-grid/ag-grid/issues/4312                                                                                         | 2026-09-17 |
| String sort silently became case-sensitive across a major version                                                                                                                                                       | https://github.com/ag-grid/ag-grid/issues/1795                                                                                         | 2026-09-17 |
| Grid blinks twice on server-side sort (2016)                                                                                                                                                                            | https://github.com/ag-grid/ag-grid/issues/760                                                                                          | 2026-09-17 |
| Server-side refresh leaves a stale sort indicator (2026)                                                                                                                                                                | https://github.com/ag-grid/ag-grid/issues/13420                                                                                        | 2026-09-17 |
| Duplicate keys in `sortModel` when sorting the auto group column; open                                                                                                                                                  | https://github.com/ag-grid/ag-grid/issues/13431                                                                                        | 2026-09-17 |
| Custom comparator + grouping crashes the grid                                                                                                                                                                           | https://github.com/ag-grid/ag-grid/issues/5277                                                                                         | 2026-09-17 |
| Client-side sort applied only to the current page (2015)                                                                                                                                                                | https://github.com/ag-grid/ag-grid/issues/587                                                                                          | 2026-09-17 |
| Initial sort/column/filter state request; 24 reactions — noted, not pursued                                                                                                                                             | https://github.com/ag-grid/ag-grid/issues/1785                                                                                         | 2026-09-17 |
| AG Grid `_setAriaSort` and the `'other'` aria-sort state                                                                                                                                                                | https://github.com/ag-grid/ag-grid/blob/latest/packages/ag-stack/src/utils/aria.ts (L7, L168)                                          | 2026-09-17 |
| AG Grid default cycle asc→desc→none; `sortingOrder`; `multiSortKey`; `alwaysMultiSort`; `suppressMultiSort`; comparator signature with `isDescending`; `accentedSort` slowness warning; `postSortRows`; no a11y content | https://www.ag-grid.com/javascript-data-grid/row-sorting/                                                                              | 2026-09-17 |
| Tracker reliability notes (👍 semantics per tracker, AG Grid close semantics, TanStack bulk sweeps)                                                                                                                     | `~/.claude/discovery-sources.md`, Axis 2                                                                                               | 2026-09-17 |
