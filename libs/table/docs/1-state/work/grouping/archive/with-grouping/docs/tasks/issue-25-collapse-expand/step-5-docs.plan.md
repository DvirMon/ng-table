---
title: "Step 5 — docs: collapse/expand shipped"
type: task-step
issue: 59
---

# Step 5 — docs: collapse/expand shipped

**PR scope:** Markdown only. **Parallel-safe with Step 4.**

**Task type:** docs

**Depends on:** Step 3

**Scaffolding agent:** none (main thread)

## Files

- `libs/shared/table/docs/1-state/features/grouping.md` (edit)
- `libs/shared/table/docs/1-state/work/with-grouping/2-decisions.md` (edit)
- `libs/shared/table/docs/1-state/work/with-grouping/3-spec.md` (edit)

## Why This Step Exists

D11 ships in this issue; the decisions/spec docs currently describe it as "still unbuilt." Step 2's
`rowsBeneathGroup` fix is not itself covered by any existing decision — it needs its own entry so a
future reader can find why `rowsOf`'s implementation re-derives clusters instead of scanning
`renderRows()`.

## What To Do

### 1. `features/grouping.md`

- Move D11 out of the "still unbuilt" list in the superseded banner (line ~36-39) into the shipped
  list alongside D1/D3/D4/D9/D16, citing issue #25.
- **Behavior** section: the "Static grouping (no `withExpansion()`)" and "Collapse/expand" bullets
  currently describe the *intended* contract — confirm the prose now matches shipped behavior
  (it already does; D11 didn't change the intended design, only implemented it) and drop any
  remaining "when it ships" framing.
- **Compile-Time Dependencies** section: same — confirm "detected at runtime (e.g. an optional
  prop/method check)" still accurately describes the shipped `isExpandedRowsSignal` duck-type,
  since that's the literal mechanism Step 3 used.
- Leave `spec:`/`code:` frontmatter alone unless this closes out the *whole* feature's maturity —
  D6–D8 (`groupingRule`/`applyGrouping()`, issue #26) are still unbuilt, so the file stays
  `spec: drafted` / `code: partial`.
- Never hand-edit `docs/status.md` — regenerate via `npm run table:status`, left for the user to
  run (per the library's own convention, `CLAUDE.md`).

### 2. `work/with-grouping/2-decisions.md`

- Mark D11 shipped (append `— shipped, issue #25` to its heading, matching how D4/D9/D16 are
  marked elsewhere in this file).
- Add a new decision entry, **D17**, documenting the `rowsBeneathGroup` rewrite:

  ```markdown
  - **D17 (2026-09-12) — `rowsOf` resolves by re-deriving the cluster tree from `rows()`, not by
    scanning `renderRows()`.** D16 shipped `rowsOf` before collapse existed, reading `renderRows()`
    between a header and the next row at or above its depth. Once D11 makes `renderRows()` omit a
    collapsed group's descendants, that scan finds nothing for a collapsed header and silently
    returns `[]` — breaking the selection-cascade recipe the moment a group is collapsed.
    `0-product/grouping.md` X-G1 specs the correct behavior directly: "I never select rows I cannot
    see and was never told about" describes what I *can* select, not what currently renders.
    `rowsBeneathGroup` now re-clusters `rows()` (pipeline output, never collapse-affected) and
    locates the target group by its synthetic id path, matching `emitGroupRows`'s own id
    construction. Cost model unchanged from D16 (derived on call, no library-side cache).
  ```

  (Use whichever date matches when this step actually lands.)

### 3. `work/with-grouping/3-spec.md`

- D11 bullet (line ~259): append "— shipped, issue #25" the way other shipped decisions in this
  file are marked (check how D1/D9/D16 read elsewhere in this doc for the exact phrasing
  convention).
- Add a short D17 bullet mirroring the decisions-doc entry above (link rather than restate).
- **Testing Decisions → Coverage** (the bullet list ending in "...rows render flat and expanded"):
  add a line for the `rowsOf`-under-collapse case, since it's now part of what this spec commits to
  testing.
- **Documentation updates this work owes** section: this step *is* that owed update for D11 — check
  off / remove the line once done, don't leave it dangling for a future reader to think it's still
  outstanding.

## Implementation Notes

- No decision narration in source JSDoc — the code comments from Steps 1-3 stay at "what it does +
  the constraint"; rationale for *why* stays in these docs only.
- Don't restate D16's rejected alternatives or D11's original rationale in three places — the
  decisions doc owns the reasoning, the spec and feature doc link to it.

## Risks / Watchouts

- **Don't mark ADR-0012 (`withTree()` split) decided or implemented.** It stays `proposed`; D11's
  optional-read design is explicitly written to survive that split either way, not to preempt it.
- **Don't touch D6–D8 framing.** `groupingRule`/`applyGrouping()` (issue #26) remain unbuilt; this
  step only closes out D11/D17.
- `features/grouping.md` still carries pre-D3 single-level prose in spots below the banner — not
  this step's job to rewrite (that's the spec's own tracked "Documentation updates this work owes"
  backlog item, separate from D11).

## Non-Goals

- No `docs/status.md` regeneration in this PR (the user runs `npm run table:status`).
- No ADR-0012 resolution.
- No UI-layer doc for a group-header collapse toggle directive (separate, UI-stream work — flagged
  as out of scope in `3-spec.md` already).

## Acceptance Checks

- [ ] `features/grouping.md`'s superseded banner lists D11 as shipped under #25.
- [ ] `2-decisions.md` has D11 marked shipped and a new D17 for the `rowsOf` fix.
- [ ] `3-spec.md`'s D11 bullet, Coverage list, and "Documentation updates this work owes" all
      reflect shipped status.
- [ ] No markdown link in the edited files points at a missing anchor or file.

---
[← Step 4: Tests](step-4-tests.plan.md)
