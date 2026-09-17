# Step 2 — Row updaters and `updateRows`

**PR scope:** Independent, deployable on its own (depends on Step 1 for `TableCore.data`).
**Task type:** code
**Stack:** angular
**Skills used:** angular-developer
**Scaffolding agent:** angular-implementer

**Depends on: Step 1**

## Files

- `libs/shared/design-system/src/ui/table/api/types.ts`
- `libs/shared/design-system/src/ui/table/api/row-mutations.ts` (new)
- `libs/shared/design-system/src/ui/table/index.ts`

## Why This Step Exists

Implements issue #12 (D6/D12/D19/D27 in `../../2-decisions.md`): the write path for row
mutations is a single generic free function, `updateRows(table, updater)`, plus exactly three
shipped updaters — `addRow`, `removeRow`, `patchRow`. No mutation method goes on the store
(D12); `data` gains no `update()`/`patch()` member.

## What To Do

1. `api/types.ts` — add the updater type:

   ```ts
   /**
    * Pure row transform. `ctx.trackBy` is supplied by `updateRows` so id-based updaters
    * (`removeRow`, `patchRow`) can resolve identity without needing a store reference
    * themselves — this is what keeps them tree-shakeable and unit-testable standalone (D6).
    * The raw-lambda form `rows => rows.filter(...)` satisfies this type too; it just ignores
    * `ctx`.
    */
   export type RowUpdater<TRow> = (
     rows: TRow[],
     ctx: { trackBy: TrackByFn<TRow> }
   ) => TRow[];
   ```

2. `api/row-mutations.ts` (new file) — mirrors `api/column-rules.ts`'s shape (free functions,
   no class):

   ```ts
   import type { TableStore } from './types';
   import type { TableCore } from '../engine/types';
   import type { RowId, RowUpdater } from './types';

   /** D27: `at` is `Array.prototype.splice(at, 0, row)` semantics. Never throws — an
    * out-of-range or stale `at` clamps instead of crashing. */
   function clampSpliceIndex(at: number | undefined, length: number): number {
     if (at === undefined) return length;
     const resolved = at < 0 ? length + at : at;
     return Math.min(Math.max(resolved, 0), length);
   }

   export function addRow<TRow>(row: TRow, opts?: { at?: number }): RowUpdater<TRow> {
     return (rows) => {
       const next = rows.slice();
       next.splice(clampSpliceIndex(opts?.at, next.length), 0, row);
       return next;
     };
   }

   export function removeRow<TRow>(id: RowId): RowUpdater<TRow> {
     return (rows, { trackBy }) => rows.filter((row) => trackBy(row) !== id);
   }

   export function patchRow<TRow>(id: RowId, partial: Partial<TRow>): RowUpdater<TRow> {
     return (rows, { trackBy }) =>
       rows.map((row) => (trackBy(row) === id ? { ...row, ...partial } : row));
   }

   /** Free function, store first — mirrors `patchState(store, updater)` (D6). Writes through
    * to the consumer's `WritableSignal` (D3/D4); the store gains no write method of its own. */
   export function updateRows<TRow>(
     table: TableStore<TRow>,
     updater: RowUpdater<TRow>
   ): void {
     const { data, trackBy } = table as TableStore<TRow> & Pick<TableCore<TRow>, 'data'>;
     data.update((rows) => updater(rows, { trackBy }));
   }
   ```

   Adjust the internal cast if Step 1 named the field differently — it must read `TableCore<TRow>.data`
   as added in Step 1.

3. `index.ts` — add exports:

   ```ts
   export { updateRows, addRow, removeRow, patchRow } from './api/row-mutations';
   export type { RowUpdater } from './api/types';
   ```

## Implementation Notes

- Do not add a `moveRow`, `compose(...)`, or plural (`removeRows`/`patchRows`) — all three are
  explicitly deferred by D19, with no v1 caller.
- `patchRow`'s `Partial<TRow>` merge is a shallow `{ ...row, ...partial }` — no deep-merge, no
  special-casing nested objects.
- `removeRow`/`patchRow` compare `trackBy(row) !== id` / `=== id` directly; `RowId` is
  `string | number`, so no coercion needed.

## Risks / Watchouts

- The cast in `updateRows` is the one intentionally unsound line in this step (public
  `TableStore<TRow>` doesn't declare `data`) — keep it contained to this one function, not
  spread across call sites.
- `addRow`'s splice math: verify against D27's worked examples before considering this done —
  `[1,2,3]` with `at: -1` → `[1,2,X,3]`; `at: 999` and `at: -999` clamp to append/prepend.

## Non-Goals

- Column mutation free functions (`updateColumns`, etc.) — issue #13.
- `withRowEdit()`, `beginEdit`/`endEdit`/`updateEditing` — separate, later work per D16/D17.
- Temp-id generation — D26 is explicit the library never fabricates one; `addRow` takes
  whatever `row` the consumer passes, id included.

## Acceptance Checks

- [ ] `updateRows(table, updater)` exported, writes through to the consumer's `data` signal
- [ ] `addRow`, `removeRow`, `patchRow` exported, tree-shakeable and unit-testable without a store
- [ ] Id-based updaters (`removeRow`, `patchRow`) resolve identity via `ctx.trackBy`
- [ ] No mutation methods added to `TableCore`/`TableStore`
- [ ] `nx typecheck shared-design-system` passes

---
← [Step 1: Expose data on TableCore for write-back](step-1-expose-data-on-core.plan.md) | [Step 3: Unit tests for row mutations](step-3-row-mutations-tests.plan.md) →
