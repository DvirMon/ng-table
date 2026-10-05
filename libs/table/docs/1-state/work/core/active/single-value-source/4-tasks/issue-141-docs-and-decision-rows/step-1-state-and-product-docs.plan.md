# Step 1 — State and product docs

**PR scope:** standalone. **Depends on:** #139 and #140 closed
(external blockers, not a step edge).
**Parallel-safe with:** Step 2, Step 3, Step 4, Step 6

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/1-state/columns.md`
- `libs/table/docs/1-state/architecture.md`
- `libs/table/docs/1-state/row-mutations.md`
- `libs/table/docs/1-state/features/sorting.md`
- `libs/table/docs/1-state/features/grouping.md`
- `libs/table/docs/1-state/features/column-sizing.md`
- `libs/table/docs/1-state/features/column-pinning.md`
- `libs/table/docs/0-product/sorting.md`
- `libs/table/docs/0-product/grouping.md`
- `libs/table/docs/0-product/row-editing.md`
- `libs/table/docs/overview.md`
- `libs/table/CONTEXT.md` (glossary; `:37` names
  `columnsSchema`; `llms.txt` is generated from its
  frontmatter)

Re-grep before editing — this list was measured on
2026-09-25 and #139/#140 may touch some of it:

```bash
rg -l "\bapply(Visible|VisibleAsync|SortNulls|Grouping|GroupingAsync|GroupKey|GroupOrder|Aggregate|SortFn|Sortable)\b|columnsSchema|columns: \[|createColumns<" \
  libs/table/docs/0-product libs/table/docs/1-state \
  libs/table/docs/overview.md libs/table/CONTEXT.md \
  --glob '!**/work/**'
```

## Why This Step Exists

#141 acceptance items 1 and 4. Consumer docs still teach the
pre-epic spelling: `columns` as a plain array (or the curried
`createColumns<TRow>()([...])`), a separate `columnsSchema`
property, and `apply*` rule names that ADR-0025 removed (#136).

## What To Do

1. **Declarations.** Every snippet that declares columns uses
   `createColumns(data, (col) => [...], (path) => { ... })`,
   passed as `createTable(data, { trackBy, columns })`. No
   `columnsSchema` key and no bare array. Spec D1/D11.
2. **Rule names.** Every rule named with an `apply` prefix gets
   its bare name, per ADR-0025's table: `visible`,
   `visibleAsync`, `sortNulls`, `grouping`, `groupingAsync`,
   `groupKey`, `groupOrder`, `aggregate`. `sortFn`/`sortable`
   are #100's and unshipped: name them bare, and say they are
   not yet available.
3. **Sorting regression (R1 / spec D24)**, in
   `1-state/features/sorting.md`. State plainly:
   - Until #100 ships, a column cannot get its own compare
     function and cannot be made un-sortable.
   - Why nothing fails to compile: `ColumnDef` keeps `sortFn`
     and `enableSorting` as permanently-`undefined` fields.
     Every column falls to the auto-detected comparator (SO7),
     and `enableSorting !== false` is vacuously true.
   - Link R1 in the workspace `decisions.md`.
4. **`CONTEXT.md`.** Replace the `columnsSchema` glossary
   wording with the `createColumns` schema argument. Keep the
   frontmatter fields `title`, `summary` and `depends-on` intact
   (ADR-0001; the llms generator requires them).

## Implementation Notes

- A snippet shows the call shape only. It never shows a
  compatibility note about the removed array form (D11: no
  window).
- Don't edit history. ADR bodies, `docs/decisions/*.md` rows
  and anything under `work/` or `archive/` keep their old
  spellings. They are records, not teaching.
- Keep each file's existing prose voice. Swap spellings, don't
  rewrite sections.

## Risks / Watchouts

- The `grouping()` rule sits next to the `table.grouping` store
  member (ADR-0025's flagged name). Where both appear in one
  snippet, check the prose never uses "grouping" ambiguously.
- `0-product/grouping.md` has the most hits (17). Check each
  one is a rule name, not a word in prose.

## Non-Goals

- The order-window paragraph. That is #140's, verified in Step 5.
- Carrier-column teaching. That is Step 2
  (`2-columns/reference/`).
- Source JSDoc.

## Acceptance Checks

- [ ] The re-grep above returns nothing for the listed files.
- [ ] `features/sorting.md` states the one-release regression
      and why no compile error catches it.
- [ ] `CONTEXT.md` frontmatter still carries `title`, `summary`
      and `depends-on`.

---

[Step 2: Columns and UI docs](step-2-columns-and-ui-docs.plan.md) →
