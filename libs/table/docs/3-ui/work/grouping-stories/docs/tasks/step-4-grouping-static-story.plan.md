---
title: "Step 4 — grouping-static/: the grouped table, always fully shown"
type: task-step
plan: ../../1-gap-analysis.md
node: B
---

# Step 4 — `grouping-static/`: the grouped table, always fully shown

**PR scope:** One story folder, complete — host component, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions, extract-encapsulated-logic

**Depends on:** Step 1, Step 2
**Parallel-safe with:** Step 5, Step 6

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.ts` (create)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.html` (create)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static.stories.ts` (create)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static.mdx` (create)

## Why This Step Exists

Node B. The static grouped table is its own product (product doc §Scope), not a degraded
collapsible one — so it composes `withGrouping()` + `withFiltering()` and deliberately **no**
`withExpansion()`: nothing renders a control that does nothing. Filtering is inherent, not
adjacent: product stories 1.2 and 1.3 are *about* the filtered count and the filtered summary.

Covers product stories 1.1, 1.2, 1.3 (+ its failure path), 1.4, 2.4, 3.1, 3.2 (+ duplicate-level
no-op), 3.3 (+ throwing comparator), 3.4, 4.1, 4.2, 4.3, 4.4, F-G1, and P5b indentation.

## What To Do

**Host + template.**

1. `createTable(data, staticGroupingConfig, withGrouping({ … }), withFiltering({ … }))`, data from
   `GROUPING_ROWS_MOCK`.
2. `@for` over `table.renderRows()`, branching on `row.kind === 'group'`. The group header renders:
   - its **label from `row.groupKey`** (shipped — `api/types.ts`, emitted at
     `engine/grouping.ts`), never parsed back out of the group id;
   - `table.rowsOf(row).length` behind a `showCount` arg, **default `true`** (P6: default-on with a
     switch in every peer that renders one);
   - the `amount` aggregate from `row.aggregates` on the header row (P7 placement); nested levels
     show a parent total that is the sum of the subtree.
3. Indentation off `data-depth` — one CSS offset multiplier. `grouping-story.css` already ships
   `--grouping-indent` and the `[data-depth='n']` rules; use them, don't add new ones.
4. A filter input, proving the count and the summary are of *visible* rows, and that a group whose
   rows all filter out disappears (F-G1).
5. Level control, conventional shapes only (P4/P4b):
   - per-column-header **"Group by this column" / "Ungroup"** → `addGroupLevel` / `removeGroupLevel`;
   - a persistent **pill list** of the active levels in order, made interactive — `◀ ▶` to reorder
     (`reorderGroupLevels`), `×` to remove;
   - **Reset levels** → `setGroupLevels`.
   All four import from the library root (Step 1), never from `mutations/` by path.
6. `groupedColumnMode` arg (`keep` / `hide` / `move-to-front`) over the already-exported
   `toggleColumnVisibility` / `reorderColumns` — P12 is four libraries with four defaults and U2 is
   open, so the story renders all three rather than picking one.
7. `groupOrder` arg: `first-occurrence` (default) / `by-label` / `by-count` / `external-list`,
   threaded into **one** comparator closure reading a signal — not a branch per mode. Labelled in
   the doc-comment as developer config, not an end-user affordance (P9c: no library anywhere lets a
   person order group instances by hand).
8. `stickyHeaders` arg toggling one CSS class keyed off `data-row-kind` / `data-depth` — settles
   OQ-3's "is it just CSS?" empirically.
9. Honest-regression controls, each annotated in the doc-comment as a live gap, not a workaround:
   - **Break one group's summary** — flips a signal the `aggregateFn` throws on. Today this takes
     the table down (S2, [#79](https://github.com/DvirMon/acme/issues/79)); starts passing when
     ADR-0014's wrap lands.
   - **Group by a column that isn't there** — the table degrades to the remaining levels (D14) and
     the story states on canvas that nothing tells the person.
   - The fixture's `null` / `undefined` / `''` region rows render as three unlabelled groups (S7);
     `grouping-story.css`'s `--blank` label style exists for exactly this.
   - The object-valued `owner` column gives `object:[object Object]` (S8); the `Date` column
     (`closedAt`) groups correctly — shown side by side.

**`.stories.ts` + `.mdx`.**

- `Meta` title `Table / Grouping / Static`. Exports: `Default` and `ThrowingGroupOrder`.
- `ThrowingGroupOrder` earns its own export by `stories.md`'s rule: the D15 fallback (stable
  first-occurrence order, one `console.error` per evaluation) only ever renders on the unhappy
  path. The host surfaces the report **on canvas** — `console.error` is not an affordance.
- The host's `story-host__hint` paragraph branches per story state, so a person clicking between
  the two exports sees what differs without opening the Docs page.
- `.mdx` stays a thin `Meta`/`Canvas`/`Source` wrapper + code-tabs. Tabs: `HTML`, `TS`, `CSS`, then
  `grouping/fixtures/schema.ts`. Types/mock/utils tabs are excluded by convention.

## Implementation Notes

- Read `docs/3-ui/stories.md` before writing — it is the story convention SSOT (separate template
  file always, `Component` suffix on the host class, doc-comment names the decision the story
  proves, on-canvas buttons over the actions panel).
- The doc-comment opens by naming *why this composition* — static mode as its own product, and why
  no `withExpansion()`.
- Per-cell/per-row markup with its own internal shape (the group header row) goes in its own
  `ng-template` or sub-component if it grows — `extract-encapsulated-logic.md`.

## Risks / Watchouts

- Don't reconstruct a label from the `group:>col:type:value` id — that is exactly what C1 exists to
  prevent.
- One comparator closure for `groupOrder`, not four branches, or the story teaches a shape a
  consumer would have to un-learn.
- Keep the level-pill UI story-local and minimal: a real drag-to-group toolbar is an unowned
  capability (§9.2/§9.3), not a story.

## Non-Goals

- No `withExpansion()` here (Step 5 owns it). No group footers, no `role="treegrid"`, no column
  menu as a general capability, no unit tests on the host.

## Acceptance Checks

- [ ] Group headers render a label, a count (toggleable), and a summary at every depth.
- [ ] Filtering changes counts and summaries; an emptied group disappears.
- [ ] All four level updaters are reachable from the canvas and imported from the library root.
- [ ] `groupOrder`, `showCount`, `groupedColumnMode`, `stickyHeaders` all take effect.
- [ ] `ThrowingGroupOrder` renders the D15 fallback order and the report on canvas.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 3: grouping fixtures — transport](step-3-grouping-fixtures-transport.plan.md) | [Step 5: grouping-collapsible/](step-5-grouping-collapsible-story.plan.md) →
