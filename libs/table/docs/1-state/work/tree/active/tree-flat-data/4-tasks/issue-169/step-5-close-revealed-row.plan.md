---
step: 5
type: code
commit: feat
depends_on: [4]
files:
  - libs/table/src/api/features/with-tree/reveal.ts
  - libs/table/src/api/features/with-tree/feature.ts
  - libs/table/src/api/features/with-tree/feature.spec.ts
---
# Step 5 — Close a revealed row

This step lets a person close a row that reveal opened.
How `expand`, `set` and `collapse` treat that closed state is Step 6.

Decisions: [D20 (c)](../../1-decisions.md) (spec story 28)

## Do

- Add an internal closed-while-revealed set to `reveal.ts`.
- Make `toggle(id)` on a currently revealed id flip that id in the closed set. It does not write the open set, and `changed` does not fire. A toggle on any other id is unchanged.
- Build the closed set as a `linkedSignal`:
  - its source is the context-id set;
  - its computation keeps only the previous ids that are still in the new set.
- Contribute `expandedRows` as (open ∪ revealed) − closed.

## Watch out

- Branch on "is currently revealed", not on "is a context row".
- A `linkedSignal` recomputes only when it is read.

## Out of scope

- How `expand`, `set` and `collapse` interact with the closed set (Step 6).

## Done when

- [ ] A closed revealed row stays closed while it stays a context row.
- [ ] It is revealed again after it stops being a context row and later comes back.

---
← [Step 4: Reveal context rows](step-4-reveal-context-rows.plan.md) | [Step 6: Open-set writes clear closed rows](step-6-open-writes-clear-closed.plan.md) →
