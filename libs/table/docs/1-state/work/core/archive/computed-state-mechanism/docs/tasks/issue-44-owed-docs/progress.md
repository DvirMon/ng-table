# Implementation Progress — Table: owed docs for positional composition and derived state

**Issue:** #44
**Status:** 8 / 8 complete

| Step | Title                                                                                        | Status  | PR  |
| ---- | -------------------------------------------------------------------------------------------- | ------- | --- |
| 1    | ADR-0003: the deferred row-type inference shipped; record the reversal                       | ✅ done | —   |
| 2    | ADR-0007 + ADR-0005: core-key pre-claims, the unclaimed `totalRowCount`, derive-block labels | ✅ done | —   |
| 3    | ADR-0014: the derived-signal row in the runtime-error policy                                 | ✅ done | —   |
| 4    | State-layer architecture: argument-order visibility, fixed pipeline order                    | ✅ done | —   |
| 5    | Row-editing: the shared-store rationale no longer holds                                      | ✅ done | —   |
| 6    | `CLAUDE.md`: kill the false `composed` claim, add `withComputed()`/`composeFeatures()`       | ✅ done | —   |
| 7    | Call-shape sweep across the remaining docs, plus the persistence exclusion                   | ✅ done | —   |
| 8    | `/audit-docs` gate, decisions-log check, close-out of #44 and #33                            | ✅ done | —   |

Graph: `1 → 4`; `2 → 5`; `{1…7} → 8`.
Parallel-safe: `[1, 2, 3, 6, 7]` from the start; `[4, 5]` once their blockers land.
Dependency: `1 → 4 → 8`, `2 → 5 → 8`.

```
  1 ──── 4 ──┐
  2 ──── 5 ──┤
  3 ─────────┼── 8
  6 ─────────┤
  7 ─────────┘
```

Steps 1–3 are the ADR amendments — three independent topics (the row-type reversal, member claims,
runtime-error policy), no shared files, no shared reasoning. Steps 4 and 5 describe what those ADRs
decide, so each waits on its own ADR rather than on all three. Steps 6 and 7 touch disjoint files
and are parallel-safe with everything.

## Scope notes taken at plan time (2026-09-14)

- **AC 5 looks already satisfied.** `3-decisions.md:480–484` (D25) records `indexById` public
  read-only and `baseColumns` engine-only with reasoning. Step 8 verifies rather than rewrites.
- **One item folded in that the issue body does not name.** D25: "`CLAUDE.md` repeats the false
  claim [that no shipped feature reads `composed`] and owes a rewrite." Same docs debt, no other
  owner — Step 6.
- **Historical ADR snippets get updated.** User's call, 2026-09-14, over the alternative of leaving
  ADRs 0002/0010/0011/0015 period-accurate with a dated note. AC 1 is read literally. ADR-0015's
  drift finding is reworded to past tense rather than deleted, so the finding survives the edit.
- **Two follow-ups belong to neither #44 nor #33**, recorded in Step 8 for the close-out comment:
  the duplicated overload-dispatch prologue absorbable by one `defineFeature()` (found by the #40
  review), and the pre-existing `.storybook/preview.ts` + story-host lint failures (recorded on #43).

## Step 8 outcome (2026-09-14)

- **AC 5 verified, no edit needed.** `3-decisions.md` D25 records `indexById` as a public
  read-only `TableStore` member and `baseColumns` as engine-only, each with its reasoning.
- **`/audit-docs` run** over 61 permanent docs by five parallel agents:
  [`audit-results.md`](audit-results.md). 240 STALE findings, 31 in #44's scope and fixed here,
  209 pre-existing drift from other tickets and listed for triage.
- **Every Step 7 grep clean** library-wide with `work/` excluded. `docs/status.md` audited clean —
  no regeneration needed.
- The workspace `state.json` already carries `checklist.tasks = true`; unchanged.
