---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/engine/focus.ts (new)
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/api/create-table.spec.ts
  - libs/table/src/table.mock.ts (only if r1/r2 fixture rows are needed)
---

# Step 2 — Unrendered target degrades

`moveTo` ignores a target whose row or column is not rendered, and reports it once.
Recovery when rows change is left to #233.

Decisions: K17 (and ADR-0014)

## Do

Add a pure helper in `engine/focus.ts`: `findUnrenderedId(target, renderedRowIds, renderedColumnIds)`.
It returns the first id that is not rendered, or `undefined`.

- Row id: checked against the `renderRows()` ids, for body and panel targets.
- Column id: checked against the `renderColumns()` ids, for header targets, and for body targets only when `columnId` is non-null.

`moveTo` calls it. On a hit, it writes nothing, logs one `console.error` naming the id, and returns.
Use the message prefix style of `engine/cells.ts`.

`moveTo` never throws.
The check is not gated by `ngDevMode`.
Every rejected call reports; there is no lifetime dedupe.

## Watch out

Check `renderRows()` and `renderColumns()`, not `rows()`, `indexById` or `columns()`.

Do not copy the once-per-lifetime dedupe from `engine/grouping/render.ts`.

`engine/focus.ts` stays pure: no signals.

## Out of scope

- Whether a panel is actually open (expansion state).
- Recovery when rows change (#233).

## Done when

- The test plan is green.
- Both typecheck targets are clean.
