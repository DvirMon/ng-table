---
title: Decisions — Row Mutations (NGP Table state layer)
type: decisions
status: shipped
date: 2026-08-11
---

# Decisions — Row Mutations

Episodic work folder for the row-mutation core (F4 static-vs-live table — row CRUD),
raised 2026-08-11. Shipped as issue #47 (`updateRows`/`addRow`/`removeRow`/`patchRow`).

**This file is the reasoning, not the contract.** The shipped surface is specced in
[`row-mutations.md`](../../row-mutations.md). This log contains superseded decisions
(D12→D30, D6's call convention→D30) that no longer describe the code.

Editing (F1 editable cells, F2 edit UI modes, F3 row actions, F5 dirty/validation/commit)
split out to [`work/with-row-editing/2-decisions.md`](../with-row-editing/2-decisions.md) —
that cluster consumes the primitives decided here (`updateRows`, `addRow`/`removeRow`/`patchRow`,
`at` semantics, temp-id handling) but decides nothing about mutation mechanics itself.

## D1 — Store never creates a form (2026-08-11)

**Decision:** The state layer does **not** build, own, or wrap an Angular Signal Form.
Consumers create the form themselves with the Signal Forms API and keep full access to
its surface (`disabled`, validation, dirty/touched, update APIs). The store only ever
receives and holds **data**.

**Consequence:** No `withEditing()` feature that constructs a form tree. Form ownership
mirrors the existing `data` ownership model — consumer-side.

## D2 — Store exposes row mutation methods (2026-08-11)

**Decision:** The store must expose basic row CRUD — add / remove / update — as first-class
public methods, independent of any form.

**Rationale:** Two distinct scenarios converge on the same operation:
1. Form-driven edit — consumer's Signal Form commits a row's new values.
2. Non-form mutation — rows arriving or changing from another source (push, another
   screen, a bulk action), or a delete/add action with no form involved at all.

Both are "the row set changed", so both go through one mutation API rather than two.

**Consequence:** The store stops being a read-only projection over `data`. Write direction
now flows back into it — this is the "static table vs live table" distinction (F4), and it
is the parent feature that F1/F2/F3 sit on top of.

## D3 — Store writes back to the `data` signal (2026-08-11)

**Decision:** Mutations write directly into the consumer's `data` signal. It stays the single
source of truth; the store keeps no parallel internal row set, so there is nothing to drift.
Consumers get no reducer boilerplate.

**Consequence:** `data` must be a `WritableSignal<TRow[]>` for mutations to work — a plain
`Signal`, `computed`, or `resource`-backed source cannot be mutated. Scoping of that
constraint is O6.

## D4 — `data` is always a `WritableSignal` (2026-08-11)

**Decision:** `createTable()` requires `WritableSignal<TRow[]>` unconditionally — not narrowed
by a mutation feature. One data shape for every table, read-only or editable.

**Consequence:** Read-only tables fed by `computed()` or a `resource`/`httpResource` can no
longer pass that source directly; the consumer copies into a writable signal (typically the
same `effect()` they already write for the server-side `manual` flow). `overview.md`'s
server-side example needs updating.

## D5 — No CRUD surface on the store; one generic write + pure updaters (2026-08-11)

**Decision:** The store does **not** expose `addRow` / `removeRow` / `updateRow` methods
(revising D2's phrasing — D2's intent stands, its API shape does not). Instead: a single
generic write, following the two precedents in the stack —

- Angular Signal Forms: a `Field` exposes `value` as a `WritableSignal`; you `.set()`/`.update()`
  it and the framework reflects into the parent model. No per-operation API.
- NgRx Signals: `patchState(store, updater)` — free function, store as first argument.

## D6 — `updateRows(table, updater)`, free function, store first (2026-08-11)

**Decision:** Mirror `patchState`. Row writes go through a free function taking the store:

```ts
updateRows(table, addRow(newRow, { at: 0 }));
updateRows(table, patchRow('42', { status: 'done' }));
updateRows(table, removeRow('42'));
updateRows(table, rows => rows.filter(r => !r.stale));   // raw updater always allowed
```

`updateRows` writes through to the consumer's `WritableSignal` (per D3/D4). Id-based updaters
need row identity, which lives on the store as `trackBy`; because the store is the first
argument, `updateRows` can supply `{ trackBy }` to the updater internally. Updaters stay
tree-shakeable and unit-testable without a store.

**Consequence:** the store gains no `update()` method — the write path is the free function.

## D7 — `setData()` is removed (2026-08-11)

**Decision:** Drop `store.setData(rows)`. Wholesale replacement is `data.set(rows)` on the
consumer's own signal; row-level change is `updateRows(table, updater)`. The consumer owns
the signal (D4), so no store method is needed for replacement.

**Consequence:** two write paths total, cleanly split by scope (whole set vs. rows within it).
Breaking change against the current spec — the server-side `manual` examples in
`overview.md` (~line 108/161) and `prd.md` (user story 11, implementation decisions) must be
rewritten to `data.set(...)`. The store's internal data effect no longer calls `setData()`;
it reacts to the signal directly.

**Full list of stale spec text** (grepped 2026-08-13, verify before editing):
`overview.md` 103, 107, 111, 161, and the diagram node `Raw Data (setData)` at 170;
`prd.md` 44 (user story 11), 97, 99, 100, 109;
and one identical `manual`-section line in each feature doc telling the consumer to call
`store.setData()` with server-processed data — `features/sorting.md:67`,
`features/filtering.md:56`, `features/grouping.md:51`. The three are deliberately parallel today
and should stay parallel.

## D8 — Mutation is core, not a `with-*()` feature (2026-08-11)

**Decision:** `updateRows` and the updater helpers are part of the base API, not an opt-in
feature. D4 already makes `data` writable on every table, so a feature flag would gate
nothing — a consumer could always bypass it with `data.update(...)`. Updaters are free
functions and tree-shake individually.

**Note:** the work-folder slug `with-mutations` is now a misnomer; it stays as this effort's
episodic folder name, but no `withMutations()` feature will ship.

## D9 — Mutation/pipeline interaction deferred to the editing feature (2026-08-11)

**Known sharp edge:** `updateRows` writes to `data`, which is the pipeline's input. A row added
while a filter is active can be filtered straight back out; under an active sort or pagination
it can land off the current page. From the user's seat: "I clicked Add and nothing appeared."

**Decision:** no special handling in the write path. The pipeline stays authoritative and the
fixed order rule is untouched. Pinning newly-added rows (exempting them from
filter/pagination until committed) belongs with the editing feature (F2), where the
add-a-blank-row-then-fill-it flow actually lives — and it depends on O4's definition of
"committed" anyway. Resolved in the editing cluster: see D20/D24/D25 in
`work/with-row-editing/2-decisions.md`.

## Engine review — actual code read (2026-08-11)

D1–D10 were decided while the state layer still ran on `@ngrx/signals`. The in-house engine
(ADR-0003) has since landed on `main`. The feature-composition model carries over — D8 and D10
fit cleanly, since a `withRowEdit()` is a members-only `TableFeatureSpec`, the same shape as
`withExpansion`'s `ExpansionMembers`. The **data ingress** is the opposite of what D3/D4
assumed:

```ts
const rawRows = signal<TRow[]>([]);                 // engine/core.ts — engine owns the row set
setData(next) { rawRows.set(next); }
effect(() => store.setData(data()), { injector });  // api/create-table.ts — one-way copy in
export type TableDataInput<TRow> = Signal<TRow[]> | (() => TRow[]);  // read-only source
```

D6's original justification also dissolved: the shape mirrored `patchState(store, updater)`,
and there is no `patchState` anymore. **D6 stands unchanged** on its own merits — store-first
lets updaters read `trackBy`, and they stay tree-shakeable and unit-testable without a store.

Also gone in the migration: compile-time feature dependencies. `composed` is
`Record<string, unknown>` — "untyped by design; a feature author narrows it themselves"
(`engine/types.ts`). NgRx's `type<>` enforcement (`withGrouping` requires `withExpansion`) has
no replacement and is currently unenforced. Tracked as O8.

## D11 — Rework the ingress; `data` is the single source of truth (2026-08-11)

**Decision:** D3/D4 win over the engine's current model. `data` becomes a required
`WritableSignal<TRow[]>` and *is* the row set. The engine's `rawRows` signal and the copy-in
`effect()` in `createTable()` are removed; the pipeline reads `data()` directly
(`rows = computed(() => runPipeline(data(), stages))`).

**Rationale:** one copy, so there is no drift — under the engine's current model a `data`
re-emit silently overwrites local row mutations, which is exactly the failure D3 was chosen to
avoid.

**Consequences:**
- Engine surgery on freshly-migrated code: `engine/core.ts` (drop `rawRows`, `setData`),
  `api/create-table.ts` (drop the copy effect), `engine/types.ts` (`TableCore.rawRows`).
- `TableDataInput<TRow>` narrows to `WritableSignal<TRow[]>` — `computed()` and plain-thunk
  sources stop working; consumers copy into a writable signal first.
- D7 (drop `setData()`) is reinstated, now as a consequence rather than a standalone call:
  with no internal row set there is nothing for it to write.

## D12 — All writes are free functions; store keeps no write methods (2026-08-11)

**Decision:** Resolves O9 in favor of D6's shape, and extends it to columns. The store surface
becomes signals + feature members only; every write is a free function taking the store first:

```ts
updateRows(table, addRow(blank, { at: 0 }));
updateRows(table, removeRow('42'));
updateColumns(table, reorderColumns(ids));
updateColumns(table, toggleColumnVisibility('status'));
```

**Rationale:** one shape for one idea, and maximally tree-shakeable — a table that never
reorders columns doesn't carry the code.

**Superseded:** the free-function/store-first call convention is replaced by per-slice store
members — see D30. Updater purity/tree-shaking rationale carries over unchanged; only the
call-site wrapper moves.

**Consequences:**
- Churns the just-migrated column API: `setColumns`, `updateColumns`, `reorderColumns`,
  `toggleColumnVisibility` move off `TableCore`/`TableStore` (`engine/core.ts`,
  `engine/types.ts`, `api/types.ts`) and become exported free functions.
- Any directive or demo calling `table.reorderColumns(...)` must be updated (`directives/`,
  `apps/demo/`).
- `prd.md` user stories 7, 8 and 9 (lines 40–42) and the "Column mutation methods" line (97)
  describe all three as store methods — all four passages go stale.
- Combined with D11, `TableStore` retains no mutation methods at all — signals plus whatever
  features contribute.
- `CLAUDE.md`'s "the five mutation methods" description of `engine/core.ts` goes stale.

## D19 — v1 ships three updaters: `addRow`, `removeRow`, `patchRow` (2026-08-12)

**Decision:** Resolves O7. The shipped set is exactly:

```ts
addRow(row, { at?: number })
removeRow(id: RowId)
patchRow(id: RowId, partial: Partial<TRow>)
```

**Rationale:** D6 keeps the raw lambda form (`updateRows(table, rows => …)`) always available,
so an unshipped updater costs a consumer one inline function. The bar for shipping is therefore
not convenience but *error-proneness*: an updater earns its place when hand-rolling it needs
`trackBy` resolution or index math. All three above clear that bar, and all three have a v1
caller — `patchRow` is the save path and the row-actions path (see D18 in the editing decisions),
`removeRow` is delete, `addRow({ at })` is the add-blank-row-then-fill flow (D9/F2).

**Deferred, with the reason each was cut:**

- **`moveRow(id, to)`** — clears the error-proneness bar (index math is the easiest thing to get
  wrong by hand) but has no v1 caller. Sorting owns row order; drag reorder is `withDragDrop()`,
  unshipped. Shipping it now means speccing and testing it against no real use case. Revisit
  when `withDragDrop()` lands.
- **`compose(...updaters)`** — no v1 flow batches two row writes. The obvious candidate,
  commit-an-edit, writes to `data` *and* to editing state, which are separate signals (see D16/D17
  in the editing decisions), so `compose` would not collapse it into one pipeline rerun anyway.
  Revisit if a genuine multi-write-to-`data` flow appears.
- **Plural forms (`removeRows(ids)`, `patchRows(…)`)** — bulk operations need a selection source,
  and `withSelection()` is unshipped. A consumer needing bulk today writes one lambda.

**Shape settled ahead of time by D32** — when these land they are widened arity on the existing
verbs plus one `batch()`, not new plural names.

## D32 — Bulk is widened arity plus `batch()`; the word "bulk" never enters the API (2026-08-25)

**Decision:** Settles the *naming and shape* of the operations D19 deferred, without building
them. "Bulk" conflates two things that need different answers:

**(a) One operation over N rows** — bulk delete, bulk patch. This is arity, not a new capability,
so it widens the existing verbs rather than growing plural siblings:

```ts
removeRow(id | id[])
patchRow(id | id[], partial)
```

One operation with optional cardinality, matching the same criterion that gave `addRow({ at })`
and `rebaseEdit(id, row?)` (renamed `captureEdit` by D40) their shape — not a verb per case.

**(b) N operations in one write** — add two rows, delete three, patch one, as a single `data`
emission. This is D19's deferred `compose`, renamed:

```ts
table.value.update(batch(removeRow(1), removeRow(2), patchRow(3, { dept: 'Ops' })));
```

`batch` is why (b) is worth having at all beyond tidiness: one emission means one pipeline run,
one `indexById` rebuild (D23), and one undo step, instead of N of each.

**Why this shape falls out of what already exists:** `RowUpdater` is `(rows: TRow[], ctx) =>
TRow[]` — it already operates on the whole array, so single-row updaters are the *narrow* case,
not the general one. Widening `removeRow` is a one-line change to its `filter` predicate, and
`batch` is plain function composition over the existing type. Neither needs engine involvement.

**Still not built, and the blocker is unchanged from D19:** bulk *edit* needs a selection source
and `withSelection()` does not exist (`docs/1-state/features/selection.md` is a spec with no
implementation; `api/features/` holds sorting, expansion, columns-schema, row-edit). Bulk
delete/add are reachable without it when the consumer supplies ids, but neither has a caller yet.

**Consequences:**
- D19's "plural forms" deferral stands on timing; its *shape* is now decided, so whoever builds it
  does not re-open the naming.
- D19's `compose` deferral is superseded in name only — `batch` is the same function. Its stated
  reason for deferral (commit-an-edit spans `data` *and* editing state, two signals, so `compose`
  would not collapse it) still holds and is not what `batch` is for.
- **Collides with D31.2 (editing decisions).** Bulk edit implies `multiple: true`, which combined
  with optimistic save is explicitly undesigned — N open rows × M in-flight saves. Whoever specs
  bulk edit resolves that first.
- "Bulk" stays a product word for the UI affordance (a Bulk actions menu), never an API word.

**Consequence:** three updaters to spec, test, and document. Each tree-shakes individually and is
unit-testable without a store (D6).

## Insertion position — the storage/display coordinate split

Not a decision yet; the framing every insertion question reduces to.

All writes land in `data` (D3/D6). The pipeline reads `data` and produces `renderRows()`. When a
sort is active, these are unrelated orderings — and sort *replaces* storage order rather than
adjusting it, so **no value of `at` can place a row at a chosen display position**. This is not a
mapping that needs solving; it is unrepresentable in storage coordinates.

`at` therefore serves two different intents that must not share one parameter:

| Caller intent | Mechanism it actually needs |
|---|---|
| index into the underlying array | a `data` index — well-defined always, rarely what a user means |
| "top of what I'm looking at" | exemption from the sort stage + a held position, i.e. **pinning** |

The second is the same mechanism the editing cluster needs for "don't move the row I'm editing",
resolved there as D24's `debounce()` boundary rather than pipeline exemption — see
`work/with-row-editing/2-decisions.md`.

Unstated edge semantics for `at`, pending the above: omitted — append or prepend? Out of range —
clamp or throw? Negative — from the end, or error? Resolved below as D27.

### Spun out — null/empty ordering is a `withSorting()` gap

A blank inserted row's position under an active sort is decided by how the comparator treats
`""`/`null`, and today that position flips with sort direction. That is not a mutation concern —
it is a missing `withSorting()` capability, recorded in `../../features/sorting.md` ("Null / Empty
Value Ordering — REQUIRED, NOT IMPLEMENTED") along with three real defects found in the current
comparators, including a `TypeError` crash on any nullable Date column.

It must ship with or before editable rows, but it is a separate work item. It makes the empty
row's landing spot *stable and configurable*; it does not hold the row still while typing — that
is resolved by D24 in the editing decisions.

### Deferred — insertion under grouping

When `withGrouping()` lands, insertion gains a scope that doesn't exist today: "add a row **to this
group**", driven by a per-group add affordance in the UI. That target is neither a `data` index nor
a flat display index — it's a group identity plus a position within it, and the inserted row must
carry whatever field values place it in that group (otherwise the pipeline regroups it elsewhere on
the next run, which is the same failure mode as the sort case above).

Not being designed now. Recorded so the insertion API is not locked into a flat-index-only shape
that grouping later has to break. **Open possibility worth testing when the time comes:** if the
general insertion mechanism ends up expressed as "insert relative to an anchor row" rather than
"insert at index N", grouped insertion may need no separate API at all — the anchor carries the
group. Do not assume this; verify against a real grouping spec.

## D26 — Temp ids are the consumer's; the table tolerates an identity swap (2026-08-13)

**Decision:** A row added before the server assigns an id carries a **consumer-supplied temporary
id**. The library never fabricates one.

```ts
updateRows(table, addRow({ id: crypto.randomUUID(), name: '', dept: '' }));
```

**Why the library cannot do it:** `trackBy` is `keyof TRow | (row) => RowId` (`api/types.ts:22`).
When it is a function, there is no field the engine knows how to write, so an engine-generated id
has nowhere to live. Fabricating one would require the engine to own row identity, which `trackBy`
explicitly delegates.

Rejected: making identity immutable and doing remove-then-add on save — the row visibly disappears
and reappears at the worst possible moment, losing focus and scroll anchoring. Also rejected: a
library-owned "pending row" lifecycle, which would require the engine to know about save round
trips, deliberately kept out by D1 and D18 (editing decisions).

**What this obliges us to spec — the identity swap.** When the server's id replaces the temp id,
every structure keyed by `RowId` is affected:

| Keyed by `RowId` | Effect of the swap |
|---|---|
| `editing` Map (editing decisions D17) | entry is orphaned under the old key — the row silently leaves edit mode |
| `@for (… track row.id)` | Angular destroys and recreates the `<tr>`; focus inside it is lost |
| expansion / future selection state | same orphaning as the editing Map |
| `sourceIndex` (editing decisions D23) | self-correcting — `indexById` is a `computed` over `data`, so it rebuilds |

**Recommended save order, which makes the orphaning harmless:**

```ts
const saved = await this.service.save(row);
table.editing.update(endEdit(row.id));          // exit edit under the OLD id first
table.value.update(patchRow(row.id, saved));    // then swap in the server's id
```

Ending the edit before the swap means nothing is keyed by the temp id when it disappears, and the
`<tr>` teardown happens on a row that no longer holds focus.

**Open:** whether the table should *enforce* that order, detect an orphaned key and migrate it, or
simply document the sequence. Tracked as O20.

## D27 — `at` is `splice` semantics; omitted means append (2026-08-13)

**Decision:** Closes the `at` gap left open by D19. `addRow(row, { at })` inserts into `data` with
exactly `Array.prototype.splice(at, 0, row)` behavior, and omitting `at` appends.

| `at` | Behavior |
|---|---|
| omitted | append — matches `push`, and matches where new things go in every list API |
| in range | insert before the row currently at that index |
| `>= length` | clamped to the end (append) |
| negative | counts from the end — `-1` inserts *before* the last row |
| `< -length` | clamped to 0 (prepend) |

Verified against the runtime, not asserted from memory: `[1,2,3]` with `at: -1` gives
`[1,2,X,3]`; `at: 999` and `at: -999` clamp to append and prepend respectively.

**Never throws.** An index computed from an async result can legitimately go stale; clamping
degrades to a cosmetic misplacement instead of a crash.

**Documentation trap:** `splice(-1, …)` and `at(-1)` disagree — `at(-1)` *returns* the last element,
`splice(-1, 0, x)` inserts *before* it. Insertion follows `splice`. Do not describe this as "`at()`
semantics" in the public docs.

**Consequence:** the add-blank-row-then-fill flow passes `{ at: 0 }` explicitly rather than relying
on the default, since append puts the new row off-screen in a long table.

## D30 — Writes move onto the store as members; `data` slice renamed `value` (2026-08-19)

**Decision:** Supersedes D12 (mutation decisions) and D16 (editing decisions). The free-function,
store-first call convention (`updateRows(table, updater)`, `updateColumns(table, updater)`,
`updateEditing(table, updater)`) is replaced by per-slice members on the store, each shaped like
a `WritableSignal` (`()` read, `.update()`/`.set()` write):

```ts
table.value.update(addRow(newRow, { at: 0 }));
table.value.update(patchRow('42', { status: 'done' }));
table.value.update(removeRow('42'));
table.columns.update(reorderColumns(ids));
table.editing.update(beginEdit('42'));
```

The row-data slice is exposed as `table.value`, not `table.data` — `data` stays the name of the
input parameter (`createTable(data, config)`, D4), `value` is the store member, matching Signal
Forms' root-`Field` convention where `field().value` is the write surface and the model variable
passed into `form()` keeps its own name. `columns` and `editing` are separate concerns, not
sub-paths of `value` — they keep descriptive names; only the primary row-data slice gets the
generic `value`.

**Rationale — reopened via Signal Forms comparison:**
- `Field`/`FieldTree` is `() => FieldState`, not a bare `Signal`; `FieldState.value` is the actual
  writable surface (`nameForm().value.set(...)`), and it lives **on the field**, not on a raw
  signal the consumer holds separately. D12's "store keeps no write methods" modeled the wrong
  precedent (`patchState`, a single free function over one store) — the closer, already-adopted
  precedent (D15) is Signal Forms, which puts the write surface on the object being read, not
  beside it.
- Table has three independent slices (`value`/`columns`/`editing`), not one root model — ruled
  out mirroring `field().value` at the *table* level (`table().value.update(...)`) since that
  would force synthesizing one root object across slices, including the optional `editing` slice
  (D8/D10: only present when `withRowEdit()` is composed), breaking tree-shaking and the
  additive-feature-members model. Chose flat per-slice members instead of the full
  callable-plus-`.value` `Field` shape — table members are plain `WritableSignal`-shaped
  directly, no extra `()` call layer.
- D6's core rationale is **unchanged**: updater factories (`addRow`, `patchRow`, `removeRow`,
  `beginEdit`, `revertEdit`, `endEdit`, `reorderColumns`, `toggleColumnVisibility`, ...) stay
  free, pure functions — tree-shakeable, unit-testable without a store. Only the call-site
  wrapper moves off the free function (`updateRows(table, updater)`) onto the member
  (`table.value.update(updater)`).

**Consequences:**
- `api/update-columns.ts`, `api/row-mutations.ts`, `api/row-edit-mutations.ts` — the
  `updateRows`/`updateColumns`/`updateEditing` free-function wrappers are removed; updater
  factories they export stay.
- `engine/core.ts` — `TableCore` gains `value` (renamed from the internal `data` reference,
  wrapping the consumer's signal with `.update()`/`.set()` that resolve `trackBy` internally for
  id-based updaters) and a `columns` member with the same wrapper shape, folding into
  `baseColumns` internally. `rows`/`renderRows` are untouched — pure derived reads, no write
  surface, same as a computed `Field` path is never writable.
- `withRowEdit()` — its `editing` member changes from `.asReadonly()` to the same
  `WritableSignal`-shaped wrapper, closing over `trackBy` the same way `value` does.
- Every call site (`directives/`, demos, `D18`/`D26` examples in the editing decisions) moves
  from `updateX(table, updater)` to `table.slice.update(updater)`. `CLAUDE.md`'s "every write is
  a free function taking the store first" line goes stale — needs rewriting to describe the
  per-slice member shape.
- D16 and D18's row-actions example and D26's recommended save order are updated in place (this
  edit) rather than left to visibly disagree with the new decision.

## Open — carried forward

- **O6** Does a `rowsChanged` event fire on `updateRows`, or is the signal the only notification?
- **O8** Compile-time feature dependencies have no mechanism post-migration (`composed` is
  untyped). Affects `withGrouping`→`withExpansion` today, and any dependency `withRowEdit()`
  wants to declare (editing decisions). Separate track — an engine regression, not specific to
  this cluster.
- **O20** *(from D26)* On an id swap, does the table enforce the end-edit-first order, detect
  an orphaned `editing` key and migrate it, or just document the sequence?

**Resolved:** O1→D3, O5→D9 (mechanism resolved in editing decisions D20/D24/D25), O7→D19,
O9→D12, D19's `at` gap→D27, temp-id gap→D26.

**Editing-cluster decisions and opens** (D10, D13–D18, D20–D25, D28, D29; O2–O4, O10–O19, O21)
moved to [`work/with-row-editing/2-decisions.md`](../with-row-editing/2-decisions.md).
