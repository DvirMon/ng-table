---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/keyboard-nav.ts
  - libs/table/src/directives/keyboard-nav.types.ts
  - libs/table/src/directives/keyboard-nav.grid.spec.ts (new)
---

# Step 1 — Key map: header row, paging, RTL (pure)

Adds `nextGridTarget`, a pure function that also reaches the header row, pages by rows and swaps ←/→ under RTL.
Wiring it to the table is left to step 4.

Decisions: K4, K4b, K7, K22, K39

## Do

In `keyboard-nav.types.ts` add local types:

```ts
export type HeaderCell = { readonly area: 'header'; readonly columnId: string };
export type GridBodyCell = { readonly area: 'body' } & BodyCell;
export type GridCell = HeaderCell | GridBodyCell;
export type GridNavOptions = { readonly isRtl: boolean; readonly pageSize: number };
```

In `keyboard-nav.ts` add a pure function. No Angular, no signals. Do not edit `nextBodyTarget` or `keyboard-nav.spec.ts`.

```ts
function nextGridTarget(
  order: NavOrder,
  current: GridCell,
  event: NavKey,
  options: GridNavOptions,
): GridCell | null;
```

Body cell current:

- Under `isRtl`, swap ArrowLeft and ArrowRight, then delegate to `nextBodyTarget`. Tag the result `area: 'body'`.
- ArrowUp from the first row: the header cell of the same column.
- PageUp / PageDown: move `pageSize` rows in the same column, clamped to the first and last body row. Never into the header.
- Ctrl/Cmd + Home: the first header cell.
- Everything else: delegate.

Header cell current:

- ArrowLeft / ArrowRight: previous / next header cell (swapped under `isRtl`). No wrap.
- ArrowDown: the first body row, same column. No body rows: stay.
- ArrowUp: stay.
- Home / End: first / last header cell.
- Ctrl/Cmd + Home: first header cell.
- Ctrl/Cmd + End: last cell of the last body row. No body rows: last header cell.
- PageUp / PageDown: handled, stay.

Return `null` for an unhandled key, Ctrl/Cmd + Arrow, Alt/Shift combinations, and a current cell or column that is not in the order.

## Watch out

An edge returns the position, not `null`. The caller calls `preventDefault()` only on a non-null result.

`pageSize` is at least 1; the caller measures it (step 2).

## Out of scope

- Measuring the page step and reading direction (step 2).
- Registering header cells and DOM focus (steps 3 and 4).
- Treegrid row focus (#239), group headers (#240).
- A table with no header row: step 4 does not move when no header cell is registered.

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `keyboard-nav.grid.spec.ts` passes; `keyboard-nav.spec.ts` is unchanged.
