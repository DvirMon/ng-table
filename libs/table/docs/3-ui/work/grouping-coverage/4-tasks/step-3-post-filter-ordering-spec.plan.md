# Step 3 — Pin group ordering to post-filter rows

**Task type:** test
**Stack:** angular
**Parallel-safe with:** Steps 1, 2, 4, 7

## Why

Three acceptance criteria in `0-product/grouping.md` describe outcomes that no data, config or
user action can make false, because `PIPELINE_ORDER` is `['filter', 'group', 'sort', 'expand']`
(`engine/pipeline.ts:6`) and clusters are therefore built from already-filtered rows:

| Criterion | Where |
|---|---|
| "The ordering reflects the filtered rows" | §3.4 crit. 2 |
| "The ordering updates when the data does" | §3.4 crit. 3 |
| "A group with no surviving rows disappears rather than rendering empty" | F-G1 crit. 2 |

A story can only show these being true, which teaches a reader nothing about the API the story
exists to teach. They are in the doc because **AG Grid gets the first one wrong** —
`initialGroupOrderComparator` runs before filtering and aggregation — and §8.4 already records
that as a differentiator. A competitive claim is not a user story.

§3.4's own design status says it: *"Ordering must run after clustering and filtering for that to
hold — worth a test, not a decision."* **That test does not exist.** The one genuine risk — an
edit to `PIPELINE_ORDER` — is unguarded today, and a story would never have caught it.

Decision D4: delete the three criteria (step 5) and add the assertion here.

## Where it goes, and why not the two obvious places

**`api/features/with-grouping/feature.spec.ts`** — immediately after line 244.

- **Not `engine/grouping/clusters.spec.ts`.** `clusterRows` (`engine/grouping/pipeline.ts:8-28`)
  takes `rows` as a parameter and has no filter stage. A test there could only pre-filter the
  array itself and assert the comparator saw a shorter array — a tautology about
  `Array.prototype.filter`, not about `PIPELINE_ORDER`.
- **Not `engine/pipeline.spec.ts`.** It already owns the stage-order invariant generically and
  is deliberately stage-agnostic; adding grouping concepts would drag the domain into a file
  that knows nothing about it.
- `feature.spec.ts` is the only place a real `createTable()` composes `withFiltering()` +
  `withGrouping()`, which is what makes "the comparator saw post-filter rows" observable rather
  than a restatement of the input.

Line 244 is the end of `'filter -> group pipeline order: group aggregates reflect only
post-filter rows'` — the aggregate twin of this assertion. Placing the ordering one directly
beside it makes the pair read together.

## Files

- `libs/table/src/api/features/with-grouping/feature.spec.ts`

## What to do

Add one `it(...)` after line 244, reusing what the file already has:

- `excludeAmount300` — the shared filter schema, `:84-86`
- `inContext()` — `:78-80`
- the size-ranking comparator idiom — `:311`
- `makeColumns()`, `mockGroupingRows`, `mockGroupingTrackBy`

Shape: compose `withFiltering({ schema: excludeAmount300 })` and
`withGrouping({ initial: [...], schema: (path) => applyGroupOrder(path.region, bySizeDesc) })`,
then assert the rendered group-header order matches the ranking of **post-filter** cluster
sizes. Pick the fixture rows so the two rankings genuinely differ — if the filtered and
unfiltered orders are the same, the test passes vacuously and proves nothing. Say so in a comment
the way the neighbouring aggregate test does ("Without the filter the US average is 150…").

If a `setup()` helper is extracted, give it an explicit return type built from the features' own
exported member interfaces (`TableStore<GroupingMockRow> & GroupingMembers<GroupingMockRow> &
FilteringMembers<...>`), matching the two helpers already in this file. Do not narrate the
decision in a comment — cite the audit by id if anything, per `stories.md` rule 4.

## Acceptance checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] The assertion fails if `PIPELINE_ORDER` is edited to put `'group'` before `'filter'`.
      Verify by making that edit locally, watching it fail, and reverting. **This is the whole
      point of the test** — an assertion that passes under both orders is not the one asked for.
- [ ] The filtered and unfiltered rankings differ, so the test cannot pass vacuously.
- [ ] No new import from `engine/` — this is an `api/`-level spec.
