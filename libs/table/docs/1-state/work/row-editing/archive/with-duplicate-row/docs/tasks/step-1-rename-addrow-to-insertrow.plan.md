---
title: "Step 1: Rename `addRow` → `insertRow`"
---

← | [Step 2: Fix `beginEdit` no-op invariant comment](step-2-fix-beginedit-invariant-doc.plan.md) →

# Step 1: Rename `addRow` → `insertRow`

**PR scope:** Breaking rename of a public export. Parallel-safe with: Step 3. (Step 2 depends
on this step — same file, sequenced to avoid overlapping edits.)

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Files:**
- `libs/shared/table/src/api/row-mutations.ts` — rename the exported function
- `libs/shared/table/src/api/optimistic-mutations.ts` — update import + call site (`revertEdit`'s
  re-insert path)
- `libs/shared/table/src/api/row-edit-mutations.ts` — update import + call site (`beginEdit`'s
  `{ insert }` branch) + the doc comment on line 45 ("Inserting lives on the editing slice, not
  beside `addRow`" → `insertRow`)
- `libs/shared/table/src/index.ts` — update the public export
- `libs/shared/table/src/api/types.ts` — update the one doc-comment reference (`table.value.update(addRow(...))`)
- `libs/shared/table/src/api/create-table.ts` — update the one doc-comment reference
- `libs/shared/table/src/stories/live-table/live-table-story-host.component.ts` — update import
  (the component's own `addRow()` method keeps its name; only the imported free function is
  renamed)
- `libs/shared/table/src/api/row-mutations.spec.ts` — rename the `describe('addRow', ...)` block
  and all call sites to `insertRow`
- `libs/shared/table/src/api/row-edit-mutations.spec.ts` — update the one comment reference
  ("honours `addRow` the way..." → `insertRow`)

## Why This Step Exists

`docs/1-state/work/row-editing/archive/with-duplicate-row/1-design.md` decided the verb should be named `insertRow`:
it uses `Array.prototype.splice(at, 0, row)` semantics, which `row-mutations.md` already
distinguishes from `at()` — "insert" names that; "add" doesn't. It also reads correctly for the
duplicate flow (an insertion at a position, not an addition to a set). Taken now because D46's
`ABSENT` removal is already a breaking change to this cycle's surface, so the two migrate
together at no extra cost.

## What To Do

1. In `row-mutations.ts`, rename `export function addRow<TRow>(...)` to `insertRow`. Keep the
   signature, options (`{ at?: number }`), and body identical — pure rename, no behavior change.
2. Update every import and call site listed above from `addRow` to `insertRow`.
3. Update the doc comments listed above that name `addRow` in prose (not just code).
4. Rename the `describe('addRow', ...)` block in `row-mutations.spec.ts` to `describe('insertRow', ...)`
   and update every `addRow<...>(` call inside it to `insertRow<...>(`.

## Implementation Notes

- This is a mechanical rename — resist the urge to touch logic while in these files. If a diff
  in this step changes behavior, that's a scope leak; revert it.
- `optimistic-mutations.ts` imports `addRow` only to call it once, inside `revertEdit`'s re-insert
  path (`: addRow<TRow>(value, { at: snapshot.at })(...)`) — easy to miss since it's on one line
  with a trailing comment (`// gone — put it back`).
- Do not touch `form-write-mutations-story-host.component.ts`/`.html` — its `addRowViaForm()`
  method name is unrelated (it never calls the free function `addRow`).

## Risks / Watchouts

- Grep for the bare string `addRow` after editing to confirm no stray reference survives outside
  this step's intentionally-excluded files (episodic work docs like `with-mutations/2-decisions.md`
  are historical records of past decisions and should NOT be edited to match the new name).
- `docs/1-state/row-mutations.md` and `docs/1-state/architecture.md` are **not** in this step's
  file list — they're handled by Step 3, which can run in parallel.

## Non-Goals

- No change to `insertRow`'s signature, splice semantics, or clamping behavior.
- No change to `docs/1-state/row-mutations.md` / `architecture.md` (Step 3).
- No change to the `beginEdit` no-op comment block (Step 2).

## Acceptance Checks

- `grep -rn "\baddRow\b" libs/shared/table/src` returns nothing.
- `npx nx test shared-table` (or repo's equivalent unit-test target) passes.
- `npx nx typecheck shared-table` (or build) passes — confirms every call site was updated.

---
← | [Step 2: Fix `beginEdit` no-op invariant comment](step-2-fix-beginedit-invariant-doc.plan.md) →
