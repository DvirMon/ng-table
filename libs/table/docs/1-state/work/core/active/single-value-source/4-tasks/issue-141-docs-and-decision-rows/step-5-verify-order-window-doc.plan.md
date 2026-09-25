# Step 5 — Check #140's order-window doc

**PR scope:** standalone. **Depends on:** #140 closed (external).
**Parallel-safe with:** Step 1, Step 2, Step 3, Step 4, Step 6

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- Whatever consumer doc #140 wrote the window into. Find it
  with `gh issue view 140 --comments` and `git log --grep
  "#140"`. Likely `docs/1-state/columns.md` or
  `docs/1-state/row-mutations.md`.
- Only if missing: the same doc, edited here.

## Why This Step Exists

#141 acceptance item 3, reshaped by R16. #140 owns writing the
order window. #141 checks that it landed and says what #140
required.

## What To Do

1. Find #140's paragraph. It must say all of these:
   - Until #128 lands, calling `setColumns()` to re-declare
     columns **resets to declaration order**. The user's
     dragged order is lost.
   - The interim spelling: re-apply the reorder verb
     (`reorderColumns(ids)`) with the id list the app already
     owns, **immediately after** the write.
   - It is consumer-facing (a `docs/1-state` or
     `docs/2-columns` page), not only in the work folder.
2. **All present:** no edit. Record "verified" in
   `progress.md`'s Notes, with the file path.
3. **Missing or incomplete (user ruling, 2026-09-25: flag, then
   write):**
   1. Comment on #140 naming the gap. The record must show
      #140 shipped without it.
   2. Write the missing parts here, in the doc #140 should have
      used. Show a snippet of the write followed by the
      re-apply.

## Implementation Notes

- One paragraph, one place. If #140's text exists but is thin,
  extend it in place. Never write a second version elsewhere
  (R16's drift concern).

## Non-Goals

- #128's reciprocal obligation to record the window it closes.
  That is #128's.

## Acceptance Checks

- [ ] A consumer-facing doc states the reset and the
      re-apply spelling.
- [ ] If #141 had to write it, #140 carries a comment saying
      so.

---
← [Step 4: CLAUDE.md invariants](step-4-claude-md-invariants.plan.md) | [Step 6: Columns decisions log](step-6-columns-decisions-log.plan.md) →
