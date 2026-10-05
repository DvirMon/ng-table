---
title: 'Step 1 — export the four group-level updaters from index.ts'
type: task-step
plan: ../../1-gap-analysis.md
node: C2
---

# Step 1 — export the four group-level updaters from `index.ts`

**PR scope:** One barrel edit. No behaviour change.

**Task type:** code

**Skills used:** typescript-conventions

**Depends on:** —
**Parallel-safe with:** Step 2, Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/index.ts` (edit)

## Why This Step Exists

Node C2. `setGroupLevels`, `addGroupLevel`, `removeGroupLevel` and `reorderGroupLevels` ship in
`src/mutations/update-grouping.ts` and are tested, but none is on the public surface — verified
2026-09-13. The column updaters beside them are exported (`index.ts`, `setColumns` /
`reorderColumns` / `toggleColumnVisibility`). Step 4's "Group by this column" control, the level
pills and "Reset levels" are what a consumer copies, so they cannot import from `mutations/` by
path.

## What To Do

1. Add one export block next to the existing `update-columns` block:

   ```ts
   export {
     setGroupLevels,
     addGroupLevel,
     removeGroupLevel,
     reorderGroupLevels,
   } from './mutations/update-grouping';
   ```

2. Export any parameter/option types those four take if they are not already reachable from
   `api/types`. Do not widen or rename the functions — the surface was reviewed as correct, not
   re-litigated.

## Implementation Notes

`index.ts` is the only definition of the consumer surface (its own header comment). Keep the
grouping block adjacent to the column-updater block so the two read as siblings.

## Risks / Watchouts

- Do not re-export from a new barrel under `mutations/` — there are no sub-barrels in this lib.

## Non-Goals

- No signature change, no new mutation, no docs (Step 8 owns docs).

## Acceptance Checks

- [ ] The four updaters import from `@acme/shared-table`-equivalent root path in a scratch file.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---

[Step 2: grouping fixtures — schema.ts](step-2-grouping-fixtures-schema.plan.md) →
