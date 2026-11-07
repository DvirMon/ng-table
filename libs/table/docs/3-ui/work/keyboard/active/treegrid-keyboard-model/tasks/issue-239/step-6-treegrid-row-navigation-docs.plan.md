---
step: 6
type: docs
commit: docs
depends_on: [2, 3, 4, 5]
files:
  - libs/table/docs/3-ui/directives/tree.md
  - libs/table/docs/3-ui/directives/core.md
  - libs/table/docs/decisions/tree.md
---

# Step 6 — Treegrid row navigation docs

Documents row focus, the row keys, the pointer-only toggle and the row Tab walk.
Expansion and sort docs are left alone.

Decisions: K4, K5, K5b, K6a, K14b

## Do

In `tree.md`:

- The host is a `treegrid`. Rows and cells are both stops.
- Add a key table: → expands a collapsed row, → on an expanded or leaf row enters the first cell, ← collapses an expanded row, ← on a collapsed or leaf row goes to the parent, Enter toggles an expandable row and does nothing on a leaf.
- `aria-level` and `aria-expanded` are on the row.
- The toggle is pointer-only: `tabindex="-1"`, `aria-hidden`, no `aria-expanded`. A click focuses the row.
- Tab on a focused row walks its widgets, then leaves the grid.
- RTL swaps expand and collapse.

In `core.md`:

- The role is `treegrid` if and only if `withTree()` is composed.
- The row is a focus target in the arrow order.
- ↑ from the first row goes to the first header cell.

Register this run's decisions as rows in `libs/table/docs/decisions/tree.md`, per `~/.claude/conventions/doc-contracts/decisions-log.md`. Use that log's own numbering; read its latest rows first.

## Watch out

- Describe shipped behavior only.
- `docs/status.md` is generated. Never edit it.

## Out of scope

- `expansion.md` and `sort.md`.
- Group-header and panel stops (#240, #241).

## Done when

- The docs match shipped behavior.
- `npm run llms:check` is clean (the user runs it).
