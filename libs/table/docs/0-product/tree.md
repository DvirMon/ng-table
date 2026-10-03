---
title: Product — Tree User Stories
type: product
capability: tree
status: >
  Refreshed 2026-10-01 after #166–#169 (flat-data tree, filter retention, reveal) and #182–#184
  (row depth, tree directive pair, styling recipe). Code backs every story in §1–§4. The Tree
  story entry (#189: `Basic`, `Filtered`, `RowClick`) landed 2026-10-01. Canvas marks §1–§4:
  4 ✅, 9 🟡, 6 ❌ (19 stories; 4.1 and 4.2 are not a story concern, ruled 2026-10-01).
  Cross-feature: G-T1, G-T2 🟡 on canvas (owner doc still says ❌); F-T1 🟡; F-T2, G-T3,
  S-T1, P-T1 ❌; E-T1 and E-G1's panel half go to #190; E-1 tree-owned, ❌ on canvas (OQ-7 resolved).
date: 2026-10-01
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

> **Where the design lives.** Every decision below is a row in
> [`decisions/tree.md`](../decisions/tree.md) (TR1–TR46). What the table does today:
> [`1-state/features/tree.md`](../1-state/features/tree.md) (flat rows by `parentId`) and the
> tree UI spec [`3-ui/directives/tree.md`](../3-ui/directives/tree.md) (`ngpTableTreeRow`,
> `ngpTableTreeToggle`, `--ngp-table-row-depth`, the styling recipe). The UI layer's rationale is
> in [`tree-ui-layer/2-spec.md`](../3-ui/work/tree/active/tree-ui-layer/2-spec.md). Where a story
> needs something those do not give, §8 says so.

## Scope

**A tree means: rows that belong to another row sit under it, and I can open and close that
row.** A person perceives six things, and does not care which layer produces them:

1. Children appear under their parent, indented, at any depth.
2. I can open and close a parent, one at a time or all at once, by mouse or keyboard.
3. When I search or filter, a match never loses its place in the hierarchy, and it is never
   hidden from me.
4. Counts and totals mean something I can check against what I see.
5. When the parent data is wrong, rows are misplaced but never missing.
6. Grouping a tree keeps each family together.

The codebase builds this from `withTree({ parentId })` plus two directives. That mechanism is
invisible to the person using the table and is ignored here.

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
| 🟡 **partly covered** | Something is on screen, but the happy path only, or a different control than the one this story needs |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

**Marks are canvas marks.** Shipped code with no story is still ❌. Each story carries a separate
**Code** line, so shipped work is credited without inflating the mark.

Four stories show a tree, read as host components rather than `.mdx` wrappers:

| Story | Composes | What it demonstrates |
|---|---|---|
| [`tree-basic/`](../../src/stories/tree/tree-basic/) | `withTree({ parentId, initial })` | Flat project-plan rows, depth 0 to 3, open and close through the shipped toggle, Expand all / Collapse all and a tri-state readout |
| [`tree-filtering/`](../../src/stories/tree/tree-filtering/) | `withFiltering()` + `withTree({ parentId })` | A name filter with default reveal, dimmed context rows, an inert toggle on a matching parent with no matching children, a stable row count |
| [`tree-row-click/`](../../src/stories/tree/tree-row-click/) | `withTree({ parentId })` | Clicking a parent row toggles it; the row handler skips clicks from the toggle |
| [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) | `withGrouping()` + `withTree({ parentId: row => row.parentId })` | Group headers open and close through `ngpTableTreeRow` + `ngpTableTreeToggle`. One data row (`d4`) has two flat children (`d4-a`, `d4-b`), one level deep, opened by a **hand-written** chevron. Indentation uses one `[data-depth]` rule per depth, not `--ngp-table-row-depth` |

What no story shows: a lazy parent, sibling sorting in a tree, deleting a parent, a filtered
branch's descendants, and group headers and child rows sharing one chevron (U6, #202).

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
gap into state, UI, or both, and §9 collects the ones that belong to no existing feature.

Competitor and community behavior is cited from discovery files, not restated:

- State behavior (filter, grouping), read 2026-09-27, in the #163 work folder:
  [`discovery-tree-filter-community.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-community.md),
  [`discovery-tree-filter-competitors.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-competitors.md),
  [`discovery-tree-filter-internal.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-internal.md),
  [`discovery-tree-grouping-competitors.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-competitors.md),
  [`discovery-tree-grouping-products.md`](../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-products.md).
- UI affordances (toggle, indentation, keyboard, screen reader, orphans), read 2026-10-01, in the
  #165 work folder:
  [`discovery-tree-ui-competitors.md`](../3-ui/work/tree/active/tree-ui-layer/discovery-tree-ui-competitors.md),
  [`discovery-tree-ui-products.md`](../3-ui/work/tree/active/tree-ui-layer/discovery-tree-ui-products.md),
  [`discovery-tree-internal-coverage.md`](../3-ui/work/tree/active/tree-ui-layer/discovery-tree-internal-coverage.md)
  (the source of every Code line below).

---

# 1. See the hierarchy at all

Ordered by how badly the person is hurt if it is missing.

## 1.1 — See each row under the row it belongs to — 🟡 partly covered

> As someone looking at a project plan, I want every subtask sitting under its task, indented by
> how deep it is, so I can read the structure without reconstructing it from an id column.

**Acceptance criteria**

- A row whose parent is in the table appears directly under that parent, one level deeper.
- Depth has no limit: a sub-subtask sits under its subtask, one indentation step further in.
- A row with no parent sits at the top level.
- Every row in the tree is a real row: I can edit it, select it and count it like any other
  (E-1, S-T1, 3.1).

**Failure behavior**

- A row whose parent link is broken is never hidden: it appears at the top level (4.1).

**Covered by:** `tree-basic/` (`Basic`): a flat fixture linked by `parentId`, three roots, depth
0 to 3, each row indented from `--ngp-table-row-depth`. The broken-link failure line is not a
story concern (4.1). `grouping-collapsible/` still shows `d4` one level deep under groups.

**Code:** shipped — `with-tree/nest.ts:99-146`, depth from `engine/flatten.ts:27-44`, indentation
from `--ngp-table-row-depth` (`ngp-table-row.directive.ts:28`).

**Design status:** decided — TR7 (`parentId`), TR8 (no nested input), TR41 (depth as a CSS
custom property). Product expectation matches: indentation in one column, the name column
(Smartsheet, Notion; products discovery §2).

## 1.2 — Open and close one parent — 🟡 partly covered

> As someone scanning a long task list, I want to fold away a task I'm done with, so its
> subtasks stop taking space, and open it again later exactly as it was.

**Acceptance criteria**

- A parent shows a toggle beside its name; activating it shows or hides that parent's children.
- Closing a parent hides every descendant, at every depth, not only its direct children.
- Reopening a parent restores its descendants' own open or closed state from before.
- The toggle shows whether the row is open (a chevron that turns, for example).

**Failure behavior**

- A row with no children shows no usable toggle, so there is nothing to click that does nothing
  (1.5, 2.6).
- A row removed from the data stops being remembered as open (ADR-0006).

**Covered by:** `tree-basic/` (`Basic`): every parent opens and closes through the shipped
`ngpTableTreeToggle`, at every depth; reopening a parent restores its open descendants; the
chevron turns from `data-expanded`. `grouping-collapsible/` still uses a hand-written chevron on
`d4` (U6, #202).

**Code:** shipped — `toggle` at `with-tree/feature.ts:146-158`; descendants hide in
`flatten.ts:42-44`; `ngpTableTreeToggle` (`ngp-table-tree-toggle.directive.ts`).

**Design status:** decided — TR33 (the directive pair), TR34, TR45.

## 1.3 — Open or close everything, and know which it is — 🟡 partly covered

> As someone about to print or export a plan, I want to open every task in one action, and a
> button that tells me whether everything is already open.

**Acceptance criteria**

- One action opens every parent; one action closes every parent.
- A control can show three states: all open, some open, none open.
- With a filter active, "open all" opens the parents I can see, not ones the filter hid.

**Failure behavior**

- With nothing expandable, the state reads "none", never "all": a button must not claim
  everything is open when there is nothing to open.

**Covered by:** `tree-basic/` (`Basic`): Expand all / Collapse all over the rows on the page, and a
readout of all open, some open and none open. Not shown: "open all" under an active filter (the
filtered story has no bulk controls), and the empty-tree "none" case.

**Code:** shipped — `expand()`/`state()` at `with-tree/feature.ts:169-174`, `207-229`; `'none'`
when nothing is expandable (`feature.ts:212-214`).

**Design status:** decided — TR3, TR12 (filtered view by default, `includeHidden` for all rows),
TR30. Every product read ships a bulk control (monday, ClickUp, Smartsheet; Asana after a
five-year request; products discovery §1).

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

**Covered by:** nothing.

**Code:** shipped — `isExpandable` overrides `hasChildren` (`nest.ts:132-134`) and drives
`data-expandable`; appended rows nest on the next evaluation.

**Design status:** decided — TR13, TR35.

## 1.5 — Labels line up whether a row has children or not — 🟡 partly covered

> As someone reading a list where some tasks have subtasks and some don't, I want every task
> name at the same depth to start in the same place, so the column reads as one list.

**Acceptance criteria**

- A row with no children shows no toggle, but its name starts where a sibling parent's name
  starts.
- This holds at every depth.

**Failure behavior**

- If the page's styles fail to load, the leaf's toggle still cannot be clicked, focused or
  heard. A person may see an inert chevron; they never meet a button that does nothing.

**Covered by:** `tree-basic/` (`Basic`): leaves beside parents at every depth render a disabled
toggle that the recipe hides with its width kept. The styles-failed failure line is not
demonstrable on a canvas, since the recipe always loads.

**Code:** shipped — a leaf toggle is `disabled`, `aria-hidden` and `data-disabled`, and keeps its
width (`ngp-table-tree-toggle.directive.ts`); the recipe hides it with `visibility: hidden`.

**Design status:** decided — TR38. Peers split four ways (a spacer, an empty wrapper, a hidden
toggle, a visible disabled button); TR38 matches PrimeNG's hidden toggle (competitors
discovery §7). No product documents leaf alignment.

## 1.6 — Groups and child rows open and indent the same way — ❌ not covered

> As someone using a grouped task list where tasks also have subtasks, I want one kind of
> chevron and one indentation step for both, so I don't have to learn two controls in one table.

**Acceptance criteria**

- A group header and a parent row open and close with the same control, which looks and is
  announced the same way.
- Groups and child rows indent by the same step for each level, wherever they appear.

**Failure behavior**

- A tree row nested under groups is indented by its full depth, never reset to the group's
  first level.

**Covered by:** nothing — the one canvas breaks it. `grouping-collapsible/` uses the shared
toggle on group headers but a hand-written chevron on `d4`, and indents with per-depth rules.
The fix is [#202](https://github.com/DvirMon/ng-table/issues/202) (U6), not the Tree entry.

**Code:** shipped — group headers carry `hasChildren`/`isExpanded`, so the pair works on them
unchanged; groups and rows both get `--ngp-table-row-depth`.

**Design status:** decided — TR43, G79, G80.

## 1.7 — Open and close from the keyboard, and hear what happened — 🟡 partly covered

> As someone who uses a keyboard or a screen reader, I want to reach every parent's toggle,
> open it, and hear whether it is now open, without wading through toggles that do nothing.

**Acceptance criteria**

- Tab reaches the toggle on every parent; Enter and Space both open and close it.
- Tab never stops on a leaf row's toggle.
- A screen reader hears the page's own name for the toggle ("Children of Engineering") and its
  state ("expanded" / "collapsed"). The table adds no words of its own.
- The table is announced as an ordinary table. Rows say nothing about level or open state; only
  the toggle does.

**Failure behavior**

- A leaf's toggle is never announced as a "collapsed button".

**What cannot be met:** a screen-reader user does not hear a row's depth ("level 2") or its
position among siblings. Grids that announce depth do so as a treegrid (MUI X, CDK), which TR34
deferred to its own piece of work. Arrow-key navigation between rows belongs there too (OQ-8).

**Covered by:** `tree-basic/` (`Basic`): native buttons named `'Children of ' + name`, Enter and
Space toggle a parent, leaf toggles are skipped by Tab. Depth announcement is unmet by design
(see "What cannot be met").

**Code:** shipped — `ngp-table-tree-toggle.directive.ts` (leaf `disabled`/`aria-hidden`) over
`ngp-table-collapsible-trigger.directive.ts` (`type`, `aria-expanded`, `data-expanded`); no row
`aria-expanded` (`ngp-table-row.directive.ts:22-29`).

**Design status:** decided — TR34, TR36, TR38, TR39, TR45, TR46. **Where peers differ:** every
grid vendor with roving focus keeps the toggle out of Tab and puts `aria-expanded` on the row or
cell under `treegrid`; none ships a disclosure button under `role="table"` (competitors
discovery §1, §2). The everyday products give no keyboard bar to meet: none documents a key that
opens one row, and monday rejected a grid role for headings and lists (products discovery §4).

## 1.8 — Click anywhere on a row to open it, when the page offers it — ✅ covered

> As someone working with a mouse, I want to open a parent by clicking its row, not only the
> small chevron.

**Acceptance criteria**

- A page may make the whole row open and close its children; this is the page's choice, off by
  default.
- Clicking the chevron itself still works exactly once.
- Other row behavior (selecting the row, for example) still receives the click.

**Failure behavior**

- One click never opens and then immediately closes the row. That is what a person sees if the
  page's row handler also reacts to the chevron's click, and it looks like the control is
  broken. The tree UI spec's whole-row example shows how to avoid it.

**Covered by:** `tree-row-click/` (`RowClick`): clicking a parent row toggles it, the chevron
toggles exactly once because the row handler skips clicks from inside the toggle, a leaf row does
nothing.

**Code:** shipped as a documented pattern — tree UI spec "Whole-row click"; the toggle neither
prevents default nor stops propagation.

**Design status:** decided — TR36, TR44. **Where peers differ:** MUI X and the CDK stop the
toggle's click from bubbling, so the double toggle cannot happen there (competitors discovery
§5). TR44 leaves the click to reach the row, so other listeners keep working, and the page owns
the guard.

## 1.9 — The chevron does not animate when I've asked for less motion — 🟡 partly covered

> As someone with motion sensitivity, I want the chevron to change state without spinning.

**Acceptance criteria**

- Opening and closing turns the chevron with a short animation by default.
- With the system's reduced-motion setting on, the chevron changes state with no animation.

**Failure behavior**

- The open/closed state is still visible without the animation.

**Covered by:** every tree story loads `tree-story.css`, whose chevron turns with a short
transition and has a `prefers-reduced-motion` branch. It is an OS setting with no in-story
control, so the reduced-motion half cannot be toggled on the canvas.

**Code:** recipe only — tree UI spec "Styling recipe" (reduced-motion branch). No stylesheet
ships.

**Design status:** decided — TR42.

---

# 2. Find things in a tree

Filtering itself is `withFiltering()`'s. Two stories here require filtering to change, and are
filed there: F-T1 (keep a match's ancestors) and F-T2 (show a matched parent's whole branch), see
§5. The stories below are what the **tree** must do once filtering keeps the right rows.

## 2.1 — Never have a match hidden under a closed parent — ✅ covered

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

**Covered by:** `tree-filtering/` (`Filtered`): typing "review" shows every match under its
opened ancestors, including a depth-3 leaf under two non-matching ancestors. The reveal-off
opt-out is not shown (default reveal only).

**Code:** shipped (#169) — `with-tree/reveal.ts:9-37`, folded into the open rows at
`feature.ts:259-267`.

**Design status:** decided — TR22, TR32. Community: the second-largest complaint, "It looks like
there are no results" (PrimeNG #8192, MUI X #6812). Products split: monday shows the ancestor
chain on all plans, Smartsheet only as a paid opt-in, Jira flattens (73 + 42 votes asking
otherwise; products discovery §5).

## 2.2 — Close a revealed parent while I'm still filtering — ✅ covered

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

**Covered by:** `tree-filtering/` (`Filtered`): close a revealed parent and it stays closed
while more is typed.

**Code:** shipped — `feature.ts:146-156`, `reveal.ts:41-49`.

**Design status:** decided — TR22(c), TR32.

## 2.3 — Tell a match from a row shown only for context — 🟡 partly covered

> As someone who searched for "Alice" and sees "Engineering" above her, I want to know that
> Engineering did not match, so I don't think my search is broken.

**Acceptance criteria**

- A context row looks different from a match (dimmed, for example). How it looks is the page's
  choice; the table only says which rows are context.
- With no filter active, no row is a context row.

**Failure behavior**

- A row is never marked as context when it matched on its own.
- If the page adds no style for context rows, they look like matches; nothing is hidden.

**Covered by:** `tree-filtering/` (`Filtered`): ancestors kept only for a match carry
`data-context-row` and are dimmed by the recipe; matches are not. The "page adds no style" failure
line is not shown.

**Code:** shipped — `isContextRow` stamped at `engine/core.ts:131`; `data-context-row` on
`ngpTableTreeRow` (`ngp-table-tree-row.directive.ts:16`); the dim rule is in the tree UI spec's
styling recipe.

**Design status:** decided — TR21, TR23, TR24, TR42. No surveyed library or product documents a
context-row style; Ignite UI's reduced opacity and an undated secondary source on Notion's gray
parents are the only precedents (competitors §9, products §5).

## 2.4 — Get my expand/collapse state back when the filter clears — 🟡 partly covered

> As someone who carefully opened three branches, searched for something, then cleared the
> search, I want those three branches open again and nothing else.

**Acceptance criteria**

- Filtering never changes which rows I opened.
- A parent the filter hid is still open when it comes back, if it was open before.
- Rows revealed only by the filter (2.1) close again.

**Failure behavior**

- If a row was deleted while filtered, its remembered state goes with it, not onto another row.

**Covered by:** `tree-filtering/` (`Filtered`): open a branch, filter, clear, and that branch is
open again while rows revealed only by the filter close. The deleted-while-filtered failure line
is not shown. grouping.md's F-G1 still records the same criterion as undemonstrated for groups.

**Code:** shipped — reveal never writes the open set (`feature.ts:259-267`); the closed set drops
ids that stop being context (`reveal.ts:44-48`).

**Design status:** decided — TR22(a). Lost expand state is a live complaint elsewhere (Jira
JRACLOUD-99126, Asana forum 384263; products discovery §1).

## 2.5 — See a matched parent's whole branch, when I ask for it — ❌ not covered

> As someone who searched for a category, I want everything in that category, not only the items
> whose own names also match.

This is F-T2, owned by filtering (§5). The tree's part: descendants kept by the filter nest and
reveal the same way as any other kept row (2.1). Nothing further.

**Code:** shipped — `includeDescendants` (`with-filtering/tree-retention.ts:41-54`).

## 2.6 — See a toggle only when opening it will show something — 🟡 partly covered

> As someone filtering, I don't want a toggle on a row whose children were all filtered out: I'd
> open it and get nothing.

**Acceptance criteria**

- By default, a row shows a usable toggle only when it has children in the current, filtered
  view. Otherwise it behaves as a leaf (1.5).
- A page that loads children lazily can still show a toggle on any row it chooses (1.4).

**Failure behavior**

- When lazy loading and a filter combine, the page's own rule wins: its toggles never vanish
  because a filter ran. That is the bug vendors ship (Telerik Blazor 1696203, TanStack #4261).

**Covered by:** `tree-filtering/` (`Filtered`): "API Review" matches while none of its children
do, so its toggle renders disabled and hidden. The lazy-plus-filter failure line is not shown (1.4).

**Code:** shipped — `hasChildren` counts children in the filtered pool (`nest.ts:132-134`); the
leaf toggle disables and hides itself (`ngp-table-tree-toggle.directive.ts`).

**Design status:** decided — TR13, TR38. MUI X does the same: the toggle renders only when
filtered descendants exist (competitors discovery §8).

---

# 3. Counts and order

## 3.1 — Count every row, open or closed — ✅ covered

> As someone reading "42 of 120 rows", I want that number to include subtasks, because they are
> rows too.

**Acceptance criteria**

- The row count and "select all" include children, whether their parent is open or closed.
- Only rows the filter removed are left out.
- The number screen readers hear as the table's row count is the same number.

**Failure behavior**

- The count never changes when I open or close a parent. Kendo #5491's pager, which went from "1 -
  4 of 4" to "1 - 15 of 4" after a collapse, is the failure to avoid.

**Covered by:** `tree-filtering/` (`Filtered`): the `totalRowCount()` readout does not change when
a revealed parent is opened or closed.

**Code:** shipped — `totalRowCount` is `rows().length` (`engine/compose-table.ts:56`);
`aria-rowcount` reads it (`ngp-table.directive.ts:22`).

**Design status:** decided — TR14. How pagination counts is open (OQ-3).

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

**Covered by:** nothing. No host composes `withTree()` with `withSorting()`.

**Code:** shipped — the tree stage nests over its already-sorted input (`nest.ts:94-98`).

**Design status:** decided — TR29. PrimeNG #12935 (sort resets expansion) is the only community
complaint found.

---

# 4. When the data does not cooperate

Stories teach API usage; error and degraded-data UI is not their job
([`3-ui/stories.md`](../3-ui/stories.md) "What a host may not contain", rule 3). 4.1 and 4.2 keep
their criteria as the behavior contract, but carry no coverage mark (ruled 2026-10-01).

## 4.1 — A row whose parent doesn't exist — not a story concern

> As someone looking at an org chart where one record points at a manager who left, I want that
> person still on the chart, even if in the wrong place.

**Acceptance criteria**

- A row whose parent id matches no row appears at the top level, with its own children still
  under it.
- The same holds when the parent lookup itself fails on a row.
- The problem is reported to the developer once per evaluation, in production too.

**Failure behavior**

- The row is never hidden. A misplaced row gets noticed; a missing one usually doesn't.

**Coverage:** not a story concern — ruled 2026-10-01. Marking a misplaced row is the consumer
app's choice (OQ-9).

**Code:** shipped — `engine/tree-links.ts:58-65` (absent parent → root), reported by
`console.error` once per kind (`nest.ts:60-75`).

**Design status:** decided — TR9. Peers agree on "never hide it": AG Grid moves the row to the
root and warns; ClickUp and Asana show it top-level and mark it as a child; Jira's own bug
reports name "display as root-level entries" as the expected behavior (competitors §10,
products §6).

## 4.2 — Rows that point at themselves, or at each other — not a story concern

> As someone whose data has a task accidentally made its own subtask's child, I want the table
> to keep working and show me both tasks.

**Acceptance criteria**

- A row that names itself as parent appears at the top level.
- Rows that form a loop: the first of them, in data order, appears at the top level, and the
  rest nest under it.
- Reported once per evaluation.

**Failure behavior**

- The table never hangs, and no row in the loop disappears.

**Coverage:** not a story concern — ruled 2026-10-01 (see 4.1).

**Code:** shipped — `tree-links.ts:60-62`, `108-128`.

**Design status:** decided — TR9.

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

**Code:** shipped — `descendantsOf` (`with-tree/feature.ts:198-205`); the page composes
`removeRow([id, ...table.tree.descendantsOf(id)])` (`mutations/row-mutations.ts:45-49`).

**Design status:** decided — TR15. **Where products differ:** every product read cascades by
default (monday, Notion, Smartsheet); Smartsheet keeps children only after the person unlinks
them first (products discovery §6). TR15 makes the cascade the page's choice.

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

**Code:** true by construction — the filter runs over `data()` only
(`with-filtering/tree-retention.ts:13-23`).

**Design status:** follows from TR13. VS Code #66971 (171 👍) is this complaint from end users.
OQ-5 covers server filtering.

---

# 5. Cross-feature interactions

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to the tree. That is this repo's existing convention (`row-editing.md`,
`grouping.md` §5, `filtering.md` §5). Each owning doc carries the full story; the lines below
are pointers, and those files own the coverage marks. Where the canvas has moved past the owner's
mark, the line says so; the re-mark belongs in the owner's doc.

## Owned by filtering *([`filtering.md`](filtering.md) §5, "Owned by tree")*

- **F-T1 — A matching child keeps its path — 🟡.** Filtering keeps each match plus all its
  ancestors, shown as context rows. TR10, TR11, ADR-0028. Code shipped
  (`with-filtering/tree-retention.ts:13-69`, #168); canvas: `tree-filtering/` (`Filtered`).
- **F-T2 — Show a matched parent's whole branch — ❌.** `includeDescendants` on
  `withFiltering()`. TR10. Code shipped (`tree-retention.ts:41-54`); no canvas.

## Owned by grouping *([`grouping.md`](grouping.md) §5, "Owned by tree")*

- **G-T1 — Grouping never splits a family — 🟡 on canvas (owner says ❌).** Only top-level rows
  are grouped; each branch follows its root. TR16. On `grouping-collapsible/`, `d4-b` sits in
  `d4`'s group although its own rep differs. Not called out on canvas; the broken-link path is
  not shown.
- **G-T2 — A group's count includes every row in it — 🟡 on canvas (owner says ❌).** TR17. The
  Services group counts 3 on `grouping-collapsible/`. Group select-all is not on that canvas.
- **G-T3 — A group total that matches my data model — ❌.** `aggregateFn` receives every row in
  the group; the page decides own value vs. roll-up. TR18. The fixture's `d4` now carries its own
  amount (8000), but `grouping-aggregates/` does not compose `withTree()`.

## Owned by selection *([`selection.md`](selection.md) §6, "Owned by tree")*

- **S-T1 — "Select all" includes children — ❌.** It follows 3.1. TR14. Code shipped
  (`with-selection/utils.ts:14-15` reads `rows()`); no canvas. Whether selecting a parent selects
  its children is OQ-1.

## Owned by expansion *(#190, planned)*

- **E-T1 — A row with both a detail panel and children, two controls not confused — ❌.**
  Expansion owns it (`0-product/expansion.md` §4, #190). #190's planned `expansion/panel-in-groups/`
  story shows the tree chevron in the name cell, indented, and the panel chevron in its own
  leading column. No tree story composes `withExpansion()`.
- **E-G1, panel half** — collapsing a group hides its rows' open panels. Grouping owns it
  ([`grouping.md`](grouping.md) §5); the same #190 story demonstrates it. The tree half is
  already on `grouping-collapsible/`.

## Owned by tree

- **E-1 — Editing a child row — ❌.** A child row is a data row, so I can edit it like any other
  row; the detail panel is not involved. Owned by `withTree()` and closed in code by #163 (OQ-7).
  The story's full text is at [`row-editing.md`](row-editing.md). Code shipped: child rows carry
  `sourceIndex` from `indexById` over `data()` (`engine/core.ts:102-106`, `130`). No row-edit
  host composes `withTree()`.

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

**OQ-1 — Does selecting a parent select its children? — open.**
*Recommendation:* no cascade in state, matching selection's D13 (the consumer owns it). The
recipe is `select([id, ...table.tree.descendantsOf(id)])`, so no new API. Community wants both
(PrimeNG #18936: propagate over the full tree; AG Grid #1627: only visible rows), which argues for
leaving it to the page.
*To decide:* whether a recipe story is enough, or a tri-state parent checkbox needs a state
signal.
*Sequencing:* owned by `selection.md`.

**OQ-2 — Which filter changes forget a parent I closed during the filter? — resolved (TR22(c)).**
The memory lives exactly as long as the row is a context row. A page wanting other timing turns
reveal off and rebuilds it from `table.tree.contextRowIds()` plus `expand`/`set`/`toggle`.

**OQ-3 — How does a page count a tree? — open, pagination unbuilt.**
*Recommendation:* count every row (TR14), and never start a page with a child whose parent is on
the previous page without showing that parent again. Decide when pagination is built.
*To decide:* whether pages split families at all.
*Sequencing:* pagination's spec.

**OQ-4 — Does a lazily loading parent show that it is loading? — open.**
*Recommendation:* the table exposes nothing new; the page knows it is fetching and renders its
own indicator. A recipe in a story is enough.
*To decide:* whether a recipe story is enough.
*Sequencing:* not blocking.

**OQ-5 — What does a tree do under server filtering? — open.**
*Recommendation:* with `manual: true` the local filter stage is skipped, so the table cannot add
ancestors or know which rows are context. The server returns matches plus their ancestors; the
page marks context rows if it wants to. Document it; add nothing.
*To decide:* whether a server can report which rows matched, and whether `isContextRow` should
accept it.
*Sequencing:* not blocking.

**OQ-6 — Which directive binds the tree's row hooks, and what else does the tree UI need? —
resolved (TR23, TR33–TR46).**
`ngpTableTreeRow` binds `data-expandable`, `data-expanded` and `data-context-row`;
`ngpTableTreeToggle` owns the button. Indentation is `--ngp-table-row-depth` (TR41). Row
`aria-level` was rejected, not deferred: the table stays `role="table"` (TR34).

**OQ-7 — Who owns E-1, editing a child row? — resolved 2026-10-01 (user ruling in the #190
session).**
The tree owns it. Child rows are data rows, so the library owns their edit state; the panel is
not involved. Closed in code by #163. `row-editing.md` and `expansion.md` are re-filed by #190.

**OQ-8 — Should a screen-reader user hear a row's depth? — open, treegrid territory (§9).**
Under `role="table"` nothing announces depth; grids that do (MUI X, CDK) use treegrid's
`aria-level`, which TR34 deferred (1.7).
*Ruled for #189 (2026-10-01):* the Tree stories put no level in the toggle's name
(`'Children of ' + row.data.name`); the library adds nothing.
*To decide:* whether and when the treegrid work is pulled forward.
*Sequencing:* the treegrid issue, not yet opened (TR34).

**OQ-9 — Does the table tell the page which rows are misplaced? — resolved 2026-10-01 (user
ruling).**
No story, no API. The report reaches only the console (TR9); marking a misplaced row is the
consumer app's choice. Products that show an orphan at the top level also mark it as a child
(ClickUp, Asana; products discovery §6) — that is their app's choice too.

---

# 8. Gap analysis, split by owning layer

**The stories above are deliberately layer-free.** The gaps are work someone has to do, so each
is tagged **state**, **UI**, or **both**.

## 8.1 State-layer gaps

Owned by [`features/tree.md`](../1-state/features/tree.md) unless named. Every gap the 2026-09-27
pass listed is closed in code:

| # | Gap | Story | Closed by |
|---|---|---|---|
| S1 | ~~Tree built from nested children~~ | 1.1, 3.1, 3.2, E-1 | #167, TR7 |
| S2 | ~~No parent-link slot for filter and group~~ | F-T1, G-T1 | `with-tree/feature.ts:269`, TR11 |
| S3 | ~~No ancestor retention or `includeDescendants`~~ | F-T1, F-T2 | `tree-retention.ts`, TR10 |
| S4 | ~~Grouping clusters children by their own values~~ | G-T1 | `clusters.ts:150-156`, TR16 |
| S5 | ~~No derived reveal or closed-while-context memory~~ | 2.1, 2.2 | `reveal.ts` (#169), TR22 |
| S6 | ~~No `isContextRow` or `contextRowIds()`~~ | 2.3 | `core.ts:131`, `feature.ts:138-140`, TR21 |
| S7 | ~~Default toggle ignores the filter~~ | 2.6 | `nest.ts:132-134`, TR13 |
| S8 | ~~Broken links: no degrade, no report~~ | 4.1, 4.2 | #167, TR9 |
| S9 | ~~No `descendantsOf(id)`~~ | 4.3, OQ-1 | #167, TR15 |
| S10 | ~~No `includeHidden` on `expand()`/`state()`~~ | 1.3 | `feature.ts:169-174`, `224-229`, TR12 |

Still open, none blocking a story:

| # | Gap | Story | Note |
|---|---|---|---|
| S11 | No way to mark context rows under server filtering | 2.3 | OQ-5 |
| S12 | No tri-state parent-selection signal | OQ-1 | `features/selection.md`, if the recipe proves insufficient |
| S13 | Pagination counting | P-T1, 3.1 | Pagination unbuilt (OQ-3) |

## 8.2 UI-layer gaps

The tree UI spec is [`3-ui/directives/tree.md`](../3-ui/directives/tree.md) (`spec: drilled`,
`code: shipped`). What remains is canvas, not directives.

| # | Gap | Story | Owner · note |
|---|---|---|---|
| U1 | No expand-all / collapse-all for **rows**, and no tri-state label, on any canvas | 1.3 | #189 Tree story. `grouping-collapsible/` has one for groups only |
| U2 | ~~No Tree story entry: no flat-data tree deeper than one level, no filtered tree, no leaf toggle~~ | §1–§3 | #189: `Basic`, `Filtered`, `RowClick` under `src/stories/tree/`. Sorting siblings (3.2) is not in the entry |
| U3 | ~~No tree UI spec~~ | 1.1, 1.2 | Closed by #182–#184; `aria-level` rejected (TR34) |
| U4 | Revealing rows under a filter is not announced to screen readers | 2.1 | Same accepted cost as filtering's U4 |
| U5 | ~~No `ngpTableTreeRow`~~ | 2.3 | Shipped (#166, TR23, TR35) |
| U6 | `grouping-collapsible/` behind its own decisions: hand-written `d4` chevron, per-depth `[data-depth]` CSS instead of `--ngp-table-row-depth` | 1.2, 1.6 | [#202](https://github.com/DvirMon/ng-table/issues/202) (sub of #165). `grouping-collapsible-story-host.component.html:103-112`, `grouping-story.css:12-19` (TR43, G79) |
| U7 | Depth not announced to screen readers | 1.7 | OQ-8; treegrid issue not opened |
| U8 | ~~No canvas marks a misplaced row as misplaced~~ | 4.1 | Closed: not a story concern (OQ-9, ruled 2026-10-01) |
| U9 | No canvas shows the whole-row click guard | 1.8 | #189, tree UI spec "Whole-row click" |

## 8.3 Gaps needing both layers

| Gap | State owes | UI owes |
|---|---|---|
| Lazy parent (1.4, 4.4) | nothing new: `isExpandable` + appended rows | a recipe story showing the toggle, the fetch, the loaded children, and a loading indicator (OQ-4) |

Context-row marking (2.3), listed here on 2026-09-27, is closed on both halves.

## 8.4 Confirmed right — do not re-litigate

- **Every tree node is a row in `data()`** — it is what lets filter, sort, edit, select and
  count treat children like any row, with no tree-specific wiring in any of them.
- **Keep ancestors by default** (TR10) — the one behavior nobody argues with, in any tracker or
  library read.
- **Reveal without writing** (TR22) — the only way to show hidden matches and still give the
  person their own state back.
- **Every library-only fact readable, every policy switchable** (TR22(e)) — a page that
  disagrees with a default turns it off and rebuilds from the reads.
- **Broken data is misplaced, never hidden** (TR9) — the ADR-0014 direction; AG Grid's code,
  ClickUp, Asana and Jira's own bug reports all land on "show it at the root".
- **Families stay together under grouping** (TR16) — the one point where libraries and products
  agree.
- **A disclosure button under `role="table"`** (TR34) — the only shape that is valid ARIA
  without taking on treegrid's keyboard contract; no vendor ships it, and PrimeNG's row
  `aria-expanded` under `role="table"` is the invalid alternative.
- **Depth as a CSS custom property** (TR41) — AG Grid's `--ag-indentation-level` is the one
  peer precedent; the others write inline styles this library rules out.
- **A leaf keeps its toggle's width, hidden and inert** (TR38) — aligns labels without leaving a
  dead control in the accessibility tree.
- **The page names the toggle** (TR39) — with `aria-expanded` on the same button, a library
  label that changes with state would announce it twice.

---

# 9. Capabilities with no owner

Checked against [`docs/status.md`](../status.md) (the generated registry; `tree` reads state
`drilled/shipped`, UI `drilled/shipped`), not against memory.

- ~~**`tree` has no decisions-log link.**~~ Resolved 2026-09-27: [`decisions/tree.md`](../decisions/tree.md).
- ~~**Tree UI has no spec.**~~ Resolved by #182–#184: [`3-ui/directives/tree.md`](../3-ui/directives/tree.md).
- **Treegrid** — `role="treegrid"`, row `aria-level`/`aria-expanded`, announced depth (OQ-8),
  arrow-key navigation between rows. TR34 deferred it to a table-wide issue with its own ADR; no
  issue exists. It reaches every table, not only trees, so no feature doc can absorb it. **UI**.

# 10. Not user-facing

Real problems, but the integrating developer's, not the person using the table.

- **`parentId` as a function vs. a key name** (TR7) — configuration shape.
- **No `flattenTree` helper** (TR8) — a consumer with nested data flattens it once; invisible on
  screen.
- **The parent link as an engine slot** (TR11, ADR-0028) — its consequence (counts match what
  renders) is product-visible and is credited in 3.1; the slot itself is not.
- **`descendantsOf` as a read, not a cascading delete** (TR15) — its product consequence is 4.3.
- **Duplicate row ids** — #156's runtime checks; a person sees at most a symptom.
- **The broken-link report** (TR9) — a `console.error` once per kind per evaluation. Marking the
  row on screen is the consumer app's choice (OQ-9).
- **Toggle without `withTree()`** (TR40) — throws in development, inert in production.
- **No attribute bound by two directives** (TR37) — debugging aid, invisible on screen.
