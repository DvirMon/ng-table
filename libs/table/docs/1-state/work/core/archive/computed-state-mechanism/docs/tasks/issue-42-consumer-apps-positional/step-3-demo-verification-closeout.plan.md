---
title: "Step 3 — Demo behaviour verification (user-run) and #42 close-out"
type: task-step
issue: 76
---

# Step 3 — Demo behaviour verification (user-run) and #42 close-out

**PR scope:** No code. A verification pass the user runs, then the issue comment/close.

**Task type:** chore

**Skills used:** —

**Depends on:** Step 1, Step 2
**Parallel-safe with:** —

**Scaffolding agent:** main thread

## Files

- none (issue #42 comment + close)

## Why This Step Exists

Issue AC 3: "Both apps type-check and every demo page behaves as before". Type-checking is
covered by Steps 1–2; behaviour cannot be shown statically — a type-clean call can still compose
features in the wrong order. Per `never-run-build-serve-test-unprompted.md`, the agent does not
start the dev server; it hands the user the checklist and records the result.

## What To Do

1. Confirm both static gates are green on the branch:
   `npx tsc -p apps/demo/tsconfig.app.json --noEmit` and
   `npx tsc -p apps/ng-table/tsconfig.app.json --noEmit`.
2. Ask the user to serve `demo` (`npx nx serve demo`) and walk the seven demos wired in
   `app.html`, checking each row below. Ask them to open `ng-table`'s home page once and read
   the two rewritten feature cells.
3. On a green pass: comment on #42 with the checklist result and the Step 1/2 commits, tick the
   four ACs, close the issue.
4. On any red row: stop, record the failing demo and interaction on #42, do not close. The fix
   is a new step in this plan, not an ad-hoc edit.

| Demo | What must behave as before |
|---|---|
| table-demo | Clicking a header cycles that column's sort; rows glide (FLIP) to their new positions rather than jumping |
| table-column-visibility-demo | Age column follows the async permission check (hidden while pending / on denial, "retry" re-runs it); city toggle shows/hides the city column live |
| table-edit-demo | Typing in a name input does **not** advance the `dataCommits` counter; blur does; changing the city select advances it immediately |
| table-row-edit-demo | Add-blank-row inserts an open row at the top; open / cancel / save work; a failed save surfaces the error and reverts the row; opening a second row closes the first |
| table-row-field-demo | Expanding a row shows its children; opening a row swaps text for inputs; save / cancel close it |
| table-expansion-demo | Expanding a row shows a loading state, then lazily loaded children |
| table-expansion-row-demo | Same as expansion-demo, rendered through the expansion-row layout |
| ng-table home | Column-schema and feature-plugin cells read correctly; no `createTableSchema()` anywhere on the page |

## Implementation Notes

- The walkthrough table describes what the component code (not the templates) promises: FLIP
  via `rowTransforms`, `dataCommits` via `linkedSignal`, `saveRow` rejection → `revertEdit`,
  `createRowExpandedHandler` → `loadingRowIds`. If a template already differed before this
  migration, that is not a red row for #42.

## Risks / Watchouts

- A demo that renders but with a feature missing (e.g. no sort arrows) points at a dropped
  feature argument in Step 1 — check the call against Step 1's table before anything else.

## Non-Goals

- Storybook — covered by #41.
- Automated e2e for the demo app — none exists; not introduced here.

## Acceptance Checks

- [ ] Both `tsc` gates exit 0 on the branch
- [ ] User reports every row above green
- [ ] #42 commented with results + commit hashes, ACs ticked, issue closed

---
← [Step 2: `apps/ng-table` home copy + `apps/demo/CLAUDE.md` off the deleted builder](step-2-ng-table-copy-and-demo-claude-md.plan.md)
