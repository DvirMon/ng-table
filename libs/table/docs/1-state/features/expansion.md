---
title: State Layer Reference — withExpansion()
type: architecture
version: 1.5
date: 2026-09-07
capability: expansion
spec: drilled
code: partial
audience: developers
parent: ../architecture.md
---

# withExpansion()

> **Being split — [ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md) (`proposed`, 2026-09-03).**
> This doc currently describes one feature covering two distinct shapes. Under ADR-0012:
> `withExpansion()` keeps the name and becomes the **detail-panel** feature — open/closed id
> tracking only, no row synthesis, no render stage, no `childrenAccessor`. Everything tree-specific
> (`childrenAccessor`, `isExpandable`, `depth`, recursive child flattening) moves to a new
> `withTree()`. Shared open-id machinery is extracted to a `createExpansionStore()` factory —
> not a feature — mirroring `api/features/editing-state.ts` (D37/A2). Group collapse continues to
> delegate here, which the split makes correct rather than a special case. This spec will split
> into two on implementation; read the ADR before changing either feature.

## Executive Summary

Multi-expand, hierarchical/tree-capable row expansion. Standalone feature with no compile-time dependencies — used both for detail-row expansion and (via delegation) group collapse/expand state in `withGrouping()`.

## State Shape

```ts
interface ExpansionState {
  expandedRows: Set<RowId>;   // any number of rows can be expanded simultaneously
  everExpanded: Set<RowId>;   // additive-only: every id that has been expanded at least once
}

interface Row {
  id: RowId;
  children?: Row[];   // optional — enables hierarchical/tree-style nesting
}
```

## Config

```ts
interface WithExpansionConfig<TRow> {
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  isExpandable?: (row: TRow) => boolean;
  initialExpanded?: readonly RowId[];
}
```

`isExpandable` decides whether a row renders the expand toggle independently of whether its
children are loaded — for lazy-loaded children, where `childrenAccessor` legitimately returns
`undefined`/`[]` until the row has been opened once. Defaults to "non-empty array from
`childrenAccessor`".

`initialExpanded` is covered under [Initial State and Persistence](#initial-state-and-persistence).

`childrenAccessor` reads a row's nested children. Defaults to `(row) => (row as { children?: TRow[] }).children` — pass a custom accessor when children live under a different key. No `manual` config — see `2-decisions.md`; the `manual` contract below described no actual behavior difference from the default, so nothing exists for it to toggle.

## Behavior

- **Hierarchical/tree support:** rows may carry a `children: Row[]` property; expanding a row reveals its nested children recursively (tree-grid style), not just a flat detail panel.
- **Multi-expand:** any number of rows/groups can be expanded at once — no auto-collapse of siblings.
- **`everExpanded` — lazy-mount support (added 2026-08-07):** an additive-only set recording every id that has been expanded at least once. `toggleExpanded()` and `expandAll()` add to it; `collapseAll()` and `toggleExpanded()`-to-collapse never remove from it. Cleared only when the data source emits a new dataset, alongside `expandedRows`.

  It exists so consumers can gate detail-panel markup on `everExpanded.has(id)` instead of `isExpanded`, giving lazy-then-persist mounting: a never-opened panel costs nothing, and an opened one stays mounted so its collapse animation is a class flip rather than a teardown. Requested by the UI layer — see `../../3-ui/directives/expansion.md`, "Detail Panels Are Lazy and Persistent."

  Not exposed on `RenderRow`. It is keyed lookup, not per-row layout, and detail rows have no `RenderRow` to carry it. Consumers read `table.everExpanded()` directly.

  Known cost: grows monotonically within a dataset, bounded by how many rows a user actually opens. An LRU cap is possible later; deliberately not in v1.

  **Specced, not yet implemented.** The rest of `withExpansion()` is shipped; `everExpanded` has no code in `src/` yet, so this section is the contract to build against rather than a description of current behavior. This is why the spec's `code:` axis reads `partial`.

- **Dual use:** this feature backs both (a) row detail/tree-child expansion, and (b) group row collapse/expand state for `withGrouping()` (see `with-grouping.md`) — group rows are treated as rows with an id, tracked in the same `expandedRows` set. A group row's id is synthesized by `withGrouping()`'s render layer (e.g. `` `group:${columnId}:${value}` ``), not a real `TRow` id — `expandedRows` doesn't care whether an id belongs to a real row or a synthetic group header, it's just a set of ids. Neither `withExpansion()`'s `'tree'` render stage nor `withGrouping()`'s `'group'` render stage reads this set themselves (#99) — both emit their full tree unconditionally, each row/header carrying its parent's id, and the engine-owned `'prune'` render stage (ADR-0017) is the single place that consults `expandedRows` to hide descendants of a collapsed id, dual use and all.

## Methods

| Method | Description |
|---|---|
| `toggleExpanded(rowId: RowId, options?)` | Toggle a single row/group's expanded state. Emits `rowExpanded` once. |
| `expandAll(ids?, options?)` | Expand every expandable row (auto-discovered via `childrenAccessor`, data rows only) unioned with any `ids` passed explicitly — e.g. `table.groupIds()` from `withGrouping()` (#97), used verbatim, no `isExpandable` filter, no recursion. Emits `rowExpanded` once per newly expanded id over the union. |
| `collapseAll(options?)` | Collapse every row/group. Emits `rowExpanded` once per previously expanded id. Does **not** clear `everExpanded`. |

Every write verb takes `options?: { emitEvent?: boolean }` — see
[Silent writes](#silent-writes-emitevent-false).

### `expansionState` — proposed, not implemented

```ts
readonly expansionState: Signal<'all' | 'some' | 'none'>;
```

The one member the cross-library audit justified adding. A consumer **cannot** compute it cheaply
from outside: answering "are all rows expanded?" means re-walking the tree through
`childrenAccessor` + `isExpandable` to count expandable ids — logic this feature already owns in
`collectExpandableRowIds()` and keeps private. Everything else the audit surfaced (per-row reads,
toggle bindings, default-open) a consumer already has or can trivially write.

Its use is a toolbar expand-all control, which needs tri-state to render correctly. TanStack and
MRT ship this as two booleans (`getIsAllRowsExpanded()` + `getIsSomeRowsExpanded()`), which a
caller must fetch and combine; one signal answers directly and cannot return an incoherent pair.
A `computed()` over `rows()` + `expandedRows()` — a signal, not a getter.

**Undecided: when it lands.** It is tree-shaped, so under
[ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md) it belongs to `withTree()`, not
the detail-panel `withExpansion()`. Either add it here now and relocate at the split (a move, not
a contract change), or specify it in the ADR and build it there. Not decided.

Also proposed and undecided, from the same discussion: a multi-id write —
`toggleExpanded(ids: RowId | readonly RowId[], expanded?: boolean)`, with `expandAll`/`collapseAll`
becoming sugar over it. It is the same verb the snapshot slice needs (see
[Snapshot slice](#snapshot-slice)), so the two should be designed together. Open sub-question:
whether `expanded` is required when an array is passed, since per-id toggling of a mixed-state
array is rarely what a caller wants.

## Initial State and Persistence

**Specced 2026-09-07, not implemented.** Decided while resolving the `rowExpanded` bulk-verb
gap; see [expansion-state-audit.md](../work/with-expansion/expansion-state-audit.md).

### `initialExpanded` — a construction-time seed

```ts
withExpansion({ initialExpanded: savedIds() })
```

A **plain array, read once** when the feature factory runs. It seeds `expandedRows` and
`everExpanded` (a restored-open row *has* been opened, so its detail panel mounts immediately
rather than waiting for a toggle) and emits **no** `rowExpanded` — nothing changed, the table
started this way.

Deliberately not a `Signal<RowId[]>` and not a predicate:

- **Not a signal.** Storing one forces an answer to "what happens when it emits again?", and
  both answers are wrong: re-apply stomps every toggle the user has made since (the two-writer
  problem), and ignoring it makes accepting a signal a lie. A plain array makes the question
  unrepresentable. A consumer whose saved ids *are* a signal unwraps at the call site —
  `initialExpanded: this.savedIds()` in a field initializer reads outside any reactive context,
  so nothing is tracked.
- **Not a predicate** (`(row, depth) => boolean`). Rejected: a predicate presumes the condition
  lives in row data, which is only one of the real cases — restored ids, a route param and a
  user preference are all external to the row. Conditional expansion against row data is
  consumer-owned; they compute the ids and pass them.

`readonly RowId[]` rather than `Set<RowId>` because that is what round-trips through JSON to a
storage backend without a converter.

### Silent writes (`emitEvent: false`)

Every write verb takes `options?: { emitEvent?: boolean }`. `{ emitEvent: false }` sets the state
without emitting `rowExpanded`. Precedent: Angular reactive forms' `setValue(v, { emitEvent:
false })`. Adopted from `withSelection()` D18 rather than invented here — the two features use one
shape, not two.

Its reason to exist: **a restore carries no user intent.** A subscriber lazy-loading children on
expand, or saving state on change, should not see a restore as an interaction. Without this,
restoring 200 expanded ids fires 200 `rowExpanded` events, which trips both.

This is the primitive the snapshot feature needs, not a competitor to it — the slice's `write()`
below uses this path, which is what satisfies [state-persistence.md](../state-persistence.md)'s
Rule 2 ("feature `*Changed` events must not fire N times mid-restore") and Rule 3 ("restoring must
not trigger a save"). Exposing it publicly rather than keeping it internal also means a consumer
can restore asynchronously **today**, before that feature exists:

```ts
// ids arriving after construction — the sync `initialExpanded` seed is already spent
this.savedIds.subscribe((ids) => this.table.expandAll({ emitEvent: false }));
```

Known failure mode, accepted: a caller forgets the flag and gets a *visible* spurious emission —
preferable to the silent no-op a latched signal input would produce (D18's reasoning).

### Async restore belongs to the snapshot feature, not here

There is deliberately **no `initialExpandedAsync`**. A `resource()`-backed per-feature restore
was considered and rejected against [state-persistence.md](../state-persistence.md):

- Its rule 1 ("one write path, one read path — no per-feature save/restore hooks") makes a
  second per-feature restore entry point a direct violation.
- Its rule 2 (restore is one transaction) is unachievable when each feature owns its own async
  source: expansion's resource resolving at 200ms and selection's at 400ms cannot be made
  atomic by any per-feature implementation, however careful.
- Apply-once semantics, stale-id validation and save-suppression all have to be solved by the
  snapshot feature anyway for columns/sort/filters. Solving them a second time per feature is
  the enumerated surface that spec's "not a `with-*()` feature" reasoning already rejects.

A consumer with a synchronously-readable backend (localStorage, sessionStorage, a route param)
uses `initialExpanded` directly. One with an async backend either defers constructing the table
until the snapshot resolves, or waits for the snapshot feature.

### Snapshot slice

Expansion's whole participation in `serialize()`/`restore()`, under that spec's proposed
`FeatureSnapshotSlice` mechanism:

```ts
{
  key: 'expansion',
  read: () => [...expandedRows()],
  write: (ids) => setExpanded(ids, { emitEvent: false }),
}
```

Note `setExpanded(ids, options)` — "the expanded set is exactly these ids" — **does not exist
yet**. No current verb expresses it: `toggleExpanded()` is per-id and relative, `expandAll()` is
all-or-nothing. The slice needs one, and it is the same verb a multi-id write would need, so the
two should be designed together rather than separately.

`write()` goes through the silent-write path above, which is what satisfies Rule 2 — matching
`withSelection()` D19, where the same option is "not a competitor to the persistence design; it is
the primitive that design requires." It is called by `restore()`, an imperative consumer call
rather than a reactive context, so no effect is involved.

`everExpanded` is **not** in the slice. It is a lazy-mount ledger, not layout, and `write()`
seeding it is `initialExpanded`'s job at construction. Whether the restore path should union
into it is folded into the open question below.

## Compile-Time Dependencies

None. `withExpansion()` is fully standalone — it only relies on the global `trackBy` (already required by `createTable()` itself for every table), not on any other feature.

## Render Layer

Claims the `'tree'` render stage ([ADR-0011](../../adr/0011-chained-render-stages.md), accepted) — composes alongside `withGrouping()`'s `'group'` stage rather than being mutually exclusive with it; see `with-grouping.md`, "Render Layer." When composed without grouping, `expandedRows` gates a plain row's `children` (from the `Row.children` tree shape above) the same way it gates a group's clustered members when grouping is present: a row's nested content is included in `renderRows()` only while its id is in `expandedRows`. Depth (`RenderRow.depth`) increments per nesting level, whether that nesting came from real `children` or from grouping's synthetic clusters — the render layer doesn't distinguish the two once ids are resolved.

**Detail panels are not part of this.** A non-tree detail panel has no `TRow` to wrap, never enters `renderRows()`, and has no `RenderRow` or `RowKind` of its own. It is consumer markup gated on `everExpanded`. Two mechanisms on purpose: a tree can reveal thousands of child rows at once, so those stay gated by `renderRows()` and are destroyed on collapse; a detail panel is one row the user deliberately opened, so it stays mounted.

`withExpansion()` participates in the render layer by **declaring** `renderStages.tree` on its returned `TableFeatureSpec` — there is no store slot to mutate, features declare (removed with `@ngrx/signals`, see ADR-0003). A second feature claiming `'tree'` throws at construction, but a different named stage (`'group'`, `'paginate'`) composes freely — the whole-layer mutual exclusion this doc previously described is resolved by ADR-0011. [ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md) (`proposed`) will move this feature's tree-specific behavior to a new `withTree()`.

## Events Owned

- `rowExpanded` — fires whenever a row/group's expanded state changes (covers both expand and collapse — direction is inferable from current `expandedRows` state).

  **Per affected id, including the bulk verbs.** `toggleExpanded()` emits once. `expandAll()` emits once per id it actually expanded (ids already expanded are not re-emitted, so a repeated `expandAll()` is silent). `collapseAll()` emits once per id that was expanded before the call. There is no separate bulk event: the contract is one id per state change, whatever caused it, so a consumer lazy-loading children on first expand (PRD #29) works identically for a toolbar "expand all" and a per-row toggle.

  **Completes on destroy.** `TableFeatureSpec.onDestroy` calls `rowExpandedSource.complete()`, so
  subscribers terminate with the table rather than leaking. The subject is a plain non-replaying
  `Subject` — a replaying variant would deliver stale expansion state to every late subscriber.

  Emission order: state is written first, then the ids are emitted — a subscriber always reads the post-change `expandedRows` regardless of which verb fired it. Bulk emissions are sequential `next()` calls on one `Subject`, not a batched array; a consumer that wants to coalesce them can `bufferTime`/`debounce` on its own.

## Open Questions

- [ ] **Non-expandable rows.** Selection shipped a per-row gate —
  [D58](../work/with-selection/2-decisions.md): `enableRowSelection?: boolean | ((row) => boolean)`,
  gating id-adding writes only, permissive when the id resolves to no row (so D8 holds), no
  reconcile. Expansion has no equivalent and already adopts D8 verbatim below, so if
  "non-expandable row" is ever wanted it should take the same shape rather than diverge. Not
  scheduled — recorded so it is findable from this side. Research:
  [research-row-selectability.md](../work/with-selection/research-row-selectability.md).
- [x] Should `rowExpanded` fire separately for expand vs. collapse, or is a single event with inspectable state sufficient? Resolved — single `rowExpanded` event, direction inferable from `expandedRows` after the change. Shipped as specced.
- [x] Do `expandAll()`/`collapseAll()` emit `rowExpanded`? Resolved 2026-09-06 — yes, once per affected id; no separate bulk event. The bulk verbs previously mutated `expandedRows` silently, which contradicted this doc and broke the lazy-load-on-expand use in PRD #29. Cross-library comparison, and why the AG Grid–style separate bulk event was not chosen (yet): [expansion-state-audit.md](../work/with-expansion/expansion-state-audit.md).
- [x] **Stale restored ids.** `initialExpanded` (and a snapshot `write()`) can carry ids whose
  rows are absent from `data` — deleted server-side since the state was saved. ADR-0006's prune
  runs on *removal*, and these ids never arrive to be removed, so they sit in `expandedRows`
  indefinitely. **Resolved 2026-09-08 — keep them; staleness is caller-owned.** This adopts
  selection's [D8](../work/with-selection/2-decisions.md) verbatim, so both id-set features
  answer it the same way: neither set carries a data-backed invariant, and an id matching no row
  renders nothing.

  Dropping unknown ids at apply time was rejected on one case that no amount of care fixes:
  **an id can be valid but not yet loaded.** Restore runs before the first fetch resolves, or the
  row lives on a page not yet requested. Nothing is stale, there is nothing to validate against,
  and filtering the seed would silently discard a correct restore. That case is indistinguishable
  at apply time from a genuinely dead id.

  While persistence is consumer-owned — `initialExpanded` fed from localStorage, a route param,
  a server profile — keeping saved ids in step with the server is the call site's job, and the
  call site is the only place with both the saved ids and the fetched rows. Revisit when
  [state-persistence.md](../state-persistence.md) is actually built, since `restore()` is
  library-owned and moves that obligation inward; that spec is deliberately sequenced last, and
  its own rules already require stale-id validation for columns/sort/filters, so this feature
  should inherit whatever it decides rather than pre-empt it.

  The set is already designed to hold ids absent from `data` — synthetic `group:*` ids are never
  real rows — so this is staleness, not corruption. And per
  `work/with-selection/2-decisions.md`, it is not restore-specific: `indexById` is built from
  `config.data().forEach(...)` (`engine/core.ts`), so it holds **top-level rows only**. ADR-0006
  can therefore never announce removal of a nested id, and `toggleExpanded(childId)` puts nested
  ids in `expandedRows` during ordinary use, no restore involved. The prune gap is live today;
  restore does not introduce it, and rejecting stale ids at the seed would not close it.

  Applies to the snapshot slice on the same terms — one answer for both, as the question asked.
- [ ] Should `everExpanded` be seeded by a snapshot `restore()`, or only by `initialExpanded`?
- [ ] **Does `expansionState` land here or in `withTree()`?** The member is justified (see
  [above](#expansionstate--proposed-not-implemented)); only its timing is open, because ADR-0012
  is already reopening this feature's surface. Same question applies to the proposed multi-id
  `toggleExpanded`/`setExpanded` write.
- [ ] Precise lazy-load UX contract (e.g. per-row loading indicator) not addressed — likely a UI-layer concern once directives are specced, but the *state* for "is this row currently loading children" hasn't been assigned to any feature yet.

---

## Competitive position

**Verdict: on par** — sub-rows and tree data match TanStack and Material React Table, and
`withExpansion()` already covers the detail-panel use MRT keeps as a separate concept; the
panel-vs-tree split that would make that explicit is still pending in
[ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md).

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
