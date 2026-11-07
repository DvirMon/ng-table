---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-row.directive.ts
  - libs/table/src/directives/focus-registry.ts
  - libs/table/src/directives/keyboard-nav.types.ts
  - libs/table/src/directives/ngp-table.treegrid.spec.ts (new)
---

# Step 1 — Treegrid role and row focus targets

Sets the host role to `treegrid` when `withTree()` is composed and makes a row a focus target with its own Tab stop.
Keys, tree-row ARIA, the toggle and the Tab walk are left to later steps.

Decisions: K1, K3, K5c, K27, K35

## Do

All source paths are under `libs/table/src/directives/`.

- In `ngp-table.directive.ts`, the host `role` is `'treegrid'` when the store has the `tree` member (`withTree()` composed), else `'grid'`. Read it from the current store, so a swapped `ngpTable` input follows. Never read it from row data.
- In `keyboard-nav.types.ts`, add `RowTarget = { area: 'body'; rowId; columnId: null }`. Widen the registry's cell type so it can hold a row. The registry key for a row has its own `row|` prefix, like `header|`, so a column id `'null'` cannot collide.
- In `ngp-table-row.directive.ts`, only under `treegrid`: register the row element as a row target and bind roving `tabindex` (`0` when it is the active target, else `-1`). In a grid the row registers nothing and binds no `tabindex`. Register must not run `markDescendants` on a row; the cells keep their own bindings.
- In `ngp-table.directive.ts`, the `activeTarget` default in a treegrid is the first data row with `columnId: null`. The grid default is unchanged.
- In `followFocusIn`, focus landing on a row writes `{ area: 'body', rowId, columnId: null }`. Focus on a cell inside the row still writes the cell.
- Own the DOM-focus sync for row targets: the sync effect and `focusCellElement` resolve a body target with `columnId: null` to the row element (`toGridCell` drops it today), so `focusElement: true` and focus-within moves land on the row.
- Group rows and panels stay out.

## Watch out

- The core row keeps `role`, `aria-rowindex` and `data-*`.
- `focusin` bubbles cell, row, host. Do not add a per-row `focusin` listener.
- One Tab stop in total: the row or one cell, never both.

## Out of scope

- Key map ([step 2](./step-2-treegrid-key-map.plan.md)).
- Tree-row ARIA and keys ([step 3](./step-3-tree-row-aria-keys.plan.md)).
- Toggle ([step 4](./step-4-pointer-only-toggle.plan.md)).
- Tab walk ([step 5](./step-5-row-tab-walk.plan.md)).
- Group header and panel stops (#240, #241).

## Done when

- The approved test plan [step-1-treegrid-role-row-focus.test-plan.md](./step-1-treegrid-role-row-focus.test-plan.md) passes.
- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
