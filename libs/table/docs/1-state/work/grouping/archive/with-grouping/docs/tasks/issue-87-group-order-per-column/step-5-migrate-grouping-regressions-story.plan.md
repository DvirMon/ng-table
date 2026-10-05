---
title: 'Step 5 — Migrate grouping-regressions to applyGroupOrder'
type: task-step
issue: 87
---

# Step 5 — Migrate `grouping-regressions` to `applyGroupOrder`

**PR scope:** Fixes the one call site the Step 4 removal breaks. No behavior change — the story's
on-canvas controls (`groupOrder` arg: `first-occurrence` / `by-label` / `by-count` /
`external-list` / `throwing`) and their effect stay identical; only how the comparator reaches
`withGrouping()` changes.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions

**Depends on:** Step 4 — `WithGroupingConfig.groupOrder` must already be gone and
`applyGroupOrder` must already exist for this migration to have anything to migrate to.

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/grouping/grouping-regressions/grouping-regressions-story-host.component.ts` (edit)

## Why This Step Exists

`grouping-regressions-story-host.component.ts` is the design doc's named "only consumer supplying
a comparator" (`design-group-admission.md` § Migration). It currently applies **one** comparator
(`compareGroups`, reading the story's own `groupOrder` input signal) at **every** level via the
table-wide config, because `STATIC_GROUPING_LEVELS = ['region', 'category']` groups by two
columns. After Step 4, that config slot no longer exists — this step moves the same comparator
into a `schema` fn, declared once per level.

## What To Do

Replace the `withGrouping()` call:

```ts
protected readonly table = createTable(
  this.data,
  groupingConfig,
  withGrouping({
    initial: STATIC_GROUPING_LEVELS,
    groupOrder: this.compareGroups,
  })
);
```

with:

```ts
protected readonly table = createTable(
  this.data,
  groupingConfig,
  withGrouping({
    initial: STATIC_GROUPING_LEVELS,
    schema: (path) => {
      applyGroupOrder(path.region, this.compareGroups);
      applyGroupOrder(path.category, this.compareGroups);
    },
  })
);
```

Add `applyGroupOrder` to the existing `../../../index` import (alongside `addGroupLevel`,
`createTable`, `patchRow`, `setGroupLevels`, `withGrouping`, `type GroupSummary`).

`this.compareGroups` is passed by reference to both calls — same function, same closure over
`this.groupOrder()` — exactly matching the old behavior of one table-wide comparator applied at
every level. Do not write two separate comparator closures; that would be new behavior (the story
is deliberately demonstrating one shared mode-switching comparator, not per-level modes).

## Implementation Notes

- **`path.region`/`path.category` come from the same `schema` fn's recorder session** — both
  `applyGroupOrder` calls inside one `schema: (path) => {...}` share the session `runColumnsSchemaFn`
  opens, exactly like `applyGrouping(path.region, ...)` / `applyGrouping(path.rep, ...)` in the
  design doc's own two-level example.
- **`STATIC_GROUPING_LEVELS` still seeds `initial`** — `applyGroupOrder` never activates a level
  (Step 1/2's Implementation/Why notes); it only orders siblings once a level is already active
  via `initial` (or `applyGrouping`, not used by this story).
- The story's own `groupOrder` **input** (`readonly groupOrder = input<GroupOrderMode>(...)`) and
  its Storybook `argTypes`/`args` are the story's on-canvas control, not the table config field —
  leave them untouched. Same name, different concept; that collision predates this step and isn't
  this step's problem to rename.

## Risks / Watchouts

- Don't apply the comparator to only one of the two levels — the story exists specifically to
  demonstrate a comparator affecting group order, and `STATIC_GROUPING_LEVELS` has two levels;
  dropping the second call silently narrows the story's own coverage.
- Don't wrap `this.compareGroups` in a new arrow (`(a, b) => this.compareGroups(a, b)`) — passing
  it directly preserves `this` binding since it's already a bound arrow class field, and wrapping
  it adds an indirection with no behavioral difference.

## Non-Goals

- No changes to `grouping-regressions.stories.ts`, `grouping-regressions-toolbar.component.*`, or
  `grouping-regressions-story-host.component.html` — their `groupOrder` references are the story's
  own control name, unaffected by this migration.
- No changes to `grouping-collapsible-story-host.component.html`'s prose mentions of `groupOrder`
  — that's Step 7 (docs).

## Acceptance Checks

- [ ] `grouping-regressions-story-host.component.ts` no longer references
      `WithGroupingConfig.groupOrder`; it declares the comparator via
      `schema: (path) => { applyGroupOrder(path.region, ...); applyGroupOrder(path.category, ...); }`.
- [ ] All five story modes (`first-occurrence`, `by-label`, `by-count`, `external-list`,
      `throwing`) behave identically to before this step — same visible ordering, same
      throwing-comparator fallback notice.
- [ ] `nx run shared-table:typecheck` clean for this file (whole-project stays red until Step 6
      fixes the two spec files).

---

← [Step 4: Wire into withGrouping()](step-4-wire-with-grouping.plan.md) | [Step 6: Tests](step-6-tests.plan.md) →
