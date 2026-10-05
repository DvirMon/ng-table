---
title: 'Step 4 — Storybook render/behaviour verification (user-run) and #41 close-out'
type: task-step
issue: 75
---

# Step 4 — Storybook render/behaviour verification (user-run) and #41 close-out

**PR scope:** No code. A verification pass the user runs, then the issue comment/close.

**Task type:** chore

**Skills used:** —

**Depends on:** Step 1, Step 2, Step 3
**Parallel-safe with:** —

**Scaffolding agent:** main thread

## Files

- none (issue #41 comment + close)

## Why This Step Exists

Issue AC 3: "Every story renders and every interaction it demonstrates behaves as before". This
cannot be shown statically — a type-clean host can still compose the wrong feature. Per
`never-run-build-serve-test-unprompted.md`, the agent does not start Storybook; it hands the
user the checklist and records the result.

## What To Do

1. Ask the user to start the table library's Storybook and walk the nine stories under
   `Table / Row Editing /`, checking each row of the table below.
2. On a green pass: comment on #41 with the checklist result and the commits (`fe23c9a` + the
   Step 2/3 commits), tick the four ACs, close the issue.
3. On any red row: stop, record the failing story and interaction on #41, do not close. The
   fix is a new step in this plan, not an ad-hoc edit.

| Story                           | What must behave as before                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Live / Base                     | sort by column header; blur-commit edits a cell; discard reverts, retry re-sends; new row gets focus |
| Live / Optimistic               | edit commits immediately; failed save reverts the cell in place with Retry/Dismiss                   |
| External Write & Reconciliation | external patch while a row is open surfaces a conflict; conflict fields listed                       |
| Form-Driven Mutations           | insert / patch / remove through the form flow round-trip and re-key                                  |
| Sorting × Editing               | S-2: nulls/empties sort last; S-1 row-hold notice still reports the (expected) gap                   |
| Gated / Single / Pessimistic    | one row open at a time; Save waits for the request; Cancel restores                                  |
| Gated / Single / Optimistic     | one row open; Save closes at once; failure reopens with Retry                                        |
| Gated / Multiple / Optimistic   | several rows open at once (`multiple` arg on); independent outcomes                                  |
| Bulk                            | bulk gate: N rows saved in one action, N independent outcomes                                        |

## Implementation Notes

- The `multiple` Storybook arg on the two multi-row stories now drives `withRowEdit({ multiple })`
  directly — confirm toggling it still takes effect without a rebuild.

## Risks / Watchouts

- MSW handlers (`row-edit/fixtures/handlers.ts`) are untouched by the migration; a failing
  save/delete round-trip points at the host wiring, not the mock server.

## Non-Goals

- Full library/app green — #43 owns the integration gate.

## Acceptance Checks

- [ ] All nine rows above green, as reported by the user.
- [ ] #41 ACs ticked, issue commented and closed with the commit list.
- [ ] `progress.md` for this plan reads 4 / 4.

---

← [Step 3: stories.md fixtures table](step-3-stories-doc-schema-row.plan.md)
