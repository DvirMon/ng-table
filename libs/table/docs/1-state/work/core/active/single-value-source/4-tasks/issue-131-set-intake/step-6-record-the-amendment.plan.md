# Step 6 — Record the amendment

**PR scope:** standalone. **Depends on:** Step 5.

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md`
  (edit — next free R-number after R13)
- `libs/table/docs/1-state/work/core/active/single-value-source/issue-graph.md`
  (edit — #131 and #139 rows)
- GitHub issues #131 and #139 (body edits)

## Why This Step Exists

The user ruled on 2026-09-24 that `columnsSchema` is removed
in #131, not #139. That amends spec D11's sequencing and the
slice boundaries in the issue graph. Without a record, #139
still lists a deletion that already happened, and the next
reader will re-plan it.

## What To Do

1. **`decisions.md`**: one row, same shape as R10-R13:
   - **Ruling:** `columnsSchema` removed from `createTable`
     in #131. A column set is the only schema intake. The
     array intake stays, rule-free, until #139.
   - **Why:** user ruling. There's no in-repo caller
     worth a window (3 specs, moved in Step 3), and it
     leaves one source of rules during migration.
   - **Amends:** D11's sequencing only (the end state is
     unchanged), plus the #131/#139 split.
   - **Also records:** Step 1's chosen `TableConfig` shape,
     and Step 2's generator outcome (constraint diff, or none).
   - **Probe result:** Step 5 case 15 (row-type mismatch).
2. **`issue-graph.md`**: retitle #131's row if its wording
   still says "beside the array" only. Narrow #139's row to
   "delete the array intake".
3. **#131 body**: replace the AC
   "The separate column-schema config property still works…"
   with "`columnsSchema` is removed; a set is the only schema
   intake". Show the diff to the user before running
   `gh issue edit`.
4. **#139 body**: drop the `columnsSchema` half of its
   title and ACs. Same: show first, then edit.

## Non-Goals

- No prose docs, ADR-0019 amendment or `llms.txt` regenerate.
  The ~20 files naming `columnsSchema` are #141's.
- No archiving.

## Acceptance Checks

- [ ] One new R-row in `decisions.md` covering all four
      points above.
- [ ] `issue-graph.md` rows for #131 and #139 match.
- [ ] #131 and #139 bodies updated, after user sign-off.

---
← [Step 5: Carriage proofs](step-5-carriage-proofs.plan.md)
