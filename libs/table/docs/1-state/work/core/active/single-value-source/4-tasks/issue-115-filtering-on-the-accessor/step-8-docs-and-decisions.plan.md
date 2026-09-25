# Step 8 — Docs, decisions and `llms.txt`

**PR scope:** standalone. **Depends on:** Step 3 (contract), Step 7
(the story spelling the docs quote).

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/1-state/features/filtering.md` (edit)
- `libs/table/docs/3-ui/stories.md` (edit — line ~165)
- `libs/table/src/stories/filtering/filtering.mdx` (edit — line ~39)
- `libs/table/docs/adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md` (amend)
- `libs/table/docs/decisions/columns.md` (append rows)
- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md` (status)
- `llms.txt` (regenerate)

## What To Do

**1. `filtering.md`** — `path` keys by declared column id and reads the
accessor; `WithFilteringConfig<TRow, TValues, S>`; the input now carries
`columns`; unknown id throws at construction; removed column degrades.
Every `FiltersPath<Invoice>` example → inline, or the two-argument form.
State that `FilterOptions.when`'s `valueOf` keeps its name here (#117
renames it).

**2. `stories.md` / `filtering.mdx`** — the schema-as-its-own-variable
pattern now spells `FiltersPath<Row, ColumnValues<Row, typeof set.columns>>`.

**3. ADR-0021 amendment.** Line 108 says "`FiltersPath<TRow>` needs no
change". Add a dated amendment: superseded by ADR-0024 via #115 —
filtering keys by column id like grouping.

**4. `decisions/columns.md`** — one row each:

- `FiltersPath<TRow, TValues>`, `TValues` **required** — the one-argument
  form fails to compile rather than degrading to `unknown` criteria.
- `ColumnValuesOfSet<>` alias **deferred** — reopens when a second
  feature's schema-as-its-own-variable needs the same spelling.
- A filter whose column is removed by `setColumns()` degrades and
  reports (runtime class, same as G72).
- `WithFilteringConfig` gains a required `TValues` — public break.

**5. Workspace `decisions.md`** — V3, K3 → done (#115); N9 filtering
half done; D1/D2 filtering slices done.

**6.** `npm run llms`, then `npm run llms:check`.

## Acceptance Checks

- [ ] `npm run llms:check` clean.
- [ ] `grep -rn "FiltersPath<[A-Za-z]*>" libs/table/docs` returns only
      historical/ADR-context lines.
- [ ] `nx run shared-table:typecheck` clean, run twice (the `.mdx`
      edit is docs, but the story tree is final here).

---
← [Step 7: Stories and fixtures migrate](step-7-stories-and-fixtures.plan.md)
