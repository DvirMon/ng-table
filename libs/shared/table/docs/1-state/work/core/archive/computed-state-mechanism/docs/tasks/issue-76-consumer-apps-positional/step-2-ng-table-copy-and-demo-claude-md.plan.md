---
title: "Step 2 — apps/ng-table home copy + apps/demo/CLAUDE.md off the deleted builder"
type: task-step
issue: 76
---

# Step 2 — `apps/ng-table` home copy + `apps/demo/CLAUDE.md` off the deleted builder

**PR scope:** Two cell descriptions in `home.content.ts`, one example list in the home
decisions doc, one structure-comment line in the demo app's `CLAUDE.md`. Prose only — no logic,
no types, no templates.

**Task type:** docs

**Skills used:** —

**Depends on:** —
**Parallel-safe with:** Step 1

**Scaffolding agent:** main thread

## Files

- `apps/ng-table/src/app/pages/home/home.content.ts` (edit — `features.cells[2].description`, `features.cells[3].description`)
- `apps/ng-table/src/app/pages/home/docs/decisions.md` (edit — the "Copy sourced from `libs/shared/table`'s own docs only" example list)
- `apps/demo/CLAUDE.md` (edit — the `table-demo.store.ts` line in **Structure**)

## Why This Step Exists

Issue #76 names `apps/ng-table` (home page) as a consumer to migrate. It has no `createTable()`
call — its only reference to the old API is authored marketing copy that still says
`createTableSchema()` and "adding them to the features array" (AC 2: "No app references the
removed config-builder helper"). The demo app's `CLAUDE.md` describes the store file as
"wiring the DS component's feature", which Step 1 makes untrue (features now compose at the
component's call).

`home.content.ts` is a `.ts` file, but the change is two string literals of copy governed by
the home page's own rule (every claim traces to `libs/shared/table/README.md` or `CLAUDE.md`).
Routing an implementer agent at it would load the wrong conventions; the main thread edits it.

## What To Do

1. Read `libs/shared/table/README.md` and `libs/shared/table/CLAUDE.md` first — the new
   wording must trace to what they say about `createTable()` today (both are already free of
   `createTableSchema`; verified 2026-09-13). If #78 has landed its before/after migration
   table, phrase against that.
2. `home.content.ts`:
   - Column schema cell: drop `createTableSchema()`. Keep `columnSchema()` and the "define
     columns once … the table derives the rest" claim. Something like: *"Define columns once
     in the config object and shape them with columnSchema(); the table derives the rest."*
   - Feature plugins cell: replace "by adding them to the features array" with the positional
     form — *"by passing them to createTable() after the config — nothing ships you don't
     use."*
   Do not add claims (`withComputed()`, `composeFeatures()`, arity numbers) the lib docs
   don't state.
3. `home/docs/decisions.md`: in the verifiable-claims example list, replace
   `createTableSchema()`/`columnSchema()` with `columnSchema()` alone (or whatever the lib docs
   now name). Nothing else in that doc changes.
4. `apps/demo/CLAUDE.md` **Structure** block: the `table-demo.store.ts` comment becomes
   roughly `# table config object (trackBy, columns, optional columnsSchema); features compose
   at the component's createTable() call`. Leave the rest of the file alone.

## Implementation Notes

- `home.content.ts` is typed `HomeContent`; the two edits are inside existing string literals
  so the shape cannot drift. Keep the apostrophe escaping style already used in the file.
- Keep each description one sentence, same register as its neighbours.

## Risks / Watchouts

- The home decisions doc forbids invented capabilities. "Trailing arguments" is a fact of the
  shipped `createTable` signature (JSDoc example in `src/api/create-table.ts`), so it is safe;
  do not mention the arity ceiling on a marketing page.

## Non-Goals

- Any ng-table docs page, route, or component beyond the two files named.
- Library docs / ADRs / the before/after migration table — #78.
- `apps/demo` code — Step 1.

## Acceptance Checks

- [ ] `npx tsc -p apps/ng-table/tsconfig.app.json --noEmit` → exit 0
- [ ] `grep -rn "createTableSchema\|features array" apps/` → 0 hits
- [ ] Both rewritten descriptions can be pointed at a sentence in `libs/shared/table/README.md`
      or `CLAUDE.md`
- [ ] `git diff --stat` lists only the three files in **Files**

---
← [Step 1: `apps/demo`: seven demos on positional `createTable()`](step-1-demo-app-positional.plan.md) | [Step 3: Demo behaviour verification (user-run) and #76 close-out](step-3-demo-verification-closeout.plan.md) →
