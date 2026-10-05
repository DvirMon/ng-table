---
title: 'Step 5 — grouping-collapsible/: the grouped table as a navigable outline'
type: task-step
plan: ../../1-gap-analysis.md
node: D
---

# Step 5 — `grouping-collapsible/`: the grouped table as a navigable outline

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions, extract-encapsulated-logic

**Depends on:** Step 2, Step 3
**Parallel-safe with:** Step 4, Step 6

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts` (create)
- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html` (create)
- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible.stories.ts` (create)
- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible.mdx` (create)

## Why This Step Exists

Node D. `withGrouping()` + `withExpansion()` + `withSorting()`. Sorting is inherent, not adjacent:
product story 2.5's acceptance criteria are "survives a sort change", and S-G1/S-G2 fall out of the
same surface.

Covers 2.1 (+ keyboard), 2.2 (honest regression), 2.5 in three forms, S-G1, S-G2, E-G1.

## What To Do

**Host + template.**

1. `createTable(data, collapsibleGroupingConfig, withGrouping(…), withExpansion(…), withSorting())`.
2. **Chevron `<button>` on the header row carrying `aria-expanded`** (P2 — every peer with a UI
   renders one; PrimeNG's is literally a button with `aria-expanded`/`aria-controls`), calling
   `toggleExpanded(row.id)` at Tier 0 (no grouping/expansion directive ships). The whole header row
   is an enlarged hit area delegating to that button (U3, Telerik 1525732 — a real ask, an
   unimplemented one, so it is the secondary target, not the primary).
   Because it is a real `<button>`, Enter _and_ Space both toggle — P11's peer split (AG Grid binds
   Enter, MUI X binds Space) is resolved by using a button rather than picking a side. Say so in the
   doc-comment.
3. Three-level fixture depth, so collapsing a parent hides the whole subtree (D11, the render stage
   already does the walk).
4. **Expand all / Collapse all** — an honest regression. Implement with a story-local walk over
   `renderRows()`, plus an on-canvas notice that `expandAll()` walks `childrenAccessor` over real
   rows and cannot discover a group (S5), and that the button cannot label itself correctly without
   S4's "is everything expanded" signal. P3: the _verb_ is convergent (4/5), the _button_ is not
   (MRT alone) — so OQ-3's "own the state, ship no UI" is defensible, but the state has to exist.
5. **Refetch** — a real MSW `GET /api/grouped-rows` via `injectGroupedRowsApi()` returning fresh
   object identities; collapse state must survive (S3/OQ-4 confirmed or disproved on screen).
6. **Sort toggle** — collapse state must survive a sort change too (mui-x #21398's exact
   reproduction), and sorting a data column must leave the groups put (S-G2; this is where product
   story 3.3's unverified fourth criterion actually gets tested).
7. **Regroup** — collapse state is discarded wholesale on a grouping change, never half-restored
   (mui-x #16495 is the half-restored failure: chevron reads expanded, content gone).
8. **S-G1** — clicking the _grouped_ column's header. D5's accepted visible no-op; make it legible
   on canvas instead of leaving a dead header (U9's minimum bar).
9. **E-G1** — the fixture rows carrying `children` make `'group'` and `'tree'` both run: two
   visibly different affordances that never trigger each other (primeng #18171 is the failure).

**`.stories.ts` + `.mdx`.**

- Title `Table / Grouping / Collapsible`. Exports: `Default`, `ForcedFailure` (the refetch fails;
  collapse state must survive a _failed_ refresh too).
- `ForcedFailure` gets its own `## Forced failure` section in the `.mdx` with
  `<Canvas of={Stories.ForcedFailure} />` and a one-paragraph summary — Angular's docgen does not
  surface a CSF export's JSDoc, so without it the two stories are indistinguishable to a viewer.
- The host's hint paragraph wraps in `@if (forceFailure()) { … } @else { … }`.
- `parameters.msw.handlers` registers the Step 3 handlers. Code tabs: `HTML`, `TS`, `CSS`,
  `grouping/fixtures/schema.ts`, `grouping/fixtures/http.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first. Separate template file, `Component`-suffixed class,
  doc-comment names the decisions proven (2.5 / S3 / OQ-4, and why sorting is composed here).
- Expansion state keys on `group:>col:type:value` ids (ADR-0006 never prunes them) — the id is
  **value**-derived, so a value that formats differently between renders breaks restoration
  silently. If the refetch surfaces that, it is a finding, not a bug to patch in the story.

## Risks / Watchouts

- Do not implement a library-side `expandAllGroups()` here to make the button honest — that is
  S4/S5, tracked node C3, owned by the state layer.
- The chevron must be a real `<button>`; a `div` with a click handler loses the keyboard half.

## Non-Goals

- No initial-expansion-depth config (S6, blocked — hand-seeding `expandedRows` would misrepresent a
  consumer loop as a library feature). No sticky headers here (Step 4 owns that arg). No unit tests.

## Acceptance Checks

- [ ] Chevron toggles with mouse, Enter and Space; `aria-expanded` tracks state.
- [ ] Collapsing a parent hides its entire subtree at three levels.
- [ ] Collapse state survives Refetch (success _and_ forced failure) and a sort change; Regroup
      discards it wholesale.
- [ ] Sorting a data column leaves group order intact; sorting the grouped column is a legible
      no-op.
- [ ] A `children`-bearing row shows the tree affordance separately from the group chevron.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---

← [Step 4: grouping-static/](step-4-grouping-static-story.plan.md) | [Step 6: grouping-selection/](step-6-grouping-selection-story.plan.md) →
