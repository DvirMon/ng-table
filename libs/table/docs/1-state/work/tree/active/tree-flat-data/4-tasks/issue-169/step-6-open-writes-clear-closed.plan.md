---
step: 6
type: code
commit: feat
depends_on: [5]
files:
  - libs/table/src/api/features/with-tree/reveal.ts
  - libs/table/src/api/features/with-tree/feature.ts
  - libs/table/src/api/features/with-tree/feature.spec.ts
---

# Step 6 — Open-set writes clear closed rows

This step makes the writes that open rows also clear them from the closed-while-revealed set.
`includeHidden` is Step 7.

Decisions: [D28](../../1-decisions.md)

## Do

- Make `expand(ids)`, `expand()` and `set(ids)` write the open set as before.
- In the same write, drop every id they name (or discover) from the closed-while-revealed set.
- Leave `collapse` writing only the open set.

## Watch out

- Clear named ids, not only newly added ones. An id already in the open set is still cleared. `changed` stays silent for it, because the open set did not change.
- `expand` and `set` have separate bodies. Both need the clear.

## Out of scope

- `includeHidden` (Step 7).

## Done when

- [ ] `expand(['c1'])` shows a row the person closed while revealed as open.
- [ ] `set(['c1'])` shows it as open too.

---

← [Step 5: Close a revealed row](step-5-close-revealed-row.plan.md) | [Step 7: expand() includeHidden](step-7-expand-include-hidden.plan.md) →
