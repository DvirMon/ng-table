# Decisions — withSelection()

Grill started 2026-09-05. Source: `docs/1-state/features/selection.md` (spec: stub),
handoff `handoffs/handoff-table-with-selection.md`, ranking
`../state-feature-competitive-audit/gap-analysis.md`.

## Dependency ranking (decompose-by-dependency-graph)

Sub-features listed, edges mapped between nodes:

| Node | Rank | Edge |
|---|---|---|
| A. Selection scope (page / filtered / all) | **core** | B, C, D, E, F all depend on it |
| B. State shape + mode (single/multi) | dependent | needs A |
| C. Public verbs (toggle/select-all/clear) | dependent | needs A, B |
| D. `RenderRow.isSelected` / render stage claim | dependent | needs B |
| E. `onRowsRemoved` pruning contract (ADR-0006) | dependent | needs B |
| F. Bulk `removeRow(id[])` / `patchRow(id[], partial)` unblocking (D32) | dependent | needs C |
| G. Persistence of selection (state-persistence.md open Q) | dependent, deferrable | needs A |
| H. UI directive layer | out of scope | state layer only |

Grill order: A first, then B/C/D/E, then F. G recorded but deferred to `state-persistence.md`.

## Decisions

_(appended as they settle)_
- **D1 (2026-09-06) — no selection-scope concept.** `withSelection()` stores `RowId`s and nothing
  else. There is no `scope: 'page' | 'filtered' | 'all'` config and no per-call scope argument;
  "select all" is the call site passing the id set it means (`table.rows().map(r => r.id)`, a
  server-supplied list, whatever). Consequence: **no runtime or compile-time dependency on
  `withPagination()` / `withFiltering()`** — closes the cross-cutting open question in
  `architecture.md` ("select all scope"). Rationale: the audit's #1 finding is that every
  competitor's scope enum blurs the distinction; refusing to name it is how we lead rather than
  inherit it. Per `general-mechanism-over-enumerated-cases`.
  **Rationale amended 2026-09-06** (challenged during D2): the reason is not "no enumerated
  config." It is narrower — reject config whose meaning depends on state the feature does not
  own. A `scope` enum fails that test: `'page'` is unresolvable unless `withPagination()` happens
  to be composed, so it fails silently on absence and shifts meaning per call site. Config that
  parameterizes a verb the feature *does* own is fine, and D2 adds one.
- **D2 (2026-09-06) — `toggle(id)` ships, governed by a per-row multi predicate.** Config:
  `withSelection({ enableMultiRowSelection?: boolean | ((row: TRow) => boolean) })`, default
  `true`. `toggle()` clears the set before selecting when the predicate is false for that row;
  otherwise it adds/removes that id and leaves the rest untouched. Follows the shape verified in
  `@tanstack/table-core@8.21.3/src/features/RowSelection.ts` (`mutateRowIsSelected` deletes every
  key when `row.getCanMultiSelect()` is false). There is **no `mode: 'single' | 'multi'` state** —
  single-ness is a rule on the verb, never a stored value, and it is scoped per row so a
  predicate can express per-row rules (e.g. locked rows) a boolean cannot.

  Chosen over multi-only because it keeps tier 1 (`ngpTableSelectionCheckbox`) usable for
  master-detail pickers: under multi-only, a single-select consumer must bypass the shipped
  directive and write their own click handler, which makes the directive layer serve only one
  selection flavor. Passes the D1-amended test: the rule resolves inside `toggle()` against a row
  the feature already holds — no cross-feature dependency.

- **D3 (2026-09-06) — the state ↔ UI seam is not hybrid; directives store nothing.** A directive
  may inject `NGP_TABLE_STORE`, call a verb, and reflect signals into ARIA/`data-*`. A directive
  may never be where a fact is stored. Confirmed against shipped code (`ngpTableExpandToggle`
  calls `store().toggleExpanded()`; `NgpTableRowDirective` only reflects its `RenderRow` input).
  Corollary for API proposals: known before interaction → declarative config; caused by
  interaction → verb. Full note: `0-architecture-seam.md`.

- **D4 (2026-09-06) — `docs/3-ui/directives/selection.md` is unblocked.** Its "Known Blocker"
  (select-all scope) is answered by D1 and must be struck when that file is drilled.
- **D5 (2026-09-06) — selection is read from the signal, not stamped on `RenderRow`.** No
  `isSelected?` field, no render-stage claim. Tier 0 reads
  `table.selectedRows().has(row.id)` in the template; tier 1's directive computes the same via DI.
  Rationale: stamping would rebuild the whole `RenderRow[]` on every checkbox click (re-running
  the `RENDER_ORDER` chain and re-diffing `@for`), where signal reads cost one `Set.has()` per row
  against attribute bindings only. Divergence from `withExpansion()`'s `isExpanded` stamp is
  deliberate — expansion *changes which rows exist*, selection does not.

- **D6 (2026-09-06) — `ngpTableSelectionCheckbox` supports native `<input type="checkbox">` only.**
  Component checkbox hosts (Angular Material, a consumer's own DS wrapper) are **not** auto-wired.

  Why they can't be: an attribute directive's host bindings target the element, not a sibling
  component's inputs, so `[checked]`/`(change)` never reach the component. Angular's own `Field`
  directive solves this through `ɵngControlCreate(host)` — a private compiler hook dispatching to
  CVA / `customControl` / native paths (verified in installed `@angular/forms@22.1.2`,
  `fesm2022/signals.mjs`) — which is not public API. The `NG_VALUE_ACCESSOR`-injection workaround
  would cover CVA components (`MatCheckbox` does provide it, verified in published
  `@angular/material@20.2.0/fesm2022/checkbox.mjs`) but not signal-model components exposing only
  `checked = model()`. **Deliberately deferred, not rejected — recall if demand appears.**

  What ships instead: a documented recipe. The consumer authors a thin directive on their own
  component, injecting the component instance *by type* — which they can do and the library cannot
  — plus `NGP_TABLE_ROW` and `NGP_TABLE_STORE`. Both tokens are already public (`src/index.ts`
  re-exports `directives/table.tokens`), so this needs no new API surface. Belongs in
  `docs/3-ui/directives/selection.md` when that file is drilled.
- **D7 (2026-09-06) — tri-state ships as `selectionStateOf(ids)`, the caller supplies the
  denominator.** Signature: `selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all'`.
  The feature never picks what "all" means (D1 holds), but the tri-state logic is written once
  instead of in every consumer. Makes a tier-1 header directive possible — it takes the id set as
  an input (`[ngpTableSelectAllFor]="table.rows()"`) rather than inferring one. Rejected:
  exposing `allSelected`/`someSelected` computed against `core.rows()`, which would reintroduce
  D1's ambiguity through a default denominator.
- **D8 (2026-09-06) — `toggle(id)` never inspects whether the id is data-backed.** An id absent
  from `indexById()` still toggles; D2's `enableMultiRowSelection` predicate defaults to `true`
  when there is no row to test. Rationale: a checkbox must respond to a click, always — the UI
  state follows the click, not a lookup. Selection stays a pure id set with no data-backed
  invariant.

  Consequence to carry forward: `onRowsRemoved` (ADR-0006) only announces ids that left `data()`,
  so a synthetic or stale id entering the set is never pruned by it. Accepted — with D5 (no
  `RenderRow` stamp) an unmatched id renders nothing, so it is inert rather than corrupting.

## Open questions

- **Group-header select-all.** A checkbox on a `withGrouping()` group header should plausibly mean
  "select every row in this group." D8 makes the synthetic group id *selectable*, but selecting the
  header id is not the same as selecting its members. Undecided whether this is library API (a verb
  that expands a group id to its member ids) or consumer code (`select(groupRows.map(r => r.id))`).
  Not blocking `withSelection()` — `withGrouping()` is unbuilt. Must be represented in the product
  use-cases / story set either way.
- **D9 (2026-09-06) — `selectionChanged: Observable<SelectionChange>`, CDK-shaped, delta payload.**

  ```ts
  export interface SelectionChange {
    readonly added: readonly RowId[];
    readonly removed: readonly RowId[];
  }
  ```

  Current state is read from `selectedRows()`, not carried in the payload — matching Angular CDK's
  `SelectionChange<T> = { source, added, removed }`, where `source` exists only so a consumer can
  reach `source.selected`. Our signal already serves that role, so no back-reference is needed.

  Emission rule: **exactly one emission per write verb** (`toggle`, `select`, `deselect`,
  `clearSelection`), carrying that write's full delta. Bulk writes emit once, not N times. A write
  that changes nothing (deselecting an unselected id) emits nothing. This rule is the point — it is
  what makes an `expandAll()`-style silent hole impossible by construction.

  Rejected — inferring "what changed" from `Set` insertion order (the initial proposal): a Set is a
  state container with no representation for a removal, `add()` on an existing value does not
  reorder it (language spec), and it has no per-write boundary. Deselect, `clearSelection()`, and
  bulk `select([...])` all defeat it. No researched library attempts it.

  Rejected — a `lastSelectionChange` signal instead of a stream: signals coalesce, so two writes in
  one tick collapse and the first delta is lost — fatal for the server-sync/analytics case that
  motivates the member at all. Signals also always hold a value, so a late-mounting effect replays a
  change that already happened; the nullable type is that flaw surfacing. Observable has no replay,
  which is the correct semantic for an event. Consumers wanting a signal call `toSignal()`.

  Evidence: `research-selection-change-events.md` — of five libraries read, CDK is the only one
  shipping a delta, and the only one whose sole responsibility is selection state (no rendering),
  making it the closest analogue to this layer. PrimeNG's `onRowSelect`/`onRowUnselect` split is the
  same delta in two streams and cannot express a write that both adds and removes (D2's
  single-select replace). AG Grid and TanStack ship no delta at all.

- **D10 (2026-09-06) — the `RowIdSetChange` cross-feature convention is NOT adopted now.**
  `SelectionChange` is selection-local. `withExpansion()` keeps `rowExpanded: Observable<RowId>`;
  its bulk-emission gap is fixed independently (spawned task `task_5ae333ea`). Promote to a shared
  type + ADR only when a third set-owning feature (`withGrouping()`) gives real evidence the shape
  generalizes — per `file-organization.md`, promote on evidence, never on anticipation.

  Deliberately *not* decided: AG Grid's orthogonal idea of a `source` discriminator on the event
  (`'checkboxSelected' | 'apiSelectAll' | …`) — answering *why* selection changed rather than
  *what* changed. Recorded in the research file in case a UI-vs-programmatic distinction is ever
  needed.
- **D11 (2026-09-06) — `onRowsRemoved` pruning is silent; it does not emit `selectionChanged`.**
  ADR-0006 reconciliation prunes `selectedRows` (via `pruneByIds`, `engine/rows.ts`) with no
  exemption — a deleted row's id must leave the set. But the emission is suppressed.

  D9's rule is therefore stated precisely as: **every selection *write verb* emits exactly once;
  reconciliation is not a write verb.** This is not the `expandAll()` hole — that bug dropped
  *user intent*. A prune carries no intent: nobody selected or deselected anything, the row ceased
  to exist. `selectedRows()` still updates, so any consumer reading state sees the change
  immediately; only the intent log stays quiet.

  Motivating scenario: a consumer's "delete selected" flow already issues its own request, then the
  row leaves `data()`, then a pruning emission would announce `removed: [id]` for a row the
  consumer just deleted — a naive server-sync subscriber would fire a redundant request. One user
  action must not produce two notifications.

  Supporting fact: selection is client/session state, not server state — none of the five libraries
  in `research-selection-change-events.md` persists it, and `state-persistence.md` records PrimeNG
  deliberately excluding selection from its persisted slices. What reaches a server is the action
  the selection enabled (bulk delete/patch), never the selection itself.

  Rejected — a `cause: 'write' | 'prune'` discriminator on the payload: solves the same problem by
  making every consumer filter, and expands `SelectionChange` past CDK's shape immediately after
  D10 deferred the `source` concept.
- **D12 (2026-09-06) — bulk `removeRow(id[])` / `patchRow(id[], partial)` are out of scope.**
  This effort ships `withSelection()` alone. D1–D11 unblock the bulk verbs, but they become their
  own ticket. `row-mutations.md`'s "Not Shipped" table must have its blocker updated from "needs a
  selection source; `withSelection()` does not exist" to "unblocked by `withSelection()`, not yet
  built". Rationale: bulk *edit* requires resolving D31.2 first (`multiple: true` combined with
  optimistic save is explicitly undesigned per `row-mutations.md`) — an editing question that does
  not belong in a selection grill.
- **D13 (2026-09-06) — selection ids are flat; no parent/child cascade.** Selecting a row selects
  exactly one id. A consumer wanting subtree behavior writes `select([parent.id, ...childIds])`
  themselves. `withSelection()` therefore takes no children accessor and has no dependency on
  `withExpansion()` — `composed` stays unused (D37/A2).

  Grounds: `data()` is a **flat array** by product invariant (stated by the user 2026-09-06);
  hierarchy is an internal, UI-facing construct of a grouping/tree feature, not a shape the raw
  `value`/draft data ever takes. With flat data there are no nested child rows to cascade to.

  Also avoided by this decision, had cascade been adopted: choosing between a flattened set (breaks
  on lazily-loaded children — a parent checked before its children are fetched leaves them
  unchecked forever, and nothing re-runs the cascade) and a derived set (`selectedRows()` stops
  enumerating what is actually selected, so a bulk delete over it deletes one row instead of the
  subtree); plus indeterminate parent state and ancestor-walking writes, neither of which D7's
  flat `selectionStateOf(ids)` covers.

- **D14 (2026-09-06) — the multi-select rule constrains every write verb, not just `toggle()`.**
  `select(['a','b'])` under a row whose `enableMultiRowSelection` predicate is `false` keeps the
  last id only — the same clear-then-add rule D2 gives `toggle()`. The invariant is about the set,
  not about clicking: it never holds two ids whose predicate is false.

  **Under `ngDevMode`, throw** naming the discarded ids; truncate silently in production builds.
  Rationale: `select(ids)` is frequently fed by runtime data rather than authored literals —
  selection restored from storage or a URL, a server response, or a per-row predicate that only
  trips on certain datasets — so a hard throw turns a data mismatch into a crash on a startup or
  response path. A dev-only branch is loud where it helps and stripped where it hurts, matching
  Angular's own use of `ngDevMode` guards.

  Rejected — CDK's unconditional throw (`getMultipleValuesInSingleSelectionError`): CDK's
  `SelectionModel` is constructed directly by application code owning both the mode and the values,
  which is not our call-site profile.

- **D15 (2026-09-06) — no-op writes emit nothing, and duplicate ids collapse.** `select([])`,
  `select(ids)` where every id is already selected, `deselect(ids)` where none is selected, and
  `clearSelection()` on an empty set all change nothing and therefore emit no `selectionChange`
  (D9). Duplicate ids within one call (`select(['a','a'])`) collapse to a single set entry and
  appear once in `added`. The delta always describes what actually changed, never what was asked
  for.

- **D16 (2026-09-06) — `initialSelection?: RowId[]` config, and construction emits nothing.**
  Matches CDK's `initiallySelectedValues`. Puts the persisted-restore case on one declarative line
  where the feature is declared, consistent with D3 (known before interaction → config).

  Construction is **not** a write verb, so it produces no `selectionChange`. This is forced by the
  mechanism as much as by D9: `selectionChanged` is a plain `Subject` with no replay, and no
  subscriber can exist at construction time, so an emission there would reach nobody. Duplicate ids
  in `initialSelection` collapse per D15; the D14 multi-select rule applies to it as it does to any
  other write, dev-mode throw included.

  **Two implementation constraints the spec must state explicitly**, because both are easy to break
  without any test noticing:
  1. `selectionChanged` is a **non-replaying `Subject`** — never a `ReplaySubject`/`BehaviorSubject`.
     A replaying variant would deliver the construction state to every late subscriber, which is
     exactly what this decision forbids.
  2. `initialSelection` must be written **directly into the signal**, not routed through `select()`.
     `select()` emits by D9, so reusing it as the constructor shortcut reintroduces the emission.

- **D17 (2026-09-06) — the stream completes in `onDestroy`.** `TableFeatureSpec.onDestroy` calls
  `selectionChangedSource.complete()`, so subscribers terminate with the table rather than leaking.
  Note `withExpansion()` does not currently complete `rowExpandedSource` — same class of gap as its
  bulk-emission hole; not fixed here.

- **D18 (2026-09-06) — async initial selection uses a silent write: `{ emitEvent: false }`.**
  The write verbs take an options argument: `select(ids, { emitEvent: false })` sets the state
  without emitting `selectionChanged`. Precedent: Angular reactive forms' `setValue(v, {
  emitEvent: false })`. Covers async restore (ids arriving from a server after construction) and any
  later programmatic sync. `initialSelection: RowId[]` (D16) stays for the sync case.

  This generalizes D11 from one hard-coded case to a caller-controlled one: pruning is silent
  because it carries no intent, and a restore carries no intent either. The failure mode is a
  caller forgetting the flag — a *visible* spurious emission, unlike the silent no-op a latched
  signal input would produce.

  Rejected — `initialSelection?: RowId[] | Signal<RowId[]>` seeded once: the type promises
  reactivity the implementation refuses, so a later update to that signal does nothing, silently,
  with nothing to tell the consumer why. Rejected — a fully reactive consumer-owned selection signal
  wrapped as a `WritableView` (the `core.value`/D30 shape): coherent, but it makes selection state
  consumer-owned, supersedes D16, and needs a write-through rule — real design work for a case that
  is one-time by nature.

  Rejected — a `restore: () => RowId[] | Promise | Observable` persistence hook on the feature
  config: [`state-persistence.md`](../../state-persistence.md) Rule 1 forbids exactly this — "no
  per-feature save/restore hooks a consumer can call individually," because piecemeal restore is how
  PrimeNG lost column order (#14888).

- **D19 (2026-09-06) — `withSelection()` will declare a `selection` `FeatureSnapshotSlice` when
  persistence is built; it ships no persistence of its own now.** Per `state-persistence.md`'s
  proposed `TableFeatureSpec` addition (`{ key, read(), write() }`, key claimed via
  `engine/slots.ts`). Its `write()` uses D18's silent path, which is what satisfies that spec's
  Rule 2 — feature `*Changed` events must not fire N times mid-restore. So D18's option is not a
  competitor to the persistence design; it is the primitive that design requires.

  Also unblocked: `state-persistence.md`'s open question "is selection persisted?" was parked on
  the selection-scope ambiguity, which D1 removed. Deciding it belongs to that spec, not here —
  note that PrimeNG deliberately excludes selection from its persisted slices, and D11 records
  selection as client/session state.

- **`indexById` covers only top-level rows.** Built as `config.data().forEach(...)`
  (`engine/core.ts:52-56`), so any id not in the top-level array is absent from it. Consequence for
  ADR-0006: the engine can only announce removals for top-level rows, so a feature storing a
  non-top-level id would never have it pruned. Inert under D13 (flat data ⇒ every id is top-level),
  but latent for any future feature that stores nested ids — `expandedRows` already can, via
  `toggleExpanded(childId)`.

- **`withExpansion()` contradicts the flat-data invariant.** Its default `childrenAccessor` reads
  `row.children` and its `'tree'` render stage recursively flattens nested `TRow` children into
  `renderRows()` — the feature only does anything when `data()` is *not* flat. Likely resolved by
  ADR-0012 (`proposed`), which splits expansion into a detail-panel feature plus a new `withTree()`;
  nested data would then be legal only under `withTree()`. Not a selection decision — recorded
  because D13 rests on the invariant.
