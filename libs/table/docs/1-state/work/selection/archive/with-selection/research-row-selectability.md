---
title: Research — how other libraries make a row non-selectable
type: research
status: complete
date: 2026-09-09
audience: developers
issue: 57
---

# How other libraries make a row non-selectable

Run for [#23](https://github.com/DvirMon/ng-table/issues/23). `withSelection()` has no concept of a
row that cannot be selected at all — `enableMultiRowSelection` restricts _co-selection_ only, and
D8 makes every write verb respond regardless of whether the id is data-backed. Its sibling doc
[research-selection-change-events.md](research-selection-change-events.md) was scoped to the
`selectionChanged` payload and does not cover this.

Every claim below was read from published package sources (versions pinned per row), not from
memory. Tarballs pulled with `npm pack` and read from `dist`/`src`; CDK read from the installed
`node_modules/@angular/cdk`.

## Findings

| Library                      | Version read                                                                | Where the gate lives                                                                                                                                 | Shape                                         |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Angular CDK `SelectionModel` | `@angular/cdk` 22.1.2 (installed, `types/_selection-model-chunk.d.ts`)      | **nowhere** — no `disabled`/`selectable`/`canSelect` member exists                                                                                   | pure id/value set, no gate                    |
| Angular CDK listbox          | `@angular/cdk` 22.1.2 (`fesm2022/listbox.mjs`)                              | the **view**: `CdkOption.disabled` (`[cdkOptionDisabled]`)                                                                                           | per-option input, inherits `listbox.disabled` |
| TanStack Table v8            | `@tanstack/table-core@8.21.3` (`src/features/RowSelection.ts`)              | **config predicate**: `enableRowSelection?: boolean \| ((row) => boolean)`, read via `row.getCanSelect()`                                            | table option + row getter                     |
| TanStack Table v9            | `@tanstack/table-core@9.2.4` (`dist/features/row-selection/*`)              | same option, now free functions (`row_getCanSelect`)                                                                                                 | unchanged shape, documented asymmetry         |
| Material React Table         | `material-react-table@3.2.1` (`dist/index.d.ts`, `dist/index.js`)           | pass-through to TanStack `enableRowSelection`; renders `disabled={!row.getCanSelect()}`                                                              | no own gate, view convention only             |
| AG Grid                      | `ag-grid-community@36.1.0` (`dist/types`, `dist/package/main.esm.mjs`)      | **stamped row field**: `rowNode.selectable: boolean`, recomputed from `rowSelection.isRowSelectable(node)`                                           | callback → per-node state + event             |
| PrimeNG                      | `primeng@22.1.1` (`types/primeng-table.d.ts`, `fesm2022/primeng-table.mjs`) | **two gates**: table input `rowSelectable: (row: { data, index }) => boolean` _and_ per-checkbox `disabled` registering into `disabledSelectionKeys` | config predicate + view registration          |

## Reading

### 1. Nobody models "non-selectable" as a state field on the selection set

Four of the five table libraries express it as a **predicate over the row**, evaluated on demand —
never as an extra state slice next to the selected ids. AG Grid is the one that materializes it
(`rowNode.selectable`), and it does so because it already owns a mutable node object per row; the
predicate is still the source of truth, `updateSelectable()` just recomputes the stamp on data and
filter changes.

The one library whose job is _only_ selection state — CDK's `SelectionModel`, the closest analogue
to our state layer — has **no gate at all**. Same posture as D8. In CDK the concept exists one
layer up, on the view: `CdkOption.disabled`.

### 2. The gate is asymmetric everywhere — it blocks select, never deselect

Consistent across every implementation read, and TanStack v9 states it in its own doc comment:

> Ancestor ids are removed even when the ancestor itself cannot be selected. Like the other
> targeted deselection paths, pruning is not gated by `enableRowSelection`; only the bulk
> select-all paths preserve non-selectable rows.
> — `rowSelectionFeature.types.d.ts`, `ToggleSelectedOptions.deselectParents`

In code:

```js
// tanstack v8 src/features/RowSelection.ts — mutateRowIsSelected
if (value) {
  if (!row.getCanMultiSelect()) {
    /* clear others */
  }
  if (row.getCanSelect()) {
    selectedRowIds[id] = true;
  } // gated
} else {
  delete selectedRowIds[id]; // ungated
}
```

PrimeNG does the same at the row-click path — `if (!selected && !this.isRowSelectable(rowData, rowIndex))`
(`primeng-table.mjs:2179`): the check is reached only when the row is _not_ already selected.

Rationale is the obvious one: a row that became non-selectable while selected must still be
escapable. A symmetric gate would strand it.

### 3. The gate is on the _write path_, not the _read path_

TanStack's `isRowSelected` is a plain record lookup — a non-selectable id sitting in state still
reads as selected:

```js
// tanstack v9 rowSelectionFeature.utils.js
function isRowSelected(row, rowSelection) {
  return !!(hasOwn(rowSelection, row.id) && rowSelection[row.id]);
}
```

`row_getCanSelect` is consulted by the mutators, the select-all paths, and the _checkbox_, but
never by "is this selected". Selection state stays a plain set; selectability is a separate
question asked at the moment of writing.

### 4. Only AG Grid auto-deselects when a row _becomes_ non-selectable

```js
// ag-grid-community dist/package/main.esm.mjs:57270 — setRowSelectable
if (rowNode.selectable !== newVal) {
  rowNode.selectable = newVal;
  rowNode.dispatchRowEvent('selectableChanged');
  ...
  if (rowNode.isSelected() && !rowNode.selectable) {
    this.setNodesSelected({ nodes: [rowNode], newValue: false, source: 'selectableChanged' });
  }
}
```

That is why `'selectableChanged'` appears in the 16-value `SelectionEventSourceType` enum already
recorded in the sibling research doc — it is a selection change the _grid_ caused, so it needs a
source to be distinguishable from a user click. The other libraries evaluate the predicate lazily
and never reconcile, so a selected-then-disabled row simply stays selected until something else
writes.

Direct bearing on us: adopting AG Grid's reconcile behavior would mean the library prunes ids the
user did not deselect, which is the thing D8 deliberately refuses (and which our `selectionChanged`
delta has no `source` field to explain).

### 5. Bulk select-all is where the semantics actually get decided

Every library special-cases it, and they disagree:

- **TanStack v8/v9** — select-all skips non-selectable rows; deselect-all deletes only selectable
  rows' ids, deliberately _preserving_ a non-selectable row's existing entry
  (`if (row_getCanSelect(row)) delete rowSelection[row.id]`).
- **PrimeNG** — header checkbox filters the candidate list through both gates before writing
  (`selection.filter((rowData, index) => isSelectable(rowData, index))`), where `isSelectable`
  combines the `rowSelectable` predicate _and_ `isRowCheckboxDisabled`.
- **AG Grid** — `selectAll` mode and `isRowSelectable` are separate options; non-selectable nodes
  are excluded by the node stamp.

Our D1 (the feature never picks a denominator; `selectionStateOf(ids)` takes the id set) means we
do not own this path at all — the caller passes the ids. So the tri-state question becomes: does
`selectionStateOf(ids)` count a non-selectable id in its denominator? Nobody's answer transfers,
because nobody else pushed the denominator to the caller.

### 6. The UI convention is unanimous: render a disabled control, do not hide it

- MRT: `disabled: isLoading || (row && !row.getCanSelect())` on the select checkbox
  (`dist/index.js:1322`) — always rendered.
- AG Grid: renders a disabled checkbox by default; hiding it is opt-in via
  `rowSelection.hideDisabledCheckboxes` (`@default false`).
- PrimeNG: `p-tableCheckbox` takes `disabled` and registers the row key into the table's
  `disabledSelectionKeys` on init, cleaning up on destroy (`primeng-table.mjs:5630`).
- CDK listbox: `aria-disabled` host binding, option stays in the DOM, and it stays keyboard
  **focusable** unless `cdkListboxNavigateDisabledOptions` is off — the skip is a configurable
  `skipPredicate`, not a removal.

CDK's is the a11y-correct baseline: `aria-disabled` rather than removal or `disabled`, so a screen
reader user can still reach and read the row.

## Bearing on `withSelection()`

- **A predicate is the shape with precedent**, and it is the same shape `enableMultiRowSelection`
  already has in `WithSelectionConfig<TRow>` (`boolean | ((row: TRow) => boolean)`). TanStack, MRT,
  AG Grid and PrimeNG all name it some variant of `enableRowSelection` / `isRowSelectable` /
  `rowSelectable`. Adding it costs no new _kind_ of API surface — only one more field.
- **It collides with D8 head-on, and the collision is real, not cosmetic.** D8's rationale — "a
  checkbox must respond to a click, always; an id absent from `indexById()` defaults permissive" —
  is exactly the rule a selectability gate must break, because the whole point is a click that does
  not respond. The two are not the same rule, though: D8 is about _unresolvable_ ids, a
  selectability predicate is about _resolvable rows that answer false_. A gate could keep D8 intact
  for unresolvable ids (no row to test → permissive, as `applyMultiSelectRule` already does) and
  block only rows that resolve and fail — which is precisely TanStack's default-`true` fallback.
- **The asymmetry is settled by precedent** — gate `toggle`/`select`, never `deselect`/
  `clearSelection`. Matches how `applyMultiSelectRule` is already scoped in `with-selection.ts`
  ("never to deselect/clear, which can't violate single-select").
- **No reconcile.** AG Grid is alone in auto-deselecting, and it pays for it with an event `source`
  enum we do not have. D8's "selection stays a pure id set with no data-backed invariant" survives
  a write-path gate untouched; it would not survive a reconcile.
- **The view half is separable and may be the whole answer.** CDK models it purely on the view
  (`CdkOption.disabled`), and per D6 our directive story already lets a consumer host a row-scoped
  directive injecting `NGP_TABLE_ROW` + `NGP_TABLE_STORE`. A consumer can render a disabled
  checkbox today with zero library API — what they cannot do is stop a _different_ write path
  (a row-click directive, a range select, a caller's `select([...])`) from adding the id.

## Open questions

Q1–Q3 were **answered by D58** ([2-decisions.md](2-decisions.md), 2026-09-09) after the write
surface was enumerated. Q4–Q6 remain.

1. ~~Does the gate belong at all, or is a disabled checkbox in consumer markup sufficient?~~
   **D58: it ships.** The write surface is `toggle` + `select` + the `initialSelection` seed, and
   only the click path runs through consumer markup — `select(ids)` and the D1 header directive
   take id arrays assembled at the call site, so a consumer-side gate would have to be re-applied
   per call site and kept in step with the checkbox's own `disabled`.
2. ~~If it ships, is it `enableRowSelection?: boolean | ((row: TRow) => boolean)`?~~ **D58: yes** —
   next to `enableMultiRowSelection`, same shape, permissive when the id resolves to no row, so D8
   holds for unresolvable ids.
3. ~~Does `initialSelection` pass through the gate?~~ **D58: yes**, and it is a no-op whenever the
   seed lands before the rows do (no row to test → permissive). That is the intended reading of
   D8's restore-path extension, not an accident.
4. **Does `selectionStateOf(ids)` exclude non-selectable ids from its denominator?** Under D1 the
   caller supplies the id set, so the caller could pre-filter. No library precedent transfers.
5. **Does a blocked write need to be distinguishable from a no-op?** A blocked `toggle` changes
   nothing, so it emits no `selectionChanged`. Note the asymmetry with `applyMultiSelectRule`,
   which _throws_ in dev mode when its rule is violated.
6. **Is `withExpansion()` the same question?** Expansion cites D8 for stale restored ids
   ([expansion.md](../../../../features/expansion.md)). "Non-expandable row" is the same shape, and the
   two should not diverge.

## Not researched

- ARIA guidance for `aria-disabled` on a `role="row"` inside `role="grid"` (as opposed to
  `role="option"`, which CDK listbox covers). Worth a WCAG/APG pass before any view-layer decision.
- Whether any library gates selection per _cell_/column rather than per row.
