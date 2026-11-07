---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/directives/keyboard-nav.ts
  - libs/table/src/directives/keyboard-nav.types.ts
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/keyboard-nav.tree.spec.ts (new)
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 2 — Treegrid key map

Adds `nextTreegridTarget`, a pure key map for row focus, and wires it to the table when the role is `treegrid`.
Expand, collapse and Enter are left to the tree row.

Decisions: K4, K4b, K5, K13, K39

## Do

All source paths are under `libs/table/src/directives/`.

In `keyboard-nav.types.ts` add local types. `RowTarget` comes from [step 1](./step-1-treegrid-role-row-focus.plan.md).

```ts
export type TreegridNavOrder = NavOrder & { readonly rowDepths: readonly number[] };
export type TreegridTarget = GridCell | RowTarget;
```

`rowDepths` has the same index as `rowIds`.

In `keyboard-nav.ts` add a pure function beside `nextGridTarget`. Grid specs stay untouched.

```ts
function nextTreegridTarget(
  order: TreegridNavOrder,
  current: TreegridTarget,
  event: NavKey,
  options: GridNavOptions,
): TreegridTarget | null;
```

Row focus (current is a row target):

- ↑ / ↓: the adjacent row. Clamped, no wrap.
- Home / End and Ctrl+Home / Ctrl+End: the first / last row.
- PageUp / PageDown: `pageSize` rows, clamped.
- →: the row's first cell.
- ←: the parent, the nearest earlier row with a smaller depth. A top-level row stays.
- ↑ on the first row: the first header cell.

Other current targets:

- ↓ on a header cell: the first row (row focus).
- ← on the first cell of a row: its row.
- Every other cell key behaves exactly as in grid.

Under RTL, ← and → swap for every row and cell move.
Alt / Shift combinations, Ctrl+Arrow, Enter, Tab and Space return `null`.

In the `ngpTable` keydown handler, when the role is `treegrid`:

- Build the order from the `renderRows()` data rows (`kind !== 'group'`), with `rowDepths` from `row.depth`.
- Call `nextTreegridTarget`, then `moveTo`, and `preventDefault` on a non-null result.

Grid tables keep `nextGridTarget`.

## Watch out

- → on a collapsed expandable row and ← on an expanded row are handled by the tree row ([step 3](./step-3-tree-row-aria-keys.plan.md)) with `preventDefault`, so the host skips them. This map still returns the cell or parent move for the keys the row leaves alone.
- Never return non-null for Tab or Enter.

## Out of scope

- Expand, collapse and Enter (step 3).
- Group rows and panels.

## Done when

- The approved test plan [step-2-treegrid-key-map.test-plan.md](./step-2-treegrid-key-map.test-plan.md) passes.
- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
