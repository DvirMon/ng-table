# Step 9: `table/CLAUDE.md` — sync file-table row for `api/update-columns.ts`

**PR scope:** `libs/shared/design-system/src/ui/table/CLAUDE.md` only.

**Task type:** docs

**Skills used:** none

**Scaffolding agent:** none (main thread)

**Depends on:** Step 3

## Files

- `libs/shared/design-system/src/ui/table/CLAUDE.md` (edit)

## Why This Step Exists

Acceptance criterion: "`table/CLAUDE.md`'s `engine/core.ts` description matches (already updated
to reflect no store mutation methods)." That row already reads correctly (checked during
planning — it already says "No mutation methods — every write is a free function taking the
store first (`updateRows`, `updateColumns`)"). What's still missing is a row for the new
`api/update-columns.ts` file itself, so the file-layout table stays a complete index of `api/`.

## What To Do

- In the `## Code layout` file table, add a row for `api/update-columns.ts` directly after the
  `api/create-table.ts` row (or wherever alphabetical/logical grouping with other `api/*.ts`
  entries fits best given the table's current ordering):
  ```
  | `api/update-columns.ts` | `updateColumns(table, updater)` free function + `setColumns`/`reorderColumns`/`toggleColumnVisibility` updaters — the only write path for `columns` |
  ```
- Re-verify the `engine/core.ts` row still reads accurately post-Step-1 (it should need no change — confirm rather than assume).
- Leave every other row untouched.

## Implementation Notes

- No code in this step — pure doc sync, matches the "docs" task type routing (main thread, no scaffolding agent).

## Risks / Watchouts

- Don't also try to update `docs/1-state/prd.md` here — issue #13 doesn't list it in acceptance criteria (unlike #12's presumed future scope), and D12's own consequences list only calls out `prd.md` stories 7/8/9 as _already_ stale from the schema-only column API migration, not as this issue's responsibility. Leave that to a future doc-sync pass unless the user asks.

## Non-Goals

- Any other doc file.

## Acceptance Checks

- File table has a row for `api/update-columns.ts`.
- `engine/core.ts` row confirmed accurate (no mutation methods, free-function write path).

---

← [Step 8: `update-columns.spec.ts`](step-8-update-columns-spec.plan.md)
