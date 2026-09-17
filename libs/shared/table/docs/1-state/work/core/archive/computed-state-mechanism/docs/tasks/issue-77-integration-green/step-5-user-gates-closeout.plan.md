---
title: "Step 5 — User-run gates (unit suites, Storybook build, walkthrough) and #77 close-out"
type: task-step
issue: 77
---

# Step 5 — User-run gates (unit suites, Storybook build, walkthrough) and #77 close-out

**PR scope:** No code. The user runs the dynamic gates; the agent records results, comments on
#77, ticks ACs, closes the issue.

**Task type:** chore

**Skills used:** —

**Depends on:** Step 4
**Parallel-safe with:** —

**Scaffolding agent:** main thread

## Files

- none (issue #77 comment + close; `progress.md` of this plan, #75, #76)

## Why This Step Exists

The remaining ACs cannot be shown statically: the unit suite (AC 2), Storybook building and
every story rendering (AC 3), and the derive-block story behaving on canvas (AC 4). Per
`never-run-build-serve-test-unprompted.md` the agent hands over the commands and checklist and
records what comes back. This is also where ACs 1 and 5 are closed as satisfied by
construction — no integration branch ever existed; #68–#76 landed on `feat/table` directly.

## What To Do

1. Hand the user these commands, in this order:

   ```bash
   npx nx run-many -t test -p shared-table demo ng-table
   npx nx run shared-table:build-storybook
   npx nx run shared-table:storybook
   ```

2. Walkthrough for the new story, `Table / Composition / Derived State`:

   | Action | Expected |
   |---|---|
   | Load | banner reads `0 visible · 0 hidden by filter`; all mock rows listed |
   | Tick two rows in different depts | `2 visible · 0 hidden` |
   | Filter to one of those depts | `1 visible · 1 hidden by filter`; the hidden row's mark survives |
   | Filter to "All" | `2 visible · 0 hidden` — no selection was lost |
   | Untick one row while filtered | both numbers move together, never negative |
   | Console | no `[createTable] derived member … threw` line |

3. Confirm the two still-pending sibling walkthroughs are green, or run them now with their
   own checklists — don't restate them here:
   - #75 Step 4 (`issue-75-storybook-hosts-positional/step-4-render-verification-closeout.plan.md`) — nine row-edit stories.
   - #76 Step 3 (`issue-76-consumer-apps-positional/step-3-demo-verification-closeout.plan.md`) — seven demos + ng-table home.

   If either is still open, close it first through its own plan; #77 does not close while a
   blocker's walkthrough is red.
4. Every table story in the sidebar renders (row-edit ×9, selection ×2 if the
   `selection-stories` ticket has landed them, composition ×1) — user scans the sidebar once.
5. On a green pass: comment on #77 with the command list + exit codes, the Step 4 result lines,
   the walkthrough table result, the commits for Steps 1–3, and one sentence for ACs 1/5:
   *"No integration branch was cut; #68–#76 landed on `feat/table` directly (see the commit
   list on each issue). Nothing to merge."* Tick all five ACs. Close #77.
6. On any red row: record the failing gate/story on #77, do not close. A fix is a new step in
   this plan.
7. Update this plan's `progress.md` to 5 / 5. `state.json`'s `checklist.tasks` is already
   `true` for the workspace — nothing to set there.

## Implementation Notes

- `nx test` here is Vitest across three projects; `build-storybook` writes to
  `dist/storybook/shared-table` and is the "Storybook builds" evidence for AC 3.
- #78 (owed docs) stays open independently — it is not a blocker of #77.

## Risks / Watchouts

- A unit-suite failure in `libs/shared/table/src/**/*.spec.ts` after Steps 1–3 is a library
  regression from #68–#74, not a story problem — the story folder has no spec. Report, don't
  patch inside this plan.
- A green `build-storybook` with a red canvas points at the host wiring (Step 1), not the fold.

## Non-Goals

- Closing #67 (parent) — it closes when #78 does.
- E2E automation for stories or demos — none exists.

## Acceptance Checks

- [ ] `nx run-many -t test` exits 0 for all three projects (user-reported)
- [ ] `build-storybook` exits 0 (user-reported)
- [ ] Walkthrough table above all green; #75 Step 4 and #76 Step 3 both closed
- [ ] #77 commented with results + commit hashes, five ACs ticked, issue closed
- [ ] `progress.md` reads 5 / 5

---
← [Step 4: Agent-run static gates](step-4-static-gates.plan.md)
