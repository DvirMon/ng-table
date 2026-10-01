---
title: Product — Expansion (Detail Panel) User Stories
type: product
capability: expansion
status: >
  0 of 12 §1–§3 stories ✅, 0 🟡, 12 ❌. The state layer is complete and tested — open set,
  multi-expand, the `everExpanded` keep-mounted ledger, `initial`, pruning on row removal — but a
  person gets nothing on screen from it: no story composes `withExpansion()`, no expansion
  directive ships, and the UI spec (`3-ui/directives/expansion.md`, v0.4) predates the panel/tree
  split and would ship four bugs if built as written (§8.2 U2). Most stories here are "shipped,
  never shown", not "unbuilt". One is a genuine gap: a panel's loading/failure state is
  consumer-owned with no recipe yet (3.1, OQ-exp-5). Single-open (OQ-exp-1) and the side panel
  (OQ-exp-7, 1.6) are recipes on the shipped state; the panel ships no CSS (OQ-exp-6). Panel mount
  lifetime is resolved (OQ-exp-8: unmount by default, `release()`, a11y directives in #199,
  virtualization deferred to the virtual-scroll spec); step-to-next-row is core keyboard navigation (OQ-exp-9, ADR-0029).
  Written after `features/expansion.md` (`spec: drilled`, code shipped) and ADR-0012 — this doc's
  job is the person-facing half neither covers.
date: 2026-09-30
audience: product, design, engineering
---

# Expansion (detail panel) — user stories

What a person needs when they want to see more about one row without leaving the list, and what
they should experience when the panel's content fails, the rows move underneath it, or they can't
use a mouse. Engineering derives API from this document, not the reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it — coverage marks here are updated from the product side as capabilities
> land.

> **Scope is the detail panel only.** Rows that reveal *more rows* (a tree, collapsible groups)
> are [`tree.md`](tree.md)'s, per [ADR-0012](../adr/0012-split-expansion-into-panel-and-tree.md).
> Opening a panel never adds, hides or reorders rows.

## Scope

**A detail panel means: I open one row, see more about it right under it, and the list around it
doesn't move or forget where I was.** A person perceives six things, and does not care which layer
produces them:

1. Every row that has more to show offers one obvious control that opens it — and rows with
   nothing to show don't pretend.
2. I can open and close it from the keyboard, and a screen reader tells me whether it's open.
3. The panel stays attached to *its* row — sorting, filtering or refreshing never moves it to
   another row, or leaves it open and empty.
4. What I did inside a panel (a tab I picked, text I typed) is still there when I reopen it.
5. When the panel's content is slow or fails, I see that *in the panel*, and the rest of the table
   keeps working.
6. I can open several to compare, or close all of them at once.

**Inline, not a side panel — a deliberate difference from end-user products.** Every end-user
product surveyed (Notion, Jira, Linear, Airtable, GitHub Projects, monday.com, Smartsheet) opens
row detail in a right-side panel or a modal; none opens it inline under the row
([`research-expansion-product-ux.md`](../1-state/work/expansion/active/story-discovery/research-expansion-product-ux.md)
F1). Every *table library* surveyed opens it inline
([`research-expansion-ux-capabilities.md`](../1-state/work/expansion/active/story-discovery/research-expansion-ux-capabilities.md)).
A side panel is app layout outside the table, but the current state already supports it:
`withExpansion()` used single-open (**OQ-exp-7**, resolved; story 1.6). This doc covers the inline
panel first, and borrows from the products what transfers: the keys (Space/Enter open, Esc closes)
and the rule that opening detail must not cost the person their place. Stepping to the next row
while detail is open is core keyboard navigation (**OQ-exp-9**, resolved; §7.1).

## Coverage marks

| Mark | Meaning |
|---|---|
| ✅ **covered** | Demonstrable today in `src/stories/` or a demo app, with the failure path included |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not — no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

**No story composes `withExpansion()`.** All 26 story hosts were read
([`research-expansion-internal-coverage.md`](../1-state/work/expansion/active/story-discovery/research-expansion-internal-coverage.md)
§E). `grouping/grouping-collapsible/` — cited as a `withExpansion()` story in
[`sorting.md`](sorting.md), [`grouping.md`](grouping.md) and [`../3-ui/stories.md`](../3-ui/stories.md)
— composes `withTree()`. The closest markup precedent for a panel is
[`row-edit/external-write/`](../../src/stories/row-edit/external-write/): a second consumer `<tr>`
with `colspan` inside the same `@for`, gated per row.

That makes every mark below ❌, including the many stories whose mechanism is fully shipped and
unit-tested (`with-expansion.spec.ts`). The stories note which is which: **shipped, never shown**
is a story-writing gap; **unbuilt** is a design gap.

Competitor behavior cited here comes from
[`research-expansion-ux-capabilities.md`](../1-state/work/expansion/active/story-discovery/research-expansion-ux-capabilities.md)
(version-pinned, 2026-09-30),
[`research-expansion-community-pain.md`](../1-state/work/expansion/active/story-discovery/research-expansion-community-pain.md)
(issues read live the same day) and
[`research-expansion-product-ux.md`](../1-state/work/expansion/active/story-discovery/research-expansion-product-ux.md).
Not restated here beyond what a story needs.

---

# 1. Open a row's detail, and close it again

Ordered by how badly the person is hurt if it is missing.

## 1.1 — Open one row's detail under it, without losing my place — ❌ not covered

> As someone scanning forty orders, I want to open one order's line items right under it, glance,
> and close it — without being sent to another page or losing where I was in the list.

**Acceptance criteria**

- Each row that has detail shows one control — a chevron button on the row — that opens a panel
  directly beneath that row, spanning the table's width.
- The control's look changes with its state (e.g. chevron right → down).
- Opening it changes nothing else: the rows above stay put, the list order is unchanged, and no
  other row's panel closes.
- Clicking the same control closes the panel.

**Failure behavior**

- The panel is for *this* row only — it never shows another row's content (see 2.1 for the
  sort/refresh variant).

**Coverage:** nothing on screen. `table.expansion.toggle(id)` and the open set are shipped
(`with-expansion.ts:65-67`); no story renders a toggle or a panel, and no toggle directive ships.

**Design status — shipped state, no UI.** A dedicated chevron button is the one affordance all five
surveyed libraries agree on. Plain row-click to open is a built-in default in none of them (AG
Grid's double-click is the exception), and it collides with row-click selection — MUI refused to
separate the two (`mui/mui-x#19149`, closed not planned). **Row click is therefore not part of this
story.**

## 1.2 — Open and close it from the keyboard, and hear whether it's open — ❌ not covered

> As someone who uses a screen reader, I want to reach the expand control with Tab, open it with
> Enter or Space, hear "expanded", and then move straight into what just opened.

**Acceptance criteria**

- The control is a real `<button>`; Enter and Space both toggle it.
- The button — not the row — carries `aria-expanded`, and `aria-controls` pointing at the
  panel's detail row; its accessible name says what it opens
  ("Show details for order 1042").
- After opening, the next Tab stop is the first focusable thing *inside the panel*, before the next
  row's controls.
- A closed panel's content is not focusable and not read out (hidden and `inert`), even if it stays
  in the page.

**Failure behavior**

- If `aria-expanded` sits on the row instead of the button, a `role="table"` row fails axe — the
  exact failure AG Grid shipped four times (2023–2026) before moving to `role="treegrid"`
  (`ag-grid/ag-grid#15012`). This library keeps `role="table"`, so the button is the only valid
  host.

**Coverage:** nothing. The core row's `aria-expanded` binding never fires for a panel
(`isExpanded` is tree-only) and was deleted in #182 — `ngp-table-row.directive.ts` binds none.
The library will ship the panel toggle and panel-content directives that own this (OQ-exp-8 part 3,
E41); until they exist, nothing on screen covers 1.2.

**Design status — gap in UI; the a11y shape is ruled.** The toggle follows the APG Disclosure
pattern — button-hosted `aria-expanded` + `aria-controls` (**OQ-exp-2**, resolved). The community signal is the loudest of any theme: Angular Material's
example fails keyboard-only use and has been open since 2019 (`angular/components#15020`); MUI's
VoiceOver cannot enter the panel (`mui/mui-x#18455`, open); MUI's tab order skips past the panel
(`mui/mui-x#4219`, open).

## 1.3 — Rows with nothing to show don't offer to show it — ❌ not covered

> As someone looking at a list where only some orders have notes, I don't want an expand button on
> every row that opens an empty box half the time.

**Acceptance criteria**

- A row with no detail either shows no control or shows a visibly disabled one — the table decides
  which consistently.
- Expand-all (1.5) skips such rows.

**Failure behavior**

- Clicking a control on a row with no detail must not open an empty panel.

**Coverage:** nothing on screen. `withExpansion()` has no per-row eligibility, by decision.

**Design status — resolved 2026-09-30: consumer recipe (OQ-exp-4).** Whether a row has detail
depends on panel content, which is consumer data (OQ-exp-5). The template hides the chevron per
row (`@if (row.notes)`); expand-all passes filtered ids —
`expand(rows().filter(hasDetail).map(trackBy))` — since bare `expand()` means "every row".
Peers ship a per-row predicate (`isRowMaster`, a null-returning `getDetailPanelContent`,
`getRowCanExpand`); here the consumer's own filter does that job. Also: the stale UI spec defaults
"disabled" to `!row.hasChildren`, which is `false` on every flat row — built as written, it
disables *every* toggle (§8.2 U2).

## 1.4 — Keep several open to compare them — ❌ not covered

> As someone comparing two suppliers' contract terms, I want both panels open at the same time.

**Acceptance criteria**

- Opening a second panel leaves the first open.

**Coverage:** nothing on screen; multi-expand is the shipped default
(`with-expansion.spec.ts:45-69`).

**Design status — shipped, never shown.** Multi-open is the default in every library that has a
default (MUI, PrimeNG, TanStack). The end-user products document only one detail open at a time —
but that is a side-panel constraint (one panel slot), not a choice an inline layout forces. A
single-open is a recipe, `set(isOpen ? [] : [id])`, not a mode (**OQ-exp-1**, resolved; shown
in 1.6).

## 1.5 — Open or close every panel at once — ❌ not covered

> As someone about to print or scan a short list, I want one button that opens every row's detail —
> and one that closes them all when I'm done.

**Acceptance criteria**

- One action opens every visible row's panel; one action closes all of them.
- The control labels itself correctly — it doesn't say "Expand all" when everything is already
  open.

**Failure behavior**

- Rows the filter currently hides are not opened by "expand all".
- On a large table (e.g. 1,000 rows), expand-all must not freeze the page or fire one request per
  row. The table's own cost is trivial — one `Set` write, one `changed` emission, `renderRows()`
  untouched (E12). The cost is 1,000 mounted panel bodies (no virtualization) and, with the lazy
  recipe (OQ-exp-5), 1,000 simultaneous fetches — collapse-all frees them under the
  default recipe (OQ-exp-8, E40). Until virtual scroll supports panels (E42), a consumer can hide
  or disable expand-all above a row count, expand only the current page, or keep panel bodies light.
  Peers show both failures: MUI called the content callback for all 4,058 rows
  (`mui/mui-x#7811`); AG Grid leaked detail grids until the page crashed
  (`ag-grid/ag-grid#10911`). No peer ships an expand-all button.

**Coverage:** nothing on screen. `expand()` with no ids opens every row in `rows()` (the filtered
set) and `collapse()` with no ids closes everything (`with-expansion.spec.ts:71-122`).

**Design status — shipped, never shown; label is the consumer's.** There is deliberately no
"all open?" member; the consumer derives `expansion().size === rows().length`. When some rows
have no detail (1.3), expand-all passes the consumer's filtered ids and the label compares against
the consumer's own eligible count instead of `rows().length` (OQ-exp-4). No library ships an
expand-all *button* — it is an API or a recipe in all five — and it keeps being requested
(`mui/mui-x#6041`, open).

## 1.6 — See one row's detail beside the list without losing my place — ❌ not covered

> As someone working through a list of orders, I want one order's detail in a side panel next to
> the table, so I can read it while the list stays where it is.

**Acceptance criteria**

- Clicking a row, or its button, shows that row's detail in a side panel.
- The table doesn't shift when the panel opens.
- Clicking another row swaps the panel's content to that row.
- × or Esc closes the panel.
- After a sort, the panel still shows the same row.

**Failure behavior**

- The shown row is deleted → the panel closes, with no stale content left behind.

**Coverage:** nothing on screen.

**Design status — resolved 2026-09-30 (OQ-exp-7).** The state already supports it; the UI (drawer,
split view, modal) is the consumer's. `withExpansion()` used single-open: `set([id])` to show,
`set([])` / `collapse()` to close, `expansion()` to read; no inline panel markup. Keyed by id, so
it follows the row across sort and filter; `onRowsRemoved` prunes the open set, so deleting the row
closes it. Stepping to the next/previous row is core keyboard navigation (**OQ-exp-9**, [#201](https://github.com/DvirMon/ng-table/issues/201)) — out of scope here.

---

# 2. The panel stays attached to its row

## 2.1 — Sorting or filtering never moves an open panel onto another row — ❌ not covered

> As someone who opened order 1042's details and then sorted by date, I want 1042's panel to go
> where 1042 went — not to stay on "row three", now a different order.

**Acceptance criteria**

- After a sort, the open panel is still under the same row, wherever that row now is.
- After a filter hides that row, its panel is gone with it; clearing the filter brings the row back
  with its panel still open.
- The first click on any row's control after a sort works — no swallowed clicks.

**Failure behavior this avoids:** the oldest and most repeated pain in the category. Panel state
kept by position opens on the wrong row, shows "expanded" with nothing in it, or needs two clicks —
reported 2017–2025 across all four open-source libraries; Angular Material's version has been open
since 2018 (`angular/components#13431`).

**Coverage:** nothing on screen. Given for free: the open set is keyed by row id, and only row
*removal* from `data` prunes it — a sort or filter never writes to it (research internal-coverage
§C).

**Design status — correct by construction, never shown.** This is also the expansion half of
filtering's 1.1 (§4). Worth a story precisely because it is the category's signature bug and this
library cannot have it.

## 2.2 — Refreshing the data keeps the same panels open — ❌ not covered

> As someone who left three panels open while the list auto-refreshes, I want the same three rows
> to still be open afterwards.

**Acceptance criteria**

- After a refetch, every row that still exists keeps its panel's open/closed state.
- A row the refetch removed loses its open state — it does not come back open by surprise later.

**Failure behavior**

- A refetch that returns new row *objects* with the same ids must not close every panel (Angular
  Material's example keys by object reference and does exactly this).

**Coverage:** nothing on screen. Id-keying gives the first criterion. The second is half-met:
removal prunes the open set (ADR-0012 D4) — but E4 deliberately keeps *restored* stale ids, so a
row restored from a saved snapshot that reappears later does come back open. That is decided, and
consistent; it just needs to be visible to be judged.

## 2.3 — What I did inside a panel is still there when I reopen it — ❌ not covered

> As someone who picked the "Invoices" tab inside a customer's panel, closed it, and opened it again,
> I want to land on "Invoices" — not back on the first tab, and not wait for it to load again.

**Acceptance criteria**

- A panel opened once keeps its content between close and reopen.
- Closing still animates (the content is there to animate out).

**Failure behavior**

- A closed-but-kept panel must be `inert` (1.2) — kept content that is still tabbable is a worse
  bug than losing the tab.

**Coverage:** nothing on screen. `everExpanded` — every id ever opened — is shipped and tested
(`with-expansion.spec.ts:289-332`) and exists for exactly this: mount on first open, keep mounted
after.

**Design status — shipped, never shown.** `everExpanded` is exempt from pruning by
[ADR-0006](../adr/0006-row-id-state-reconciliation.md) (**OQ-exp-3**, resolved), but per
**OQ-exp-8** (resolved) the default recipe unmounts on close; keeping inner state is a per-row
opt-in on `everExpanded` (E40), freed by `release()` (E39). Competitors split here too: AG Grid destroys on close (opt-in
keep, capped at 10), Material's example keeps everything mounted and hidden, and TanStack's
unmount-on-close blocks exit animation (`TanStack/table#1203`).

---

# 3. When the panel's content does not cooperate

## 3.1 — A slow or failing panel says so in the panel, and nothing else breaks — ❌ not covered

> As someone who opened a customer's order history on a bad connection, I want to see it's loading,
> and if it fails, a message and a Retry *inside that panel* — not an empty box, and not an error
> that blanks the whole table.

**Acceptance criteria**

- While a panel's content loads, the panel shows a loading state.
- A failure shows a message and a Retry in that panel only; other panels and the table keep
  working.
- A panel that was open when the table first appeared (2.2, 3.3) loads its content too — it is not
  open-and-empty because nothing told it to fetch.

**Failure behavior this avoids:** PrimeNG's toggle remembered its state across a reload, but the
content fetch hung off an "on expand" event that never fired for a restored panel — "the row toggler
keeps the state but the details are empty" (`primefaces/primeng#7526`). No product and no library
surveyed documents a panel loading or error state at all.

**Coverage:** nothing. No feature owns per-panel loading — `features/expansion.md` and
`3-ui/directives/expansion.md` both list it as open.

**Design status — consumer-owned, recipe (OQ-exp-5).** The panel is consumer markup, so the fetch is consumer-owned — but
which signal to fetch on is not obvious. Fetching on "is in `everExpanded`" (mount), not on a
`changed` event, is what makes the restored-panel case work, because `initial` seeds
`everExpanded` and emits nothing. That is a recipe, and it has to be shown to be learned.
**OQ-exp-5.**

## 3.2 — Opening a panel is smooth and doesn't make the page jump — ❌ not covered

> As someone opening a panel halfway down the page, I want it to slide open and push the rows below
> it down — not snap, and not scroll me somewhere else.

**Acceptance criteria**

- The panel animates open and closed (height, not a hard jump).
- The page's scroll position doesn't change on open or close.
- Rows below move with the panel; no row glides from a stale position on the next sort.

**Coverage:** nothing. No slide helper ships. The row-reorder animation re-measures only when
`renderRows()` changes — opening a panel doesn't change it, so the next sort may animate rows from
their pre-panel positions (research internal-coverage U1, unverified).

**Design status — UI gap.** The UI spec's one-wrapper `grid-template-rows: 0fr → 1fr` slide is
sound and matches Angular Material's example. Animation is a steady request elsewhere
(`mui/mui-x#10240`, 12 👍, open). Virtual-scroll scroll jumps — the largest pain cluster by volume
— don't apply: this table doesn't virtualize.

## 3.3 — A table can open with a panel already open — ❌ not covered

> As someone following a link a colleague sent me to "order 1042, details open", I want the table
> to appear with that panel already open.

**Acceptance criteria**

- The table's first paint shows the chosen panels open, with no flash of closed.
- Their content loads per 3.1.

**Coverage:** nothing on screen. `initial` is shipped: it seeds the open set *and* `everExpanded`,
and emits nothing (`with-expansion.spec.ts:289-306`).

**Design status — shipped, never shown.** Restoring a saved view is the persistence feature's
(`state-persistence.md`, proposed); this story is only the "opens already open" half.

---

# 4. Cross-feature interactions

**Each story below belongs to the feature that has to change to resolve the collision.** Where a
story already lives in another feature's doc, it is **linked, not restated**, and that doc keeps its
coverage mark.

## Owned by grouping *(built)*

**E-G1** at [`grouping.md`](grouping.md) §5 — collapsing a group hides its rows' open detail panels,
and reopening the group restores them. **Marked ✅, but the evidence is a tree chevron, not a
panel:** `grouping-collapsible/` composes `withTree()`, no `withExpansion()`. The panel criterion is
undemonstrated and the mark should drop to ❌ until a story composes both (§8.3). By construction it
should hold: a collapsed group removes its rows from `renderRows()`, and a panel is consumer markup
under its row, so it goes with it; the open set is untouched, so reopening restores it.

## Owned by filtering *(built)*

**1.1** at [`filtering.md`](filtering.md) — filtering never changes what's expanded on the rows that
remain. Given for free (2.1 above); no story composes `withFiltering()` + `withExpansion()`.

## Owned by expansion

**E-T1 — A row can have both a panel and child rows, and the two controls don't get confused.**
MUI users ask to open both on one row (`mui/mui-x#12088`, open); TanStack's shared `isExpanded` flag
made a subcomponent open whenever a group opened (`TanStack/table#3333`). Here the two features keep
separate state and compose in either order without collision (`with-expansion.spec.ts:370-398`) —
the person-facing risk is only two chevrons on one row that look alike. Expansion owns it because
its control is the newer one and must be visually distinct from the tree's. ❌ not covered.

## Not owned here

- **Row click selects vs. row click expands** (`mui/mui-x#19149`). No collision while the panel
  opens only from its own button (1.1). Selection keeps row click.
- **Selection's stale contrast** ([`selection.md`](selection.md) 2.1 cites "`withExpansion()`'s
  `isExpanded`"). A doc fix, not a story — the panel never stamps `isExpanded`.
- **Editing a child row of an expanded parent** ([`row-editing.md`](row-editing.md) E-1) is
  owned by the tree (`withTree()`, [`tree.md`](tree.md)) and closed by #163 — child rows must carry
  the index the editor uses. The panel isn't involved: its content is consumer-owned, and the
  library knows only the opening row.

---

# 5. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-exp-1 — Single-open mode: needed? — resolved 2026-09-30: no `mode` setting; a recipe.**
`table.expansion.set(isOpen ? [] : [id])` in place of `toggle(id)`. A cheap one-liner with no
index math and no `trackBy`, so it stays a recipe — the same test as the declined "all open?"
member (`features/expansion.md:96-99`). Multi-open stays the default. Shown by story 1.6's
side panel (#190 story D, `side-panel/`).

> **Reversed 2026-10-01 (E54, #210).** Once `ngpTablePanelToggle` owns the click (#199, E53), the one-line recipe becomes a second write after the directive's. Single-open moves to `withExpansion({ multi })`, default `true`.

**OQ-exp-2 — Where do `aria-expanded` and the toggle live for the panel? — resolved 2026-09-30.**
The panel toggle follows the WAI-ARIA APG
[Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): a real `<button>`
with `aria-expanded` (`true`/`false`) and `aria-controls` pointing at the detail row's id; Enter
and Space toggle; nothing on the `<tr>`; `role="table"` kept. `aria-expanded` on a row marks a
treegrid parent row with child rows
([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded))
— a panel is not child rows, so both row `aria-expanded` and a switch to `role="treegrid"` are
rejected. Grounded in APG directly, not only by analogy with TUI D2.

**OQ-exp-3 — When does `everExpanded` reset? — resolved 2026-09-30: stale spec line, not a
decision.** [ADR-0006](../adr/0006-row-id-state-reconciliation.md) exempts `everExpanded` from
pruning deliberately — an additive ledger answering "ever expanded", not "is this row live". #121's
spec story 6 confirms; the code matches. `features/expansion.md:62` was the stale line and is
corrected. The costs of the current behavior are not accepted — see OQ-exp-8.

**OQ-exp-4 — Per-row "can this row expand"? — resolved 2026-09-30: consumer-owned, no library
gate.** Whether a row has detail depends on panel content, which is consumer data — OQ-exp-5
already made panel content and its loading/error state the consumer's, so eligibility follows.
The library holds only the open set and its signals: no per-row predicate, no `isExpandable(id)`.
Unlike selection's D58, whose gate reads the row's own lock state. Recipe: the template hides the
chevron per row (`@if (row.notes)`); expand-all passes filtered ids,
`expand(rows().filter(hasDetail).map(trackBy))`; the "all open?" label compares against the
consumer's own eligible count. Bare `expand()` means "every row" — correct when every row has
detail.

**OQ-exp-5 — Who owns a panel's loading/error state? — resolved 2026-09-30.**
The consumer — no library state or helper. Documented recipe: the panel body is its own component,
gated `@if (table.expansion.everExpanded().has(row.id))`, creating an `httpResource` on mount (not
on a `changed` event), rendering pending / error + Retry (`reload()`) / content inside the panel.
Fetch-on-mount is what makes a restored or `initial`-opened panel load — the PrimeNG trap
(`primefaces/primeng#7526`) is avoided.

**OQ-exp-6 — Does the panel ship CSS? — resolved in part 2026-09-30.**
(a) **No stylesheet** — TUI D10 and the primitives stance (hooks + a docs recipe); the open/close
slide is a recipe, as in the tree. (b) **`inert` on a collapsed-but-mounted panel moved to
OQ-exp-8 / #195** — it is a11y, not styling, and depends on the mount-lifetime decision. Since
OQ-exp-8 part 1 (2026-10-01), default panels unmount on close; only opt-in kept panels bind
`[inert]="!isOpen"`.

**OQ-exp-8 — Panel mount lifetime and virtualization — resolved 2026-10-01 (#195).** Summary: E40
unmount by default + per-row keep; E39 `release()`; E41 a11y directives (#199); part 4 keeps E12
and moves virtualization to the virtual-scroll spec as a requirement (E42). Detail per part below.
*Current behavior:* `everExpanded` is never pruned (ADR-0006 exemption); a panel stays mounted
once opened (E7); a panel is not a render row (E12).
*Costs:* expand-all then collapse-all never frees DOM or memory; 1,000 panels mount at once with
no virtualization; the planned CDK virtual scroll (`3-ui/cross-cutting/virtual-scroll.md`, fixed
`itemSize` over `renderRows()`) can neither size nor unmount a panel. A closed panel stays mounted
and only visually hidden, so its focusable content stays in the Tab order and the accessibility
tree unless it gets `inert`/`hidden` — whether that is needed, and who owns it (consumer recipe or
library directive), follows from this decision (moved here from OQ-exp-6).
*Peer answer:* AG Grid makes the panel a full-width row, so its virtualizer unmounts off-screen
panels.
*Decisions potentially revisited:* E7, E12, ADR-0006's `everExpanded` exemption.
*Part 1 — decided 2026-10-01: the default recipe unmounts a panel on close; staying mounted is an
opt-in recipe, chosen per row.* E7 (2026-08-07) kept panels mounted only because "collapse
animation fights teardown"; it never weighed Angular's `animate.leave`, which keeps the element
until its leave animation ends, then removes it — already used for the same job in
`3-ui/directives/row-animation.md:221-244`. Default: gate on `expansion().has(id)` with
`animate.enter`/`animate.leave` — animates both ways, collapse-all frees everything, no `inert`.
Opt-in: `@if (expansion().has(id) || (keepMounted(row) && everExpanded().has(id)))` with a
consumer predicate; a kept panel needs `[inert]="!isOpen"`. For panels with expensive inner state
(peer: AG Grid's `keepDetailRows`). The library does nothing — the gate is consumer template code.
*Part 2 — decided 2026-10-01: add `table.expansion.release(ids?: readonly RowId[]): void` (E39).*
Removes the ids from `everExpanded` (no ids = clear); never touches the open set, so an open panel
stays open; emits nothing on `changed` — nothing opened or closed. Why: `everExpanded` is
grow-only library state, so a consumer cannot free a kept panel per row — the helper-or-recipe bar
(`1-state/architecture.md`). Collapse-all then `release()` frees every kept panel. The ADR-0006
exemption is unchanged: row removal still doesn't prune `everExpanded`; `release()` is the
explicit consumer control. Name: `release` — `unmount` rejected (the library does no DOM work),
`forget` the other candidate. *Still owes, in [#200](https://github.com/DvirMon/ng-table/issues/200):* a spec via `/to-spec`; an ADR-0006 amendment ("an
additive ledger by design" now has one explicit remover); an `index.ts` export check; decisions-log
row E39 (added).
*Part 3 — decided 2026-10-01: the library ships panel a11y directives (E41);* details settle in the
UI spec rewrite. A **toggle directive** on the consumer's `<button>` binds `aria-expanded` and
`aria-controls` (the panel's id); the native button keeps Enter/Space — OQ-exp-2's APG disclosure,
now in the library. A **panel-content directive** owns the panel `id`; sets `inert` while not open,
including mid-`animate.leave`, so focus can't land in a closing panel; and returns focus to its
toggle when the panel closes with focus inside (Esc / an in-panel ×). Mount/unmount stays the
consumer's `@if` (part 1) — the directives work either way. Opening doesn't move focus (APG): the
next Tab enters the panel, which follows the row in DOM order. Why `inert`: a standard global
attribute, Baseline since 2023, meant for "content that is offscreen or hidden"; unlike
`display:none`/`hidden` it doesn't cut the collapse animation, unlike `aria-hidden` it leaves the
Tab order ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)).
*Part 4 — decided 2026-10-01: keep E12; virtualization moves to the virtual-scroll spec (E42).*
A panel stays consumer markup, not a render row. Reversing E12 would reopen ADR-0012's
`expandedRows` collision fix, and a fixed-`itemSize` design still couldn't size variable-height
panels. Virtual scroll is only drafted, so the requirement waits there: **must support detail
panels** — variable-height items, or a panel taking a virtual-list slot without being a render row
(`1-state/features/virtual-scroll.md`, `3-ui/cross-cutting/virtual-scroll.md`).
*Sequencing:* #190's 2.3 becomes the opt-in demo; 3.1 refetches on reopen under the default.

**OQ-exp-7 — Is a side "peek" panel in scope? — resolved 2026-09-30: supported by the current
state, not a non-goal.** The UI stays consumer-owned (drawer, split view, modal beside the table).
Recipe: `withExpansion()` used single-open — write `set([id])`, close `set([])` / `collapse()`,
read `expansion()`; no inline panel markup. From existing state it gets: follows the row across
sort/filter (keyed by id); closes when the row is deleted (`onRowsRemoved` prunes the open set);
`changed` / a `computed` to load the shown row's data. A plain `signal<RowId | null>` also works
but loses the prune on delete. No state change. Story 1.6.

**OQ-exp-9 — Step to the next/previous row while detail is open — resolved 2026-10-01 (E43).**
Row-to-row stepping is keyboard navigation, owned by the core row/table directives
([ADR-0029](../adr/0029-directives-own-accessibility.md) category 5) — not a consumer helper, not an
expansion option. Rule: next visible data row, skip group headers, stop at the end. Features plug
in: the panel follows the focused row in single-open; the tree adds →/←. A new cross-feature
keyboard-navigation capability with its own issue, [#201](https://github.com/DvirMon/ng-table/issues/201). See §7.1. *Sequencing:* does
not block #190.

---

# 6. Gap analysis, split by owning layer

The stories above name no layers. Each gap below is tagged by who does the work.

## 6.1 State-layer gaps

Owned by `1-state/features/expansion.md` and `1-state/work/expansion/`.

| # | Gap | Story | Note |
|---|---|---|---|
| S2 | ~~No per-row eligibility~~ | 1.3, 1.5 | Not a gap — **OQ-exp-4** resolved consumer-owned; recipe, no state |
| S3 | `onRowsRemoved` pruning writes the open set without emitting on `changed` | 2.2 | Undocumented. Invisible to a person; a consumer mirroring `changed` drifts |
| S4 | `ExpansionSlice` not exported from `index.ts` | — | Not user-facing; a consumer can't name the slice type |
| S5 | Broken links to selection decisions in `features/expansion.md` | — | Doc-only fix |

## 6.2 UI-layer gaps

Owned by `3-ui/directives/expansion.md` and the story plan
([`../3-ui/work/expansion-stories/`](../3-ui/work/expansion-stories/)).

| # | Gap | Story | Note |
|---|---|---|---|
| U1 | No story composes `withExpansion()` | all of §1–§3 | Tracked as #190 |
| U2 | UI spec is two generations stale (stale banner added 2026-10-01) | 1.1–1.3, 3.2 | Built as written: every toggle disabled (`!hasChildren`), a dev warning on every correct use, `aria-expanded` on the `<tr>`, a `store()` call that doesn't exist. 12+ stale claims, research internal-coverage §B; rewrite owned by **#199** |
| U3 | No toggle directive / keyboard / `aria-expanded` on a button | 1.1, 1.2 | **Library UI gap:** the toggle directive (`aria-expanded` + `aria-controls`, APG disclosure per **OQ-exp-2**) ships from the library — **OQ-exp-8** part 3, E41 — built in **#199** |
| U4 | No slide helper; `inert` on collapsed content not wired | 1.2, 2.3, 3.2 | CSS half resolved: no stylesheet, slide is a recipe (**OQ-exp-6**). a11y half is a **library UI gap**: the panel-content directive owns `id`, `inert` while not open (incl. mid-leave) and focus return — **OQ-exp-8** part 3, E41 — built in **#199** |
| U5 | No panel loading/error recipe | 3.1 | **OQ-exp-5** resolved — recipe, shown in `lazy-panel/` |
| U6 | Row-reorder animation not re-measured when a panel opens | 3.2 | Unverified (U1 in the internal research) |
| U7 | `3-ui/architecture.md`, `3-ui/stories.md`, `sorting.md`, `grouping.md` call `grouping-collapsible/` a `withExpansion()` story | — | Doc-only fix |

## 6.3 Gaps needing both layers

| Gap | State owes | UI owes |
|---|---|---|
| Expand-all that labels itself (1.5) | Eligibility (S2), so "all open?" can be counted right | The button and its label |
| Panel under collapsed group (E-G1) | nothing — holds by construction | A story composing `withTree()`/grouping + `withExpansion()` |
| Panel mount lifetime + virtualization (OQ-exp-8, resolved) | E40 unmount default + per-row keep; E39 `release()` | E41 a11y directives (#199); E12 kept, virtual-scroll must support panels (E42) |

## 6.4 Confirmed right — do not re-litigate

- **Id-keyed open state, pruned only on removal.** The category's oldest bug (2.1) cannot happen
  here, by construction.
- **Panel and tree are separate features (ADR-0012).** The shared-flag design produced a bug
  elsewhere (`TanStack/table#3333`); separate state produced only feature requests.
- **`everExpanded` exists.** Keep-mounted-after-first-open is what 2.3 and 3.1's restored-panel case
  both need, and no competitor ships it built in.
- **`initial` seeds `everExpanded` and emits nothing** — what makes PrimeNG's open-but-empty bug
  (3.1) avoidable.

---

# 7. Capabilities with no owner

Checked against `docs/status.md` (generated registry): `expansion` is present (`drilled | shipped |
drilled | none`). Nothing is unowned at the capability level. 7.1 was the one unowned
sub-capability; it now has an owner (core keyboard navigation) and stays here as the record.

### 7.1 Step to the next row while detail is open — **owned: core keyboard navigation (OQ-exp-9)**

Every end-user product that documents detail lets a person move to the next/previous row without
closing it (↑/↓ in Jira and Linear, modified keys in Airtable and Notion), and Atlassian names it a
core need. Resolved 2026-10-01 (**OQ-exp-9**, E43): it is keyboard navigation owned by the core
row/table directives (ADR-0029 category 5) — next visible data row, skip group headers, stop at the
end; the panel follows the focused row in single-open, the tree adds →/←. A new cross-feature
capability with its own issue ([#201](https://github.com/DvirMon/ng-table/issues/201)), not an expansion gap; not a story here.

---

# 8. Not user-facing

- **`changed` emits once per write as `{ added, removed }` (E18/E19)** and silent writes
  (`{ emitEvent: false }`). Invisible in itself.
- **Separate `createExpansionStore()` per feature (ADR-0012 D3).** A wiring detail.
- **No `manual` mode (E2).** Nothing to toggle.
- **`everExpanded` memory growth** is an integrator's problem, accepted by
  [ADR-0006](../adr/0006-row-id-state-reconciliation.md) — see OQ-exp-3.
