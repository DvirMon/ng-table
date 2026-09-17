# Step 3: `with-expansion.spec.ts`

## PR scope

Test coverage for `withExpansion()`, through the public `createTable()` surface only.

## Task type

test

## Depends on: Step 1

## Skills used

unit-test, angular-developer

## Scaffolding agent

test-implementer

## Files

- `libs/shared/design-system/src/ui/table/with-expansion.spec.ts` (new)

## Why This Step Exists

Issue #5's acceptance criteria requires: "Tests go through the public `createTable()` surface
only, via `TestBed`" and `nx test shared-design-system` passing. Mirrors
`with-sorting.spec.ts`'s structure (`TestBed`, `createTable()` + the feature under test, no
reach into private internals).

## What To Do

Set up per `with-sorting.spec.ts`'s pattern: a `Row` fixture with an optional `children: Row[]`
field, a `makeRows()` helper building a small tree (at least one row with nested children, at
least one leaf with none), `TestBed` + `createTable(signal(rows), () => ({ trackBy: 'id',
columns, features: [withExpansion()] }))`.

Cover, one `it()` per line:

- `toggleExpanded(id)` flips a row from collapsed to expanded and back
- expanding row A does not collapse row B (multi-expand)
- `expandAll()` expands every row that has children, leaves leaves alone
- `collapseAll()` clears all expansion regardless of prior state
- `rowExpanded` emits the toggled `RowId` on both expand and collapse (subscribe before
  toggling, assert emitted value)
- `renderRows()` excludes a row's children when collapsed (default state)
- `renderRows()` includes a row's children, at `depth + 1`, only once that row is expanded
- nested/grandchild case: a depth-2 child only appears once *both* its ancestors are expanded
  independently
- `hasChildren` is `true` only for rows with a non-empty children array; `isExpanded` matches
  `expandedRows` membership
- custom `childrenAccessor` is honored (row shape where children live under a different key)
- feature composes with zero other features present — `createTable({ features: [withExpansion()] })`
  alone works end-to-end

## Implementation Notes

- Use `signal(rows)` for the data input, matching `with-sorting.spec.ts` — not a plain array,
  so `TestBed` injection context requirements are met the same way.
- Assert `renderRows()` via the store instance's `renderRows` signal — do not read
  `store.rows()` for expansion-visibility assertions, that signal is deliberately unaffected by
  expansion state per spec.

## Risks / Watchouts

- Don't assert on `RenderRow` field order or exact object identity — compare relevant fields
  (`id`, `depth`, `data`, `hasChildren`, `isExpanded`) explicitly.

## Non-Goals

- UI-layer/directive tests — no directive exists yet (separate ticket).

## Acceptance Checks

- [ ] All cases in "What To Do" implemented and passing
- [ ] `nx test shared-design-system` passes

---
← [Step 2: Barrel export](step-2-barrel-export.plan.md) | [Step 4: Update with-expansion.md](step-4-update-spec-doc.plan.md) →
