---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/api/features/with-expansion.ts
  - libs/table/src/api/features/with-expansion.spec.ts
---

# Step 1 — Single-open panel follows focus

`withExpansion` in single-open mode switches its one open panel to the newly focused data row.
Docs are step 2.

Decisions: K11, K8a, K19, K20

## Do

- Widen `ExpansionInput` to `Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy' | 'focus' | 'indexById'>` (and the matching `buildExpansionSpec` input type).
- Add a named function `followFocus()` beside `onMultiChanged`, run as a second setup effect (setup returns both effects, or setup registers both).
- It reads `input.focus()` tracked. It reads `multi()`, `store.expanded()` and `input.indexById()` inside `untracked`.
- It switches only when all hold, each written as its own named const: single-open; exactly one row open; target `area === 'body'`; target `rowId` differs from the open id; `indexById().has(rowId)` (a data row — group-header ids are synthetic and absent).
- It writes `store.setExpanded([rowId])` with default options, so `changed` emits as for any write.
- Add one JSDoc line to `WithExpansionConfig.multi`: with `false`, an open panel follows `table.focus()` to the next focused data row; with none open, focus opens nothing.

```ts
const table = createTable(data, config, withExpansion({ multi: false }));
table.expansion.toggle('r1');
table.focus.moveTo({ area: 'body', rowId: 'r2', columnId: 'name' });
// after effects flush: [...table.expansion()] → ['r2']
```

## Watch out

- Track only `focus()`. If `expanded()` is tracked, `toggle('r2')` while focus rests on r1 snaps the panel back to r1.
- A `header` target has no `rowId`; check `area` before reading it.
- `focus()` is `null` until first set.

## Out of scope

- DOM, directives, panel arrow stop (#241). Feature/decisions docs (step 2).

## Done when

- The test plan is green.
- `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` clean.
