---
step: 9
type: docs
commit: docs
depends_on: [2, 8]
files:
  - libs/table/docs/1-state/features/tree.md
  - libs/table/docs/1-state/work/tree/active/tree-flat-data/1-decisions.md
  - libs/table/docs/decisions/tree.md
  - libs/table/docs/1-state/work/tree/active/tree-flat-data/3-architecture.md
  - libs/table/docs/adr/0028-tree-parent-link-slot.md
---

# Step 9 — Docs and decisions

This step documents the shipped reveal behaviour and records decisions D26 to D28.
It leaves stories and `filtering.md` alone.

Decisions: [D20, D26, D27, D28](../../1-decisions.md), [capability log](../../../../../../../decisions/tree.md)

## Do

- In `tree.md`, document:
  - reveal and `revealContextRow`;
  - closing a revealed row;
  - `contextRowIds`;
  - `expand` and `state` with `includeHidden`.

  Give it a short usage snippet.

- Append D26, D27 and D28 to `1-decisions.md`:
  - D26: `TreeSlice.state` becomes a method, `state(options?: { includeHidden?: boolean })`. The default scans the filtered view. `includeHidden` scans all of `data()`. The options bag is inline.
  - D27: `StageContext` gains `contextRows?(): ReadonlySet<RowId>`, the engine's union of every `contextRows` contribution, empty when none. `withTree()` reads the slot through it without reading `withFiltering()`'s members. It is read lazily, never in the factory body.
  - D28: an open-set write (`expand(ids)`, `expand()`, `set(ids)`) also drops every id it names from the closed-while-revealed set, so the row shows open. `collapse` writes only the open set. A throwing `revealContextRow` reveals the row and reports once per evaluation (ADR-0014).
- Add three rows to the capability log `decisions/tree.md`, one per decision, in the log's existing row format.
- In `3-architecture.md`, mark OQ-A4 resolved by D26.
- In `0028-tree-parent-link-slot.md`, add one consequence line for `ctx.contextRows`.

## Watch out

- The capability log has its own numbering. Take the next free number from the log itself.
- Keep the D-number in each new row's Record column, so older references resolve.

## Out of scope

- Stories.
- `filtering.md`, which this issue leaves unchanged.

## Done when

- [ ] Each doc describes the shipped behaviour.
- [ ] OQ-A4 no longer reads as open.

---

← [Step 8: state() includeHidden](step-8-state-include-hidden.plan.md)
