---
title: "Step 2 — grouping/fixtures/schema.ts: three table configs"
type: task-step
plan: ../../1-gap-analysis.md
node: A (part)
---

# Step 2 — `grouping/fixtures/schema.ts`: three table configs

**PR scope:** One fixture file. No story renders it yet.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** —
**Parallel-safe with:** Step 1, Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/grouping/fixtures/schema.ts` (create)

## Why This Step Exists

Node A, remaining half. `fixtures/types.ts`, `fixtures/mock.ts` and `grouping-story.css` already
ship (commit `a1b96fc`); the schema file does not. Node A's rule is that **all three** configs land
up front, so Steps 4, 5 and 6 stay parallel-safe — a story adding its own variant later turns this
file into a write-edge between them.

## What To Do

Export three `TableConfig<DealRow>` values plus the shared column list:

1. `staticGroupingConfig` — for Step 4. Columns `region`, `category`, `rep`, `amount`, `closedAt`,
   `owner`. `amount` carries an `aggregateFn` (sum) so group headers can render a summary at every
   depth. `trackBy: 'id'`.
2. `collapsibleGroupingConfig` — for Step 5. Same columns; whatever config the expansion +
   sorting composition needs (`childrenAccessor` for the `children`-bearing rows, so `'group'` and
   `'tree'` both run).
3. `groupedSelectionConfig` — for Step 6. Same columns plus whatever `withSelection()` needs.

Also export the initial grouping levels each story starts from (e.g.
`STATIC_GROUPING_LEVELS = ['region', 'category']`), so no host hardcodes an array inline.

## Implementation Notes

- **The gap analysis says `createTableSchema()`. That function does not exist** — it is a stale
  name from an earlier draft. The shipped API is `TableConfig<TRow>` + positional
  `createTable(data, config, ...features)`; mirror `stories/row-edit/fixtures/schema.ts`
  (`editTableConfig`), which is the precedent.
- The folder supplies the domain, so no `grouping.` prefix inside `grouping/fixtures/`
  (`3-ui/stories.md`, file layout).
- If a Signal Forms schema turns out to be needed by a later story, it lands here beside the
  configs, the way `row-edit/fixtures/schema.ts` holds `editRowsSchema`.

## Risks / Watchouts

- `aggregateFn` is called unwrapped by `engine/grouping.ts` — a throwing one takes the table down.
  That is deliberate and is Step 4's honest-regression demo ([#79](https://github.com/DvirMon/acme/issues/79)); do not defensively wrap it here.

## Non-Goals

- No MSW, no HTTP (Step 3). No story host.

## Acceptance Checks

- [ ] Three configs exported, typed `TableConfig<DealRow>`, no inline mock data.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 1: export group-level updaters](step-1-export-group-level-updaters.plan.md) | [Step 3: grouping fixtures — transport](step-3-grouping-fixtures-transport.plan.md) →
