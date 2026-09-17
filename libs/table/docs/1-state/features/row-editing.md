---
title: State Layer Reference — Row Editing
type: architecture
version: 2.1
date: 2026-08-27
capability: row-editing
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# Row Editing

## Executive Summary

Editing is **three shapes, not one feature**, and the difference matters before any code is
written:

| Shape | Composes | When |
|---|---|---|
| **Live table** — every row always editable | *nothing* | the default; start here |
| **Live + rollback** — always editable, saves can fail | `withOptimistic()` | an async save that must be undoable |
| **Gated table** — rows show text until Edit opens them | `withRowEdit()` | a Cancel affordance, or a button-triggered mode |

Most editable tables are the first. Neither feature is the entry point — a consumer who reaches
for one by default composes state they do not need (D29, narrowed by D39).

The state layer never builds, owns, or wraps a form (D1). The consumer creates `form(data)` with
Angular Signal Forms and keeps its full surface. This library tracks **which rows are open** and
**what to restore when a write has to be undone** — nothing else.

**The one idea behind the split:** a restore point and an open row are different facts. A gated
table has both. A live table has only the first — its edit session is delimited by focus, not by
a button, so there is nothing to open. Optimistic rollback is therefore not an editing feature
that a live table has to fake its way into; it is its own feature that editing composes (D37).

The two-feature split (D37–D44) landed 2026-08-26; optimistic CRUD (D45–D49) landed 2026-08-27.

Prior decision logs: [`work/with-row-editing/`](../work/with-row-editing/2-decisions.md) (D10–D36),
[`work/with-mutations/`](../work/with-mutations/2-decisions.md). Gap registers, split by owning
layer: [`work/with-row-editing/5-gaps.md`](../work/with-row-editing/5-gaps.md) (state — verb names
there are still v1.0) and
[`3-ui/work/row-editing/5-gaps.md`](../../3-ui/work/row-editing/5-gaps.md) (keyboard, focus, a11y,
save-gating). Builds on [`row-mutations.md`](../row-mutations.md).

---

## 1. The Live Table — the starting point (D22/D24/D29)

One array form over the same signal `createTable` reads. No adapter, no
bridging layer, no editing feature:

```ts
readonly data  = signal<Person[]>(people);
readonly table = createTable(this.data, { trackBy: 'id', columns });
readonly rows  = form(this.data, (path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');   // text: commits when the user leaves the cell
    debounce(row.dept, 0);        // select: commits immediately
  })
);
```

`form(model: WritableSignal<TModel>)` requires exactly the contract `createTable` requires (D4).
**Two writers on one signal is not two sources of truth** — neither side keeps a copy, so form
edits flow into `data`, the pipeline recomputes, and table mutations flow back into `data` where
the field tree reconciles.

### The commit boundary is `debounce()` (D24)

A field carries two values: `controlValue` (what the input holds, never debounced) and `value`
(what reaches the data model, and *is* debounced).

Typing therefore never touches `data`, so the pipeline never reruns, so **the row cannot move
under the cursor** — without the engine knowing anything about editing. On blur, `data` updates
once and the row relocates. A dropdown commits on change and the row jumps groups immediately,
which is the intended UX.

This also answers "user clicks sort while a row is open": `data` still holds the pre-edit value,
so the row sorts by its old value and stays put. Falls out of the model rather than needing a
rule.

**Observed, not inferred.** `src/stories/live-table/` and `apps/demo/src/app/table-edit-demo/` (acme monorepo)
instrument `data()` emissions with a counter beside a live-value/committed-value column pair.
`debounce(field, 'blur')` holds the boundary; `debounce(field, 0)` commits immediately.

**Binds the editing path to Signal Forms.** A consumer using `[(ngModel)]`, or writing to `data`
from an `(input)` handler, gets jumping rows and this library has no answer for them.

**Non-live tables (button, then Save)** use a custom `Debouncer` — a promise resolving on the
Save click — instead of `'blur'`. Same primitive, different resolution trigger.

### Per-cell readonly/disabled

Consumer schema, not column config and not store state: `applyEach` + `disabled()` /
`applyWhen`. No `ColumnDef` field exists for this and none is planned.

### Reaching a row's field node (D23)

The form is indexed over `data`; the template iterates `renderRows()`. The engine bridges them
with `RenderRow.sourceIndex`:

```ts
interface RenderRow<TRow> {
  /** Index into `data()`. `undefined` for synthesized rows (`kind: 'group'`). */
  readonly sourceIndex?: number;
}
```

**The engine derives it; no feature stamps it.** Computed after the render-row builder returns,
from `data` + `trackBy` — so `withGrouping()` cannot forget it or get it wrong, because it never
touches it. Nothing to synchronize, no staleness window.

A resolver function (`fieldFor(form, table, rowId)`) was rejected: its signature would force
`MaybeFieldTree` into the public API types, leaking `@angular/forms/signals` into a library that
has no forms dependency.

Raw form:

```html
@if (row.sourceIndex !== undefined) {
  <td><input [field]="rows[row.sourceIndex].name" /></td>
}
```

Folded, via the optional directive (D33):

```ts
import { NgpTableRowFieldDirective } from '@ngp/table/forms';
```

```html
<td *ngpTableRowField="row; from: rows; let field">
  <input [field]="field.name" />
</td>
```

Guard and bind in one line. Its `ngTemplateContextGuard` asserts the narrowed `FieldTree<TRow>`
**once, at the directive boundary**, which is precisely what killed the resolver-function form.

**Secondary entry point, deliberately.** `@ngp/table/forms`, never the root barrel — a consumer
who never edits never resolves `@angular/forms` through this library, even at type level.

---

## 2. `withOptimistic()` — rollback without an edit session (D37/D39)

Composed when writes go to a server that can reject them, and the table must be able to put a
row back the way it was. Requires no notion of a row being "open", so a live table can use it.

```ts
createTable(data, { trackBy: 'id', columns }, withOptimistic());
```

No config.

### The edit session is the focus session (D39)

A live table is not "always in edit mode" from the state layer's point of view. The **focused
row is the row being edited**, and that session begins and ends without anything opening or
closing:

```ts
onFocus(id)  { table.editing.update(captureEdit(id)); }
onBlur(id, partial) {
  table.value.update(patchRow(id, partial));
  this.save(id, partial).then(
    ()  => table.editing.update(releaseEdit(id)),
    () => table.editing.update(revertEdit(id)),
  );
}
```

Two things fall out. Focus is inherently single-row, so D31.2's *"`{ multiple: true }` combined
with optimistic save is undesigned"* narrows to the gated table only. And nothing here detects a
trigger — the consumer wires focus and blur themselves (D43, and see §7).

### Scope — update, create, and delete; never move (D45)

A restore point carries its **position** as well as its value (D45), so `withOptimistic()` now
covers optimistic CRUD short of move:

| Operation | Covered | Why |
|---|---|---|
| update | ✅ | the restore point is the prior row |
| create | ✅ | the restore point is the inserted row itself |
| delete | ✅ *(new, D45–D47)* | the restore point carries `at`; `revertEdit` re-inserts there if the row is gone |
| move | ❌ | position is captured, but no verb re-orders — G5 narrows to move only |

`removeEdit(id)` (D47) is the delete entry point: it captures a restore point (if none is held)
and removes the row in one write, so `revertEdit(id)` alone undoes the delete. See §4.

**G5 partially closes.** D37 took the *ownership* half of O22 (rollback is its own feature); D45
takes the *representation* half for delete (a restore point can hold a position). What is still
open is a verb to represent and undo a **move**, which needs a different representation again —
see the gap register.

**Why there is no `insertEdit`.** The family's asymmetry is principled, not an oversight.
Capture exists to preserve information that would otherwise be lost — deleting a row loses its
values and position, so `removeEdit` must snapshot them first. Inserting loses nothing: the prior
state *is* nothing, and undoing an insert needs only the row's id, which the caller already holds
because it supplied it (D26). An optimistic create is therefore complete as `table.value.update(insertRow(copy, { at }))`,
rolled back on rejection with `table.value.update(removeRow(copy.id))` — no capture-composing verb
needed. See [`work/with-duplicate-row/1-design.md`](../work/with-duplicate-row/1-design.md) for
the fuller writeup (this was surfaced while designing duplicate-a-row).

### State shape

```ts
interface OptimisticMembers<TRow> {
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  readonly pending: Signal<ReadonlySet<RowId>>;
}
```

| Member | Meaning | On a live table |
|---|---|---|
| `editing` | rows **open** for editing | **always empty** — nothing opens rows |
| `pending` | rows holding a restore point that is not open | every in-flight save |

`table.editing()` returning an empty set on a live table is intended, not a defect: nothing is
open. `pending()` is the read a live table uses.

---

## 3. `withRowEdit()` — the gated table (D37)

Composed when the consumer needs a **Cancel affordance** or a **button-triggered mode** where
rows render inputs conditionally. It builds the same `createEditingStore()`
`withOptimistic()` builds and adds the open set on top — it does not compose the other feature.

```ts
createTable(data, { trackBy: 'id', columns }, withRowEdit({ multiple: () => isWide() }));
```

Composing both explicitly **throws at construction**
([ADR-0007](../../adr/0007-feature-member-claims.md), and its 2026-09 amendment on claimant
labels) — in either argument order, since a duplicate member claim is not order-sensitive:

```ts
createTable(data, config, withOptimistic(), withRowEdit());
// [createTable] feature 1 (withOptimistic) and feature 2 (withRowEdit) both provide the
// "editing" store member. Only one feature may provide each member.
```

### Why the two features are built on one editing store

Each editing feature builds its own instance of `createEditingStore()`; `withRowEdit()` adds the
open set on top, `withOptimistic()` stops at the restore points. The justification is **one set of
restore points per table**, so a rollback finds the snapshot the capture wrote. Two independent
snapshot signals is exactly ADR-0007's motivating failure — `table.editing.update(captureEdit(id))`
writes one, `table.pending()` reads the other, and rollback silently does nothing.

Order-independence is **not** the justification, and has not been since the member claim landed:
composing both is a collision, not a sharing arrangement. The finding is recorded on
[#40](https://github.com/DvirMon/ng-table/issues/40) — that issue's AC 2 text ("works in either
order") was stale at close, and the observable contract is the throw above.

### Config

```ts
interface WithRowEditConfig {
  /** Default `false` (D14): opening a second row closes whatever was open. Accepts a plain
   * accessor (`() => isWide()`) to react live; a `Signal<boolean>` works too. */
  multiple?: boolean | (() => boolean);
}
```

### Members

`RowEditMembers<TRow>` extends `OptimisticMembers<TRow>` and adds nothing. **One door**: both
compositions expose `table.editing`, and there is no separate `table.optimistic` slice.

### Underneath: restore points and open ids (D31.5)

The snapshots themselves are internal. The updater state carries the two facts that vary
independently — and which feature writes which is exactly what the split settles:

```ts
interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;   // withOptimistic
  readonly open: ReadonlySet<RowId>;       // withRowEdit
}

interface RowRestorePoint<TRow> {
  readonly row: TRow;
  readonly at: number;        // index in `data` at capture time (D45)
  readonly detached: boolean; // captured by a verb that then removed the row (D45)
}
type RowSnapshot<TRow> = RowRestorePoint<TRow>;
type SnapshotMap<TRow> = ReadonlyMap<RowId, RowSnapshot<TRow>>;
```

**`ABSENT` is gone (D46, breaking).** Every restore point now holds a real row value; "captured
nothing" is expressed by *not* writing an entry to `snapshots` rather than by a sentinel. `at` is
read only when the row is missing at revert time — a row still present is replaced in place,
since a sort or another write may have moved it. `detached` distinguishes "removed deliberately,
restore point held on purpose" from "left `data` for some other reason, nothing to restore" —
ADR-0006 pruning exempts it (D45).

**`pending` is derived, not stored** — `snapshots` minus `open`. That is why closing a row
optimistically is a single `open.delete(id)` with nothing to move, and why a row can never be
open and pending at once. **Invariant:** `open` is always a subset of `snapshots`' keys.

**One restore point per row, not one per state.** Cancelling an open row and rolling back a
failed optimistic save read the same entry — they were never two recovery mechanisms.

### Row removal reconciliation (ADR-0006, split by D37)

An id that leaves `data` must leave both slices, and each feature prunes its own:

| Slice | Pruned by | Exemption |
|---|---|---|
| `open` | `withRowEdit` | none |
| `snapshots` | `withOptimistic` | `ABSENT` entries (D28) — never backed by a row to begin with |

`pending` needs no pruning; it is derived from the other two.

---

## 4. The nine updaters

Every write goes through the one view — there are no verbs on the store (D16/D30). Updater factories are free,
pure functions: tree-shakeable, and unit-testable without a store.

```ts
table.editing.update(beginEdit(id));
```

### `withOptimistic` — available on both shapes

| Updater | Effect | No-ops when |
|---|---|---|
| `captureEdit(id, row?)` | captures a restore point, **overwriting** any existing one. Omit `row` to re-read `data()` | neither `row` nor a `data()` lookup finds the row |
| `releaseEdit(id)` | drops the restore point — the server confirmed, nothing left to undo | no restore point held |
| `revertEdit(id, row?)` | restores the snapshot into `data` if the row is still present; **re-inserts it at its captured index if it was removed** (D45). `row` overrides what gets written, `at` still comes from the snapshot. Closes the row either way | no restore point held |
| `discardEdit(id)` *(D46)* | drops the restore point and removes the row — the discard path, counterpart to `revertEdit`. One call, replacing the old `removeRow` + `endEdit` + `releaseEdit` sequence | no restore point held (OQ-C) |
| `removeEdit(id)` *(D47)* | captures a restore point if none is held (or flips an existing one's `detached` to `true`), then removes the row and closes it — one call, no prior `beginEdit`/`captureEdit` needed. `revertEdit(id)` undoes it | the id is not in `data` |
| `patchEdit(id, partial, { capture? })` *(D47)* | captures a restore point per `capture` (`'if-absent'` default, or `'always'`), then patches the row in place — for a write no form made (a row action, a background patch) | the id is not in `data` |
| `swapRowId(from, to)` *(D49)* | re-keys `from` to `to` in whichever of `open`/`snapshots` hold it — the temp-id → server-id swap on an optimistic create. Does not touch `data`; the caller writes the row's new identity there (e.g. via `patchRow`) in the same synchronous handler, before this call | `from` holds neither `open` nor a restore point |

`removeEdit`/`patchEdit` belong to `withOptimistic`, not `withRowEdit` — no `open` involvement
beyond `removeEdit` clearing it. Structural reason in D47: an `EditingUpdater` can write both
`data` and editing state in one call; a `RowUpdater` (`removeRow`/`patchRow`) cannot reach editing
state at all, so a `{ capture: true }` flag on either would have nothing to act on.

### `withRowEdit` — gated tables only

| Updater | Effect | No-ops when |
|---|---|---|
| `beginEdit(id, { insert?, at? })` | opens the row, capturing its value **only if none is held** (D31.1). `insert` adds the row to `data` first | already open; or `insert` collides with an existing id |
| `createRow(id, row, { at? })` | `beginEdit(id, { insert: row, at })` under the name a consumer writing the create path reaches for — same call, same no-op rule | same as `beginEdit` with `insert` |
| `endEdit(id)` | closes the row, keeping whatever is in `data` **and** its restore point — the row becomes `pending` | not open |
| `clearEdit()` | closes every open row and drops their restore points, in one write. Pending rows untouched | nothing open |

Everything no-ops on a miss rather than throwing, uniformly.

### Three rules worth internalizing

**`beginEdit` never re-captures; `captureEdit` always does** (D31.1/D40). A row that already has
a restore point keeps it under `beginEdit` — so Cancel returns to the true pre-edit state rather
than an unconfirmed optimistic one. The oldest restore point wins, which is what Cancel means to
a user. Moving one forward is `captureEdit`'s job, and that difference between two verbs is the
whole of what the former `rebaseEdit` flag expressed.

**`endEdit` and `releaseEdit` both take a required id** (D41). Neither has a bulk form. Closing
every row while keeping its restore point leaks all of them into `pending`; dropping every
restore point discards in-flight rollbacks, which on a live table — where nothing is ever open —
means a later rejection has nothing to roll back to and the rejected value stays on screen
silently.

**Two verbs are fused, for the same reason** (D44). `revertEdit` and `clearEdit` each do two
things in one write because their halves are not independently safe apart —
`clearEdit()` spelled as `endEdit()` + `releaseEdit()` closes every row first, leaving the
second call nothing to find, and every row leaks into `pending` forever.

**Save is composed, never a store verb:**

```ts
table.value.update(patchRow(id, values));   // only if nothing already committed the write —
                                             // a form-driven save with `debounce('blur')` (§1)
                                             // already wrote `data`, so this line is skipped there
table.editing.update(endEdit(id));
table.editing.update(releaseEdit(id));   // local-only save: nothing to confirm
```

**Every story in §8 is form-driven and skips the `patchRow` line** — `debounce('blur')` already
committed the value before Save runs, so the save path only closes and releases. `patchRow` is
for a save that writes through the table API directly (a row action, no form involved).

### Renamed in v2.0 / added in v2.1

| v1.0 | v2.0 | Note |
|---|---|---|
| `settleEdit(id)` | `releaseEdit(id)` | rename only; pairs with `captureEdit` as acquire/release |
| `rebaseEdit(id, row?)` | `captureEdit(id, row?)` | open-guard dropped, so it works on a live table |
| `addNewRow(row, { at })` | `beginEdit(id, { insert: row, at })` | D36 established these were never separate intents |
| `endEdit(id, { keepSnapshot: true })` | `endEdit(id)` | keeping is now the only behavior |
| `endEdit(id, { keepSnapshot: false })` | `endEdit(id)` + `releaseEdit(id)` | **two calls** — see the accepted cost in §9 |
| `clearEditing()` | `clearEditing()` | unchanged in v2.0 (D44); renamed to `clearEdit()` in v2.1 — see below |
| — | `captureEdit(id)` | new as a live-table entry point |
| `removeRow(id)` + `endEdit(id)` + `releaseEdit(id)` | `discardEdit(id)` *(v2.1, D46)* | **three calls → one** |
| — | `removeEdit(id)` *(v2.1, D47)* | new — the delete-with-rollback entry point |
| — | `patchEdit(id, partial, options?)` *(v2.1, D47)* | new — capture-composing patch for row actions/background writes |
| — | `swapRowId(from, to)` *(v2.1, D49)* | new — the temp-id → server-id swap on an optimistic create; closes G3 |
| `RowSnapshot<TRow> = TRow \| typeof ABSENT` | `RowSnapshot<TRow> = RowRestorePoint<TRow>` *(v2.1, D45/D46)* | **breaking** — `ABSENT` removed; every snapshot now holds a real value + position |
| `addRow(row, { at })` | `insertRow(row, { at })` *(v2.1)* | **breaking** — rename only; "insert" matches the `splice(at, 0, row)` semantics the name has always had |
| `clearEditing()` | `clearEdit()` *(v2.1)* | **breaking** — rename only; it was the sole verb using the gerund |

**The suffix rule, revised 2026-09-03:** naming follows the consumer's primary intent for the
call, not which internal slice the updater happens to reach. `*Edit` is for a verb whose point
*is* changing a row's editable status — opening it, closing it, reverting it. `*Row` is for a
verb whose point is the row's data or lifecycle from the consumer's side — create, patch, remove
— even when it also writes `snapshots`/`open` internally to keep a rollback story consistent.
That internal write is mechanism, not the thing the consumer is doing.

**What this settles for `createRow`:** its point is "add a row"; that it also captures/opens
internally (so a rollback exists and the row is immediately usable) is plumbing the name
shouldn't advertise. `*Row` is correct as named — no exception needed under the revised rule.

**What this reopens:** `removeEdit`/`patchEdit` were named `*Edit` under the old (touches-state)
rule despite their consumer-facing point being "remove a row" / "patch a row" — arguably a
clearer case than `createRow` was, since neither involves `open` in any way beyond `removeEdit`
clearing it. Not renamed here — flagged for a separate pass, since it's a breaking rename on
shipped verbs (`removeEdit` since D47/v2.1), not a new addition. `captureEdit`/`releaseEdit`/
`revertEdit`/`discardEdit` stay `*Edit`: their consumer-facing point genuinely is the rollback/
edit-session lifecycle itself, not row data.

---

## 5. Flows

### Cancel an edit — gated

```ts
table.editing.update(beginEdit(id));    // restore point captured
// … user types; debounce commits to `data` on blur …
table.editing.update(revertEdit(id));   // restored, closed, restore point spent
```

### Add a blank row (D42, formerly D35/D36)

```ts
table.editing.update(beginEdit(newId, { insert: { id: newId, ...blank }, at: 0 }));
// … user types; Cancel:
table.editing.update(revertEdit(newId));         // resets — row stays, blanked back out (default)

// or, to discard the row instead — one call (was three, pre-D46):
table.editing.update(discardEdit(newId));
```

One write to add. The row appears open, and its restore point is **the row itself** — the same
mechanism `beginEdit` uses on an existing row (D36). Plain `revertEdit(id)` therefore **resets**;
removal is an explicit compose at a call site that knows it wants one.

**`revertEdit` stays a pure revert.** D36 first tried `revertEdit(id, { discard: true })`, then
walked it back: `revertEdit`'s only job is "go back to the restore point," and a discard is not
a revert, it is a different operation.

D28 originally spelled discard-vs-reset as two add-time call sequences differing only in order,
which selected the behavior silently with no error in either direction. D35 fixed the ordering
hazard, D36 removed the residual coupling to *how the row was added*, and D42 folds the result
back into `beginEdit` now that it is provably not a separate intent.

**`ABSENT` is gone (D46).** The case it used to mark — `beginEdit` on an id not yet in `data`
without `{ insert }` (misuse), or `captureEdit` re-reading a since-removed row — now simply
captures no snapshot at all, rather than a sentinel one. `revertEdit` on such an id is a no-op
(no restore point held), not a discard.

### Delete with rollback (D45–D47) — new in v2.1

```ts
this.table.editing.update(removeEdit(id));   // captures + removes, one call
this.service.delete(id).subscribe({
  next:  () => this.table.editing.update(releaseEdit(id)),
  error: () => this.table.editing.update(revertEdit(id)),  // reappears at its old index
});
```

No prior `captureEdit`/`beginEdit` needed — `removeEdit` captures if nothing is held. Undo works
the same way: call `removeEdit` and simply never `releaseEdit`; `pending()` already reports it as
undoable. `revertEdit(id)` later reinserts it, closed (§4).

### Pessimistic save — needs none of the rollback machinery

```ts
try {
  await this.service.save(row);
  table.editing.update(endEdit(id));
  table.editing.update(releaseEdit(id));
} catch {
  table.editing.update(revertEdit(id));
}
```

The row stays open for the whole round trip.

### Optimistic save — gated (D31)

Close the row before the server answers:

```ts
table.editing.update(endEdit(id));            // closes it; row becomes pending
try {
  await this.service.save(row);
  table.editing.update(releaseEdit(id));      // confirmed; drop the rollback
} catch {
  table.editing.update(revertEdit(id));       // rolls back from `pending`
}
```

**Why the row leaves `editing` rather than lingering in it:** `editing` is what templates read to
decide which rows render inputs. A pending row has visually closed, so leaving it there renders a
stuck editor until `releaseEdit` runs — and only on the success path, the one least likely to be
tested. A forgotten `releaseEdit` still leaks, but degrades to a stale spinner rather than a row
the user cannot interact with.

**Known sharp edge, left to the consumer:** if the user re-opens a pending row and the in-flight
save then fails, `revertEdit` fires on a row they are actively typing in. The library does not
suppress it — it cannot know whether the failure or the new input should win.

### Optimistic save — live (D39)

No open/close at all:

```ts
table.editing.update(captureEdit(id));      // on focus
table.value.update(patchRow(id, partial));  // on blur
// server:
ok ? table.editing.update(releaseEdit(id))
   : table.editing.update(revertEdit(id));
```

`pending()` is every row in this state, since nothing is ever open.

### External write while a row is open (D34, now D40)

The library does not detect a stale restore point, because it cannot tell an external write from
any other `data` change. The consumer knows when they wrote, so they say so:

```ts
table.editing.update(captureEdit(id));        // re-read data() as the new restore point
table.editing.update(captureEdit(id, row));   // set an explicit one, e.g. the server's response
```

**Default is "revert wins":** absent any `captureEdit`, `revertEdit` restores what `beginEdit`
captured. No machinery watches `data`; no per-row subscription exists. The two rejected policies
become consumer-implementable — *refresh wins* is `captureEdit(id, incoming)` at the write site,
*detect and drop* is comparing and calling `endEdit` + `releaseEdit` instead of `revertEdit`.

---

## 6. Single vs. Multiple (D14 / D31.2)

Gated tables only — a live table's session is delimited by focus, which is inherently single
(D39).

Default is single. Opening row B while row A is open **closes A the way `endEdit` does** —
whatever blur already committed to `data` stands.

**Why Save and not Cancel:** under D24 the user's typed value was already committed on blur and
visible in the row before they clicked away. Silently reverting it is the surprise, not keeping
it.

Prior art agrees: MUI X DataGrid allows one row in edit mode and commits on click-away (Escape
reverts); AG Grid `editType: 'fullRow'` likewise permits one row at a time.

`{ multiple: true }` is kept to cover bulk-edit tables without a later API change, with two costs
carried explicitly:

- no reference implementation to copy — the semantics are ours alone;
- **`multiple: true` + optimistic save is undesigned and unsupported** — N open rows × M in-flight
  saves. Whoever specs bulk edit resolves it first (G4).

---

## 7. What This Feature Does Not Do

- **Detects no triggers** (D20, narrowed by D43). No blur listener, no change-event hook, no
  dirty checking in the engine. "Editing" has exactly one definition: membership in the state.
  A **directive the consumer places** may call `captureEdit` on focus and `patchRow` + `endEdit`
  on blur — that is consumer trigger policy expressed as a reusable directive, the same standing
  D18 gives row actions. No such directive ships yet; it scopes with G1/G9/G10, not separately.
- **Owns no form** (D1). No `withEditing()` that constructs a field tree.
- **Owns no row actions** (D18). Every operation an action could perform is already expressible
  through the updaters. The consumer writes the actions cell.
- **Ships no keyboard handling.** No Escape-to-cancel, no Enter-to-save. Both references bind
  Escape; we bind nothing. UI-layer work — G1.
- **Holds no validation state.** The form owns dirty/touched/validity. Note
  `FieldState.reset(value?)` resets touched/dirty **only**, never the data — which is exactly why
  the restore-point map has to exist.
- **Rolls back no moves.** Delete rollback shipped (D45–D47, §2); move still needs a verb and a
  different representation. §2, G5, O22.

---

## 8. Stories and demos

Storybook stories (`src/stories/`) are the primary reference; the demo app predates them.

| Story | Shows | Version |
|---|---|---|
| `live-table/` | S1 — the live table composing **no** feature (D29); per-row discard (`removeRow`) with a host-held undo slot covering both the last field commit and the last discarded row (§1.3, §3.2) | none |
| `live-optimistic/` | S6 — the live table + `withOptimistic()`, driven by focus/blur (D39); also the delete-with-rollback demo (D47) — `removeEdit`/`releaseEdit`/`revertEdit` against a simulated DELETE | new in v2.0, delete affordance added v2.1 |
| `gated-edit/` | S2 — Edit/Save/Cancel, blank-row add, Close all; `multiple` toggled live; Discard now one call (`discardEdit`, D46) | migrated, updated v2.1 |
| `optimistic-save/` | S4 — close-then-confirm, rollback on failure | migrated |
| `external-write/` | a server push under an open row, resolved with `captureEdit` | migrated |
| `form-write-mutations/` | writing rows through the form instead of the updaters, and what that skips | migrated |

| Demo (acme monorepo `apps/demo`) | Shows |
|---|---|
| `apps/demo/src/app/table-edit-demo/` | E2 — the live table, composing no editing feature (D29) |
| `apps/demo/src/app/table-row-field-demo/` | E5' — `*ngpTableRowField` |
| `apps/demo/src/app/table-row-edit-demo/` | E2b — gated Edit/Save/Cancel, blank-row add, optimistic save |

`live-table/` and `table-edit-demo` must keep composing **no** editing feature. They are the D29
reference; turning either into a mode toggle would delete the only demonstration that the minimal
table needs nothing. The live-optimistic path gets its own story (D39).

---

## 9. Accepted Costs

- **A local-only save is two calls, not one.** `endEdit(id)` + `releaseEdit(id)`. Between them the
  row reads as `pending`, so any UI bound to `pending()` shows a one-tick "saving" flicker on a
  table that never touches a server (D41). This is the price of optimistic-by-default.
- **A bounded second copy of row data** — only for rows currently open or pending, never the whole
  set.
- **N field nodes for N rows**, independent of pagination or virtual scroll, since the form is over
  `data` rather than over rendered rows.
- **Structural mutation misattributes field state.** Signal Forms arrays are index-keyed with no
  identity hook, so removing row 3 makes its dirty/touched become row 4's. Upstream limit, no local
  fix.
- **Expansion children have no `sourceIndex`.** `indexById` is built from `data()`'s top-level
  entries only, so a nested child's index is `undefined` and the directive renders nothing for it.
  Pre-existing; editing surfaces it. G6.

---

## Open Questions

- [x] **O22** *(narrowed by D37, delete half closed by D45)* — the **ownership** half was resolved
      by D37: rollback is its own feature. The **representation** half is resolved for delete: a
      restore point now carries a position (D45), so `removeEdit`/`revertEdit` cover it. What
      remains open is **move** — a position is captured but nothing re-orders, and undoing a move
      needs an inverse-operation representation this still doesn't have. G5 narrows to move only.
- [x] **O24** *(from D37)* — resolved 2026-09-03 by D49: `swapRowId(from, to)` is its own updater
      in `mutations/optimistic-mutations.ts`, re-keying both maps, owned by neither feature. Also
      resolves O20 (migrate the key; end-edit-first rejected). Implemented 2026-09-03; closes G3.
      Handoff: `work/swap-row-id/1-handoff.md`.
- [ ] **O11** — does the feature fire a `rowEditChanged` event, or is the signal the only
      notification? Same question as O6 (mutations) — decide both together.
- [ ] **O19** — do we export an `editableRow(row, columns)` schema fragment so the commit boundary
      is one call instead of per-column discipline? Independent of the directive.
- [ ] **O17** — `applyEach` validates rows the user cannot see, so `valid()` can be false because of
      row 4,000. Phantom until filtering or pagination exists.
- [ ] **O15 / O16** and **D25** (filter retention) — phantom; `withFiltering()` does not exist.
      Re-derive against that code rather than implementing from the notes.

---

## Competitive position

**Verdict: ahead** — the optimistic/gated split sharing one `EditingState` core, plus
`RowRestorePoint` making rollback structurally sound (including re-inserting a removed row at its
captured index), is a more considered answer to dirty tracking, rollback and undo than anything in
the four libraries, none of which has shipped one.

Full reasoning: [gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
