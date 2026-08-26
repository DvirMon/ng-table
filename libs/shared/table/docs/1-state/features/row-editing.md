---
title: State Layer Reference — Row Editing
type: architecture
version: 1.0
date: 2026-08-25
status: shipped — E1–E4, E2b, E5' delivered; keyboard/a11y unstarted (see 5-gaps.md)
audience: developers
parent: ../architecture.md
---

# Row Editing

## Executive Summary

Editing is **two shapes, not one feature**, and the difference matters before any code is
written:

| Shape | Composes | When |
|---|---|---|
| **Live table** — every row is always editable | *nothing* — no editing feature at all | the default; start here |
| **Gated table** — rows show text until Edit opens them | `withRowEdit()` | Cancel/revert affordance, or a button-triggered mode |

Most editable tables are the first. `withRowEdit()` is an addition, not the entry point — a
consumer who reaches for it by default composes a feature they do not need (D29).

The state layer never builds, owns, or wraps a form (D1). The consumer creates
`form(data)` with Angular Signal Forms and keeps its full surface. This library tracks *which
rows are open* and *what to restore on Cancel* — nothing else.

Decision log: [`work/with-row-editing/2-decisions.md`](../work/with-row-editing/2-decisions.md).
Prioritized gaps: [`work/with-row-editing/5-gaps.md`](../work/with-row-editing/5-gaps.md).
Builds on [`row-mutations.md`](../row-mutations.md).

---

## 1. The Live Table — the starting point (D22/D24/D29)

One array form over the same signal `createTable` reads. No adapter, no bridging layer, no
editing feature:

```ts
readonly data  = signal<Person[]>(people);
readonly table = createTable(this.data, () => ({ trackBy: 'id', columns }));
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

**Observed, not inferred.** E2 (`apps/demo/src/app/table-edit-demo/`) instruments `data()`
emissions with a counter beside a live-value/committed-value column pair. `debounce(field,
'blur')` holds the boundary; `debounce(field, 0)` commits immediately.

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
import { NgpTableRowFieldDirective } from '@acme/table/forms';
```

```html
<td *ngpTableRowField="row; from: rows; let field">
  <input [field]="field.name" />
</td>
```

Guard and bind in one line. Its `ngTemplateContextGuard` asserts the narrowed
`FieldTree<TRow>` **once, at the directive boundary**, which is precisely what killed the
resolver-function form.

**Secondary entry point, deliberately.** `@acme/table/forms`, never the root barrel — a consumer
who never edits never resolves `@angular/forms` through this library, even at type level.

---

## 2. `withRowEdit()` — the gated table

Composed only when the consumer needs a **revert/Cancel affordance**, or a **button-triggered
mode** where rows render inputs conditionally.

```ts
createTable(data, () => ({
  trackBy: 'id',
  columns,
  features: [withRowEdit<Person>()],
}));
```

### Config

```ts
interface WithRowEditConfig {
  /** Default `false` (D14): opening a second row closes whatever was open. */
  multiple?: boolean;
}
```

### State shape

```ts
interface RowEditMembers<TRow> {
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  readonly pending: Signal<ReadonlySet<RowId>>;
}
```

Two sets of ids, each with exactly one meaning:

| Member | Meaning | Read by |
|---|---|---|
| `editing` | rows **open** for editing | templates, to decide which rows render inputs |
| `pending` | rows **closed** with an optimistic save in flight, still rollback-able | templates, to render a saving/spinner state |

Both are read the same way: `table.editing().has(row.id)`.

### Underneath: restore points and open ids (D31.5)

The snapshots themselves are internal. The updater state splits on the two facts that actually
vary independently:

```ts
interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;   // one restore point per row
  readonly open: ReadonlySet<RowId>;       // which of them are showing inputs
}

type RowSnapshot<TRow> = TRow | typeof ABSENT;
type SnapshotMap<TRow> = ReadonlyMap<RowId, RowSnapshot<TRow>>;
```

`ABSENT` is a sentinel: the row did not exist in `data` when `beginEdit` captured it (D28) — the
blank-row-add flow.

**`pending` is derived, not stored** — `snapshots` minus `open`. That is why closing a row
optimistically is a single `open.delete(id)` with nothing to move, and why a row can never be
open and pending at the same time. **Invariant:** `open` is always a subset of `snapshots`' keys.

**One restore point per row, not one per state.** Cancelling an open row and rolling back a
failed optimistic save read the same entry — they were never two recovery mechanisms.

**The consequence worth knowing:** closing a row *without* `keepSnapshot` deletes its restore
point deliberately. Leaving it would mean "not open, still held" — the definition of pending —
and would arm a rollback for a save nobody started. `clearEditing()` and the single-mode trim
both carry this.

**A snapshot holds a value, never an index.** This is why rollback covers update and create but
not delete or move — see [O22](../work/with-row-editing/2-decisions.md) and G5 in the gap
register.

### Writing

Every write goes through the one view, including updaters that only touch `pending`:

```ts
table.editing.update(beginEdit(id));
```

No verbs on the store (D16/D30). Updater factories are free, pure functions — tree-shakeable and
unit-testable without a store.

### The seven updaters

| Updater | Effect | No-ops when |
|---|---|---|
| `addNewRow(row, { at? })` | adds the row to `data` **and** opens it, restore point = the row itself (D36) | the id is already in `data` |
| `beginEdit(id)` | opens the row, capturing its current value — or `ABSENT` if the id is not in `data` | already open |
| `endEdit(id)` | closes the row, keeping whatever is in `data`, spending the restore point | not open |
| `endEdit(id, { keepSnapshot: true })` | closes the row, **holding** the restore point — the row becomes pending | not open |
| `revertEdit(id)` | restores the snapshot into `data` and closes it; removes the row instead if the snapshot is `ABSENT` | no restore point |
| `rebaseEdit(id, row?)` | moves an **open** row's restore point forward | not open |
| `settleEdit(id)` | drops a **pending** row's restore point — the server confirmed | open, or not held |
| `clearEditing()` | closes every open row, dropping their restore points; leaves pending rows alone | nothing open |

Everything no-ops on a miss rather than throwing, uniformly.

**`beginEdit` never re-captures** (D31.1). A row that already has a restore point keeps it —
whether it is a second `beginEdit` on an open row or a pending row re-opening. Cancel therefore
returns to the true pre-edit state rather than an unconfirmed optimistic one: the oldest restore
point wins, which is what Cancel means to a user. Moving one forward is `rebaseEdit`'s job.

**Save is composed, never a store verb:**

```ts
table.value.update(patchRow(id, values));
table.editing.update(endEdit(id));
```

---

## 3. Flows

### Cancel an edit

```ts
table.editing.update(beginEdit(id));    // snapshot captured
// … user types; debounce commits to `data` on blur …
table.editing.update(revertEdit(id));   // snapshot written back, entry dropped
```

### Add a blank row (D35/D36)

```ts
table.editing.update(addNewRow({ id: crypto.randomUUID(), ...blank }, { at: 0 }));
// … user types; Cancel:
table.editing.update(revertEdit(id));            // resets — row stays, blanked back out (default)

// or, to discard the row instead — composed explicitly, the same shape Save uses:
table.value.update(removeRow(id));
table.editing.update(endEdit(id));
```

One write to add. The row appears and is open, and its restore point is **the row itself** — the
same mechanism `beginEdit` uses on an existing row (D36). `addNewRow` and the `addRow` →
`beginEdit` two-call sequence are now behaviorally identical; `addNewRow` is purely the
one-call ergonomic form, not a separate intent. Plain `revertEdit(id)` therefore **resets**.

**`revertEdit` stays a pure revert — it does not take a discard option.** D36 first tried
`revertEdit(id, { discard: true })`, then walked it back: `revertEdit`'s only job is "go back to
the snapshot," and a discard is not a revert, it is a different operation. A consumer who wants
Cancel to remove a row composes it themselves — `removeRow` (core, `data` only) + `endEdit`
(closes the editing entry) — mirroring how Save is already composed (`patchRow` + `endEdit`),
not a variant of Cancel.

**Why `addNewRow` lives on `table.editing` and not beside `addRow`.** Only an `EditingUpdater`
can write both slices: its context carries `writeData`, while a `RowUpdater` returns an array
and has no handle on editing state. That asymmetry is deliberate — `withRowEdit()` is opt-in, so
core mutations cannot depend on it. The dependency runs plugin → core, never back.

D28 originally spelled discard-vs-reset as two add-time call sequences differing only in order,
which selected the behavior silently, with no error in either direction. D35 fixed the ordering
hazard for the discard path with `addNewRow` (forcing snapshot `ABSENT`), but that re-coupled
the Cancel outcome to *how the row was added*. D36 removes that coupling: `addNewRow` always
captures a real snapshot, so `revertEdit` always resets; discard is an explicit compose at the
call site that knows it wants one, same as any other row removal.

`ABSENT` is unaffected by this — it still exists, and `revertEdit` still discards unconditionally
when the snapshot is `ABSENT` (nothing to restore to). That case now only arises from `beginEdit`
on an id not yet in `data`, or `rebaseEdit` re-reading a since-removed row — not from `addNewRow`.

### Pessimistic save — needs none of the pending machinery

```ts
try {
  await this.service.save(row);
  table.editing.update(endEdit(id));
} catch {
  table.editing.update(revertEdit(id));
}
```

The row stays open for the whole round trip; the entry is alive throughout.

### Optimistic save (D31)

Close the row before the server answers:

```ts
table.editing.update(endEdit(id, { keepSnapshot: true }));   // closes it; row becomes pending
try {
  await this.service.save(row);
  table.editing.update(settleEdit(id));                      // confirmed; drop the rollback
} catch {
  table.editing.update(revertEdit(id));                      // rolls back from `pending`
}
```

**Why the row leaves `editing` rather than lingering in it:** `editing` is what templates read to
decide which rows render inputs. A pending row has visually closed, so leaving it there renders
a stuck editor until `settleEdit` runs — and only on the success path, the one least likely to be
tested. A forgotten `settleEdit` still leaks, but degrades to a stale spinner rather than a row
the user cannot interact with.

**Covers update and create.** Create comes free: the snapshot is `ABSENT`, so rollback removes
the row. **Delete and move are not covered, structurally** — see G5.

**Known sharp edge, left to the consumer:** if the user re-opens a pending row and the in-flight
save then fails, `revertEdit` fires on a row they are actively typing in. The library does not
suppress it — it cannot know whether the failure or the new input should win.

### External write while a row is open (D34)

The library does not detect a stale snapshot, because it cannot tell an external write from any
other `data` change. The consumer knows when they wrote, so they say so:

```ts
table.editing.update(rebaseEdit(id));        // re-read data() as the new restore point
table.editing.update(rebaseEdit(id, row));   // set an explicit one, e.g. the server's response
```

**Default is "revert wins":** absent any `rebaseEdit`, `revertEdit` restores what `beginEdit`
captured. No machinery watches `data`; no per-row subscription exists. The two rejected policies
become consumer-implementable — *refresh wins* is `rebaseEdit(id, incoming)` at the write site,
*detect and drop* is comparing and calling `endEdit` instead of `revertEdit`.

---

## 4. Single vs. Multiple (D14 / D31.2)

Default is single. Opening row B while row A is open **closes A the way `endEdit` does** —
whatever blur already committed to `data` stands.

**Why Save and not Cancel:** under D24 the user's typed value was already committed on blur and
visible in the row before they clicked away. Silently reverting it is the surprise, not keeping
it.

Prior art agrees: MUI X DataGrid allows one row in edit mode and commits on click-away (Escape
reverts); AG Grid `editType: 'fullRow'` likewise permits one row at a time.

`{ multiple: true }` is kept to cover bulk-edit tables without a later API change, with two
costs carried explicitly:

- no reference implementation to copy — the semantics are ours alone;
- **`multiple: true` + optimistic save is undesigned and unsupported** — N open rows × M
  in-flight saves. Whoever specs bulk edit resolves it first.

---

## 5. What This Feature Does Not Do

- **Detects no triggers.** No blur listener, no change-event hook, no dirty checking.
  "Editing" has exactly one definition: membership in the `editing` map. Trigger policy is
  entirely the consumer's — click, `focusin`/`focusout`, server-confirmed, whatever they wire.
- **Owns no form** (D1). No `withEditing()` that constructs a field tree.
- **Owns no row actions** (D18). No `withRowActions()`, no registry, no directive — every
  operation an action could perform is already expressible through the updaters. The consumer
  writes the actions cell.
- **Ships no keyboard handling.** No Escape-to-cancel, no Enter-to-save. Both references bind
  Escape; we bind nothing. UI-layer work — G1.
- **Holds no validation state.** The form owns dirty/touched/validity. Note
  `FieldState.reset(value?)` resets touched/dirty **only**, never the data — which is exactly
  why the snapshot map has to exist.

---

## 6. Demos

| Demo | Shows |
|---|---|
| `apps/demo/src/app/table-edit-demo/` | E2 — the live table, composing **no** editing feature (D29). Instruments the `debounce` commit boundary. |
| `apps/demo/src/app/table-row-field-demo/` | E5' — `*ngpTableRowField` |
| `apps/demo/src/app/table-row-edit-demo/` | E2b — gated Edit/Save/Cancel, blank-row add, optimistic save |

`table-edit-demo` must keep composing no editing feature. It is the D29 reference; turning it
into a mode toggle would delete the only demonstration that the minimal table needs nothing.

---

## 7. Accepted Costs

- **A bounded second copy of row data** — only for rows currently open or pending, never the
  whole set.
- **N field nodes for N rows**, independent of pagination or virtual scroll, since the form is
  over `data` rather than over rendered rows.
- **Structural mutation misattributes field state.** Signal Forms arrays are index-keyed with no
  identity hook, so removing row 3 makes its dirty/touched become row 4's. Upstream limit, no
  local fix.
- **Expansion children have no `sourceIndex`.** `indexById` is built from `data()`'s top-level
  entries only, so a nested child's index is `undefined` and the directive renders nothing for
  it. Pre-existing; editing surfaces it. G6.

---

## Open Questions

- [ ] **O11** — does `withRowEdit()` fire a `rowEditChanged` event, or is the signal the only
      notification? Same question as O6 (mutations) — decide both together.
- [ ] **O19** — do we export an `editableRow(row, columns)` schema fragment so the commit
      boundary is one call instead of per-column discipline? Independent of the directive.
- [ ] **O22** — is optimistic rollback an editing concern or a mutation concern? Deliberately
      not designed; re-derive when a consumer needs optimistic delete. G5.
- [ ] **O17** — `applyEach` validates rows the user cannot see, so `valid()` can be false because
      of row 4,000. Phantom until filtering or pagination exists.
- [ ] **O15 / O16** and **D25** (filter retention) — phantom; `withFiltering()` does not exist.
      Re-derive against that code rather than implementing from the notes.
