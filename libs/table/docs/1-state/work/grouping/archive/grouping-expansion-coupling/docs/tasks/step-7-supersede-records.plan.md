# Step 7 — Mark D11 and ADR-0011 superseded

**PR scope:** Two record edits so a stale rationale cannot be cited as current.
**Depends on:** Step 1 (nothing can point at ADR-0017 until it exists).
**Parallel-safe with:** Steps 3-6.
**Task type:** `docs`
**Skills used:** none
**Scaffolding agent:** none — main thread

## Files

| File | Action |
|---|---|
| `libs/shared/table/docs/1-state/work/with-grouping/2-decisions.md` | edit — mark D11 superseded (around line 163) |
| `libs/shared/table/docs/adr/0011-chained-render-stages.md` | edit — note partial supersession |

## Why This Step Exists

D11 documents `withGrouping()`'s read of `expandedRows` as a deliberate decision, justified by
stage order. ADR-0017 establishes that the real cause was a missing field, not a stage-order
constraint. Left unmarked, D11 reads as current and would be cited as precedent by the next person
who hits a cross-feature read — exactly the failure mode `.claude/rules/` warns about, where an
unguarded existing path gets mistaken for a convention.

ADR-0011 allocated stage responsibilities on the assumption that every render stage is
feature-claimable. ADR-0017 adds an engine-owned one, so that allocation is partly superseded.

## What To Do

### `docs/1-state/work/with-grouping/2-decisions.md`

Mark D11 superseded by ADR-0017. Follow whatever supersession marker this repo already uses for
decisions — check neighbouring entries in the same file and in sibling work folders before
inventing a format.

**Do not delete D11 or rewrite its reasoning.** The record of what was decided, and why it looked
right at the time, is the point. Add the marker, name the superseding ADR, date it.

One sentence on *what* changed is worth adding: the stage-order constraint D11 cited was real, but
it was a consequence of `RenderRow` carrying no parent link — not an independent reason to couple
the features.

### `docs/adr/0011-chained-render-stages.md`

Add a partial-supersession note. Scope it precisely: ADR-0011's chained-stage model stands; only
its allocation of stage responsibilities is amended, by the addition of an engine-owned terminal
stage that no feature can claim.

Follow the existing header convention in `docs/adr/` — check how other ADRs express status
relationships (ADR-0012's `**Related:**` line is one example) rather than introducing a new field.

## Implementation Notes

Both edits are additive markers. Neither file's existing content is rewritten.

This step is deliberately separate from Step 1 so that PR's diff is one new ADR and nothing else,
and so the record edits can land whenever the ADR exists rather than blocking on it being final.

## Risks / Watchouts

- **Do not overstate the supersession.** ADR-0011 is not superseded — one part of it is amended.
  An over-broad marker on a foundational ADR is worse than none, because it invites someone to
  treat the whole chained-stage model as up for revision.
- Do not touch `docs/1-state/features/grouping.md` or `features/expansion.md`. Their cross-feature
  caveats are still **true** at the end of this slice — grouping still reads `expandedRows` (D6).
  They are corrected in #99, when the caveat actually stops being true. Editing them here would
  make the docs lie.
- `docs/status.md` is generated from spec frontmatter. Neither file edited here carries that
  frontmatter, so no regeneration is needed — do not hand-edit `status.md`.

## Non-Goals

- No feature-spec updates (#99).
- No new ADR — Step 1 wrote it.
- No changes to `docs/1-state/architecture.md`; it is listed in `plan.md` B4 as a #99 doc update.

## Acceptance Checks

- [ ] D11 marked superseded by ADR-0017, dated, original reasoning left intact.
- [ ] D11's marker says what changed — the stage-order constraint was a consequence of the missing parent link, not an independent reason.
- [ ] ADR-0011 carries a partial-supersession note scoped to stage responsibilities only.
- [ ] Both markers follow existing repo conventions, not new formats.
- [ ] `features/grouping.md` and `features/expansion.md` untouched.
- [ ] `docs/status.md` not hand-edited.

---
← [Step 6: Feature + type tests](step-6-feature-tests.plan.md)
