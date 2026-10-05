# Step 3: `api/update-columns.ts` — the free functions

**PR scope:** `api/update-columns.ts` (new), `index.ts` export only.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Depends on:** Step 1, Step 2

## Files

- `libs/shared/design-system/src/ui/table/api/update-columns.ts` (new)
- `libs/shared/design-system/src/ui/table/index.ts` (edit — export)

## Why This Step Exists

This is issue #13's actual deliverable — the acceptance criteria's exported surface:
`updateColumns(table, updater)` plus `setColumns`/`reorderColumns`/`toggleColumnVisibility` as
updaters, mirroring D6/D12's `updateRows(table, updater)` shape. Everything in Steps 1–2 exists
only to give this step a writable `columns` signal to close over.

## What To Do

Create `api/update-columns.ts`:

```ts
import type { WritableSignal } from '@angular/core';
import { applyColumnOrder, resolveColumnDefs, toggleColumnVisible } from '../engine/columns';
import type { ColumnDef, ColumnDefInput, ColumnsUpdater } from './types';

/** The one general write: applies `updater` to the store's columns signal. */
export function updateColumns<TRow>(
  table: { columns: WritableSignal<ColumnDef<TRow>[]> },
  updater: ColumnsUpdater<TRow>,
): void {
  table.columns.update(updater);
}

/** Replaces the full column list, resolving sparse `ColumnDefInput`s to full `ColumnDef`s. */
export function setColumns<TRow>(defs: ColumnDefInput<TRow>[]): ColumnsUpdater<TRow> {
  return () => resolveColumnDefs(defs);
}

/** Rewrites column order from an id sequence. Ids absent from the list keep their current order. */
export function reorderColumns<TRow>(ids: string[]): ColumnsUpdater<TRow> {
  return (columns) => applyColumnOrder(columns, ids);
}

/** Flips one column's `visible` flag by id. Unknown id is a no-op. */
export function toggleColumnVisibility<TRow>(id: string): ColumnsUpdater<TRow> {
  return (columns) => toggleColumnVisible(columns, id);
}
```

- `updateColumns`'s parameter type is a minimal structural shape (`{ columns: WritableSignal<...> }`), not `TableStore<TRow>` — matches how a real `updateRows(table, ...)` would only need `data`, and lets `updateColumns` be called with `TableCore` (engine-internal, Step 4's caller) as well as the public `TableStore`, without an import cycle back to `api/types.ts`'s full `TableStore`.
- Export all four from `index.ts`, in the same block style as the existing `api/table-schema` export line.

## Implementation Notes

- All four helpers are pure re-exposures of existing `engine/columns.ts` logic (`resolveColumnDefs`, `applyColumnOrder`, `toggleColumnVisible`) — no new column-transform logic is written here, only the free-function/updater wrapping.
- File stays single — four tightly-coupled, small functions sharing one concern ("column mutation free functions"), consistent with `engine/columns.ts` itself being one file for its four pure transforms.

## Risks / Watchouts

- Don't reintroduce a `TableStore`-typed parameter on `updateColumns` — that would force `api/update-columns.ts` to import from `api/types.ts`, which already imports `engine/types.ts` in a deliberate one-directional-at-runtime cycle (see table `CLAUDE.md`, "`api/types.ts` ↔ `engine/types.ts` is a deliberate type-only import cycle"). The minimal structural type avoids adding a third file to that cycle.
- `setColumns` intentionally ignores the current columns (full replace) — don't "merge" with existing state, that changes acceptance-criteria semantics (`setColumns` = wholesale replacement, matching the pre-existing store method's behavior).

## Non-Goals

- Row mutation (`updateRows`, `addRow`, etc.) — issue #12, not in scope here.
- Updating `with-columns-schema` to call these — Step 4.

## Acceptance Checks

- `updateColumns`, `setColumns`, `reorderColumns`, `toggleColumnVisibility` all exported from `index.ts`.
- `setColumns`/`reorderColumns`/`toggleColumnVisibility` are pure functions returning a `ColumnsUpdater<TRow>`, callable and testable without a store.
- `updateColumns(table, setColumns(defs))` / `updateColumns(table, reorderColumns(ids))` / `updateColumns(table, toggleColumnVisibility(id))` all typecheck against a `{ columns: WritableSignal<ColumnDef<TRow>[]> }`.

---

← [Step 2: `api/types.ts`](step-2-api-types-writable-columns.plan.md) | [Step 4: `with-columns-schema` wiring update](step-4-columns-schema-wiring.plan.md) →
