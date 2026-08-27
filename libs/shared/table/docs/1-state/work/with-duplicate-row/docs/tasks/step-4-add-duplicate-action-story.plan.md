---
title: "Step 4: Add Duplicate action to gated-edit story"
---

← [Step 3: Update rename docs](step-3-update-rename-docs.plan.md) |

# Step 4: Add Duplicate action to gated-edit story

**PR scope:** Parallel-safe with: Step 1, Step 2, Step 3.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Files:**
- `libs/shared/table/src/stories/gated-edit/gated-edit-story-host.component.ts`
- `libs/shared/table/src/stories/gated-edit/gated-edit-story-host.component.html`

## Why This Step Exists

`1-design.md` §"Story this owes": `gated-edit/` gains a Duplicate action — the first
demonstration of it anywhere. It shows the copy landing directly under its source and Cancel
removing it, since that pairing is what distinguishes duplicate from add. Mechanically it's
`beginEdit` with `{ insert }` (already shipped, D42) — no new library API, per the design doc's
finding that gated-mode duplicate needs nothing new.

## What To Do

1. In `gated-edit-story-host.component.ts`, add a `protected duplicateRow(sourceId: RowId): void`
   method modeled on the design doc's snippet:
   ```ts
   protected duplicateRow(sourceId: RowId): void {
     const source = this.data().find((row) => this.table.trackBy(row) === sourceId);
     if (source === undefined) return;

     const at = this.data().indexOf(source) + 1;
     const id = crypto.randomUUID();
     this.table.editing.update(
       beginEdit(id, { insert: { ...source, id }, at }),
     );
   }
   ```
   Use `crypto.randomUUID()` for the new id, matching `addBlankRow()`'s existing convention in
   this same file (the design doc's `newId` is a design-doc placeholder, not a real symbol in this
   codebase).
2. In `gated-edit-story-host.component.html`, add a "Duplicate" button next to the existing "Edit"
   button in the row-not-editing branch (the `@else` block under the existing per-row `actions`
   cell), wired to `(click)="duplicateRow(row.id)"`.

## Implementation Notes

- `source.id` must exist on `EditRow` already (it's spread into the copy) — confirm the field
  name against `row-edit.types.ts` before wiring the template.
- The copy opens immediately (gated mode), so no extra state is needed to show it as editable —
  `table.editing().has(row.id)` already drives the `isEditing` branch for any open row.
- Cancel: per the design doc's recommendation, do **not** wire a special Cancel path for
  duplicated rows. The existing `cancelEdit` (→ `revertEdit`, resets to snapshot) and
  `discardEdit` (→ removes the row) buttons already cover both outcomes generically — the design
  doc's recommended default for a *consumer* choosing one policy is `discardEdit`, but this story
  already exposes both buttons per row, so no new wiring is needed here.

## Risks / Watchouts

- Under an active sort, the copy will not visually land directly under its source (storage-order
  insert vs. display-order sort) — this is the design doc's known, accepted limitation (ties to
  OQ-3's row-hold, not in scope here). Don't try to work around it in this step.
- This story host has no sorting composed currently — verify that's still true before assuming
  the limitation is unreachable in this specific demo.

## Non-Goals

- No new library API (`insertEdit` was explicitly rejected in the design doc).
- No row-hold-under-sort behavior (OQ-3, separate future work).
- No `.stories.ts`/`.mdx` changes — the story definition doesn't need new args; only the host
  component and its template change.

## Acceptance Checks

- Storybook: `gated-edit-single` and `gated-edit-multiple` stories show a "Duplicate" button per
  non-editing row.
- Clicking Duplicate opens a new row directly below its source with the source's values copied
  and a fresh id.
- Cancel (`cancelEdit`) on the duplicated row resets it to the inserted values; Discard
  (`discardEdit`) removes it entirely.
- `npx nx typecheck shared-table` passes.

---
← [Step 3: Update rename docs](step-3-update-rename-docs.plan.md) |
