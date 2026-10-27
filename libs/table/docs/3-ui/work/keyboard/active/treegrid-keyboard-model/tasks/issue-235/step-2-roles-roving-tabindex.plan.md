---
step: 2
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-cell.directive.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts (new)
---

# Step 2 — Roles + roving tabindex

Sets `grid` / `gridcell` roles and makes the table one Tab stop with a roving `tabindex`.
Keys, `focusin` and DOM focus are left to step 3.

Decisions: K1, K3, K21, K23

## Do

`ngpTable`: host role becomes `grid` on every table. Update its JSDoc (it says `role="table"`).

`ngpTable` exposes the position the Tab stop sits on.

```ts
readonly activeTarget: Signal<FocusTarget | null>;
```

- `focus()` as is, when non-null.
- Otherwise the first non-group render row's first render column: `{ area: 'body', rowId, columnId }`.
- `null` when there are no non-group rows or no render columns.

`ngpTableCell`:

- role `gridcell`.
- Inject `NGP_TABLE_ROW` with `{ optional: true }` and `NGP_TABLE_STORE`.
- Column id is `renderColumns()[ngpTableCell()].id`.
- Bind `[attr.tabindex]`: `0` when it matches `activeTarget` (body area, same `rowId` and `columnId`), else `-1`.
- No row, or row kind `'group'`: bind `null` (no attribute).

This step creates `ngp-table.directive.spec.ts`.

## Watch out

A header or panel `focus()` leaves no body `tabindex="0"`. That is intended until #236 and the panel slice. No fallback.

Stale specs under `libs/table/docs/3-ui/directives/*.spec.ts` assert `role="table"` / `"cell"`. They are outside `src/` and not compiled. Leave them.

## Out of scope

- Header cells (#236).
- Keys, `focusin`, DOM focus (step 3).
- Treegrid role (#239).
- Group stops (#240).

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `ngp-table.directive.spec.ts` passes.
