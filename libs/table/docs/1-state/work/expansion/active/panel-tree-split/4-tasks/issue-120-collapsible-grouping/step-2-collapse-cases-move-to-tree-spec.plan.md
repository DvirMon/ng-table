# Step 2 — The collapse cases move to the tree's spec

**PR scope:** ships alone. **Parallel-safe with: Step 1, Step 3** — no
step reads another's artifact.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-tree.spec.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.spec.ts` (edit)

## Why This Step Exists

**A spec asserts its own domain.** `with-grouping/feature.spec.ts`
should hold what breaks when _grouping_ changes. It currently holds
~15 cases whose subject is "a collapsed id hides its descendants" —
which is descendant visibility, owned by whatever feature contributes
the expanded set, never by the clustering. They only lived there
because `withExpansion()` was the only way to produce a collapsed
group, so the coupling read as inevitable.

It is not. Reading `feature.spec.ts` should tell you which domain it
belongs to (`.claude/rules/spec-files-assert-own-domain-only.md`), and
today it tells you two. Moving these cases is the half of this issue
that outlives the rename: it cuts a seam that would otherwise survive
every future refactor.

Seam and prior art: [`2-spec.md`](../../2-spec.md) §"Testing
Decisions". Every case is reached through `createTable(...)` in an
Angular injection context — the highest seam available.

## What To Do

Both halves land together. Neither file is ever in a half-migrated
state, and the reviewer sees the ownership cut as one diff.

### 1. Harness work in `with-tree.spec.ts`

Verify each against the real file before writing — line numbers below
are as of this plan.

**Widen `makeGroupingColumns()`** (line ~60). It declares only
`region`; the migrated cases need `category` for two-level nesting and
for `US_ELECTRONICS_HEADER_ID`-style ids. Keep the shape that leaves
column ids a **literal union** — `id: '…' as const` per entry, no
return-type annotation. See the comment at `feature.spec.ts:41-46`: an
annotated `ColumnDef<GroupingMockRow>[]` return type widens every id
to `string`, which turns every `path.<id>` access into an
index-signature access (TS4111).

**Bring over**, from `feature.spec.ts`, only what the migrated cases
actually use:

- `findHeader()` — lines 738-743.
- `toShape()` — lines 94-98 (needed by the either-order pair).
- the header-id constants — `US_HEADER_ID`,
  `US_ELECTRONICS_HEADER_ID`, `EU_ELECTRONICS_HEADER_ID` (745-747) and
  `EU_HEADER_ID`, `US_FURNITURE_HEADER_ID`, `EU_FURNITURE_HEADER_ID`
  (904-906).

Copy, do not delete the originals — `feature.spec.ts` still uses all
of them.

`mockGroupingRows` / `mockGroupingTrackBy` / `GroupingMockRow` are
already imported in `with-tree.spec.ts` (line 5). `withGrouping` is
already imported (line 10).

**Placement.** The migrated cases go in one new `describe` inside
`describe('withTree')`, named for the composition — e.g.
`composed with withGrouping()`. It sits **beside**, not inside, the
existing `collapse-only (D9/E13)` block.

**Watch for overlap rather than duplicating it.** Two cases already in
the file cover neighbouring ground:

- `collapse-only (D9/E13)`'s case at ~616-638 already asserts the
  basic hide-then-reveal over a single `region` level.
- C1 at ~528 already asserts that `mapNodes` reaches through group
  nodes to nest a data row's own children.

Where a migrated case would restate either, fold the migrated case's
distinct assertion into the existing one instead of adding a near-copy.

### 2. Cases that move

Every composition below is `[withGrouping({ initial: … }), withTree()]`
— **collapse-only, no accessor**, because none of these fixtures nests
data rows. `store.expandedRows()` reads become `store.tree()`;
`toggleExpanded(id)` becomes `tree.toggle(id)`; `collapseAll()`
becomes `tree.collapse()`.

**From `describe('groupIds')`** (feature.spec.ts 964-1000):

1. "collapse-independent: collapsing a group does not remove its id" —
   `groupIds()` returns all six headers before anything is toggled and
   the same six after a toggle plus a `tree.collapse()`.
   **The premise flips and the comment must be rewritten.** The
   current comment says "withExpansion() starts every group collapsed
   by default"; under collapse-only `withTree()` the contributed set is
   simply _empty_, which renders identically. The assertion is
   unchanged — `groupIds()` derives from the cluster tree, not from
   `renderRows()`.

**The whole of `describe('collapse/expand (#25)')`**
(feature.spec.ts 1207-1487) **except** the three cases listed in §3:

2. Nothing toggled: every group renders collapsed — only the two
   depth-0 headers render, no category headers, no leaves.
3. `tree.toggle(headerId)` reveals that header's descendants; the
   sibling header stays collapsed.
4. Two-level grouping, expand outer only: the outer header's own child
   headers appear, their leaves stay hidden until individually
   toggled, and the untouched sibling shows not even its child
   headers.
5. Argument order does not affect collapse behaviour — grouping-first
   and tree-first produce identical `[kind, depth, id]` shapes after
   the same toggle.
6. A collapsed group nested inside a collapsed group stays hidden when
   only the outer one opens — the transitive hidden-accumulator case
   (ADR-0017 decision 8). **This is the multiple-nesting-depth case
   the issue's AC names explicitly; do not drop it.**
7. - 8. The `either order (D25)` pair — tree composed first, and
        grouping composed first, each asserting the same `toShape()` output
        before and after toggling US.

**`describe('collapse state across a sort')`** (2426-2470), both
cases:

9. A sort change leaves the open set untouched.
10. An expanded group is still expanded, and a collapsed sibling still
    collapsed, after the sort.

The `setup()` helper's return type drops `ExpansionMembers` for
`TreeMembers` and keeps `SortingMembers`; composition becomes
`withGrouping(...), withTree(), withSorting()`.

**`describe('collapse state across a row replacement')`**
(2561-2585):

11. Replacing every row object with an equal-id copy leaves the open
    set untouched and the toggled header still present.

That is ~15 `it()` cases once the `either order` block's two are
counted individually.

### 3. Cases that stay in `feature.spec.ts`

**1208-1220 — "no expansion feature composed"**, retitled to name no
expansion feature at all (not `withExpansion()`). **Extend it** to
carry the acceptance criterion in full: composed **alone**,

- every cluster renders flat and fully expanded (the existing
  assertion: 2 group rows, 6 data rows);
- no collapse verb exists on the store — assert `'tree' in store` and
  `'expansion' in store` are both `false`;
- `isExpanded` is **unstamped** — `undefined` on every render row.

**1315-1334 — "never throws or warns"**, retitled away from
`withExpansion()`: composing `withGrouping()` on its own throws and
warns nothing, at construction or on `renderRows()`. The spies stay.

**1336-1355 — `rowsOf()` on a collapsed group.** A judgement call, so
make it explicitly: its subject is `rowsOf()`'s collapse-independence
— grouping's own API, and the D17 regression it guards is grouping's —
so it **stays**. But it needs a collapsed state to be about anything,
so it composes `withTree()` to produce one. **Move it up into the
`rowsOf` describe block** (which ends at line 902), where its subject
says it belongs, rather than leaving it stranded in a
`collapse/expand` block that no longer exists.

**Everything else stays untouched:** `rowsOf`'s other six cases,
`groupIds`'s other three, `groupingLevels`, `isGroupedBy`, the
composition-order block, aggregates, `when`, the schema/sugar blocks,
pipeline order, `writes target rows; clustering re-derives`, and
`describe('types')`.

### 4. The type-level case (AC #7)

`feature.spec.ts` 1444-1485 asserts that a member is visible to a
trailing derive only when its feature is composed first (D25 — types
are stricter than runtime). Re-express it against `tree`:

- **Tree first:** `withTree(), withGrouping({ initial }, withComputed((s) => { expectTypeOf(s.tree).toEqualTypeOf<TreeSlice>(); return {}; }))`
  — compiles.
- **Grouping first:** the same read inside grouping's trailing block,
  with `withTree()` composed after, is a `@ts-expect-error`.

Keep the explanatory comment block, updated: the runtime store would
have the member either way (any deferred read off the shared object
sees it); the restriction is type-level only. `withGrouping()` itself
performs no such read at all since #99 — `engine/flatten.ts`'s
`flattenVisible` walk governs collapse/expand visibility regardless of
argument order (ADR-0017, ADR-0023).

`TreeSlice` is already exported from `with-tree.ts` and already
imported by `with-tree.spec.ts`; `feature.spec.ts` needs the import
added.

### 5. Import cleanup in `feature.spec.ts`

Line 29's `import { withExpansion, type ExpansionMembers } from '../with-expansion';`
becomes dead once §2 and §4 land — delete it.

Line 32's `import { withSorting, type SortingMembers } from '../with-sorting';`
is a split case, already settled — do not re-derive it. The **value**
`withSorting` keeps nine other call sites (222, 399, 774, 1176-1196,
1497-1505, 2216) and stays. The **type** `SortingMembers` has exactly
one user, the `setup()` return type at 2433, which is moving — so drop
it from the import and add it to `with-tree.spec.ts`'s own import of
`./with-sorting`.

## Implementation Notes

- **Collapse-only is the right composition for every migrated case.**
  The grouping fixtures (`mockGroupingRows`) have no nested rows, so
  supplying a `childrenAccessor` would claim the `'tree'` render stage
  for no reason and put a second mechanism inside assertions that are
  about group headers. Bare `withTree()` contributes the set without
  claiming the stage — which is exactly what makes the header hiding
  work (`withGrouping()` runs first in render order; the flatten walk
  stops descending at any id missing from the contributed set).
- **Case 1's comment is the trap.** Its assertion passes either way,
  so a copy-paste that keeps "starts every group collapsed by default"
  leaves a false statement in the file that the next reader will
  reason from.
- **Case 6 is the nesting-depth case.** If the implementer trims the
  migration for size, this is the one that looks redundant next to
  case 4 and is not — case 4 asserts one level of reveal, case 6
  asserts that the reveal does **not** cascade transitively.
- **The `rowsOf` collapsed-group case changes composition, not
  subject.** Its two assertions (a header captured while collapsed,
  and one captured after an expand/collapse round trip) both stay;
  only the verbs that produce the collapsed state change.
- Read `store.renderRows()` and `store.tree()`, never an internal
  signal, and never "a particular stage ran" — the seam discipline the
  rest of both files already follows.

## Risks / Watchouts

- **Do not touch `with-expansion.spec.ts`.** It keeps its own cases
  until #121 narrows the panel. Two green copies of the tree behavior
  for the length of this epic is the intended state.
- **`nx test` proves nothing about §4.** The vitest executor runs
  `expectTypeOf` / `@ts-expect-error` without checking them —
  `typecheck-spec` is the only thing that enforces a type-level case,
  and a `@ts-expect-error` guarding an error that no longer occurs
  fails there and only there.
- **Do not widen `makeGroupingColumns()` with a return-type
  annotation.** TS4111 on every `path.<id>` is the failure mode, and
  it surfaces in `typecheck-spec`, not in the runner.
- Check header-id constants against the widened columns before
  asserting on them — the ids encode the level path
  (`group:>region:string:US>category:string:Electronics`), so a
  mismatch between the constants and the composed `initial` levels
  produces an `undefined` header and a confusing failure.

## Non-Goals

- **The `expansion` counterpart of §4's type case is deliberately not
  written here.** It belongs to [#121](https://github.com/DvirMon/ng-table/issues/121),
  which narrows `withExpansion()` — writing it now would assert the
  panel's shape from a spec that cannot yet know it, and would make
  this issue go red on someone else's slice. This issue stays green on
  its own.
- No assertion about `withExpansion()`'s members or its stage claim in
  either file. Another domain.
- `engine/core.spec.ts` and `engine/compose-table.spec.ts` stay as they
  are — they build their own fake contributors, so the engine's union
  contract is asserted independently of which library feature
  contributes. Their comments are Step 3's.
- No change to the story or its template — Step 1.

## Acceptance Checks

- [ ] Every migrated case passes in `with-tree.spec.ts`.
- [ ] `with-grouping/feature.spec.ts` still passes, with the three
      retained cases retitled and the composed-alone case extended.
- [ ] `nx run shared-table:typecheck-spec` clean — the only thing that
      enforces §4.
- [ ] No `withExpansion` import and no `withExpansion(` call left in
      `with-grouping/feature.spec.ts`.
- [ ] `feature.spec.ts` contains no case whose subject is descendant
      visibility; `with-tree.spec.ts` contains no case whose subject is
      clustering.

---

← [Step 1: The collapsible grouping story composes `withTree()`](step-1-collapsible-story-composes-with-tree.plan.md) | [Step 3: The documented spelling](step-3-documented-spelling.plan.md) →
