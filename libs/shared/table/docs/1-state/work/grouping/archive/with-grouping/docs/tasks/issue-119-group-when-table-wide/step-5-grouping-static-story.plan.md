---
title: "Step 5 — grouping-static demonstrates rows with no group value staying flat"
type: task-step
issue: 119
---

# Step 5 — `grouping-static` demonstrates rows with no group value staying flat

**PR scope:** One toggle on the existing static-grouping story, and the story description that
currently promises the opposite behaviour.

**Task type:** code

**Skills used:** angular-developer, css-styling, declarative-naming

**Depends on:** Step 3 — the config member has to exist.

**Parallel-safe with:** Step 4, Step 6.

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.html` (edit)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-toolbar.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static.stories.ts` (edit)

## Why This Step Exists

`grouping-static.stories.ts` currently tells the reader:

> Blank group keys (`null`/`undefined`/`''`) still cluster as unlabelled groups unless the column
> declares an `accessor`.

That is the behaviour this slice makes configurable, so the story that states it is the story that
has to show the alternative. Extending it beats a new story host: the mechanism is one config key,
the fixture already carries all three blank keys (`fixtures/types.ts` documents `region` as
nullable *and* optional precisely for this), and `grouping-static` is already the "no second
feature composed, copyable as-is" story — which is exactly the frame a consumer reaching for
`groupWhen` is in.

## What To Do

### 1. A story input backing the predicate

```ts
readonly keepBlankRegionsFlat = input(false);
```

Wire it into the table config. The predicate reads the signal, so flipping the Storybook control
re-clusters with no `effect()` and no table rebuild — both grouping stages evaluate it inside their
own computeds:

```ts
protected readonly table = createTable(
  this.data,
  groupingConfig,
  withGrouping({
    initial: STATIC_GROUPING_LEVELS,
    groupWhen: (cluster) => !this.keepBlankRegionsFlat() || isPresentKey(cluster.key),
  }),
);
```

Extract the key test rather than inlining the condition — it is the one piece of domain reasoning
here, and a reader copying this story is copying that line:

```ts
/** Blank in the product sense, not the JS sense: `null`, `undefined` and `''` all read as "this
 * deal has no region". */
function isPresentKey(key: GroupKey): boolean {
  return key !== null && key !== undefined && key !== '';
}
```

Put it in the host file as a module-level function — it has no state and no lifecycle of its own,
so it does not earn a `.utils.ts` (`extract-encapsulated-logic` § Don't extract when).

### 2. A toolbar control

Add a checkbox beside the existing controls, labelled for the domain fact rather than the API:
*"Keep deals with no region flat"*. Follow whatever binding shape the toolbar already uses for
`showCount`/`stickyHeaders` — do not introduce a second control idiom.

### 3. `argTypes` and the description

- `keepBlankRegionsFlat: { control: 'boolean' }`, default `false`, so the story opens on today's
  behaviour and the toggle is what shows the change.
- Rewrite the blank-keys paragraph in the `Static` story's description: blank keys cluster as
  unlabelled groups by default, and `groupWhen` is how a consumer opts out — with the one-line
  predicate shown.

### 4. A dedicated story variant

Add one alongside `Static`, the way `grouping-regressions` adds `args`-only variants, so the flat
behaviour has a permalink rather than only existing behind a control a reader has to find:

```ts
/**
 * Deals with no region stay flat
 *
 * `groupWhen: (c) => c.key != null` — the cluster is judged and rejected, so its rows render at
 * the parent's depth with no header. With no comparator supplied they land after the groups that
 * were admitted.
 */
export const BlankRegionsFlat: Story = { args: { keepBlankRegionsFlat: true } };
```

## Implementation Notes

- **Default the control off.** The story's job is the contrast; opening on the new behaviour hides
  the thing being demonstrated.
- **Do not add a "Ungrouped" divider or heading.** Q2 ships nothing in v1 — the flat rows are
  deliberately unmarked, and inventing a divider in a story makes it look like library surface.
- **Do not touch `grouping-regressions`.** It is deliberate-misuse territory; a correctly-used
  predicate does not belong there.
- Per `feedback_no-decision-narration-in-code-comments`, keep Q-numbers and design-doc rationale out
  of the component source — the story description is where a reader gets the why.

## Risks / Watchouts

- **`nx run shared-table:typecheck` must run to a source-clean pass before it says anything about
  this step.** `ngc` stops at the first `.ts` error and never reaches the template
  (`.claude/rules/typecheck-angular-templates.md`) — and a story-host template binding is exactly
  what the earlier `[formField]` bug (#94) was.
- **The three blank keys currently cluster as three separate unlabelled groups.** With the toggle
  on they become one flat run, not one merged group — make sure the description says that, because
  "they merge" is the natural wrong reading.
- **`STATIC_GROUPING_LEVELS` is `['region', 'category']`.** With the toggle on, escaped rows leave
  the tree entirely and are not grouped by `category` either (Q1) — worth one clause in the story
  description, since it is the visible consequence a reader will ask about.

## Non-Goals

- No new story host, no new fixture rows.
- No per-column threshold control — #120 extends this story if it wants one.
- No changes to the other five grouping stories.

## Acceptance Checks

- [ ] Toggling the control re-clusters live, with no table rebuild and no `effect()`.
- [ ] With it on, deals whose `region` is `null`, `undefined` or `''` render at depth 0 with no
      header, after the admitted groups.
- [ ] With it off, the story renders exactly as it does today.
- [ ] The `Static` story description no longer states unlabelled blank-key groups as the only
      behaviour, and a `BlankRegionsFlat` variant exists.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.

---
← [Step 4: Tests](step-4-tests.plan.md) | [Step 6: Documentation](step-6-docs.plan.md) →
