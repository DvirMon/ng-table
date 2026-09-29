---
step: 6
type: docs
commit: docs
depends_on: [3, 5]
files:
  - libs/table/docs/1-state/features/tree.md
  - libs/table/docs/1-state/features/expansion.md
  - libs/table/docs/1-state/features/grouping.md
  - libs/table/docs/1-state/architecture.md
  - libs/table/docs/0-product/tree.md
  - libs/table/docs/1-state/row-mutations.md
  - libs/table/docs/1-state/work/expansion/active/tree-flat-data/2-spec.md
---
# Step 6 — Docs: flat-data tree contract

This step updates the tree feature's docs to describe the
`parentId` contract and removes stale `childrenAccessor`
mentions across the state layer.
It leaves ADRs and decisions logs untouched — those are
historical records.

Decisions: [D1](../../1-decisions.md), [D3](../../1-decisions.md), [D4](../../1-decisions.md), [D12](../../1-decisions.md), [D15](../../1-decisions.md), row-mutations [D32](../../../../../../row-mutations.md).

## Do

- `features/tree.md`: document the `parentId` contract, the
  broken-link degrade rule, `parentOf` / `descendantsOf`, and a
  nested-to-flat migration snippet. Drop the open question
  about cycles — it's settled now.
- `features/expansion.md`, `features/grouping.md`,
  `architecture.md`, `0-product/tree.md`: replace
  `childrenAccessor` mentions with `parentId`.
- `row-mutations.md`: move `removeRow(id[])` out of "Not
  Shipped". `patchRow(id[])` and `batch()` stay listed as not
  shipped.
- `2-spec.md`: change `removeRows([...])` to `removeRow([...])`.

## Watch out

- ADRs (0012, 0023) and decisions logs are historical records —
  don't edit them to match the new contract.

## Out of scope

- Any ADR content.
- Any capability decisions log.

## Done when

- [ ] No `childrenAccessor` remains in the files above, except
      where noted as removed/history.
- [ ] `npm run llms:check` is listed here as a check for the
      user to run — do not run it.

---
← [Step 5: Remove childrenAccessor](step-5-remove-children-accessor.plan.md)
