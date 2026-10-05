---
step: 5
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/3-ui/directives/tree.md (new)
  - libs/table/docs/3-ui/directives/expansion.md
  - libs/table/docs/3-ui/directives/grouping.md
  - libs/table/docs/3-ui/work/tree/active/tree-ui-layer/1-decisions.md
  - libs/table/docs/3-ui/work/tree/active/tree-ui-layer/2-spec.md
  - libs/table/docs/decisions/tree.md
  - libs/table/docs/status.md
  - llms.txt
---

# Step 5 — Tree UI spec and pointer updates

A new permanent tree UI spec documents the pair.
The expansion and grouping docs point at it.
The status and llms files are regenerated.

Decisions: [D1, D4, D5, D6, D7, D10, D11, D12](../../1-decisions.md)

## Do

- Write `tree.md` with frontmatter `capability: tree`, `spec: drilled`, `code: shipped`.
- `tree.md` sections:
  - The directive contract for both directives.
  - The attribute-ownership table (spec, Implementation Decisions).
  - Toggle-only as the default.
  - The whole-row `(click)` example, with one line saying the button's click bubbles to the row and the consumer must skip it.
  - The styling recipe (D10).
  - The dev checks (D7, D8, D13).
- `expansion.md`: narrow `ngpTableExpandable` and `ngpTableExpandToggle` to detail panels.
- `expansion.md`: remove its tree-row path (for example "Tree children, button toggle" and the DI-for-tree-rows notes).
- `grouping.md`, the "Collapse/expand a group" row (around line 36): point at `ngpTableTreeRow` and `ngpTableTreeToggle` in `tree.md`.
- `1-decisions.md`: append this line.

```md
- **D13** (2026-09-30, N4) — The nameless-button warning (D7) skips a disabled leaf toggle: it is aria-hidden (D6), so no assistive tech reaches it.
```

- `decisions/tree.md`: add one TR row for D13, using the next TR number and the format of the existing rows.
- `2-spec.md`, Testing Decisions seam 3: replace "Clicks use high-fidelity user events." with "Clicks use native `button.click()` in jsdom."
- `2-spec.md`, Accessible name bullet: add that disabled leaf toggles are skipped (D13).
- Regenerate with `npm run table:status` and `npm run llms`.

## Watch out

- Snippets bind `<tr [ngpTableRow]="row" ngpTableTreeRow>`, never a bare `ngpTableRow` beside the binding.
- In the styling recipe, say in one line that `--ngp-table-row-depth` comes from #182.

## Out of scope

- `core.md` changes and the changelog note (#182).
- Treegrid.

## Done when

- [ ] `npm run llms:check` is clean.
- [ ] `status.md` lists the tree UI spec.

---

← [Step 4: Collapsible-grouping story host uses the tree pair](step-4-grouping-story-host.plan.md)
