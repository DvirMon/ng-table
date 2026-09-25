# #142 — table-level `renderColumns` — spec

Source: [#142](https://github.com/DvirMon/ng-table/issues/142) ·
decisions: [`1-decisions.md`](1-decisions.md) ·
capability log: [`docs/decisions/columns.md`](../../../../../decisions/columns.md)
(COL37–COL40).

## Problem Statement

A consumer rendering a table has to rebuild the column list the template
iterates: keep the columns that are visible, then sort them into render
order. Every story host in the repo does this by hand in its own
`computed()` — eight grouping hosts copy the same filter-and-sort, one
grouping host carries it under another name, and three hosts skip it and
loop over every column, hidden ones included. The rows side has had
`renderRows` for this since the start. The columns side has nothing, so
every consumer re-derives it, and each copy reads `order` directly —
a field that is about to be removed (#128).

## Solution

The table store gains `renderColumns`: a read-only signal holding the
visible columns in render order. It is the column-side twin of
`renderRows` — "what the template iterates". Its contract names neither
`visible` nor `order`; how render order is read is an engine detail,
so #128 can move order into its own id slice without any consumer
changing.

Every story host switches to `table.renderColumns()`. Hosts that shape
the list further for their own purposes (hiding or moving grouped
columns) do that on top of `renderColumns()`, in their own `computed`.

## User Stories

1. As a table consumer, I want `table.renderColumns()` to give me the
   columns to render, so that I stop writing a filter-and-sort
   `computed()` in every component.
2. As a table consumer, I want hidden columns left out of
   `renderColumns()`, so that my header and body loops never render a
   column the user hid.
3. As a table consumer, I want `renderColumns()` in render order, so
   that header cells and body cells line up without me sorting.
4. As a table consumer, I want `renderColumns()` to update when I call
   `toggleColumnVisibility`, so that hiding a column takes effect with
   no extra wiring.
5. As a table consumer, I want `renderColumns()` to update when I call
   `reorderColumns`, so that a drag-to-reorder UI re-renders in the new
   order.
6. As a table consumer, I want `renderColumns()` to follow `visible()`
   and `visibleAsync()` schema rules, so that rule-driven visibility and
   manual visibility read from one place.
7. As a table consumer, I want `renderColumns()` to follow
   `setColumns()` writes, so that re-declaring a column is reflected
   in what renders.
8. As a table consumer, I want each element of `renderColumns()` to be
   the same `ColumnDef` that `columns()` returns, so that I read `id`
   and `label` the way I already do.
9. As a table consumer, I want `column.id` from `renderColumns()` typed
   as my declared id union, so that `row.cells[column.id]` stays
   narrowly typed.
10. As a table consumer, I want `renderColumns()` to be `[]` when every
    column is hidden, so that my template renders an empty header
    rather than throwing.
11. As a table consumer, I want columns with equal order to keep their
    declaration order, so that render order is deterministic.
12. As a table consumer, I want reading `renderColumns()` never to
    reorder `columns()`, so that code reading `columns()` for a
    settings panel sees declaration state, not render state.
13. As a table consumer, I want `renderColumns()` to keep holding the
    declared visibility while a `visibleAsync()` rule is still loading,
    so that columns don't flicker in and out on first load.
14. As a table consumer, I want my templates to keep compiling when
    #128 moves order into its own slice, so that the order migration
    does not become my migration.
15. As a feature author, I want to read `renderColumns` from the store
    my feature receives, so that a feature can reason about what is on
    screen.
16. As a feature author, I want declaring a `renderColumns` member to
    throw at construction, so that no feature silently replaces what
    every template iterates.
17. As a feature author building column pinning or virtualization
    later, I want that work to get its own column render-stage seam,
    so that it composes instead of competing for one overridable
    member.
18. As a grouping consumer, I want to hide or move grouped columns on
    top of `renderColumns()`, so that my `groupedColumnMode` choice
    stays mine and the library doesn't guess it.
19. As a docs-site reader, I want every story host to render from
    `renderColumns()`, so that the examples show the one sanctioned
    way.
20. As a docs-site reader, I want the filtering and selection stories
    to stop rendering hidden columns, so that the examples behave the
    way a real table should.
21. As a maintainer, I want the filter-and-sort to be one pure
    function, so that I can test it with plain vitest.
22. As a maintainer, I want `renderColumns` in the engine's claimed
    core-member list, so that the existing claim test covers it with
    no new test.
23. As a maintainer, I want the directive spec to stop saying column
    order and visibility are "the template's job", so that the
    contract matches the code.
24. As a maintainer working on #128, I want exactly one engine line to
    retarget, so that the order migration does not touch story hosts.

## Implementation Decisions

- **Name:** `renderColumns`, parallel to `renderRows` (COL37 / Q4).
  `visibleColumns` rejected: it names only the filter and goes stale
  once a later stage (pinning, virtualization) reshapes the list.
- **Shape:** a read-only signal of the same element type `columns()`
  returns — `ColumnDef` with the declared id union — filtered to
  visible and sorted into render order (COL38 / Q2). No projection
  type. A `{ id, label, index }` projection is revisited only when a
  cell directive needs `aria-colindex`.
- **Owner:** built in the table core beside `renderRows`, as a
  `computed` over the folded `columns()` (COL39 / Q3). The
  filter-and-sort is a pure function in the engine's column-transforms
  module: no signals, no Angular.
- **Sort never mutates `columns()`.** The sort runs on the fresh array
  the filter returns.
- **Order read is internal.** Today the pure function sorts by
  `ColumnDef.order`. That is the single line #128 retargets to the
  ordered-id slice. The public contract says "render order" and never
  names the field (COL37 / Q1).
- **Ties:** stable sort keeps declaration order. No tie-break rule.
- **Engine-claimed, not overridable.** Added to the claimed
  core-member list; declaring it from a feature throws at
  construction (ADR-0007). Unlike `totalRowCount`, there is no
  override. Future pinning/virtualization gets a column render-stage
  seam, designed then (COL39).
- **Exposed on both** the engine handle (`TableCore`) and the public
  store (`TableStore`), and wired onto the store in `composeTable()`
  the way `renderRows` is.
- **Sequencing:** ships before #128 (COL37). #128's story-host
  migration moves here; #128 no longer touches story hosts.
- **Grouped-column disposition stays consumer-side** (COL40 / Q5).
  `grouping-columns` replaces its `layoutColumns` with
  `table.renderColumns()`. Its `displayColumns` (hide / move-to-front
  via `groupedColumnMode`) stays the host's own `computed` on top.
- **Story-host migration (Q6):** every story host renders from
  `table.renderColumns()`:
  - the 8 grouping hosts that hand-roll filter+sort: `grouping-basic`,
    `-aggregates`, `-async-rule`, `-collapsible`, `-keys`, `-order`,
    `-selection`, `-when`;
  - `grouping-columns`' `layoutColumns`;
  - the 3 hosts looping unfiltered `table.columns()`:
    `filtering/server-filtering`, `filtering/client-filtering`,
    `selection/filtering-selection`. Their stories now omit hidden
    columns; that is a behavior fix, not a regression.
  - Per the signal-plumbing convention, a host either calls
    `table.renderColumns()` in its template or wraps it in a
    `computed()`; it never assigns the signal reference to a field.
- **Not migrated:** spec files that filter on `.visible` (`columns`,
  `create-table`, `update-columns`, `wire-columns-schema`,
  `compose-features`) — they assert visibility itself.
- **Error handling:** no consumer callback runs in the filter or sort,
  so ADR-0014 has nothing to wrap. The only failure is the
  construction-time member-claim throw.
- **`RenderRow.cells` unchanged:** it stays keyed by id and
  order-independent, still holding hidden columns' cells.
- **Doc edits owed (acceptance criteria):**
  - ADR-0007: amend the core-member-keys section to add
    `renderColumns`.
  - `3-ui/directives/columns.md`: rewrite the passage saying
    presentation order and visibility are "the template's job", and
    close its open question by linking #142. No new ADR — that
    position lived in a spec with an open question.
  - `1-state/columns.md`: add the member.
  - `libs/table/CLAUDE.md`: add `renderColumns` to the core-member
    list in the feature-plugin rules.
  - `llms.txt`: regenerate; `npm run llms:check` clean.
  - `docs/decisions/columns.md`: flip COL37–COL39 to shipped with the
    commit.

## Testing Decisions

- A good test asserts what a consumer or a feature observes on the
  store — never which internal helper ran, or how the computed is
  built.
- **Main seam — the `createTable()` public store** (prior art: the
  existing `create-table` spec). Covers:
  - hidden columns are excluded;
  - result is in render order;
  - updates after `toggleColumnVisibility`, `reorderColumns`,
    `setColumns`, and a `visible()` schema rule changing;
  - `columns()` order is untouched after a `renderColumns()` read;
  - the element is the `columns()` element (same `id`/`label`).
- **Pure-function seam — the column-transforms spec** (prior art:
  `applyColumnOrder` and `foldColumnRules` blocks in the same file,
  plain vitest). Covers: all hidden → `[]`; ties keep declaration
  order; input array not mutated.
- **Claim test — inherited.** The slot-registry spec already runs
  one throw-on-declare case per entry in the core-member-key list;
  adding `renderColumns` to the list covers it. The list's own
  exhaustiveness check fails to compile if `renderColumns` is added
  to `TableStore` without being listed.
- **Type check:** `nx run shared-table:typecheck` and
  `typecheck-spec` clean — the story-host templates change, so the
  template-aware run is the acceptance check, run a second time if
  the first reports `.ts` errors.
- No DOM/structural tests: story hosts are verified by typecheck and
  by a person opening Storybook.

## Out of Scope

- The ordered-id slice and removing `ColumnDef.order` — #128.
- Whether that slice gets a `stateOf` reader — #128 (COL19).
- A `RenderColumn` projection or `aria-colindex` support.
- Column pinning, virtualization, or a column render-stage seam.
- Library-owned grouped-column hide / move-to-front.
- Trimming `RenderRow.cells` to render columns.
- Making `renderColumns` overridable by a feature.

## Further Notes

- `visibleAsync` loading behavior is inherited, not new: the async
  metadata entry holds its previous value and, before first
  resolution, defers to the declared `visible`. `renderColumns` reads
  the folded `columns()`, so it follows the same rule.
- Recompute cost is O(columns) per `columns()` change. The
  O(rows × columns) cost in COL4 is `renderRows`' and stays #128's.
- Directive specs describing the template loop should show
  `table.renderColumns()` once this ships.
