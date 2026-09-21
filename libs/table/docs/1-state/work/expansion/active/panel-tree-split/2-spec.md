---
title: Spec — split withExpansion() into a detail-panel feature and withTree()
type: spec
capability: expansion
ticket: "101"
date: 2026-09-20
audience: developers
---

# Spec — panel/tree split (#101, ADR-0012)

Source: [`1-decisions.md`](1-decisions.md) (grilled 2026-09-20, D1–D12) ·
capability log [`docs/decisions/expansion.md`](../../../../decisions/expansion.md) (E5–E16) ·
contract [ADR-0012](../../../../adr/0012-split-expansion-into-panel-and-tree.md) ·
architecture (types, paths, call-site checklist): [`3-architecture.md`](3-architecture.md).

Written against source as of #107/#108 — the tree-shaped render IR and the uniform
`isExpanded` stamping have already landed, so this issue *moves* an already-nesting stage
rather than rewriting one (#105 F1).

## Problem Statement

One exported feature, `withExpansion()`, serves two things a person does with a table that
happen to share one word in the UI. The ADR's test separates them: **does the expanded
content have the same columns as its parent?** Yes → it is a row (tree). No → it is markup
(a detail panel).

What a consumer hits today:

1. **A panel-only table pays for a tree it never uses.** Getting open/closed id tracking
   means composing the feature that claims the `'tree'` render stage and ships a recursive
   children walk. The stage is single-claim, so the cost is not only bundle size.
2. **Collapsible group headers arrive through the wrong door.** A consumer who wants
   collapsible grouping composes the *detail-panel-named* feature, then discovers its
   `expandAll()` cannot reach a group header at all — auto-discovery walks
   `childrenAccessor`, and a header is not a row. The documented spelling is
   `expandAll(table.groupIds())`, a workaround the API shape forces.
3. **Composing panel and tree on one table is impossible, twice over.** Both want
   `expandedRows` / `toggleExpanded` / `rowExpanded`, so `claimMember()` throws. And even
   with distinct keys the engine unions every contributed open-id set before the flatten
   walk reads it — so opening a *panel* on row X would reveal X's *tree children*. ADR-0012
   claimed separate store instances prevented this; they do not.
4. **Three verb names over two operations, and the one write nobody has.**
   `toggleExpanded` / `expandAll` / `collapseAll`, where `expandAll(ids)` and `collapseAll()`
   are both "replace the set" in disguise — while restoring persisted state, the case that
   actually needs one atomic replace, has no verb at all.
5. **`childrenAccessor` defaults to `row.children`.** That default is the only thing that
   admits nested data, and a nested child is never an entry in `data()` — so it resolves no
   `sourceIndex`, its field tree comes back `null`, and an edit to it silently no-ops (G6).
6. **The spec contradicts the source in two places.** `everExpanded` is documented as
   "specced, not yet implemented" while it ships, and the docs still describe an
   engine-owned `'prune'` render stage that no longer exists.

For a feature author the summary is shorter: the feature contract has an accumulating
open-id slot whose only real contributor is a render stage, and a member namespace flat
enough that two related features cannot coexist.

## Solution

Split the feature along the ADR's test, and settle the three things the ADR got wrong.

- **`withExpansion()` becomes the detail-panel feature.** Open/closed id tracking,
  `everExpanded`, `initial`, `onRowsRemoved` pruning. No `childrenAccessor`, no
  render stage — and, new in this spec, **no contribution to the render union**. Panel
  markup is gated on the slice directly; a panel never changes which rows render.
- **`withTree()` is new** and owns rows: an optional `childrenAccessor`, `isExpandable`, the
  `'tree'` render stage *when an accessor is supplied*, the tri-state `state()`, and the
  only contribution to the render union. Omitting the accessor gives a collapse-only
  instance — the shape a collapsible-grouping consumer composes.
- **`createExpansionStore()`** holds the open-id machinery both features share. A factory,
  not a feature; each feature builds its own instance, exactly as `withRowEdit()` and
  `withOptimistic()` each build their own editing store.
- **Both features ship as ADR-0015 slices** — `table.expansion` and `table.tree`. One claimed
  member key each, so composing both cannot collide, and the two id sets stay separable by
  name.
- **The verb set merges into one primitive with named sugar**: `toggle(id)`, `expand(ids?)`,
  `collapse(ids?)`, `set(ids)`, with an omitted `ids` meaning "all". `expandAll` and
  `collapseAll` disappear as names while keeping their behavior.
- **`withGrouping()` stays static.** It owns no open-id state and exposes no collapse verb;
  collapsible headers come from composing `withTree()`, the feature that owns descendant
  visibility.

Public contract direction is unchanged: flat `data` in, flat `RenderRow<TRow>[]` out.

## User Stories

**Detail panels**

1. As an app developer rendering master/detail rows, I want a feature that tracks which rows
   are open and nothing else, so that my table does not ship a recursive children walk I
   never invoke.
2. As an app developer, I want to open any number of detail panels at once, so that a person
   can compare two records side by side without one closing the other.
3. As an app developer, I want to know which rows have *ever* been opened, so that I can
   mount a panel lazily and keep it mounted, making its collapse a class flip instead of a
   teardown.
4. As an app developer, I want opening a detail panel to leave the rendered row set
   completely alone, so that a panel cannot accidentally reveal rows.
5. As an app developer, I want a row's id to leave the open set when that row leaves the
   data, so that deleting an open record does not resurrect its panel when an id is reused.
6. As an app developer, I want `everExpanded` to survive that pruning, so that my lazy-mount
   gate keeps its memory of what a person already opened.
7. As an app developer restoring a saved view, I want to seed the open set at construction,
   so that a person returns to the panels they left open without a flash of everything
   closed.
8. As an app developer, I want a restore write to emit no interaction event, so that a
   subscriber listening for "the person opened a row" is not fooled by my own restore.
9. As an app developer, I want the panel feature to compose with grouping, sorting, filtering
   and selection without argument-order rules, so that adding panels to an existing table is
   a one-line change.

**Row trees**

10. As an app developer with hierarchical records, I want to declare how to read a row's
    children, so that expanding a parent reveals its children as real rows with the same
    columns.
11. As an app developer, I want my tree to be built from a flat array of real rows, so that
    every node the table renders can be sorted, filtered and edited like any other row.
12. As an app developer, I want a nested child to resolve its position in my data, so that an
    edit to a row at depth 2 writes through exactly as one at depth 0 does.
13. As an app developer with lazily fetched children, I want to declare a row expandable
    before its children exist, so that the chevron renders and my fetch has something to hang
    off.
14. As an app developer, I want a tri-state "all / some / none expanded" signal, so that a
    toolbar expand-all control renders correctly without me re-walking the tree.
15. As an app developer, I want one call to expand everything expandable, so that a person
    can open the whole outline without me discovering ids myself.
16. As an app developer, I want a row's children hidden the moment it collapses, at any
    depth, so that the outline a person navigates matches what they clicked.
17. As an app developer whose children accessor throws on one bad record, I want that row to
    render without a chevron rather than the table blanking, so that one malformed record
    does not cost me the screen.
18. As an app developer, I want that failure reported once per evaluation — in production as
    well as development — so that I learn about it from a real user's session, not only from
    a fixture that happens to contain the bad case.

**Collapsible grouping**

19. As an app developer grouping rows, I want grouping alone to render every group open and
    expose no collapse verb, so that a static grouped report needs no expansion state.
20. As an app developer who wants collapsible group headers, I want to add one feature to the
    composition, so that the capability is visible in the feature list rather than implied by
    a config object.
21. As an app developer, I want "collapse every group" to be one call with no arguments, so
    that I no longer pass `table.groupIds()` to reach headers a discovery walk cannot see.
22. As an app developer, I want collapsing a group header to hide its members at any nesting
    depth, so that a multi-level grouping behaves like the outline it looks like.

**Composing both**

23. As an app developer, I want to compose detail panels and a row tree on one table, so that
    a person can open a panel on a parent row and expand its children independently.
24. As an app developer, I want those two states kept apart by name, so that reading "is this
    row's panel open" never answers "are this row's children showing".
25. As an app developer, I want composing both to construct without throwing, so that the
    combination is a supported shape rather than a collision I discover at runtime.

**The API surface**

26. As an app developer, I want one namespace per feature on the store, so that a store's
    surface tells me which feature put each member there.
27. As an app developer, I want reading "what is open" to be a call on that namespace, so
    that the common read is the shortest thing to write.
28. As an app developer, I want expand and collapse to accept ids or nothing, so that the
    one-row case and the everything case are the same verb.
29. As an app developer restoring persisted state, I want a single atomic replace, so that a
    restore is one emission pass rather than a collapse followed by an expand.
30. As an app developer, I want every write verb to take the same silent-write option, so
    that suppressing events does not depend on which verb I happened to call.

**Migration and docs**

31. As an existing consumer of `withExpansion()`'s tree behavior, I want the breaking change
    to arrive once, with a named replacement feature, so that I migrate in one pass instead
    of absorbing a rename now and a namespacing later.
32. As a reader of the feature docs, I want one document per feature, so that "which of these
    two things am I reading about" is answered by the filename.
33. As a maintainer, I want the docs to stop describing `everExpanded` as unimplemented and
    stop describing a `'prune'` render stage that no longer exists, so that nobody plans work
    against a spec that contradicts the source.
34. As a maintainer, I want ADR-0012 corrected where the grill reversed it, and then accepted,
    so that the ADR set records what was actually built.

**Feature authors**

35. As a feature author, I want the shared open-id machinery behind a factory, so that a new
    feature needing open ids does not copy a signal, a subject and a prune hook.
36. As a feature author, I want each feature to own its own store instance, so that
    composition never depends on the order features appear in the array.
37. As a feature author, I want exactly one feature contributing to the render union, so that
    "why is this row visible" has one answer.

## Implementation Decisions

### Modules

| Module | Change |
|---|---|
| `createExpansionStore()` | **new** — the shared open-id state; a factory, not a feature |
| `withExpansion()` | narrowed to the panel: keeps the name, loses the accessor, the stage and the union contribution |
| `withTree()` | **new** — row tree and collapse |
| `withGrouping()` | unchanged structurally; its JSDoc and doc references to `expandAll(table.groupIds())` re-point at `withTree()` |
| engine feature contract | unchanged — `TableFeatureSpec.expandedRows` stays accumulating; this issue changes who contributes |
| public barrel | `withTree` and its config type added; `WithExpansionConfig` loses two fields |

### The shared store — `createExpansionStore()`

A factory following the editing precedent: each feature calls it, neither reads the other's
signal, composition is order-independent. It owns:

- the open-id set and its read-only projection,
- the change `Subject` and its completion,
- the single internal write, `setExpanded(ids, options?)` — the only writer of the signal,
- `initial` seeding, read once, emitting nothing,
- `onRowsRemoved` pruning through `pruneByIds()`.

It stops there. `everExpanded` is **not** in it (D3/E7) — a collapsed panel staying mounted
is a panel concern; a collapsed tree child is meant to be destroyed, so the member would
carry no tree meaning.

The store exposes the primitive; each feature builds the public verb set on top of it.

### The public surface

Two slices, one claimed member key each:

```ts
table.expansion()                 // ReadonlySet<RowId> — open panels
table.expansion.everExpanded()    // ReadonlySet<RowId> — additive, never pruned
table.expansion.changed           // Observable<ExpansionChange> — { added, removed }, once per write (E18)
table.expansion.toggle(id, opts?)
table.expansion.expand(ids?, opts?)     // omitted ids = every row in rows()
table.expansion.collapse(ids?, opts?)   // omitted ids = all currently open
table.expansion.set(ids, opts?)         // atomic replace — the restore path

table.tree()                      // ReadonlySet<RowId> — expanded parents
table.tree.changed                // Observable<ExpansionChange> — same shape as table.expansion.changed
table.tree.toggle/expand/collapse/set
table.tree.state()                // 'all' | 'some' | 'none'
```

A slice is a callable carrying properties — the shape `value`, `columns`, `grouping` and
`editing` already ship. The call returns the feature's primary state and never a composite
object (ADR-0015's primary-signal rule).

`expand()` with no ids means every row in `rows()` on the panel, and the `childrenAccessor`
discovery walk on the tree — one name, each feature's own domain behind it. Write options
(`{ emitEvent: false }`) are accepted by every verb on both slices.

### `withExpansion()` — the detail panel

Configuration shrinks to persistence:

```ts
interface WithExpansionConfig {
  initial?: readonly RowId[];
}
```

`childrenAccessor` and `isExpandable` are gone. It declares no render stage and — the
correction to ADR-0012 — **does not declare `expandedRows` on its feature spec at all**, so
it contributes nothing to the union the flatten walk reads. Panel markup reads
`table.expansion()` / `table.expansion.everExpanded()`.

`initial` seeds `everExpanded` as well as the open set here: a restored-open row has
been opened, and its panel should mount at once.

### `withTree()` — the row tree

```ts
interface WithTreeConfig<TRow> {
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  isExpandable?: (row: TRow) => boolean;
  initial?: readonly RowId[];
}
```

- **Real-row parents only.** Every node of the tree is an entry in the flat `data()` array.
  There is no `getDataPath`, no `row.children` fallback, and no levels API — a declared-axis
  hierarchy with invented parents *is* `withGrouping()`'s mechanism (D1/D11, E5/E15).
- **The accessor is optional.** Omitted means collapse-only: no row tree, and the `'tree'`
  render stage is **not claimed**, so a future stage claimant is not blocked for nothing
  (D9/E13). Supplied means the stage is claimed and children nest beneath their parent.
- **`isExpandable`** defaults to "the accessor returned a non-empty array" and exists for
  lazy children, where the accessor honestly returns `undefined` but the chevron must render
  so a fetch can be triggered.
- **`state()`** answers "are all expandable rows open?" — it needs the discovery walk, which
  only this feature has. The panel equivalent is one line at the call site
  (`expansion().size === rows().length`), so the panel ships no member for it (D5/E9).
- **The only render-union contributor.** With the panel out, exactly one set feeds the
  flatten walk, and the union collision the ADR mis-described cannot arise.

Because `withGrouping()` runs first in render order and this stage descends through group
nodes, a collapse-only instance still hides a group header's members: headers derive
`hasChildren` from their own children in the flatten walk, and the walk stops descending at
any id missing from the contributed set.

### Grouping

`withGrouping()` renders a static grouping UI and owns no open-id state. Composed alone,
nothing contributes a set, the walk's `expanded` stays `undefined`, and every group renders
open with `isExpanded` unstamped — today's behavior for an expansion-free table, unchanged.

Collapsible grouping is `createTable(config, withGrouping(schema), withTree())`, and the
toolbar spelling becomes `table.tree.collapse()` / `table.tree.expand(table.groupIds())`.
`groupIds()` keeps its reason to exist: expanding *only* headers is still a legitimate ask,
and the discovery walk cannot reach one.

### Error policy

A throwing `childrenAccessor` is a consumer callback invoked per node inside a `computed()` —
a runtime, data-dependent failure, so per ADR-0014 it degrades rather than throws. The row
renders without a chevron (visibly wrong beats hidden rows), and the failure is reported once
per evaluation, not once per row, matching how aggregate and accessor failures already
dedupe. Reported in production too, not dev-only (D12/E16).

### Breaking changes

| Today | After |
|---|---|
| `withExpansion({ childrenAccessor, isExpandable })` | `withTree({ childrenAccessor, isExpandable })` |
| `table.expandedRows()` | `table.expansion()` or `table.tree()` — whichever the consumer meant |
| `table.toggleExpanded(id)` | `table.expansion.toggle(id)` / `table.tree.toggle(id)` |
| `table.expandAll()` | `table.tree.expand()` |
| `table.expandAll(ids)` | `table.tree.expand(ids)` |
| `table.collapseAll()` | `table.tree.collapse()` / `table.expansion.collapse()` |
| `table.everExpanded()` | `table.expansion.everExpanded()` |
| `table.rowExpanded` (per-id) | `table.expansion.changed` / `table.tree.changed` (`{ added, removed }`, once per write, E18) |
| `withGrouping()` + `withExpansion()` for collapse | `withGrouping()` + `withTree()` |

No in-repo consumer composes the tree path; the one in-repo consumer is the collapsible
grouping story, which is a collapse-only case. Everything above is a public export, so the
change is breaking on paper and must be released as such — once, rather than twice, which is
why the two features arrive already sliced ahead of #50 (D6/E10).

### Docs and ADRs

- **ADR-0012** — Decision 2 drops `depth` (engine-owned since ADR-0023); Decision 5 reverses
  (grouping composes `withTree()`, not the panel); Decision 6 is superseded (G6 is impossible
  under the real-row contract, and `sourceIndex` is no longer stamped by a stage); the
  alternatives table's "separate instances prevent collision" claim is corrected to name the
  union; the verification plan swaps `[withExpansion(), withGrouping()]` for
  `[withGrouping(), withTree()]`. Then `proposed` → `accepted`.
- **ADR-0015** — its slice table lists one `expansion` slice; the split makes it two
  (`expansion`, `tree`), arriving ahead of #50.
- **`1-state/features/expansion.md`** splits into two specs, and drops three stale claims on
  the way: `everExpanded` "not yet implemented", the `code: partial` axis that rested on it,
  and the engine-owned `'prune'` render stage.
- **`1-state/features/grouping.md`** — the delegation note points at `withTree()`, and
  grouping alone renders every group open.
- **`1-state/prd.md`** user stories 10, 23 and 31 carry the superseded "`withGrouping()`
  requires `withExpansion()` at compile time" framing — corrected in the same pass.
- **`docs/decisions/expansion.md`** — E5–E18 move from `accepted, not built` to `shipped` as
  their slices land.

## Testing Decisions

A good test here asserts what a consumer can observe from a composed table: what
`renderRows()` contains, what a slice reads, what `changed` emits. It does not assert which
internal signal was written, nor that a particular stage ran. Every seam is reached through
`createTable(...)` in an Angular injection context — the highest seam available, and the one
today's expansion spec already uses.

**Seams** — checked with the maintainer before writing:

- **`with-expansion.spec.ts` (existing, narrowed)** — the panel. Keeps the open-id state,
  event, silent-write and prune cases; loses every tree case. Gains: `initial` seeds
  both sets; the feature claims no render stage (`renderRows()` is 1:1 with `rows()`, every
  row at depth 0, `isExpanded` unstamped); and — the ADR correction — composed with
  `withTree()`, opening a panel on a row does **not** reveal that row's children.
- **`with-tree.spec.ts` (new)** — the tree. Inherits today's tree assertions unchanged
  (`r1 → c1 → g1`, depth 1 and 2) with the accessor now passed explicitly; adds the
  collapse-only shape (no accessor → no `'tree'` stage claimed), `state()`'s three values,
  the degrading accessor and its once-per-evaluation report, and the
  `[withGrouping(), withTree()]` composition — including the migrated collapse cases below.
- **`with-grouping/feature.spec.ts` (existing, decoupled)** — keeps what breaks when
  *grouping* changes: clusters, headers, aggregates, `groupIds()`, and "composed alone, every
  group renders open and no collapse verb exists". The ~15 cases whose subject is "a
  collapsed id hides its descendants" move to `with-tree.spec.ts`, which owns descendant
  visibility. A spec asserts its own domain.
- **`createExpansionStore()` gets no spec of its own** — it is exercised through both
  features, exactly as `editing/state.ts` is today. A third seam for a factory with no
  independent consumer would buy nothing.
- **Type-level cases** stay where they are: each feature's spec carries its own
  `expectTypeOf` block (member recovery, the derive-first form, a trailing `withComputed`
  reading that feature's members), verified by the project typecheck rather than at runtime.

Prior art for all of the above is the current `with-expansion.spec.ts`: `inContext()` +
`createTable(signal(rows), config, feature)`, assertions over `store.<member>()` and
`store.renderRows()`, plus a `describe('types')` block.

**Regressions that must stay green**: ADR-0006 pruning on both features (with `everExpanded`
exempt), `engine/core.spec.ts`'s union behavior (two contributed sets still union — the
engine contract is unchanged, it simply has one library contributor now), and
`engine/flatten.spec.ts`'s zero-contributor vs. empty-set distinction.

## Out of Scope

- **#50's slicing of the other four features.** Only `withExpansion()` and `withTree()` move
  onto slices here; sorting, selection, filtering and grouping keep their flat members.
- **ADR-0015's `withComputed()` placement rule.** A nested derive block still lands flat in
  this issue; moving derive output onto a feature's slice is #50's.
- **Lazy child fetching.** `isExpandable` exists so a consumer can build it; the library
  fetches nothing.
- **A tree built from paths** (`getDataPath`, invented parents). Filed against grouping as a
  variable-depth level source if a consumer ever needs it, never against `withTree()`.
- **Cycle guarding on `childrenAccessor`.** A row that reaches itself still overflows; noted
  on #105 and unchanged here.
- **An LRU cap on `everExpanded`.** Still deliberately not in v1.
- **Persistence itself.** `set(ids)` is the restore verb; producing and validating the
  snapshot stays consumer-owned.
- **Any change to the engine feature contract.** `TableFeatureSpec.expandedRows` keeps
  accumulating; this issue changes who contributes, not the slot.

## Further Notes

**Sequencing.** #105's children are closed, so the tree IR is in place and the `'tree'` stage
already nests rather than flattens — the stage moves to `withTree()` as a code move. This
issue lands **before** #50, which then slices four settled features once instead of tearing a
freshly split one in half.

**G6 is closed as impossible, not fixed.** `indexById` is built from `data()`, and under the
real-row contract every tree node is an entry there — so a nested child at any depth resolves
a `sourceIndex` and edits write through by construction. ADR-0012's Decision 6 assumed the
fix belonged to the `'tree'` render stage, which is not where `sourceIndex` is stamped
anyway.

**Why the panel leaves the union.** It is the whole reason the two features can be composed
at all. Keeping the panel in the union would mean an open panel silently changes which rows
render — the exact class of bug ADR-0012 believed it had designed away.
