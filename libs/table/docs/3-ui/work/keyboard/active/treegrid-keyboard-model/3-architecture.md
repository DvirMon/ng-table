# Architecture — table-wide keyboard model (#196, #201)

Consumed by `/to-tasks`. Grounded against `main` at `dacb6d44`.
Settled decisions: `1-decisions.md` K0–K14 (+ K12b, K12c, K14b),
ADR-0030. Not open for relitigation here.

## Current source (what exists today)

| File                                                        | Today                                                                                                      | Changes                                                                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/compose-table.ts`                               | `createBaseStore()` builds core members; `onRowsRemoved` effect diffs `indexById` keys                     | add `focus` to the base store; add the recovery effect                                                                                       |
| `src/engine/slots.ts`                                       | `CORE_MEMBER_KEYS` = columns, rows, trackBy, value, renderRows, renderColumns, indexById, `__columnValues` | add `'focus'`                                                                                                                                |
| `src/engine/core.ts`                                        | `rows` (pipeline), `renderRows` (render stages), `indexById`                                               | none; recovery reads these                                                                                                                   |
| `src/engine/writable-view.ts`                               | `WritableView<T, Updater>` = callable + `.update()`                                                        | not used — `focus` is callable + `.moveTo()`, same shape as `table.expansion` / `table.tree`                                                 |
| `src/api/types.ts`                                          | `TableStore<TRow, TValues>`                                                                                | add `focus: TableFocus<…>`; export `FocusTarget`                                                                                             |
| `src/directives/ngp-table.directive.ts`                     | `role: 'table'`, `aria-rowcount`, `aria-colcount`; provides `NGP_TABLE_STORE`, `NGP_TABLE_PANEL_REGISTRY`  | role computed; `(keydown)` + `(focusin)` host listeners; provides focus registry                                                             |
| `src/directives/ngp-table-row.directive.ts`                 | `role: 'row'`, `aria-rowindex`, `data-*`                                                                   | register row element as body target (`columnId: null`); `tabindex`                                                                           |
| `src/directives/ngp-table-cell.directive.ts`                | `role: 'cell'`, input = 0-based column index                                                               | `role: 'gridcell'`; inject `NGP_TABLE_ROW` for row id; column id from `renderColumns()[index].id`; register; `tabindex`                      |
| `src/directives/ngp-table-header-cell.directive.ts`         | `role: 'columnheader'`, input = column index                                                               | register header target; `tabindex`                                                                                                           |
| `src/directives/ngp-table-tree-row.directive.ts`            | `data-context-row`, `data-expandable`, `data-expanded`                                                     | add `aria-level`, `aria-expanded` (treegrid); `(keydown)` →/←/Enter with `preventDefault()`                                                  |
| `src/directives/ngp-table-tree-toggle.directive.ts`         | extends `NgpTableCollapsibleTrigger` (binds `aria-expanded`); leaf → disabled + `aria-hidden`              | stop binding `aria-expanded`; `tabindex="-1"`, `aria-hidden="true"` always; click also moves focus to the row                                |
| `src/directives/ngp-table-collapsible-trigger.directive.ts` | shared base: `type`, `(click)`, `aria-expanded`, `data-expanded`                                           | split `aria-expanded` out so the tree toggle can drop it while `ngpTablePanelToggle` keeps it (coordinate with #209 shared collapsible core) |
| `src/directives/ngp-table-panel.directive.ts`               | `inert` when closed, Esc → `close()` + `returnFocus` to toggle                                             | register as panel target when open                                                                                                           |
| `src/directives/panel-registry.ts`                          | per-table row id → panel/toggle elements                                                                   | read by navigation to know which panels are mounted                                                                                          |
| `src/api/features/with-expansion.ts`                        | single-open state                                                                                          | `setup` effect: follow `focus()` while a panel is open (K11)                                                                                 |

Not present today: `ngpTableSort` (`3-ui/directives/sort.md`,
`code: none`), `ngpTablePanelToggle` (`expansion.md`, `code: none`),
any selection directive, `withVirtualScroll()` (`code: none`), any
header-row directive (core.md: header `<tr>` carries no
`ngpTableRow`). No `@angular/cdk` dependency.

## Types

```ts
// src/api/types.ts
export type FocusTarget<TCol extends string = string> =
  | { readonly area: 'header'; readonly columnId: TCol }
  | { readonly area: 'body'; readonly rowId: RowId; readonly columnId: TCol | null }
  | { readonly area: 'panel'; readonly rowId: RowId };

export interface FocusMoveOptions {
  /** Also move DOM focus, even when focus is outside the grid. */
  readonly focusElement?: boolean;
}

export interface TableFocus<TCol extends string = string> {
  (): FocusTarget<TCol> | null;
  moveTo(target: FocusTarget<TCol>, options?: FocusMoveOptions): void;
}

// TableStore gains:
readonly focus: TableFocus<ColumnIdIn<TValues>>;
```

`focusElement` is a request the store cannot fulfil (no DOM). The
store records it as a one-shot flag next to the position; the
`ngpTable` directive consumes it on its next sync. Shape of that
internal channel is an implementation detail (open question 1).

## Engine: recovery

One `effect()` in `composeTable`, created unconditionally (unlike
`onRowsRemoved`, which only exists when a feature declares it).
Holds the previous `renderRows()` id order and previous
`renderColumns()` id order in closure variables, seeded before the
effect exists (same trick as `previousIds`).

On each run, if `focus()` is a body/panel target:

1. Row id still in `renderRows()` → keep (K9c, moved rows follow).
2. Row id in `rows()` but not in `renderRows()` → hidden by a
   render stage: walk the previous order backwards from the old
   index to the nearest row with smaller `depth` still rendered
   (K9b). Group headers count as ancestors.
3. Otherwise (deleted, filtered, regrouped header gone) → the row
   now at the old index, clamped to the last (K9a).
4. No rows → first header column (`renderColumns()[0]`) or `null`.

Column half, independently: column id still in `renderColumns()`
→ keep (K9e reorder); else column at old index, clamped.

Panel target whose row is no longer in `expansion()` → body target
for the row (`columnId` = first column in grid, `null` in treegrid).
The engine tells them apart the same way the role does:
`treegrid` ⇔ `withTree()` composed ⇔ the `tree` member exists.

Recovery is pure logic → `src/engine/focus.ts` (pure, no signals,
spec'd in S1 through `createTable`); the effect in
`compose-table.ts` only wires it.

## Directives: navigation

- **Focus registry** (`src/directives/focus-registry.ts`, sibling
  of `panel-registry.ts`): per-table map target-key → element,
  provided by `ngpTable`. Row, cell, header-cell and panel
  directives register in an `effect()` and unregister on destroy
  (same lifecycle as `registerRowElement`).
- **Tabindex:** each registered element binds
  `tabindex = isActive() ? 0 : -1`, `isActive` computed from
  `focus()` (or the K3 first-entry default when `focus()` is null).
- **Key map:** pure function `nextTarget(order, current, key,
{ rtl, pageSize, isTreegrid })` in
  `src/directives/keyboard-nav.ts` (or `.utils.ts`). Order is built
  from `renderRows()`, `renderColumns()` and the panel registry.
- **Host listener** in `ngpTable`: skip `defaultPrevented`; skip
  editable targets in navigation mode; compute next; `moveTo`;
  `.focus()` the registered element (or its single widget, K6a);
  `preventDefault()` handled keys.
- **`focusin`** on host: map the event target to its registered
  ancestor and write the store (covers click K3b, panel Esc return,
  Tab into a widget).
- **Sync effect** in `ngpTable`: when `focus()` changes and focus is
  inside the host (or the `focusElement` flag is set), `.focus()`
  the target after render (`afterNextRender`).

## File layout for implementation

| File                                                                                              | New/changed                                            | Owner step (suggested) |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| `src/api/types.ts`                                                                                | `FocusTarget`, `TableFocus`, store member              | store                  |
| `src/engine/slots.ts`                                                                             | `'focus'` core key                                     | store                  |
| `src/engine/focus.ts` (+ `.spec.ts`)                                                              | pure recovery                                          | store                  |
| `src/engine/compose-table.ts`                                                                     | base member + recovery effect                          | store                  |
| `src/directives/focus-registry.ts`                                                                | new                                                    | core nav               |
| `src/directives/keyboard-nav.ts`                                                                  | new, pure key map                                      | core nav               |
| `src/directives/ngp-table.directive.ts`                                                           | role, listeners, sync                                  | core nav               |
| `src/directives/ngp-table-{row,cell,header-cell}.directive.ts`                                    | register + tabindex + roles                            | core nav               |
| `src/directives/ngp-table-tree-row.directive.ts`                                                  | ARIA + keys                                            | tree plug-in           |
| `src/directives/ngp-table-tree-toggle.directive.ts`, `ngp-table-collapsible-trigger.directive.ts` | pointer-only                                           | tree plug-in           |
| `src/directives/ngp-table-panel.directive.ts`                                                     | panel target                                           | panel plug-in          |
| `src/api/features/with-expansion.ts`                                                              | follow focus (K11)                                     | panel plug-in          |
| `src/index.ts`                                                                                    | export `FocusTarget`, `TableFocus`, `FocusMoveOptions` | store                  |

## Open questions (for `/to-tasks`, not for the spec)

1. Internal channel for the `focusElement` one-shot flag: a
   non-exported store symbol vs a plain signal the directive reads.
2. Keeping cell descendants at `tabindex="-1"` (K6a): a
   `MutationObserver` per cell vs a sweep on `focusin`/`focusout`
   of the cell. Edit mode swaps inputs in and out, so a one-time
   sweep is not enough.
3. Div-grid header row has no directive to carry `role="row"`
   (core.md: header `<tr>` has no `ngpTableRow`). Native `<tr>` is
   fine; the div host needs either consumer markup or a small
   header-row directive.
4. Interaction with #209 (shared collapsible core): the
   `aria-expanded` split in `NgpTableCollapsibleTrigger` must land
   in whichever shape #209 settles.
5. Whether `keyboard-nav.ts` lives in `directives/` or `engine/` —
   it is pure, but only the view layer calls it.
