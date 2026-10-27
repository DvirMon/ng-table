# Spec — table-wide keyboard model (grid / treegrid)

Source: [#196](https://github.com/DvirMon/ng-table/issues/196),
[#201](https://github.com/DvirMon/ng-table/issues/201) ·
decisions: `1-decisions.md` (K0–K14) · ADR-0030 (table-wide
keyboard model) · ADR-0029 cat. 5 · ADR-0005 · ADR-0006 ·
architecture: `3-architecture.md`

## Problem Statement

A keyboard user cannot move around an `ngpTable`. Rows and cells
are not focusable; the only Tab stops are whatever buttons the
consumer put in the rows. A tree table with 200 rows means 200 Tab
presses past 200 toggle buttons. A screen reader announces a plain
`table`, so a row cannot say it is expanded, and nothing announces
the tree level.

ADR-0029 makes keyboard navigation the library's job (category 5,
never opt-in), but no directive owns it. Today a consumer who wants
"↓ to the next row" has to search `renderRows()`, handle group
headers, open detail panels, deleted rows and collapsed parents, and
manage tabindex themselves — and still has no way to follow focus
in a side panel or survive virtual scrolling.

## Solution

Every table rendered with the `ngpTable` directives becomes an APG
grid with one Tab stop:

- **Role.** `role="treegrid"` when the table composes `withTree()`,
  `role="grid"` otherwise. Fixed at construction, never switched
  at runtime. Cells become `gridcell`.
- **One Tab stop, roving tabindex.** Tab enters the grid on the
  last focused cell or row (first entry: the first data row);
  arrow keys move inside it; the next Tab leaves.
- **APG key map.** Arrows, Home/End, Ctrl+Home/End, Page Up/Down.
  No wrap at edges. RTL swaps ←/→.
- **Treegrid rows.** Rows and cells are both focusable. → expands,
  ← collapses or moves to the parent, Enter toggles. The row owns
  `aria-expanded` and `aria-level`; the tree toggle button stays
  as a mouse target only.
- **Widgets in cells.** A cell holding one button or checkbox
  focuses that widget directly. A cell with a text input or
  several widgets is entered with Enter/F2 and left with Esc.
- **Header row, group headers, open detail panels** are arrow
  stops.
- **Store-held focus position.** `table.focus()` reads where focus
  is, as data (row id + column id), and `table.focus.moveTo()`
  writes it. The engine keeps it valid when rows are deleted,
  filtered, collapsed or re-sorted, so focus never falls to
  `<body>` and never silently lands on a different row.
- **Consumer keys win.** Any key handler that calls
  `preventDefault()` keeps the grid out of that key.

## User Stories

### Entering and leaving the grid

1. As a keyboard user, I want the whole table to be one Tab stop,
   so that I can tab past a 500-row table in one keypress.
2. As a keyboard user, I want my first Tab into a table to land on
   the first data row, so that I start on data, not on a header
   that may do nothing.
3. As a keyboard user, I want Tab back into the table to return me
   to the cell I last left, so that tabbing out to a toolbar and
   back does not lose my place.
4. As a keyboard user, I want ↑ from the first data row to reach
   the header row, so that I can still reach sort buttons and
   header filters.
5. As a mouse user, I want clicking a cell to move the keyboard
   position there, so that switching to the keyboard continues
   from where I clicked.
6. As a mouse user, I want no focus ring after a click, so that
   the table does not look keyboard-focused when I used the mouse.

### Moving in a grid

7. As a keyboard user in a `grid`, I want ←/→ to move cell to cell
   and ↑/↓ to move row to row in the same column, so that I can
   read a table like a spreadsheet.
8. As a keyboard user, I want Home/End to jump to the first/last
   cell of the row, so that I can reach a far column quickly.
9. As a keyboard user, I want Ctrl+Home/Ctrl+End to jump to the
   first/last cell of the table, so that I can reach either end
   of a long table.
10. As a keyboard user, I want Page Up/Page Down to move by one
    screen of rows in the same column, so that I can scan a long
    table without holding ↓.
11. As a screen-reader user, I want focus to stay put at the first
    or last row and edge cell, so that hitting the edge tells me
    where I am instead of jumping to the other end.
12. As an RTL user, I want ←/→ to follow reading direction, so that
    → moves toward the end of the row in Hebrew or Arabic.

### Treegrid

13. As a keyboard user in a tree table, I want to focus a whole
    row, so that I can act on the row, not on one cell.
14. As a keyboard user on a collapsed row, I want → to expand it,
    so that I open children without reaching for the toggle.
15. As a keyboard user on an expanded or leaf row, I want → to
    enter its first cell, so that I can read the row's cells.
16. As a keyboard user on an expanded row, I want ← to collapse it,
    so that I can close a branch from the row itself.
17. As a keyboard user on a collapsed or leaf row, I want ← to move
    to its parent row, so that I can climb the tree.
18. As a keyboard user on the first cell, I want ← to go back to
    the row, so that I can return to row-level navigation.
19. As a keyboard user, I want Enter on an expandable row to toggle
    it, so that the most common action needs one key.
20. As a keyboard user, I want Enter on a leaf row to do nothing,
    so that Enter never triggers a hidden action.
21. As a screen-reader user, I want each tree row to announce its
    level and expanded state, so that I know where I am in the
    hierarchy.
22. As a screen-reader user, I want the toggle button hidden from
    me, so that I do not hear the expanded state twice.
23. As a mouse user, I want clicking the toggle to still expand the
    row and move keyboard focus to that row, so that mouse and
    keyboard stay in sync.
24. As a keyboard user in a tree table, I want Tab on a focused row
    to walk that row's buttons and then leave the grid, so that I
    can reach a row action without arrowing through every cell.

### Widgets inside cells

25. As a keyboard user, I want arrowing onto a cell with a single
    checkbox or button to focus that control directly, so that
    Space toggles it without an extra key.
26. As a keyboard user, I want a cell with a text input to be
    focused as a cell first, so that arrow keys keep navigating
    instead of moving the caret.
27. As a keyboard user, I want Enter or F2 to move into a cell's
    inputs, so that I can edit in place.
28. As a keyboard user, I want Esc inside a cell to return me to
    grid navigation, so that I can leave edit mode without the
    mouse.
29. As a keyboard user typing in an input, I want arrow keys to
    move the caret, never the grid, so that editing behaves like
    any other input.
30. As a consumer, I want my `(keydown.escape)` handler that calls
    `preventDefault()` to keep focus in the input, so that Esc can
    cancel an edit without also leaving the cell.
31. As a consumer, I want the grid to respect `preventDefault()` on
    any key, so that I can override one key without a config flag.
32. As a consumer, I want a filter input in a header cell to behave
    like any other text cell, so that I do not need a special case.
33. As a consumer, I want a grid nested in a detail panel to own
    its own keys, so that arrowing inside it never moves the outer
    grid.

### Header row

34. As a keyboard user, I want every header cell reachable with ←/→
    on the header row, so that columns stay aligned with the body.
35. As a keyboard user on a sortable header, I want focus on its
    sort button and Enter/Space to sort, so that sorting needs no
    extra Tab stop.
36. As a keyboard user in a tree table, I want ↑ from the first row
    to land on the first header cell, so that the header row (which
    has no row focus) is still reachable.

### Group headers and detail panels

37. As a keyboard user in a grouped table, I want arrow keys to
    stop on group header rows, so that a collapsed group (whose
    header is its only row) stays reachable.
38. As a keyboard user, I want ↓ from a group header back into data
    to restore my column, so that crossing a group does not reset
    me to the first column.
39. As a keyboard user in a grouped tree table, I want →/← on a
    group header to expand/collapse it, so that groups behave like
    tree rows.
40. As a keyboard user, I want ↓ from a row with an open detail
    panel to land on the panel, so that I meet the panel content
    in reading order.
41. As a keyboard user on a panel, I want Enter/F2 to go inside and
    Esc to close it and return to its toggle, so that the panel
    behaves like any multi-widget cell.
42. As a keyboard user in single-open mode with a panel open, I
    want the open panel to follow my focus to the next data row, so
    that I can step through details row by row.
43. As a keyboard user with no panel open, I want arrowing to open
    nothing, so that panels only appear when I ask for one.

### Focus recovery

44. As a keyboard user, when my focused row is deleted or filtered
    out, I want focus on the row now at its old position in the
    same column, so that I keep working where I was.
45. As a keyboard user, when the last row is deleted, I want focus
    on the new last row, so that focus never lands nowhere.
46. As a keyboard user, when the table becomes empty, I want focus
    on the first header cell (or the table itself without a
    header), so that focus is never lost to the page.
47. As a keyboard user, when a collapse hides my focused row, I
    want focus on the nearest visible ancestor row, so that I land
    on what hid my row and can → to reopen it.
48. As a keyboard user, when the table is re-sorted or a live
    update moves my row, I want focus to follow that row, so that
    the focused item never silently becomes a different row.
49. As a keyboard user, when my focused column is hidden, I want
    focus on the column now at its old position, so that I stay in
    the same row.
50. As a keyboard user, when columns are reordered, I want focus to
    follow my column, so that I stay on the same data.
51. As a user typing in a search box outside the table, I want the
    table's recovery never to steal my caret, so that filtering
    the table as I type keeps working.

### Programmatic focus and side panels

52. As a consumer, I want to read the focused position as data, so
    that a side panel outside the table can show the focused row.
53. As a consumer, I want to move the focused position after adding
    a row, so that the user lands on the new row.
54. As a consumer, I want that write to leave DOM focus alone by
    default, so that a write from an effect never steals focus.
55. As a consumer, I want an explicit `focusElement` option on the
    write, so that "add row, then focus it" works from a toolbar
    button.
56. As a consumer, I want the focused position to be null until the
    user or my code sets one, so that I can tell "never focused"
    from "focused row 0".

### Div grid, virtual scroll, feature plug-ins

57. As a consumer using the div-grid host, I want the same keys,
    roles and focus model as a native table, so that I can switch
    hosts without losing accessibility.
58. As a screen-reader user on a div grid, I want every row and
    cell to carry its row and column index, so that I hear my
    position even without native table semantics.
59. As a consumer of a future `withVirtualScroll()`, I want the
    focused row kept mounted while scrolled out of the window, so
    that DOM focus never drops to `<body>`.
60. As a keyboard user under virtual scroll, I want arrowing onto
    an unmounted row to scroll it in and focus it, so that
    navigation works across the whole data set.
61. As a feature author (selection, tree, expansion), I want to add
    my own keys by handling them on my directive and calling
    `preventDefault()`, so that I need no new navigation API.

## Implementation Decisions

### Modules

- **Engine core** gains one always-present core member,
  `focus`, claimed like the other core members (a feature
  declaring `focus` throws at construction, ADR-0007).
- **Engine recovery** keeps `focus()` valid when `renderRows()` or
  `renderColumns()` change. It remembers the previous render order
  — K9a needs the old position.
- **`ngpTable` directive** becomes the navigation owner: host role,
  one bubble-phase `keydown` listener, key map, roving tabindex,
  DOM `.focus()`.
- **`ngpTableRow`, `ngpTableCell`, `ngpTableHeaderCell`** register
  their elements as focus targets and bind `tabindex`. Cell role
  becomes `gridcell`.
- **`ngpTableTreeRow`** binds the row's `aria-level` and
  `aria-expanded`, and handles →/←/Enter on its own row (expand,
  collapse, toggle) by calling `preventDefault()`.
- **`ngpTableTreeToggle`** becomes pointer-only: `tabindex="-1"`,
  `aria-hidden="true"`, no `aria-expanded`. Click still toggles
  and moves focus to its row.
- **`ngpTablePanel`** registers an open panel as an arrow stop
  right after its row. Its existing Esc handling is unchanged.
- **`withExpansion()`** (single-open) follows `focus()` while a
  panel is open (K11). A store-level reaction, no DOM.

### Store contract — the focused position

Settled in this spec (K12b, K12c), from K12's sketch:

```ts
type FocusTarget =
  | { area: 'header'; columnId: ColumnId }
  | { area: 'body'; rowId: RowId; columnId: ColumnId | null }
  | { area: 'panel'; rowId: RowId };

table.focus(); // FocusTarget | null
table.focus.moveTo(target, { focusElement?: boolean });
table.focus.focusRequests(); // number
```

- `focusRequests()` goes up by 1 per accepted `focusElement: true`
  write; the grid directive reads it to move DOM focus (K15).

- `columnId: null` on a body target means row focus (treegrid) or
  the single full-width cell of a group header row (grid).
- `null` means nothing has been focused yet.
- `moveTo` only repoints the stored position and the `tabindex="0"`
  target. DOM focus moves only when focus is already inside the
  grid (K9d), or when `focusElement: true` is passed.
- A target naming an id that is not rendered is a runtime write;
  it degrades (ADR-0014): no move, one report. Never a throw.

### Role and ARIA

- Role computed once from the composed features: `treegrid` if
  `withTree()` is composed, else `grid`. Static read-only tables
  become `grid` too (browse-mode loss accepted, ADR-0030).
- `aria-rowindex`/`aria-colindex` always bound on div hosts
  (K10); `aria-rowcount` keeps coming from `totalRowCount()`.
- Attribute ownership under `treegrid` (K5c): tree row binds
  `aria-level`, `aria-expanded`; core row keeps `role`,
  `aria-rowindex`, `data-*`; the toggle binds none.

### Navigation order

- Built from `renderRows()` order and `renderColumns()` order —
  never DOM siblings (K13).
- Order: header row → each render row → its open panel (if
  mounted) → next render row.
- Group header rows are stops: one full-width cell in `grid`, a
  row with →/← in `treegrid` (K8a).
- ↓/↑ remember the last real column across group headers and
  panels and restore it on the next data row.
- Treegrid "← to parent" is computed from render order: the
  nearest earlier row with a smaller depth.

### Key handling

- One listener on the host, bubble phase. Skips any event with
  `defaultPrevented`, and any event from an editable target
  (input, textarea, select, contenteditable) while in navigation
  mode (K6a, K6b).
- Feature keys plug in through the same rule (K14b, derived from
  K6b): a feature directive handles its key on its own element
  and calls `preventDefault()`. No registration API. Tree →/←/
  Enter, panel Esc and future selection keys all use it.
- Page Up/Down step: visible row count from
  `withVirtualScroll()` when composed, else measured from the
  scroll container at keypress, fallback 10.
- RTL read from the host's computed `direction` at keypress.

### Widgets in cells (K6a)

- Auto-detected per cell: exactly one non-text widget → focus the
  widget; otherwise focus the cell, Enter/F2 enters, Esc exits.
- The grid keeps cell descendants at `tabindex="-1"` so the table
  stays one Tab stop. In treegrid row focus, Tab walks the focused
  row's widgets, then leaves.

### Recovery rules (engine)

| Change to the focused target         | Result                                                         |
| ------------------------------------ | -------------------------------------------------------------- |
| Row deleted from data / filtered out | Row now at old index, same column; clamp to last               |
| Row hidden by a collapsed ancestor   | Nearest visible ancestor row (row focus in treegrid)           |
| Row moved (sort, reorder, update)    | Same row id + column                                           |
| Table empty                          | First header cell; no header → `null` (directive focuses host) |
| Column hidden                        | Column now at old index, clamped                               |
| Column reordered                     | Same column id                                                 |
| Panel closed                         | Its row: first cell in `grid`, the row in `treegrid`           |

- A panel closed by its own Esc already returns DOM focus to its
  toggle (E49/E51); the store follows that `focusin` to the
  toggle's cell. The table rule above applies when focus was not
  inside the panel.

- "Filtered out" vs "collapsed": a row still in `rows()` but not
  in `renderRows()` was hidden by a render stage (collapse); a row
  gone from `rows()` was filtered or deleted.
- Recovery writes the store only. The directive applies K9d: DOM
  focus follows only if focus was inside the grid.

### Virtual scroll contract (not built here)

- `withVirtualScroll()` reads `focus()` and keeps the focused row
  rendered in addition to the window (K13b).
- Moving to an unrendered row: the directive asks virtual scroll
  to bring the index in, then focuses after render.
- This spec defines the contract only; `withVirtualScroll()` is
  `spec: drafted, code: none`.

### Docs owed

- ADR-0030 (accepted) — no change needed beyond K12b/K12c naming
  if the ADR cites the shape.
- `3-ui/directives/core.md`, `tree.md`, `expansion.md` (panel is
  an arrow stop, replaces "next Tab lands inside the panel"),
  `sort.md` (sort button as single-widget header cell).
- `1-state/features/virtual-scroll.md` — the focus contract above.
- `libs/table/CONTEXT.md` — `FocusTarget` term.

## Testing Decisions

- Test external behavior only: what the store reports, what has
  DOM focus, which element has `tabindex="0"`, which roles and
  ARIA attributes are present. Never internal registries.
- **Seam S1 — store.** `createTable(...)` with and without
  `withTree()`/`withGrouping()`/`withExpansion()`; assert
  `table.focus()` after `moveTo`, data writes, filter, sort,
  collapse, column visibility and reorder. Pure, no DOM. Prior
  art: `create-table.spec.ts`, `with-tree/feature.spec.ts`.
- **Seam S2 — directive host.** A TestBed host component renders
  `<table [ngpTable]>` (and a `div` host for parity), dispatches
  `KeyboardEvent`s, asserts `document.activeElement`, exactly one
  `tabindex="0"`, roles and ARIA. Tree, panel and widget-mode
  behavior is tested here, through the real directives. Prior
  art: `ngp-table-panel.directive.spec.ts`,
  `ngp-table-tree-toggle.directive.spec.ts`.
- No seam for the plug-in mechanism on its own — it is the DOM
  `preventDefault()` contract, exercised through the tree and
  panel directives in S2.
- Virtual-scroll behavior is not tested until `withVirtualScroll()`
  exists.

## Out of Scope

- Selection keys (Space, Shift+↑/↓, Ctrl+A) — `withSelection`'s
  own directive, plugged in later (K14).
- Building `withVirtualScroll()`; only its focus contract is
  defined.
- Building `ngpTableSort` or `ngpTablePanelToggle` (both
  `code: none`); this spec only says how they sit in navigation.
- Focus-ring styling — the consumer's (ADR-0026).
- Type-ahead (jump to a row by typing), multi-cell selection,
  copy/paste.
- A layout-grid wrap mode.

## Further Notes

- Supersedes tree-ui-layer D2's role half and D4's toggle
  `aria-expanded` (via ADR-0030, K5).
- Cost accepted: one core member on every table, including tables
  rendered without the directives (ADR-0029 bars opt-in).
- `/to-issues` slices core navigation (role, roving tabindex, key
  map, store member) before the tree, panel and recovery plug-ins
  (K0).
