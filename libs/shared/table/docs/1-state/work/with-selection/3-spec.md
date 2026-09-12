---
title: Spec — withSelection()
type: spec
status: ready
date: 2026-09-07
audience: developers
---

# Spec — `withSelection()`

Synthesized from [`2-decisions.md`](./2-decisions.md) (D1–D19), the seam note
[`0-architecture-seam.md`](./0-architecture-seam.md), and the competitive research in
[`research-selection-change-events.md`](./research-selection-change-events.md). No decision below
is open for relitigation here.

## Problem Statement

A consumer building a table has no way to express "these rows are chosen." Every product that needs
a bulk action — delete the selected invoices, reassign the selected tickets, export the selected
rows — has to build row selection from scratch: a set of ids, a checkbox per row, a header checkbox
with a partial state, and reconciliation when a selected row is deleted underneath them.

It is the single largest baseline gap in the state layer: all four competitors ship selection in
core, and the two verbs already tabled as unshipped in the row-mutations spec — bulk row removal and
bulk patch — are blocked on there being no selection source to read from.

The feature is also where competitors have most visibly failed. "Select all" is ambiguous — the
current page, the filtered set, or the entire dataset including rows never fetched — and none of the
four researched libraries resolves it. AG Grid encodes the ambiguity after the fact in a
sixteen-value event source enum; Material React Table leaks it as a force-all flag on a handler. A
consumer inherits whichever guess the library made.

## Solution

`withSelection()` — an opt-in feature plugin owning a set of selected row ids, the verbs that change
it, and a stream announcing what changed.

It refuses the scope ambiguity rather than resolving it: the feature never decides what "all" means.
Every write names the ids it applies to, so "select all" is the call site passing the id set it
means — the current render output, a server-supplied list, anything. Nothing in the feature depends
on pagination or filtering, and no configuration asks the consumer to pick a denominator they will
have to re-explain later.

Selection is a set of ids and nothing more. It carries no hierarchy, requires no relationship to the
row data, and does not participate in rendering — a checkbox reflects it by reading a signal, not by
the table re-deriving every row.

## User Stories

1. As a developer, I want to compose `withSelection()` into an existing table, so that I can add row
   selection without restructuring the table I already built.
2. As a developer, I want a signal of the currently selected row ids, so that I can drive my own UI
   from it without subscribing to anything.
3. As an end user, I want to click a checkbox on a row, so that I can mark that row for a later
   action.
4. As an end user, I want to click the checkbox again, so that I can unmark a row I selected by
   mistake.
5. As a developer, I want a single toggle verb, so that a checkbox click handler is one line and I
   never have to read current state to work out whether to add or remove.
6. As a developer, I want to select many rows in one call, so that a "select these" action resolves
   in one state change rather than a loop of single writes.
7. As a developer, I want to deselect many rows in one call, for the same reason.
8. As a developer, I want to clear the entire selection in one call, so that "cancel" is trivial.
9. As an end user, I want a header checkbox that selects every row I can currently see, so that I
   can act on the whole visible table at once.
10. As an end user, I want that header checkbox to show a partial state when only some rows are
    selected, so that I can tell at a glance that my selection is incomplete.
11. As a developer, I want the none/some/all calculation supplied by the library, so that every
    table in my app does not reimplement the same tri-state computation.
12. As a developer, I want to pass the id set the header checkbox applies to, so that "all" means
    what my product decided it means, not what the library guessed.
13. As a product owner, I want "select all" to be unambiguous, so that support does not field
    tickets about whether a bulk delete hit the current page or the whole dataset.
14. As a developer, I want to configure a table so only one row can be selected at a time, so that a
    record-picker or master-detail view behaves like a radio group.
15. As a developer, I want single-select to be expressible per row rather than per table, so that I
    can forbid co-selection for particular rows (a summary row, a locked record) without forbidding
    it everywhere.
16. As an end user of a single-select table, I want clicking a second row to move my selection
    rather than add to it, so that the table behaves the way a picker should.
17. As a developer, I want a bulk write under single-select to keep the last id rather than throw in
    production, so that a stale saved selection or an unexpected server response does not crash the
    page.
18. As a developer, I want that same case to throw loudly during development, so that I find the
    mistake while building rather than in production telemetry.
19. As an end user, I want the checkbox to respond to my click every time, so that the UI never
    feels stuck or unresponsive.
20. As a developer, I want selection to survive sorting and re-rendering, so that a user's choices
    are not lost when they reorder the table.
21. As a developer, I want a selected row that is deleted from the data to leave the selection
    automatically, so that a later bulk action cannot target a row that no longer exists.
22. As a developer, I want that automatic cleanup to be silent, so that my "delete selected" flow
    does not receive a second notification for the deletion it just performed.
23. As a developer, I want a stream telling me exactly which ids were added and which were removed
    on each change, so that I can sync a server without diffing state myself.
24. As a developer, I want one emission per write rather than one per id, so that a bulk selection
    does not produce a thousand notifications.
25. As a developer, I want a write that changes nothing to emit nothing, so that idle re-application
    of the same selection does not look like user activity.
26. As a developer, I want no emission for changes I did not cause through a verb, so that the
    stream is a log of intent rather than a log of every state mutation.
27. As a developer, I want to seed a table with an initial selection at construction, so that
    restoring a saved selection is one declarative line.
28. As a developer, I want that initial seeding to be silent, so that a sync subscriber does not
    mistake a restore for the user selecting rows.
29. As a developer, I want to restore a selection that arrives asynchronously from a server, so that
    a saved selection can be applied after the table has already rendered.
30. As a developer, I want to suppress the event on any programmatic write, so that server-driven
    synchronization does not echo back as user intent.
31. As a developer, I want to select ids for rows that have not loaded yet, so that restoring a
    selection does not have to wait for the data request to resolve.
32. As a developer, I want subscribers to terminate when the table is destroyed, so that a
    long-lived page does not leak subscriptions.
33. As a developer using a plain native checkbox, I want a directive that wires activation and state
    for me, so that I do not hand-roll ARIA and click handling per table.
34. As a developer using a design-system checkbox component, I want a documented pattern for wiring
    it up, so that I am not blocked by the library only supporting native inputs.
35. As a developer, I want the row's identity to come from context rather than an input I repeat, so
    that a checkbox declaration does not restate what the row already knows.
36. As a developer, I want to skip the directives entirely and drive everything from the store, so
    that a team owning its own accessibility and markup is not forced through our DOM opinions.
37. As an end user with a screen reader, I want a row's selected state announced, so that I can tell
    what is selected without seeing the checkbox.
38. As a developer, I want selection to add no cost to rendering, so that clicking a checkbox in a
    large table does not re-run the whole render pipeline.
39. As a developer, I want selection state to be readable synchronously at any time, so that a click
    handler can act on it without awaiting anything.
40. As a developer, I want selection excluded from anything that persists table layout for now, so
    that a session-scoped choice is not silently written to storage.
41. As a developer, I want selection ready to participate in layout persistence later, so that
    adopting persistence does not require redesigning selection.
42. As a maintainer, I want selection to declare no dependency on other features, so that composing
    it never depends on feature order.
43. As a maintainer, I want a second feature claiming the same member names to fail at construction,
    so that a collision is caught immediately rather than silently overwritten.
44. As a maintainer, I want the bulk row verbs unblocked by this work, so that bulk delete and bulk
    patch can be built next without redesigning their selection source.

## Implementation Decisions

### Module

One new feature plugin under the features folder, following the established plugin contract (a
`with-*()` factory returning a spec that declares members; features declare, never mutate), plus its
colocated unit spec. Exported from the single public barrel. No engine changes.

### Public surface

Shape settled in D2, D7, D9, D14, D16, D18:

```ts
interface WithSelectionConfig<TRow> {
  enableRowSelection?: boolean | ((row: TRow) => boolean);        // default true
  enableMultiRowSelection?: boolean | ((row: TRow) => boolean);   // default true
  initialSelection?: RowId[];
}

interface SelectionChange {
  readonly added: readonly RowId[];
  readonly removed: readonly RowId[];
}

interface SelectionWriteOptions {
  emitEvent?: boolean;                                            // default true
}

interface SelectionMembers {
  readonly selectedRows: Signal<ReadonlySet<RowId>>;
  readonly selectionChanged: Observable<SelectionChange>;
  toggle(id: RowId, opts?: SelectionWriteOptions): void;
  select(ids: RowId[], opts?: SelectionWriteOptions): void;
  deselect(ids: RowId[], opts?: SelectionWriteOptions): void;
  clearSelection(opts?: SelectionWriteOptions): void;
  selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all';
}
```

### Decisions

- **No selection scope (D1).** No scope config, no scope argument. "Select all" is the caller
  passing an id set. No runtime or compile-time dependency on pagination or filtering. This closes
  the cross-cutting "select all scope" open question in the state-layer architecture index and
  removes the stated blocker from the UI-layer selection doc.
- **The config rule that produced D1 (amended).** Reject configuration whose meaning depends on
  state the feature does not own; accept configuration that parameterizes a verb the feature does
  own. A scope enum fails it — "page" is unresolvable unless pagination happens to be composed. The
  multi-row-selection predicate passes it — the rule resolves inside the toggle verb against a row
  already in hand.
- **Single-select is a rule on the verbs, never stored state (D2).** No mode member and no
  single/multi union anywhere. When the predicate is false for the target row, a write clears the
  set before selecting. Scoped per row so a predicate can express per-row rules a boolean cannot.
- **The rule constrains every write verb, not only toggle (D14).** A multi-id write under a false
  predicate keeps the last id. Under dev mode only, throw naming the discarded ids; truncate
  silently in production, because these writes are frequently fed by restored or server-supplied
  data rather than authored literals.
- **Unknown ids are still selectable (D8).** A write never checks whether an id is data-backed; the
  predicate defaults to permissive when no row resolves. A checkbox must respond to a click. The set
  is a pure id set with no data-backed invariant.

  This also covers the restore path (D8, extended 2026-09-08 — the same call now settles the
  matching question in [expansion.md](../../features/expansion.md)). `initialSelection` and any
  future snapshot write keep ids that match no row, because **a valid id may simply not be loaded
  yet** — construction can precede the first fetch, and under pagination a selected row may live
  on a page never requested. Validating the seed against `indexById()` would silently discard a
  correct restore, and at apply time an unloaded id is indistinguishable from a deleted one.
  `onRowsRemoved` never prunes such an id, since it only announces ids that left `data()`.

  Keeping saved ids in step with the server is therefore the call site's job — it holds both the
  saved ids and the fetched rows, which the feature does not. Revisit if
  [state-persistence.md](../../state-persistence.md) takes selection into its scope, as `restore()`
  is library-owned; D19 keeps it out for now. Residual harm, accepted: `[...selectedRows()]` passed
  straight into a bulk request can carry an id the server no longer has.
- **Row selectability ships as a write-path gate (D58).** `enableRowSelection` answers a
  different question than D8: D8 governs ids with no row behind them, `enableRowSelection`
  governs rows that resolve and answer `false`. Scope, all settled by unanimous competitive
  precedent (D58, [`2-decisions.md`](./2-decisions.md)):
  - **Gates id-adding writes only** — `toggle`, `select`, and the `initialSelection` seed. Never
    `deselect`/`clearSelection`, so a row that becomes non-selectable while selected stays
    escapable.
  - **Write path, not read path** — `selectedRows()` and `selectionStateOf()` do not consult the
    predicate; selection stays a plain id set.
  - **No reconcile** — a row turning non-selectable while selected is not auto-deselected. AG
    Grid is the only library that reconciles, and needs a `source` field on its event to explain
    the library-caused change; our delta has none, and pruning ids the user never deselected is
    what D8 already refuses.
- **Selection is read from a signal, never stamped onto rows (D5).** No feature-contributed render
  row field, no render stage claimed. Deliberately different from expansion, which stamps its state
  because it changes *which rows exist*; selection does not.
- **Tri-state ships as a helper taking the id set (D7).** The caller supplies the denominator, so
  the feature never picks one, but the none/some/all logic is written once. This is what makes a
  header directive possible — it takes the id set as an input rather than inferring one.
- **The change stream carries a delta, not the set (D9).** Added and removed, with current state
  read from the signal. Exactly one emission per write verb, carrying that write's full delta; bulk
  writes emit once, not per id; a write that changes nothing emits nothing. Duplicate ids within a
  call collapse and appear once (D15).
- **Reconciliation is silent (D11).** Removal reconciliation prunes the set with no exemption, and
  suppresses the emission. The precise invariant: every *write verb* emits exactly once;
  reconciliation is not a write verb. One user action must not produce two notifications.
- **Ids are flat; no cascade (D13).** Selecting a row selects one id. No children accessor, no
  dependency on expansion, no indeterminate parent state. Rests on row data being a flat array.
- **Initial selection seeds silently (D16).** Construction is not a write verb and emits nothing.
  Two implementation constraints this spec fixes because both break invisibly: the stream must be a
  non-replaying subject, never a replaying one; and the initial set must be written directly into
  the signal rather than routed through the public select verb, which emits.
- **Async restore uses a silent write (D18).** An event-suppression option on any write verb.
  Generalizes the reconciliation principle from one hard-coded case to a caller-controlled one.
  Rejected alternatives: a signal-typed initial selection seeded once (the type promises reactivity
  the implementation refuses, so a later update does nothing, silently), a fully consumer-owned
  selection signal (coherent but makes selection state consumer-owned and needs a write-through
  rule), and a per-feature persistence hook (forbidden by the persistence spec's one-write-path
  rule).
- **Subscribers terminate with the table (D17).** The stream completes in the feature's destroy
  hook.
- **Removal reconciliation is declared (ADR-0006).** The feature stores row ids, so it declares the
  removal hook and prunes with the shared helper. No exemption — a deleted row's id must leave the
  set.
- **The UI seam is unchanged (D3).** Directives may inject the store, call a verb, and reflect
  signals into ARIA and data attributes. A directive is never where a fact is stored. Known before
  interaction is declarative config; caused by interaction is a verb.
- **The shipped checkbox directive targets native inputs only (D6).** Component checkbox hosts are
  not auto-wired: an attribute directive's host bindings target the element, not a sibling
  component's inputs, and Angular's own mechanism for bridging that is private API. Deferred, not
  rejected. What ships instead is a documented recipe — the consumer authors a thin directive on
  their own component, injecting the component instance by type (which they can do and the library
  cannot) plus the existing public table and row tokens. Requires no new API surface.

### Documentation updates this work owes

- The state-layer feature spec for selection: frontmatter moves off stub, contract written in.
- The state-layer architecture index: mark the "select all scope" cross-cutting question resolved.
- The UI-layer selection doc: strike its "Known Blocker", which cited the scope question.
- The row-mutations doc: change the bulk verbs' blocker from "needs a selection source; the feature
  does not exist" to "unblocked, not yet built".
- Regenerate the generated status roll-up rather than hand-editing it.

## Testing Decisions

**What makes a good test here.** Only external behavior, through the public store. A test composes
the feature into a real table via the table factory and asserts on the public members. No test
reaches into feature internals, asserts on how state is stored, or counts how many times something
recomputed. Structural and DOM tests belong to the directive layer, not here.

**Seam — one, confirmed with the developer.** The table factory's store surface. Prior art is the
expansion feature's colocated spec, which composes through the factory and drives the store's public
verbs; the new spec mirrors its structure and uses the shared row fixtures rather than inlining new
ones.

**Coverage:**

- Toggling adds, toggling again removes, and repeated toggles alternate.
- Bulk select and deselect apply in one write; duplicate ids within a call collapse.
- Clearing empties the set.
- With the multi predicate false, a toggle replaces rather than adds; a multi-id write keeps the
  last id; the same case throws under dev mode.
- With the predicate expressed per row, co-selection is forbidden only for the rows it names.
- An id absent from the data still toggles.
- The tri-state helper returns none, some and all for the id set it is given, and is unaffected by
  ids outside that set.
- Every write verb emits exactly one delta with the correct added and removed ids; a no-op write
  emits nothing; a write with the event suppressed emits nothing but still changes state.
- Initial selection seeds the set and emits nothing, including for a subscriber attached immediately
  after construction.
- Removing a row from the data prunes its id from the selection and emits nothing.
- Selection is unaffected by sorting or by a data write that reorders without removing.
- The stream completes when the table is destroyed.
- With `enableRowSelection` false for a row, `toggle` and `select` do not add it; a mixed
  `select(ids)` call drops only the non-selectable ids.
- `deselect` of an already-selected row stays ungated even after the row becomes
  non-selectable.
- `initialSelection` is gated the same way as `toggle`/`select`.
- An id that resolves to no row stays selectable regardless of `enableRowSelection` (D8).
- A write fully blocked by `enableRowSelection` emits no `selectionChanged`.

## Out of Scope

- **Bulk row verbs** (D12). Unblocked by this work, shipping separately: bulk edit first requires
  resolving the editing decision that bulk implies multi-row editing, which combined with optimistic
  save is explicitly undesigned.
- **The shipped selection checkbox directive and its header counterpart.** UI-layer work, tracked by
  the UI-layer selection doc, which this spec unblocks.
- **Auto-wiring component checkbox hosts** (D6). Deferred; documented recipe ships instead.
- **Persistence of selection** (D19). The feature will declare a snapshot slice when the
  cross-feature persistence work is built, and that slice's write uses this spec's silent-write path.
  Whether selection is persisted at all is that spec's decision, not this one — its open question was
  parked on the scope ambiguity, which D1 removed.
- **Group-header select-all.** The grouping feature does not exist. Selecting a synthetic group id is
  permitted by D8 but is not the same as selecting its members; whether expanding a group id to its
  members is library API or consumer code is undecided.
- **Parent/child cascade** (D13). Does not arise under flat row data.
- **A cause discriminator on the change payload** (D10). AG Grid's idea of announcing *why* selection
  changed rather than *what* changed is recorded but not adopted.
- **A shared cross-feature change-event type** (D10). The delta type stays selection-local until a
  third id-set-owning feature gives evidence the shape generalizes.

## Further Notes

**Competitive grounding.** Five libraries were read from pinned published typings, not from memory.
Only Angular's CDK selection primitive ships a delta — and it is the only one of the five whose sole
responsibility is selection state, with no rendering, making it the closest analogue to this layer.
Its payload is added plus removed with a back-reference for reading current state; our signal already
serves that role, so no back-reference is carried. PrimeNG's split select/unselect events are the
same delta in two streams and cannot describe a write that both adds and removes — the single-select
replace case. AG Grid and TanStack ship no delta at all.

**Two pre-existing findings surfaced during design, neither this work's to fix.** The row index map
is built from top-level rows only, so removal reconciliation can only ever announce top-level ids —
inert under flat data, latent for any future feature storing nested ids. And the expansion feature's
default children accessor and tree render stage only do anything when data is *not* flat, which
contradicts the flat-data invariant this spec rests on; the proposed split of expansion into a
detail-panel feature plus a tree feature is where that likely resolves.

**A third finding was dispatched separately**: the expansion feature's expand-all and collapse-all
verbs change state without emitting on its row-expanded stream, so subscribers miss bulk changes.
That gap is what motivated stating this feature's emission rule as an invariant rather than leaving
it implicit.
