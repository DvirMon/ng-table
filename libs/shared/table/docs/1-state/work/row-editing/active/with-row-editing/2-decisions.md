---
title: Decisions — Row Editing (NGP Table state layer)
type: decisions
status: in-progress
date: 2026-08-11
---

# Decisions — Row Editing

Episodic work folder for the editing feature cluster: F1 editable cells, F2 edit UI modes,
F3 row actions, F5 dirty/validation/commit. Split out 2026-08-16 from
[`work/with-mutations/2-decisions.md`](../../archive/with-mutations/2-decisions.md), which retains the
mutation core this cluster builds on (`updateRows`, `addRow`/`removeRow`/`patchRow`, `at`
semantics, temp-id handling — shipped as issue #47). No issue filed for this cluster yet.

Decision numbering (D10, D13–D18, D20–D25, D28, D29) and open-question numbering (O2–O4,
O10–O19, O21) are unchanged from the original log, so cross-references elsewhere in the repo
still resolve.

**This file is the reasoning, not the contract.** The shipped surface is specced in
[`features/row-editing.md`](../../../../features/row-editing.md); what it does not yet cover is
tracked in two registers split by owning layer — [`5-gaps.md`](5-gaps.md) for the state layer,
[`3-ui/work/row-editing/5-gaps.md`](../../../../../3-ui/work/row-editing/5-gaps.md) for keyboard, focus,
a11y and save-gating. Read those first — this
log contains superseded decisions (D13→D21→D29, D20→D24) that no longer describe the code.

## D10 — Row edit mode is a store slice, mirroring `withExpansion()` (2026-08-11)

**Decision:** F2b (button flips one row into edit) is a state-layer feature:
`withRowEdit()` contributing `editingRows: Set<RowId>` plus `startEditing(rowId)`,
`stopEditing(rowId)`, `toggleEditing(rowId)` — the same shape as `withExpansion()`'s
`expandedRows`. UI directives read a single signal; behavior is consistent across tables.

Scope boundary against D1 (mutation decisions) holds: the slice tracks **which rows are in
edit mode**, nothing about the form. The form for an editing row is created and owned by the
consumer.

**Open sub-questions:** multi-row edit vs. single-row-at-a-time (expansion allows multi —
does editing?); whether a `rowEditChanged` event fires; whether `withRowEdit()` is what F2a
(always-edit) uses too, or F2a is purely a column/UI concern.

## D13 — Always-edit (F2a) is not a state-layer concern (2026-08-11)

**Decision:** `withRowEdit()` (D10) covers **only** the button-triggered mode (F2b). Always-edit
tables — every row renders inputs — get no store involvement.

**Rationale:** if every row is editable there is no per-row state to track, so a state slice
would hold a constant. Per-cell readonly/disabled is column config plus the consumer's own
Signal Form, which already owns exactly that surface (D1, mutation decisions).

**Consequence:** "editable" is two distinct mental models, deliberately. F2a = column config +
consumer form. F2b = `withRowEdit()` slice gating which rows show the form. Docs must draw this
line explicitly or consumers will hunt for a feature that doesn't exist.

**Superseded:** revised by D21, then D21 itself narrowed by D29 — see below.

## D14 — `withRowEdit({ multiple })`, default single (2026-08-11)

**Decision:** Multi-row edit is configurable, defaulting to one row at a time. In single mode
`startEditing(id)` closes whatever row was open; in `{ multiple: true }` rows accumulate, like
`expandedRows`.

State shape stays `editingRows: Signal<Set<RowId>>` in both modes — single mode is a Set that
never exceeds one entry — so UI directives read one signal regardless of configuration and the
feature stays symmetric with `withExpansion`.

**Consequence:** single-mode consumers read a Set to find one id. A convenience computed
(`editingRow: Signal<RowId | null>`) is worth considering, but it lies in multi mode — decide
alongside O4.

## D15 — Signal Forms binds to the same `data` signal (2026-08-11)

**Validated against the real API** (`@angular/forms` 22.0.8, `_structure-chunk.d.ts`):

```ts
readonly data  = signal<Person[]>(people);        // WritableSignal
readonly table = createTable(this.data, () => ({ ... }));
readonly rows  = form(this.data);                 // the same signal
```

`form(model: WritableSignal<TModel>)` requires exactly the contract D4/D11 (mutation decisions)
chose for `createTable` — same shape both sides, no adapter, no bridging layer.

**Two writers on one signal is not two sources of truth.** Neither side caches a copy (D11), so
form edits flow into `data`, the pipeline recomputes and the table re-renders — live typing
preview comes free — and table mutations flow into `data`, where the form's field tree
reconciles. This is the strongest validation of D11.

**Correction to an earlier assumption:** `FieldState.reset(value?)` resets **touched/dirty
only** — "Note this does not change the data model, which can be reset directly if desired."
Signal Forms tracks dirty/touched/validity and holds no pre-edit value. So the form owns
validation state (D1 holds), but cancel-revert of row *values* has no owner in the stack.

**Superseded:** the "live typing preview comes free" claim is corrected by D24.

## D16 — No edit verbs on the store; editing state uses the updater pattern (2026-08-11)

**Decision:** Supersedes D10's `startEditing` / `stopEditing` / `toggleEditing` methods. Editing
state is written the same way rows and columns are (D12, mutation decisions):

```ts
updateEditing(table, beginEdit('42'));    // enter edit mode, capturing the row snapshot
updateEditing(table, revertEdit('42'));   // restore the snapshot into `data`, exit edit mode
updateEditing(table, endEdit('42'));      // exit edit mode, keep whatever is in `data`
updateEditing(table, clearEditing());
```

Save is composed, not a store verb: `updateRows(table, patchRow(id, value))` then
`updateEditing(table, endEdit(id))`.

**Superseded:** the free-function call convention (`updateEditing(table, updater)`) is replaced
by a member on the store (`table.editing.update(updater)`) — see D30 in the mutation decisions.
The updater factories named here (`beginEdit`, `revertEdit`, `endEdit`, `clearEditing`) are
unchanged; only the call site moves.

## D17 — Editing state is `Map<RowId, TRow>`, holding pre-edit snapshots (2026-08-11)

**Decision:** `withRowEdit()` holds `editing: Signal<Map<RowId, TRow>>` — id to the row's value
at the moment editing began. `beginEdit(id)` captures it; `revertEdit(id)` writes it back
through `data` and drops the entry; `endEdit(id)` drops the entry without restoring.

**Rationale:** cancel-revert needs a pre-edit copy and nothing else in the stack has one (D15).
Consumers who never need revert simply never call `revertEdit`.

**Consequences:**
- Reintroduces a bounded second copy of row data — only for rows currently being edited, not
  the whole set. Narrower than the `rawRows` copy D11 (mutation decisions) removed, but the same
  category of thing.
- A snapshot can go stale if `data` changes underneath from another source while a row is open.
  Behavior undefined so far — tracked as O13.
- D14's `{ multiple }` config still applies; the container is a `Map` rather than a `Set` in
  both modes.

**Widened:** by D28, from `Map<RowId, TRow>` to `Map<RowId, TRow | typeof ABSENT>`.

## D18 — Row actions are consumer template code (2026-08-11)

**Decision:** The store knows nothing about actions. No `withRowActions()`, no action registry,
no directive. The consumer writes the actions cell and wires buttons to the updaters that
already exist:

```html
<td>
  <button (click)="table.value.update(removeRow(row.id))">Delete</button>
  <button (click)="table.editing.update(beginEdit(row.id))">Edit</button>
  <button (click)="table.value.update(addRow({ ...row, id: newId() }))">Duplicate</button>
</td>
```

**Rationale:** every operation an action could perform is already expressible through the
updater API (D12/D16). An action registry would add a second way to say the same thing, and
would drag label/icon/ordering — UI concepts — into a data-only store.

**Consequence:** no shared markup, keyboard handling, or ARIA for the actions cell; each table
builds its own. Revisit only if real duplication shows up across consumers, and then as a UI
directive, not store state.

## Analysis — form scope: one array form vs. one form per row (2026-08-11)

Not yet decided. Recorded so the reasoning survives; the blocking question is at the end.

### Verified against the real API (`@angular/forms` 22.0.8)

- `form(model: WritableSignal<TModel>, schema?, options?)` — the model is a writable signal, the
  same contract `createTable` requires (D4/D11, mutation decisions).
- "form uses the given model as the source of truth and *does not* maintain its own copy of the
  data" — confirms the two-writers-one-signal model of D15.
- Arrays are **index-keyed only**: `TModel extends ReadonlyArray<infer U> ?
  ReadonlyArrayLike<MaybeFieldTree<U, number>>`. A field knows its position via
  `keyInParent: Signal<number>`. There is no identity/track-by option and no reconciliation
  hook — grepped the whole surface. So O12 does not dissolve; index is the only addressing.
- `FieldState.reset(value?)` resets touched/dirty only, never the data (see D15).
- `applyEach(path, schema)` declares a per-item schema once for a whole array; `applyWhen` /
  `applyWhenValue` / `disabled()` give conditional per-field logic.
- `FormOptions.injector` exists, so `form()` can be created outside an injection context —
  per-row forms created from a click handler are viable, and no `<td>`-level directive is
  required to host them. (A directive that *creates* the form would also invert D1: the design
  system would own the form, not the consumer.)

### Why index instability is narrower than it looks

The pipeline never mutates `data` — filter/sort/group produce a derived `rows()`. Positions in
`data` shift **only** on structural mutation (`addRow`, `removeRow`, `moveRow`), never from
sorting or filtering. And any index map is a `computed` over `data`, not a cached map, so there
is nothing to keep in sync.

`trackBy` and the index do not conflict: `trackBy` is row *identity* (stable — `@for` tracking,
the editing Map, expansion), the index is *position in the form's backing array*. Orthogonal.

### Tradeoffs

| | Array form | Per-row form |
|---|---|---|
| Addressing | index into `data` (O12) | RowId only; the table already owns it |
| Field state on delete | stale — row 3's dirty becomes row 4's | unaffected; dies with the session |
| Live preview | yes — keystrokes hit `data`, pipeline reruns | no — writes land on save |
| Schema declaration | once, via `applyEach` | repeated per form creation |
| Cross-row validation | natural — one tree | hard — forms are isolated |
| Whole-table validity | `rowsForm().valid()` | aggregate N forms yourself |
| Cost at 10k rows | 10k field nodes, rendered or not | one node set per editing row |
| Revert | needs D17's snapshot | free — discard the form |

### What choosing the array form for *both* UI modes means

1. `withRowEdit()` becomes purely presentational — the form exists for every row always, and
   `editingRows` only decides whether a cell renders an `<input>` or text. D13's split collapses
   into one mechanism plus a flag.
2. **O10 answers itself** — per-cell readonly/disabled is declared once via `applyEach` +
   `disabled()`/`applyWhen`. No `ColumnDef` field, no store involvement.
3. O12 lands on the critical path — `fieldFor(form, table, rowId)` or `RenderRow.sourceIndex`,
   one of them must ship.
4. **Live preview becomes a behavior to design around, not a freebie.** Every keystroke writes
   to `data`, so the pipeline reruns per character: sorted by the edited column ⇒ the row jumps
   out from under the cursor mid-word; filtered on it ⇒ the row disappears while typing;
   grouped by it ⇒ the row hops groups. D9 (mutation decisions) deferred this as an add-row edge
   case; under an array form it is a per-keystroke reality for any table with an active sort or
   filter.
5. Validation runs over rows the user cannot see — `applyEach` covers filtered-out rows and
   other pages, so `valid()` is false because row 4,000 has an empty name. Submit and "save all"
   need scoping.
6. Structural mutation misattributes field state (see the table above) — upstream in Signal
   Forms; no index-delivery mechanism fixes it.
7. Scale ceiling: N field nodes for N rows regardless of pagination or virtual scroll, since the
   form is over `data`, not over rendered rows.
8. D17's snapshot still earns its place — the form holds no pre-edit value.

Net: one mechanism, declarative per-cell rules, cross-row validation — paid for with items 4, 6
and 7. Item 4 shows up immediately in any table with sorting on, and has no clean answer inside
Signal Forms. **Blocking question (O14): what happens to the pipeline while a row is being
edited** — freeze it, debounce it, or exclude editing rows from it.

## O14 — research vs. the stated assumption (2026-08-12)

Research in `3-research-edit-pipeline.md`. The one load-bearing claim was verified directly
against https://www.ag-grid.com/javascript-data-grid/change-detection/ — it holds, and is
*stronger* than the assumption:

> "The grid will **not**: Sort, Filter, Group" … "The reason why sorting, filtering and grouping
> is not done automatically is that it would be considered bad user experience in most use cases
> to change the displayed rows while editing."

`refreshAfterGroupEdit` exists and **defaults to `false`**: "When set to `true`, the grid
automatically reruns grouping, sorting and filtering after the edit is committed, so the row will
move according to its new value."

| Assumption stated before research | What sources show |
|---|---|
| Row under the cursor never moves | Confirmed — AG Grid, MUI X both hold position during edit |
| Reposition on commit | **Not** the default anywhere. AG Grid: opt-in (`refreshAfterGroupEdit`). Excel/Sheets manual sort: never re-sorts. MUI X: on save |
| Committed row failing the filter stays visible | Split. Grids: yes (no re-run). Airtable/Notion: no — row vanishes mid-keystroke |
| New row pinned at insertion point | Confirmed across AG Grid, Airtable/Notion, Excel |
| Pinning is presentational, not a pipeline stage | Not addressed by any source — still ours to decide |

**What this changes:** the axis is not "when does the pipeline re-run during the edit" but **"does
it re-run at all"**. Deferring to commit is the middle option, not the conservative one. Real grids
treat a sort as a *snapshot* that goes stale, and make re-running it an explicit request.

Accessibility backs the same direction: WCAG 3.2.2 On Input (A) — a row moving or vanishing
mid-keystroke is a change of context the user was not warned about. WCAG 3.2.5 (AAA) wants
post-commit movement user-initiated or toggleable. Neither is satisfied by a live pipeline.

Sources leave three things open that we hit anyway: an uncommitted new row under an active filter
(only Airtable/Notion document it, and they hide it); a row whose edit moves it across groups; and
stale-snapshot conflicts from another writer (our O13).

## D20 — Editing rows are exempt from the pipeline; "editing" means Map membership (2026-08-12)

**Decision:** Resolves O14. The pipeline stays live — it reruns on every write to `data`, per
keystroke — but rows present in `withRowEdit()`'s `editing` Map (D17) are **exempt** from
filter/sort/group and hold their display position. They rejoin the pipeline when `endEdit` drops
them from the Map.

Rejected: the snapshot model (AG Grid's default) and the freeze-everything model. Both are global
behavior changes that also stop unrelated rows and server pushes from updating; exemption is
per-row and composes with everything else.

**"Editing" has exactly one definition — membership in the `editing` Map.** The library detects no
triggers: no blur listener, no change-event hook, no dirty checking. The consumer calls
`beginEdit` / `endEdit`, and trigger policy is entirely theirs:

```ts
// button mode (F2b)
(click)="updateEditing(table, beginEdit(row.id))"
(click)="save(row)"          // updateRows(patchRow) then updateEditing(endEdit)

// live edit — consumer's own trigger policy
(focusin)="updateEditing(table, beginEdit(row.id))"
(focusout)="updateEditing(table, endEdit(row.id))"

// server-confirmed
await save(row); updateEditing(table, endEdit(row.id));
```

The server-confirmed case needs no new API: the row stays pinned for the whole round trip because
its id is still in the Map, and a failed save simply never calls `endEdit`, leaving the row pinned
and open. Consistent with the standing design criterion — one set, one updater pair, policy on the
consumer's side.

**Consequences / still unspecified:**
- Exemption must be expressible in the engine. Pipeline stages are `(rows) => rows`; there is no
  current way for a stage to be told "skip these ids and preserve their slots".
- "Holds its display position" is undefined when neighbors move underneath — absolute index in
  `renderRows()`, or position relative to an anchor row?
- Under an active filter, an exempt row stays visible even when it no longer matches. That is the
  intended behavior during the edit; what happens on `endEdit` (row vanishes) is unaddressed.
- Insertion at top is the same mechanism (see "Insertion position" in the mutation decisions) — an
  added row is pinned by being in the Map, not by any value of `at`.

**Superseded:** mechanism replaced by D24 (intent preserved).

## D21 — `withRowEdit()` serves both UI modes; D13 revised (2026-08-12)

**Decision:** Always-edit tables (F2a) use `withRowEdit()` too. D13's claim that always-edit needs
no store state was true only while editing state meant "which rows show inputs" — under D20 the Map
means "which rows are exempt from the pipeline", and an always-edit table absolutely has that state:
the row the user is in right now.

`withRowEdit()` is therefore not a mode gate. It is *which rows are currently exempt*. Button mode
writes it on click; always-edit mode writes it on focusin/focusout. One Map, one updater pair, one
pinning mechanism serving both modes.

**Consequences:**
- D13's two-mental-models split narrows to a UI-layer distinction (does the cell render an input
  unconditionally, or gated on membership?). The state layer is now identical for both.
- Always-edit consumers must wire focus handlers to get pinning; without them the Map stays empty
  and rows move while typing.
- `withRowEdit({ multiple })` (D14) still applies. Always-edit mode with focus triggers is
  naturally single — focus is single — so the default fits.
- Open: whether a UI-layer directive should ship those focusin/focusout handlers, so that
  always-edit consumers get pinning without hand-wiring. That directive would be the first thing
  able to initiate an edit-state change without the consumer calling anything — which is exactly
  the condition O11 turns on.

**Narrowed:** by D29 — always-edit tables need no `withRowEdit()` once D24 removes the pinning
justification. D21's claim stands only when the consumer *chooses* to compose `withRowEdit()` for
its remaining justifications (mode gate for F2b, revert).

## D22 — One array form over `data`; no per-row forms (2026-08-12)

**Decision:** The consumer creates a single `form(data)` over the same `WritableSignal<TRow[]>`
that `createTable` takes (D15). Per-row forms are rejected. One approach only — the two are not
offered side by side.

```ts
readonly data  = signal<Person[]>(people);
readonly table = createTable(this.data, () => ({ ... }));
readonly rows  = form(this.data);       // the same signal, no adapter
```

**Rationale:** the per-row alternative needs a `WritableSignal` per row to bind to, so it either
copies out of `data` and writes back on save — reintroducing exactly the drift D11 (mutation
decisions) removed — or needs a writable proxy slice per row, which is unbuilt machinery. The
array form needs neither. D20 removed its worst cost (rows no longer jump mid-keystroke), and
`applyEach` answers O10 without a `ColumnDef` field.

**Consequences:**
- **O12 is now on the critical path.** The form is indexed over `data`; the template iterates
  `renderRows()`. Mapping a `RenderRow.id` to its `FieldTree` node must ship — either
  `fieldFor(form, table, rowId)` or `RenderRow.sourceIndex`. No editable table works without it.
- **O10 resolves** — per-cell readonly/disabled is `applyEach` + `disabled()`/`applyWhen` in the
  consumer's schema. No `ColumnDef` field, no store involvement.
- **D13's collapse completes.** With the form covering every row always, `withRowEdit()` decides
  only whether a cell renders an input and whether the row is pipeline-exempt (D20/D21).
- **D17's snapshot Map still earns its place.** The form holds no pre-edit value
  (`FieldState.reset()` clears touched/dirty only), so revert has no other owner.
- **Accepted costs:** N field nodes for N rows, independent of pagination or virtual scroll; and
  structural mutation (`addRow`/`removeRow`) misattributing dirty/touched, since Signal Forms
  arrays are index-keyed with no identity hook. Both are upstream limits with no local fix.
- **Validation scope needs deciding** — `applyEach` covers filtered-out rows and other pages, so
  `valid()` can be false because of a row the user cannot see. Submit and "save all" need scoping.
  Tracked as O17.

## D23 — `RenderRow.sourceIndex`, derived by the engine (2026-08-12)

**Decision:** Resolves O12. A rendered row reaches its `FieldTree` node through an index the
engine stamps on `RenderRow`, not through a resolver function:

```ts
interface RenderRow<TRow> {
  /** Index into `data`. Undefined for synthesized rows (`kind: 'group'`, `data: null`). */
  readonly sourceIndex?: number;
}
```

```html
@for (row of table.renderRows(); track row.id) {
  @if (row.sourceIndex !== undefined) {
    <td><input [field]="rowsForm[row.sourceIndex].name" /></td>
  }
}
```

**Why not `fieldFor(table, form, rowId)`** — prototyped both in
`../../../o12-field-resolution.prototype.ts` (throwaway, typechecked). Ergonomics came out a wash:
both need a per-row guard, and TS2538 covers the group-row case for `sourceIndex` as long as the
field stays optional. Two objections killed the resolver:

1. **Coupling.** Its signature cannot be `FieldTree<TRow>` — indexing a Signal Forms array field
   yields `MaybeFieldTree<TRow, number>` and TS will not reduce `Exclude<TRow, undefined>` over an
   unresolved generic (TS2322, reproduced). So the helper leaks `@angular/forms/signals` into our
   public types. The table lib has no forms dependency today and D1 (mutation decisions)
   deliberately kept it out.
2. **A function call in a template.** `@let` narrows it to once per row per CD pass rather than
   once per cell, but it stays a call. Exposing an index instead is a value, not a call.

~~A `<td>` directive that resolves the field internally was also rejected: it relocates the same
forms coupling into the UI layer instead of removing it.~~ **Superseded by D31** — a structural
directive behind a secondary entry point, not a `<td>`-level one, ships instead.

**The refinement that makes it safe — the engine derives it; no feature stamps it.** `sourceIndex`
is *not* a contract each `renderRows` builder must honor. The engine computes it after the builder
returns, from `data` + `trackBy`:

```ts
indexById  = computed(() => new Map(data().map((r, i) => [trackBy(r), i])));
renderRows = computed(() => stamp(builder(pipeline(data(), stages)), indexById()));
```

`withGrouping()` cannot forget it or stamp it wrong, because it never touches it. Group rows carry
`data: null` already, so they get `undefined` for free and keep the compile-time guard.

**Reactivity and cost — checked, not assumed:**

- Nothing to synchronize. `indexById` is derived, so there is no write path that can forget it and
  no staleness window. This is why the map is not held as state.
- `indexById` depends on `data` alone. Sort toggle, filter change, column visibility and expansion
  leave it untouched; only the stamp pass re-runs, and `renderRows` was re-running regardless.
- `addRow` / `removeRow` / a drag-reorder of `data` shift real indices — the rebuild is required.
- `patchRow` rebuilds a Map with identical contents, since `data` emitted. The one avoidable case.
- Both passes are O(n) against a pipeline already paying O(n log n) whenever a sort is active, and
  the stamp's per-row spread is not a new allocation category — `buildDefaultRenderRows` already
  allocates one object per row per recompute (`engine/rows.ts:22`).
- **This cost is not attributable to D23.** `fieldFor` needed the identical map; the decision moves
  where the index is read, not what it costs.

## D24 — The commit boundary is Signal Forms `debounce()`, not pipeline exemption (2026-08-12)

**Decision:** Supersedes D20's mechanism (D20's *intent* — the row must not move under the cursor —
stands). The table builds no exemption for sort or group. The consumer declares when a field's
value reaches `data`, using an Angular primitive:

```ts
declare function debounce<TValue>(
  path: SchemaPath<TValue, …>,
  config: number | 'blur' | Debouncer<TValue, …>
): void;
```

A field carries two values (`_structure-chunk.d.ts`): `controlValue` — what the input holds, never
debounced — and `value`, which reaches the data model and *is* debounced.

```ts
form(this.data, (path) => {
  applyEach(path, (row) => {
    debounce(row.name, 'blur');   // text: commits when the user leaves the cell
    debounce(row.dept, 0);        // select: commits immediately
  });
});
```

Typing therefore never touches `data`, so the pipeline never reruns and **the row cannot move** —
without the engine knowing anything about editing. On blur, `data` updates once and the row
relocates. A dropdown or checkbox commits on change and the row jumps groups immediately, which is
the intended UX.

**Why this beats exemption:** both mechanisms depend on consumer configuration — D20's Map is only
populated because the consumer calls `beginEdit`, and D20 made the library detect no triggers. Same
guarantee, same failure mode (a consumer who wires neither gets jumping rows), except one is
maintained by Angular and needs no engine surgery.

**Non-live tables (button, then Save)** use a custom `Debouncer` — a promise resolving on the Save
click — instead of `'blur'`. Same primitive, different resolution trigger.

**This also answers the deferred question** "user clicks sort while a row is open in edit mode":
`data` still holds the pre-edit value, so the row sorts by its old value and stays put. Falls out
of the model rather than needing a rule.

**Consequences:**
- **D15's live-preview claim is now wrong.** "Live typing preview comes free" was true only while
  every keystroke hit `data`. Under `debounce('blur')` other cells and aggregates derived from the
  edited value do not update until commit. That is the intended UX, but D15's text needs revising.
- **Binds the editing path to Signal Forms.** A consumer using `[(ngModel)]` or writing to `data`
  from an `(input)` handler gets jumping rows and the table has no answer. D22 already made the
  array form *the* editing path, so such a consumer has left the supported road — and would break
  under exemption too, since the Map would be empty.
- A server push mid-edit can still move the row: its own value is unchanged, but neighbours
  reordering around it shift its position. True exemption would have held it. Accepted.
- **Insertion is not solved by this**, so the earlier claim that add-blank-row-at-top and
  don't-move-the-editing-row are one problem is **wrong** — they come apart. A blank row added
  under an active sort still lands wherever empty values sort (the `withSorting()` null-ordering
  gap), and under an active filter it is covered by D25 instead.
- Open: whether to export a schema fragment (`editableRow(row, columns)`) so the commit boundary is
  one call rather than per-column discipline. It would import Signal Forms types into our lib — the
  coupling rejected for `fieldFor` in D23, though as an opt-in export rather than a core API type.
  Tracked as O19.
- Removes `withRowEdit()`'s pinning justification entirely — see D29.

## D25 — A row edited out of the filter stays visible, marked, until the filter changes (2026-08-12)

**Decision:** When a commit makes a row no longer match the active filter, the row is **not**
removed. It stays in place, visually flagged as no longer matching, and leaves on the next filter
change, re-query, or navigation.

The same rule covers a row added under an active filter that does not match the predicate — which
answers D9's (mutation decisions) "I clicked Add and nothing appeared". One retention rule, two
entry points.

**Rationale:** a sorted row that moves is still on screen; a filtered row is gone, and the user's
own edit made it vanish. That is Airtable/Notion's documented behavior and the thing their users
complain about in support threads, and it is the WCAG 3.2.2 exposure the research flagged. Rejected
alternatives: dropping the row on commit (free, but the vanishing-row complaint), retaining it
unmarked (the table silently contradicts its own filter with no explanation), and never re-filtering
at all (AG Grid's default — a table-wide behavioral commitment far beyond editing).

**Consequences:**
- **O15 does not fully dissolve — it narrows from three stages to one.** Exemption is still needed,
  but only for `filter`, and only for rows the user has just touched. Sort and group need nothing.
- Exemption now needs a **lifetime**: a row enters the retained set on commit-or-insert and leaves
  on the next filter change. That is a different trigger from `endEdit`, so the retained set is not
  the editing Map.
- Needs a UI affordance (chip, muted styling) so the user can tell why an out-of-filter row is
  showing. UI-layer work, not state.

## D28 — `revertEdit` derives add-cancel from edit-cancel via the snapshot (2026-08-13)

**Decision:** Resolves O21. No flag and no second verb. `beginEdit` records absence when the id is
not yet in `data`, and `revertEdit` branches on that:

```ts
beginEdit(id):  snapshot = data().find(id) ?? ABSENT
revertEdit(id): snapshot === ABSENT ? removeRow(id) : restore(snapshot)
```

**Consequence — the blank-row flow has a canonical order:**

```ts
const id = crypto.randomUUID();
table.editing.update(beginEdit(id));                    // nothing there yet → ABSENT
table.value.update(addRow({ id, ...blank }, { at: 0 })); // D26 temp id, D27 explicit `at: 0`
                                                          // (mutation decisions)
```

Reads slightly oddly — start editing a row that does not exist yet, then create it — but it needs
no flag and the library never has to be told something it can observe.

**The reverse order is not a bug, it is the other intent.** `addRow` then `beginEdit` snapshots the
blank row, so cancel clears the user's typing and leaves the empty row in place — "reset this row"
rather than "discard it". Both are real product behaviors, and the call order is what selects
between them.

**Accepted risk:** the two orders differ silently, with no error in either direction, because both
are valid. Mitigation is documentation — the blank-row flow ships as one canonical snippet, and the
reset-row variant is documented alongside it as a deliberate alternative rather than left to be
discovered.

**Consequences:**
- `editing` (D17) widens from `Map<RowId, TRow>` to `Map<RowId, TRow | typeof ABSENT>`.
- `revertEdit` gains a write to `data` in the ABSENT case, so it touches both signals — previously
  only `restore` did.
- Interacts with D26 (mutation decisions): a row reverted before save never reaches the server, so
  its temp id simply disappears and no identity swap occurs.

## D29 — `withRowEdit()` is optional; the minimal live table uses none of it (2026-08-13)

**Corrects D21**, which said always-edit tables use `withRowEdit()` too. That was decided one day
before D24, on a rationale D24 removed.

`withRowEdit()` had three justifications. For an always-edit table with no Cancel button, all three
are gone:

| Justification | Status |
|---|---|
| Mode gate — which rows show inputs | never applied to always-edit (D13's original point) |
| Pinning — which row is exempt from the pipeline | **deleted by D24**; `debounce()` holds the row still without knowing who is editing |
| Snapshot for revert (D17) | nothing reverts without a Cancel affordance |

**The minimal live editable table is therefore:** a `WritableSignal<TRow[]>`, one array `form(data)`
with `debounce()` per column (D24), `addRow` for insertion (D26/D27, mutation decisions), and
`sourceIndex` to reach field nodes (D23). No editing state, no `beginEdit`/`endEdit`, no
`updateEditing`, no `withRowEdit()`.

**`withRowEdit()` earns its place only when the consumer needs** a revert/Cancel affordance (D17's
snapshot, D28's ABSENT marker) or a button-triggered mode where rows show inputs conditionally.

**Consequences:**
- D21 stands only in its narrow form: *if* an always-edit table composes `withRowEdit()`, the Map
  means "which rows are exempt/active" rather than "which rows are in edit mode". It is no longer a
  claim that such tables need the feature.
- D26's (mutation decisions) identity-swap table shrinks for this configuration: with no editing Map
  there is nothing to orphan, so only the `<tr>` teardown remains — and no focus is lost, because
  nothing held it.
- The spec must present the minimal table as the starting point and `withRowEdit()` as an addition,
  or consumers will compose a feature they do not need.
- Out of scope, and the consumer's: nothing prevents repeatedly adding blank rows, and abandoned
  blanks persist in `data` until something removes them.

## Delivery slicing

Decisions here are sliced into shippable increments in [`4-increments.md`](4-increments.md).
Two things that file establishes and this one should be read against:

- **D25, O15, O16 and O17 are phantom work** — they depend on `withFiltering()` and pagination,
  neither of which exists (`api/features/` holds only `with-sorting.ts` and `with-expansion.ts`).
  They are not deferred hard problems; they are problems about unwritten code, and should be
  re-derived when that code exists rather than implemented from these notes.
- **~~Everything from D22 onward is inferred from `@angular/forms` type definitions, not observed.~~**
  **Resolved 2026-08-19 — D24 confirmed by observation.** E2 shipped
  (`apps/demo/src/app/table-edit-demo/`), instrumenting `data()` emissions with a `linkedSignal`
  counter alongside a live-value/committed-value column pair. `debounce(field, 'blur')` holds the
  commit boundary: typing does not move `data()`; blur does. `debounce(field, 0)` commits
  immediately. D22, D24, D29 and the closure of O18 stand on observation, no longer on inference.

## D31 — Optimistic save: `endEdit({ keepSnapshot })` moves the entry to `pending` (2026-08-19)

**Decision:** Optimistic save (close the row before the server answers) is supported inside
`withRowEdit()`, not as a separate feature and not left to the consumer. No new save verb — the
existing `endEdit` takes a config, per the standing "one operation with optional defaults"
criterion.

```ts
endEdit(id)                          // close, drop the snapshot
endEdit(id, { keepSnapshot: true })  // close, move entry: editing → pending
settleEdit(id)                   // on success: settle
revertEdit(id)                       // on failure: restore from either map, drop
```

**Why the entry moves rather than staying put.** `editing`'s key set is what templates read to
decide which rows render inputs. A pending row has visually closed, so leaving it in `editing`
renders a stuck editor until `settleEdit` runs — and only on the success path, the one least
likely to be tested. Two signals, each with one meaning:

```ts
editing:  Signal<EditingMap<TRow>>   // open rows only — meaning and type unchanged
pending:  Signal<EditingMap<TRow>>   // closed, still rollback-able
```

**Types superseded by D31.5** — both are `Signal<ReadonlySet<RowId>>` now, and `pending` is a
`computed`. The *decision* below — that a pending row leaves `editing` rather than lingering in
it — is what stands; only the containers changed.

**`settleEdit(id)` is the sibling of D34's `rebaseEdit(id, row?)`**, not a new concept — the
snapshot was already writable; now it is also deletable.

**Consequences:**
- `editing`'s type is unchanged, so E2's demo and every existing template keep working. `pending`
  is additive.
- ~~`revertEdit` must check both maps. `endEdit`'s move must be one operation, not a delete plus
  an insert, or the two maps can drift.~~ **Dissolved by D31.5** — `pending` is derived, so there
  is no move and no second map to check.
- A forgotten `settleEdit` still leaks, but degrades to a stale spinner rather than a row the
  user cannot interact with.
- Pessimistic save (row stays open during the request) needs none of this and already works:
  `endEdit` on success, `revertEdit` on failure, entry alive throughout.
- **Scope is optimistic update and create only.** Delete and move are uncovered, and structurally
  so — see **O22**.
- Re-opens fixes #3/#4/#5 from the E3/E4 review — `beginEdit` on a pending row, what single-mode
  switching does to a pending row, and which map `revertEdit` reads first — resolved below.

### D31.1 — `beginEdit` on a pending row re-opens it, keeping the original snapshot

Entry moves `pending → editing`, carrying the snapshot captured at the *first* `beginEdit`. The row
reopens showing its current (optimistic, unconfirmed) values, but Cancel still returns to the true
pre-edit state — the oldest restore point wins, which is what Cancel means to a user.

This also settles review finding #3 for the non-pending case: `beginEdit` must stop re-capturing
over an existing snapshot. Re-capture is `rebaseEdit`'s job (D34); `beginEdit` only ever captures
when there is no entry in either map.

**Known sharp edge, left to the consumer:** if the in-flight save then fails, the error handler's
`revertEdit` fires on a row the user is actively typing in. The library does not suppress it — it
cannot know whether the consumer wants the failure to win or the user's new input to win. Document
this in the optimistic-save example.

### D31.2 — Single-mode row switching is an implicit Save; `{ multiple }` stays

**Wording corrected 2026-09-03 — the "implicit Save" framing is stale.** This was written
2026-08-19 against the live-table model, where blur committed straight to `data`, so a close
with no explicit merge was harmless — whatever was last typed was already there. OQ-3 later gave
gated mode its own commit boundary (`table.draft`, merged into `data` only by an explicit
`endEdit(id, row)` — a real Save), and this decision's *behavior* was never revisited against
that change. Traced 2026-09-03: `closeAllButLast` (the single-mode trim) never merges the
displaced row's draft into `data`; `createDraftRows`'s `resetClosedRows` then re-derives that
row's draft from `data` the moment it leaves `open`. **Net effect under gated mode: switching
rows discards the displaced row's unsaved draft, cleanly — it is not a Save.**

This is not a bug. Whether to warn before discarding is a consumer UX decision this library
does not own (D16/D18: no store verbs control UI, actions are consumer template code) — the
consumer already has everything needed to gate it: they trigger the switch themselves
(`table.editing.update(beginEdit(nextId))`), and Signal Forms already tracks the outgoing row's
`dirty` state. A consumer wanting a confirm dialog checks dirty and gates their own call to
`beginEdit`; the library's only obligation — met — is that the result is internally consistent
(the draft resets cleanly, never stale) once the switch happens. See the demo pattern in
`gated-single-optimistic-story-host.component.ts`.

**Resolves review finding #4** — original text, true only under the live-table model: opening
row B while row A is open closes A the way `endEdit` does, and under D24 the user's typed value
was already committed on blur and visible before they clicked away, so silently reverting it
would have been the surprise. Kept for history; does not describe gated mode's current behavior.

**Prior art checked (2026-08-19):** single-row-at-a-time is the norm, not an oddity — MUI X DataGrid
allows only one row in edit mode and **commits on click-away** (Escape reverts;
`stopRowEditMode({ ignoreModifications: true })` discards). AG Grid `editType: 'fullRow'` likewise
permits only one row at a time. AG Grid's own recipe uses `stopEditing(true)` (cancel) when another
row is clicked, but that recipe is for button-only commit — a different mode from ours, where blur
has already committed.

**`{ multiple }` (D14) is kept** despite neither reference shipping an equivalent, to cover
bulk-edit tables without a later API change. Two consequences to carry:
- `multiple: true` has no reference implementation to copy; its semantics are ours alone.
- It multiplies against D31's pending state — N open rows × M in-flight saves is undesigned. Treat
  `multiple: true` + optimistic save as unsupported until someone specs it.

**Missing affordance, noted not decided:** both references bind Escape to revert. We have no
keyboard story for edit mode at all — `revertEdit` exists but nothing calls it from a key handler.
UI-layer concern; belongs with the directive work, not here.

### D31.3 — Implementation resolutions (2026-08-25)

Five edges D31 left implicit, settled while building it. All follow from "two signals, each with
one meaning".

**Partly superseded by D31.5** — the first and fifth bullets described how to keep two snapshot
maps consistent, and there is now only one. Bullets two through four stand unchanged, restated in
the new vocabulary.

- **The updater state is one value, not two maps.** `EditingUpdater` now takes and returns
  `EditingState<TRow> = { editing, pending }`, and `withRowEdit()` backs both with a single
  `signal<EditingState>`. This is what makes D31's "`endEdit`'s move must be one operation"
  structural rather than a discipline — there is no write that can land on one map only.
  `table.editing()` still reads the `editing` map alone, so D31's "type unchanged" holds.
- **`settleEdit(id)` targets `pending` only.** It is a no-op on an open row: settling a
  row that is still open has no meaning, and closing one is `endEdit`'s job. No-op rather than
  throw, because every other updater no-ops on a miss.
- **`rebaseEdit` stays `editing`-only — it is not a `pending` verb.** The two solve different
  problems and only looked related because both stored a "snapshot" (see D31.4, which removes the
  word). D34's `rebaseEdit` answers O13: the restore point of a row *the user is still typing in*
  going stale because something else wrote `data`. `pending` holds the rollback for a row *already
  closed* with a request in flight. Widening `rebaseEdit` to fall back to `pending` would cover
  only the narrow window where an external write lands during an in-flight optimistic save —
  unhit, and it would stretch D34 past its stated problem. Left alone.
- **`clearEditing()` closes open rows and leaves `pending` alone.** Pending rows are already
  closed; dropping their rollbacks would silently disarm every in-flight save.
- **`revertEdit` reads `editing` first, then `pending`.** The order is not load-bearing — D31.1
  makes the pending-to-editing move atomic, so an id is never in both maps — but it is fixed and
  tested so it cannot drift into being load-bearing later.

### D31.4 — The public verbs are the edit lifecycle; "snapshot" leaves the API (2026-08-25)

`setSnapshot` (D34) and `removeSnapshot` (D31) both said "snapshot", which read as though they
were two halves of one mechanism. They are not: one keeps an *open* row's restore point current,
the other discards a *closed* row's rollback after the server confirms. The shared noun caused a
real misreading during implementation review.

Renamed so every public verb names a point in the edit lifecycle instead:

| Was | Is | What it means |
|---|---|---|
| `setSnapshot(id, row?)` | `rebaseEdit(id, row?)` | move an open row's restore point forward |
| `removeSnapshot(id)` | `settleEdit(id)` | a closed row's save is confirmed; drop the rollback |

The full family is now `beginEdit` / `endEdit` / `revertEdit` / `rebaseEdit` / `settleEdit` /
`clearEditing`. "Snapshot" survives only as internal vocabulary for the stored value
(`RowSnapshot`, `EditingMap`) and in `endEdit`'s `{ keepSnapshot }` option, where it names the
stored thing rather than an operation.

**Cost accepted:** `setSnapshot` shipped in E4 and was exported from the barrel, so this is a
breaking rename rather than an addition. Taken now because the only consumers are in-repo and the
name had already misled once.

### D31.5 — The state is restore points plus open ids; `pending` is derived (2026-08-25)

**Supersedes D31.3's first and fifth bullets, and D31's "the move must be one operation".**

D31 stored two maps of the same value type — `editing` (open + snapshot) and `pending` (closed +
snapshot) — and D31.3 then had to make them one signal so a *move* between them could not tear.
The question that broke it open: since `pending` already holds recovery data, why does `editing`
hold any?

Because the two maps were never two kinds of thing. They encoded **(restore point) × (is it
open?)** as two containers. Split on the actual axes instead:

```ts
interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;   // one restore point per row
  readonly open: ReadonlySet<RowId>;       // which of them are showing inputs
}

pending = snapshots.keys() − open          // derived, never stored
```

**What stops existing** — each of these was a rule about keeping two containers consistent, not
about editing:

| Was | Now |
|---|---|
| `endEdit({ keepSnapshot })` *moves* an entry between maps; must be one write or they drift | `open.delete(id)`. There is no move. |
| D31.1 branches to carry the original snapshot back when a pending row re-opens | the snapshot was never moved, so "oldest restore point wins" is not code |
| `revertEdit` reads `editing` first, then `pending` — order fixed and tested so it cannot drift | one lookup, no branch, no order |
| One state object so the two maps cannot tear (D31.3) | nothing to tear; `pending` cannot disagree with its own inputs |

Three of D31.3's five resolutions were accidental complexity from the decomposition. They are
struck rather than reworded.

**Public type change:** `table.editing()` is `ReadonlySet<RowId>`, not `EditingMap<TRow>`;
`table.pending()` likewise. `EditingMap` is renamed `SnapshotMap` and now names only the internal
restore-point store. **Every read in the repo was already `.has(id)`** — three in
`table-row-field-demo.html`, two in `table-row-edit-demo.html` — so no consumer read a snapshot
value out of `editing()`, and the Map's values were paying rent on the public surface for zero
readers.

**Contradicts E3's stated rationale**, which shipped a Map before anything read snapshots
specifically to avoid churning the public signal type later ("shipping a `Set` first and widening
to a `Map` in E4 would churn the public signal type for every consumer"). That reasoning was
sound then; it assumed the snapshot had to live beside the open flag. Taken now because the work
is uncommitted and every consumer is in-repo — the same grounds as D31.4.

**The one new coupling, and it is real:** closing a row without `keepSnapshot` must delete its
restore point explicitly. Leaving it behind would satisfy "not open, still held" — the definition
of pending — and silently arm a rollback for a save nobody started. Two places carry this, both
tested: `clearEditing()` and the single-mode trim (D31.2).

**Invariant:** `open` is always a subset of `snapshots`' keys. Every updater preserves it,
`pendingIds` short-circuits on it, and it is asserted in the updater spec.

## E3/E4 code review — disposition (2026-08-25)

Seven findings were raised against the shipped `withRowEdit()`. Disposition, so none is re-raised:

| # | Finding | Disposition |
|---|---|---|
| 1 | E4's surface untested | **Fixed** — `api/row-edit-mutations.spec.ts` covers all six updaters plus the D28 blank-row round-trip and the D31 optimistic-save round trip |
| 2 | `endEdit` drops the snapshot, so optimistic save cannot roll back | **Fixed** — D31 below, shipped 2026-08-25 with E2b |
| 3 | `beginEdit` silently re-captures over an existing snapshot | **Decided** — D31.1 |
| 4 | Single-mode row switching is Save-by-side-effect | **Decided** — D31.2 |
| 5 | `revertEdit` cannot restore an externally-removed row | **Dissolved** by [ADR-0006](../../../../../adr/0006-row-id-state-reconciliation.md) — the entry is reconciled away at removal, so the case cannot arise |
| 6 | `revertEdit`'s `writeData` bypasses the normal write path | **Dissolved** — ADR-0006 chose an effect watching `data`, which sees this write like any other. Would have mattered only under the rejected write-path hook |
| 7 | `updateEditing` threw cryptically without `withRowEdit()` | **Moot** — `updateEditing` no longer exists; writes go through `table.editing.update(...)` (`WritableView`) |

**Naming collisions — resolved 2026-08-25 (G8).** Decision numbers are global across this folder
and `../with-mutations/2-decisions.md`, so two files could not both hold a D30. Two collisions
existed; both were renumbered here, leaving the mutation decisions untouched:

| Was | Now | Why this side moved |
|---|---|---|
| D30 — `rebaseEdit` (this folder) | **D34** | D30 in the mutation decisions is the `WritableView` write pattern, cited by the engine `CLAUDE.md` and `row-mutations.md` — the cross-cutting one keeps the number |
| D31 — `*ngpTableRowField` (this folder) | **D33** | D31 in this folder is optimistic save, with D31.1–D31.5 sub-decisions hanging off it; the directive decision has none |

## D34 — The restore point is writable; the library never watches `data` for staleness (2026-08-19)

**Renumbered from D30 on 2026-08-25** — see the collision table above.

**Renamed 2026-08-25:** this verb shipped as `setSnapshot`. It is now `rebaseEdit` — see D31.4.
Behavior is unchanged; every mention below reads with the new name.

**Decision:** Resolves O13. The library does not detect that a `beginEdit` snapshot (D17) has gone
stale, because it cannot tell an external write apart from any other `data` change. The consumer
knows when they wrote; they say so. One updater, following D16's pattern:

```ts
rebaseEdit(id)        // re-read current data() as the new restore point
rebaseEdit(id, row)   // set an explicit restore point (e.g. the server's response)
```

One operation with an optional second argument, not a policy flag per scenario — the same shape as
`updateRows`. Omitting `row` re-reads `data()`, which is exactly what `beginEdit` does on open, so
the default case needs no argument.

**Default stays "revert wins":** absent any `rebaseEdit` call, `revertEdit` restores what was
captured at `beginEdit`. No machinery watches `data`, and no per-row subscription exists.

**Consequences:**
- The two rejected policies become consumer-implementable rather than unavailable. *Refresh wins* is
  `rebaseEdit(id, incoming)` at the write site. *Detect and drop* is the consumer comparing and
  calling `endEdit` instead of `revertEdit`. Neither is baked into the library.
- `beginEdit` on an already-open row keeps whatever semantics E3 gives it; refreshing a restore
  point now has its own verb, so the two intents never have to share one call.
- No new coupling. `rebaseEdit` reads and writes the same `Map<RowId, TRow | ABSENT>` (D17 + D28)
  that `beginEdit`/`revertEdit` already own.
- Ships with **E4**, not E3 — nothing reads snapshots until `revertEdit` exists.

## D33 — `*ngpTableRowField`, behind a secondary entry point (2026-08-19)

**Renumbered from D31 on 2026-08-25** — see the collision table above.

**Decision:** Supersedes D23's one-line rejection of a field-resolving directive. Ships
`*ngpTableRowField`, a structural directive that folds the E2 pattern —
`@if (row.sourceIndex !== undefined) { @let field = rows[row.sourceIndex]; }` — into one
template line, guard and bind together. Exported from a **secondary entry point**,
`@ngp/table/forms`, not the root barrel — `src/index.ts` stays forms-free even at type level,
and a consumer who never edits never sees `@angular/forms` in their import graph.

**Rationale — re-scoring D23's two objections against a directive, not a resolver function:**

1. *"A function call in a template"* — does not apply. A directive is not a call; it is
   structural, like `*ngIf`.
2. *"Coupling"* — applies, narrower than D23's text implies. D23's actual finding was that
   `fieldFor()`'s **signature** forces `MaybeFieldTree` into the public API types (`RenderRow`,
   `TableStore`, `ColumnDef`). A directive puts nothing into those types. Its only import is
   `import type { FieldTree } from '@angular/forms/signals'`, which erases at compile — zero
   runtime dependency. D1 (mutation decisions) keeping the table lib forms-free is honored; what
   D23 actually guarded was the *core API surface*, not every file under `src/`.

**What D23 didn't have, that changes the calculus:** its own strongest finding — indexing a
Signal Forms array field yields `MaybeFieldTree<TRow, number>`, and TS will not reduce
`Exclude<TRow, undefined>` over an unresolved generic `TRow` (TS2322, reproduced by D23) — is
exactly the problem a structural directive's `ngTemplateContextGuard` exists to solve. The guard
asserts the narrowed `FieldTree<TRow>` **once, at the directive boundary**, instead of leaking
`MaybeFieldTree` to every call site the way a resolver function would. The blocker that killed
`fieldFor()` is answerable in directive form; D23 dismissed the directive by analogy to the
resolver without checking whether the same objection actually transfers.

**Why a secondary entry point over the root barrel:** the root barrel documents itself as *the*
consumer surface (`index.ts:1-3`); adding a forms-typed export there means every consumer's
typecheck touches `@angular/forms/signals`, editing or not. `@acme/shared-design-system/styles`
(`libs/shared/design-system/src/styles/index.ts`, mapped in `tsconfig.base.json`) is the
existing precedent for this pattern in the repo — a path-mapped secondary barrel, no new Nx
build target, no `project.json` change.

**Consequences:**
- Two barrels now exist for `@ngp/table`: `index.ts` (forms-free, the default surface) and
  `forms/index.ts` (opt-in, editing-only). A consumer who imports only `@ngp/table` never
  resolves `@angular/forms` through this lib.
- D23's directive-rejection sentence is superseded, not deleted — the resolver-function
  rejection (`fieldFor`) still stands in full; only the directive clause is revised.
- Does not resolve **O19** (the `editableRow()` schema fragment). That is a different slice —
  collapsing per-column `debounce()` discipline into one schema call — and stays open,
  independent of this directive.
- `lib` build (`project.json`, `browser: src/index.ts`) does not cover `forms/index.ts` — nothing
  reachable from the root barrel imports it. Lint and unit tests do (both tsconfigs glob
  `src/**`). A build target for the secondary entry point is out of scope here.
- Inherits the engine's existing `sourceIndex` miss for expansion children: `indexById`
  (`engine/core.ts`) is built from `data()`'s top-level entries only, so a nested expansion
  child's `sourceIndex` is `undefined` even though `data` is non-null. Pre-existing behavior;
  the directive surfaces it (renders nothing for such rows) rather than introducing it.

## Open — carried forward

> **The index of what is still open lives in the gap registers**, mapped to the gaps each
> question gates: [state](./5-gaps.md#open-decisions), [UI](../../../3-ui/work/row-editing/5-gaps.md#open-decisions). This section keeps
> the reasoning; go there for the current status.

- **O13** ~~A `beginEdit` snapshot (D17) can go stale if `data` changes from another source while
  the row is open.~~ **Closed by D34.**
- **O11** Does `withRowEdit()` fire a `rowEditChanged` event (mirroring `withExpansion`'s
  `rowExpanded` Observable), or is `editingRows` the only notification? Same question as O6
  (mutation decisions) — decide both together.
- **O15** *(narrowed by D24/D25 — filter only)* How does the `filter` stage express "keep these ids
  even though the predicate rejects them"? Stages are `(rows) => rows` with no access to any set
  outside their own feature's closure. Sort and group no longer need this; the filter retention of
  D25 does.
- **O16** *(largely dissolved by D24)* "Holds its display position" is no longer needed for sort or
  group. What remains is narrower: where a *retained* row (D25) sits once it no longer matches the
  filter — in place, or collected somewhere?
- **O22** *(new, from D31 — 2026-08-25)* **Is optimistic rollback an editing concern or a mutation
  concern?** D31's `pending` map covers optimistic **update** (snapshot is the prior row) and
  optimistic **create** (snapshot is `ABSENT`, so rollback removes the row — D28 gave this for
  free). It does **not** cover **delete** or **move**, and not by omission:
  - No entry point. `removeRow(id)` goes through `table.value.update()` and never touches the
    editing maps, so nothing captures a snapshot to keep.
  - `revertEdit` could not restore one anyway. It restores by mapping over `data`
    (`data.map(row => trackBy(row) === id ? snapshot : row)`) — a row that is gone matches
    nothing, so the write is a silent no-op. It replaces in place; it cannot re-insert.
  - A snapshot holds a *value*, never an index, so position is unrecoverable even with a fixed
    restore. Same reason `move` is uncovered.

  This is review finding #5 seen from the other side: [ADR-0006](../../../../../adr/0006-row-id-state-reconciliation.md)
  **dissolves** it by reconciling the entry away when the row leaves `data` — which locks in "no
  optimistic delete" rather than fixing it. Worth re-reading O22 against ADR-0006 before that ADR
  ships.

  The mechanism as built is optimistic *editing*, not optimistic *CRUD*: it exists only when
  `withRowEdit()` is composed, is keyed by row id, and every entry point is an editing verb. A
  table with a Delete button and no editing feature (D18 — actions are consumer template code
  calling `removeRow`) has no rollback story at all. Two coherent designs, and D31 picked the
  first without weighing the second:
  1. `pending` stays editing-scoped. Optimistic delete is the consumer's problem — they hold the
     row and its index themselves and re-`addRow` on failure.
  2. Optimistic-ness becomes its own concern — a pending-mutations slice over
     `table.value.update()` holding an **inverse operation** rather than a value snapshot, so it
     covers delete and move too. `withRowEdit()` would compose it rather than own it.

  Deliberately **not designed now** (decided 2026-08-25). Option 2 needs an inverse-op
  representation the library does not have, and no consumer needs optimistic delete yet. Re-derive
  when one does, rather than implementing from these notes.

  **Read against D32** (mutation decisions): bulk operations settle on widened arity plus
  `batch()`, so an inverse-op design would have to cover a batched write as one rollback unit, not
  N independent ones.
- **O19** *(new, from D24)* Do we export a schema fragment (`editableRow(row, columns)`) so the
  commit boundary is one call rather than per-column discipline? Lowers misconfiguration risk;
  imports Signal Forms types into our lib, which is the coupling D23 rejected — though as an opt-in
  export rather than a type in the core API. **Not resolved by D31** — the schema fragment and the
  `*ngpTableRowField` directive are independent slices; D31 only settles the directive.
- **O17** *(new, from D22)* `applyEach` validates rows the user cannot see (filtered out, other
  pages), so `valid()` can be false because of row 4,000. How are submit and "save all" scoped?
- **O18** ~~*(from D20 + D22, surfaced while costing D23)*~~ **Closed by D24** — with
  `debounce('blur')` there are no per-keystroke writes to `data`, so there is no per-keystroke
  pipeline run to cost. Recompute happens once per commit. The original text is kept below because
  the `indexById`-rebuild-on-`patchRow` observation still applies to bulk writes.

  **Per-keystroke pipeline cost at
  scale.** The array form writes to `data` on every character and D20 keeps the pipeline live, so
  each keystroke runs filter + sort + group + the `indexById` rebuild over the entire row set — a
  sort per character at 10k rows. This is the cost the snapshot model we rejected avoids by not
  re-running at all. Two candidate mitigations, neither evaluated: skip the `indexById` rebuild
  when `data`'s identity order is unchanged (covers the `patchRow` case), and debounce the pipeline
  above some row count. Needs a measurement before either is chosen.

  **D20 does not already cover this** — it fixes correctness (the row does not jump), not cost; the
  pipeline still recomputes over the other n−1 rows per keystroke. But D20 supplies the invariant
  that makes a fix sound: an exempt row is outside the comparison set, and filter/group membership
  is per-row, so **editing an exempt row cannot change the pipeline output for any other row**.
  When every changed row is exempt, the previous output is still correct and the run can be skipped
  outright — which collapses the keystroke case rather than merely debouncing it.

  What blocks that: the engine cannot tell *which* rows changed. `data` is a whole-array signal, so
  an emission carries no row information. `updateRows(table, patchRow(id, …))` knows the exact id
  at the write site and currently discards it. Making this work means the engine tracks a
  changed-id set fed by the write path — new machinery, and unsound if a consumer bypasses
  `updateRows` with a direct `data.set()`, which D4/D11 (mutation decisions) explicitly allow.

- [ ] **O23** *(from D35)* Should openness also be **declarative** — an `applyEditable({ when })`
      rule mirroring `applyVisible()`, so rows matching a predicate open without a call site? See
      D35's "What this does not do" for the three collisions that have to be answered first.
      **Blocked on G4** (`{ multiple: true }`), which a predicate matching N rows forces open.

**Resolved:** O2→D10, O3→D18, O4→D15/D16/D17, O11 (multi-row)→D14, O10→D22, O12→D23,
O14→D20 (mechanism superseded by D24), O18→closed by D24, O21→D28, form scope→D22,
D13→revised by D21, D20 mechanism→D24, D23 directive clause→D33.

## D35 — `addNewRow(row, opts?)`: add and open as one write (2026-08-25)

**Decision:** Ships a seventh editing updater. `addNewRow` writes the row into `data` and opens
it, with the restore point set to `ABSENT` directly rather than derived from a lookup.

```ts
table.editing.update(addNewRow({ id: crypto.randomUUID(), ...blank }, { at: 0 }));
```

**What it replaces:** D28's two-call blank-row flow, where `beginEdit` → `addRow` versus
`addRow` → `beginEdit` selects discard-vs-reset **by call order alone**, silently and with no
error in either direction. D28's analysis stands — both intents are real — but only one of them
now depends on getting an order right. Reset remains the explicit two-call sequence.

**Why it cannot be `addRow(row, { edit: true })`**, which was the first thing asked for. The two
slices have deliberately asymmetric updater contexts:

| Updater kind | Signature | Can write |
|---|---|---|
| `RowUpdater` (`table.value`) | `(rows, { trackBy }) => TRow[]` | `data` only — it returns an array |
| `EditingUpdater` (`table.editing`) | `(state, { data, trackBy, writeData }) => EditingState` | both — `writeData` is in its context |

A flag on `addRow` has nothing to write to. The asymmetry is not incidental: `withRowEdit()` is
opt-in and most tables do not compose it, so core mutations cannot reference it. The dependency
runs plugin → core and never back — the same direction ADR-0006 enforces, where the engine
announces removals and features prune their own state.

The naming cost is accepted and real: the verb says "row", the call site says `.editing`. Every
alternative hid one half or the other. `beginAdd` (symmetric with `beginEdit`) was rejected for
naming the edit side while the consumer's intent is "add a row".

**No-ops when the id is already in `data`** rather than throwing — the house rule for every
updater. Adding a duplicate id would break `trackBy` uniqueness for every consumer of it and
overwrite an existing restore point with `ABSENT`, so Cancel would delete a row it did not
create. `patchRow` is the verb for an id that exists.

### What this does not do — `applyEditable({ when })`, tracked as O23

The alternative raised alongside it: a declarative rule on the schema, mirroring `applyVisible()`
— *rows are editable when this predicate holds* (e.g. every field empty), so a row added by any
path, including a wholesale `data.set(...)`, opens with no call site at all.

The mechanism is expressible. D2/D4 of `../effect-free-column-reactivity/2-decisions.md` give the
shape, and its D1 gives the constraint: never let a rule and an imperative write share one signal.
Applied here that is `baseOpen` (writable, `beginEdit`/`endEdit`) plus a derived rule overlay,
with `open` a `computed` over both.

Three collisions have to be answered before it is worth building, and none is about the fold:

1. **Unclosable rows.** D2's accepted consequence is that the rule wins over the imperative write.
   For a column that is harmless — a column has no user-owned lifecycle. For a row it means
   `endEdit(id)` is a no-op while the predicate holds. The motivating predicate (*all fields
   empty*) traps exactly the user who opens a blank row, types nothing and blurs: neither Save nor
   Cancel can close it.
2. **It forces G4.** A predicate matching three rows wants three rows open; `{ multiple: false }`
   is the default (D14). A row rule does not merely touch the undesigned `multiple: true`
   configuration, it requires it resolved.
3. **Emptiness is a proxy for provenance, and leaks both ways.** The real intent is "this row was
   just added and never saved". A real row the user cleared matches the predicate; a new row with
   a prefilled default does not. `addNewRow` states the provenance directly.

**Where a rule would genuinely earn its place**, and `addNewRow` cannot reach: rows arriving
already-editable from a wholesale `data.set(...)` — a server-supplied draft, a bulk import. There
is no call site to hang an updater on. That is the case to design the mechanism for, not
blank-row-add.

## D36 — `addNewRow` stops forcing `ABSENT`; discard is composed, not a `revertEdit` option (shipped 2026-08-26)

**Status: shipped.** Supersedes the part of D35 that ties `addNewRow`'s Cancel outcome to how
the row was added. Went through two shapes in the same session — recorded because the rejected
first shape's reasoning is instructive, not just the final one.

**Decision:** `addNewRow(row, opts?)` captures `row` itself as the restore point — the same
mechanism `beginEdit` uses on an existing row — instead of forcing `ABSENT`. This makes
`addNewRow` and the `addRow` → `beginEdit` two-call sequence **behaviorally identical**;
`addNewRow` is now pure ergonomics (one call instead of two), not a separate intent. Plain
`revertEdit(id)` therefore **resets** an `addNewRow`'d row instead of removing it.

`revertEdit` itself is **unchanged** — no new parameter, no discard option. A consumer who wants
Cancel to remove the row instead composes it explicitly, the same shape Save already composes:

```ts
table.value.update(removeRow(id));   // core: data only
table.editing.update(endEdit(id));   // closes the editing entry
```

**First shape, rejected:** `revertEdit(id, { discard?: boolean })`. Walked back because
`revertEdit`'s contract is "go back to the snapshot" — a discard is not a revert, it is a
different operation, and giving one function two unrelated jobs behind a boolean is the kind of
flag `withRowEdit()` elsewhere avoids (no store verbs, D16/D30; composition over configuration).
`removeRow` + `endEdit` already exists, already means exactly "remove this row and close its
editing entry," and needs no new API surface at all.

**Why D35's original premise was wrong, not just its API shape.** D35 reasoned discard-vs-reset
had to be selected at add-time because nothing else knew whether the row was new. That conflates
two separate things: the *mechanism* (what value gets captured — this only add-time can supply)
and the *Cancel policy* (discard vs. reset — this is a consumer decision, not a fact about the
row). `addNewRow`'s `row` argument already carries real field values, so capturing and restoring
it is a valid default; a consumer who additionally wants "and delete on Cancel" already knows
which button they wrote, and says so by composing `removeRow`, not by threading a flag back
through `revertEdit`.

**`ABSENT` is not removed from the model.** It stays exactly where it already serves a different,
genuine purpose — a snapshot representing "no row exists for this id":
- `beginEdit(id)` on an id not yet in `data` (D17's fallback path, `row-edit-mutations.ts`).
- `rebaseEdit(id)` re-reading `data()` for an id that is gone.
- ADR-0006's pruning exemption for `ABSENT` snapshots (`with-row-edit.ts`) — nothing to prune
  when nothing was ever backed by a row.

`revertEdit` still checks `snapshot === ABSENT` and removes unconditionally in that case — there
is nothing to restore to. That branch is untouched by this decision; only `addNewRow`'s stopped
forcing it.

**What changed in code:**
- `addNewRow` (`row-edit-mutations.ts`): captures `withSnapshot(state.snapshots, id, row)`
  instead of unconditionally `ABSENT`.
- `revertEdit`: unchanged signature; doc comment now points to the `removeRow` + `endEdit`
  compose for the discard case.
- `docs/1-state/features/row-editing.md` §2/§3 amended to match.
- Tests (`row-edit-mutations.spec.ts`) updated: `addNewRow` now asserts a real-value snapshot;
  a new test covers the `removeRow` + `endEdit` compose; a new test covers plain `revertEdit`
  resetting an `addNewRow`'d row.

**Not yet done:** story/demo call sites (`libs/shared/table/src/stories/gated-edit/*`,
`apps/demo/.../table-row-edit-demo`) still call `revertEdit(id)` unconditionally from a single
`cancelEdit` handler for both the discard-intent and reset-intent Add buttons — those need to
route the discard-intent button through the composed `removeRow`+`endEdit` call instead, tracking
per-row which intent applies (e.g. a `Set<RowId>` of ids added via the discard button).

## D49 — O20 resolved: `swapRowId(from, to)`, no forced end-edit (2026-09-03)

**Status: implemented 2026-09-03.** Handoff at
[`../swap-row-id/1-handoff.md`](../../archive/swap-row-id/1-handoff.md). Resolves **O20** and, with it,
**O24** (`swapRowId`'s home) — closes G3.

**Decision:** reject "enforce end-edit-first" as the id-swap policy. Add one new `EditingUpdater`,
`swapRowId(from, to)`, that re-keys whichever of `open`/`snapshots` hold `from` to `to`. A row may
be open, mid-edit, when its temp id swaps to the server id — the swap does not close it, block it,
or disable anything.

**Why end-edit-first was rejected, not just deferred.** The product goal for optimistic tables
(stated in this session) is that a consumer-visible action is never gated on the state layer's
internal sync — the person keeps typing through a create/save round-trip regardless of when the
server responds. Enforcing "no swap while open" only has two implementations, and both violate
that goal: block the swap until the row closes (state visibly lags the server), or block opening
a still-`pending` row for edit (an action disabled because of internal sync state — the exact
thing ruled out). So the migrate-the-key option is not a preference between equally-valid choices;
it is the only one left once "never block on internal sync" is taken as a constraint.

**Why a new verb instead of reusing `patchRow`.** `patchRow` was considered — call it with the
server's row, including the new id, and let existing machinery do the rest. Rejected: rewriting a
row's trackBy-identifying field via `patchRow` makes `tempId` disappear from `indexById` on the
next recompute, which is exactly what ADR-0006's removal-diff watches for — it fires
`onRowsRemoved([tempId])`, and `pruneByIds` deletes the `open`/`snapshots` entry rather than
migrating it. That is the same "indistinguishable from delete + unrelated insert" failure the
gap register already named for engine-side detection; driving it through `patchRow` hits it from
the consumer side instead of the engine side, same outcome.

**Why `swapRowId` does not itself write `data`.** `trackBy` is `TrackByFn<TRow>`
(`(row) => RowId`), not necessarily a key — a consumer may supply an arbitrary function, so no
updater outside `createTable()`'s own config can generically know which field to overwrite to
change a row's id. `swapRowId` therefore only touches `open`/`snapshots`; the consumer still
calls `patchRow`/`insertRow`+`removeRow`/whatever produces the row under its new identity. Two
calls, not one — narrower than the `discardEdit`-style "one call" precedent, and that gap is the
one open risk this decision accepts (see the handoff's Open section).

**Why the two-call order is safe, not just conventional.** ADR-0006's reconciliation runs in an
`effect()` (`engine/compose-table.ts`), and Angular effects are scheduled, never synchronous
within the writing call stack. A consumer calling `table.value.update(patchRow(...))` immediately
followed by `table.editing.update(swapRowId(...))` in the same synchronous handler always has
`swapRowId`'s re-key land before the reconciliation effect flushes — by the time it runs, `to` is
already the key in `open`/`snapshots`, `from` never was, and the diff has nothing to prune. This
is a real invariant of the current effect-scheduling model, not an assumption; the handoff adds a
test pinning it so a future change to that scheduling can't silently reopen G3.

**Not this decision:** the shape of the confirm-create call site (whether `swapRowId` composes
with a `settleEdit`/`releaseEdit`-equivalent call, e.g. for a row that was also mid-save when the
id landed) — out of scope, tracked as an open item in the handoff.
