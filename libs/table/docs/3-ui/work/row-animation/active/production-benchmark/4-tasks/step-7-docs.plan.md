# Step 7 — Docs

**PR scope:** Make the docs describe the harness that now exists.
**Depends on:** Step 5, Step 6.
**Task type:** `docs`
**Skills used:** —
**Scaffolding agent:** fork (doc edits go through a fork)

## Files

| File                                                                        | Action                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `libs/table/docs/3-ui/work/row-animation/discovery-benchmark-thresholds.md` | edit — § PM points to the new harness; the three 2026-09-25 notes stay as history    |
| `libs/table/docs/3-ui/work/row-animation/discovery-production-benchmark.md` | edit — mark § Proposed setup "adopted", link this plan, record Step 5's answers      |
| `libs/table/docs/3-ui/directives/row-animation.md`                          | edit — "Performance" pointer: how to run `table-bench:bench`, what the verdict means |
| `apps/table-bench/README.md`                                                | create — what the app is for, why nothing else may be added to it, how to run        |
| `handoffs/handoff-row-animation-bench.md`                                   | edit — mark resolved, point here                                                     |

## What To Do

- State the gate plainly: 95 % interval on `animated − plain` at N=1000 vs 16.7 ms; pass / fail /
  unsure; only `fail` exits non-zero.
- README rule, in one line: any change to the page (CSS, fonts, extra components) invalidates
  comparisons with earlier runs — note it in the report when it happens.
- Run `npm run llms:check` is the user's; if `llms.txt` is affected, say so.

## Acceptance Checks

- [ ] No doc still describes `bench-trace`, the profile story, or min-sample gating as current.
