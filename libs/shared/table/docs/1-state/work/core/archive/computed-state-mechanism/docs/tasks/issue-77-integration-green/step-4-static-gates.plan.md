---
title: "Step 4 — Agent-run static gates: type-check + lint across the library and both apps"
type: task-step
issue: 77
---

# Step 4 — Agent-run static gates: type-check + lint across the library and both apps

**PR scope:** No code intended. Any fix a gate forces is a new step appended to this plan, not
an ad-hoc edit.

**Task type:** chore

**Skills used:** —

**Depends on:** Step 1, Step 2, Step 3
**Parallel-safe with:** —

**Scaffolding agent:** main thread

## Files

- none (a fix, if one is needed, gets its own step file)

## Why This Step Exists

Issue AC 2: "Type-check, lint and unit suite pass for the table library, `apps/demo` and
`apps/ng-table`." Type-check and lint are the static half — cheap, no process started, so the
agent runs them (`never-run-build-serve-test-unprompted.md` allows `tsc --noEmit` / lint). The
unit suites and Storybook build are Step 5.

## What To Do

1. **Precondition — a clean tree.** `git status --short` at plan time shows other tickets' WIP
   (uncommitted `src/index.ts` grouping-mutation exports, untracked `stories/selection/`,
   `docs/adr/0015-*`). The gate is meaningful only on what will be on `feat/table`. Ask the
   user to either commit Steps 1–3 plus park/commit that WIP, or confirm the gate should run
   against the working tree as-is. Do not stash on their behalf.
2. Type-check, every config whose `include` covers touched or dependent files
   (`typecheck-with-project-config.md`):

   ```bash
   npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit
   npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit
   npx tsc -p libs/shared/table/.storybook/tsconfig.json --noEmit
   npx tsc -p apps/demo/tsconfig.app.json --noEmit
   npx tsc -p apps/ng-table/tsconfig.app.json --noEmit
   ```

   Filter output: `2>&1 | grep -E "error TS" | head -40`.
3. Lint:

   ```bash
   npx nx run-many -t lint -p shared-table demo ng-table
   ```

4. Record the exit code of each command in `progress.md` under this step (one line per
   command). Five `tsc` + one lint = six lines.
5. Any failure: classify first. A failure inside `stories/composition/` → Step 1/2 fix, new
   step. A failure in another ticket's WIP → report to the user, not fixed here. A failure in
   library code → a library regression from #68–#74; report with the error and stop.

## Implementation Notes

- `nx lint` runs ESLint only; it does not start a dev server or watcher.
- The spec config pulls the whole `src/` closure; a cold run is the price of admission.

## Risks / Watchouts

- `ng-table` has a `storybook` target but no table stories; its `.storybook/tsconfig.json` is
  out of scope for AC 3 ("every table story").

## Non-Goals

- Unit tests, `build-storybook`, serving anything — Step 5, user-run.
- Fixing lint debt outside files this ticket or #68–#76 touched.

## Acceptance Checks

- [ ] All five `tsc` commands exit 0
- [ ] `nx run-many -t lint` exits 0 for all three projects
- [ ] `progress.md` carries the six result lines

---
← [Step 3: `stories.md` layout tree + fixtures table](step-3-stories-doc-composition-folder.plan.md) | [Step 5: User-run gates and #77 close-out](step-5-user-gates-closeout.plan.md) →
