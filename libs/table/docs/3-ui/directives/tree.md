---
title: UI Layer — Tree (ngpTableTreeRow, ngpTableTreeToggle)
type: architecture
version: 0.1
date: 2026-09-30
capability: tree
spec: drilled
code: shipped
audience: developers
---

# UI Layer — Tree (`ngpTableTreeRow`, `ngpTableTreeToggle`)

**State-layer contract: [`1-state/features/tree.md`](../../1-state/features/tree.md).
Decision history: [`decisions/tree.md`](../../decisions/tree.md).**

Two primitive directives: state goes out as `data-*` hooks, no
stylesheet ships, no library text. `withTree()` owns the open set;
these directives reflect it and toggle it.

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>
  <td>
    <button ngpTableTreeToggle [attr.aria-label]="'Children of ' + row.data.name">▸</button>
    {{ row.data.name }}
  </td>
</tr>
```

With `withTree()` composed the host is `role="treegrid"`. Rows and
cells are both keyboard stops. The row carries `aria-level` and
`aria-expanded`; the toggle button carries neither (TR51).

## `ngpTableTreeRow`

Selector: `tr[ngpTableRow][ngpTableTreeRow]`,
`div[ngpTableRow][ngpTableTreeRow]`. Reads the row from
`NGP_TABLE_ROW`; no inputs.

ARIA, set on the row:

| Attribute       | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| `aria-level`    | `depth + 1`, on every tree row                                        |
| `aria-expanded` | `"true"` / `"false"` on an expandable row; absent on a leaf row       |

Presence-only hooks (ADR-0026 rule 1) — `""` when true, absent
otherwise:

| Attribute          | From                                                   | Meaning                                                         |
| ------------------ | ------------------------------------------------------ | --------------------------------------------------------------- |
| `data-expandable`  | `RenderRow.hasChildren` (overridden by `isExpandable`) | the row can open — a lazy parent with no loaded children counts |
| `data-expanded`    | `RenderRow.isExpanded`                                 | the row is open                                                 |
| `data-context-row` | `RenderRow.isContextRow`                               | the row is kept only as an ancestor of a filter match           |

Named `data-expandable`, not `data-has-children`: the hook names
what CSS keys on, not the field.

### Keyboard

Row focus is part of the treegrid arrow order; the full map is in
[`core.md`](core.md#grid-navigation). The directive handles three
keys, only when the row element itself is the event target. Keys from
a cell or widget inside the row are left alone. Each handled key calls
`preventDefault()`, so core navigation skips it.

| Key     | Collapsed expandable row | Expanded row                                   | Leaf row                           |
| ------- | ------------------------ | ---------------------------------------------- | ---------------------------------- |
| →       | expands                  | enters the row's first cell (core)             | enters the row's first cell (core) |
| ←       | goes to the parent (core) | collapses                                      | goes to the parent (core)          |
| `Enter` | expands                  | collapses                                      | nothing                            |

- A top-level row has no parent, so ← on it stays put.
- The parent is the nearest earlier row with a smaller `depth`.
- Under `dir="rtl"` → and ← swap: ← expands, → collapses.
- Tab on a focused row walks the operable widgets in its cells, then
  leaves the grid (see [`core.md`](core.md#widgets-in-cells)).

## `ngpTableTreeToggle`

Selector: `button[ngpTableTreeToggle]` only. Pointer-only: a click
toggles, and there are no keyboard handlers, no host-type branching
and no nesting guard. The button is always `type="button"`, even over
a template `type`.

- **Identity.** Row from the ancestor row directive's token
  (`NGP_TABLE_ROW`), table from the table directive's token
  (`NGP_TABLE_STORE`). No inputs.
- **Activation.** A click calls `table.tree.toggle(row.id)`, then
  moves the table's focus to that row and focuses the row element. It
  never calls `preventDefault()` or `stopPropagation()`, so other
  row listeners still receive the click.
- **Out of the keyboard and screen-reader path.** Always
  `tabindex="-1"` and `aria-hidden="true"`. It has no `aria-expanded`;
  the row owns that state. `data-expanded` follows the row's
  `isExpanded`.
- **Non-expandable row.** The toggle also sets `disabled` and
  presence `data-disabled`. It stays in the DOM so its width is kept
  and leaf labels align with parent labels. Hiding it visually is
  consumer CSS; the consumer may also `@if` it away.
- **Accessible name.** Consumer-owned — the library ships no text.
  Name it with `aria-label`, `aria-labelledby` or text content.
- **No `ngpTableTreeRow` needed.** The toggle reads its row from
  `NGP_TABLE_ROW` and works without the tree-row directive on the
  `<tr>`.

## Attribute ownership

No attribute is bound by two directives on one element:

| Directive                      | Element | Binds                                                                                          |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------- |
| `ngpTableRow`                  | row     | `role`, `data-row-kind`, `data-depth`, `aria-rowindex`, `--ngp-table-row-depth`                |
| `ngpTableTreeRow`              | row     | `aria-level`, `aria-expanded`, `data-expandable`, `data-expanded`, `data-context-row`          |
| Shared trigger core (internal) | button  | `type`, `data-expanded`                                                                        |
| `ngpTableTreeToggle`           | button  | `tabindex`, `aria-hidden`, `disabled`, `data-disabled`                                         |

## Toggle-only is the default

The button is the pointer trigger. A `<tr>` host is not supported for
the toggle directive. The keyboard trigger is the focused row itself
(→, ←, `Enter`).

### Whole-row click

A whole-row mouse trigger is consumer markup — a `(click)` on the
`<tr>`:

```html
<tr [ngpTableRow]="row" ngpTableTreeRow (click)="table.tree.toggle(row.id)">
  <td>
    <button ngpTableTreeToggle [attr.aria-label]="'Children of ' + row.data.name">▸</button>
    {{ row.data.name }}
  </td>
</tr>
```

The button's click bubbles to the row, so a click on it toggles
twice and ends where it started — skip it in the row handler (for
example, ignore events whose target is inside the button).

## Group headers

Collapsible grouping (`withGrouping()` + `withTree()`) uses the same
pair. A group collapses through `table.tree.toggle(groupId)`, and
flattening stamps `hasChildren` / `isExpanded` on group rows, so both
directives work on group headers unchanged:

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>
  <td>
    <button ngpTableTreeToggle [attr.aria-label]="'Group ' + row.groupKey">▸</button>
    {{ row.groupKey }}
  </td>
</tr>
```

## Styling recipe

No stylesheet ships. The styling surface is the hooks above plus
core's `--ngp-table-row-depth`. `--ngp-table-row-depth` is bound by
core `ngpTableRow` from the row's `depth` (#182) and inherits into
cells and buttons.

```css
/* Indent the toggle itself off the inherited depth. */
[ngpTableTreeToggle] {
  margin-inline-start: calc(var(--ngp-table-row-depth, 0) * 1.25rem);
  transition: rotate 150ms ease;
}

/* Rotate the chevron when open. */
[ngpTableTreeToggle][data-expanded] {
  rotate: 90deg;
}

/* Keep a leaf toggle's width so labels align. */
[ngpTableTreeToggle][data-disabled] {
  visibility: hidden;
}

/* Dim ancestors kept only for a filter match. */
[ngpTableTreeRow][data-context-row] {
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  [ngpTableTreeToggle] {
    transition: none;
  }
}
```

## Dev checks

All run under `ngDevMode` only and are stripped in production.

- **Missing `withTree()`** — a wiring error (ADR-0014). On first
  render, a toggle on a table with no `tree` member throws, naming
  `ngpTableTreeToggle` and `withTree()`. In production the toggle is
  inert.

A missing `ngpTableTreeRow` on the `<tr>` is not an error.

## Out of scope

- Group-header and detail-panel stops in the arrow order.
- A shipped stylesheet or default look.
- Library-provided toggle text.
- A per-row "loading children" affordance for lazy parents —
  open in [`1-state/features/tree.md`](../../1-state/features/tree.md).
- Detail panels — see [`expansion.md`](expansion.md).
