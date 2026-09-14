---
title: Product — Selection User Stories
type: product
capability: selection
status: >
  Coverage re-derived 2026-09-14 from four shipped stories — `multi-selection/` and
  `single-selection/` here, plus `selection-filtering/` and `grouping-selection/`, which are built
  under the filtering and grouping plans and measured there. 12 ✅, 5 🟡, 4 ❌ across §1–§5; X-1
  stays blocked on D12's bulk write verbs. The four ❌ are all stated boundaries, not omissions:
  §1.3 and §4.2 (shift-click and Shift+Arrow ranges) are blocked on node H, the undrilled
  selection directive, and 4 of 5 peers ship shift-click, so H's priority rises; §1.5 is
  deliberately out of scope; §5.3 has no library position anywhere to inherit. §5.2 flipped to ✅
  unexpectedly — the multi story's lock control is exactly its scenario, though OQ-6's question of
  whether retain-and-tell is the *right* answer is untouched. Every drift item listed under "Report
  the deltas" was verified already fixed; the §6 notes that still said otherwise are corrected.
date: 2026-09-14
audience: product, design, engineering
---

# Selection — user stories

What a person marking specific rows in a table so they can act on them together needs to be able
to do, and what they should experience when the table around that selection changes shape.
Engineering derives API from this document, not the reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it — coverage marks here are updated from the product side as capabilities
> land.

> **This doc was written after the spec, not before it.** [`selection.md`](../1-state/features/selection.md)
> and [`work/with-selection/3-spec.md`](../1-state/work/with-selection/3-spec.md) are `spec:
> drilled`, carrying D1–D19 and D58–D60 — a careful decision log written in the developer's voice
> (`table.select(selectAllIds(table))`). It does not answer what a person selecting rows in a
> table sees, clicks, or is told when their selection doesn't survive a filter change. That is
> this document.

## Scope

**Selection means: I can mark specific rows as "the ones I mean," and act on them together — and
that mark stays trustworthy even while the table around it changes.** A person perceives four
things, and does not care which layer produces them:

1. I can mark one row, several rows, or everything I can currently see, with an obvious gesture.
2. I can tell, at a glance, which rows are marked and roughly how many.
3. My marks survive things that aren't about my selection — a filter, a sort, a page change — the
   way I'd expect, not by accident.
4. When something makes a mark stop making sense (the row is gone, the row got locked), I'm not
   left holding a phantom selection or wondering what happened to it.

The codebase splits this across a state-only `withSelection()` feature (a flat `Set<RowId>`, a
delta event, and a `selectAllIds()` helper) and — not yet drilled — a UI-layer checkbox directive.
That split is invisible to the person using the table and is ignored here.

**One real product distinction, not a "mode" the way editing has gated/live: single-select vs.
multi-select.** `enableMultiRowSelection` is a rule on the write verbs, not stored state (D2), so
it can vary per row — but the person's mental model genuinely differs: single-select means picking
one thing, no accumulation; multi-select means building a set. Stories below say "(single)" /
"(multi)" only where the two diverge; most of what follows applies to both.

**Selection deliberately has no concept of "which rows exist that I haven't seen."** Every write
verb names the exact ids it applies to (D1) — there is no server-mode/client-mode split the way
filtering has one, because selection never fetches or requests anything itself. What differs by
scale is only how a consumer computes the id array it hands to `select()`: from `rows()` (visible),
from `value()` (everything loaded), or — unbuilt, see §9 — from a server that knows about rows
never loaded at all.

## Coverage marks

| Mark | Meaning |
|---|---|
| ✅ **covered** | Demonstrable today in `src/stories/` or a demo app, with the failure path included |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not — no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

**Marks re-derived 2026-09-14 from the shipped stories, not from a sibling doc.** Four stories
measure this feature, and only two of them live under `selection/` — the other two are built by
the features that had to compose with selection, and are measured in those plans rather than
recounted here:

| Story | Composes | What it demonstrates |
|---|---|---|
| [`multi-selection/`](../../src/stories/selection/multi-selection/) | `withSelection({ enableRowSelection })` | The whole read/write surface on one screen: accumulating row checkboxes, a header checkbox whose second state is the clear, locked rows that stay in the tab order and keep a mark they already had, a saved selection carrying an id no row has, and an external delete that drops the count without emitting. A `selectionChanged` event log makes D9's single-delta clear and D11's silent prune distinguishable |
| [`single-selection/`](../../src/stories/selection/single-selection/) | `withSelection({ enableMultiRowSelection: false })` | A radio group, so the replace rule is the control's own semantics and arrow-key roving focus comes free; a Clear button, because a radio has no untick gesture; and a two-id restore that makes D14 throw under `ngDevMode`, naming what it discarded, rendered on canvas |
| [`selection-filtering/`](../../src/stories/filtering/selection-filtering/) | `+ withFiltering()` `+ withSorting()` | Retention across a filter, restored exactly; two separately named select-all scopes; sorting changing nothing and deleting pruning. **Measured under the filtering plan** — see [`filtering.md`](filtering.md) §5 F-S1 |
| [`grouping-selection/`](../../src/stories/grouping/grouping-selection/) | `+ withGrouping()` `+ withFiltering()` | All three peer cascade defaults off one `rowsOf()` call; no group header ever in the selection. **Measured under the grouping plan** — see [`grouping.md`](grouping.md) §5 X-G1 |

**No selection directive ships, and that does not hold a mark down on its own.** Every ✅ below is
a host binding a consumer copies — `[class]` + `[attr.aria-selected]` read off `selectedRows()`,
since selection is deliberately never stamped onto `RenderRow` (D5). That binding recipe *is* the
contract these stories were missing. Where a mark is 🟡 it is because the person's experience is
genuinely incomplete, not because the affordance is story-local.

The **Design status** line on each story is unchanged — it records whether D1–D19/D58–D60 answers
the story. The new **Covered by** line records which shipped story proves it, and where it stops.

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
resulting gap into state, UI, or both — and §9 collects the ones that belong to no existing
feature at all.

Where a competitor's behavior is cited, it comes from
[`research-selection-ux-capabilities.md`](../1-state/work/with-selection/research-selection-ux-capabilities.md)
(version-pinned, 2026-09-12) or
[`research-selection-community-pain.md`](../1-state/work/with-selection/research-selection-community-pain.md)
(issue numbers, states, and reaction counts read from the GitHub API the same day). Neither is
restated here beyond what a story needs.

---

# 1. Choose which rows I'm working with

Ordered by how badly the person is hurt if it is missing.

## 1.1 — Select a row *(both)* — ✅ covered

> As someone reviewing a list of invoices, I want to mark the three I'm about to export, so I can
> act on exactly those three without re-finding them.

**Acceptance criteria**

- A visible, obvious control on the row (a checkbox, or the row itself if the table is
  click-to-select) marks it selected.
- Marking a row never changes its values, its position, or any other row's state.

**Failure behavior**

- Marking a row that turns out not to exist in the data (a stale id) does not throw or corrupt the
  rest of the selection — it's simply not reflected on screen, because there's no row to reflect
  it on (D8: the write itself still succeeds; nothing renders is the only visible consequence).

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) (a checkbox per
row) and [`single-selection/`](../../src/stories/selection/single-selection/) (a radio per row).
Marking a row changes nothing else — no value moves, no other row's state changes, and the mark is
bound off `selectedRows()` rather than stamped on the row. Failure: *Restore a saved selection*
writes `['s2', 's5', 's99']`, and no row has `s99` — the write succeeds, the unknown id simply
renders nothing, the other two mark, and the story's notice says so (D8). **There is still no
checkbox directive**; what these hosts ship is the binding recipe the 2026-09-12 status says is
missing, not a shipped affordance.

**Design status:** the write path is covered — `toggle(id)`/`select(ids)` (D2) — but there is
**nothing to click**. No checkbox directive exists (`3-ui/directives/selection.md` is an undrilled
stub); "click-anywhere-on-the-row" isn't even sketched. Every UI-bearing competitor ships at least
a checkbox column by default (`research-selection-ux-capabilities.md` §2); this library ships the
verb and no affordance at all yet.

## 1.2 — Select several rows one at a time *(multi)* — ✅ covered

> As someone building an export of five specific invoices out of four hundred, I want each click to
> add to what I've already picked, not replace it.

**Acceptance criteria**

- Marking a second row does not unmark the first.
- The set can be built in any order, one row at a time, with no limit named as a story requirement.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) — each tick adds
to what is already marked, in any order, with no limit. The count banner and the event log both move
per gesture, so "the second click did not replace the first" is read off the screen.

**Design status:** covered by `select(ids)`'s additive bulk write and D14's truncation rule
(a *conflicting* request under single-select keeps only the last id, never silently drops the
whole set) — but again, nothing renders. This story and 1.1 differ only in whether the state layer
composes correctly under repeated calls, which it does; the person-facing gap is identical.

## 1.3 — Select a range in one gesture (shift-click) *(multi)* — ❌ not covered *(blocked on node H)*

> As someone selecting rows 12 through 40 out of a long list, I want to click the first, shift-click
> the last, and have everything between them selected — not forty individual clicks.

**Acceptance criteria**

- Shift-click (or an equivalent) selects every row between the last-clicked row and the current
  one, inclusive.
- Doing it again from a different anchor replaces the range, it doesn't compound into an ever-larger
  set from stale anchors.

**Covered by:** nothing, and this is **blocked, not skipped**. Shift-click needs anchor-tracking,
which is UI-layer work by D13's flat-ids design, and the UI layer for selection is node H —
`3-ui/directives/selection.md`, still `spec: stub, code: none`. **4 of 5 researched peers ship
shift-click**, so this is the single strongest argument for raising H's priority; it also gates 4.2
and the roving-focus half of 4.1. OQ-5, §9.2.

**Design status — gap, and a genuinely hard one industry-wide.** No anchor-tracking mechanism
exists anywhere in this codebase, and per D13's flat-ids design it deliberately wouldn't live in
the state feature — this is UI-layer work. The community evidence is unusually strong here: CDK's
`SelectionModel` has never shipped a range primitive at all (issue closed by the *reporter*
building their own StackBlitz); TanStack Table went **4.5 years** on community-only
shift-click implementations before merging a built-in default in mid-2026; PrimeNG shipped a
broken shift-click and took 4.5 years to fix it
(`research-selection-community-pain.md` Theme 3 — CDK #17402, TanStack #3636 → PR #6409, PrimeNG
#5496 → PR #11845). AG Grid is the only library with it solid for years, and even it had a
deselect-direction bug (ag-grid#6619). Raised as **OQ-5**.

## 1.4 — Select everything I can currently see *(multi)* — ✅ covered *(measured under filtering)*

> As someone who just filtered a list down to "overdue," I want one action to select all of them,
> not one click per row.

**Acceptance criteria**

- One action selects every row currently matching whatever's on screen — not the whole unfiltered
  table, not just the current page if more exist.
- Doing it again after narrowing further only ever narrows what gets selected, consistent with
  whatever's currently visible.

**Covered by:** [`selection-filtering/`](../../src/stories/filtering/selection-filtering/),
**measured under the filtering plan** — see [`filtering.md`](filtering.md) §5 F-S1, which owns the
numbers rather than this doc recounting them. Both acceptance criteria render there: *Select all
(visible)* scopes to `rows()` (post-filter, post-sort) and *Select all (including hidden)* to the
whole dataset, as two separately named buttons rather than one flag with a chosen default.
[`multi-selection/`](../../src/stories/selection/multi-selection/) carries the same gesture
unfiltered, as the header checkbox, pre-filtered by `isSelectable()` so a locked row is never roped
in. The open half — whether "everything visible is selected" is knowable without the consumer
re-deriving it — is 2.3, still 🟡.

**Design status:** covered — `selectAllIds(table)` (D59), default scope is `rows()` (post-
filter/sort). This is the direct, shipped answer to the single most-repeated bug in the entire
competitive category: **three separate libraries have shipped a purpose-built config option whose
job is exactly this question and are still fixing it years later** (AG Grid's
`selectAll: 'currentPage'`/`'filtered'` re-broken across issues #9327, #10688, #12072, #12559 over
2024–2025; MRT's own select-all-vs-pagination bug still open as of 2025-06;
`research-selection-community-pain.md` Theme 1). `withSelection()`'s refusal to bake in a `scope`
concept and instead take an explicit id array sidesteps the entire bug class. What it does not yet
answer: whether "everything currently visible is selected" is knowable *without* the consumer
re-deriving it — see 2.3.

## 1.5 — Select literally every row that exists, even ones I haven't loaded — ❌ not covered, deliberately out of scope for now

> As someone working a table backed by a hundred thousand server rows where only a page is ever
> fetched, I want "select all" to mean all hundred thousand, and to be able to act on that without
> the table trying to materialize them.

**Covered by:** nothing, deliberately. `selectAllIds(table, { includeHidden: true })` renders in
[`selection-filtering/`](../../src/stories/filtering/selection-filtering/) and reaches every row in
`value()`; rows never fetched are out of scope by decision (S3, §9.3), not by omission. Only AG Grid
Enterprise reaches this rung at all.

**Design status — a real boundary, not an oversight.** `selectAllIds(table, { includeHidden: true
})` covers "every row currently in `value()`" — it cannot cover rows the consumer has never
fetched. Only one competitor reaches this rung at all: AG Grid's Server-Side Row Model, and only
in its **Enterprise** tier, via `getServerSideSelectionState()`/`setServerSideSelectionState()`
(`research-selection-ux-capabilities.md` §1, §10). No other library in the set offers it. Named
here so it's an explicit, considered absence rather than something discovered later as "selection
doesn't scale to server mode" — see §9.3.

## 1.6 — Unmark one row without touching the rest *(multi)* — ✅ covered

> As someone who selected six rows and realized one doesn't belong, I want to unmark just that one.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) — unticking one
row's checkbox leaves every other mark alone, and the event log shows the single-id delta. The same
click works on a locked row that already carried a mark, because removal is ungated by design (D58).

**Design status:** covered — `deselect(ids)` is explicitly exempt from both the multi-select and
`enableRowSelection` rules (removal can't violate either), so it always succeeds regardless of a
row's current lock/mode state.

## 1.7 — Clear my whole selection in one action *(both)* — ✅ covered

> As someone done with a bulk export, I want to get back to nothing selected in one click, not by
> unmarking six rows individually.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) — the header
checkbox's second state is the clear, which is the convergent gesture; no peer ships a separate
Clear button in a multi table, so neither does this.
[`single-selection/`](../../src/stories/selection/single-selection/) does ship one, for the stated
reason that a radio has no untick gesture. D9's single-delta emission is visible in the event log:
one `selectionChanged` carrying every previously selected id in `removed`, not one line per row.

**Design status:** covered — `clearSelection()`. Emits one `selectionChanged` with every previously
selected id in `removed` (D9), so a subscriber can react to "selection was cleared" as a single
event, not six.

---

# 2. Know what I've selected, and control it

## 2.1 — See at a glance which rows are marked *(both)* — ✅ covered

> As someone who selected rows a minute ago and got distracted, I want to look at the table and
> immediately see which ones, without re-reading a list elsewhere.

**Acceptance criteria**

- A selected row is visually distinct from an unselected one, persistently, not only at the moment
  of clicking.

**Covered by:** both stories — and this is exactly the missing cookbook entry the 2026-09-12 status
asks for, now written as code. A selected row carries a class and `[attr.aria-selected]`, both read
off `selectedRows()` in the template, persistently rather than at click time. Because selection is
never stamped onto `RenderRow` (D5), this binding **is** the contract; a consumer copies these four
lines. No directive ships, and the marks in this section do not assume one.

**Design status — gap, and a deliberate design trade underneath it.** `selectedRows()` is a signal
a consumer must read and bind themselves — selection is explicitly never stamped onto `RenderRow`
(D5), unlike `withExpansion()`'s `isExpanded` field. That's a real, considered choice (avoids
coupling selection to render-row identity, which is part of why this design sidesteps the
re-render-storm bug class three competitors have shipped — `research-selection-community-pain.md`
Theme 7), but it means there is currently no documented recipe for "how do I bind
`row.id | selected` in my template," only the raw signal. Worth a cookbook entry even before any
directive ships.

## 2.2 — See a count of how many rows I've selected *(multi)* — ✅ covered

> As someone about to bulk-delete forty records, I want to see "40 selected" before I commit, so I
> know the blast radius.

**Acceptance criteria**

- A count of currently-selected rows is available without the person counting checkmarks
  themselves.
- The count updates the instant selection changes, not on some other refresh cycle.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) — a count banner
reading `selectedRows().size`, which updates on the same change detection pass as the marks because
it is a `computed()` over the same signal. It renders an empty state as well as a number, so "0
selected" is a state rather than a missing element. The banner is the convention OQ-3 says is
missing; it is story-local until §9.1 has an owner.

**Design status — gap, and cheap.** `selectedRows().size` already answers this at zero engine cost
— the gap is entirely a missing convention for *displaying* it, not a missing primitive. Only one
of five competitors ships this as a real, zero-config built-in: Material React Table's
`positionToolbarAlertBanner` "displays selected row count automatically"
(`research-selection-ux-capabilities.md` §7). AG Grid has the equivalent component but paywalls the
entire Status Bar it lives in; TanStack, CDK, and PrimeNG give the integrator nothing, not even a
documented recipe. MRT proves this is cheap enough that gating it is a bundling choice, not
evidence of real cost. Raised as **OQ-3**.

## 2.3 — Know when everything currently visible is already selected *(multi)* — 🟡 partly covered *(the denominator is hand-computed)*

> As someone looking at a header checkbox, I want it to show a clear, correct, three-way state —
> all selected, none selected, or some — not just a binary that lies half the time.

**Acceptance criteria**

- A header/bulk checkbox's indeterminate ("some but not all") state is derivable without the
  consumer hand-computing a set intersection every render.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) and
[`selection-filtering/`](../../src/stories/filtering/selection-filtering/) — a header checkbox with
a real `[indeterminate]` binding, three-way and correct, including the case that breaks peers:
[`multi-selection/`](../../src/stories/selection/multi-selection/) filters the denominator through
`isSelectable()` first, so a locked row cannot hold the header permanently indeterminate (D61).

**Why it is 🟡:** this story's only acceptance criterion is that the state be derivable **without the
consumer hand-computing a set intersection every render**, and the consumer hand-computes it every
render. `selectableRowIds` in [`multi-selection/`](../../src/stories/selection/multi-selection/) is
precisely the signal that does not ship; `selectionStateOf(ids)` answers none/some/all only once the
caller already knows the id set. Routed to
[`work/computed-state-mechanism/1-intake.md`](../1-state/work/computed-state-mechanism/1-intake.md).
OQ-1, S1.

**Design status — gap, explicitly named by the spec itself.** `selectionStateOf(ids)` (D7) answers
"none/some/all" but only if the caller already knows and supplies the exact id set to check against
— it does not derive "is everything currently visible selected" on its own. This is routed to
[`work/computed-state-mechanism/1-intake.md`](../1-state/work/computed-state-mechanism/1-intake.md),
which exists only as an early intake folder, not a resolved design. Tri-state/indeterminate
checkboxes are real and native in two of five competitors (AG Grid, and PrimeNG's simpler
`aria-selected` version) but both name real correctness bugs in the space
(`research-selection-ux-capabilities.md` §1 cites AG Grid's own historical indeterminate-checkbox
bug surface). Raised as **OQ-1**.

## 2.4 — Not lose my selection when the view changes underneath it *(both)* — ✅ covered *(measured under filtering)*

> As someone who selected five rows, then applied a filter that hides three of them, I want those
> three to still count as selected — not silently vanish from my selection because I can't currently
> see them.

**Acceptance criteria**

- Filtering, sorting, or paginating never removes a row from the selection just because it's
  temporarily not rendered.
- Only an actual data removal (the row no longer exists at all) changes the selection.

**Covered by:** [`selection-filtering/`](../../src/stories/filtering/selection-filtering/),
**measured under the filtering plan** — filter selected rows out of view and they stay selected;
clear the filter and the selection comes back exactly as it was, checkable against the printed id
list rather than asserted. Sorting reorders rows and changes no selection at all. The second
criterion — only an actual data removal changes the selection — renders twice: deleting a
filtered-out selected row there, and *Someone else deleted this row* in
[`multi-selection/`](../../src/stories/selection/multi-selection/). The denominator question this
status leaves open is 2.3/2.5, both still 🟡.

**Design status:** covered, structurally, by D1 (no scope dependency on `withFiltering()`/
pagination — selection is a plain `Set<RowId>` untouched by either) plus D11 (reconciliation prunes
only ids that leave `data()` entirely, nothing else). This matches the confident, stated position
of the two most architecturally rigorous competitors — AG Grid and TanStack both guarantee
"a selection is a fact about a row, not about the current view," and both explain why
(`research-selection-community-pain.md` Theme 2; `research-selection-ux-capabilities.md` §5).
PrimeNG has no such policy, and the community's own coping pattern
(`(onFilter)="selectedItems = []"` hand-written resets) is the visible cost of that gap. What's
still open — here and in every competitor researched — is the denominator question in 2.3/2.5: a
hidden-but-selected row is *kept*, correctly, but nothing yet tells the person it's hidden.

## 2.5 — Know when part of my selection is currently hidden *(both)* — 🟡 partly covered *(the absence is stated, the count is not)*

> As someone who selected six rows and then filtered the table, I want to be told "6 selected, 2
> not currently visible" — not left to wonder why my count doesn't match what's on screen.

**Covered by:** [`selection-filtering/`](../../src/stories/filtering/selection-filtering/) renders
the **absence**, which is the honest half. Whenever a filter is active the story states on canvas
that rows selected beforehand are still selected and that **no shipped signal reports how many are
currently out of view** — so it says the count is missing instead of computing a fake one in the
host. That is also this story's own failure behavior holding: only the count display degrades, and
the selection is never guessed at or reset. It stops rendering that notice once the read-side count
lands.

**Why it is 🟡 and not ✅:** "6 selected, 2 not currently visible" does not render anywhere, because
nothing can compute it yet. S1, routed to `work/computed-state-mechanism/1-intake.md`.

**This is the same story as filtering's F-S1 / OQ-2, and is owned there, not here.** See §6.

---

# 3. Selection and the shape of the table

## 3.1 — Select every member of a group at once — ✅ covered *(measured under grouping)*

**Covered by:** [`grouping-selection/`](../../src/stories/grouping/grouping-selection/), **measured
under the grouping plan** — see [`grouping.md`](grouping.md) §5 X-G1, now ✅. It renders all three
peer cascade defaults off one `rowsOf()` call, a tri-state group checkbox derived rather than
stored, and a readout proving no group header id is ever in the selection. Per D16 the library ships
**no** cascade semantics, so what is covered is the consumer recipe, not a library guarantee.

**This is the same story as grouping's X-G1, and is owned there, not here.** See §6.

## 3.2 — A locked row doesn't quietly stay selectable, and doesn't quietly lose a mark it already had — ✅ covered

> As someone looking at a table with some records locked against action, I expect the locked ones
> to be visibly not-selectable — and if one was already selected before it got locked, I expect it
> to stay selected until I explicitly do something about it, not vanish from my count.

**Acceptance criteria**

- A locked/non-selectable row's control is visibly disabled, never simply hidden or absent —
  a person needs to see that the row exists and that it's specifically excluded, not wonder why a
  checkbox is missing.
- Selecting "everything visible" never quietly ropes in a locked row.
- A row that was selected *before* it became locked is not force-deselected as a side effect.

**Failure behavior**

- If a bulk select action is asked to include locked rows, the write drops them from the candidate
  set silently rather than throwing — a locked row being present in the data is routine, not
  exceptional.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) — and the
**visual half this status calls genuinely missing now renders**, which is the single biggest change
in this section. All three criteria are on screen:

- A locked row's checkbox is `aria-disabled`, **not** `[disabled]`, so it keeps its place in the tab
  order and stays discoverable; the row carries a visible `locked` badge, so the control is disabled
  rather than absent. Because `aria-disabled` does not stop a click, the host refuses the write
  itself — `toggle()`'s deselect branch is ungated (D58), so without that guard a locked row could
  still lose its mark by click.
- Select-all never ropes one in: the header's denominator is pre-filtered through `isSelectable()`.
- *Lock this row* locks an **already-selected** row and the mark survives — the second,
  separately-filed half of PrimeNG's bug (#15780) that libraries miss even after fixing the first.
  Untick the header afterwards and the mark does go, because `clearSelection()` is ungated: the two
  buttons sit next to each other so the asymmetry is one click apart.

*Not demonstrated:* the stated failure path — a bulk `select()` **asked** to include locked ids
dropping them silently rather than throwing. The host pre-filters, so D58's own gating never fires
on canvas. It is unit-tested, not rendered.

**Design status:** the write-path half is covered — `enableRowSelection` (D58) gates every
id-**adding** write (`toggle`, `select`, `initialSelection`) but never `deselect`/`clearSelection`,
so an already-selected row that later becomes locked keeps its mark until the person (or code)
explicitly clears it (D58/D60). This matches the majority industry position — only AG Grid
auto-deselects a newly-locked row, and pays for that with a dedicated `'selectableChanged'` cause
value in its selection-source enum just to explain the library-initiated change
(`research-selection-ux-capabilities.md` §6). What's genuinely missing is the **visual** half: no
directive renders a disabled-not-hidden control yet, and PrimeNG's own history shows this is easy
to get half-right — one filed bug for "select-all shouldn't select disabled rows" (👍34, open 3+
years) and a second, separate bug two years later for "select-all shouldn't touch already-selected
disabled rows either" (`research-selection-community-pain.md` Theme 6, PrimeNG #6736/#15780). Worth
an explicit test for the second half given how easily it's missed even by libraries that fixed the
first half.

## 3.3 — Not accidentally end up with two rows selected in a single-select table — ✅ covered

> As someone using a table where only one row can be "the current one," I expect selecting a second
> row to replace the first, not add to it, even if my code asked for both.

**Covered by:** [`single-selection/`](../../src/stories/selection/single-selection/) — the control
is a radio group, so the replace rule is the group's own semantics: ticking a second row visibly
unticks the first with no host code saying so. Failure: *Restore a 2-id saved selection* asks for
two rows that both exist, so there is nothing to skip and the table must resolve the conflict —
under `ngDevMode` D14 throws naming the ids it discarded, and the story catches that error and
renders the message in a `role="alert"`. The production behavior (truncate to the last id, silently)
is the branch the story cannot reach, and says so.

**Design status:** covered — `enableMultiRowSelection: false` (or a per-row predicate) is checked
against the whole candidate set for a write, not just the id named in the call (D14): a conflicting
bulk request keeps only the last id. Under `ngDevMode` this throws, naming the discarded ids; in
production it truncates silently, deliberately, because `select(ids)` is often fed by runtime data
(a restored selection, a server response) where a hard throw would turn a data mismatch into a
startup crash.

---

# 4. Operate selection without a mouse

## 4.1 — Toggle a row's selection from the keyboard *(both)* — 🟡 partly covered *(Space yes; the focus model no)*

> As someone reviewing fifty rows in sequence, I want Space to mark the focused row, without
> reaching for the mouse.

**Covered by:** both stories, for the **Space half only**. In
[`multi-selection/`](../../src/stories/selection/multi-selection/) Space toggles the focused
checkbox; in [`single-selection/`](../../src/stories/selection/single-selection/) the radio group
supplies arrow-key roving focus **and** Space for free, which is the closest thing to keyboard row
navigation reachable before a directive exists.

**Why it is 🟡:** both come from native control semantics, not from a selection model. There is no
defined Tab/focus order across a whole table, no roving-focus containment, and nothing that would
survive replacing the checkbox with a click-to-select row (U3/U4). That is node H again, with 1.3
and 4.2.

**Design status — gap, and evidence says this needs to be designed in from the start, not
bolted on later.** No directive exists yet at all, so nothing is built either way — but across
every competitor researched, keyboard interaction for selection is consistently the **last**
capability shipped, or never shipped as a first-class row-level primitive:
Angular Material's `mat-table` has had a "no keyboard row navigation" issue open **six years**
(#14861, 👍19, still active); PrimeNG needed two separate multi-year efforts for two different
table variants (#713, #5762) to add any keyboard support at all; AG Grid has an **open WCAG
"no keyboard trap" violation** filed as recently as 2025-11
(`research-selection-community-pain.md` Theme 4). This is a strong argument for the eventual
`ngpTableSelectionCheckbox` directive treating Space-to-toggle and a defined Tab/focus order as
in-scope from its first drilling pass.

## 4.2 — Select a range from the keyboard *(multi)* — ❌ not covered *(blocked on node H, with 1.3)*

> As someone who already has a row focused via keyboard, I want Shift+Arrow to extend a selection
> the same way Shift-click does with a mouse.

**Covered by:** nothing, and blocked on node H with 1.3 — the same anchor-tracking mechanism serves
both gestures, so they are one piece of work and should be drilled together rather than sequenced.

**Design status — gap.** No primitive exists. PrimeNG has the fullest keyboard vocabulary in the
competitive set — Shift+Arrow extends a range, Shift+Space selects between anchor and focus,
Ctrl+A selects all — worth using as the reference shape when this is eventually drilled, **with
the explicit caution** that PrimeNG's own `Ctrl+A` implementation has a filed, live bug when
combined with `dataKey`-based row identity (`research-selection-ux-capabilities.md` §3,
primeng#15903) — the naive "recompute all ids against the wrong identity source" trap is easy to
fall into even for the library that got the rest of this right.

## 4.3 — Have a selection change announced to a screen reader *(both)* — 🟡 partly covered *(the count is announced; the row is not)*

> As someone using a screen reader, I want to hear "row selected" or "3 rows selected," not silence.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/) and
[`single-selection/`](../../src/stories/selection/single-selection/), partly — and this status's "no
`aria-selected` wiring" is now stale: every selected row in both stories carries
`[attr.aria-selected]`, and [`multi-selection/`](../../src/stories/selection/multi-selection/)'s
count banner is a `role="status"` live region, so a selection change is announced as the new total.

**Why it is 🟡:** the count is announced; the **row** is not. Nothing says "row selected" on the
gesture itself, [`single-selection/`](../../src/stories/selection/single-selection/) has no live
region at all, and AG Grid's documented limitation applies here unchanged — a change on the element
that already has focus may go unannounced. No announcement convention ships. U-layer work, tied to
node H.

**Design status — gap, unaddressed anywhere in this codebase yet.** No `aria-selected` wiring, no
announcement convention exists. Worth naming plainly rather than assuming "it'll be fine": even
AG Grid, which states the most about selection accessibility of any competitor, admits a real,
unresolved limitation — "some screen readers will not recognise changes that happen to an element
that is currently focused," so a keyboard-driven selection on the focused row may go unannounced,
with only a documented workaround (move focus away and back)
(`research-selection-ux-capabilities.md` §8). Material React Table's guide says nothing about
selection accessibility at all — a gap worth not accidentally copying.

---

# 5. When selection doesn't cooperate

## 5.1 — My selection quietly shrinking isn't a mystery *(both)* — 🟡 partly covered *(the shrink is visible; nothing says why)*

> As someone who had five rows selected and one got deleted by someone else, I want to know my
> selection is now four, and ideally why — not just discover the count is off later.

**Failure behavior**

- A row leaving the underlying data while selected removes it from the selection (never leaves a
  phantom, dead id behind — the opposite of Material React Table's own bug, see below) but does
  this silently at the API level too: `onRowsRemoved` reconciliation prunes `selectedRows` with
  **no** `selectionChanged` emission (D11 — deliberate, because the removal "carries no user
  intent"). A consumer today has no event to hook a "your selection changed because a row was
  removed" toast off of; they'd have to diff `selectedRows()` before and after a data write
  themselves.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/)'s *Someone else
deleted this row*, which removes a **selected** row from `data` the way a server push would. The
state-correctness half renders exactly as designed: reconciliation prunes the id (ADR-0006/D11), the
count drops, and no phantom id is left behind — Material React Table's open #1362 not happening.

**Why it is 🟡:** the observability half is rendered **as an absence**. The event log does not move,
because D11 deliberately emits nothing for a prune, and the story's notice has to explain that a
prune is reconciliation rather than a write. A person sees the count change and is told why only
because the story hardcodes the sentence — there is no signal a consumer could hook a "you had 5,
now you have 4" message off. That is the second, different mechanism OQ-4 asks for, unchanged.

**Design status — half solved, half a real gap.** The state-correctness half is genuinely ahead of
the field: Material React Table has a live, open bug where a deleted-then-refetched row *stays*
reported as selected and "Clear selection" doesn't clear it
(`research-selection-community-pain.md` Theme 2/8, MRT #1362) — `withSelection()`'s D11
reconciliation already prevents exactly that. What's missing is **observability**: no signal exists
for a consumer to build a "you had 5, now you have 4, here's why" message from. Raised as **OQ-4**.

## 5.2 — A row edited so it no longer qualifies for selection — ✅ covered *(unexpectedly — see below)*

> As someone who selected a row for a bulk status change, then edited a different field on it such
> that it now fails whatever rule made it selectable in the first place, I want the table to handle
> that sensibly — not leave me confused about whether my selection still means what I think it does.

**Covered by:** [`multi-selection/`](../../src/stories/selection/multi-selection/)'s *Lock this row*
— **unexpectedly, and worth saying plainly**. The button patches `locked: true` onto an
already-selected row, which is precisely this story's scenario: a field edited such that the row now
fails the rule that made it selectable. What happens is legible rather than confusing — the mark
survives (D58/D60 gate id-adding writes and never `deselect`), select-all stops including it, the
row shows its `locked` badge, and the notice states all three. An explicit clear still removes it.

**What this does not settle.** OQ-6 asked what the *right* behavior is, and no competitor evidence
exists either way. The story shows what **falls out of D58/D60** — retain, and tell — which is a
demonstrated position, not a decided one. Worth deciding on purpose now that there is something to
look at.

**Design status — open, with no evidence to lean on from any direction.** This is the selection
analogue of filtering's "an edit makes a row no longer match the active filter" story
(`row-editing.md` F-1) — but unlike that one, **no well-reasoned, verifiable issue was found in any
of the five competitor trackers** specifically about this
(`research-selection-community-pain.md` Theme 8). That silence is itself informative: this class of
problem (a mutation invalidating a previously-valid state held *elsewhere*) appears to be
under-tracked industry-wide, not solved-and-forgotten. No recommendation is offered here because
there is no precedent to weigh — raised as a genuinely open question, **OQ-6**.

## 5.3 — A misclick on "select all" doesn't wipe a large selection with no way back *(multi)* — ❌ not covered *(no library position to inherit)*

> As someone who meant to click near a "select all" toggle and hit it by mistake, I don't want a
> minute of careful picking undone with no way to get it back.

**Covered by:** nothing, and [`multi-selection/`](../../src/stories/selection/multi-selection/)
makes the exposure visible rather than fixing it: the header checkbox's second state clears the
whole selection in one click, with no confirmation, no undo, and nothing to get it back from. That
is the convergent gesture every peer ships, so the story is right to ship it — the missing guard is
a product decision no library in the researched set has taken. OQ-2.

**Design status — gap, no library position exists to inherit.** No confirmation step, no undo, and
no library anywhere in the researched set treats a destructive select-all/deselect-all as needing
either — the one corroborating complaint found (an end user asking a *different* product not to
silently wipe a selection on misclick) is adjacent evidence of the same underlying frustration
that surfaces as AG Grid's own "external state update silently clears selection with no opt-out"
bug (`research-selection-community-pain.md` Theme 2/9, AG Grid #6635; Theme 9). Raised as **OQ-2**.

---

# 6. Cross-feature interactions

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to selection. Per this repo's existing convention (`row-editing.md`, restated in
`filtering.md` §5 and `grouping.md` §5) — where a story already lives in another feature's doc, it
is **linked, not restated**, and that file keeps owning its coverage mark.

## Owned by filtering *(built)*

**F-S1 already exists** at [`filtering.md`](filtering.md) §5 "Owned by selection *(built)*" —
"selecting everything I can currently see stays true to what I see," plus the "N selected, M not
currently visible" retention story (§2.5/§5.1 above). It is **linked, not restated**;
`filtering.md` owns its coverage mark, and it now reads 🟡 with the split named: bullet 1 answered
by D59's `selectAllIds()` and demonstrated by `selection-filtering/`, bullet 2 (the "N hidden"
count) still genuinely unbuilt, with no shipped signal to compute it from. **Verified 2026-09-14** —
the drift this section used to flag is fixed, in that file.

## Owned by grouping *(built, uncommitted)*

**X-G1 already exists** at [`grouping.md`](grouping.md) §5 "Owned by selection *(built)*" —
ticking a group header's checkbox. Its own §1 changelog and §9 gap table record this as **"Closed
by D16"**: the library ships no cascade semantics — `table.rowsOf(group)` (issue #65) plus a
consumer-owned cascade is the answer, matching the deliberate flat-ids stance (D13). It is
**linked, not restated**. **Verified 2026-09-14:** the X-G1 story block's own body now states D16's
resolution, matching what its changelog and gap table already said — the drift this section used to
flag is fixed, and X-G1 is marked ✅ as the consumer recipe D16 calls for, demonstrated by
`grouping-selection/`. D16's resolution is the right one to cite going forward: PrimeNG's
rowGroup/selection features actively conflict in production, unresolved
for years (`research-selection-ux-capabilities.md` §4, primeng#5831/#4310) — a concrete cautionary
case for keeping cascade semantics out of this library until there's real evidence a general
policy (à la AG Grid's `groupSelects`) is worth the maintenance cost.

## Owned by selection *(built, blocked on bulk write verbs)*

### X-1 — Bulk delete and bulk edit need a selection source

Story lives at [`row-editing.md`](row-editing.md) §5, filed under "Owned by selection
*(unbuilt)*." **That header is now stale** — `withSelection()` has shipped, tested code
(`spec: drilled, code: partial`). The story itself is still correctly ❌: D12 explicitly keeps
bulk `removeRow(id[])`/`patchRow(id[], partial)` out of this effort's scope, and bulk edit
additionally needs row-editing's own G4 (multiple-open semantics) resolved. **What changed is the
blocker**, not the story: it used to be "no selection source exists," it is now "a selection source
exists; the bulk write verbs it would feed don't." **Verified 2026-09-14:** that header and body
are updated in `row-editing.md`; the story itself is still correctly ❌, and this is the one story
in the set no shipped demonstration can move.

---

# 7. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-1 — Should `withSelection()` (or a sibling read-side mechanism) expose a derived "are all
currently visible rows selected" signal? — open.**
*Recommendation:* yes, in-repo precedent for a computed cross-cutting signal is already being
worked out at `work/computed-state-mechanism/`; this is exactly the shape of problem that effort
exists to answer, and would let a header checkbox derive its indeterminate state without every
consumer hand-computing a set intersection every render.
*To decide:* whether it lands as a `withSelection()` member, a standalone helper like
`selectAllIds()`, or waits for the general computed-state mechanism to land first.
*Sequencing:* not blocking anything else in this document; the current `selectionStateOf(ids)`
already covers the case where the consumer supplies the denominator.

**OQ-2 — Should a large, destructive select-all/deselect-all get a confirmation step, or be
undoable? — open.**
*Recommendation:* no library-owned default — a documented recipe (warn above N rows, or route
through the same undo mechanism `row-editing.md`'s §3.2 already designs for deletes) rather than a
new API. No competitor treats this as the library's job either.
*To decide:* whether "large" is a number worth naming in a recipe, or left entirely to the
consumer's judgment.
*Sequencing:* independent; cheap; not blocked on anything.

**OQ-3 — Should the library ship a documented recipe (or a first-party component) for a
selection-count / bulk-action banner? — open.**
*Recommendation:* a documented recipe, not a shipped component — consistent with this library's
"attribute-only, no structural DOM injection" invariant. `selectedRows().size` already makes this
nearly free; only Material React Table ships the rendered version for free among the five
researched, and it's cheap enough there that its absence elsewhere reads as an oversight, not a
deliberate cost tradeoff.
*To decide:* whether this recipe belongs in `selection.md` now or waits for
`3-ui/directives/selection.md` to be drilled.
*Sequencing:* not blocked; can land as documentation alone.

**OQ-4 — Should removal-triggered selection shrinkage (D11's silent prune) become observable to a
consumer? — open.**
*Recommendation:* yes — a low-cost addition, since the diff is already computed internally to
perform the prune; the open question is only whether it rides on the existing `selectionChanged`
stream (contradicting D11's "no user intent" reasoning) or a new, explicitly-labeled channel.
*To decide:* whether conflating "removed by prune" with "removed by explicit write" on one stream
is more confusing than helpful — D11's original reasoning for keeping them separate was sound; the
gap is the second channel not existing yet, not that the first one carries the wrong thing.
*Sequencing:* independent; touches `engine/` reconciliation wiring, not the write verbs.

**OQ-5 — Should shift-click range selection (and its keyboard equivalent) be designed in from the
start of the eventual selection directive, given how consistently competitors got it late or
wrong? — open, but the recommendation is strong.**
*Recommendation:* yes, explicitly in-scope for that directive's first drilling pass, not a
follow-up. Budget the anchor-tracking state to live in the directive (not the state feature, which
stays flat per D13) and expect "does the range span filtered-out or off-page rows" to reopen §1.4's
scope question in a new shape.
*To decide:* nothing structural yet — this is a sequencing/scoping commitment for whoever drills
`3-ui/directives/selection.md` next, not an API decision today.
*Sequencing:* blocked only on that directive effort starting.

**OQ-6 — What should happen when an edit makes a previously-valid selected row no longer qualify
for whatever made it selectable? — genuinely open, no precedent to lean on.**
*Recommendation:* none offered — the competitive research found no comparable case in any tracker
to weigh evidence from, unlike every other open question in this document. This needs a real
product decision made fresh, not inferred from the market.
*To decide:* whether this is even in scope for `enableRowSelection`'s existing predicate (re-run on
every edit?) or a wholly separate mechanism.
*Sequencing:* not blocking anything else; worth deciding before row-editing × selection composition
is designed in earnest (relevant to X-1 once bulk edit exists).

---

# 8. Gap analysis, split by owning layer

The point of writing this after `selection.md`/`3-spec.md` was to find these. Listed plainly so
they are absorbed rather than discovered. **The stories above are deliberately layer-free**; the
gaps are not — each is work someone has to do, and the first question about any piece of work is
who does it.

## 8.1 State-layer gaps

Owned by `1-state/work/with-selection/` and `selection.md` itself.

| # | Gap | Story | Note |
|---|---|---|---|
| S1 | No derived "are all currently-visible rows selected" signal | 2.3, F-S1 | Routed to `work/computed-state-mechanism/1-intake.md`, unresolved. OQ-1 |
| S2 | Reconciliation prune (row removal) emits nothing on `selectionChanged` | 5.1 | Deliberate per D11, but leaves no observability hook. OQ-4 |
| S3 | No "every row that exists, even unfetched" select-all scope | 1.5 | Deliberately unsolved — only AG Grid's Enterprise SSRM reaches this rung anywhere in the survey |
| S4 | Bulk `removeRow(id[])`/`patchRow(id[], partial)` don't exist | X-1 | D12 — out of this effort's scope by design, blocks bulk delete/edit downstream |
| S5 | No answer for a row edited out of its own selectability | 5.2 | OQ-6 — no competitor precedent either |

## 8.2 UI-layer gaps

Owned by `3-ui/directives/selection.md` (currently `spec: stub, code: none`).

| # | Gap | Story | Note |
|---|---|---|---|
| U1 | No selection checkbox/row directive of any kind | 1.1–1.7 | Confirmed: zero directive files reference any selection member |
| U2 | No shift-click range-select mechanism or anchor-tracking recipe | 1.3 | OQ-5. Every competitor either got this late (TanStack: 4.5yr) or wrong-then-fixed (PrimeNG: 4.5yr) |
| U3 | No keyboard model — Space to toggle, Tab containment, Shift+Arrow/Shift+Space/Ctrl+A range | 4.1, 4.2 | Competitors ship this last or never; strong argument to design in from the start |
| U4 | No screen-reader announcement convention for selection changes | 4.3 | Even AG Grid, the most candid competitor here, admits an unresolved limitation |
| U5 | No selection-count/bulk-action-toolbar recipe | 2.2 | OQ-3. Cheap — `selectedRows().size` already exists |
| U6 | No visual convention for a disabled-not-hidden locked row | 3.2 | Industry-unanimous convention (disable, never hide) not yet documented here |
| U7 | No indeterminate-checkbox wiring recipe | 2.3 | Blocked on S1 landing first |

## 8.3 Gaps needing both layers

| Gap | State owes | UI owes |
|---|---|---|
| Indeterminate header checkbox (2.3) | S1's derived "all visible selected" signal | rendering the indeterminate state + wiring the click handler to `selectAllIds()` |
| Range select (1.3, 4.2) | Nothing new — deliberately flat per D13 | The entire anchor-tracking mechanism; the "does the range span hidden rows" question loops back into needing `rows()`, already available |
| Selection-shrink observability (5.1) | S2's second, explicitly-labeled emission channel (OQ-4) | Whatever UI hooks that channel into a visible "your selection changed" message |

## 8.4 Confirmed right — do not re-litigate

- **`RowId`-keyed flat `Set<RowId>`, never array index or object identity** — direct defense
  against a recurring, multi-library bug class: TanStack's v7→v8 index-keyed selection surviving a
  data swap into the wrong rows (#4498, still active), and two separate CDK `compareWith` bugs
  where restoring a selection against freshly-fetched object identities silently failed
  (`research-selection-community-pain.md` Theme 2).
- **No parent/child cascade in state (D13)** — every competitor that put cascade logic in the
  library/state layer is still fixing correctness bugs years in, including a fix merging in
  TanStack a month before this research (Theme 5). Keeping it consumer-owned until `withGrouping()`
  gives real evidence otherwise is the position the market's own scars support.
- **No "select all" scope concept at the write layer (D1)** — sidesteps Theme 1's single
  most-repeated bug in the entire category; three libraries have shipped a purpose-built config
  knob to answer this and are still fixing it years later.
- **Signal-read, unstamped selection, never on `RenderRow` (D5)** — avoids the re-render-storm bug
  class three of five competitors have shipped and needed year-plus fixes for (Theme 7).
- **`enableRowSelection` gates writes only, never forces deselection (D58)** — matches the
  majority industry position; only AG Grid auto-deselects, and pays for it with a 16-value cause
  enum just to explain the library-initiated change to subscribers.
- **Silent reconciliation prune on row removal (D11)** — already ahead of Material React Table's
  own live bug where a deleted row stays reported as selected. The *only* thing missing is
  observability (S2/OQ-4), not correctness.

---

# 9. Capabilities with no owner

Distinct from the gaps above: these are not missing paragraphs in an existing spec, they are
**features with no doc at all**. Checked against `docs/status.md` (the generated capability
registry) rather than against memory.

### 9.1 Selection-count / bulk-action toolbar convention — **UI**

No doc anywhere names this — not `selection.md`, not the `3-ui/directives/selection.md` stub, not
`status.md`. It's the delivery vehicle for §2.2/OQ-3, and the one clear "cheap, competitor-proven,
currently absent" item in this whole document — Material React Table gives it away free with zero
developer wiring.

### 9.2 Shift-click range-select / anchor-tracking mechanism — **UI**

Also absent from every doc, including the `3-ui/directives/selection.md` stub, which covers only
the checkbox-binding mechanism and says nothing about range gestures. Given the community evidence
(§1.3/OQ-5 — every competitor either shipped this late or shipped it broken first), its total
absence from the doc set is worth naming explicitly rather than assuming it's implicitly covered
by "the selection directive" once that gets drilled.

### 9.3 Server-side "select every row that exists" scope — **state**, deliberately declined

Named already at §1.5 — listed here too because, like the two above, it is a capability with
*zero* ownership anywhere in the docs, not scoped-out-with-a-note. `state-persistence.md` and
`selection.md` are both silent on it. Only AG Grid's Enterprise SSRM reaches this rung in the
entire competitive survey — declining to build it now is defensible, but worth stating as a
decision rather than a silent gap once server-mode tables become a real target for this library
(mirroring how `filters.md` explicitly named its own server/client split).

---

# 10. Not user-facing

Real problems, but the integrating developer's, not the person using the table. Listed so they are
not mistaken for missing stories.

- **Whether `SelectionChange` carries a `source`/`cause` discriminator** (D10, explicitly declined)
  — a consumer-side wiring question (was this write triggered by a checkbox click vs. an API call);
  invisible to the person selecting rows.
- **Whether the delta-emission mechanism (`applyNextSelection`'s diff) is shared with any other
  feature** (internal audit §4) — it isn't, and nothing about that is visible on screen.
- **Whether `selectAllIds()` is a `SelectionMembers` method or a standalone function** (D59) — a
  developer-ergonomics call about API surface shape, with no on-screen consequence either way.
- **The `docs/tasks/progress.md` bookkeeping drift** flagged by the internal audit (Step 7 marked
  "in progress" while its tests are actually complete and passing) — a maintainer tracking problem,
  not something a person using the table would ever perceive.
- **Whether `2-decisions.md`/`selection.md`'s open-questions sections still describe the
  group-header question as "undecided" after grouping's D16 answered it** — the same category as
  the previous item: stale internal bookkeeping, not a product gap. Flagged in "Report the deltas"
  below since it's this document's job to catch cross-doc drift, but the fix is a documentation
  edit, not new design work.
- **`0-architecture-seam.md`'s superseded pre-grill note about a `RenderRow.isSelected?` field**
  (contradicted by D5 the same day it was written) — a stale working note nobody using the table
  would ever read.

---

# Report the deltas

Per this pass's own method, here is what it found that the settled design did not have, named
plainly:

- **Stories with no corresponding decision:** §1.3/1.5 (range select, unfetched-row scope), all of
  §4 (keyboard/a11y), §2.2/2.3 (count, indeterminate state), §5.1's observability half, and §5.3
  (destructive select-all guard). None of these have a state or UI decision behind them today.
- **A story the settled design cannot fully satisfy as decided:** §5.1 — D11's silent-prune
  reasoning is sound for *why* it doesn't emit on `selectionChanged`, but leaves the person with no
  path to ever find out their selection shrank. Not a design mistake, an intentionally narrow
  decision that needs a second, different mechanism to complete the story (OQ-4).
- **Capabilities with no owner at all**, checked against `docs/status.md` and every sibling feature
  doc: §9.1 (selection-count toolbar) and §9.2 (range-select mechanism) — both absent from every
  doc in the registry, not merely unbuilt within an existing one.
- **Stale cross-references found in sibling docs — fixed 2026-09-12:**
  - `filtering.md`'s F-S1 marked 🟡 (was ❌); bullet 1 credited to D59, bullet 2 (hidden-count)
    left open and pointed at this doc's §2.5/§8.1 S1. OQ-2 marked half-resolved accordingly.
  - `grouping.md`'s X-G1 story body updated to state D16's resolution (consumer-owned cascade via
    `rowsOf(group)`), matching what its own changelog/gap table already said.
  - `row-editing.md`'s X-1 section header changed to "Owned by selection *(built, blocked on bulk
    write verbs)*," body updated to name D12 as the actual current blocker.
  - `2-decisions.md` and `features/selection.md`'s open-questions sections both updated to record
    D16 as resolving the group-header question, rather than describing it as blocked on
    `withGrouping()` being unbuilt.
  - `state-persistence.md`'s selection open question updated to point at D19 rather than saying
    `withSelection()` doesn't exist yet; left open only as a scheduling question.

**Done 2026-09-14:** `story-plan` consumed this document and re-derived every mark above against
the four shipped story hosts. Of the deltas named here, two are now answered by code rather than by
decision — §2.3's indeterminate state renders (though the denominator is still hand-computed, so it
stays 🟡) and §5.2 turned out to be demonstrated by `multi-selection/`'s lock control, which is its
scenario exactly. The rest stand: §1.3/§4.2 are blocked on node H rather than undecided, §5.1's
observability half still needs OQ-4's second mechanism, §5.3 still has no position to inherit, and
§9.1/§9.2 still have no owner.

**Still pending from this pass** (held back deliberately, not missed): `3-ui/stories.md` does not
yet register the new story folders, the three `1-gap-analysis.md` files still say "nothing here
built yet", and `docs/status.md` needs regenerating — `npm run table:status`, to be run by hand.
