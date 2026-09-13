---
title: Gap analysis — Storybook stories vs. product selection stories
type: plan
status: open — proposal, nothing here built yet
date: 2026-09-13
parent: ../../architecture.md
---

# Selection — Story Coverage Report

Measures [`0-product/selection.md`](../../../0-product/selection.md)'s user stories against the 9
Storybook stories in `src/stories/`, then proposes the target set. Story shape follows
[`3-ui/stories.md`](../../stories.md); the sibling report for row editing is
[`row-edit-stories/2-gap-analysis.md`](../row-edit-stories/2-gap-analysis.md) (structure reused,
content not repeated).

**Revised 2026-09-13** to incorporate the `1-state/work/with-selection/research-*.md` corpus, which
the first pass was written without — above all
[`research-selection-ux-capabilities.md`][ux], the version-pinned capability inventory of what a
person can click, tap and press across CDK `SelectionModel`, TanStack v8, AG Grid, Material React
Table and PrimeNG. The first pass derived story shapes from the product doc alone, so its
affordances were *invented* rather than *conventional*; the new
["Conventions from peer libraries"](#conventions-from-peer-libraries) matrix is the grounding, and
every target story's affordance list is re-checked against it. [`research-selection-community-pain.md`][pain],
[`research-selection-internal-coverage.md`][internal], [`research-row-selectability.md`][lock] and
[`research-selection-change-events.md`][events] are folded in the same pass.

Coverage marks in the product doc are re-derived here from code, not taken on trust. Verified
against `src/api/features/with-selection.ts`, `selection.utils.ts`, both `.spec.ts` files,
`src/directives/`, and every `*-story-host.component.ts`, cross-checked against [`research-selection-internal-coverage.md`][internal].

[ux]: ../../../1-state/work/with-selection/research-selection-ux-capabilities.md
[pain]: ../../../1-state/work/with-selection/research-selection-community-pain.md
[internal]: ../../../1-state/work/with-selection/research-selection-internal-coverage.md
[lock]: ../../../1-state/work/with-selection/research-row-selectability.md
[events]: ../../../1-state/work/with-selection/research-selection-change-events.md

## Step 1 — Existing stories that touch selection

**None.** `grep -ri "selection\|selectedRows\|selectAllIds\|withSelection\|checkbox" src/stories/`
returns zero matches across all 9 folders (`external-write/`, `form-write-mutations/`,
`gated-bulk-optimistic/`, `gated-multiple-optimistic/`, `gated-single-optimistic/`,
`gated-single-pessimistic/`, `live-optimistic/`, `live-table/`, `sorting-editing/`). Every host
doc-comment names a row-editing decision (S1/S2/S4/S5/S6/S8, D29/D31/D39/D41/D49, OQ-3/OQ-7); none
names a selection one. `src/directives/` has no selection file —
[`3-ui/directives/selection.md`](../../directives/selection.md) is `spec: stub, code: none`.

Independently confirmed by [`research-selection-internal-coverage.md`][internal] §2, which grepped
the same story hosts for `withSelection`/`selectedRows`/`selectionChanged`/`selectAllIds`/
`selectionStateOf`/`toggle(`/`clearSelection` and reports zero matches, no `selection/` folder, and
`status.md`'s UI code `none` / story research `—`.

The product doc's "every story is ❌" claim holds, and the inventory table below has no rows to
fill. The measurement that matters instead is what ships in **code** without an affordance:

| Ships today (`index.ts`) | On screen anywhere |
|---|---|
| `toggle` / `select` / `deselect` / `clearSelection` | no |
| `selectedRows()` signal, `selectionChanged` delta stream, `emitEvent: false` (D9/D18) | no |
| `selectionStateOf(ids)` (D7), `isSelectable(id)` (D61) | no |
| `selectAllIds(table, { includeHidden })` (D59) | no |
| `enableRowSelection` / `enableMultiRowSelection`, bool or per-row predicate (D58/D14) | no |
| `initialSelection` silent seed (**D16**), silent reconciliation prune (D11/ADR-0006) | no |

> **Correction (2026-09-13).** The first pass attributed the `initialSelection` seed to
> "D11/ADR-0006". Per [`research-selection-internal-coverage.md`][internal] §1 those are two
> decisions: **D16** is the silent seed (written straight into the signal, never through
> `select()`, so a restore never looks like a user action to a subscriber); **D11**/ADR-0006 is the
> removal prune. Both matter to story 1, for different rows — fixed above.
>
> **The one place the research is the stale side.** [`research-selection-internal-coverage.md`][internal]
> §2's shipped-member list omits `isSelectable`. It ships —
> `src/api/features/with-selection.ts:41` declares it, `:192` exports it, added by commit `ab618f8`
> (D61, issue #66) *after* that audit's 2026-09-12 read. The plan's original claim stands; the
> audit is one commit behind. No other claim in it failed re-verification.

**Redundancy / merge candidates: none**, and no existing story should absorb selection. Every
row-edit host is already at full scope for its own mode combination, and `stories.md`'s scope rule
("a story covers several features only when they're inseparable from what that surface *is*")
forbids bolting a checkbox column onto a gated-edit host just because it's plausible.

## Step 2 — Cross-reference against the product doc

**Partially covered** below means: the verb or config exists and is unit-tested, but nothing on
screen lets a person see or trigger it. That is the dominant state here — a grep finding the verb
is not coverage.

| Product story | Verdict | Why |
|---|---|---|
| §1.1 select a row (+ stale-id failure, D8) | **partial** | `toggle` ships, tested; no checkbox, no directive, no story (U1) |
| §1.2 several, one at a time | **partial** | `select`/`toggle` additive, tested; nothing renders |
| §1.3 shift-click range | **not covered** | No anchor mechanism anywhere (U2, OQ-5) |
| §1.4 select everything visible | **partial** | `selectAllIds(table)` ships (D59); no trigger |
| §1.5 select unfetched rows | **not covered** | Deliberately declined (S3) |
| §1.6 unmark one | **partial** | `deselect` ships, ungated (D58) |
| §1.7 clear everything | **partial** | `clearSelection` ships, one delta with every removed id (D9) |
| §2.1 see which rows are marked | **partial** | `selectedRows()` is the only surface; D5 keeps it off `RenderRow`, and no binding recipe exists |
| §2.2 count | **partial** | `selectedRows().size` is free; no display convention (U5, OQ-3) |
| §2.3 tri-state header checkbox | **partial** | `selectionStateOf(selectAllIds(table))` composes today in a host `computed()`; what's missing is the library-owned derived signal (S1, OQ-1) and any rendering |
| §2.4 selection survives filter/sort | **partial** | Structurally guaranteed (D1 + D11) and unit-tested for sort/reorder; never demonstrated with `withFiltering()` composed |
| §2.5 "N selected, M hidden" | **not covered** | No denominator split anywhere (F-S1 bullet 2, S1). Bullet **1** of F-S1 *is* answered by D59 — [`internal`][internal] §3 flags `filtering.md` as pre-dating it by one day |
| §3.1 select a whole group | **not covered** | Owned by grouping (X-G1, closed by **grouping's** D16 — consumer cascade via `rowsOf`). Not selection's D16 |
| §3.2 locked row: disabled, not hidden; keeps a pre-lock mark | **partial** | Write half ships and is tested (D58/D60, `isSelectable` D61); visual half absent (U6) |
| §3.3 never two selected in single-select | **partial** | D14 truncation + `ngDevMode` throw, tested; no story |
| §4.1 Space to toggle | **partial** *(was "not covered")* | Re-classified — see below |
| §4.2 Shift+Arrow range | **not covered** | Same as §1.3, plus U2 |
| §4.3 screen-reader announcement | **not covered** | No `aria-selected` wiring, no announcement convention (U4) |
| §5.1 selection shrank, and why | **partial** | The prune is correct and tested; its *silence* (D11, no emission) has no observability channel (S2, OQ-4) |
| §5.2 edit invalidates selectability | **not covered** | OQ-6, genuinely undecided |
| §5.3 misclick guard on select-all | **not covered** | OQ-2, no library default by recommendation |
| X-1 bulk delete / bulk edit | **not covered** | Blocker moved: selection source now exists, bulk verbs don't (D12) |

**22 stories measured: 0 covered, 12 partial, 10 not covered.** (The first pass said "23 / 12 / 11"
— an arithmetic slip against its own 22-row table. Corrected.)

**Classification corrections made in this revision:**

| Story | Was | Now | Source |
|---|---|---|---|
| §4.1 Space to toggle | not covered, deferred to node H | **partial**, closable by story 1 | [ux][ux] §2–§3: the only keyboard gesture peers converge on is Space toggling the focused row (AG Grid, PrimeNG). A native `<input type="checkbox">` gives it free — no directive, no anchor state. Only the *model* around it (roving focus, Tab containment, arrow nav) stays blocked on H |
| §3.1 attribution | "D16" | "**grouping's** D16" | [internal][internal] §1 vs. §3 — selection's own D16 is the `initialSelection` seed. Two different D16s; the unqualified reference was ambiguous |
| §2.5 / F-S1 | "no denominator split anywhere" | same verdict, note added | [internal][internal] §3 — F-S1 bullet 1 shipped as D59; only bullet 2 is open. Stated so node I doesn't re-open a closed half |
| Inventory attribution | `initialSelection` under D11 | `initialSelection` under **D16** | [internal][internal] §1 |

Nothing else in Step 1 or Step 2 was contradicted by the corpus. The first pass's three core
findings — **zero existing story coverage**, **a fully shipped write surface with no affordance**,
and **no checkbox directive** — are all independently confirmed by [`internal`][internal] §2 and §4.

## Conventions from peer libraries

What peers actually *render* for each affordance, from [`research-selection-ux-capabilities.md`][ux]
(version-pinned 2026-09-12: CDK 22.1.2, TanStack `table-core` 8.21.3, `ag-grid-community` 36.1.0,
MRT 3.2.1, PrimeNG 22.1.1), with the disabled-row row from [`research-row-selectability.md`][lock]
§6. Cited to the research, which did the URL work — not re-cited to vendor docs here.

**A convergent convention is what a story demonstrates by default.** Where peers split three ways,
the story's job is to make the choice *visible*, not to pick a default silently.

| Affordance | CDK `SelectionModel` | TanStack v8 | AG Grid | MRT | PrimeNG | Converged? |
|---|---|---|---|---|---|---|
| Header tri-state checkbox | none — example hand-writes `[indeterminate]` | `getIsSomeRowsSelected()`, renders nothing | native; `-indeterminate` CSS class | renders it (`enableSelectAll`, default on); wiring inferred | `p-tableHeaderCheckbox`; indeterminate unconfirmed | **yes** — header cell, three states |
| Per-row checkbox | none (`toggle(value)`) | none (`getToggleSelectedHandler()`) | `selectionColumnDef`, on by default | default; **auto-swaps to radio** under `enableMultiRowSelection: false` | `p-tableCheckbox`; `p-table-radio-button` for single | **yes** — leading checkbox column is every library's true zero-config default; **single-select renders a radio** (2 of 3 UI-bearing libs) |
| Click row to select | consumer wires `(click)` | consumer wires | `enableClickSelection` (4-way, first-class) | recipe only (`muiTableBodyRowProps.onClick`) | `selectionMode` — the mode *is* the affordance | **no** — 2/5 first-class; CDK #23789 (checkbox click bubbles, double-fires the row toggle) sat open 4.5 yrs ([pain][pain] Theme 8) |
| Shift-click range | never, at the primitive level | none at 8.21.3; built-in merged 2026-07 (PR #6409) | native for years (deselect-direction bug #6619) | `enableBatchRowSelection`, default on | shipped after 4.5 yrs (#5496 → PR #11845) | **yes, now** — 4/5. Anchor state is UI-layer in every one of them, never the state primitive |
| Ctrl/Cmd-click additive | none | none | via `enableClickSelection` | not documented | `metaKeySelection` | **no** — 2/5, and only meaningful where click-row-to-select already exists |
| Keyboard Space / arrows | none | none | Space toggles focused row; Space on header = select-all. Shift+Arrow is *cell* selection, not row. Open WCAG keyboard-trap #12547 | none | fullest set: arrows, Space/Enter, Shift+Arrow, Shift+Space, Ctrl+A (Ctrl+A × `dataKey` bug #15903) | **Space only** (2/5, and free from a native `<input>`). Arrow/roving focus: **no** — `mat-table` #14861 open 6 yrs ([pain][pain] Theme 4) |
| Select-all scope: dataset vs. visible-only | none; the canonical example silently becomes page-scoped the moment a paginator lands | two co-equal named handlers — all-rows vs. page-rows | `selectAll`: `'all'` (default) / `'filtered'` / `'currentPage'` | `selectAllMode`, default **`'page'`** | whole dataset by default; `selectionPageOnly` opt-in | **no — actively divergent.** Three vendors, three defaults. [pain][pain] Theme 1: the single most-repeated bug in the category |
| Selection count / summary bar | raw `.length`, no UI | raw `.length`, no UI | `agSelectedRowCountComponent` — **Enterprise** Status Bar | `positionToolbarAlertBanner` — free, automatic, zero wiring | absent (searched, not merely undocumented) | **shape yes, ownership no** — where it exists at all it is a banner above/below the table, never per-row |
| Disabled-row treatment | listbox: `aria-disabled`, option stays **focusable** — [lock][lock] calls this "the a11y-correct baseline" | `getCanSelect()` (no render) | disabled checkbox by default; hiding is opt-in (`hideDisabledCheckboxes`, default `false`). **Alone in auto-deselecting** a newly-locked row — pays with a `'selectableChanged'` source value | `disabled={!row.getCanSelect()}` | `[disabled]` + `disabledSelectionKeys`; **no distinguishing style out of the box** (#9944) | **unanimous — disable, never hide.** And 4/5 never auto-deselect a row locked while already selected |
| Clear selection | the header checkbox's own untick | same | `Space` on header toggles both ways | header checkbox untick | localizes `selectAll`/`unselectAll` as separate label text | **yes** — clearing is the header checkbox's second state, not a control of its own. No library guards a destructive clear with a confirm or an undo ([pain][pain] Theme 9) |

**What converges, and what a story therefore owes:**

1. **A leading per-row checkbox column + a tri-state header checkbox** — the zero-config default in
   every UI-bearing library. Non-negotiable baseline for any selection story.
2. **Single-select renders a radio, not a checkbox** — MRT swaps the control automatically; PrimeNG
   ships `p-table-radio-button` as its single-select variant. A radio group *is* the "replace, don't
   accumulate" semantics, natively.
3. **A locked row shows a disabled control, never a hidden one** — unanimous, and the one place
   PrimeNG's gap is visible to a *person* rather than an integrator (#9944: no distinguishing style,
   so a locked row and a selectable one look identical).
4. **Clearing is the header checkbox's second state.** A separate "Clear" button has no precedent.
5. **Space toggles the focused row.** Free from a native `<input>`; needs no directive.
6. **Selection count is a banner above the table.** One library ships it free, one paywalls it,
   three ship nothing — but the *shape* never varies.
7. **Select-all scope has no convergent default and three vendors picked three different ones** —
   which is [ux][ux] §1's own read of D1. A story must therefore *show both scopes side by side*
   rather than demonstrate one and imply it is the default.

**What does not converge, and is therefore correctly absent from these stories:** click-row-to-select
(2/5, and it drags CDK #23789's event-propagation trap in with it), Ctrl/Cmd-click additive (2/5,
only meaningful alongside the former), arrow-key row navigation (0/5 solid).

## Step 3 — Target story set

Three new folders. Nothing to fold into (Step 1), so "minimize count" is spent on refusing a
fourth: the bulk-action bar, the locked-row demo, the tri-state header, and the silent-prune demo
all live **inside** story 1 as buttons rather than earning showcases of their own.

No MSW handler is added. Every selection verb is synchronous and local — inventing an async path
to fit the `forceFailure`/`latencyMs` pattern would demonstrate a round trip the feature does not
have. The "someone else deleted this row" trigger follows `external-write/`'s
`simulateServerPush` precedent: a local `data` write behind an on-canvas button. Each story exports
a single `Default` — there is no rollback/reopen state that never renders on the happy path, so no
story earns a `ForcedFailure` sibling (`gated-single-pessimistic/`'s precedent, per `stories.md`).

No checkbox directive exists, so each host wires a native `<input type="checkbox">` (or `radio`,
story 2) in its own template. That is exactly what a consumer copies today, it is the missing D5
binding recipe (§2.1) rendered rather than described, and per the matrix it is also the
**conventional** affordance rather than an invented one — plus it hands §4.1's Space gesture over
for free.

### 1. `multi-selection/` — NEW — selection baseline

**Standalone reason:** nothing exists to extend; this is the whole read/write surface in one
screen. Schema: `withSelection({ enableRowSelection: (row) => !row.locked })`, multi by default.

| Product story covered | Covered by |
|---|---|
| §1.1 select a row | **new** — per-row native checkbox in a leading column (the convergent default), `[checked]="table.selectedRows().has(row.id)"`, `(change)` → `table.toggle(row.id)` |
| §1.2 several, one at a time | **new** — same checkbox, additive; no accumulation limit |
| §1.4 select everything visible | **new** — header checkbox tick → `table.select(selectAllIds(table))` |
| §1.7 clear everything | **new** — header checkbox **untick** → `clearSelection()`. The convergent gesture (matrix row 10); the event log shows **one** delta carrying every previously-selected id (D9), not N |
| §1.6 unmark one | **new** — unticking a row (`toggle`'s removal branch) |
| §2.1 see which rows are marked | **new** — row binding recipe: `[class.is-selected]` + `[attr.aria-selected]` read off `selectedRows()`, never a `RenderRow` field (D5). D5 is also why this library sidesteps the re-render-storm three of five peers shipped ([pain][pain] Theme 7 — TanStack #1496 👍14, MRT #1281) |
| §2.2 count | **new** — a **banner above the table**, "N selected", off `selectedRows().size` — MRT's `positionToolbarAlertBanner` shape, the only shape anyone ships (OQ-3's recipe, not a shipped component) |
| §2.3 tri-state header | **new** — `checked`/`indeterminate` from a host `computed(() => table.selectionStateOf(selectAllIds(table)))`. Doc-comment names the honest gap: the library ships no derived "all visible selected" signal (S1/OQ-1) — the host computes it, and that computation is what OQ-1 would replace |
| §4.1 Space toggles the focused row | **new** *(added this revision)* — free from the native `<input>`; the one keyboard gesture peers converge on ([ux][ux] §2–§3). Doc-comment scopes it: Space only. Roving focus / arrow nav / Tab containment stay on node H, where `mat-table` #14861 (open 6 yrs) says they belong |
| §3.2 locked row, disabled not hidden | **new** — checkbox rendered with `[attr.aria-disabled]="!table.isSelectable(row.id)"` and a **visible locked style**, always present, never removed. Unanimous industry convention (matrix row 9); the visible style specifically answers PrimeNG #9944, where a person cannot tell a locked row from a selectable one. "Select all" visibly skips it — the first half of PrimeNG #6736 (👍34, the highest-reaction issue in the whole corpus, open 3+ yrs) |
| §3.2 a mark survives its row being locked | **new** — "Lock this row" patches `locked: true` on an already-selected row; the mark stays (D58/D60), unlike AG Grid — the only peer that auto-deselects, and pays for it with a `'selectableChanged'` cause value |
| §3.2 **but an explicit clear still removes it** | **new** *(added this revision)* — clearing while a locked row is selected *does* drop its mark, because `deselect`/`clearSelection` are ungated by design (D58). This is the exact asymmetry PrimeNG needed a **second** multi-year issue for (#15780, open 2 yrs, filed 2.5 yrs after #6736's fix). Showing both halves on one screen is the point |
| §1.1 failure — stale / unloaded id (D8) | **new** *(reshaped this revision)* — "**Restore a saved selection**" button → `select(savedIds, { emitEvent: false })` where `savedIds` includes an id not in `data`. The write succeeds, the unknown id renders nothing, the rest is untouched (D8), and D18's `emitEvent: false` keeps it out of the event log — a restore is not user intent (D16's reasoning, applied to the runtime path). This is the shape CDK #25878/#27425 (`setSelection` ignoring `compareWith`) and TanStack #4498 (index-keyed selection surviving a data swap) actually describe ([pain][pain] Theme 2) |
| §5.1 selection shrank silently | **new** — "Someone else deleted this row" removes a selected row from `data`; the count drops, the event log stays **empty** — D11's silent prune made visible by its absence, which is the demo OQ-4 exists to fix. The correctness half is already ahead of MRT #1362 (deleted row still reported selected, "Clear selection" won't clear it — **open**) |

**On-canvas controls:** header tri-state checkbox (tick = select all visible, untick = clear —
both directions, one control), Lock this row, Delete a row externally, Restore a saved selection,
plus a `selectionChanged` event log panel (the only surface on which the delta stream and D11's
silence are observable — it serves the feature, not the app).

**Changed from the original plan:**

- **"Clear selection" button → the header checkbox's untick.** No peer ships a separate Clear
  control; clearing is universally the header checkbox's second state (matrix row 10, and PrimeNG
  localizes `unselectAll` as its own label for exactly this). The standalone button is **dropped**;
  `clearSelection()`'s D9 single-delta behavior is now proven through the conventional gesture.
- **"Select an id that isn't here" button → "Restore a saved selection."** The original was a
  synthetic error trigger no library renders. The community evidence describes the same write as a
  *restore against freshly-fetched rows* ([pain][pain] Theme 2, three separate libraries), which is
  a control a consumer plausibly ships. Same verb, conventional framing, and it now also carries
  D18/`emitEvent: false`.
- **`[disabled]` → `[attr.aria-disabled]` + visible locked style.** [lock][lock] §6 names CDK
  listbox's aria-disabled-while-focusable as the a11y-correct baseline (the native `disabled`
  attribute removes the control from the tab order, which the majority ship and the baseline
  rejects). The *visible style* is new and is the answer to PrimeNG #9944 — the original plan had
  no visual treatment at all, only the disabled state.
- **Count bar placed as a banner above the table**, per MRT's `positionToolbarAlertBanner` — the
  only shape any peer ships. Was unplaced.
- **Added:** §4.1 Space-to-toggle (convergent, free from the native input).
- **Added:** the locked-row *clear* asymmetry row — PrimeNG #15780's half of the pain, which D58's
  ungated `deselect` answers deliberately and oppositely.
- **Kept, re-justified:** "Lock this row" and "Someone else deleted this row" — neither is a control
  a peer renders, but both are the only way to show a divergence (AG Grid's auto-deselect) or an
  open competitor bug (MRT #1362) on screen.

### 2. `single-selection/` — NEW — single-select path

**Standalone reason:** `enableMultiRowSelection: false` is a construction-time config path, not an
input to one path. `stories.md` rules that an on-canvas toggle flipping it would leave a dead
branch in the host — the same rule that split `gated-single-*` from `gated-multiple-*`. Smallest
host in the set, deliberately.

| Product story covered | Covered by |
|---|---|
| §1.1 select a row (single) | **new** — `<input type="radio" name="row-selection">` per row, **not** a checkbox: MRT swaps the control automatically under `enableMultiRowSelection: false`, PrimeNG ships `p-table-radio-button` as its single-select variant ([ux][ux] §2). One host, no accumulation |
| §3.3 never two selected | **new** — the radio group *is* the replace semantics: ticking a second row visibly unticks the first, with no code saying so. D14's rule and the control agree |
| §3.3 conflicting bulk write (D14) | **new** — "Restore a 2-id saved selection" → `select([a, b])`; under `ngDevMode` this throws naming the discarded ids, which the host catches and renders on canvas, so the truncate-in-production / throw-in-dev split is visible instead of described |
| §1.7 clear | **new** — an explicit "Clear selection" button, **kept here only**: a radio group cannot be unticked by clicking it, and there is no header checkbox in a single-select table to carry the gesture. The one place the non-conventional control is forced by the affordance |
| §2.1 see which row is marked | **new** — same row binding recipe as story 1 |
| §4.1 Space toggles the focused row | **new** — native to the radio; arrow keys also move within a radio group, which is the browser's own roving-focus model and the closest thing to PrimeNG's arrow navigation reachable without a directive |

**Changed from the original plan:**

- **Checkbox → radio button.** The single clearest invented-vs-conventional swap in this revision.
  The original said "same checkbox wiring as story 1"; two of the three UI-bearing peers render a
  radio here, and MRT does it *automatically* rather than as a separate prop to learn.
- **"Clear selection" survives here** (unlike story 1) — and now has a real justification rather
  than a copied one: a radio group has no untick gesture and there is no header checkbox.
- **Added:** §4.1 — radio groups give Space *and* arrow-key roving focus natively.
- **No header checkbox.** Implicit before; stated now — select-all has no meaning under
  single-select, and every peer hides the header control in that mode.

### 3. `selection-filtering/` — **owned by the filtering plan**, not built here

Both this plan and [`../filtering-stories/1-gap-analysis.md`](../filtering-stories/1-gap-analysis.md)
independently proposed a `selection-filtering/` folder. **Filtering owns it**: the story only means
anything over a fixture that can exercise real filters (six rule kinds, a nullable field, an array
field), which is `filter-demo.*`/`InvoiceRow` — `selection.*` cannot produce a meaningful filter,
while the selection half adds only a checkbox column on top of whatever fixture exists. Cheap
dependency follows expensive one.

Three rows unique to this plan's draft were migrated into that story rather than dropped:
selection surviving a **sort**, the **delete-a-selected-but-filtered-out-row** failure case (D11 —
only a real removal changes the selection), and the `selectionStateOf` **denominator** framing on
the tri-state header (MRT PR #1499, open). Coverage for §1.4, §2.3, §2.4 and §2.5 is credited
there, measured in that plan's tables, not re-counted here.

## Build order — dependency graph

Each node is a concrete build unit. A shared file touched by two nodes is a real edge. An
uncertain edge counts as real.

**Re-validated 2026-09-13 against the revised story shapes, then again after the
`selection-filtering/` ownership call. One node was removed — E now lives in the filtering plan —
and the ranking below is re-derived, not patched.** The revisions land entirely inside existing nodes: the radio
control, the aria-disabled treatment and the extra rows are host-template work inside C/D/E; the
visible locked-row style and the radio's affordance styling fall to G, which already existed for
exactly that reason. Two node *descriptions* change (G, H); the diagram and the summary line below
are re-derived from the same unchanged ranking and still agree with the per-node fields.

**A — `selection.types.ts` + `selection.mock.ts`** (cluster root, `src/stories/`)
Row shape with a `locked` flag and a filterable field; ~10 fixture rows (the 3-row
`EDIT_ROWS_MOCK` cannot demonstrate select-all, a count, or a hidden/visible split). Also carries
the **saved-selection id array** both restore buttons read (stories 1 and 2), one of which names an
id absent from the fixture rows — D8's case.
*Depends on:* nothing. *Parallel-safe with:* G, H.

**B — `selection.schema.ts`** (cluster root)
Two `createTableSchema()` variants — multi + `enableRowSelection` predicate, and single
(`enableMultiRowSelection: false`). The third, filtered variant moved to the filtering plan's
`filter-demo.filters.ts` along with the story that needed it.
*Depends on:* A (imports the row type).

**G — `selection-story.css`** (cluster root)
Selected-row highlight, **a visible locked-row treatment** (a person must be able to tell a locked
row from a selectable one without clicking — PrimeNG #9944), the aria-disabled control's own
affordance, the radio variant's, and the count banner; layered after the shared
`row-edit-story.css`, which every host reuses.
*Depends on:* nothing. *Parallel-safe with:* A, B, H.

**C — `multi-selection/`** (host `.ts` + `.html` + `.stories.ts` + `.mdx`)
*Depends on:* B, G. *Parallel-safe with:* D.

**D — `single-selection/`**
*Depends on:* B, G. *Parallel-safe with:* C.

**E — removed.** `selection-filtering/` is built under the filtering plan (node D there), against
`filter-demo.*` rather than `selection.*`. It is a real cross-plan edge for node I below — a
§1.4/§2.3/§2.4/§2.5 mark cannot flip until that story renders — but it is not a build unit here.

**I — re-derive coverage marks in `0-product/selection.md`** (plus `docs/status.md` regeneration
via `npm run table:status` if any frontmatter moves)
Also carries the doc-drift cleanup [`internal`][internal] §3/§5 catalogues, since this pass already
touches the same files: `filtering.md`'s F-S1 bullet 1 (D59-answered), `grouping.md`'s X-G1 story
body (still says "undecided" while its own changelog says D16 closed it), selection's
`2-decisions.md` + `features/selection.md` open-questions (same), `state-persistence.md` (points at
a precondition that no longer holds; D19 answers it), `0-architecture-seam.md:83` (superseded by
D5), and `with-selection/docs/tasks/progress.md` Step 7 (marked in-progress; its tests exist and
pass).
*Depends on:* C, D, **and the filtering plan's node D** (`selection-filtering/`) — a mark cannot
flip before the story it measures renders, wherever that story is built.

**H — drill [`3-ui/directives/selection.md`](../../directives/selection.md)** (blocked-on-unbuilt-code)
`spec: stub, code: none`. Gates the deferred stories in "Left out on purpose" below. **Scope
narrowed this revision:** §4.1's Space gesture is no longer gated by H — a native `<input>` ships it
— so H now gates range select (U2/OQ-5), the roving-focus/arrow/Tab-containment *model* (U3), and
SR announcements (U4). Not blocked by anything here, and blocks nothing here: stories C/D/E
hand-wire native controls precisely so they do not wait on it. **Its priority rises**: the matrix
puts shift-click range at 4-of-5 convergence, making it the most conspicuous absence from the
target set.
*Depends on:* nothing in this plan. *Parallel-safe with:* every node above.

```
A  selection.types.ts + selection.mock.ts       G  selection-story.css
│  (+ saved-selection id array, D8 case)        │  (+ visible locked-row style)
└──► B  selection.schema.ts                     │
          │  (2 variants: multi, single)        │
          └──────────────┬──────────────────────┘
                         │  (C and D each need BOTH B and G)
                         ├──► C  multi-selection/   ──┐
                         └──► D  single-selection/  ──┼──► I  coverage marks
                                                      │      + doc-drift cleanup
      [filtering plan]  D  selection-filtering/  ─────┘   (cross-plan edge)

H  drill directives/selection.md   (no edge to A–I; gates the deferred
                                    range-select / keyboard-model / SR stories)
```

`Dependency: A → B → {C,D} → I`, plus a cross-plan edge `[filtering:D] → I`
`Parallel-safe: [A, G, H] start now; [C, D] after both B and G`

## Left out on purpose

| Item | Why not a story |
|---|---|
| §1.3 shift-click range, §4.2 Shift+Arrow | **The most conspicuous deferral, and the matrix sharpens it**: 4 of 5 peers now ship shift-click ([ux][ux] §3), and it is the clearest "community solved it before the library did" case in the corpus — CDK never shipped it, TanStack took 4.5 yrs (PR #6409, merged 2026-07), PrimeNG took 4.5 yrs to fix a broken one ([pain][pain] Theme 3). Anchor state is UI-layer in every one of them and is budgeted to the undrilled selection directive (OQ-5, U2). A host-owned anchor recipe would ship the pattern that directive is designed to replace — **blocked on node H, not skipped**, and H's priority rises accordingly |
| §4.1's keyboard *model* (roving focus, Tab containment), §4.3 SR announcement | U3/U4. The Space gesture itself is now covered by stories 1 and 2 (native `<input>`), which is the only keyboard behavior peers converge on. The surrounding model has no primitive to demonstrate and no convergent convention to copy — `mat-table` #14861 is 6 yrs open, AG Grid has a live WCAG keyboard-trap report (#12547), and AG Grid's own a11y docs admit an unresolved announcement gap on the focused element ([ux][ux] §8). Blocked on node H |
| Click-anywhere-on-the-row to select | **Newly justified by the matrix rather than by silence.** Only 2 of 5 peers make it first-class ([ux][ux] §2); wiring it alongside a checkbox column drags in CDK #23789 (checkbox click bubbles into the row handler and double-fires the toggle — open 4.5 yrs, [pain][pain] Theme 8). A non-convergent affordance with a known 4.5-year trap is not what a story should teach a consumer to copy |
| Ctrl/Cmd-click additive selection | 2 of 5, and only meaningful alongside click-anywhere, which is already out |
| §1.5 select every unfetched row | S3 — deliberately declined; only AG Grid **Enterprise** SSRM reaches this rung in the entire survey ([ux][ux] §1, §10). A story would imply a server-scope selection concept exists |
| X-1 bulk delete / bulk edit | D12 keeps bulk `removeRow(id[])`/`patchRow(id[], partial)` out of scope. A per-id loop behind a "Delete selected" button would read as the supported batch API. The count banner in story 1 shows the count and the selected ids, and stops there |
| §5.3 misclick guard on select-all | OQ-2's recommendation is a documented recipe, not a library default — and **no peer treats it as the library's job either** ([ux][ux] matrix row 10, [pain][pain] Theme 9, where the only corroborating complaint comes from outside the target set). A confirm dialog is app chrome per `stories.md`'s scope rule |
| §5.2 edit invalidates selectability | OQ-6. [pain][pain] Theme 8 searched all five trackers and found **no** issue about it — the silence is the finding. Nothing to demonstrate until a decision exists |
| §3.1 / X-G1 group-header select | Owned by grouping and closed by **grouping's** D16 (consumer cascade via `rowsOf`) — belongs to a grouping story, linked not restated. The matrix backs the flat-ids stance: AG Grid is the only peer proving a library-owned cascade is defensible, PrimeNG is the proof of what shipping the two features unaware of each other costs (#5831/#4310, years unresolved — [ux][ux] §4), and TanStack was still fixing cascade rules in PR #6495, merged a month before the research |
| OQ-3 selection-count banner as its own showcase | It is a recipe, not a mechanism — shipped as story 1's count banner rather than a fourth folder. Only 1 of 5 peers ships it at all ([ux][ux] §7) |
| §2.3's derived "all visible selected" signal (S1/OQ-1) | Unbuilt. Story 1 renders the host-side `computed()` and its doc-comment names it as the workaround, so the story starts passing unchanged if OQ-1 lands |
| A `source`/cause discriminator on the event log | D10, declined. [events][events] confirms only CDK ships a delta at all and it carries no cause; AG Grid's 16-value `SelectionEventSourceType` is the alternative, and its `apiSelectAll`/`apiSelectAllFiltered`/`apiSelectAllCurrentPage` values are D1's scope ambiguity leaking into the event after the fact. Nothing to render |

## Summary

| # | Story | Status | Standalone reason |
|---|---|---|---|
| 1 | `multi-selection/` | **new** | The whole read/write surface — checkbox column, tri-state header (select-all *and* clear), count banner, locked rows both directions, silent prune — in one screen; nothing exists to extend |
| 2 | `single-selection/` | **new** | `enableMultiRowSelection: false` is a fixed config path, and peers render a **radio** for it; a toggle would leave a dead branch (same rule that split `gated-single-*` from `gated-multiple-*`) |
| 3 | `selection-filtering/` | **moved out** | Built under the filtering plan against `filter-demo.*` — the fixture the story actually needs. Still composes `withSelection()` + `withFiltering()`, still carries the matrix's sharpest divergence (three vendors, three select-all defaults) |
| — | fixtures A, B, G | **new** | Cluster root files, mirroring the `row-edit.*` split (B is two schema variants now, not three) |
| — | 9 existing stories | untouched | None composes `withSelection()`; none may absorb it without breaking `stories.md`'s scope rule |

Net: 0 existing → **2** new folders here + 3 shared fixture files, 0 extends, 0 merges, 1 story
moved to the filtering plan. 22 product stories measured: 0 covered, 12 partial, 10 not covered.
Across both plans the 12 partials close, plus §2.5 and §4.1's Space half, leaving 8 fully deferred
and §4.1's keyboard-model remainder on node H — of those closures, §1.4/§2.3/§2.4/§2.5 are credited
to the filtering plan's `selection-filtering/`.
