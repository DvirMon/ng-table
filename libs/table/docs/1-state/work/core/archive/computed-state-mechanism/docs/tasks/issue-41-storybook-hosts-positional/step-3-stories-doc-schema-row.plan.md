---
title: "Step 3 — docs/3-ui/stories.md: schema.ts row and the 'no schema call in a host' rule"
type: task-step
issue: 75
---

# Step 3 — `docs/3-ui/stories.md`: `schema.ts` row and the "no schema call in a host" rule

**PR scope:** One markdown file, two edits.

**Task type:** docs

**Skills used:** —

**Depends on:** Step 1
**Parallel-safe with:** Step 2

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/3-ui/stories.md` (edit — line 86 table row; line 97 rule)

## Why This Step Exists

The stories domain doc still describes `row-edit/fixtures/schema.ts` as holding
`createTableSchema()` calls per variant (`gatedTableSchema`, `liveTableSchema`,
`liveOptimisticSchema`). Those symbols and the builder no longer exist. This is story-domain
documentation, colocated with the stories — it belongs to this issue, not to #44 (which owns
ADRs and the state-layer architecture doc).

## What To Do

1. Line 86 — replace the `schema.ts` row's Contents cell with:
   "`editTableConfig` (`TableConfig<EditRow>`, `trackBy: 'id'` + `columns`) shared by all nine
   hosts, and the shared Signal Forms `editRowsSchema`. Each host composes its own features
   inline: `createTable(this.data, editTableConfig, ...features)`"
2. Line 97 — the rule "Don't inline mock data or a schema call inside a story-host component"
   now reads wrong, since the `createTable()` call *is* in the host by design. Reword to:
   "Don't inline mock data, column definitions, or the table config inside a story-host
   component — the host composes features on `createTable(...)`, the fixtures file owns the
   config and the Signal Forms schema."
3. Leave lines 121, 249, 252, 256 alone — "schema" there means the Signal Forms schema and is
   still accurate.

## Implementation Notes

- `sorting-editing.schema.ts` is not in the shared-files table (it is story-local); no row to add.
- Work logs under `docs/3-ui/work/*/1-gap-analysis.md` and `docs/1-state/work/*` also mention
  `createTableSchema()` — historical records, do not edit.

## Risks / Watchouts

- Keep the edit to those two spots; the rest of the file (promotion ladder, transport decision)
  is unaffected.

## Non-Goals

- ADR-0003 / state-layer architecture doc rewrites — #44.

## Acceptance Checks

- [ ] `grep -n "createTableSchema\|gatedTableSchema\|liveTableSchema\|liveOptimisticSchema" libs/shared/table/docs/3-ui/stories.md` → 0 hits.
- [ ] The two edited sentences name only symbols that exist (`editTableConfig`, `editRowsSchema`, `TableConfig`).

---
← [Step 2: tidy the two unformatted sorting-editing lines](step-2-format-touched-lines.plan.md) | [Step 4: render verification and close-out](step-4-render-verification-closeout.plan.md) →
