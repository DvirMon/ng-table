---
title: Product — Tree User Stories
type: product
capability: tree
status: >
  Written during the #163 grill, before the spec. One story shows a tree today:
  `grouping-collapsible/`, on nested data. §1–§4: 0 ✅, 2 🟡, 14 ❌. The ❌ count is honest,
  not pessimistic: nearly every story depends on the flat-data tree #163 builds, and no host
  composes `withTree()` with `withFiltering()`. Cross-feature: F-T1, F-T2, G-T1, G-T2, G-T3,
  S-T1 ❌; E-1 linked (❌ in `row-editing.md`).
date: 2026-09-27
audience: product, design, engineering
---

# Tree — user stories

What a person reading rows that belong to other rows (a folder and its files, a task and its
subtasks, a manager and their reports) needs to be able to do, and what they should experience
when the data, or their own filter, does not cooperate. Engineering derives API from this
document, not the reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it. Coverage marks here are updated from the product side as capabilities
> land.

> **This doc was written during the grill, not after the spec.**
> [`features/tree.md`](../1-state/features/tree.md) is `spec: drilled`, but it describes a tree
> built from nested children, and #163 replaces that with a tree built from flat rows. The
> decisions this doc builds on are D1–D19 in
> [`tree-flat-data/1-decisions.md`](../1-state/work/tree/active/tree-flat-data/1-decisions.md),
> logged as TR7–TR21 in [`decisions/tree.md`](../decisions/tree.md) (first registered as E20–E34 in
> the expansion log). Where a story below
> needs something those decisions do not give, §8 says so.

## Scope

**A tree means: rows that belong to another row sit under it, and I can open and close that
row.** A person perceives six things, and does not care which layer produces them:

1. Children appear under their parent, indented, at any depth.
2. I can open and close a parent, one at a time or all at once.
3. When I search or filter, a match never loses its place in the hierarchy, and it is never
   hidden from me.
4. Counts and totals mean something I can check against what I see.
5. When the parent data is wrong, rows are misplaced but never missing.
6. Grouping a tree keeps each family together.

The codebase builds this from `withTree({ parentId })`: each row names its parent's id, the
`'tree'` render stage nests rows by that id, and `flattenVisible` decides what an open or closed
parent shows. That mechanism is invisible to the person using the table and is ignored here.

Two modes, genuinely different products:

| Mode | What the person sees |
|---|---|
| **Row tree** (`withTree({ parentId })`) | Real rows nested under real rows. Every row, at any depth, is a row in the table's data. |
| **Collapse-only** (`withTree()`, no `parentId`) | No row tree at all. It exists so `withGrouping()` headers can open and close. Its stories live in [`grouping.md`](grouping.md) §2, not here. |

Filtering has two modes too (client, and server with `manual: true`). A tree filtered on the
server gets whatever rows the server returns; the table cannot add back an ancestor it was never
sent. Stories that differ by filter mode say so.

## Coverage marks

| Mark | Meaning |
|---|---|
| ✅ **covered** | Demonstrable today in `src/stories/` or a demo app, with the failure path included |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not: no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

One story shows a tree, read as a host component rather than an `.mdx` wrapper:

| Story | Composes | What it demonstrates |
|---|---|---|
| [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) | `withGrouping()` + `withTree({ childrenAccessor: row => row.children })` | One parent row (`d4`) with two **nested** children, opened by a row chevron (`table.tree.toggle`), independent of the group chevrons |

What no story shows: a tree built from flat rows (#163 builds it), a tree under a filter (no host
composes `withTree()` with `withFiltering()`), a broken parent link, a lazy parent. The
`grouping-selection/` host composes a filter over the same fixture, but no `'tree'` stage runs
there, so `d4`'s children never render.

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
gap into state, UI, or both, and §9 collects the ones that belong to no existing feature.

Competitor and community behavior is cited from five discovery files in the #163 work folder:
[`discovery-tree-filter-community.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-community.md),
[`discovery-tree-filter-competitors.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-competitors.md),
[`discovery-tree-filter-internal.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-internal.md),
[`discovery-tree-grouping-competitors.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-competitors.md) and
[`discovery-tree-grouping-products.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-products.md)
(all read 2026-09-27). Nothing is restated here beyond what a story needs.

---

# 1. See the hierarchy at all

Ordered by how badly the person is hurt if it is missing.

## 1.1 — See each row under the row it belongs to — 🟡 partly covered *(nested data only)*

> As someone looking at a project plan, I want every subtask sitting under its task, indented by
> how deep it is, so I can read the structure without reconstructing it from an id column.

**Acceptance criteria**

- A row whose parent is in the table appears directly under that parent, one level deeper.
- Depth has no limit: a sub-subtask sits under its subtask.
- A row with no parent sits at the top level.
- Every row in the tree is a real row: I can edit it, select it and count it like any other
  (E-1, S-T1, 3.1).

**Failure behavior**

- A row whose parent link is broken is never hidden: it appears at the top level (4.1).

**Covered by:** [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/)
shows one parent with two children, but from **nested** `children` arrays. Those children are
not rows in the table's data: they are never filtered, never sorted and cannot be edited. The
flat-data version, and any depth beyond one, is on no canvas.

**Design status:** decided — D1 (`parentId`), D3 (nested input removed, no helper). E5 has said
since 2026-09-20 that every node is a row in `data()`; #163 makes the code agree.

## 1.2 — Open and close one parent — 🟡 partly covered

> As someone scanning a long task list, I want to fold away a task I'm done with, so its
> subtasks stop taking space, and open it again later exactly as it was.

**Acceptance criteria**

- A parent shows a toggle; activating it shows or hides that parent's children.
- Closing a parent hides every descendant, at every depth, not only its direct children.
- Reopening a parent restores its descendants' own open or closed state from before.
- The toggle's state is announced (`aria-expanded`).

**Failure behavior**

- A row with no children shows no toggle, so there is nothing to click that does nothing (2.6).
- A row removed from the data stops being remembered as open (ADR-0006).

**Covered by:** `grouping-collapsible/` opens and closes `d4` (one level, nested data). Deeper
levels, and restoring a descendant's state, are on no canvas.

**Design status:** covered — E11 (`toggle`/`expand`/`collapse`/`set`), E18 (one `changed`
emission per write).

## 1.3 — Open or close everything, and know which it is — ❌ not covered

> As someone about to print or export a plan, I want to open every task in one action, and a
> button that tells me whether everything is already open.

**Acceptance criteria**

- One action opens every parent; one action closes every parent.
- A control can show three states: all open, some open, none open.
- With a filter active, "open all" opens the parents I can see, not ones the filter hid (D8).

**Failure behavior**

- With nothing expandable, the state reads "none", never "all": a button must not claim
  everything is open when there is nothing to open.

**Covered by:** nothing. `table.tree.state` ships, but no host renders an expand-all control.

**Design status:** decided — E9 (tri-state), E11, D8 (filtered view by default, `includeHidden`
for all rows).

## 1.4 — Open a parent whose children haven't loaded yet — ❌ not covered

> As someone browsing a large folder tree, I want every folder to show it can be opened even
> though its contents load only when I open it.

**Acceptance criteria**

- A parent can show a toggle before any of its children exist in the table.
- Opening it lets the page fetch the children; they appear under it once loaded.
- Children that arrive later land under the right parent with no extra step.

**Failure behavior**

- If loading fails or returns nothing, the parent stays openable and shows no children. It
  never shows a stale child from somewhere else.
- A per-row loading indicator is not decided (OQ-4).

**Covered by:** nothing. The mechanism is `isExpandable` plus the consumer appending rows to
`data()`; no host demonstrates it.

**Design status:** decided in the issue body — lazy children arrive by appending rows (D19);
`isExpandable` overrides the computed toggle (D9).

---

# 2. Find things in a tree

Filtering itself is `withFiltering()`'s. Two stories here require filtering to change, and are
filed there: F-T1 (keep a match's ancestors) and F-T2 (show a matched parent's whole branch), see
§5. The stories below are what the **tree** must do once filtering keeps the right rows.

## 2.1 — Never have a match hidden under a closed parent — ❌ not covered

> As someone who searched for "Alice", I want to see Alice, not a closed "Engineering" row I have
> to open to find out whether my search worked.

**Acceptance criteria**

- While a filter is active, every parent kept only as context is shown open, so every match is
  on screen.
- This does not change my saved open or closed state: nothing is written, and no expansion event
  fires.
- Clearing the filter returns every parent to exactly the state I left it in (2.4).
- A page that wants something else (reveal only some context rows, or none) can say so, and
  rebuild any other behavior from what the table exposes.

**Failure behavior**

- A match is never reported in a count while being invisible on screen because an ancestor is
  closed, unless the page turned reveal off.

**Covered by:** nothing.

**Design status:** decided — D20 (supersedes D16): reveal is derived, never written to the open
set, so it vanishes when the filter clears. `withTree({ revealContextRow })` picks which context
rows reveal; the default reveals all, `() => false` turns it off. Community: the second-largest
complaint, "It looks like there are no results" (PrimeNG #8192, MUI X #6812 open since 2022). Only
DevExtreme reveals by default, and it does so by writing its open set, which D20 rejects.

## 2.2 — Close a revealed parent while I'm still filtering — ❌ not covered

> As someone scanning search results, I want to fold away a branch I've checked, even though the
> filter opened it for me.

**Acceptance criteria**

- The toggle on a revealed parent closes it, like any other toggle.
- That choice holds for as long as the row stays a context row, including while I keep typing
  in the filter.
- It is forgotten once the row stops being a context row or the filter clears; my own saved
  state is untouched.

**Failure behavior**

- The toggle never does nothing. A toggle that shows "open" and ignores clicks reads as broken.
- Typing one more letter never reopens a branch I just closed, as long as that branch still
  holds a match.

**Covered by:** nothing.

**Design status:** decided — D20(c) (supersedes D17): the closed-while-revealed memory lives
exactly as long as the row is a context row, so there is no reset-timing policy to choose. A page
wanting different timing turns reveal off and rebuilds it from `table.tree.contextRowIds()` plus
`expand`/`set`/`toggle` (D20(e)). Resolves OQ-2.

## 2.3 — Tell a match from a row shown only for context — ❌ not covered

> As someone who searched for "Alice" and sees "Engineering" above her, I want to know that
> Engineering did not match, so I don't think my search is broken.

**Acceptance criteria**

- A context row can look different from a match (dimmed, for example). How it looks is the
  page's choice; the table only says which rows are context.
- With no filter active, no row is a context row.

**Failure behavior**

- A row is never marked as context when it matched on its own.

**Covered by:** nothing.

**Design status:** decided — D18 (`RenderRow.isContextRow`), D20(d) (`table.tree.contextRowIds()`
for a page that needs the set, not a per-row flag), D21 (`data-context-row` is bound by a new tree
feature directive, `ngpTableTreeRow`, not the core row directive). No surveyed library ships
this; Ignite UI's reduced-opacity ancestors are the only precedent found (community T5).

## 2.4 — Get my expand/collapse state back when the filter clears — ❌ not covered

> As someone who carefully opened three branches, searched for something, then cleared the
> search, I want those three branches open again and nothing else.

**Acceptance criteria**

- Filtering never changes which rows I opened.
- A parent the filter hid is still open when it comes back, if it was open before.
- Rows revealed only by the filter (2.1) close again.

**Failure behavior**

- If a row was deleted while filtered, its remembered state goes with it, not onto another row.

**Covered by:** nothing on canvas. It holds by construction today: a filter never writes
`data()`, so no open id is dropped (internal-coverage D1). grouping.md's F-G1 records the same
criterion as undemonstrated for groups.

**Design status:** covered — D20(a) (reveal is derived and vanishes with the filter), plus E4
(restored ids kept).

## 2.5 — See a matched parent's whole branch, when I ask for it — ❌ not covered

> As someone who searched for a category, I want everything in that category, not only the items
> whose own names also match.

This is F-T2, owned by filtering (§5). The tree's part: descendants kept by the filter nest and
reveal the same way as any other kept row (2.1). Nothing further.

## 2.6 — See a toggle only when opening it will show something — ❌ not covered

> As someone filtering, I don't want a toggle on a row whose children were all filtered out: I'd
> open it and get nothing.

**Acceptance criteria**

- By default, a row shows a toggle only when it has children in the current, filtered view.
- A page that loads children lazily can still show a toggle on any row it chooses (1.4).

**Failure behavior**

- When lazy loading and a filter combine, the page's own rule wins: its toggles never vanish
  because a filter ran. That is the bug vendors ship (Telerik Blazor 1696203, TanStack #4261).

**Covered by:** nothing.

**Design status:** decided — D9.

---

# 3. Counts and order

## 3.1 — Count every row, open or closed — ❌ not covered

> As someone reading "42 of 120 rows", I want that number to include subtasks, because they are
> rows too.

**Acceptance criteria**

- The row count and "select all" include children, whether their parent is open or closed.
- Only rows the filter removed are left out.
- The number screen readers hear (`aria-rowcount`) is the same number.

**Failure behavior**

- The count never changes when I open or close a parent. Kendo #5491's pager, which went from "1 -
  4 of 4" to "1 - 15 of 4" after a collapse, is the failure to avoid.

**Covered by:** nothing. Today children are not rows, so they are missing from every count.

**Design status:** decided — D11. How pagination counts is open (OQ-3).

## 3.2 — Sort siblings, keep families together — ❌ not covered

> As someone sorting tasks by due date, I want subtasks sorted among their siblings, still under
> their own task.

**Acceptance criteria**

- Sorting orders the top-level rows among themselves, and each parent's children among
  themselves.
- No child is ever sorted out from under its parent.
- My open or closed state survives a sort.

**Failure behavior**

- A broken sort callback degrades the whole sort per ADR-0014; the tree shape stays intact.

**Covered by:** nothing. Today children are never sorted (they bypass the pipeline).

**Design status:** decided in the issue body — siblings keep input order, so the pipeline's sort
carries over (D19). PrimeNG #12935 (sort resets expansion) is the only community complaint found.

---

# 4. When the data does not cooperate

## 4.1 — A row whose parent doesn't exist — ❌ not covered

> As someone looking at an org chart where one record points at a manager who left, I want that
> person still on the chart, even if in the wrong place.

**Acceptance criteria**

- A row whose parent id matches no row appears at the top level, with its own children still
  under it.
- The same holds when the parent lookup itself fails on a row.
- The problem is reported once per evaluation, in production too.

**Failure behavior**

- The row is never hidden. A misplaced row gets noticed; a missing one usually doesn't.

**Covered by:** nothing.

**Design status:** decided — D4. Syncfusion forum #185154 is the one community data point: the
user promoted orphans to root by hand.

## 4.2 — Rows that point at themselves, or at each other — ❌ not covered

> As someone whose data has a task accidentally made its own subtask's child, I want the table
> to keep working and show me both tasks.

**Acceptance criteria**

- A row that names itself as parent appears at the top level.
- Rows that form a loop: the first of them, in data order, appears at the top level, and the
  rest nest under it.
- Reported once per evaluation.

**Failure behavior**

- The table never hangs, and no row in the loop disappears.

**Covered by:** nothing.

**Design status:** decided — D4. Closes `features/tree.md`'s "cycle guarding" open question; the
spec should drop it.

## 4.3 — Delete a parent — ❌ not covered

> As someone deleting a project, I want to choose whether its tasks go with it; if they stay, I
> want them visible, not gone.

**Acceptance criteria**

- Deleting a parent and leaving its children: the children appear at the top level (4.1).
- Deleting a parent and its whole branch is one action the page can offer.

**Failure behavior**

- Deleting a row never silently deletes other rows. A cascade happens only when the page asks
  for it.

**Covered by:** nothing.

**Design status:** decided — D12 (`table.tree.descendantsOf(id)` read; the page composes
`removeRows([id, ...descendantsOf(id)])`).

## 4.4 — Filter children that haven't loaded yet — ❌ not covered *(a limit, stated)*

> As someone searching a lazily loaded folder tree, I want to know my search can only see what
> has been loaded.

**Acceptance criteria**

- A filter matches loaded rows only. Unloaded children cannot match, because they don't exist
  yet.
- The page can say so. Nothing in the table claims the search covered everything.

**Failure behavior**

- A lazy parent whose loaded children don't match keeps its toggle if the page says it is
  expandable (2.6). A filter never removes the only way to load more.

**Covered by:** nothing.

**Design status:** not decided as a story; follows from D9 and D19. VS Code #66971 (171 👍) is
this complaint from end users. OQ-5 covers server filtering.

---

# 5. Cross-feature interactions

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to the tree. That is this repo's existing convention (`row-editing.md`,
`grouping.md` §5, `filtering.md` §5). Each owning doc carries the full story; the lines below
are pointers, and those files own the coverage marks.

## Owned by filtering *([`filtering.md`](filtering.md) §5, "Owned by tree")*

- **F-T1 — A matching child keeps its path — ❌.** Filtering keeps each match plus all its
  ancestors, shown as context rows. Filtering never orphans a row. D5, D6, ADR-0028. All six
  surveyed libraries do this; it's the default in four.
- **F-T2 — Show a matched parent's whole branch — ❌.** An opt-in flag, `includeDescendants`, on
  `withFiltering()` also keeps every descendant of a match. D5. The request that keeps coming
  back (seven trackers, 2013–2025); on by default in AG Grid and PrimeNG, not available in MUI or
  Kendo.

## Owned by grouping *([`grouping.md`](grouping.md) §5, "Owned by tree")*

- **G-T1 — Grouping never splits a family — ❌.** With a tree, only top-level rows are grouped;
  each branch follows its root, whatever its own value. D13. Grouping each row by its own value
  is available by leaving `parentId` out. No library splits a child from its parent; products
  offer per-row grouping only as an opt-in flat mode.
- **G-T2 — A group's count includes every row in it — ❌.** Descendants count, so group
  select-all selects the number shown. D14. Wrike, the only product that documents it, counts
  top-level only.
- **G-T3 — A group total that matches my data model — ❌.** `aggregateFn` receives every row in
  the group, descendants too; the page decides whether a parent's value is its own or a roll-up.
  D15. The shipped fixture's `d4` (42000 = 25000 + 17000) is a roll-up and must change.

## Owned by selection *([`selection.md`](selection.md) §6, "Owned by tree")*

- **S-T1 — "Select all" includes children — ❌.** It follows 3.1: every row counts, open or
  closed, filtered-out rows excluded. D11. Whether selecting a parent selects its children is
  OQ-1, not part of #163.

## Owned by row editing *(already exists)*

**E-1 already exists** at [`row-editing.md`](row-editing.md) (editing a child row, ❌). It is
**linked, not restated**. #163's "child rows carry `sourceIndex`" criterion is what closes it.

## Owned by pagination *(unbuilt)*

- **P-T1 — A page never cuts a family in half, or says so — ❌.** Community T8 shows both
  expectations (count only top-level rows, AG Grid #1910; count everything, TanStack #5137).
  OQ-3.

---

# 6. What a context row *is*

A **context row** is a row shown only because one of its descendants matched the filter
(glossary: [`CONTEXT.md`](../../CONTEXT.md)). It did not match itself. It exists to give the
match its place in the tree.

What a person should be able to rely on:

- It appears only while a filter is active.
- It is a real row: it can be selected, edited and counted like any other. It is counted
  because it is on screen; 3.1's count is what the person sees.
- It is shown open while the filter is active (2.1), and can be closed (2.2).
- It can look different from a match (2.3).

What it is not: an invented header. Group headers are invented by `withGrouping()`; a context row
is always one of the page's own rows.

---

# 7. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-1 — Does selecting a parent select its children? — open, out of #163.**
*Recommendation:* no cascade in state, matching selection's D13 (the consumer owns it via
`rowsOf()`). The recipe becomes `select([id, ...table.tree.descendantsOf(id)])`, so no new API.
Community wants both (PrimeNG #18936: propagate over the full tree; AG Grid #1627: only visible
rows), which argues for leaving it to the page.
*To decide:* whether a recipe story is enough, or a tri-state parent checkbox needs a state
signal.
*Sequencing:* after #163; owned by `selection.md`.

**OQ-2 — Which filter changes forget a parent I closed during the filter? — resolved (D20).**
*Resolved:* none by timing. The memory lives exactly as long as the row is a context row; it
drops when the row stops being context or the filter clears (D20(c)). A page wanting other timing
turns reveal off (`revealContextRow: () => false`) and rebuilds it from
`table.tree.contextRowIds()` plus `expand`/`set`/`toggle` (D20(e)). D17's reset-on-change is
superseded.

**OQ-6 — Which directive binds `data-context-row`? — resolved (D21).**
*Resolved:* a new tree feature directive, `ngpTableTreeRow`, not the core `ngpTableRow`, per
`libs/table/CLAUDE.md` "RenderRow field ownership by directive layer": `isContextRow` is optional
and feature-contributed. In #163 it binds only `data-context-row`.
*Still open:* the wider tree UI (`aria-level`, indentation, the row toggle) goes to
[#165](https://github.com/DvirMon/ng-table/issues/165) — §8.2, §9.

**OQ-3 — How does a page count a tree? — open, pagination unbuilt.**
*Recommendation:* count every row (D11), and never start a page with a child whose parent is on
the previous page without showing that parent again. Decide when pagination is built.
*To decide:* whether pages split families at all.
*Sequencing:* pagination's spec.

**OQ-4 — Does a lazily loading parent show that it is loading? — open.**
*Recommendation:* the table exposes nothing new; the page knows it is fetching and renders its
own indicator. Carried over from `features/tree.md`.
*To decide:* whether a recipe story is enough.
*Sequencing:* not blocking.

**OQ-5 — What does a tree do under server filtering? — open.**
*Recommendation:* with `manual: true` the local filter stage is skipped, so the table cannot add
ancestors or know which rows are context. The server returns matches plus their ancestors; the
page marks context rows if it wants to. Document it; add nothing.
*To decide:* whether a server can report which rows matched, and whether `isContextRow` should
accept it.
*Sequencing:* after #163.

---

# 8. Gap analysis, split by owning layer

**The stories above are deliberately layer-free.** The gaps are work someone has to do, so each
is tagged **state**, **UI**, or **both**.

## 8.1 State-layer gaps

Owned by [`features/tree.md`](../1-state/features/tree.md) unless named.

| # | Gap | Story | Note |
|---|---|---|---|
| S1 | The tree is built from nested children, not flat rows | 1.1, 3.1, 3.2, E-1 | #163: `parentId`, D1. `tree.md` still describes `childrenAccessor` and wrongly claims G6 is closed |
| S2 | No parent-link engine slot; filter and group cannot see the hierarchy | F-T1, G-T1 | ADR-0028. Owners: `features/filtering.md`, `features/grouping.md` |
| S3 | No ancestor retention or `includeDescendants` in the filter stage | F-T1, F-T2 | `features/filtering.md`. D5, D6 |
| S4 | Grouping clusters children by their own values | G-T1 | `features/grouping.md`. D13 |
| S5 | No derived reveal, no `revealContextRow`, no closed-while-context memory | 2.1, 2.2 | D20 (supersedes D16, D17) |
| S6 | No `isContextRow` on `RenderRow`; no `contextRowIds()`/`parentOf()` reads on `table.tree` | 2.3 | D18, D20(d) |
| S7 | Default toggle ignores the filter | 2.6 | D9 |
| S8 | Broken parent links: no degrade, no report | 4.1, 4.2 | D4, ADR-0014 |
| S9 | No `descendantsOf(id)` | 4.3, OQ-1 | D12 |
| S10 | `expand()`/`state` scan without an `includeHidden` option | 1.3 | D8 |

## 8.2 UI-layer gaps

No UI directive doc covers the tree: `docs/status.md` shows `tree` with no UI spec. #163 adds
only the minimal `ngpTableTreeRow` directive (D21). The wider tree UI spec is owned by
[#165](https://github.com/DvirMon/ng-table/issues/165).

| # | Gap | Story | Note |
|---|---|---|---|
| U1 | No expand-all / collapse-all control on any canvas | 1.3 | State ships (`tree.state`); nothing renders it |
| U2 | No story for a flat-data tree, a filtered tree, or a broken link | all of §1–§4 | Fixtures (`DealRow.children`, MSW handler, HTTP reviver) are nested and must flatten |
| U3 | No tree UI spec: indentation, `aria-level`, the row toggle | 1.1, 1.2 | [#165](https://github.com/DvirMon/ng-table/issues/165) (D21). `3-ui/directives/expansion.md` plans parts of it, UI code `none` |
| U4 | Revealing rows under a filter is not announced to screen readers | 2.1 | Same accepted cost as filtering's U4 |
| U5 | No `ngpTableTreeRow` directive binding `data-context-row` | 2.3 | #163, D21 |

## 8.3 Gaps needing both layers

| Gap | State owes | UI owes |
|---|---|---|
| Context-row marking (2.3) | `isContextRow` on `RenderRow`, `contextRowIds()` (S6) | `data-context-row` on `ngpTableTreeRow` (U5, D21) |
| Lazy parent (1.4, 4.4) | nothing new: `isExpandable` + appended rows | a recipe story showing the toggle, the fetch and the loaded children |

## 8.4 Confirmed right — do not re-litigate

- **Every tree node is a row in `data()`** (E5) — it is what lets filter, sort, edit, select and
  count treat children like any row, with no tree-specific wiring in any of them.
- **Keep ancestors by default** (D5) — the one behavior nobody argues with, in any tracker or
  library read.
- **Reveal without writing** (D20) — the only way to show hidden matches and still give the
  person their own state back.
- **Every library-only fact readable, every policy switchable** (D20(e)) — a page that disagrees
  with a default turns it off and rebuilds from the reads, rather than asking for a new option.
- **Broken data is misplaced, never hidden** (D4) — the ADR-0014 direction: visible beats silent.
- **Families stay together under grouping** (D13) — the one point where libraries and products
  agree.

---

# 9. Capabilities with no owner

Checked against `docs/status.md` (the generated registry), not against memory.

- ~~**`tree` has no decisions-log link.**~~ Resolved 2026-09-27: tree has its own log,
  [`decisions/tree.md`](../decisions/tree.md), split out of the expansion log.
- **Tree UI has no spec.** Indentation, `aria-level` and the row toggle have no directive doc;
  `3-ui/directives/expansion.md` plans parts of it. #163 adds only `ngpTableTreeRow` for
  `data-context-row` (D21); the rest is owned by [#165](https://github.com/DvirMon/ng-table/issues/165). **UI**.

# 10. Not user-facing

Real problems, but the integrating developer's, not the person using the table.

- **`parentId` as a function vs. a key name** (D1) — configuration shape.
- **No `flattenTree` helper** (D3) — a consumer with nested data flattens it once; invisible on
  screen.
- **The parent link as an engine slot vs. a second accessor on `withFiltering()`** (D6,
  ADR-0028) — its consequence (counts match what renders) is product-visible and is credited in
  3.1; the slot itself is not.
- **`descendantsOf` as a read, not a cascading delete** (D12) — its product consequence is 4.3.
- **Duplicate row ids** — #156's runtime checks; a person sees at most a symptom.
