# Step 1: `engine/core.ts` + `engine/types.ts` — expose `columns` as writable, drop mutation methods

**PR scope:** `engine/core.ts`, `engine/types.ts` only.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/engine/core.ts` (edit)
- `libs/shared/design-system/src/ui/table/engine/types.ts` (edit)

## Why This Step Exists

Issue #13 / D12: column mutation moves off `TableCore` and becomes free functions, mirroring
`data`'s write-through model from #11/D11. That requires `TableCore.columns` to be the actual
writable signal (not `.asReadonly()`), the same way `TableEngineConfig.data` is already the
consumer's raw `WritableSignal`. This step is the engine-layer half of that change; `api/types.ts`
(the public-facing mirror) is Step 2.

## What To Do

- `engine/core.ts` `createTableCore()`:
  - Drop `.asReadonly()` on the `columns` signal — `core.columns` is now the `WritableSignal<ColumnDef<TRow>[]>` itself.
  - Delete the four methods from the returned `core` object: `setColumns`, `updateColumns`, `reorderColumns`, `toggleColumnVisibility`.
  - The `resolveColumnDefs`, `applyColumnOrder`, `toggleColumnVisible` imports from `./columns` are no longer used here — remove them (they move to Step 3's free-function file, which imports directly from `engine/columns.ts`).
- `engine/types.ts` `TableCore<TRow>` interface:
  - Change `readonly columns: Signal<ColumnDef<TRow>[]>` to `readonly columns: WritableSignal<ColumnDef<TRow>[]>` (import `WritableSignal` from `@angular/core`).
  - Delete `setColumns`, `updateColumns`, `reorderColumns`, `toggleColumnVisibility` from the interface.
  - `ColumnsUpdater` import from `../api/types` is no longer referenced here — remove it if nothing else in the file uses it.

## Implementation Notes

- This mirrors `TableEngineConfig.data: TableDataInput<TRow>` (already `WritableSignal`, per #11) — `columns` becomes the second writable signal on `TableCore`, same shape, same rationale (D8: a consumer/feature can always bypass a wrapper method, so don't pretend there's a boundary).
- `engine/compose-table.ts`'s `Object.assign({ ...handle.core, renderRows: handle.renderRows }, composed)` needs no change — it spreads whatever `core.columns` is, writable or not.
- Repo convention note (table `CLAUDE.md`, "No private store members"): this is why the fix is "expose the real writable signal," not a hidden/symbol-based write channel.

## Risks / Watchouts

- `engine/columns.spec.ts` and `engine/compose-table.spec.ts` may reference `core.columns` as read-only or call the now-deleted methods — check and update in this step if they break (test-only fixes, not a scope violation; don't defer to Step 7/8 if it blocks compilation here).
- Don't touch `api/types.ts` in this step — that's Step 2, kept separate so each PR is independently reviewable.

## Non-Goals

- The free functions (`updateColumns`, `setColumns`, `reorderColumns`, `toggleColumnVisibility` as updaters) — Step 3.
- Any caller updates (`with-columns-schema`, demo, mock) — Steps 4–6.

## Acceptance Checks

- `TableCore.columns` is `WritableSignal<ColumnDef<TRow>[]>`.
- `TableCore` has no `setColumns`/`updateColumns`/`reorderColumns`/`toggleColumnVisibility`.
- `createTableCore()` no longer defines those four methods.
- Typecheck passes for `engine/` in isolation (downstream breakage in `api/`/`directives/` is expected until later steps land).

---
[Step 2: `api/types.ts` — public `TableStore` mirrors the writable-columns change](step-2-api-types-writable-columns.plan.md) →
