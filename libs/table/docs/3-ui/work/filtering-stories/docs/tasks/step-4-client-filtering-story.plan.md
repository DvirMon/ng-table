---
title: 'Step 4 — client-filtering/: the filtering baseline'
type: task-step
plan: ../../1-gap-analysis.md
node: B
---

# Step 4 — `client-filtering/`: the filtering baseline

> **Reworked 2026-09-14.** The host declares `createFilters()` inline, supplies `TState`, and
> binds text/number/date inputs through Signal Forms (`[formField]`) over
> `form(filters().value)`. The `CriterionControl` wrapper and `as*` narrowers this step
> introduced are deleted. `<select>` and the tag multi-selects stay hand-wired — a bound
> select writes `''`, and `equals`' empty criterion is `null`.

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions, extract-encapsulated-logic

**Depends on:** Step 1, Step 2
**Parallel-safe with:** Step 5, Step 6

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.ts` (create)
- `libs/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.html` (create)
- `libs/table/src/stories/filtering/client-filtering/client-filtering.stories.ts` (create)
- `libs/table/src/stories/filtering/client-filtering/client-filtering.mdx` (create)

## Why This Step Exists

Node B. Composes `withFiltering({ filters })`. Client filtering is synchronous, so per
`stories.md` this story gets a single `Default` export and **no MSW** — the "reserve a plain stub
for a story that isn't about save/delete at all" carve-out, taken deliberately.

Covers product stories 1.1 (+ date-bound failure), 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.3, 4.1, 4.2,
4.3, 4.4.

## What To Do

**Layout — the convergent shape, not an invented one.** Per-column inputs in an always-visible
**filter row under the header** (`ux §1`, 3/4 peers); the search box in a **toolbar above the
table** (`ux §4`, 4/4). No popover, no column menu.

1. Filter row, one widget per rule kind, each the widget its peers converged on (`ux §3`):
   status `<select>` (`equals`); customer text (`contains`); amount **two number inputs**, min and
   max (`inRange`); issued-at **two date inputs**, from and to (`inDateRange`); tag **multi-select
   checkbox list with Select-All** (`hasAny`); tag exclude (`hasNone`).
2. Toolbar search box → the `anyOf('search', …)` criterion across `customer` + `note` + `id`, AND'd
   with the column filters. The doc-comment names the trade: **paths are declared** (PrimeNG-style),
   not scanned (AG-Grid-style). Because it spans a nullable and a numeric path, the typed matcher
   visibly returns `false` where a stringify-and-substring quick filter throws (`pain T3` — the
   highest-reaction filtering bug class in the corpus).
3. **Empty filters narrow nothing** — the summary row and the count stay unchanged while every box
   is empty, driven by the shipped per-kind `isEmpty`, never a story-local guard.
4. **Active-filter visibility, two affordances not one:** an active marker on each filtered input
   (AG Grid's icon-state convention; `filtering-story.css` already ships
   `.filtering-story__field--active`), **plus** a summary row of active criteria rendered from
   `filters().active()` (`.filtering-story__summary` also ships).
5. **Clearing:** a `×` per summary entry → `filters.<key>().reset(null)` (MUI X's per-constraint
   delete), plus **two** toolbar buttons side by side — `Reset to defaults` (`reset()`) and
   `Clear all` (`reset(null)`). No peer library has a reset-to-source concept, so R17's trap is a
   real cross-library deviation and has to be watched on screen, not read (OQ-5).
6. **Match count** — "N of M match" from `table.totalRowCount()`, the shipped member, never
   story-local arithmetic.
7. **AND across filters** — two filters at once; the count only ever shrinks.
8. **Compound include + exclude on one column** — the two tag multi-selects feeding the single
   compound criterion from Step 1.
9. **Blank cells** — fixture rows with `note: null` and `tags: []`: a positive filter excludes them,
   `hasNone` includes them, shown side by side (R27).
10. **Date bounds** — the same-day from/to case and the row carrying a time-of-day, so
    `inDateRange`'s inclusive bounds are visible rather than assumed (`pain T9`: one PrimeNG bug
    filed four times in 15 months, all "the time part gets silently dropped").
11. **Break the notes filter** — a toggle that makes a custom `filter()` predicate throw. The result
    set visibly **widens**, one console report per evaluation, every other filter keeps narrowing
    (ADR-0014 / R29). Surface the report on canvas. No peer documents an equivalent guarantee.
12. **Load a saved filter (stale shape)** — twice: once raw `filters().reset(json)`, once behind a
    shape guard. OQ-6's recommendation made runnable.
13. **Filtered to nothing** — a no-matches block keyed on `active()` non-empty **and**
    `totalRowCount() === 0`, plus an **Empty the data** button proving it is distinct from "no data
    exists" (the AG Grid / MUI X two-overlay split). The doc-comment names the stale-rows trap both
    libraries warn about (ag-grid #3716, OQ-7).

**`.stories.ts` + `.mdx`.** Title `Table / Filtering / Client`. Single `Default`. No MSW handlers.
Code tabs: `HTML`, `TS`, `CSS`, `filtering/fixtures/filters.ts`, `filtering/fixtures/schema.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first.
- `createFilters()` needs an injection context — call the Step 1 factory in a field initializer, not
  at module scope.
- **No debounce here.** R25's debounce moved to Step 5: a debounce in a synchronous story has no
  visible consequence, which fails `stories.md`'s "which feature does this line serve" test.

## Risks / Watchouts

- Keep the summary row rendering from `filters().active()`, not from a host-mirrored copy — the
  mirror is how it silently drifts.

## Non-Goals

- No server path (Step 5), no selection (Step 6), no unit tests on the host, no data-derived option
  lists (R11).

## Acceptance Checks

- [ ] One input per shipped rule kind in an always-visible filter row; search box in the toolbar.
- [ ] Empty inputs change nothing; active inputs are individually marked and summarized.
- [ ] Per-entry `×`, `Reset to defaults` and `Clear all` behave differently and visibly.
- [ ] The quick filter returns no match on the numeric/nullable cells instead of throwing.
- [ ] Breaking the notes filter widens the result set and reports once per evaluation.
- [ ] No-matches and no-data render as distinct states.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---

← [Step 3: filtering fixtures — transport](step-3-filtering-fixtures-transport.plan.md) | [Step 5: server-filtering/](step-5-server-filtering-story.plan.md) →
