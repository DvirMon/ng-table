---
step: 7
type: docs
commit: docs
depends_on: [4, 5]
files:
  - libs/table/docs/1-state/features/filtering.md
  - libs/table/docs/1-state/features/tree.md
---

# Step 7 — Feature docs

This step documents tree retention in the filtering and tree feature docs.
It leaves reveal to #169.

Decisions: [D5, D9, D18, D21](../../1-decisions.md)

## Do

- In `filtering.md`, describe:
  - tree retention: each match plus its ancestors, in input order
  - `includeDescendants`
  - context rows
  - that `manual` computes none
- In `tree.md`, describe:
  - `RenderRow.isContextRow`
  - `ngpTableTreeRow` and its `data-context-row` attribute
  - `hasChildren`, which comes from the filtered view
- Give each doc a short usage snippet.
- Leave ADR-0028 and `CONTEXT.md` alone. They already cover the slot and the glossary term.

## Out of scope

- Reveal (#169).

## Done when

- [ ] Both docs describe the behaviour with a short usage snippet.

---

← [Step 6: hasChildren follows the filtered view](step-6-filtered-has-children.plan.md)
