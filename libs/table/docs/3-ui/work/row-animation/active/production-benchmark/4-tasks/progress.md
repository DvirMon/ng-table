# Implementation Progress — Production benchmark for `ngpTableRowAnimation`

**Source:** [discovery-production-benchmark.md](../../../discovery-production-benchmark.md)
(§ Decision, § Synthesis, § Proposed setup). Context: `handoffs/handoff-row-animation-bench.md`.
**Status:** 0 / 7 complete

## Goal

Replace the Vitest timing bench with a production-built page driven by plain Playwright:
one variant per fresh page, the window from the change to the end of the next rendered frame,
and a three-way statistical gate (pass / fail / unsure) on `animated − plain` at N=1000.
Deterministic animation-count gates stay in Vitest.

## Dependency graph

```
S1 app pages        ──┐
S2 stats            ──┼──▶ S4 driver ──▶ S5 nx target + first run ──┬──▶ S6 retire old timing
S3 trace summary    ──┘                                            └──▶ S7 docs
                                                          S6 ──────────▶ S7
```

Parallel-safe: [1, 2, 3] — no edges between them.
Dependency: 1, 2, 3 → 4 → 5 → 6 → 7 (and 5 → 7).

| Step | Title | Type | Status |
|---|---|---|---|
| 1 | [`apps/table-bench`: production pages](step-1-bench-app-pages.plan.md) | `code` | ⬚ pending |
| 2 | [Difference statistics (CI + three-way verdict)](step-2-difference-stats.plan.md) | `code` | ⬚ pending |
| 3 | [Trace summary: script vs style/layout/paint](step-3-trace-summary.plan.md) | `code` | ⬚ pending |
| 4 | [Playwright driver](step-4-playwright-driver.plan.md) | `code` | ⬚ pending |
| 5 | [Nx target and first run](step-5-nx-target-first-run.plan.md) | `code` | ⬚ pending |
| 6 | [Retire the old timing surfaces](step-6-retire-old-timing.plan.md) | `code` | ⬚ pending |
| 7 | [Docs](step-7-docs.plan.md) | `docs` | ⬚ pending |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Settled (do not re-open)

- Separate app `apps/table-bench`, not routes in `apps/site` (2026-09-25).
- Plain Playwright + CDP as the driver; Tachometer rejected (Selenium, dormant) — discovery § Answer.
- Directive change is already committed (`400ed22`). This plan touches measurement only.

## Standing constraints

- The user runs every build, serve, bench and test. Steps end at `nx run <project>:typecheck`
  (or `node --check`) and state what to run.
- Doc edits go through a fork.
