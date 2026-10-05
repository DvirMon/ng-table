# Step 4 — `grouping-order/` composes `withSorting()`

**Task type:** code
**Stack:** angular
**Parallel-safe with:** Steps 1, 2, 3, 7

## Why

`applyGroupOrder` orders group _headers_ among their siblings. The first question a reader has
on seeing it is **"isn't that just sorting?"** — and the story cannot currently answer, because
there is no row sort on the canvas to contrast against.

Three product-doc entries have no demo and are closed by this one composition:

- **§3.3 criterion 4** — "Changing the row sort does not disturb the group order, and vice versa."
- **S-G1** — "I clicked the column I grouped by and nothing moved — I want to understand why."
- **S-G2** — "Sort by date within each region and have the regions stay where they are."

S-G1 and S-G2 are still marked ✅/🟡 against `grouping-collapsible/`, whose `withSorting()` was
removed in `3af4fcf`. **They are covered on paper and uncovered in fact.**

### This is not a reversal of D5

`3-lesson-audit.md:187-189` already carved out the same shape for `grouping-selection/`:

> `withFiltering()` stays, unlike D5's `withSorting()`: it is what makes "`rowsOf()` is
> post-filter by construction" observable — filter a rep out and the group counts and summaries
> follow. A visible state change, so convention 6 does not bite.

That is the test. In `grouping-collapsible/` the sort's observable outcome was _the screen is
unchanged_ — an invariant you have to notice not happening. Here **both** sides are visible
movements, and _which thing moved_ is the entire content of `applyGroupOrder`. Cite
`3-lesson-audit.md:187-189` in the commit message; this is the audit's own carve-out, not a new
exception to it.

### The contrast costs no new control

The host's existing `groupOrder` select already has a `first-occurrence` mode returning constant
`0`. One arg flip shows both sides:

- **`first-occurrence`** — no effective comparator, so sibling order is first-occurrence over
  rows the pipeline has _already sorted_. Click a header and the **headers move**. S-G1's "the
  click does something visible."
- **`by-label` / `by-count` / `external-list`** — the comparator pins sibling order. Sorting now
  reorders rows _inside_ each group and the headers **hold**. S-G2, and §3.3 criterion 4.

## Files

- `libs/table/src/stories/grouping/grouping-order/grouping-order-story-host.component.ts`
- `libs/table/src/stories/grouping/grouping-order/grouping-order-story-host.component.html`
- `libs/table/src/stories/grouping/grouping-order/grouping-order.stories.ts`
- `libs/table/src/stories/grouping/grouping.mdx`
- `libs/table/docs/3-ui/stories.md`

**Do not edit** `stories/grouping/fixtures/schema.ts`. `plainGroupingConfig` declares no
`sortFn`, `applySortNulls` or `enableSorting`, so every column sorts by `detectComparator`
inference — `amount` numerically, `closedAt` as a `Date`. The moment a column needs a
hand-written comparator to make the point, the point has moved to sorting.

## What to do

### Host `.ts`

Add `withSorting` to the `'../../../index'` import and compose it **trailing**, bare:

```ts
(withGrouping({
  /* unchanged */
}),
  withSorting());
```

- **Bare, no config.** `multi` defaults to `false`, so a click replaces the sort — one column at
  a time, asc → desc → unsorted. `{ multi: true }` would put sort priority on the canvas, which
  is a sorting lesson. `{ manual: true }` would skip the local sort stage and leave nothing to
  contrast against.
- **Trailing**, matching `grouping-selection-story-host.component.ts` — subject first.

**No new member.** Everything the template needs is a direct read of the library's own API, which
`stories.md` names as an accepted in-template exception. In particular:

- `@let direction = table.sortDirections().get(column.id)` — a per-column `computed()` cannot
  work here anyway, since the `@for` is over `visibleColumns()` and the ids are not statically
  known; and `readonly sortDirections = this.table.sortDirections` is the banned signal-aliasing
  shape outright.
- `(click)="table.toggleSort(column.id)"` — an event handler, explicitly allowed. Do **not**
  copy `filtering-selection`'s forwarding `toggleSort(id)` method; it is the outlier among the
  four sortable hosts.

Update the class doc-comment: it currently names `withSorting()` as the thing this story is
_not_, which becomes false. Say why it is composed — "composed here because the header order is
only legible next to the row sort it is not" — without D-numbers or ADR rationale.

### Template — `<thead>`, lines 59-65

Replace with the repo's stock sortable-header block, `@let` inside the existing `@for`,
`[attr.aria-sort]` on the `<th>`, inner `<button type="button">`, `@switch` glyph `▲`/`▼`/`↕`.
Model: `selection/filtering-selection/filtering-selection-story-host.component.html:48-71`.

Two deltas from that model:

- **No `story-host__sort-button` class** — declared in `live-table`'s own CSS, which this host
  does not load. `story-host.css:81-96` already styles `.story-host__cell button`. **No CSS file
  changes in this step.**
- **Add a `grouped` badge** on a `<th>` whose column `table.isGroupedBy(column.id)`, using the
  existing `.grouping-story__count` pill. The toolbar already toggles `Rep` in and out of being
  a level; the badge makes that visible where the reader is now clicking, and makes "click the
  grouped column" self-labelling instead of needing prose.

### Template — hint and notices

The hint (lines 2-6) uses `withSorting()` as a negative reference and must be rewritten. Carry
the one mode-independent fact there, so no single notice repeats it: _clicking a column that is
a level can only ever move headers, never rows, because every row under one of its groups holds
the same value; whether it moves them at all is what the comparator decides._

Each of the five `grouping-story__notice` branches (lines 15-49) keeps its existing sentences
and gains **one** sort clause:

| Mode               | Clause                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `first-occurrence` | The rows reach clustering already sorted, so the headers inherit the row sort.                                                                                     |
| `by-label`         | Full statement: sort `Closed` and rows move while headers hold; sort `Region` and nothing moves at all — "that silence is the price of the decoupling, not a bug." |
| `by-count`         | Headers stay in size order; a row sort never reaches this comparator.                                                                                              |
| `external-list`    | That order survives every row sort applied on top of it.                                                                                                           |
| `throwing`         | The fallback _is_ first-occurrence, so headers follow the row sort again — a comparator that throws pins nothing.                                                  |

The **Rep notice** (lines 51-56) stays byte-identical — it answers a different question, and
adding a sort clause there is the first step toward a 5×2 matrix.

### `.stories.ts` — JSDoc only

`args` and `argTypes` stay byte-identical. **No new arg.** `stories.md`: _"Don't add a second
story object for something a control already covers"_, and a `sortColumn`/`rowSort` toggle would
be the demo-harness knob rule 1 bans — worse, a second Controls axis is how the canvas starts
reading as "grouping × sorting". Add one paragraph to the source-only JSDoc above
`export const Order` naming the contrast.

### `grouping.mdx`

- The intro's "the first seven are `withGrouping()`'s own surface" is now false — reword to
  "most are `withGrouping()`'s own surface; three compose it with exactly one more feature."
- Extend the second-feature roll-call to name `withSorting()` in `Order` alongside
  `withExpansion()` in `Collapsible` and `withFiltering()` in `Group selection`.
- `## Order`: one new paragraph on the contrast, plus a clause on `throwing`'s fallback.
- **No second `<Canvas>`.** The page's contract is one canvas per story, and `stories.md`
  reserves a second for a failure variant with its own CSF export.
- While in this file, fix the `/code-review` Spec finding: the Collapsible section claims
  collapse state survives "a refetch, **a failed refetch** or a sort". No failed-refetch
  assertion exists and §4a excluded one on purpose. Drop the middle clause, and drop the stale
  "and sort changes" from `grouping-collapsible.stories.ts`'s CSF doc.

### `3-ui/stories.md`

The `grouping/` reference-implementation bullet describes `grouping-order/` as single-feature.
Add one clause acknowledging the composition, matching how the `filtering-selection/` entry
already reads, or the convention doc contradicts the code.

## The trade this creates — name it, do not hide it

S-G1's second criterion reads _"What does not happen: the header shows a sort indicator while
the table does not change."_ Under a real comparator, clicking **Region** does exactly that: `▲`
appears and nothing moves. **This story exhibits the anti-pattern deliberately**, because the
user story's actual verb is _"I want to understand why nothing moved."_

Criterion 1 is met on both sides. Criterion 2 is met under `first-occurrence` and knowingly
violated under a comparator — which is the demonstration. Step 5 marks S-G1 ✅ **with the trade
named in one sentence**, re-attributed from `grouping-collapsible/`. Do not mark it ✅ silently.

## Acceptance checks

- [ ] `nx run shared-table:typecheck` clean — the risk surface here is entirely template
      (`@let` inside `@for`, nested `@switch` inside a `<button>`, the `[attr.aria-sort]`
      expression). Bare `tsc` proves nothing. Re-run until a source-clean run passes.
- [ ] `grouping-order.stories.ts`'s `args` and `argTypes` are byte-identical to before.
- [ ] No CSS file changed; no `fixtures/schema.ts` change.
- [ ] `clearSorting()`, `setSorting()` and `sortChanged` are not called — the third header click
      already clears, and a toolbar button duplicating a table gesture is banned by rule 5.
- [ ] No "current sort" readout on the canvas beyond the header glyph.
- [ ] **Review test:** every sentence added to the canvas is a predicate about
      `applyGroupOrder` ("the comparator decides whether…", "the headers are pinned by label"),
      never about `withSorting()` (how the three-state cycle works, what `multi` does, where
      nulls land). If any sentence fails that, it is the wrong sentence.
