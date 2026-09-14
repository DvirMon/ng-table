---
title: Spec — one callable slice per feature, keyed by state concern
type: spec
capability: composition
spec: drilled
code: none
status: ready for issues
date: 2026-09-13
audience: developers
---

# One callable slice per feature, keyed by state concern

Grounded in [ADR-0015](../../../adr/0015-feature-member-namespacing.md) (accepted 2026-09-13) and
[`research-callable-slice-shape.md`](research-callable-slice-shape.md). No grill stage ran: the
ADR is the decision record, and every decision below is either lifted from it or a corollary
grounded against the shipped source and marked as such.

## Problem Statement

A composed table exposes every feature's members on one flat object. That reads correctly for
state — `table.sorting()`, `table.grouping()` — and misreads for behavior functions that take an
argument and belong to one feature's domain. `table.rowsOf(group)` reads as a core capability of
every table. It is meaningless unless grouping is composed. `table.selectionStateOf(ids)` and
`table.toggleSort(id)` already ship as exactly this: a verb whose precondition is invisible at the
call site, and whose name has to carry its feature as a prefix or suffix because the receiver does
not.

The flat surface also has no rule for where a consumer-declared derived value lands. A
`withComputed()` block nested inside `withSelection()` can only see selection's members, so it is
selection's knowledge, yet it lands flat beside library-owned members and competes with them for
the same keys.

Four of the eight shipped state concerns already use a callable slice (`value`, `columns`,
`grouping`, `editing`), because D30 put the write path there. Three (`sorting`, `selection`,
`expansion`) are flat. The library ships two conventions and a consumer cannot tell which one a
member follows without reading the feature.

## Solution

Every feature exposes exactly one member on the store: a **slice**, keyed by the **state concern**
it owns, not by the feature's name. Calling the slice returns the concern's primary state. Every
other signal, stream and verb the feature owns is a property on the slice.

```ts
table.sorting()               // SortRule[]                          — primary state
table.sorting.directions()    // ReadonlyMap<ColumnId, SortDirection> — its own signal
table.sorting.changed         // Observable<SortRule[]>
table.sorting.toggle(id)      // behavior; the receiver states the precondition

table.selection()             // ReadonlySet<RowId>
table.selection.stateOf(ids)  // 'none' | 'some' | 'all'
table.grouping.rowsOf(group)  // readonly TRow[]
table.editing.pending()       // ReadonlySet<RowId>
```

`table.editing()` and `table.editing.update(...)`, `table.grouping()` and
`table.grouping.update(...)`, `table.value`, `table.columns` are unchanged: this is the shape they
already have. Nothing is grandfathered — the three flat features migrate in full, and the flat
namespace becomes the consumer's own: after migration a bare `table.hiddenSelected()` can only be
something this team declared.

A derived block's placement follows its declaration site. Nested inside a feature, its members
land on that feature's slice. Declared as its own `createTable()` argument, they land flat.

```ts
createTable(data, config,
  withSelection(cfg, withComputed((store) => ({ hiddenSelected: ... }))),  // table.selection.hiddenSelected()
  withGrouping(),
  withComputed((store) => ({ groupTick: ... })),                           // table.groupTick()
);
```

## User Stories

### Reading the surface

1. As a table consumer, I want every feature to hang off one named member, so that reading
   `table.selection.stateOf(ids)` tells me which feature it requires without opening the docs.
2. As a table consumer, I want a slice's call to return its primary state, so that
   `table.selection()` is the selected set with no second name to learn.
3. As a table consumer, I want the four already-callable slices to keep their shape, so that every
   `table.editing.update(...)` and `table.grouping.update(...)` call I have compiles unchanged.
4. As a table consumer, I want secondary state signals to stay their own signals on the slice, so
   that reading `table.sorting.directions()` invalidates only when directions change.
5. As a table consumer, I want a slice call never to return a composite object, so that a template
   binding on `table.editing()` does not re-evaluate whenever an unrelated pending set changes.
6. As a table consumer, I want event streams reachable from the same slice as their state, so that
   `table.selection.changed` sits next to `table.selection()`.
7. As a table consumer, I want member names inside a slice to drop the concern word the slice
   already supplies, so that I write `sorting.toggle(id)` and not `sorting.toggleSort(id)`.
8. As a table consumer, I want slices named after the state concern rather than the feature, so
   that `table.editing` is one door whether I composed `withOptimistic()` or `withRowEdit()`.
9. As a table consumer, I want a feature that contributes no state to contribute no slice, so that
   `withFiltering()` adds nothing to the store and nothing to autocomplete.
10. As a table consumer, I want autocomplete on `table.` to list one entry per composed feature,
    so that I see what the table can do at a glance instead of thirty flat verbs.

### Writing through a slice

11. As a table consumer, I want sorting's verbs on the sorting slice, so that `sorting.toggle(id)`,
    `sorting.set(rules)` and `sorting.clear()` read as one API.
12. As a table consumer, I want selection's verbs on the selection slice, so that `toggle`,
    `select`, `deselect`, `clear`, `stateOf` and `isSelectable` are found in one place.
13. As a table consumer, I want expansion's verbs on the expansion slice, so that `toggle`,
    `expandAll` and `collapseAll` no longer need an `Expanded` suffix to disambiguate.
14. As a table consumer, I want write options (`{ emitEvent: false }`) to keep working on every
    moved verb, so that restoring persisted selection or expansion still emits nothing.
15. As a table consumer, I want `grouping.rowsOf(group)` on the grouping slice, so that the
    consumer-owned selection cascade reads as `selection.select(grouping.rowsOf(g).map(trackBy))`.
16. As a table consumer, I want editing's restore-point signals on the editing slice, so that
    `editing.pending()`, `editing.pendingOps()` and `editing.unconfirmed()` sit beside
    `editing()` and `editing.update(...)`.
17. As a table consumer, I want the gated draft signal on the editing slice, so that
    `form(table.editing.draft, schema)` names the session it belongs to.

### Declaring derived state

18. As a table consumer, I want a derive block nested in a feature to land on that feature's slice,
    so that `withSelection(cfg, withComputed(...))` produces `table.selection.hiddenSelected()`.
19. As a table consumer, I want a top-level derive block to land flat, so that a cross-feature
    derivation belongs to none of the features it reads.
20. As a table consumer, I want to move a derive block between the two positions and see its member
    move with it, so that placement is a visible choice rather than a per-member rule.
21. As a table consumer, I want two features each nesting a derive named `count` to coexist, so that
    `table.selection.count()` and `table.grouping.count()` never collide.
22. As a table consumer, I want a nested derive that reuses one of the slice's own keys to throw at
    construction naming both sides, so that `selection.toggle` is never silently replaced.
23. As a table consumer, I want the store handed to a nested derive block to expose the slice's
    read surface, so that `store.grouping.rowsOf(g)` is callable from inside the block.
24. As a table consumer, I want the derive block's store to stay write-protected, so that
    `store.editing.update` and `store.editing.draft.set` are compile errors inside a block.
25. As a table consumer, I want the composed store type to stay precise after a sliced feature with
    a nested derive, so that the next feature argument still infers my row type.

### Composition guarantees

26. As a table consumer, I want each feature to claim exactly one member key, so that two features
    owning the same concern still throw at construction as ADR-0007 promises.
27. As a table consumer, I want pipeline order, render-stage order and row-removal reconciliation
    unchanged, so that a slice is a naming change and nothing else.
28. As a table consumer, I want grouping to keep reading expansion's state lazily in either
    argument order, so that collapsible groups still work when grouping precedes expansion.
29. As a feature author, I want to build a slice with one helper, so that a third-party feature
    exposes a callable slice the same way a first-party one does.
30. As a feature author, I want to declare which member my derive block merges onto, so that a
    nested `withComputed()` lands on my slice without per-feature plumbing.
31. As a feature author, I want a feature with no declared slice to keep merging derived members
    flat, so that an existing third-party feature is not broken by this change.

### Migrating

32. As an existing consumer, I want a rename table from every flat member to its slice member, so
    that migrating is find-and-replace.
33. As an existing consumer, I want the library's stories and demo apps migrated in the same
    change, so that every example I copy from already uses the slice form.
34. As an existing consumer, I want the flat members to keep working while call sites migrate, so
    that no intermediate commit breaks the branch.
35. As an existing consumer, I want the flat members removed once no caller remains, so that the
    library ships one convention and autocomplete shows one form.
36. As a maintainer, I want the library's feature, product and directive docs to describe the slice
    form only, so that a reader never meets a member that no longer exists.
37. As a maintainer, I want ADR-0015's stale rows corrected against the shipped source, so that the
    decision record and the code agree.
38. As a maintainer, I want none of this to start before positional composition is verified green,
    so that a failure has one candidate cause, not two.

## Implementation Decisions

### The slice shape

- A **slice** is a callable carrying members: calling it returns the concern's primary state;
  properties on it are the concern's other signals, streams and verbs. It is built the same way
  Angular's `signal()` and the library's existing writable view are built — members assigned onto a
  real `computed()` — so it stays a valid `Signal` anywhere one is expected. (ADR-0015 Option 4;
  research Finding 2b.)
- The existing writable-view helper generalises into a slice helper that takes a read function
  and a members object. A writable view is then the special case whose only member is `update`.
  One mechanism, no second shape.
- **The primary-signal rule** (ADR-0015, settled 2026-09-11) decides what a call returns: the
  single value answering "what is this feature's current setting?". Every other state signal is a
  property. A slice call never returns a composite object. A concern with no obvious primary is a
  plain namespace object, not a callable.
- **Slices are named after the state concern, not the feature.** `editing` is fed by
  `withOptimistic()` and `withRowEdit()` alike, exactly as D37 requires. No `table.optimistic`,
  no `table.rowEdit`.
- **Members inside a slice drop the concern word the slice supplies.** `toggleSort` becomes
  `toggle`, `selectionStateOf` becomes `stateOf`, `sortChanged` and `selectionChanged` become
  `changed`. Names that carry no redundant concern word keep their name (`everExpanded`,
  `expandAll`, `collapseAll`, `isSelectable`, `rowsOf`, `pending`, `pendingOps`, `unconfirmed`,
  `draft`). Corollary grounded in the ADR's own examples; the complete rename table is in the
  architecture doc.
- Verb signatures are unchanged. Every moved verb keeps its parameters, its write options and its
  return type. A slice is a naming change, not a behavior change.

### Primary per concern, applied to shipped source

| Slice | Call returns | Other members |
|---|---|---|
| `value` | row data | `update` — unchanged |
| `columns` | folded column list | `update` — unchanged |
| `grouping` | active group levels | `update` — unchanged; gains `rowsOf(group)` |
| `editing` | open row ids | `update` — unchanged; gains `pending`, `pendingOps`, `unconfirmed`, and `draft` under `withRowEdit()` |
| `sorting` | sort rules | `directions`, `changed`, `toggle`, `set`, `clear` |
| `selection` | selected row ids | `changed`, `toggle`, `select`, `deselect`, `clear`, `stateOf`, `isSelectable` |
| `expansion` | expanded row ids | `everExpanded`, `changed`, `toggle`, `expandAll`, `collapseAll` |
| filtering | *(no slice)* | `withFiltering()` contributes no members today; see the correction below |

- **`draft` lands on `editing`.** It is `withRowEdit()`'s own signal, but it has no meaning without
  an edit session, and ADR-0015 says the four already-callable slices absorb their siblings.
  Corollary; the ADR does not name `draft`.
- **The ADR's filtering row is stale and is corrected here, not implemented.** ADR-0015 lists
  `columnFilters` / `globalFilter` as peers with no primary. Those members were deleted in the
  filtering redesign (R12): `withFiltering()` owns no state and contributes no members, because
  the consumer already holds the filters object. The rule's third part — "no obvious primary ⇒
  not callable" — has no live case today. `withFiltering()` stays memberless. The ADR owes a
  correction, tracked as a docs item.
- **`rowsOf`, not `rowIdsOf`.** The ADR's motivating example names `rowIdsOf` returning ids; what
  shipped under D16 / issue #65 is `rowsOf(group)` returning leaf rows. The shipped name moves
  under the slice as-is. The ADR owes the same correction.

### Derived-state placement

- **Placement follows declaration site** (ADR-0015, settled 2026-09-12). A derive block nested in a
  feature merges onto that feature's slice; a top-level derive block merges flat. `withComputed()`
  is unchanged and does not know where it sits — the **host** decides the merge target.
- The feature spec gains an optional declaration naming the member a trailing derive block merges
  onto. Every library feature declares it. A feature that declares none keeps today's flat merge,
  so an existing third-party feature is unaffected. Explicit over inferred: "the feature has
  exactly one member key" is true of every library feature after migration but is not a contract
  a third party signed.
- A nested derive key that collides with a key already on the slice throws at construction with the
  same wording the flat collision uses, naming the slice. The fold's member registry stays the
  single authority for cross-feature collisions and still sees one claimed key per feature.
- The read-only projection handed to a derive block strips only the write path. Today it collapses
  any writable view to a bare signal, which would drop `rowsOf` from `grouping` and `pending` from
  `editing` inside a block. It must strip `update` (and a writable signal's `set`) and keep every
  other slice member, and it must apply one level down so `editing.draft` is read-only inside a
  block too.
- Type-level verified (ADR-0015, 2026-09-13 probe): a slice type intersected with the derived
  dictionary inside the members object keeps slot inference — the slice is not `any`, the derived
  member keeps its signal type, the slice's own call and verbs still resolve, and the row type
  still flows to the next slot.

### What stays exactly as it is

- Pipeline stage order, render-stage order, stage claiming, row-removal reconciliation, `setup`
  ordering, destroy hooks, injection-context requirement.
- ADR-0007's member-claim registry. Each feature claims one key; the registry guards less and stays
  for the D37 case and for consumer top-level derive blocks.
- Grouping's lazy, guarded read of expansion's state survives: it reads the `expansion` slice
  instead of `expandedRows`, and the callable check it already performs holds for a slice.
- `selectAllIds(table)` reads core members only and is untouched.
- The positional `createTable()` shape, the arity ceiling, `composeFeatures()`, and every
  `Feature<In, Out>` signature. Only each feature's `Out` changes, from N flat keys to one slice key.

### Migration strategy

- **Expand–contract**, not a second integration branch. A flat verb and a slice member are different
  keys, so both can coexist under ADR-0007 without colliding. Expand: each feature gains its slice
  while its flat members stay. Migrate: story hosts, demo apps and docs move to the slice form in
  batches that each stay green. Contract: the flat members are deleted once no caller remains.
- **Nothing starts before #77 is green.** Stacking a second structural migration on an unverified
  one gives any failure two candidate causes. (ADR-0015, sequencing.)
- Blast radius, priced against the tree: `src/directives/` reads zero feature members; roughly
  one hundred reads across thirteen Storybook hosts, thirty across five `apps/demo` demos, and a
  handful of doc pages. `editing` is nearly free, since every `editing.update(...)` call site is
  untouched.

## Testing Decisions

A good test asserts what a consumer can observe: the members a composed store exposes, the values a
slice call and its properties produce as state changes, the errors thrown at construction, and the
types a call site sees. It does not assert how a slice is assembled, whether a callable was built by
`Object.assign`, or what the registry holds.

Two seams, both existing files, both at the public factory:

- **Runtime, per feature.** Each feature's existing spec file covers its slice: the call returns the
  primary state, each property signal tracks its own state, each moved verb behaves as its flat
  predecessor did (same write options, same emissions, same reconciliation on row removal). During
  the expand phase both forms are covered; the contract phase drops the flat cases. Prior art: the
  seven feature specs already exercising every verb through `createTable()`.
- **Runtime and types, composition.** The public factory's existing spec covers nested derive
  placement landing on the slice, top-level placement landing flat, slice-level collision throwing
  with both names, and the read-only projection keeping slice members while dropping the write
  path. Type assertions sit alongside the runtime cases in the same file, using the runner's
  built-in type-assertion API: the slice is not `any`, a nested derived member keeps its signal
  type, the slice's own call and verbs resolve beside it, a write path is absent inside a block,
  and the row type flows to the next slot after a sliced feature. Prior art: the type-assertion
  block already in the factory spec, and ADR-0015's four-check probe with its negative control.

Story hosts are verified by rendering, not by unit tests — the same user-run walkthrough gate #75
and #77 use.

## Out of Scope

- Any change to what a verb does. Converging `sorting` / `selection` / `expansion` on an
  `update(updater)` write path with mutation helpers, as `grouping` and `editing` have, is a
  separate uniformity decision.
- A filtering slice. `withFiltering()` owns no state; this spec only records that the ADR's row is
  stale.
- A compatibility layer or deprecation period beyond the expand phase. The flat members are deleted
  inside this migration.
- Directive-layer changes. Nothing under `src/directives/` reads a feature member.
- The generic-parameter documentation drift the ADR notes as unrelated (`withSorting<Person>()` in
  doc call sites). It is its own docs sweep.
- Persistence. Slices are not a serialization boundary.

## Further Notes

The ADR reopens namespacing on grounds ADR-0007 never weighed and does not relitigate the collision
argument. Any implementation discussion that leads with "slices prevent collisions" is arguing
against a solved problem.

The one structural invariant that makes single-slice namespacing sufficient (research Finding 5):
every public verb takes and returns a core type — `RowId`, `RenderRow`, `ColumnId` — so any
cross-slice operation decomposes into two single-slice calls at the consumer's call site. It breaks
the moment a feature wants a feature-private type as another feature's argument. Nothing does that
today; keeping it that way is the condition the ADR should state as a consequence.

Everything type-level here is verified by the ADR's probe against the shipped positional
`createTable()`; nothing is verified at runtime until the expand phase's specs run.
