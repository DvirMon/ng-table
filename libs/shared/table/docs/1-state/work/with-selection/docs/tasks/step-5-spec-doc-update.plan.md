---
title: "Step 5 — 3-spec.md: enableRowSelection() config + scope rules"
type: task-step
issue: 63
---

# Step 5 — `3-spec.md`: `enableRowSelection()` config + scope rules

**PR scope:** Parallel-safe with Step 3 (documents an already-settled decision, D58 — doesn't
read `with-selection.ts`).

**Task type:** docs

**Skills used:** none — handled directly, no agent

**Scaffolding agent:** none — main thread

## Files

- `libs/shared/table/docs/1-state/work/with-selection/3-spec.md` (edit)

## Why This Step Exists

The issue's acceptance criteria requires `3-spec.md` updated with the new config field and the
three scope rules. Keeps the spec in sync with D58, the same way `filtering.md` was brought back
in sync with shipped code for #62.

## What To Do

1. In `### Public surface`'s `WithSelectionConfig<TRow>` sketch, add `enableRowSelection` above
   `enableMultiRowSelection` (D58's own field order):
   ```ts
   enableRowSelection?: boolean | ((row: TRow) => boolean);   // default true
   ```
2. Under `### Decisions`, add a bullet for D58 (placed near the D8 bullet — the two rules are
   related but distinct, per `2-decisions.md`'s own framing), stating the three scope rules:
   - Gates id-adding writes only (`toggle`, `select`, the `initialSelection` seed) — never
     `deselect`/`clearSelection`, so a row that becomes non-selectable while selected stays
     escapable.
   - Write path, not read path — `selectedRows()` and `selectionStateOf()` stay unfiltered.
   - No reconcile — a row turning non-selectable while selected is not auto-deselected.
   Cite `2-decisions.md`'s D58 section the way other bullets cite their decision letters.
3. Under `## Testing Decisions` → Coverage, add the six new cases (mirrors Step 4's spec
   additions): blocked toggle, blocked select with a mixed id array, ungated deselect of a row
   that became non-selectable after being selected, gated seed, unresolvable id stays permissive,
   no emission on a fully-blocked write.
4. Leave `## Open questions` in `2-decisions.md` untouched — Q4 (denominator filtering) and Q5
   (blocked-vs-no-op asymmetry) remain genuinely open; this issue doesn't answer them.

## Implementation Notes

- Match the existing bullet style/citation format exactly (bold lead-in, decision letter, links
  to `2-decisions.md`).
- Don't touch `3-spec.md`'s frontmatter — it uses free-text `status:`, not the
  `capability`/`spec`/`code` triad (that belongs to `docs/1-state/features/selection.md`, which
  this issue doesn't touch).

## Risks / Watchouts

- Don't mark Q4/Q5 resolved — they stay open per `2-decisions.md`; resolving them isn't in scope
  for #63.
- `docs/1-state/features/selection.md` may also document `WithSelectionConfig` — check it, but
  only update it if the issue's acceptance criteria imply it (they name `3-spec.md` only). Flag
  rather than silently expanding scope if it also needs the field.

## Non-Goals

- Not resolving Q4 or Q5 — both explicitly carried forward as open questions.
- Not touching `docs/3-ui/directives/selection.md` (still a stub) — issue's own "Out of scope."

## Acceptance Checks

- [ ] `3-spec.md`'s Public surface sketch includes `enableRowSelection`.
- [ ] The three scope rules (id-adding-only, write-not-read, no-reconcile) are stated, citing
  D58.
- [ ] Testing Decisions → Coverage list includes the six new cases.
- [ ] `2-decisions.md`'s Open questions section is unchanged (Q4/Q5 still open).

---
← [Step 4: enableRowSelection() spec coverage](step-4-enable-row-selection-spec.plan.md)
