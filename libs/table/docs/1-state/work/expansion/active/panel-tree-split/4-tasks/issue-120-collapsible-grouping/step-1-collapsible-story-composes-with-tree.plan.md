# Step 1 — The collapsible grouping story composes `withTree()`

**PR scope:** ships alone. **Parallel-safe with: Step 2, Step 3** — no
step reads another's artifact. This one is the only step that touches
a template, so it carries the migration's real gate.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts`
  (edit)
- `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html`
  (edit)

## Why This Step Exists

Collapsible grouping is the capability [#101](https://github.com/DvirMon/ng-table/issues/101)
re-homes: `createTable(config, withGrouping(schema), withTree())`
puts it in the feature list instead of implying it from a config
object. This story is the only in-repo consumer of the verbs the split
renames, so until it migrates, nothing demonstrates the new spelling
and #121 cannot narrow `withExpansion()` without breaking a story.

**The issue text is wrong about one thing, and the fix is a decision,
not an oversight.** [`2-spec.md`](../../2-spec.md) §"Breaking changes"
calls this story "a collapse-only case". It is not:

- `fixtures/mock.ts` (~lines 46-55) carries a North East / Services
  deal, `id: 'd4'`, with a `children` array — its own comment says
  "one row with children: `'group'` and `'tree'` both run on the same
  row".
- `fixtures/types.ts` declares `children?: DealRow[]` on `DealRow`.
- The template renders a second chevron on that data row —
  `@if (isFirst && row.hasChildren)`, lines 105-114 — and closes with
  a paragraph (lines 135-139) naming the `'tree'` render stage as
  where it comes from.

That chevron works today only because `withExpansion()` falls back to
`(row as { children?: TRow[] }).children` when no `childrenAccessor` is
given. D2/E6 deleted that fallback. A bare `withTree()` here would
claim no `'tree'` stage, stamp `hasChildren: false` on every row, and
silently drop the affordance and its lesson.

So: **pass the accessor explicitly.** The story keeps both affordances
and gains a config line that says out loud what used to be implicit.

## What To Do

### 1. `grouping-collapsible-story-host.component.ts`

**Import** — line 2, swap the feature:

```ts
import { createTable, setGroupLevels, withGrouping, withTree } from '../../../index';
```

(`withTree` sorts after `withGrouping`; keep the group alphabetized.)

**Composition** — lines 55-60:

```ts
protected readonly table = createTable(
  this.data,
  groupingConfig,
  withGrouping({ initial: COLLAPSIBLE_GROUPING_LEVELS }),
  withTree({ childrenAccessor: (row) => row.children })
);
```

Argument order is unchanged and load-bearing: `withGrouping()` must
precede `withTree()` so the group stage has produced headers the tree
stage then descends through.

**Verbs** — lines 82-88:

```ts
protected expandAllGroups(): void {
  this.table.tree.expand(this.table.groupIds());
}

protected collapseAllGroups(): void {
  this.table.tree.collapse();
}
```

A direct translation, not a behavior change. `tree.expand(ids)` adds
exactly those ids and runs no discovery walk, so Expand All still
opens headers only — deal `d4`'s line items stay closed until someone
clicks their own chevron, exactly as today. `tree.collapse()` with no
ids clears everything, matching `collapseAll()`.

**Class JSDoc** — lines 14-27. Rewrite, keeping the same three
paragraphs:

- `` `withGrouping()` + `withTree()` `` instead of `withExpansion()`.
  Worth one clause on why the accessor is passed: the fixture nests
  line items under one deal, and there is no `row.children` fallback.
- The Expand All paragraph: `expandAll()` → `tree.expand()`. The
  `groupIds()` rationale is unchanged and still correct —
  `tree.expand()` with no ids discovers data rows through
  `childrenAccessor` and cannot reach a group header, which is exactly
  why `groupIds()` exists.
- The `row.isExpanded` / `flattenVisible()` paragraph stays as written.

### 2. `grouping-collapsible-story-host.component.html`

**Two call sites**, both `table.toggleExpanded(row.id)` →
`table.tree.toggle(row.id)`:

- line 66 — the group header row's `(click)`.
- line 113 — the data-row chevron's `(click)`.

**Unchanged, deliberately:** the `row.isExpanded` bindings at 77, 79,
109 and 111, and `row.hasChildren` at 105. [#108](https://github.com/DvirMon/ng-table/issues/108)
stamps `isExpanded` on group headers too, so both kinds of row read
the same field.

**Prose**, lines 39-45 — the `grouping-story__notice` above the table.
`expandAll()` → `tree.expand()`. The claim itself survives the rename
verbatim; only the spelling moves.

## Implementation Notes

- **`childrenAccessor` needs no explicit type argument.**
  `withTree()`'s row type is recovered from the slot via `RowOf<In>`,
  so `(row) => row.children` infers `DealRow` — do not write
  `withTree<DealRow>(...)` or annotate the parameter.
- **Do not add `isExpandable`.** The default (a non-empty array from
  the accessor) is what the story already relied on, and the fixture
  loads children eagerly. Lazy children are out of scope for the whole
  epic.
- The Regroup and Refetch paths (`regroup()`, `refetchRows()`,
  `refetchRequests`, the `linkedSignal` bridge) are untouched. Their
  whole point is that collapse state survives — which is asserted in
  the specs, not here.

## Risks / Watchouts

- **Dropping `childrenAccessor` is a silent regression, not a
  compile error.** `withTree()` takes it as optional, so
  `withTree()` compiles fine and the story simply loses a chevron
  nobody re-tests. If the implementer finds themselves "simplifying"
  to a bare `withTree()` because the spec said collapse-only, that is
  the failure this step exists to prevent — re-read "Why This Step
  Exists".
- **`ngc` aborts at the first `.ts` error and never reaches the
  template phase.** A run that reported source errors checked no
  templates at all. Fix, re-run, and only trust the second,
  source-clean run — `.claude/rules/typecheck-angular-templates.md`.
- The template is the only place in the repo that calls the removed
  verbs, so a bare `tsc` proves nothing here: it never opens a
  `.html`.

## Non-Goals

- **The toolbar component is unchanged.**
  `grouping-collapsible-toolbar.component.ts` / `.html` declare
  `expandAll` / `collapseAll` outputs — those are named after the
  story's own buttons, not after library verbs, and the host is what
  translates a button press into a table call. Renaming them would be
  churn that makes the diff harder to read.
- No change to `grouping.mdx` — Step 3.
- No change to any spec file — Step 2.
- No change to the other grouping stories. None of them composes an
  expansion feature.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean **on a second,
      source-clean run**. The first run's job is to surface `.ts`
      errors; only a run that starts clean proves anything about the
      template. See `.claude/rules/typecheck-angular-templates.md`.
- [ ] No `withExpansion`, `expandAll`, `collapseAll` or
      `toggleExpanded` left in either story-host file
      (`grep` both; the toolbar's `collapseAll`/`expandAll` **outputs**
      are expected hits and stay).
- [ ] The story composes `withTree({ childrenAccessor: ... })`, not a
      bare `withTree()`.

---
[Step 2: The collapse cases move to the tree's spec](step-2-collapse-cases-move-to-tree-spec.plan.md) →
