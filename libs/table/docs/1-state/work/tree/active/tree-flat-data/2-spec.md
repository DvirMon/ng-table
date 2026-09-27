---
title: tree-flat-data — spec (#163)
type: spec
date: 2026-09-27
ticket: "#163"
decisions: 1-decisions.md
architecture: 3-architecture.md
product: ../../../../../0-product/tree.md
---

# withTree() builds its hierarchy from flat data (#163)

## Problem Statement

A developer building a tree-grid — an org chart, a folder list, a
task/subtask plan — gets rows from a backend as a flat list, each row
naming its parent. The table only accepts nested `children` arrays, so
the developer reshapes their data before handing it over. Once nested,
the children live outside the table's data: a filter never sees a
child row, sorting never orders siblings, an edit to a child has no
source index to write back to, and the runtime row-id checks (#156)
misreport every tree table.

The person using the table feels it next. Searching for "Alice" in an
org chart finds nothing when Alice sits under a manager who does not
match. When a search does match a nested row, the match can sit hidden
under a collapsed parent and the search looks broken. Grouping a task
tree by status tears subtasks away from their parent — or, today, just
ignores them.

This contradicts the capability's own rule (E5): every tree node, at
any depth, is an entry in the flat `data()` array.

## Solution

`withTree()` builds the hierarchy from the flat rows the developer
already has, through one accessor that names each row's parent. Every
node is a real row: filtered, sorted, counted, selected and edited
like any other.

Filtering a tree shows each match together with its ancestors as
**context rows**, so a match always keeps its place. Context rows open
by themselves while a filter is active, so no match hides under a
collapsed parent, and the person's own open/closed state comes back
untouched when the filter clears. Which context rows open is a
declarative default the developer can narrow or switch off; every fact
the table computes (which rows are context rows, a row's parent, its
descendants) is readable, so any other policy can be built on top.

Grouping a tree groups its top-level rows; a subtree always follows
its root. Broken parent data never hides a row — it shows at the top
level and is reported. Deleting a parent never silently deletes its
children.

## User Stories

Building the tree

1. As a developer, I want to pass flat rows plus a `parentId` accessor, so that I can render a tree without reshaping my backend data.
2. As a developer, I want `parentId` to read any field (`managerId`, `folderId`, `parent`), so that the tree follows my domain model.
3. As a developer, I want `null` or `undefined` from `parentId` to mean "root", so that top-level rows need no sentinel value.
4. As a developer, I want omitting `parentId` to keep the collapse-only behavior, so that collapsible groups keep working unchanged.
5. As a developer migrating from `childrenAccessor`, I want a documented flatten snippet, so that I can convert nested data in a few lines.
6. As a person using the table, I want children to appear indented beneath their parent when I open it, so that I can read the hierarchy.
7. As a person using the table, I want siblings to follow the table's sort order, so that sorting works inside every level.
8. As a developer, I want every child row to carry a `sourceIndex`, so that inline edits to a child write back to my data.
9. As a developer, I want every tree node to count toward `totalRowCount` and `aria-rowcount`, so that counts match my data.
10. As a developer, I want `selectAllIds()` to include children, collapsed or not, so that select-all means all rows.

Broken parent data

11. As a person using the table, I want a row whose parent does not exist to still appear, at the top level, so that no data silently disappears.
12. As a person using the table, I want a row that names itself as parent to appear at the top level, so that bad data never hides a row.
13. As a person using the table, I want rows that form a cycle to still appear, with the first of them at the top level, so that the table never hangs or drops them.
14. As a developer, I want a throwing `parentId` to degrade that row to the top level and report once per evaluation, so that one bad record never blanks the table.
15. As a developer, I want broken-link reports in production as well as development, so that data problems I cannot reproduce still surface.

Deleting and loading

16. As a developer, I want removing a parent to leave its children in place as top-level rows, so that no delete removes more than I asked for.
17. As a developer, I want `table.tree.descendantsOf(id)`, so that I can cascade a delete with the ordinary remove write when I choose to.
18. As a developer, I want `table.tree.parentOf(id)`, so that my own policies can walk the hierarchy.
19. As a developer, I want to load children lazily by appending rows to my data, so that large trees load on demand.
20. As a developer, I want `isExpandable` to show a toggle before children are loaded, so that a lazy row can still be opened.

Filtering a tree

21. As a person searching, I want a matching child to show together with its ancestors, so that I can see where the match sits.
22. As a person searching, I want ancestors shown only for context to be distinguishable from real matches, so that I know what matched.
23. As a developer, I want each rendered row to say whether it is a context row, and the row element to carry a `data-context-row` attribute, so that I can style context rows my way.
24. As a person searching for a parent, I want only its matching children by default, so that results stay focused.
25. As a developer, I want `includeDescendants` on filtering, so that a matched parent can bring its whole branch when my product needs it.
26. As a person searching, I want context rows to open by themselves, so that no match hides under a collapsed parent.
27. As a person searching, I want my own open/closed choices back exactly when I clear the search, so that searching never rearranges my tree.
28. As a person searching, I want to close a context row that opened for me and have it stay closed while I keep typing, so that my click is respected.
29. As a developer, I want a `revealContextRow` predicate on `withTree()`, so that I can choose which context rows open (all, first level only, a domain rule, or none).
30. As a developer, I want `table.tree.contextRowIds()`, so that I can build any other reveal policy with the existing expand/collapse writes.
31. As a person searching, I want a parent whose children were all filtered out to show no toggle, so that I never open a row to find nothing.
32. As a person, I want "expand all" while filtered to open what I can see, so that it does not act on rows I cannot see.
33. As a developer, I want `includeHidden` on expand-all and the tri-state, so that I can act on all data when I need to.

Grouping a tree

34. As a person grouping a task tree by status, I want each subtask to stay under its parent, so that grouping never tears the tree apart.
35. As a developer who wants every row grouped by its own value, I want to compose grouping without `parentId`, so that the flat view needs no extra flag.
36. As a person, I want a group header's count to include every row in the group, children too, so that the count matches what select-all selects.
37. As a developer, I want my group `aggregateFn` to receive every node in the group, so that I decide whether a parent's value is its own or a roll-up of its children.

## Implementation Decisions

Settled in the grill (`1-decisions.md` D1–D21, capability log E20–E36,
ADR-0028). Summarized here; rationale lives in the decisions file.

- **Config (D1, D3).** `WithTreeConfig.childrenAccessor` is removed outright — no deprecation window, no exported flatten helper. It is replaced by `parentId?: (row) => RowId | null | undefined`; `null`/`undefined` is a root. Omitted `parentId` keeps collapse-only behavior and claims no `'tree'` render stage (E13 carried over). A new `revealContextRow?: (row) => boolean` predicate sits beside `isExpandable` (D20).
- **Parent-link engine slot (D6, ADR-0028).** `withTree()` contributes a parent link to the engine, the same contribution pattern as `expandedRows`. Stages that need the hierarchy read the engine slot, never another feature's members. Consumers: the filter stage (ancestor retention), the group stage (roots-only grouping), the `'tree'` render stage (nesting).
- **Context-row engine slot (architecture decision A2, from D6's principle).** Only the filter knows which rows matched, so `withFiltering()` contributes the set of context-row ids to the engine; the engine stamps `RenderRow.isContextRow` centrally, like `sourceIndex`, and `withTree()` reads the engine slot to drive reveal. No feature reads another's state.
- **Tree stage (issue body, D4).** The `'tree'` render stage indexes its input nodes by parent id, nests them, and leaves only roots at the top level. Sibling order follows input order, so pipeline sorting carries over. Group headers pass through untouched; nesting happens within each sibling list.
- **Broken links degrade to root (D4, D12).** A throwing `parentId`, a self-parent, a cycle (first row of the cycle in input order), and a parent id absent from `data()` all render the row at depth 0 with its subtree intact. Reported once per evaluation per kind, in production too (ADR-0014). Removing a parent is not special-cased — its children hit this same rule.
- **Filtering a tree (D5).** The filter stage keeps each match plus all its ancestors. `withFiltering({ includeDescendants: true })` also keeps every descendant of a match. Filtering therefore never creates an orphan. With `manual` (server) filtering the local stage is skipped, so no context rows are computed — see Out of Scope.
- **Reveal (D20, supersedes D16/D17).** Reveal is a derived visibility source: the tree's contributed open set becomes (open set ∪ revealed context rows) − closed-while-revealed. It never writes the open set and `changed` never fires for it. A toggle on a revealed row adds it to the closed-while-revealed set; an id stays in that set only while its row is a context row, so it clears itself when the row stops being context or the filter clears.
- **Expandability (D8, D9).** Without `isExpandable`, `hasChildren` is true only when the row has children in the filtered view. `expand()` with no ids and `state` scan the filtered view by default; `includeHidden` scans all of `data()`, matching `selectAllIds()`.
- **Reads on `table.tree` (D12, D20).** `parentOf(id)`, `descendantsOf(id)`, `contextRowIds()`. All read-only.
- **Grouping a tree (D13, D14, D15).** With a parent link present, grouping clusters roots only and each subtree follows its root. A group's row count includes every node in it. `aggregateFn` receives every node in the group; roll-up versus own-value parents is the consumer's call inside `aggregateFn`.
- **Counts (D11).** `totalRowCount` and `selectAllIds()` count every node after filtering, collapsed or not, including context rows.
- **Directive (D18, D21).** A new feature directive, `ngpTableTreeRow`, binds `data-context-row` as a presence attribute (ADR-0026 rule 1). Core `ngpTableRow` stays on required fields only. The wider tree UI (indentation, `aria-level`, toggle) is #165.
- **Glossary.** *Context row* — a row shown only because one of its descendants matched the filter.

## Testing Decisions

- **Good tests assert what a consumer can observe**: the public store's signals and methods, and the rendered row element's attributes. No test reaches into engine slots, stage closures or the internal closed-while-revealed set.
- **Seam 1 — the `createTable()` public store**, built in an injection context. Assertions on `renderRows()` (ids in order, `depth`, `parentId`, `hasChildren`, `isExpanded`, `isContextRow`, `sourceIndex`, group `aggregates`), on `table.tree` (the open set, `changed`, `state`, `expand`/`collapse`/`toggle`, `parentOf`, `descendantsOf`, `contextRowIds`), on `totalRowCount`, `selectAllIds()` and grouping's `rowsOf()`. Prior art: the existing `withTree()` spec and the grouping feature spec, which already compose tree, filtering, sorting and selection.
- **Seam 2 — an `ngpTableTreeRow` host component** with hand-built render rows, asserting `data-context-row` is present for a context row and absent otherwise. Prior art: the row-field directive spec's host-component pattern.
- **Modules exercised through seam 1:** `withTree()`, `withFiltering()`, `withGrouping()`, `withSelection()`'s `selectAllIds()`, and the engine (both slots, central stamping) — only through the store.
- **Must-have cases:** flat data renders the same tree today's nested fixture renders; each broken-link kind degrades to root and reports once per evaluation; a filter matching a child keeps its ancestors and flags them; `includeDescendants`; reveal opens context rows without writing the open set and restores on clear; closing a revealed row survives further typing; `revealContextRow: () => false` disables reveal; grouping keeps subtrees with their root; group count and aggregate rows include descendants; children carry `sourceIndex`; `removeRows([id, ...descendantsOf(id)])` cascades.
- **Fixtures:** the tree spec fixture and the grouping story fixture move to flat rows with parent ids; the roll-up parent (amount 42000 = 25000 + 17000) becomes an own-value parent so aggregates stop double-counting.
- **Acceptance gate:** `nx run shared-table:typecheck` and `typecheck-spec` clean.

## Out of Scope

- The tree UI layer beyond `data-context-row`: indentation, `aria-level`, the row toggle — #165.
- Duplicate row ids and the runtime containment check — #156 (unblocked by this work).
- Selection cascading from a parent to its children — open question OQ-1 in the tree product doc.
- Context rows under `manual` (server) filtering — the server returns the rows; the local stage never runs (tree product doc OQ-5).
- Pagination counting of tree nodes — pagination is not built (OQ-3).
- A per-row loading indicator for lazy children (OQ-4).
- A tree built from paths (`getDataPath`) — grouping's mechanism, never `withTree()` (E5).
- A parent roll-up aggregation feature (a parent displaying its subtree's aggregate).

## Further Notes

- Breaking change: `childrenAccessor` is removed. The tree docs gain a nested-to-flat snippet.
- Unblocks #156: its containment check (output ids ⊆ input ids) holds on tree tables once children come from `data()`; ancestors kept by the filter come from the filter stage's own input.
- Grounding: discovery files in this workspace (`discovery-tree-filter-*.md`, `discovery-tree-grouping-*.md`); product stories in `0-product/tree.md`; architecture in `3-architecture.md`.
