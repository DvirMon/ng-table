# Step 9 — Remaining call sites: selection, composition, grouping; delete the predicate story

**PR scope:** PR 1 of 1 (`#125`). **Parallel-safe with: Step 7, Step 8, Step 10.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/table/src/stories/selection/filtering-selection/filtering-selection.filters.ts` | `:1-21` | rewrite — hoisted schema `const` |
| `libs/table/src/stories/selection/filtering-selection/filtering-selection-story-host.component.ts` | `:32-46` | edit — model into the table, field order |
| `libs/table/src/stories/composition/derived-state/derived-state-story-host.component.ts` | `:3`, `:31-50` | edit — inline schema, `table.filters` |
| `libs/table/src/stories/grouping/fixtures/schema.ts` | `:1-3`, `:75-84` | edit — `createDealFilters()` → `dealFilters` `const` |
| `libs/table/src/stories/grouping/fixtures/utils.ts` | `:1-2`, `:41-49` | edit — helper signatures follow the schema |
| `libs/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts` | `:12-20`, `:39-45`, `:57` | edit — model into the table |
| `libs/table/src/stories/filtering/predicate-filtering/` | all 6 files | **delete** |

## Why This Step Exists

Four call sites that are the same mechanical edit, plus one deletion that has to happen before the
barrel can be called clean. Merged into one step on the user's call: splitting them would produce
four step files whose "What To Do" is the same three lines, and none of them individually moves the
lib closer to compiling than the others.

Two of these are **not in issue `#125`'s call-site list** and were found by grep:

- `stories/grouping/grouping-selection/` composes `withFiltering({ predicates: () => [this.filters().matcher()] })`
  (`:45`) and reaches the model through `grouping/fixtures/utils.ts`.
- The issue's "`selection-filtering/`" is really `stories/selection/filtering-selection/`.

**The deletion.** `predicate-filtering/` exists to demonstrate `predicates`, which R54 deletes with
nothing replacing it. The story's own JSDoc states its claim as *"`predicates` is a thunk the filter
stage calls once per pass"* — a sentence about an API that will not exist. Decided: delete, rather
than rewrite it as R54's narrow-the-rows-signal scope pattern.

## What To Do

### A. `filtering-selection` (selection story)

1. `filtering-selection.filters.ts` → hoisted `const`:

   ```ts
   export const selectionInvoiceFilters = (path: FiltersPath<InvoiceRow>) => ({
     status: filter(path.status, matchesStatus, { emptyValue: '' }),
     customer: contains(path.customer),
     tags: hasAny(path.tags),
   });

   export type SelectionCriteria = StateOf<ReturnType<typeof selectionInvoiceFilters>>;
   ```

   The `data: Signal<InvoiceRow[]>` parameter is deleted, not replaced — it was the carrier.

2. Host: `withFiltering({ schema: selectionInvoiceFilters })` inside `createTable`, and `filters` /
   `filterForm` move **below** `table`. `withSelection()` and `withSorting()` stay where they are;
   feature order is unchanged.

### B. `derived-state` (composition story)

The schema is one rule. Inline it — a `.filters.ts` file for `{ dept: equals(path.dept) }` is the
over-extraction the rules warn about:

```ts
protected readonly table = createTable(
  this.data,
  derivedStateConfig,
  withFiltering({ schema: (path) => ({ dept: equals(path.dept) }) }),
  withSelection({}, withComputed(…)),
  withComputed(…),
);
```

`activeDept` becomes `computed(() => this.table.filters.dept().value())` and moves after `table`.
`setDeptFilter`'s `reset(null)` path is unchanged — check the rest of that method past `:60`.

**Watch the derive blocks.** `withSelection`'s nested `withComputed` reads `store.renderRows()`, and
the trailing one reads `store.hiddenSelected()`. Adding a member-contributing `withFiltering`
*before* `withSelection` changes what `In` is for every later argument. That is the story's whole
subject, so if the inferred member set shifts, it is a finding, not a nuisance — report it rather
than papering over it with a cast.

### C. `grouping` fixtures + `grouping-selection`

1. `grouping/fixtures/schema.ts`: `createDealFilters()` → 

   ```ts
   /** One text criterion over `rep`, used only by `grouping-selection/` — enough to move a
    * selected row out of view, and to show counts and summaries following the visible rows. */
   export const dealFilters = (path: FiltersPath<DealRow>) => ({ rep: contains(path.rep) });
   ```

   Drop the `rowOf` import and the two JSDoc paragraphs that no longer hold: *"Must be called from
   an injection context"* (`buildFilterModel` needs none — see `create-filters.spec.ts:44-46`) and
   *"Return type is deliberately inferred"* (still true, but for the `StateOf` reason now, not the
   `ReturnType<typeof …>` one).

2. `grouping/fixtures/utils.ts`: `readRepCriterion` and `repFilterNode` take
   `ReturnType<typeof createDealFilters>`. That becomes
   `Filters<DealRow, StateOf<typeof dealFilters>>` — importing `Filters` and `StateOf` from
   `../../../filters/types`, alongside the `FilterNode` import already there.

3. `grouping-selection-story-host.component.ts`: `withFiltering({ schema: dealFilters })` inside
   `createTable`, `filters` field deleted, `repFilter` becomes
   `computed(() => readRepCriterion(this.table.filters))`.

### D. Delete `predicate-filtering/`

Remove all six files and the folder. Then grep `src/` for anything that named it —
`predicate-filtering.stories.ts`'s story id, any `.mdx` import, any relative link. **Leave
`filtering.mdx` alone**; Step 11 owns it and will remove the section.

`docs/0-product/filtering.md`'s coverage mark and `docs/3-ui/stories.md`'s reference are `#126`'s,
not this step's — but note in the PR that they now point at a deleted story, so `#126` does not have
to rediscover it.

## Implementation Notes

- Same nesting as everywhere else: `withFiltering({ schema })`, not `withFiltering(config, schema)`.
- `grouping-selection` imports from the barrel (`'../../../index'`); the others use deep relative
  paths. Keep each file's existing convention rather than normalising — that is churn this step
  does not own.
- `StateOf` is not on the barrel by decision (`#124` Step 5). Stories import it from
  `filters/types`, as `grouping/fixtures/utils.ts` already does for `FilterNode`.

## Risks / Watchouts

- **Uncommitted grouping work in the tree.** `with-grouping.ts`, `engine/grouping.ts`,
  `with-grouping.spec.ts` and the `grouping-static` story host are modified and uncommitted. This
  step touches `grouping/fixtures/` and `grouping-selection/` only — no overlap, but rebase before
  starting rather than after.
- `grouping-selection` composes `withGrouping` → `withSelection` → `withFiltering` in that order.
  `PIPELINE_ORDER` decides stage order, not argument order, so this is safe — but the *member* type
  fold does follow argument order, so `filters` lands last in the composed store. Do not reorder the
  arguments to "fix" anything; if a member is missing, that is the finding.
- Deleting a story folder can break Storybook's story index silently. Grep for the story id, not
  just the file paths.

## Non-Goals

- `filtering.mdx` — Step 11.
- `docs/0-product/filtering.md`, `docs/3-ui/stories.md` — `#126`.
- Rewriting `predicate-filtering` as an R54 scope demo. Considered and rejected.
- Normalising barrel-vs-relative imports across story folders.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating under
      `src/stories/selection/`, `src/stories/composition/` or `src/stories/grouping/`. Run twice —
      three story-host templates are in scope and a `.ts` error aborts `ngc` before reaching them.
- [ ] `src/stories/filtering/predicate-filtering/` no longer exists, and nothing under `src/`
      references it except `filtering.mdx` (Step 11).
- [ ] No `createFilters`, `rowOf`, `applyWhen` or `predicates` under `src/stories/selection/`,
      `src/stories/composition/` or `src/stories/grouping/`.
- [ ] `derived-state`'s two `withComputed` blocks still infer `hiddenSelected` and
      `visibleSelected` — no `any`, no cast added to make them compile.
- [ ] `grouping-selection`'s rep filter still moves a selected row out of view and the selection
      readout still counts pipeline rows, not render rows.

---
← [Step 8: Server-filtering host](step-8-server-filtering-host.plan.md) | [Step 10: Specs](step-10-specs.plan.md) →
