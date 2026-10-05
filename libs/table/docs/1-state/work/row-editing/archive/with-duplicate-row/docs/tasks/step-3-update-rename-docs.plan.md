---
title: 'Step 3: Update rename docs'
---

← [Step 2: Fix `beginEdit` no-op invariant comment](step-2-fix-beginedit-invariant-doc.plan.md) | [Step 4: Add Duplicate action to gated-edit story](step-4-add-duplicate-action-story.plan.md) →

# Step 3: Update rename docs

**PR scope:** Parallel-safe with: Step 1, Step 2, Step 4.

**Task type:** docs

**Skills used:** none (main thread)

**Scaffolding agent:** none — main thread

**Files:**

- `libs/shared/table/docs/1-state/row-mutations.md`
- `libs/shared/table/docs/1-state/architecture.md`

## Why This Step Exists

Both are permanent, living specs (per this library's `CLAUDE.md` docs table — edited in place as
code changes, unlike the episodic `docs/1-state/work/**` folders). They document `addRow` by name
and must reflect Step 1's rename so the spec stays the contract.

## What To Do

In `row-mutations.md`:

- Line ~20: `` `addRow`, `removeRow`, `patchRow` `` → `` `insertRow`, `removeRow`, `patchRow` ``
- Line ~59: `table.value.update(addRow(newRow, { at: 0 }));` → `insertRow(...)`
- Line ~88: the updater table row for `` `addRow` `` → `` `insertRow` ``
- Line ~95: `` `addRow({ at: 0 })` is the add-blank-row flow `` → `insertRow(...)`
- Line ~99: `` `addRow(row, { at })` behaves exactly as `Array.prototype.splice(at, 0, row)` `` →
  `insertRow(...)`
- Line ~146: the blank-row example call → `insertRow(...)`

In `architecture.md`:

- Line ~45: `` `addRow` / `removeRow` / `patchRow` `` → `` `insertRow` / `removeRow` / `patchRow` ``
- Line ~47: `` it falls out as `addRow({ ...row, id: newId() })` `` → `insertRow(...)`

## Implementation Notes

- Prose only — do not restructure either doc. This is a find-and-rename pass, same discipline as
  Step 1's code rename.
- Line numbers above are as of this design doc's date (2026-08-27); re-locate by content if the
  file has drifted.

## Risks / Watchouts

- Don't touch episodic work-folder docs that historically record `addRow` as a past decision
  (e.g. `docs/1-state/work/row-editing/archive/with-mutations/2-decisions.md`, `with-row-editing/5-gaps.md`) — those
  are records of what was true when written, not living specs, and rewriting them would falsify
  history.

## Non-Goals

- No change to `docs/0-product/row-editing.md` (already updated separately, per current git
  status — out of this workspace's scope).

## Acceptance Checks

- `grep -n "addRow" libs/shared/table/docs/1-state/row-mutations.md libs/shared/table/docs/1-state/architecture.md`
  returns nothing.

---

← [Step 2: Fix `beginEdit` no-op invariant comment](step-2-fix-beginedit-invariant-doc.plan.md) | [Step 4: Add Duplicate action to gated-edit story](step-4-add-duplicate-action-story.plan.md) →
