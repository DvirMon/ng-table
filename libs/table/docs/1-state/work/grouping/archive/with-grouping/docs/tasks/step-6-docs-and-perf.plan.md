---
title: "Step 6 — Perf findings + docs updates"
type: task-step
issue: 6
---

# Step 6 — Perf findings + docs updates

**PR scope:** Depends on Step 5 — needs a working, tested implementation to measure and to
know what's actually shipped before updating frontmatter/status.

**Task type:** docs

**Skills used:** none (main thread, no scaffolding agent)

**Scaffolding agent:** none — runs in the main implementation thread

**Depends on:** Step 5

## Files

- `libs/shared/table/docs/0-product/performance.md` (edit)
- `libs/shared/table/docs/1-state/features/grouping.md` (edit)
- `libs/shared/table/docs/status.md` (edit — generated, do not hand-edit content)

## Why This Step Exists

D12/issue #7's acceptance criteria require "a perf pass against `performance.md`'s two axes at a
representative nesting depth, findings recorded" before this ships — multi-level grouping is the
first table feature with a plausible super-linear shape. `performance.md` itself states "no
budgets measured, no stress suite built" — there is no CI-gated benchmark harness to plug into
yet, so this is a **recorded, exploratory measurement**, not a new automated test suite. Building
a general perf-harness is out of scope for this issue (`performance.md`'s own "Not yet decided"
list — "which harness" is explicitly unresolved).

## What To Do

### 1. Perf pass (measure, then record — don't build tooling)

Using `engine/grouping.ts`'s `clusterRows`/`buildGroupRenderRows` directly (no need to go
through a rendered component — this is the pure engine code, per `performance.md`'s axis 1
framing of "does the pipeline stage stay linear"):

- **Axis 1 (row count).** Generate synthetic rows at the 10,000-row working target
  (`performance.md`), 2–3 grouping levels, a representative cardinality (e.g. 10–50 distinct
  values per level). Time `clusterRows` + `buildGroupRenderRows` end to end. Compare against a
  smaller size (e.g. 1,000 rows) to sanity-check the shape is linear in row count, not
  quadratic — `buildClusters`' `Map`-based bucketing (Step 1) should already guarantee this by
  construction; this is confirming it empirically, not designing for it now.
- **Axis 2 (depth).** At a fixed row count, vary nesting depth (1, 2, 3, 4 levels) and note how
  time scales with depth — `performance.md` calls multi-level clustering "the first plausible
  super-linear shape," so this axis is the one actually motivating D12, more than axis 1.
- Record concrete numbers (rows, levels, cardinality, wall-clock ms) — not just "it felt fine."

### 2. `performance.md` — record findings

Add a dated entry (don't overwrite the file's existing "nothing has been measured" framing —
extend it) under a new "Findings" section or appended to "Where this bites first," stating what
was measured, at what scale, and the result. If a concerning shape shows up (e.g. depth causing
non-linear cost beyond what the row-count axis alone would predict), say so explicitly rather
than rounding it off — this file's whole purpose is to be the honest record future features
budget against.

### 3. `features/grouping.md` — frontmatter + superseded banner

- `code: none` → `code: partial` (issue #7 ships the core; `groupOrder`/collapse/declarative
  rules are still `code: none` until #24/#59/#60 land — `partial` is correct, not `shipped`).
- Trim the superseded-sections banner at the top of the file: the **Methods** section and
  single-level-scope text are now fully superseded by shipped code, not just by the decisions
  doc — update the banner's wording accordingly (it currently says "read the decisions first,"
  which is still true for the *unshipped* parts, D4/D6–D8/D11, but no longer the framing for
  D1/D3/D9, which are now implemented).
- Do not mark the file `code: shipped` — that's accurate only once #24/#59/#60 also land.

### 4. Regenerate `docs/status.md`

Run `npm run table:status` (see this library's `CLAUDE.md`, "Docs structure" table — never
hand-edit `status.md`, it's generated from feature-spec frontmatter). This picks up
`grouping.md`'s frontmatter change from step 3 above.

## Implementation Notes

- This step intentionally does **not** touch `2-columns/architecture.md`'s D13 sync-vs-async
  backport (mentioned in `3-spec.md`'s "Documentation updates this work owes") — that criterion
  only makes sense once `applyGrouping`/`applyGroupingAsync` exist (#26). Doing it here would be
  documenting an API this issue doesn't ship.

## Risks / Watchouts

- `npm run table:status` is a repo script invocation — confirm before running it if the
  implementing session operates under a "no builds/scripts without confirmation" convention.

## Non-Goals

- No new benchmark harness/tooling — `performance.md`'s own "Not yet decided" list leaves that
  open for a later, cross-cutting effort.
- No CI perf gate — this is a recorded manual finding, matching `performance.md`'s current
  "manual pre-release check" framing (also undecided, but nothing here commits to a direction).

## Acceptance Checks

- [ ] `performance.md` has a dated, concrete findings entry (numbers, not impressions) for both
      axes at a representative multi-level grouping scenario.
- [ ] `features/grouping.md` frontmatter reads `code: partial`; superseded banner reflects what's
      actually shipped vs. still open.
- [ ] `docs/status.md` regenerated (not hand-edited) and reflects the frontmatter change.

---
← [Step 5: Tests](step-5-tests.plan.md)
