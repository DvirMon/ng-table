# Step 2 — Columns and UI docs

**PR scope:** standalone. **Depends on:** #139 and #140 closed
(external blockers, not a step edge).
**Parallel-safe with:** Step 1, Step 3, Step 4, Step 6

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/2-columns/architecture.md` (heaviest: 18
  `apply*` + 27 array/schema hits)
- `libs/table/docs/2-columns/reference/tier-1-intrinsic.md`
- `libs/table/docs/2-columns/reference/tier-3-feature-config.md`
- `libs/table/docs/2-columns/reference/column-metadata.md`
- `libs/table/docs/2-columns/reference/ownership-model.md`
- `libs/table/docs/2-columns/reference/data-derived.md`
- `libs/table/docs/2-columns/reference/signal-forms-techniques.md`
- `libs/table/docs/3-ui/stories.md`
- `libs/table/docs/3-ui/architecture.md`
- `libs/table/docs/3-ui/directives/columns.md`
- `libs/table/docs/3-ui/directives/grouping.md`
- `libs/table/docs/3-ui/directives/core.md`
- `apps/site/**`: verify only. It had zero hits on 2026-09-25.

Re-grep before editing:

```bash
rg -l "\bapply(Visible|VisibleAsync|SortNulls|Grouping|GroupingAsync|GroupKey|GroupOrder|Aggregate|SortFn|Sortable)\b|columnsSchema|columns: \[|createColumns<" \
  libs/table/docs/2-columns libs/table/docs/3-ui apps/site \
  --glob '!**/work/**'
```

## Why This Step Exists

#141 acceptance items 1 and 2. This is the same sweep as
Step 1, over the columns and UI streams. It also has one
addition: the carrier column is taught as a declaration
option, not as a hand-written object.

## What To Do

1. **Declarations and rule names.** Same two rules as Step 1
   § What To Do 1–2.
2. **Carrier column, taught once**, in
   `2-columns/reference/tier-1-intrinsic.md` beside the other
   `col()` options:
   `col('ownerName', { accessor: (r) => r.owner.name, visible: false })`.
   It is a value the table reads (grouping, filtering, sorting)
   but never renders. Link ADR-0024. Other files that mention a
   carrier link here instead of re-explaining it.
3. **The `visible` caveat.** Where the carrier column is taught,
   carry the standing caveat: the library does not enforce
   `visible`. A hidden column still runs its accessor and still
   contributes to `RenderRow.cells`. The consumer's template
   filters on `visible` (spec D13).
4. **`3-ui/stories.md`.** Update the story-host snippet to the
   shape the story hosts use after #138.

## Implementation Notes

- `2-columns/architecture.md` describes `columnsSchema` as a
  config property in its structure prose, not only in snippets.
  Rewrite those sentences to "the schema argument of
  `createColumns`". Don't delete the reasoning around them.
- Same history rule as Step 1: no edits under `work/` or
  `archive/`, and none to ADR bodies.

## Risks / Watchouts

- `signal-forms-techniques.md` is a comparison reference. Its
  one `apply*` hit may be quoting Angular's own `apply()`. Only
  rename this library's rules.

## Non-Goals

- `setColumns` / order-window prose (#140, Step 5).
- Designing a rule that applies to every column (architecture
  open question 7, deferred).

## Acceptance Checks

- [ ] The re-grep above returns nothing outside `work/`.
- [ ] `tier-1-intrinsic.md` teaches the carrier column as a
      `col()` option, with the `visible` caveat.
- [ ] `apps/site` still has no old spelling.

---

← [Step 1: State and product docs](step-1-state-and-product-docs.plan.md) | [Step 3: ADR amendments](step-3-adr-amendments.plan.md) →
