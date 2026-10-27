---
step: 4
type: docs
commit: docs
depends_on: [2, 3]
files:
  - libs/table/docs/3-ui/directives/core.md
  - libs/table/docs/3-ui/cross-cutting/accessibility.md
---

# Step 4 — Grid navigation docs

Documents the grid roles, the one Tab stop and the core keys.
Tree, expansion and sort docs are left to later slices.

Decisions: K1, K3, K3b, K4, K6b, K9d, K12c, K21

## Do

`core.md`:

- Host role `grid`, cells `gridcell`.
- One Tab stop through a roving tabindex. First entry is the first data row's first cell; later it is the last focused cell.
- Keys: arrows, Home / End, Ctrl (Cmd) + Home / End. No wrap.
- A click moves the position.
- DOM focus follows only when focus is inside the grid or `focusElement: true`.
- `preventDefault()` on a key keeps the grid out of it.

`accessibility.md`: in the "`role="table"` vs `role="grid"`" section, replace the table-by-default decision with a pointer to ADR-0030 (grid always; treegrid with `withTree()`).

## Watch out

None.

## Out of scope

- `tree.md`, `expansion.md`, `sort.md` (later slices).

## Done when

- Both docs match shipped behavior.
- `npm run llms:check` is clean (the user runs it).
