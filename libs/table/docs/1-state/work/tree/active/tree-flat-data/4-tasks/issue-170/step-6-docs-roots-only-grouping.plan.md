---
step: 6
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/adr/0028-tree-parent-link-slot.md
  - libs/table/docs/decisions/tree.md
  - libs/table/docs/decisions/grouping.md
  - libs/table/docs/1-state/features/grouping.md
  - libs/table/docs/1-state/features/tree.md
  - libs/table/docs/1-state/work/tree/active/tree-flat-data/1-decisions.md
  - libs/table/docs/1-state/work/tree/active/tree-flat-data/3-architecture.md
  - libs/table/CLAUDE.md
---
# Step 6 — Record the roots-only grouping contract

This step records the roots-only grouping contract and the four planning decisions P1 to P4.
It touches no code.

Decisions: [TR16](../../../../../../../decisions/tree.md), [TR17](../../../../../../../decisions/tree.md), [TR18](../../../../../../../decisions/tree.md), [D13, D14, D15](../../1-decisions.md).

## Do

- `adr/0028-tree-parent-link-slot.md`: add to the consequences that feature factories receive the slot as `ctx` (P1).
- Work-folder `1-decisions.md`: add P1 to P4 as new D-numbered entries, using the next free D numbers, dated 2026-09-29.
  - P1: the engine passes `StageContext<TRow>` to every feature factory as a required second argument `(input, ctx)`. `ctx.parentOf` is a lazy getter over `handle.parentLink.value`.
  - P2: `ctx` is required on the `Feature` call signature, so a forgotten forward fails to compile.
  - P3: `ClusterOpts` carries the link as one field, `treeLinks?: { readonly parentOf; readonly trackBy }`, so a half-set pair cannot be written.
  - P4: rows inside a group bucket keep input order. The `'tree'` render stage owns hierarchy order.
- `decisions/tree.md`: add log rows for these decisions, using the next TR numbers.
- `decisions/grouping.md`: add the relevant row, using that log's own G numbering.
- `features/grouping.md` and `features/tree.md`: state that grouping a tree groups roots only, that the group count and `aggregateFn` include descendants, and that buckets keep input order.
- `3-architecture.md`: mark OQ-A1 resolved as B2, and correct the Grouping section's "contiguous after it" wording to input order.
- `libs/table/CLAUDE.md`, "Feature plugin pattern": show the factory signature as `(input, ctx)` with one line on `ctx`. State the invariant only, no status.

## Watch out

- Keep each decision in one place. The logs hold the rationale; the feature docs hold the contract.

## Out of scope

- Code.

## Done when

- [ ] Every decision P1 to P4 has a log row.

---
← [Step 5: Show roots-only grouping in the collapsible story](step-5-story-roots-only-grouping.plan.md)
