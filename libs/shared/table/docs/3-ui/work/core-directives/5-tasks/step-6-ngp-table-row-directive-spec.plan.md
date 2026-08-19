# Step 6: NgpTableRowDirective spec

## PR scope

`ngp-table-row.directive.spec.ts` — unit tests for the row identity anchor directive.

## Task type

test

## Depends on: Step 3

## Skills used

unit-test

## Scaffolding agent

test-implementer

## Files

- `libs/shared/design-system/src/ui/table/docs/3-ui/directives/ngp-table-row.directive.spec.ts` (new)

Per `table/CLAUDE.md` — structural/directive tests live under `docs/3-ui/directives/`, not colocated with the directive source (unlike store/feature logic specs, which stay flat next to their source file).

## Why This Step Exists

`rowId` / `isGroupHeader` are computed signals feeding row-scoped feature directives (expansion, selection — later issues) and the `data-row-kind`/`data-depth` host bindings feed styling. Both are logic worth locking down directly per the `unit-test` skill's policy (computed state, guarded outputs).

## What To Do

Cover:

- `rowId` computed returns `renderRow().id` for a data row.
- `isGroupHeader` computed returns `false` for a data row (`kind: 'row'`) and `true` for a group row (`kind: 'group'`).
- Host bindings render `data-row-kind` and `data-depth` attributes on the `<tr>` matching `renderRow().kind` / `renderRow().depth`.
- A descendant that injects `NGP_TABLE_ROW` resolves to the host `NgpTableRowDirective` instance, matching Step 5's DI pattern.

Use a test host component with `<tr [ngpTableRow]="renderRow">`, updating the bound `renderRow` signal between assertions to confirm the computeds and host bindings stay reactive (not computed once at init) — this matters because CDK virtual scroll recycles `<tr>` nodes with a new `renderRow` input rather than creating a fresh directive instance.

## Implementation Notes

- Build minimal `RenderRow<unknown>` fixtures inline (or in a small local const) — no need for a full mock fixture file for two shapes (data row, group row).

## Risks / Watchouts

- Don't skip the reactivity check (changing `renderRow` after initial render) — a non-reactive implementation (e.g. a plain getter instead of `computed`) would still pass a single-assertion test.

## Non-Goals

- No test for `ngpTable` (Step 5, already covered) or feature directives from later issues.

## Acceptance Checks

- [ ] Test confirms `rowId` computed
- [ ] Test confirms `isGroupHeader` computed for both `row` and `group` kinds
- [ ] Test confirms `data-row-kind` / `data-depth` host bindings
- [ ] Test confirms computeds/host bindings update when `renderRow` input changes
- [ ] Test confirms `NGP_TABLE_ROW` resolves to the directive instance via DI
- [ ] `nx test shared-design-system` passes for this spec

---
← [Step 5: NgpTableDirective spec](step-5-ngp-table-directive-spec.plan.md)
