# Step 2 — `with-tree.spec.ts`: the inherited row-tree behavior

**PR scope:** ships alone. **Depends on: Step 1** — every case reaches
`table.tree`, which Step 1 introduces.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-tree.spec.ts` (new)

## Why This Step Exists

Today's tree assertions live in `with-expansion.spec.ts` and lean on
the `row.children` fallback that D2/E6 removes. They are the
regression surface for the stage this feature now owns, so they move
here with the accessor passed explicitly — and they must exist and be
green *before* #121 deletes the originals, or the window between the
two issues has no coverage of the row tree at all.

Seam and prior art: [`2-spec.md`](../../2-spec.md) §"Testing
Decisions". Everything is reached through `createTable(...)` in an
Angular injection context — the highest seam available, and the one
`with-expansion.spec.ts` already uses.

## What To Do

Create `libs/table/src/api/features/with-tree.spec.ts`.

### 1. Harness

Copy the fixture block from `with-expansion.spec.ts` verbatim — `Row`,
`CustomChildrenRow`, `makeColumns()`, `makeRows()` (the `r1 → c1 → g1`
tree with `r2` a leaf), and `inContext()`. Then add the one thing the
originals did not need:

```ts
const childrenAccessor = (row: Row): Row[] | undefined => row.children;
```

Every composition in this file passes it explicitly:
`withTree({ childrenAccessor })`. There is no `row.children` fallback
any more, so an omitted accessor means something different (Step 3).

### 2. Cases

Verbs and emission:

1. `toggle(id)` flips a row collapsed → expanded → collapsed.
2. Expanding row A leaves row B open (multi-expand).
3. `expand()` with no ids opens every expandable row at any depth
   (`r1`, `c1`) and leaves leaves (`c2`, `r2`) closed.
4. `expand(ids)` **adds** exactly those ids to what is already open —
   no discovery walk, no `isExpandable` filter, no recursion. Assert
   an already-open id survives the call.
5. `collapse(ids)` removes exactly those ids and leaves the rest open.
6. `collapse()` with no ids clears everything.
7. `set(ids)` replaces atomically — an open id absent from `ids` closes
   in the same write.
8. `changed` emits **once per write**, carrying the whole symmetric
   difference (E18): `toggle` → `{ added: [id], removed: [] }`;
   `expand()` over a fresh table → one emission whose `added` holds
   every newly opened id; `collapse()` → one emission whose `removed`
   holds every previously open id; a repeat write that changes nothing
   emits nothing.
9. `emitEvent: false` on all four verbs: state changes, `changed` is
   silent.
10. `changed` completes when the table is destroyed, so subscribers do
    not leak.

Render output:

11. `renderRows()` excludes a row's children while it is collapsed —
    the default state.
12. `renderRows()` includes them at `depth + 1` only once that row is
    expanded.
13. A depth-2 grandchild (`g1`) appears only once **both** `r1` and
    `c1` are expanded, independently.
14. `hasChildren` is `true` only for rows with a non-empty children
    array; `isExpanded` matches `tree()` membership for a row with
    children and is `undefined` for a childless row (C4). Add the flat
    variant: a table with nothing expandable stamps `isExpanded:
    undefined` on every row.
15. C3 — a row whose accessor returns `[]` but whose `isExpandable`
    returns `true` renders `hasChildren: true`, so its toggle shows
    before children load; toggling it adds no rows; supplying children
    afterwards nests them at `depth + 1`.
16. A tree child's `parentId` is its parent row's id, at depth 1 and
    depth 2; a top-level row's `parentId` is `undefined`.
17. A custom accessor is honored — `CustomChildrenRow` nests under
    `nested`, not `children`, with
    `childrenAccessor: (row) => row.nested`.

Composition and lifecycle:

18. ADR-0006 — removing an expanded row from `data` clears it from
    `tree()`, via either write path (`removeRow` updater and a full
    `data.set()` replacement).
19. `initial` seeds `tree()` at construction, emits nothing on
    `changed`, seeds `renderRows()` as already expanded, and the row
    behaves normally afterwards (toggle / `expand()` / `collapse()`
    all work on top of the seed).
20. Composes with zero other features present —
    `createTable(data, config, withTree({ childrenAccessor }))` works
    end-to-end.
21. C1 — `mapNodes` reaches through group nodes: composing
    `withGrouping(schema)` **then** `withTree({ childrenAccessor })`,
    a data row nested under a group header still gets its own children
    nested beneath it.

## Implementation Notes

- **Case 4 is the behavior change to get right.** Today's
  `expandAll(ids)` replaces the set with `union(discovered, ids)`.
  `expand(ids)` adds to the current set and runs no discovery walk.
  Write the assertion so a regression to replace-semantics fails:
  open `r1` by toggle, then `expand(['c1'])`, then assert `tree()`
  holds **both**.
- **Case 8's shape comes from E18, not from this issue's body.** The
  issue text predates the decision; `changed` is
  `Observable<ExpansionChange>` and fires once per write. Collect
  emissions into an array and assert on `length` as well as payload —
  the cardinality is the part E18 changed.
- **Case 21's argument order is load-bearing.** `withGrouping()` must
  precede `withTree()` for the group stage to have produced headers
  the tree stage then descends through. Render order is fixed
  (`RENDER_ORDER = ['group', 'tree']`) regardless, but the
  compile-time-legal order is the one to write.
- Reuse the assertion style of the cases being inherited — read
  `store.renderRows()` and `store.tree()`, never an internal signal,
  and never "a particular stage ran".

## Risks / Watchouts

- Do not delete or edit anything in `with-expansion.spec.ts`. It keeps
  its tree cases until #121 narrows the panel; two green copies for
  the length of this epic is the intended state.
- `makeRows()` must stay a factory, not a module constant — several
  cases mutate `data` and would leak into their neighbours.
- `destroy()` in case 10 goes through the table's own teardown
  (`TestBed.resetTestingModule()` / the injector's destroy hook), the
  same way `with-expansion.spec.ts` does it — not by calling the
  store's internal `destroy`.

## Non-Goals

- Collapse-only, `state()` and the ADR-0014 degrade paths — Step 3.
- The `describe('types')` block — Step 3.
- No change to `with-grouping/feature.spec.ts`. Moving its ~15
  collapse cases here is #120's, not this step's.

## Acceptance Checks

- [ ] All new spec cases pass.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `with-expansion.spec.ts` still passes, untouched.

---
← [Step 1: `withTree()`, the stage and `state()`](step-1-with-tree-feature.plan.md) | [Step 3: Collapse-only, `state()` and the degrade path](step-3-new-surface-spec.plan.md) →
