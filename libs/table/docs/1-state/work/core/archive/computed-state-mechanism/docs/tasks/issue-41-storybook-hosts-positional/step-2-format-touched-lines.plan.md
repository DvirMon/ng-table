---
title: 'Step 2 — Tidy the two migration-touched lines that skipped formatting'
type: task-step
issue: 75
---

# Step 2 — Tidy the two migration-touched lines that skipped formatting

**PR scope:** Two files, two lines. Hand edits only.

**Task type:** chore

**Skills used:** —

**Depends on:** Step 1
**Parallel-safe with:** Step 3

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts` (edit — line 40)
- `libs/shared/table/src/stories/row-edit/sorting-editing/sorting-editing.schema.ts` (edit — lines 2–5)

## Why This Step Exists

`fe23c9a` left two lines unformatted: the host's `createTable(...)` field has no trailing `;`,
and the schema file's `import type { ColumnDefInput, TableConfig }` was split across four lines.
Issue AC 4 ("reads as a mechanical rewrite") — these are the only non-mechanical residue.

## What To Do

1. `sorting-editing-story-host.component.ts`: append `;` to
   `protected readonly table = createTable(this.data, sortEditTableConfig, withSorting(), withRowEdit())`.
2. `sorting-editing.schema.ts`: collapse the import to one line:
   `import type { ColumnDefInput, TableConfig } from '../../../api/types';`

## Implementation Notes

- Do **not** run `prettier --write` on either file or the tree. `npx prettier --check
"src/stories/row-edit/**/*.ts"` flags 20 pre-existing files; a whole-file reformat would blow
  the "diff limited to the `createTable()` call" AC and is not this issue's work.

## Risks / Watchouts

- None.

## Non-Goals

- Repo-wide formatting of `src/stories/`.

## Acceptance Checks

- [ ] `git diff --stat` shows exactly the two files, one hunk each.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` still exit 0.

---

← [Step 1: story hosts on positional createTable()](step-1-story-hosts-positional.plan.md) | [Step 3: stories.md fixtures table](step-3-stories-doc-schema-row.plan.md) →
