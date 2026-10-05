---
title: 'Step 1 — selection/fixtures/schema.ts: multi and single table configs'
type: task-step
plan: ../../1-gap-analysis.md
node: B
---

# Step 1 — `selection/fixtures/schema.ts`: multi and single table configs

**PR scope:** One fixture file.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** —
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/selection/fixtures/schema.ts` (create)

## Why This Step Exists

Node B, the only fixture node left. Nodes A (`fixtures/types.ts`, `fixtures/mock.ts` — including
`SAVED_SELECTION_IDS` with its deliberately absent `s99`, and
`SAVED_CONFLICTING_SELECTION_IDS`) and G (`selection-story.css` — count banner, control column,
aria-disabled control styling, visible locked-row treatment) already ship (commit `a1b96fc`).

The third, filtered config the plan once listed here moved to the filtering plan along with the
story that needed it.

## What To Do

Export two `TableConfig<SelectionRow>` values plus the shared column list (`name`, `dept`,
`locked` is data, not a column, unless the story needs it visible):

1. `multiSelectionConfig` — for Step 2, consumed with
   `withSelection({ enableRowSelection: (row) => !row.locked })`.
2. `singleSelectionConfig` — for Step 3, consumed with `withSelection({ enableMultiRowSelection:
false })`. A construction-time path, not an argument — which is why it is a second config and a
   second story rather than a toggle.

`trackBy: 'id'` on both.

## Implementation Notes

- **The gap analysis says `createTableSchema()`. No such function exists** — stale name. Shipped API
  is `TableConfig<TRow>` + positional `createTable(data, config, ...features)`; mirror
  `stories/row-edit/fixtures/schema.ts`.
- The `enableRowSelection` predicate belongs with the feature call in the host, not baked into the
  config, unless the shipped `withSelection` config shape says otherwise — check
  `src/api/features/with-selection.ts` before deciding, and follow the code.

## Risks / Watchouts

- Don't add a filtered variant here; `selection-filtering/` runs on `InvoiceRow` under the filtering
  plan, and a shared file between the clusters is the edge both plans removed on purpose.

## Non-Goals

- No MSW, no HTTP — every selection verb is synchronous and local, and inventing an async path would
  demonstrate a round trip the feature does not have.

## Acceptance Checks

- [ ] Two configs exported, typed `TableConfig<SelectionRow>`, no inline mock data.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---

[Step 2: multi-selection/](step-2-multi-selection-story.plan.md) →
