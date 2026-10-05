---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/api/features/with-tree.ts
  - libs/table/src/api/features/with-tree.spec.ts
  - libs/table/src/mutations/row-mutations.ts
  - libs/table/src/mutations/row-mutations.spec.ts
---

# Step 3 — `table.tree.parentOf` / `descendantsOf` and `removeRow(id[])`

This step adds read-only parent and descendant lookups to
`table.tree`, and widens `removeRow` to accept an array of ids
so a consumer can cascade-delete a subtree in one write.
It leaves `patchRow(id[])` and `batch()` unbuilt.

Decisions: [D12](../../1-decisions.md), [D20](../../1-decisions.md), row-mutations [D32](../../../../../../row-mutations.md).

## Do

- Add to `TreeSlice`:

  ```ts
  parentOf(id: RowId): RowId | null;
  descendantsOf(id: RowId): RowId[];
  ```

  Both read-only. They walk all of `data()` through
  `resolveTreeLinks`, so `withTree`'s input type widens from
  `Pick<TableStore, 'rows' | 'trackBy'>` to also include
  `value`.

- `descendantsOf` returns every descendant at any depth,
  depth-first in `data()` order, parent before child, never
  including the row itself.
- An id not present in `data()` resolves to `null` /
  `[]`. Neither read ever reports.
- Give `removeRow` an array overload, modeled on `insertRow`'s
  array overload:

  ```ts
  table.value.update(removeRow(['r1', ...table.tree.descendantsOf('r1')]));
  ```

  One write. Ids not present in the rows are skipped.

## Watch out

- The spec/issue text says `removeRows` — the correct exported
  name is `removeRow`, called with an array. Step 6 fixes the
  docs that still say `removeRows`.
- `parentOf` and `descendantsOf` must read `value()`, not the
  pipeline's `rows()` — a row a filter dropped still counts.

## Out of scope

- `patchRow(id[])` and `batch()` — D32's other halves.
- `contextRowIds()` (#169).

## Done when

- [ ] Seams A through K in `step-3-tree-reads.test-plan.md` pass.

---

← [Step 2: withTree({ parentId }) nests flat rows](step-2-with-tree-parent-id.plan.md) | [Step 4: Move the grouping story fixture to flat rows](step-4-grouping-story-flat-fixture.plan.md) →
