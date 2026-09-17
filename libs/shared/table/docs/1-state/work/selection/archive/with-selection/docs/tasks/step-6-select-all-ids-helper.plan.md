---
title: "Step 6 — selectAllIds() helper (D59)"
type: task-step
issue: 64
---

# Step 6 — `selectAllIds()` helper (D59)

**PR scope:** Core step — Step 7 (test) depends on this. Parallel-safe with Step 8 (docs).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/selection.utils.ts` (new)
- `libs/shared/table/src/index.ts` (edit)

## Why This Step Exists

D59 (`2-decisions.md`) settles that "select all currently-visible rows" vs. "select every row
regardless of filter" ships as a standalone helper, never a `withSelection()` config or method —
formalizing the ergonomics D1 left to the call site. This step is the implementation of that
decision; nothing here is a new design choice.

## What To Do

1. Create `selection.utils.ts` as a sibling to `with-selection.ts` (D59's own proposed home) —
   plain function, no DI/injection context, no dependency on `withSelection()` or
   `withFiltering()`:
   ```ts
   import type { RowId, TableStore } from '../types';

   export function selectAllIds<TRow>(
     table: Pick<TableStore<TRow>, 'rows' | 'value' | 'trackBy'>,
     opts?: { includeHidden?: boolean }
   ): RowId[] {
     const rows = opts?.includeHidden ? table.value() : table.rows();
     return rows.map(table.trackBy);
   }
   ```
   Confirm the actual import path/name for `TableStore`/`RowId` against `api/types.ts` before
   writing the import — don't guess the specifier.
2. Export `selectAllIds` from `src/index.ts`, grouped near the other `api/features/*` exports
   (no new type export needed — the function's own generic signature is the full public surface).

## Implementation Notes

- `opts?.includeHidden` is a boolean, default `false` (visible/matching only) — not a `scope`
  string union (D59, per `general-mechanism-over-enumerated-cases`: exactly two datasets exist at
  the core level, permanently — a third would need a third core-level dataset that doesn't
  exist).
- Reads only `TableStore.rows` / `value` / `trackBy` — no import of, or dependency on,
  `withFiltering()`, `withSelection()`, or any feature module. This is what keeps D1's "no
  runtime or compile-time dependency on `withPagination()`/`withFiltering()`" intact.
- Returns `RowId[]`, suitable to pass directly to both `select(ids)` and `deselect(ids)` — no
  `SelectionMembers` change.

## Risks / Watchouts

- Don't add this as a `withSelection()` method or config field — D59 explicitly rejects
  `selectAll(scope: 'visible' | 'all')` as a new `SelectionMembers` method.
- Don't reach for `table.renderRows()` or any pagination/grouping-aware dataset — page- or
  group-scoped select-all is explicitly out of scope (D59), a future fresh id array built by the
  caller, not a third branch here.

## Non-Goals

- Page-scoped select-all (blocked on pagination — out of scope per the issue).
- The read-side "are all currently-visible rows already selected" signal — routed to
  `docs/1-state/work/computed-state-mechanism/1-intake.md` as a `withSelection()`-owned computed
  member.
- Any UI directive/checkbox binding — state layer only.

## Acceptance Checks

- [ ] `selectAllIds<TRow>(table, opts?)` added, reading only `TableStore.rows`/`value`/`trackBy`.
- [ ] `opts?.includeHidden` boolean, default `false`.
- [ ] Returns `RowId[]`.
- [ ] File placed at `api/features/selection.utils.ts`, plain function, no DI/injection context.
- [ ] Exported from `src/index.ts`.
- [ ] `tsc --noEmit` passes for the file.

---
← [Step 5: 3-spec.md: enableRowSelection() config + scope rules](step-5-spec-doc-update.plan.md) | [Step 7: selectAllIds() unit tests](step-7-select-all-ids-tests.plan.md) →
