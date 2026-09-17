---
title: "Step 8 — /audit-docs gate, decisions-log check, and close-out of #44 and #33"
type: task-step
issue: 78
---

# Step 8 — `/audit-docs` gate, decisions-log check, and close-out of #44 and #33

**PR scope:** No prose rewrites. A verification pass, one possible small edit, then the issue
comments and closes.

**Task type:** chore

**Skills used:** `audit-docs`

**Depends on:** Steps 1–7 (all of them)
**Parallel-safe with:** —

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/1-state/work/computed-state-mechanism/3-decisions.md` (verify; edit only
  if the check below fails)
- `.../docs/tasks/issue-44-owed-docs/progress.md` (update)
- GitHub issues #44 and #33 (comment, close)

## Why This Step Exists

Issue AC 6 is a gate, not a rewrite: `/audit-docs` over the table library must report no stale
references to the array/thunk form, the config-builder helper, or `ComposedFeatureMembers`. It can
only run once every other step has landed.

AC 5 — the decisions log recording the two decisions #35 settled — **appears already satisfied**.
`3-decisions.md:480–484` (D25) records `indexById` as a public read-only `TableStore` member and
`baseColumns` as engine-only, with the reasoning for both. This step verifies that rather than
assuming it, and only writes if the check fails.

## What To Do

1. **Verify AC 5.** Read `3-decisions.md:475–490`. Confirm both decisions are recorded with their
   reasoning: `indexById` public read-only (both editing features read it; a `Feature<In>` reaches
   only what is on the store), `baseColumns` engine-only (the column-schema wiring is spliced
   internally and takes the core handle, never typed as a consumer `Feature`). If either is missing
   or thinner than that, add it as a dated line — do not restructure the log.
2. **Run `/audit-docs` over `libs/shared/table`.** Per `research-audits-to-files-not-chat`, write
   the findings to a file under this task folder (`audit-results.md`) and put only a pointer in
   chat.
3. **Run the AC greps from Step 7** across the whole library, `work/` excluded, as the objective
   half of the gate.
4. **Triage what the audit returns.** Anything in scope of #44 is fixed here or reopened as a step
   in this plan — it does not ship red. Anything out of scope (other tickets' docs, pre-existing
   staleness unrelated to positional composition) is listed in the close-out comment as known, not
   silently swallowed.
5. **Comment and close #44** with: the per-step commit list, the audit result pointer, the grep
   results, and the AC 5 verification finding. Tick all six ACs.
6. **Close #33** — #44 was its last open child. The close-out comment should say what the ticket
   delivered end to end: positional `createTable(data, config, ...features)`, the
   `Feature<In, Out>` contract, `withComputed()`, `composeFeatures()`, all seven features converted,
   story hosts and both consumer apps migrated, verified green on #43, docs reconciled here.
7. **Update `progress.md`** to 8 / 8 and note that the workspace's `state.json` already carries
   `checklist.tasks = true`.

## Implementation Notes

- Two follow-ups surfaced during this ticket and belong to **neither** #44 nor #33. Record them in
  the #33 close-out comment so they are not lost, and create issues only if the user asks:
  - The six-line overload-dispatch prologue duplicated across `withSelection`, `withExpansion`,
    `withRowEdit` and (near-verbatim) `withOptimistic` — one `defineFeature(displayName, factory,
    derive?)` in `create-table-feature.ts` absorbs all four. Found by the #40 review, deliberately
    left out of scope there.
  - `.storybook/preview.ts:13` implicit-`any` ×2, and the 24 `Parsing error: Unexpected token <`
    lint errors from story-host `.html` files matched by the TS parser. Both pre-existing, both
    recorded on #43.
- #40's AC 2 text ("in either order") is stale against shipped behaviour. Step 5 records the truth
  in the feature doc; amending the closed issue's AC is optional and needs the user's call.

## Risks / Watchouts

- `/audit-docs` reports across the whole library, including docs untouched by this ticket. Do not
  let unrelated findings expand #44's scope — list them, close the issue, let the user decide.
- The `work/` folders are historical records (plans, probes, decision logs) and are *expected* to
  contain the old call shape. Every grep excludes them; an audit finding inside `work/` is not a
  finding.

## Non-Goals

- Fixing out-of-scope audit findings.
- Creating the two follow-up issues without being asked.

## Acceptance Checks

- [ ] AC 5 verified in `3-decisions.md` (or the gap closed with a dated line)
- [ ] `/audit-docs` run over `libs/shared/table`; findings written to `audit-results.md`, pointer in chat
- [ ] All Step 7 greps clean outside `work/`
- [ ] Every in-scope finding fixed; every out-of-scope finding listed in the close-out comment
- [ ] #44 commented with commits, audit pointer, grep results; six ACs ticked; issue closed
- [ ] #33 commented with the end-to-end delivery summary and the two follow-ups; issue closed
- [ ] `progress.md` reads 8 / 8

---
← [Step 7: call-shape sweep](step-7-call-shape-sweep.plan.md)
