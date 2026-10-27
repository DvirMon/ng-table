---
step: 2
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/1-state/features/expansion.md
  - libs/table/docs/decisions/expansion.md
---

# Step 2 — Document the follow-focus rule

Records K11 in the permanent expansion docs. Code is step 1.

Decisions: K11, K19, K20

## Do

- `1-state/features/expansion.md` § "Single-open (`multi`)": add the rule — while one panel is open in single-open mode, moving `table.focus()` to another data row switches it to that row; with none open, focus opens nothing; group headers, header cells and panel targets never switch it; works the same for inline and side panels. Link K11 in the workspace decisions log.
- `decisions/expansion.md`: append the next free E-row (read the file's own numbering and its append rules at the bottom; never renumber). One line: single-open panel follows the focused data row while open (K11), status `decided · #234`, source link to the workspace `1-decisions.md` K11.

## Out of scope

- `3-ui/directives/expansion.md` panel arrow-stop rewrite (#241).

## Done when

- Both files carry the rule; links resolve.
