---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/keyboard-nav.ts (new)
  - libs/table/src/directives/keyboard-nav.types.ts (new)
  - libs/table/src/directives/keyboard-nav.spec.ts (new)
---

# Step 1 — Key map, pure

Adds `nextBodyTarget`, a pure function from a key press to the next body cell.
Wiring it to the table, roles and DOM focus are left to steps 2 and 3.

Decisions: K4, K13, K21, K22

## Do

Add `keyboard-nav.types.ts`. `RowId` comes from `../api/types` via `import type`.

```ts
export type NavOrder = {
  readonly rowIds: readonly RowId[];
  readonly columnIds: readonly string[];
};
export type BodyCell = { readonly rowId: RowId; readonly columnId: string };
export type NavKey = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey?: boolean;
};
```

Add `keyboard-nav.ts` with a pure function. No Angular, no signals.

```ts
function nextBodyTarget(order: NavOrder, current: BodyCell, event: NavKey): BodyCell | null;
```

Keys:

- ArrowLeft / ArrowRight: previous / next cell in the row.
- ArrowUp / ArrowDown: previous / next row, same column.
- Home / End: first / last cell of the row.
- Ctrl+Home / Ctrl+End: first cell of the first row, last cell of the last row.
- `metaKey` counts as Ctrl (Cmd on macOS).

Edges: return the same position. The key is handled, nothing wraps.

Return `null` for:

- an unhandled key;
- Ctrl/Cmd + Arrow;
- a current row or column that is not in the order.

The caller (step 3) builds the order from `renderRows()` (non-group rows) and `renderColumns()`.

## Watch out

An edge returns the position, not `null`. The caller calls `preventDefault()` only on a non-null result.

## Out of scope

- Page Up / Page Down, RTL, header row (#236).
- Treegrid row focus (#239).
- Group headers (#240).
- Recovery of a lost position (#233).

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `keyboard-nav.spec.ts` passes.
