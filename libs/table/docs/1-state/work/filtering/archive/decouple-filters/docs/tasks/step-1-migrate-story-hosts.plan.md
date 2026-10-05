# Step 1 — Migrate the five story hosts to the predicate list

**PR scope:** one PR. Parallel-safe with Step 2, Step 4.
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                                                                                      | Line | Action |
| --------------------------------------------------------------------------------------------------------- | ---- | ------ |
| `libs/shared/table/src/stories/composition/derived-state/derived-state-story-host.component.ts`           | 37   | edit   |
| `libs/shared/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.ts`       | 188  | edit   |
| `libs/shared/table/src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts` | 75   | edit   |
| `libs/shared/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts`    | 72   | edit   |
| `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.ts`          | 177  | edit   |

## Why This Step Exists

`#69` added `predicates` to `WithFilteringConfig` alongside the existing `filters` field; `#71`
deletes `filters`. Every consumer must be off the old field before that deletion can land, and the
five story hosts are the only non-spec consumers in the repo.

They are also the only artifacts that prove the wiring expression works in a real Angular
component rather than in a test harness — `withFiltering({ predicates: () => [this.filters().matcher()] })`
is the composition the spec names as _the_ consumer-side seam.

## What To Do

Replace the config object at each of the five sites:

```ts
// before
withFiltering({ filters: this.filters });

// after
withFiltering({ predicates: () => [this.filters().matcher()] });
```

Nothing else in these hosts changes. The `createFilters()` declarations, the criterion types, the
templates and the fixtures all stay exactly as they are — this step swaps how the model reaches
the table, not what the model is.

## Implementation Notes

- `this.filters` is the callable filter object; `this.filters()` is its root; `matcher()` is the
  root method added in `#68`. All three calls happen inside the thunk, so the whole chain is read
  on every pass.
- **Reactivity is preserved by construction.** `matcher()` reads the criterion signals when it is
  called, and the thunk is called once per pipeline pass, so the same signal graph that drove the
  old `filters` field drives the new one. No `computed()` wrapper is needed or wanted around the
  thunk.
- Per the global no-raw-signal-alias rule, do not hoist `const matcher = this.filters().matcher`
  to a field — the read must stay inside the thunk or the pass stops tracking.
- `client-filtering-story-host.component.ts:188` and
  `selection-filtering-story-host.component.ts:75` pass `withFiltering(...)` as one of several
  feature arguments — keep the trailing comma and argument order untouched.
- `server-filtering-story-host.component.ts` composes no filtering feature at all. It is **not** in
  this step; its prose is handled in Step 5.
- `predicate-filtering-story-host.component.ts` already runs on `predicates` (landed with `#69`).
  Leave it alone.

## Risks / Watchouts

- `filters` is still an accepted field through this issue, so a missed site compiles silently. Grep
  `filters: this.filters` across `src/stories/` before calling the step done — the expected hit
  count afterwards is zero.
- The two grouping hosts drive filtered aggregates. A wrong `matcher()` wiring shows up as an
  unfiltered group total, not as a build error.

## Non-Goals

- Deleting the `filters` field from `WithFilteringConfig` — that is `#71`.
- Touching `createFilters()` schemas, criterion types or story fixtures.
- Adding a new story host — the plain-predicate story already exists.
- Prose/`.mdx` updates — Step 5.

## Acceptance Checks

- [ ] All five hosts compose `withFiltering({ predicates: () => [this.filters().matcher()] })`
- [ ] `grep -r "filters: this.filters" libs/shared/table/src/stories/` returns nothing
- [ ] No host gained or lost an import
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` is clean
- [ ] Story behavior is visually unchanged — each story filters exactly as it did before

---

[Step 2: Move the criterion-map typing assertions](step-2-move-criterion-map-typing.plan.md) →
