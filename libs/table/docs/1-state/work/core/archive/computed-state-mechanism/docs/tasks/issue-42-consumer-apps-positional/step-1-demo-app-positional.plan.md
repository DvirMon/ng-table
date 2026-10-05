---
title: 'Step 1 — apps/demo: seven demos on positional createTable()'
type: task-step
issue: 76
---

# Step 1 — `apps/demo`: seven demos on positional `createTable()`

**PR scope:** The six `*-demo.store.ts` files and seven `*-demo.ts` components under
`apps/demo/src/app/` (expansion-row shares expansion's store). Thirteen files, each a 2–6 line
diff at the config export and the `createTable()` call. No `.html` / `.css` / `.mock.ts` /
`.types.ts` changes.

**Task type:** code

**Skills used:** angular-developer

**Depends on:** — (first step; #38/#73/#74 are on the branch)
**Parallel-safe with:** Step 2

**Scaffolding agent:** angular-implementer

## Files

- `apps/demo/src/app/table-demo/table-demo.store.ts` (edit)
- `apps/demo/src/app/table-demo/table-demo.ts` (edit)
- `apps/demo/src/app/table-column-visibility-demo/table-column-visibility-demo.store.ts` (edit)
- `apps/demo/src/app/table-column-visibility-demo/table-column-visibility-demo.ts` (edit)
- `apps/demo/src/app/table-edit-demo/table-edit-demo.store.ts` (edit)
- `apps/demo/src/app/table-edit-demo/table-edit-demo.ts` (edit)
- `apps/demo/src/app/table-expansion-demo/table-expansion-demo.store.ts` (edit)
- `apps/demo/src/app/table-expansion-demo/table-expansion-demo.ts` (edit)
- `apps/demo/src/app/table-expansion-row-demo/table-expansion-row-demo.ts` (edit — imports the expansion store)
- `apps/demo/src/app/table-row-edit-demo/table-row-edit-demo.store.ts` (edit)
- `apps/demo/src/app/table-row-edit-demo/table-row-edit-demo.ts` (edit)
- `apps/demo/src/app/table-row-field-demo/table-row-field-demo.store.ts` (edit)
- `apps/demo/src/app/table-row-field-demo/table-row-field-demo.ts` (edit)

## Why This Step Exists

Issue #42 AC 1, 2, 4 for `apps/demo`: every `createTable()` call uses the positional form with
zero row type arguments on features; nothing references the deleted config builder
(`createTableSchema`, architecture D25) or the thunk form; the diff reads as a mechanical
rewrite. Today every store imports `createTableSchema` from `@acme/table`, which no longer
exists — the app does not type-check until this lands.

## What To Do

Same shape as #41 Step 1 (`fixtures/schema.ts` → `editTableConfig`): the store file keeps
`columns` and exports a plain `TableConfig<Row>` object with `trackBy: 'id'` stated explicitly;
features move out of the store into the component's `createTable()` call, in the same order the
old `features: [...]` array had them.

| Demo                         | Store export (replaces `xTableSchema = createTableSchema(...)`)                                                                   | Component call                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| table-demo                   | `peopleTableConfig: TableConfig<Person> = { trackBy: 'id', columns }`                                                             | `createTable(this.data, peopleTableConfig, withSorting())`                    |
| table-column-visibility-demo | `peopleColumnVisibilityConfig: TableConfig<Person> = { trackBy: 'id', columns, columnsSchema: (schema) => { …unchanged body… } }` | `createTable(this.data, peopleColumnVisibilityConfig)`                        |
| table-edit-demo              | `personEditTableConfig: TableConfig<EditablePerson> = { trackBy: 'id', columns }`                                                 | `createTable(this.data, personEditTableConfig)`                               |
| table-expansion-demo         | `departmentsTableConfig: TableConfig<Department> = { trackBy: 'id', columns }`                                                    | `createTable(this.data, departmentsTableConfig, withExpansion())`             |
| table-expansion-row-demo     | (imports `departmentsTableConfig` from the expansion store)                                                                       | `createTable(this.data, departmentsTableConfig, withExpansion())`             |
| table-row-edit-demo          | `rowEditTableConfig: TableConfig<EditRow> = { trackBy: 'id', columns }`                                                           | `createTable(this.data, rowEditTableConfig, withRowEdit())`                   |
| table-row-field-demo         | `fieldRowTableConfig: TableConfig<FieldRow> = { trackBy: 'id', columns }`                                                         | `createTable(this.data, fieldRowTableConfig, withExpansion(), withRowEdit())` |

Per file:

1. Store: replace the `createTableSchema` import with `type TableConfig`; drop the feature
   imports (`withSorting`, `withExpansion`, `withRowEdit`) that no longer have a use in the
   store. Keep `ColumnDefInput`, `applyVisible`, `applyVisibleAsync`, the Signal Forms
   `schema()` exports and every non-table export (`childrenStore`, `cityColumnVisible`,
   `ageCheckTrigger`, `ageCheckPending`, `ageCheckAllowed`, `*RowsSchema`) untouched.
2. Component: import the feature(s) from `@acme/table` (alphabetized inside the existing
   braces) and pass them positionally after the config.
3. Rewrite only the comment lines the diff already touches: "handed to
   `createTable(data, peopleTableSchema)`" (table-demo store), "plain schema, no features
   array" (edit-demo store, D29 line — keep the D29 reference), "Column-visibility-only schema —
   no features composed" (column-visibility store). Every other comment, including the D-number
   references in row-edit/row-field stores, stays as is.

## Implementation Notes

- `trackBy: 'id'` is valid for every demo: all six row types declare `id` (`number` or
  `string`). The deleted builder used to default it; D25 makes it explicit.
- Argument order governs member visibility (architecture "accepted trade-offs"). row-field keeps
  `withExpansion()` before `withRowEdit()`, exactly as the old array.
- `columnsSchema` in the config object still accepts the inline function form
  (spec: "keeps accepting both an inline schema function and a standalone schema value"). The
  column-visibility closure over module-level signals and the `ageCheckResource` capture are
  unchanged — only the wrapper around them goes.
- `withRowEdit()` with no config keeps single mode (D14 default) — the row-edit demo's comment
  about D31.2 still holds.
- No new `withComputed()` / `composeFeatures()` usage: out of scope for this issue, and no demo
  needs it.
- `apps/demo` has no per-demo specs; `app.spec.ts` does not touch these stores. No test step.

## Risks / Watchouts

- Inference trap check: with a typed `TableConfig<Row>` object in the second position and
  bare `withX()` features, the row type must flow from `data` + config. If a feature argument
  resolves to `unknown`/`any` (research doc's three traps), the `tsc` gate below catches it as
  a downstream error at a `this.table.<member>` read (`sortDirections`, `editing`,
  `rowExpanded`). Do not paper over with a type argument — that is exactly AC 1's failure mode.
- `table-demo.ts` reads `this.table.trackBy(row as never)` in two places — pre-existing, leave
  it.
- Export renames (`peopleTableSchema` → `peopleTableConfig` etc.) are approved scope
  (2026-09-13): the name would otherwise lie about holding a config object. Each rename has
  exactly one importer except `departmentsTableConfig` (two).

## Non-Goals

- `apps/ng-table` copy and `apps/demo/CLAUDE.md` — Step 2.
- Runtime behaviour proof — Step 3 (user-run).
- Any demo of `withComputed()` — not asked for by #42; would be a separate ticket.
- Library docs / ADRs — #44.

## Acceptance Checks

- [ ] `npx tsc -p apps/demo/tsconfig.app.json --noEmit` → exit 0
- [ ] `grep -rn "createTableSchema" apps/` → 0 hits
- [ ] `grep -rnE "with[A-Z][A-Za-z]*<[A-Za-z]+>\(" apps/` → 0 hits
- [ ] `grep -rn "features: \[" apps/demo/src` → 0 hits
- [ ] Every one of the seven components calls `createTable(this.data, <config>[, ...features])`
      matching the table above
- [ ] `git diff --stat` lists only the thirteen files in **Files**

---

[Step 2: `apps/ng-table` home copy + `apps/demo/CLAUDE.md` off the deleted builder](step-2-ng-table-copy-and-demo-claude-md.plan.md) →
