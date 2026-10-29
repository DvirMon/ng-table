---
step: 3
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/focus-registry.ts
  - libs/table/src/directives/ngp-table-header-cell.directive.ts
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/focus-registry.spec.ts (new)
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 3 — Header cells as focus targets

Registers header cells as focus targets with a roving `tabindex`, and writes a header focus to the store.
Moving focus with keys is left to step 4.

Decisions: K3, K7, K12b, K23, K39, K41

## Do

`focus-registry.ts`: the registry takes header cells as well as body cells. Their keys stay distinct, so header `name` and body cell `(1, 'name')` never overwrite each other. `cellContaining` returns either. Use `HeaderCell` from `keyboard-nav.types.ts` (step 1); until step 1 lands, declare the same shape there.

`ngpTableHeaderCell`:

- Inject `NGP_TABLE_STORE` (required, as the body cell does) and `NGP_TABLE_FOCUS_REGISTRY` (optional).
- Column id is `renderColumns()[ngpTableHeaderCell()].id`.
- Register the element in an effect; the cleanup also runs on destroy.
- Bind `[attr.tabindex]`: `0` when `activeTarget()` is `{ area: 'header', columnId }` for this column, else `-1`.

`ngpTable` `followFocusIn`: focus inside a registered header cell (the cell itself or a widget in it) writes `{ area: 'header', columnId }` with `moveTo`. Skip the write when that header is already the target. `activeTarget` does not change: the first-entry default stays the first data row.

## Watch out

The "already active" check must compare `area` too. A body cell and a header cell share column ids.

Read the column through `renderColumns()`, not `columns()`. A hidden column shifts every index.

Add new `describe` blocks and host components in `ngp-table.directive.spec.ts`; do not edit existing tests.

The stale spec `libs/table/docs/3-ui/directives/ngp-table-header-cell.directive.spec.ts` is outside `src/` and never compiled. Leave it.

## Out of scope

- Keys, paging, RTL and DOM focus on header cells (step 4).
- Widgets inside header cells: the sort button and the filter input (step 6, after #237).
- Treegrid (#239), group headers (#240).

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `focus-registry.spec.ts` and `ngp-table.directive.spec.ts` pass.
