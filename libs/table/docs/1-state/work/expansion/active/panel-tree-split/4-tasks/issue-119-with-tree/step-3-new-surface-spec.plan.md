# Step 3 — `with-tree.spec.ts`: collapse-only, `state()` and the ADR-0014 degrade

**PR scope:** ships alone. **Depends on: Step 2** — extends the same
spec file, which Step 2 creates.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-tree.spec.ts` (edit)

## Why This Step Exists

Three behaviors are new with this feature and have no inherited
coverage: the collapse-only shape (D9/E13), the `state()` tri-state
(D5/E9), and the degrading `childrenAccessor` (D12/E16). The last is
the one a review cannot eyeball — "once per evaluation, in production
too" is a cardinality claim, and a module-level flag would satisfy
every other assertion in this file while silently reporting once per
process.

## What To Do

Append to `libs/table/src/api/features/with-tree.spec.ts`.

### 1. A local stage claimant

To assert that a collapse-only instance leaves `'tree'` unclaimed,
compose it against a feature that claims the stage — defined in the
spec, not imported:

```ts
const claimsTreeStage = createTableFeature(() => ({
  renderStages: { tree: (nodes) => nodes },
}));
```

Use this rather than `withExpansion()`. `withExpansion()` claims
`'tree'` unconditionally today and stops claiming it in #121, so
pointing the assertion at it would make this file fail on an unrelated
issue — and it would be asserting the panel's domain from the tree's
spec.

### 2. Collapse-only

1. `withTree()` with no `childrenAccessor` composes alongside
   `claimsTreeStage` without throwing; `withTree({ childrenAccessor })`
   composed the same way **throws** the slot-collision error. That
   pair is the observable form of "the stage is claimed only when an
   accessor is supplied".
2. Collapse-only over the `r1 → c1 → g1` fixture: `renderRows()` is 1:1
   with `rows()`, every row at `depth: 0`, `hasChildren: false`,
   `isExpanded: undefined` — no children are nested, because no stage
   ran.
3. Collapse-only still hides descendants: composing
   `withGrouping(schema)` with `withTree()`, group headers render and
   their members are hidden until `tree.expand(table.groupIds())`
   opens them. This is the case that proves `expandedRows` is
   contributed unconditionally — with no contributor the walk would
   leave everything open.
4. `expand()` with no ids on a collapse-only instance is a no-op: the
   walk discovers nothing, `tree()` is unchanged and `changed` is
   silent. The explicit-ids form is what a collapsible-grouping
   toolbar calls.

### 3. `state()`

5. Fresh table with expandable rows → `'none'`.
6. One of two expandable rows open → `'some'`.
7. After `expand()` with no ids → `'all'`.
8. A flat table with nothing expandable → `'none'`, not `'all'` — the
   empty denominator resolves to `'none'` by decision, and a
   `0 === 0` check would silently give `'all'`.
9. A collapse-only instance reads `'none'` even with ids open (case 3's
   table, after `expand(table.groupIds())`) — group ids are not
   discoverable from an accessor, so the denominator is empty. This is
   the documented limitation, not a bug to fix here.
10. `state` recomputes when `data` changes — adding an expandable row
    to a fully-expanded table moves `'all'` → `'some'`.

### 4. The ADR-0014 degrade

Spy with `vi.spyOn(console, 'error').mockImplementation(() => {})` and
restore it per case.

11. A `childrenAccessor` that throws for every row: the rows still
    render, each with `hasChildren: false` and no nested children, and
    `console.error` is called **exactly once** across an evaluation
    that visits several rows. Read `renderRows()` once and assert
    `toHaveBeenCalledTimes(1)`.
12. Scope, not suppression: after that first `renderRows()` read, call
    `table.tree.expand()` and assert the call count went to **2**. A
    second evaluation reports again; a module-level flag would leave it
    at 1. Read `state()` for a third evaluation and a third report.
13. A throwing `isExpandable` degrades to `false` — no toggle renders —
    and reports once, with its own message.
14. A table whose `childrenAccessor` **and** `isExpandable` both throw
    reports **twice** in one evaluation, once per callback. This is
    what pins the per-callback flags: one shared flag would report
    once.
15. The default `isExpandable` produces no second report when the
    accessor throws — with only `childrenAccessor` supplied and
    throwing, the count stays at 1 per evaluation, because the default
    predicate reads through the already-guarded accessor.

### 5. `describe('types')`

Mirror `with-expansion.spec.ts`'s block — `expectTypeOf`, compile-time
only, enforced by `typecheck-spec` rather than by the runner.

16. `withTree()` alone: composed members are recovered exactly, never
    widened to `any` — `expectTypeOf(store.tree).toMatchTypeOf<TreeSlice>()`,
    `store.tree()` is `ReadonlySet<RowId>`, `store.tree.state()` is
    `'all' | 'some' | 'none'`.
17. A trailing `withComputed()` block reading `s.tree` adds a typed
    member — and is typed only because `withTree()` precedes it.
18. The derive-first form compiles: `withTree(withComputed(...))`.

## Implementation Notes

- **Cases 12 and 14 are the point of this step.** Every other
  assertion here would pass against a module-level `reported` flag or a
  single shared flag. If the implementation drifts, these two are what
  catch it — write them first.
- **Case 11 needs more than one row in the fixture.** With a single
  row, "once per evaluation" and "once per row" are the same number.
- **Case 8's wording is a decision, not an accident.** `'none'` for an
  empty denominator is spelled out in `TreeSlice.state`'s own doc; the
  assertion is there so a later "tidy-up" to `openCount ===
  expandable.length` does not flip it to `'all'`.
- **Case 1 asserts a throw, so assert on the message too** — the
  collision text comes from `engine/slots.ts`, and a bare `toThrow()`
  would also pass on an unrelated construction error.

## Risks / Watchouts

- Restore the `console.error` spy in an `afterEach`, or the counts in
  later cases inherit earlier calls and every cardinality assertion
  becomes meaningless.
- `state` is a `computed()`; reading it twice without an intervening
  write is **one** evaluation, not two. Case 12 must change something
  (or read a genuinely different surface) between counts.
- Do not assert the collapse-only claim through `withExpansion()`. See
  §1 — it couples this file to the panel's claim, which #121 removes.
- Case 3 composes grouping, so it needs a grouping schema and a
  fixture with a groupable field. Reuse whatever
  `with-grouping/feature.spec.ts` builds rather than inventing a
  second shape.

## Non-Goals

- No assertion about `withExpansion()`'s members, its claim, or the
  documented double-claim throw. Another domain's spec.
- No cycle-guard case — a self-referencing accessor still overflows
  and is out of scope (#105).
- No lazy-fetch case beyond C3's shape (Step 2). The library fetches
  nothing.

## Acceptance Checks

- [ ] All new spec cases pass.
- [ ] `nx run shared-table:typecheck-spec` clean — the `describe('types')`
      block is only enforced there, never by the runner.
- [ ] Every acceptance criterion on
      [#119](https://github.com/DvirMon/ng-table/issues/119) has a case
      or a line of source behind it.

---
← [Step 2: The inherited row-tree behavior](step-2-tree-behavior-spec.plan.md)
