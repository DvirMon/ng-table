# Tree parent-link slot

`withTree()` contributes a parent-link slot to the table engine using the same pattern as `expandedRows`. The `filter` stage runs before the `'tree'` render stage and needs to keep ancestors of matching rows; without a shared parent link, filtering cannot retain context rows. Filtering's `includeDescendants` option and future hierarchy-aware stages reuse the same engine slot.

## Alternatives considered

- `withFiltering({ parentId })` — consumer passes parent accessor to filtering too. Rejected: the same accessor is configured twice and the two copies can drift.
- A `withTree()` stage after `filter` that re-adds ancestors from `data()`. Rejected: filter's output stops being final, so counts and select-all read after filter disagree with what renders.

## Consequences

- `includeDescendants` lives on `withFiltering()`, the feature whose output changes.
- With ancestor retention, filtering never orphans a row; orphans come only from broken parent data, which degrades to root (ADR-0014).
- Post-filter row counts and select-all include context rows, matching what renders.
- `withGrouping()`'s `group` stage is the second consumer: with the slot present it groups roots only, and each subtree follows its root.
- The same pattern carries the reverse fact: `withFiltering()` contributes the set of context-row ids as an accumulating engine slot, which the engine stamps as `RenderRow.isContextRow` and `withTree()` reads for reveal (#163 architecture A2).
- Without `withTree()` the slot is absent and filtering is unchanged.
