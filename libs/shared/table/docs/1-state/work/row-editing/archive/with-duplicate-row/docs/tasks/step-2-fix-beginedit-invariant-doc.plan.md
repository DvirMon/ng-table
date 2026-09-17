---
title: "Step 2: Fix `beginEdit` no-op invariant comment"
---

← [Step 1: Rename `addRow` → `insertRow`](step-1-rename-addrow-to-insertrow.plan.md) | [Step 3: Update rename docs](step-3-update-rename-docs.plan.md) →

# Step 2: Fix `beginEdit` no-op invariant comment

**PR scope:** Depends on: Step 1 (same file — `row-edit-mutations.ts` — sequenced to avoid
overlapping edits; no logical dependency otherwise).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Files:**
- `libs/shared/table/src/api/row-edit-mutations.ts` — header comment only (lines 13-19 as read
  pre-Step-1)

## Why This Step Exists

`1-design.md` found a doc/code mismatch: the file header claims the edit-session verbs
(`beginEdit`/`endEdit`/`clearEditing`) "write `open`, so they no-op on a table composing only
`withOptimistic()`". The code doesn't do this — `beginEdit` writes `withOpen(state.open, id)`
unconditionally; there's no feature check anywhere in the file. Decided 2026-08-27: fix the doc,
not the code (no `supportsOpen` plumbing through `createEditingStore()` — see the design doc's
"Two ways out" section for the rejected alternative). This is a **comment-only change**, not a
markdown-file docs step, which is why it's typed `code` (routes to the implementer who's already
in this file) rather than `docs`.

## What To Do

Replace the false claim in the header comment with the true one: these verbs are
**meaningless-but-not-inert** on a table composing only `withOptimistic()` — calling `beginEdit`
there populates `open` (which `withOptimistic()` never reads or clears), silently shrinking
`pending` (derived as `snapshots` minus `open`), which is the signal a live table actually reads.
State plainly that this is a misuse case the types don't prevent, not a supported no-op.

## Implementation Notes

- No production logic changes. If a diff in this step touches anything other than the comment
  block, that's scope leak.
- Do not add a runtime guard/feature check to `beginEdit`/`endEdit`/`clearEditing` — that's the
  rejected alternative.
- Keep the rest of the header (the pointer to `optimistic-mutations.ts` for the rollback verbs)
  as-is; only the incorrect claim needs rewriting.

## Risks / Watchouts

- `with-optimistic.spec.ts` still doesn't call `beginEdit` (noted as a gap in the design doc) —
  out of scope for this step; no test step is planned for it since the design doc treats the fix
  as documentation-only, not a behavior change worth new coverage.

## Non-Goals

- No behavior change to `beginEdit`, `endEdit`, or `clearEditing`.
- No new test coverage (see Risks above).

## Acceptance Checks

- The header comment in `row-edit-mutations.ts` no longer asserts that these verbs no-op under
  `withOptimistic()` alone.
- `npx nx typecheck shared-table` passes (comment-only change, should be a no-op build-wise).

---
← [Step 1: Rename `addRow` → `insertRow`](step-1-rename-addrow-to-insertrow.plan.md) | [Step 3: Update rename docs](step-3-update-rename-docs.plan.md) →
