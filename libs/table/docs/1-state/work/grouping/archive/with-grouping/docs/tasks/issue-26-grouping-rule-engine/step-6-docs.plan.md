---
title: 'Step 6 — documentation updates this work owes'
type: task-step
issue: 60
---

# Step 6 — documentation updates this work owes

**PR scope:** Docs only, no source changes.

**Task type:** docs

**Skills used:** concise-docs

**Depends on:** Step 4, Step 5

**Scaffolding agent:** (none — main thread)

## Files

- `libs/shared/table/docs/1-state/features/grouping.md` (edit)
- `libs/shared/table/docs/2-columns/architecture.md` (edit)
- `libs/shared/table/docs/status.md` (regenerate, not hand-edit)

## Why This Step Exists

The spec names these explicitly under "Documentation updates this work owes" — this step is that
list, executed.

Spec: `../../../3-spec.md`, "Documentation updates this work owes" section.

## What To Do

1. **`features/grouping.md`** — move frontmatter off `spec: drafted` / `code: none` now that
   implementation has landed (Steps 1–5). Remove the section(s) superseded by `3-spec.md`'s
   **Methods** (D1) and single-level scope (D9) banner, per this spec's own "Supersedes" note at
   the top of `3-spec.md`. Don't restate `3-spec.md`'s content here — link to it.
2. **`2-columns/architecture.md`** — add D13's sync-vs-async criterion table (the "Use when / Owns
   fetching / Owns success-error / Pending" table from `3-spec.md`'s D13 section), applied
   retroactively to the already-shipped `applyVisible`/`applyVisibleAsync` pair, which this file
   currently describes with no stated criterion for choosing between them.
3. **`docs/status.md`** — run `npm run table:status` to regenerate the `grouping` capability row
   now that `code` has moved past `none`. Do not hand-edit this file.

## Implementation Notes

- Frontmatter fields (`capability`, `spec`, `code`) are machine-read by the status generator — get
  the values right (`spec: drilled`, `code: shipped` or `partial`, matching whichever is accurate
  given what Steps 1–5 actually shipped) rather than guessing.
- `npm run table:status -- --dry-run` prints instead of writing, useful to confirm the diff before
  committing it for real.

## Risks / Watchouts

- **Never hand-edit `docs/status.md`** — CLAUDE.md is explicit that it's generated; fix the owning
  spec's frontmatter and regenerate instead.
- Don't remove `features/grouping.md` entirely even though `3-spec.md` supersedes most of it — the
  file still needs to exist as the state-layer feature spec per this library's docs-structure
  convention (`docs/1-state/features/<feature>.md`), just with corrected frontmatter and a pointer
  to `3-spec.md` for anything superseded.

## Non-Goals

- No new ADR — none of D6–D8/D13/D15 rise to the "cross-cutting, changes an architectural
  invariant" bar `CLAUDE.md`'s ADR criteria set; they're feature-scoped decisions, already recorded
  in `2-decisions.md`/`3-spec.md`.
- No changes to `docs/1-state/work/with-grouping/` episodic files (decisions, spec, research) —
  those are the historical record of how this shipped, not live documentation to edit post-hoc.

## Acceptance Checks

- [ ] `features/grouping.md` frontmatter reads `spec: drilled` (or matches whatever Steps 1–5
      actually settled), `code` no longer `none`.
- [ ] `2-columns/architecture.md` states the sync-vs-async criterion in one place, applied to both
      `applyVisible`/`applyVisibleAsync` and `applyGrouping`/`applyGroupingAsync`.
- [ ] `npm run table:status` run and its diff committed (or `--dry-run` output reviewed and
      matches expectations before the real run).

---

← [Step 5: Tests](step-5-tests.plan.md)
