# Step 7 — Stories and fixtures migrate

**PR scope:** standalone. **Depends on:** Step 3.
**Parallel-safe with:** Steps 4, 5, 6.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/filtering/fixtures/schema.ts` (edit)
- `libs/table/src/stories/filtering/client-filtering/client-filtering.filters.ts` (edit)
- `libs/table/src/stories/filtering/server-filtering/server-filtering.filters.ts` (edit)
- `libs/table/src/stories/selection/filtering-selection/filtering-selection.filters.ts` (edit)
- `libs/table/src/stories/grouping/fixtures/schema.ts` (edit — `dealFilters`)
- Story hosts — recheck, edit only if typecheck says so:
  `client-filtering-story-host`, `server-filtering-story-host`,
  `filtering-selection-story-host`, `grouping-selection-story-host`,
  `composition/derived-state/derived-state-story-host`

## Why This Step Exists

The filtering fixtures annotate `clientInvoiceConfig: TableConfig<InvoiceRow>`
(and the server/selection configs the same way). That annotation
defaults `TCols` to the wide union, so the id map collapses to
`Record<string, unknown>` and every re-keyed `path` compiles while
proving nothing. Grouping hit the same trap in #114 Step 8.

## What To Do

**1. `filtering/fixtures/schema.ts`** — drop the three
`TableConfig<InvoiceRow>` annotations; use
`satisfies TableConfig<InvoiceRow>`, matching
`grouping/fixtures/schema.ts`'s `groupingConfig`. Export
`clientColumns` / `narrowColumns` so the schemas can name them.

**2. The four schemas written as their own variable** — spell the map
directly (no alias; ruled 2026-09-25):

```ts
export const clientInvoiceFilters = (
  path: FiltersPath<InvoiceRow, ColumnValues<InvoiceRow, typeof clientColumns.columns>>
) => ({ … });
```

- `client-filtering.filters.ts` → `clientColumns`
- `server-filtering.filters.ts`, `filtering-selection.filters.ts` →
  `narrowColumns`
- `grouping/fixtures/schema.ts`'s `dealFilters` → `dealColumnSet`

Every path a schema names must be a declared column id; `client`'s
`note` and `id` (in `anyOf`) are declared, so no column is added. If a
schema names an undeclared id, Step 3's check throws at story load —
add the column (carrier `visible: false` if it should not render), don't
drop the filter.

`ClientCriteria = StateOf<ReturnType<typeof clientInvoiceFilters>>` is
unchanged.

**3. Hosts** — recheck each; the input widening should need no host edit.

## Risks / Watchouts

- **Run `typecheck` twice.** `ngc` aborts at the first `.ts` error
  before the template phase; only a source-clean second run checks the
  story-host templates.
- The server story composes **no** filtering feature — its schema is
  used for the form only; confirm it still compiles against
  `narrowColumns` without a table.

## Non-Goals

- No behaviour change to any story. No new story.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean — **run twice**, second
      run source-clean.
- [ ] No `TableConfig<InvoiceRow>` annotation left in
      `stories/filtering/fixtures/`.
- [ ] No one-argument `FiltersPath<` left in `libs/table/src`.

---

← [Step 6: Type specs](step-6-type-specs.plan.md) | [Step 8: Docs, decisions and `llms.txt`](step-8-docs-and-decisions.plan.md) →
