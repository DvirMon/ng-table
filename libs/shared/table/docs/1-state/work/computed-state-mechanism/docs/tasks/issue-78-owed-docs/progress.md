# Implementation Progress — Table: owed docs for positional composition and derived state

**Issue:** #78
**Status:** 0 / 8 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | ADR-0003: the deferred row-type inference shipped; record the reversal | ⬚ pending | — |
| 2 | ADR-0007 + ADR-0005: core-key pre-claims, the unclaimed `totalRowCount`, derive-block labels | ⬚ pending | — |
| 3 | ADR-0014: the derived-signal row in the runtime-error policy | ⬚ pending | — |
| 4 | State-layer architecture: argument-order visibility, fixed pipeline order | ⬚ pending | — |
| 5 | Row-editing: the shared-store rationale no longer holds | ⬚ pending | — |
| 6 | `CLAUDE.md`: kill the false `composed` claim, add `withComputed()`/`composeFeatures()` | ⬚ pending | — |
| 7 | Call-shape sweep across the remaining docs, plus the persistence exclusion | ⬚ pending | — |
| 8 | `/audit-docs` gate, decisions-log check, close-out of #78 and #67 | ⬚ pending | — |

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
- **Two follow-ups belong to neither #78 nor #67**, recorded in Step 8 for the close-out comment:
  the duplicated overload-dispatch prologue absorbable by one `defineFeature()` (found by the #74
  review), and the pre-existing `.storybook/preview.ts` + story-host lint failures (recorded on #77).
