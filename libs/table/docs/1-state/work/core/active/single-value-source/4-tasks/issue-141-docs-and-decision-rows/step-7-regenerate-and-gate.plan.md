# Step 7 — Regenerate `llms.txt` and run the gates

**PR scope:** closes #141. **Depends on:** Step 1, Step 2,
Step 3, Step 4, Step 5, Step 6.
**Parallel-safe with:** —

**Task type:** chore

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `llms.txt` (**generated**)

## Why This Step Exists

#141 acceptance items 9 and 10. `llms.txt` is generated from
every `CONTEXT.md`'s frontmatter plus `AGENT.md`, and Step 1
edits `libs/table/CONTEXT.md`. The typecheck is the tree-wide
gate.

## What To Do

1. `npm run llms`, then `npm run llms:check`, which must be
   clean.
2. `nx run shared-table:typecheck`. If it reports `.ts` errors,
   fix them, then **run it again**. `ngc` aborts before the
   template phase, so only a source-clean second run says
   anything about the story hosts.
3. Final sweep across the whole repo, outside history:
   ```bash
   rg -n "\bapply(Visible|VisibleAsync|SortNulls|Grouping|GroupingAsync|GroupKey|GroupOrder|Aggregate)\b|columnsSchema|createColumns<" \
     libs/table/docs apps libs/table/CONTEXT.md \
     --glob '!**/work/**' --glob '!**/adr/**' \
     --glob '!**/decisions/**'
   ```
   Expect nothing.
4. Commit with `Closes #141`.

## Implementation Notes

- Per the user's standing rule, the user runs the commands in
  steps 1–2, or `/implement` asks first. Don't start them
  unprompted.

## Non-Goals

- Moving the work folder to `archive/`. Out of this ticket.
  The workspace still carries other open issues (#100, #115,
  #117, #128).

## Acceptance Checks

- [ ] `npm run llms:check` clean.
- [ ] `nx run shared-table:typecheck` clean on a source-clean
      second run.
- [ ] The final sweep returns nothing.

---
← [Step 6: Columns decisions log](step-6-columns-decisions-log.plan.md)
