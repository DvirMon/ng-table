---
step: 6
type: docs
commit: docs
depends_on: [5]
files:
  - libs/table/docs/3-ui/stories.md
  - libs/table/docs/0-product/tree.md
  - libs/table/docs/0-product/filtering.md
  - llms.txt
---
# Step 6 — Story conventions and coverage marks

Records the Tree stories in the story conventions and re-marks the product coverage.
Makes no code changes.

Decisions: [TR43](../../../../../../../decisions/tree.md)

## Do

Edit list: see [story-plan.md](story-plan.md) "Doc edits this plan owes".

- `3-ui/stories.md`:
  - add the `tree/` file layout, its shared-file table row and its reference implementations;
  - fix the stale `grouping-collapsible/` line that mentions `withExpansion()`.
- `0-product/tree.md`: re-mark 1.1 to 1.3, 1.5, 1.7 to 1.9, 2.1 to 2.4, 2.6 and 3.1, and the U2 coverage mark.
- `0-product/filtering.md`: re-mark F-T1.
- Regenerate `llms.txt` with `npm run llms`.

## Watch out
- Re-mark from the story code that landed in Steps 2 to 4, not from the plan.
- 1.7 stays partly covered: depth announcement is unmet by design.
- 1.6 stays uncovered (U6 belongs to #202).

## Out of scope
- Marking 1.4, 1.6, 2.5, 3.2, 4.3, 4.4, E-T1 or E-1 as covered.
- Hand-editing `docs/status.md`.
- Any file under `src/`.

## Done when
- [ ] `stories.md` lists the `tree/` layout and no longer says `grouping-collapsible/` uses `withExpansion()`.
- [ ] The re-marked rows in `tree.md` and `filtering.md` match the shipped stories.
- [ ] `npm run llms:check` is clean.

---
← [Step 5: Tree docs page](step-5-tree-docs-page.plan.md)
