# Step 3 — Trace summary: script vs style/layout/paint

**PR scope:** A pure module that reads a Chrome trace and splits one measured window into
script, style, layout, paint and GC time. Diagnostic only, never gated.
**Parallel-safe with:** Step 1, Step 2.
**Task type:** `code`
**Skills used:** —
**Scaffolding agent:** `general-purpose`

## Files

| File                                            | Action                                              |
| ----------------------------------------------- | --------------------------------------------------- |
| `apps/table-bench/driver/trace-summary.ts`      | create                                              |
| `apps/table-bench/driver/trace-summary.test.ts` | create — `node:test`, small hand-made event fixture |

## Why This Step Exists

Today's diagnosis came from ad-hoc scripts over `bench-trace.json` (handoff steps 3, 8). The
driver takes one traced sample per variant per run (Step 4); this turns it into one readable
line, replacing `bench-trace` (discovery § Proposed setup › Driver).

## What To Do

- Input: parsed trace events + the `reorder` user-timing measure's name.
- Find the main thread as the thread that emitted the `reorder` measure (`blink.user_timing`,
  `ph: 'b'`/`'e'`); window = its begin/end.
- Sum complete (`ph: 'X'`) events on that thread inside the window by bucket, using
  js-framework-benchmark's event sets [S1]: script (`FunctionCall`, `EvaluateScript`,
  `v8.callFunction`, `FireAnimationFrame`, …), style (`UpdateLayoutTree`), layout (`Layout`),
  paint (`PrePaint`, `Paint`, `Layerize`, `Commit`), GC (`MajorGC`, `MinorGC`). Count only
  top-level instances per bucket (don't double-count nested events of the same bucket).
- Also report: largest `UpdateLayoutTree.elementCount`, largest `Layout.dirtyObjects`.
- Output a plain object + a `formatTraceSummary()` one-liner.

## Acceptance Checks

- [ ] `node --experimental-strip-types --test apps/table-bench/driver/trace-summary.test.ts`
      passes (user runs it).
- [ ] Nested-event case in the fixture proves no double counting.
