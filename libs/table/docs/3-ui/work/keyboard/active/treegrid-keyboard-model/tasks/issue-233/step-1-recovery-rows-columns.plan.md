---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/focus.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/api/create-table.spec.ts
---

# Step 1 — Focus recovery: rows and columns

The engine repairs `table.focus()` when rows or columns change: deleted or filtered rows, moved rows,
an empty table, hidden or reordered columns. Collapse is step 2, closed panels step 3.

Decisions: K9a, K9c, K9d, K9e, K21, K22, K23

## Do

- `engine/focus.ts`: add pure `recoverFocus(current, prev, next)`. Returns `FocusTarget | null`. No signals.
- `prev` and `next` each carry the `renderRows()` array (`RenderRow[]`, so ids, depth, `isExpanded` and `data` are available to step 2) and the `renderColumns()` ids.
- `next` also carries the `rows()` id set.
- `current === null` returns `null`. Nothing focused stays unfocused.
- Row half (body and panel targets): if the row id is still in next render rows, keep it. It follows the row by id (K9c).
- Otherwise take the row now at the row's old index in `prev`, clamped to the last row. Keep the column. Keep the area: a panel target becomes a panel target on the new row (step 3 converts closed panels).
- Until step 2, this also covers rows still in `rows()` but not rendered.
- No render rows: return `{ area: 'header', columnId: renderColumns()[0].id }`, or `null` with no rendered columns.
- Column half, independently (body targets with a non-null `columnId`, and header targets): if the column id is still rendered, keep it. Otherwise take the column now at its old index, clamped.
- `columnId: null` stays `null`.
- Validate the result with `findUnrenderedId`. An invalid result (for example no rendered column left) returns `null`. Never throws.
- `compose-table.ts`: `createFocus` also returns its internal writable `target` signal. The store member is unchanged.
- Add one unconditional `effect()` after the fold. It holds the previous render rows and render columns in closure variables, seeded before the effect is created (same trick as `previousIds`).
- Each run computes `recoverFocus` and writes `target` only when the result differs.
- It writes `target` directly, never `moveTo`. So there is no console report and no `focusRequests` bump.

```ts
const table = createTable(data, { trackBy: 'id', columns });
table.focus.moveTo({ area: 'body', rowId: 'r2', columnId: 'status' });
data.update((rows) => rows.filter((r) => r.id !== 'r2'));
// after effects flush: table.focus() → { area: 'body', rowId: 'r3', columnId: 'status' }
```

## Watch out

- Recovery keys off `renderRows()` and `rows()`, never `data` or `indexById`. A filter changes neither.
- Compare against the previous order, not the new one, for the old index.
- `header` targets have no `rowId`. Branch on `area` first.
- Recovery writes the store only. DOM focus is the directive's job (K9d).

## Out of scope

- Collapse to ancestor (step 2), closed panel (step 3), DOM and directives, docs (step 4).

## Done when

- The test plan is green.
- `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` clean.
