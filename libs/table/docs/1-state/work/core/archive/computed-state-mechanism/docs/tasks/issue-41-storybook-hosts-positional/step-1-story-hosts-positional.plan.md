---
title: "Step 1 — Nine row-edit story hosts + two schema files on positional createTable()"
type: task-step
issue: 75
status: done
commit: fe23c9a
---

# Step 1 — Nine row-edit story hosts + two schema files on positional `createTable()`

**PR scope:** The nine `*-story-host.component.ts` files under `src/stories/row-edit/`, their
nine `.mdx` code-tab labels, `fixtures/schema.ts`, `sorting-editing.schema.ts`. Landed as
commit `fe23c9a` on `feat/table` — this step is recorded, not re-executed.

**Task type:** code

**Skills used:** angular-developer

**Depends on:** — (first step; #38/#73/#74 are on the branch)
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer (not dispatched — already done)

## Files

- `libs/shared/table/src/stories/row-edit/{live-table,live-optimistic,external-write,form-write-mutations,sorting-editing,gated-single-pessimistic,gated-single-optimistic,gated-multiple-optimistic,gated-bulk-optimistic}/*-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/row-edit/*/*.mdx` (edit — code-tab label `row-edit.schema.ts` → `fixtures/schema.ts`)
- `libs/shared/table/src/stories/row-edit/fixtures/schema.ts` (edit — `createTableSchema()` variants deleted; keeps `columns`, `editTableConfig: TableConfig<EditRow> = { trackBy: 'id', columns }`, `editRowsSchema`)
- `libs/shared/table/src/stories/row-edit/sorting-editing/sorting-editing.schema.ts` (edit — same shape: `sortEditTableConfig`, `sortEditRowsSchema`)

## Why This Step Exists

Issue #41 AC 1, 2, 4: every host compiles against the positional form with zero explicit row
type on any feature; no host references the deleted config builder (`src/api/table-schema.ts`,
architecture D25) or the thunk form; the diff of each host is limited to the `createTable()`
call and the schema helper it used.

## What To Do

Nothing — already on the branch. The final call shapes, for the record:

| Host | Call |
|---|---|
| live-table | `createTable(this.data, editTableConfig, withSorting(), withOptimistic())` |
| live-optimistic | `createTable(this.data, editTableConfig, withOptimistic())` |
| external-write, form-write-mutations, gated-single-pessimistic, gated-single-optimistic | `createTable(this.data, editTableConfig, withRowEdit())` |
| gated-multiple-optimistic, gated-bulk-optimistic | `createTable(this.data, editTableConfig, withRowEdit({ multiple: () => true }))` |
| sorting-editing | `createTable(this.data, sortEditTableConfig, withSorting(), withRowEdit())` |

## Implementation Notes

- `trackBy` is stated explicitly in both config objects — the deleted builder used to default it.
- Story-local `gatedTableSchema(config)` wrapper is gone; the `multiple` arg now goes straight
  into `withRowEdit({ multiple })`, which still wraps it in `computed()` and reacts live.
- The `withRowEdit()`-over-`withOptimistic()` rationale that lived in `sorting-editing.schema.ts`'s
  JSDoc was dropped with the builder; the host's own header (S-1/S-2) still states why the two
  features are composed, so nothing is lost.

## Risks / Watchouts

- None open. See Step 2 for the two formatting leftovers this commit introduced.

## Non-Goals

- Consumer apps (`apps/demo`, `apps/ng-table`) — #42.
- Library docs / ADRs — #44.

## Acceptance Checks

Re-verified 2026-09-13 against `fe23c9a`:

- [x] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` → exit 0 (hosts are in the lib include set)
- [x] `grep -rnE "with[A-Z][A-Za-z]*<[A-Za-z]+>\(" libs/shared/table/src/stories` → 0 hits
- [x] `grep -rn "createTableSchema\|table-schema" libs/shared/table/src` → 0 hits; `src/api/table-schema.ts` does not exist
- [x] All nine hosts call `createTable(this.data, <config>, ...features)`

---
[Step 2: tidy the two unformatted sorting-editing lines](step-2-format-touched-lines.plan.md) →
