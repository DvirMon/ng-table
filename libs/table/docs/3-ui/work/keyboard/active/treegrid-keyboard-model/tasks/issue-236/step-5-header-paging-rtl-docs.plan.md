---
step: 5
type: docs
commit: docs
depends_on: [4]
files:
  - libs/table/docs/3-ui/directives/core.md
---

# Step 5 — Header, paging and RTL docs

Documents the header row in arrow navigation, Page Up/Down and RTL.
Tree, expansion and sort docs are left to later slices.

Decisions: K4, K4b, K7, K39, K40

## Do

In `core.md`, extend the grid navigation section (it starts near "The body is a `grid` of `gridcell`s with one Tab stop"):

- The header row is an arrow stop: ↑ from the first data row reaches the same-column header cell; ↓ returns to the same column; ←/→/Home/End move across header cells; no wrap.
- Ctrl (Cmd) + Home goes to the first header cell; Ctrl (Cmd) + End to the last cell of the last row.
- Page Up / Page Down move by the visible row count in the same column and stop at the first or last row. The count is measured from the nearest scrollable ancestor at keypress; fallback 10. Page keys on a header cell do not move.
- Under RTL (computed `direction` of the host, read at keypress) ←/→ swap meaning.
- Update the "Header rows" paragraph so it says the header cells are focus targets, not rows.

## Watch out

Describe shipped behavior only. Leave the `withVirtualScroll()` visible-range step out; it is not built.

## Out of scope

- `tree.md`, `expansion.md`, `sort.md`.

## Done when

- `core.md` matches shipped behavior.
- `npm run llms:check` is clean (the user runs it).
