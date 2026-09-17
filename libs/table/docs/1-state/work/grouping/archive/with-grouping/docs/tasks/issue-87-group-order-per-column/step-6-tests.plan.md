---
title: "Step 6 — Tests: per-column sortClusters, applyGroupOrder through the public surface"
type: task-step
issue: 87
---

# Step 6 — Tests: per-column `sortClusters`, `applyGroupOrder` through the public surface

**PR scope:** Migrates every existing `groupOrder`-shaped test to the new per-column map/schema
call shape (Steps 1-5 leave these files not compiling), and adds the two new behaviors #87
introduces: two levels ordering independently, and a comparator on a column with no active level
being a no-op.

**Task type:** test

**Depends on:** Steps 1-5 — this step's subject is the finished per-column ordering feature.

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/engine/grouping.spec.ts` (edit)
- `libs/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

Steps 3-5 change `sortClusters`'s signature and `withGrouping()`'s config shape; every existing
`groupOrder`-related test call breaks at compile time until this step updates the call shape.
Beyond mechanical migration, the per-column mechanism has one behavior the old single-comparator
tests could never exercise: two levels ordering by genuinely different criteria in one table
(design doc's headline example, and issue #87's own second acceptance criterion).

## What To Do

### `engine/grouping.spec.ts`

**`describe('sortClusters', ...)` block (~line 174-217):**

- `"reorders each parent's own children by rows.length..."` (line 174): the fixture's nodes use
  `columnId: 'top'` (A, B) and `columnId: 'sub'` (a1/a2, b1/b2). To keep testing "one comparator
  applied at both depths, still never crosses parents," pass a map covering both:
  `sortClusters(nodes, new Map([['top', groupOrder], ['sub', groupOrder]]), (items) => items, { done: false })`.
- `"groupOrder omitted (undefined) returns the nodes array unchanged..."` (line 186): pass
  `undefined` for the map (same as before — omitted stays omitted, no rename needed at the call
  site since the parameter itself is now the map-or-undefined).
- `"a throwing groupOrder falls back to the pre-sort order..."` (line 196): same map treatment as
  the first test — `new Map([['top', throwingGroupOrder], ['sub', throwingGroupOrder]])`. Keep the
  assertion that `reportSpy` is called **exactly once** across the whole tree (D15 — once per
  evaluation, not once per level).
- **Add:** a test with *different* comparators for `'top'` and `'sub'` — e.g. `top` ascending by
  `key`, `sub` by `rows.length` descending — asserting each level's own siblings order by its own
  rule and neither leaks into the other. This is the direct engine-level proof of #87's headline
  claim; the with-grouping.spec.ts addition below is its public-surface counterpart.

**`describe('admission-aware ordering (sortClusters with no groupOrder)', ...)` block (~line
363-402):** rename the describe title (no longer accurate — it now covers per-column ordering
generally, not just the no-comparator default) to something like `'admission-aware ordering
(sortClusters, per-column)'`. The two `undefined`-map tests (stable partition, reference identity)
need no other change. The `clusterRows(orders, ['region'], columns, { when, groupOrder:
dissolvedFirst })` call (line 394-397) becomes:

```ts
const result = clusterRows(orders, ['region'], columns, {
  when,
  groupOrderByColumn: new Map([['region', dissolvedFirst]]),
});
```

### `api/features/with-grouping.spec.ts`

Add `applyGroupOrder` to the existing `import { applyGrouping } from '../../schema/grouping-rules';`
line (→ `import { applyGrouping, applyGroupOrder } from '../../schema/grouping-rules';`).

- **`'groupOrder omitted preserves first-occurrence cluster order...'`** (line 265): no config
  change (already has no `groupOrder`) — unaffected.
- **`'groupOrder reorders group headers...'`** (line 282): replace the config's
  `groupOrder: (a, b) => b.rows.length - a.rows.length` with
  `schema: (path) => applyGroupOrder(path.category, (a, b) => b.rows.length - a.rows.length)`.
  Read the existing assertion carefully first: region siblings (US, EU) are tied at 3 rows each in
  this fixture, so the *observable* behavior of "only `category` has a comparator, `region` uses
  the default" is identical to today's "one comparator applied everywhere" for this specific data
  — the assertion block (lines 300-313) should not need to change, only the config. If the tied
  count means the test can no longer tell "region has no comparator" apart from "region has the
  same comparator," that's fine — this test's job is `category`-level reordering, not region-level
  proof (the next test covers cross-depth independence, and the new two-levels test below covers
  genuinely different per-level comparators).
- **`'a groupOrder that reorders one depth never reorders sub-clusters at a different depth...'`**
  (line 316): this test's whole point — one comparator, applied only where it's declared, doesn't
  bleed into a different depth — is now **true by construction** (the map only has an entry for
  whichever column `applyGroupOrder` targeted). Rewrite it as: apply the key-comparator only to
  `path.region` via `schema`, and assert region reorders (EU before US) while category order within
  each region is untouched (unchanged from insertion, since `category` never had `applyGroupOrder`
  called on it and there's no `region`-level fallback bleeding through). This is a **stronger**
  assertion than before — previously "never reorders a different depth" had to be checked because
  one comparator recursed everywhere; now it needs to be checked because there is no comparator at
  all for the untouched depth, and the stable partition/no-op default must still hold there.
- **`'sorting the grouped column is a no-op on cluster order when groupOrder is not supplied
  (D5)'`** (line 348): unaffected — no config change.
- **`'a throwing groupOrder falls back to stable order...'`** (line 373): replace
  `groupOrder: () => { throw new Error('boom'); }` with
  `schema: (path) => applyGroupOrder(path.region, () => { throw new Error('boom'); })`.
- **`'a groupOrder that places dissolved clusters first...'`** (line 1785): replace
  `groupOrder: (a, b) => Number(a.admitted) - Number(b.admitted)` with
  `schema: (path) => applyGroupOrder(path.region, (a, b) => Number(a.admitted) - Number(b.admitted))`.
  This test already covers "comparator receives `admitted`" (#87's fourth acceptance criterion) —
  no new test needed for that criterion, only the call-shape migration.
- **Add:** a test with `initial: ['region', 'category']` and **two different** comparators —
  `applyGroupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key)))` and
  `applyGroupOrder(path.category, (a, b) => b.rows.length - a.rows.length)` — asserting both
  levels reorder independently by their own rule in the same `renderRows()` output. Use
  `makeColumns()`/`mockGroupingRows` (the fixture the neighboring tests in this block already
  use) so the expected shape can be reasoned about the same way the existing `toShape(rows)`
  assertions are.
- **Add:** a test that `applyGroupOrder` on a column with no active level (e.g. a column not in
  `initial` and never named by `applyGrouping`) changes nothing and throws nothing — the
  documented "silent no-op on an inactive level" from Step 1/2's design notes.

## Implementation Notes

- **Don't touch `RENDER_ORDER`/pipeline-level tests unrelated to ordering** — this step's blast
  radius is exactly the `groupOrder`-named tests plus the two new ones above.
- **Read each rewritten test's existing assertions before changing the config** — several
  (`'groupOrder reorders group headers...'`) depend on specific fixture row counts being tied or
  untied at a given depth; changing which level the comparator targets can change which assertion
  is actually being proven. Prefer keeping today's assertions intact and only changing the
  config's shape where the underlying behavior is unchanged; only rewrite an assertion when the
  step-by-step note above says the test's meaning itself changes (the "never reorders a different
  depth" case).

## Risks / Watchouts

- **The two "add a test" items are not optional filler** — they're `#87`'s acceptance criteria
  ("Two levels with different comparators order independently" and the inactive-level no-op),
  not incidental coverage. Don't skip them because the migrated tests already pass.
- Per this repo's test-run policy: run only the files this step touches locally if you need fast
  feedback, but do not treat a local `nx test` run as the gate — CI is. See `progress.md`'s note on
  this slice's overall verification story.

## Non-Goals

- No new test infrastructure/fixtures beyond what's listed — reuse `twoParentFixture()`,
  `makeColumns()`, `mockGroupingRows` as the neighboring tests already do.
- No docs changes (Step 7).

## Acceptance Checks

- [ ] Every `groupOrder`-shaped test in both spec files compiles and passes against the new
      per-column shape.
- [ ] A new engine-level test proves two different columns order independently with no cross-talk.
- [ ] A new public-surface test proves two levels with different comparators order independently
      in one `renderRows()` output (#87 AC2).
- [ ] A new test proves `applyGroupOrder` on an inactive column is a no-op (Step 1/2's documented
      behavior, previously undertested).
- [ ] `nx run shared-table:typecheck-spec` clean, on a source-clean run of both `typecheck` and
      `typecheck-spec`.
- [ ] `shared-table` suite green in CI on the PR — not run locally per repo policy; this step's
      "passes" claims above are unverified until CI confirms.

---
← [Step 5: Migrate grouping-regressions story](step-5-migrate-grouping-regressions-story.plan.md) | [Step 7: Docs](step-7-docs.plan.md) →
