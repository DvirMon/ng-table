---
title: Product — Sorting User Stories
type: product
capability: sorting
status: >
  5 of 14 §1–§4 stories ✅, 3 🟡, 6 ❌. The state layer is genuinely strong — null/blank placement
  (3.1) is ahead of every surveyed competitor, an 11-year-old unmet category request. But there is
  no sorting UI layer (`ngpTableSort` is `spec: drafted, code: none`) and no dedicated sorting
  story: every demo of sorting is filed under another feature's Storybook title (Grouping, Row
  Editing, Selection), and five shipped capabilities — `multi: true`, `manual: true`, a custom
  `sortFn`, `sortable({ enable: () => false })`, any `sortNulls()` override — are demonstrated
  nowhere, only unit-tested. One story (4.1) names an actual bug, not a gap: a throwing `sortFn`
  blanks the whole table today, contradicting the runtime-error policy that names its own fallback
  (ADR-0014). Written after `features/sorting.md` (`spec: drilled`, code shipped) and
  `3-ui/directives/sort.md` (`spec: drafted`, code none) — this doc's job is what neither covers.
  The per-column config surface confusion this doc originally flagged (§6 note, §8.1 S4,
  OQ-sort-7) is resolved — see OQ-sort-7.
date: 2026-09-17
audience: product, design, engineering
---

# Sorting — user stories

What a person putting a table's rows into an order they chose needs to be able to do, and what
they should experience when the order surprises them or their own comparator breaks. Engineering
derives API from this document, not the reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it — coverage marks here are updated from the product side as capabilities
> land.

> **This doc was written while two specs disagreed with each other, and while a third,
> unshipped proposal was in flight.** [`features/sorting.md`](../1-state/features/sorting.md) is
> `spec: drilled, code: shipped` — `withSorting({ multi, manual, schema })`, a fully shipped
> null/blank contract. But [`3-ui/directives/sort.md`](../3-ui/directives/sort.md)
> (`spec: drafted, code: none`) specs `toggleSort(id, { accumulate })` — a **per-click** modifier
> gesture — against a `multi` flag the shipped code only reads once, at construction. Neither doc
> has reopened the other's decision (see §6); that split is still open. **The per-column config
> split is not**: resolved 2026-09-25 by #100 — see **OQ-sort-7** (§7) for what shipped. This
> document writes every story against the **capability**, never against a specific API spelling —
> see §6 for the mode-vs-gesture split that is still open.

## Scope

**Sorting means: the rows are in an order I chose, that order is predictable, and I can get back
to no order.** A person perceives six things, and does not care which layer produces them:

1. I can click a column and have the rows ordered by it, correctly, with no configuration.
2. I can reverse the order, and get back to "no order" — not stuck flipping between two directions.
3. Blank or missing values land somewhere predictable, and stay there regardless of which
   direction I sort.
4. I can combine more than one column's order, and tell which one is primary.
5. When the order changes because I clicked something — not because the data changed underneath
   me — the move is visible, especially if I was in the middle of editing that row.
6. I can tell, at a glance, which column(s) are driving the order right now.

The codebase gives the table one feature, `withSorting()`, that both builds the sort model and (in
client mode) applies it inside the pipeline's `sort` stage. That mechanism is invisible to the
person using the table and is ignored here.

Two modes, genuinely different products — the same split `filtering.md` draws:

| Mode                                                            | What the person sees                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Client** (`withSorting()`, default)                           | All rows are already on the table; sorting reorders what's shown, instantly, with no round trip.                                                                                                                                                                                     |
| **Server** (`withSorting({ manual: true })`, feeding a request) | The local `sort` stage is skipped — the person's click has to travel to a request that returns freshly sorted data. The person sees the same reordering, but it costs a request, and the window between the click and the new order landing has to be a designed state, not silence. |

Server mode is not a degraded client mode — a million-row table that only ever renders a
server-sorted page is a legitimate product. It is also, per the community research, the mode with
the worst track record in this category: the identical "the indicator changed but nothing visible
happened" complaint is on record a decade apart, in two different libraries (§4.3).

## Coverage marks

| Mark                  | Meaning                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ✅ **covered**        | Demonstrable today in `src/stories/` or a demo app, with the failure path included                                             |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not — no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered**    | Nothing on screen anywhere; or structurally impossible with what ships                                                         |

**No dedicated sorting story exists.** Unlike filtering (`client-filtering/`), sorting has never
been the subject of its own story — it only ever appears as the _other_ feature in a composition,
filed under a different Storybook title. All four are read from host component code, not folder
names or `.mdx` wrappers, per
[`research-sorting-internal-coverage.md`](../1-state/work/sorting/active/story-discovery/research-sorting-internal-coverage.md):

| Story                                                                                | Filed under | Composes                                                | What it demonstrates for sorting                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`grouping/grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) | Grouping    | `withGrouping()` + `withExpansion()` + `withSorting()`  | The **broadest** sorting demo in the repo, incidentally: a sort button on every column — `number`, `Date`, plain string, and an `accessor`-derived string, plus a nullable string — so this is the only place auto-detection is exercised across types. Bare `withSorting()`, no `multi`.                                                                                                                       |
| [`row-edit/sorting-editing/`](../../src/stories/row-edit/sorting-editing/)           | Row Editing | `withSorting()` + `withRowEdit()`                       | Three-state toggle with a glyph, derived `aria-sort`, a "Clear sort" button, and **null-last on a nullable column** with two null fixture rows plus a button that adds a third live. The one story with the FLIP row-reorder animation turned on (`sorting-editing-flip.css`), and the one that renders **S-1's failure live** — a banner naming the row's index at open vs. now, on purpose, not by oversight. |
| [`row-edit/live-table/`](../../src/stories/row-edit/live-table/)                     | Row Editing | `withSorting()` + `withOptimistic()`                    | Two sortable columns under no-session live editing.                                                                                                                                                                                                                                                                                                                                                             |
| [`selection/filtering-selection/`](../../src/stories/selection/filtering-selection/) | Selection   | `withFiltering()` + `withSelection()` + `withSorting()` | Sorting reorders rows and changes no selection ([`selection.md:339`](selection.md)).                                                                                                                                                                                                                                                                                                                            |

**Five shipped capabilities are demonstrated in none of the four:** `multi: true`, `manual: true`,
a custom `sortFn`, `sortable({ enable: () => false })`, and any `sortNulls()` override. All five are
covered only by `with-sorting.spec.ts` (27 tests) — real, but invisible to a person, and invisible
to anyone evaluating the library from its stories.

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
resulting gap into state, UI, or both — and §9 collects the ones that belong to no existing
feature at all.

Where a competitor's behavior is cited, it comes from
[`research-sorting-ux-capabilities.md`](../1-state/work/sorting/active/story-discovery/research-sorting-ux-capabilities.md)
(version-pinned, 2026-09-17) or
[`research-sorting-community-pain.md`](../1-state/work/sorting/active/story-discovery/research-sorting-community-pain.md)
(issue numbers, states, and 👍 counts read live the same day). Neither is restated here beyond
what a story needs.

---

# 1. Get the order I want, and get back to none

Ordered by how badly the person is hurt if it is missing.

## 1.1 — Click a column header to order rows by it, correctly, with no configuration — ✅ covered

> As someone browsing four hundred invoices, I want to click "Amount" and have the rows reorder by
> amount, so I don't have to scan for the biggest one myself.

**Acceptance criteria**

- A single click orders every row by that column, immediately.
- `string`, `number`, and `Date` columns sort correctly with no comparator written — including a
  column reached through a custom `accessor`.
- Clicking a column I haven't touched does nothing to the order until I click it.

**Failure behavior**

- A column with a `sortable({ enable: () => false })` rule does nothing when clicked and never
  enters the cycle.

**Covered by:** [`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) — every
visible column is a sort button, and the fixture's `number`, `Date`, plain-string and
`accessor`-derived-string columns are all sorted correctly with zero comparators written
(`detectComparator`'s auto-detect). [`sorting-editing/`](../../src/stories/row-edit/sorting-editing/)
demonstrates the same on two string/nullable-string columns with a rendered glyph.

**Design status:** covered — D-S1 (three-state toggle), D-S7 (auto-detect: `Date.getTime()`,
numeric subtraction, else `String().localeCompare()`) in
[`features/sorting.md`](../1-state/features/sorting.md), `code: shipped`.

## 1.2 — Reverse the order, then get back to how the data arrived — ✅ covered

> As someone who clicked "Date" to see the newest invoices first, then clicked again and got
> confused, I want a third click to give me back the original order — not to be stuck flipping
> between two directions forever.

**Acceptance criteria**

- The cycle is three-state: ascending → descending → unsorted.
- Reaching "unsorted" restores the order the rows arrived in (stable, not re-derived).

**Covered by:** [`sorting-editing/`](../../src/stories/row-edit/sorting-editing/) — a "Clear sort"
button (`clearSorting()`) plus the header's own three-state `@switch` glyph.
[`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) shows the same cycle on
every column.

**Design status:** covered — D-S1, D-S17 (`[...rows].sort()`, a copy, stable ties — never
in-place). This matches the majority position: AG Grid, MUI X and TanStack all ship
`asc → desc → none` as their **default**. PrimeNG is the outlier — it has no third state at all,
and its own community has asked for one since 2019 with no built-in fix: _"Why anyone would build
and release a sort feature without any option to 'reset' is hard to understand"_
([`primefaces/primeng#12553`](https://github.com/primefaces/primeng/issues/12553), 9 👍, 13
comments, open since 2023). See
[`research-sorting-community-pain.md`](../1-state/work/sorting/active/story-discovery/research-sorting-community-pain.md)
Theme 1.

## 1.3 — The click cycle behaves the same no matter what's in the data — ✅ covered by construction

> As someone sorting a column that happens to have a blank value in its very first row, I want
> clicking that header to behave exactly like every other header — not to silently start in a
> different direction because of what row happened to load first.

**Acceptance criteria**

- The first-click direction and the cycle order are fixed by the column's declaration, never
  inferred from a sample of the loaded data.

**Failure behavior avoided:** TanStack infers the first click's direction from the type of the
_first filtered row's_ value (`getAutoSortDir`) — a column whose first row happens to be blank
flips to a different cycle than the same column with different data loaded. This produced the
highest-reaction sorting bug in TanStack's own tracker
([`TanStack/table#4289`](https://github.com/TanStack/table/issues/4289), 16 reactions, "the sorting
toggle for that column doesn't follow the asc-desc-undefined pattern... a multitude of other
variations"), and TanStack's own guide concedes the trap in prose rather than fixing it.

**Covered by:** nothing directly demonstrates the _absence_ of this bug — it's an inference from
reading `with-sorting.ts`, not something a story sets out to prove. Listed because the value is in
what's _not_ here, not what is.

**Design status:** covered by construction — no runtime type inference anywhere in `with-sorting.ts`.
See
[`research-sorting-community-pain.md`](../1-state/work/sorting/active/story-discovery/research-sorting-community-pain.md)
Theme 2.

---

# 2. Know what's sorted, and control it

## 2.1 — See at a glance which column is sorted, and which way — 🟡 partly covered

> As someone who sorted a table five minutes ago and got pulled into something else, I want to
> look at the header and know immediately which column is driving the order and which direction,
> without re-clicking to check.

**Acceptance criteria**

- An active sort is visible on the header without opening anything.
- The direction is discoverable by assistive technology (`aria-sort`), not just visually.

**Covered by:** [`sorting-editing/`](../../src/stories/row-edit/sorting-editing/) and
[`grouping-collapsible/`](../../src/stories/grouping/grouping-collapsible/) — both render a
per-column glyph and derive `aria-sort` from `sortDirections()`. **Both are consumer-authored from
scratch** — no directive ships this, so every consumer rebuilds the same glyph-and-`aria-sort`
logic by hand.

**Design status — gap.** `sortDirections` (a derived `columnId → direction` map) already exists as
a store member; nothing renders it. `ngpTableSort` — the directive specced to own exactly this — is
`spec: drafted, code: none`
([`3-ui/directives/sort.md`](../3-ui/directives/sort.md)). **OQ-sort-1.**

## 2.2 — Combine more than one column's order, and know which is primary — ❌ not covered

> As someone sorting a report first by region, then by date within each region, I want to add a
> second sort column without losing the first — and I want to be able to tell which one is
> primary, not guess.

**Acceptance criteria**

- A second column can be added to the sort without replacing the first.
- The priority order is knowable on screen, not inferred by clicking around.

**Covered by:** nothing. `multi: true` is shipped and unit-tested
(`with-sorting.spec.ts:114,261`), but **every one of the four sorting stories composes
`withSorting()` bare** — none configures `multi`, and no priority indicator exists to build even if
one did.

**Design status — gap, in two different ways at once.** The shipped mechanism (`multi: true`) is a
construction-time table mode a developer picks. The specced UI mechanism
([`sort.md`](../3-ui/directives/sort.md)'s `toggleSort(id, { accumulate })`) is a per-click gesture
a _person_ performs — a genuinely different product, and an unticketed state-layer change neither
doc has reconciled with the other. This is the sharpest open decision in the whole feature — see
§6. **OQ-sort-2, OQ-sort-3.**

## 2.3 — Clear the sort in one action — ✅ covered

> As someone done comparing sorted amounts, I want one button that gets me back to the unsorted
> table — not clicking every sorted header back to "none" individually.

**Acceptance criteria**

- One action clears every active sort rule at once.

**Covered by:** [`sorting-editing/`](../../src/stories/row-edit/sorting-editing/) — "Clear sort" →
`clearSorting()`.

**Design status:** covered — D-S14.

## 2.4 — Restore a sort I saved earlier, or open a table that's already sorted — ❌ not covered

> As someone reopening a view I set up yesterday — sorted by due date — I want the table to come
> back exactly as I left it, not reset to unsorted every time.

**Acceptance criteria**

- A saved `SortRule[]` can be applied programmatically (`setSorting()`).
- A table can start already sorted, with no click required.

**Covered by:** nothing. `setSorting()` has zero story or demo coverage (only
`with-sorting.spec.ts:179`). There is also **no mechanism at all** to open a table pre-sorted —
`sorting` always initializes to `[]` (`with-sorting.ts:146`); no config field seeds it.

**Design status — gap.** `sorting?: SortRule[]` exists in the persistence-snapshot spec
([`state-persistence.md`](../1-state/state-persistence.md), `spec: drafted, code: none`), but there
is no table-level initial-sort option independent of that larger persistence feature. **OQ-sort-4.**

---

# 3. Trust the order to be correct

## 3.1 — A blank or missing value lands somewhere predictable, regardless of which way I sort — ✅ covered _(the strongest thing in this feature)_

> As someone who just sorted invoices by due date, and some invoices have no due date set yet, I
> want those blank ones to stay in the same spot whether I sort oldest-first or newest-first — not
> to jump from the bottom to the top the moment I flip the direction.

**Acceptance criteria**

- Empty/missing values resolve to a fixed placement (default: last) that does not depend on sort
  direction.
- `null`/`undefined` are always treated as empty; `''` is a real value unless a column opts it in.
- A per-column override is available (with a columns schema).

**Failure behavior avoided:** a symmetric comparator — the shape every one of the four surveyed
competitors ships by default — structurally cannot express "blanks stay put when I flip the
direction," because flipping the comparator's sign flips the blank placement along with everything
else.

**Covered by:** [`sorting-editing/`](../../src/stories/row-edit/sorting-editing/) — two rows with a
null `dueDate` ship in the fixture, and a toolbar button adds a third live, so both the default
placement and its direction-independence are on canvas.

**Design status: covered — ahead of every surveyed competitor.** D-S8/D-S9/D-S10,
`sortNulls()`. This is an **eleven-year-old, cross-library, still-unmet request**: AG Grid was
asked in 2015 ("can you change it that the null value always stays at the bottom?"), again in 2022,
again in 2023 (tracked internally as **AG-4861**, staff answer: "there's no way to implement this
behaviour with AG Grid besides using your own custom comparator") — still no declarative option as
of 2026-09-17. MUI X's own docs devote a demo to _escaping_ their own direction-relative default,
which is itself the evidence their default is the wrong one. PrimeNG pins nulls at the bottom both
directions too, but undocumented, in a private helper, with an in-source comment as the only trace
of the decision. TanStack is the closest competitor (`sortUndefined: 'first' | 'last'`), and even
that covers `undefined` only — not `null`, which is exactly what JSON/SQL-sourced data actually
produces. See
[`research-sorting-community-pain.md`](../1-state/work/sorting/active/story-discovery/research-sorting-community-pain.md)
Theme 3 and
[`research-sorting-ux-capabilities.md`](../1-state/work/sorting/active/story-discovery/research-sorting-ux-capabilities.md)
Axis 4.

## 3.2 — A comparator I write doesn't have to reinvent null handling — ❌ not covered

> As someone writing a custom comparator for a "priority" column, I don't want to have to re-guard
> against null/undefined myself just to get the same blank-placement behavior every other column
> gets for free.

**Acceptance criteria**

- The null rule applies ahead of a custom `sortFn` too — no escape hatch needed for the common case.

**Covered by:** nothing on screen — only unit-tested (`with-sorting.spec.ts:355,412,479`). No story
composes a custom `sortFn` at all.

**Design status:** shipped in code (D-S11), never demonstrated to a person.

## 3.3 — Case, accents, and mixed capitalization don't scramble an alphabetical column — 🟡 partly covered

> As someone sorting a customer list, I want "Bob" to sort next to "bob" — not off in a different
> part of the alphabet because of capitalization.

**Acceptance criteria**

- The default string comparator handles mixed case and accents sensibly with no configuration.

**Covered by:** every existing sorting story sorts plain string columns (`category`, `rep`,
`owner`), but none uses a fixture deliberately mixing case or accents — so the behavior is
implicitly exercised, never deliberately proven.

**Design status:** shipped — auto-detect falls back to `String().localeCompare()` (D-S7), which is
locale-aware **by default**. This is ahead of AG Grid, which requires opting into a documented
`accentedSort` that its own docs warn is "slower than default sorting," and ahead of TanStack, whose
locale-aware `alphanumeric` comparator is a separate opt-in rather than the fallback. See
[`research-sorting-ux-capabilities.md`](../1-state/work/sorting/active/story-discovery/research-sorting-ux-capabilities.md)
Axis 3.

## 3.4 — A column that isn't meant to be sorted doesn't pretend to be — ❌ not covered

> As someone looking at an "actions" column full of buttons, I don't want to be able to click the
> header and have nothing sensible happen — or worse, have it look sortable at all.

**Acceptance criteria**

- A `sortable({ enable: () => false })` rule makes the header inert: clicking it does nothing, and
  it never enters the cycle.

**Covered by:** nothing — no story declares a `sortable({ enable: () => false })` rule anywhere;
every sortable-looking
header across all four sorting stories genuinely is sortable.

**Design status:** shipped (D-S5), unit-tested only (`with-sorting.spec.ts:140`), never
demonstrated. Structurally compounding this: since no `ngpTableSort` directive ships yet, there is
no shared convention for what a sortable header _looks like_ either — every consumer draws their
own from scratch (§2.1), so there is nothing shared to get wrong or right about a _non_-sortable one
either. Once a directive exists, this is exactly the failure mode the community research flags most
often in the wild: hover-only sort affordances that fail keyboard and touch users identically, and
the mirror complaint of non-sortable headers that still look clickable — both open, years apart, on
the same library (`mui/mui-x#22188`, `mui/mui-x#3886`). See
[`research-sorting-community-pain.md`](../1-state/work/sorting/active/story-discovery/research-sorting-community-pain.md)
Theme 5.

---

# 4. When sorting does not cooperate

## 4.1 — A comparator I write that throws doesn't take the whole table down — ❌ not covered, and not actually shipped

> As someone whose custom "priority" comparator has a bug in it, I want that one column's sort to
> just not apply — not the whole table to go blank.

**Acceptance criteria**

- A consumer `sortFn` that throws degrades: that column's sort doesn't apply, every other feature
  keeps working, and the failure is reported once per evaluation — never a blank table, per
  [ADR-0014](../adr/0014-runtime-error-policy.md)'s runtime-error policy.

**Failure behavior — this is what actually happens today, not a hypothetical:**
`with-sorting.ts:123` calls `compare(a, b)` with no guard. A throwing `sortFn` blanks the table
right now. ADR-0014's own policy table names this fallback as though it were already the contract —
it is not implemented. This is the one story in this document naming an actual defect rather than
an unbuilt affordance.

**Covered by:** nothing — the gap is invisible precisely because nothing exercises a throwing
comparator.

**Design status — real bug, not a doc gap.** See
[`research-sorting-internal-coverage.md`](../1-state/work/sorting/active/story-discovery/research-sorting-internal-coverage.md)
finding C-4. **OQ-sort-5.**

## 4.2 — A row I'm editing doesn't move out from under me — 🟡 partly covered _(linked — owned by row editing, §5)_

Not restated here — see §5 below (`row-editing.md` S-1). Named in harm order because the community
research found this to be the largest sort-collision theme by volume in the entire category: seven
separate discussion threads across three libraries, spanning 2018–2026, every one unanswered, zero
shipped solutions anywhere surveyed. This repo has actually **decided** the fix (OQ-3, 2026-08-27:
hold the edited row's position for the gated session) — ahead of the category, which has nothing —
but it isn't shipped: `sorting-editing/` renders the violation live, on purpose, rather than hiding
it.

## 4.3 — Sorting on the server doesn't leave me staring at a table that looks stuck — ❌ not covered

> As someone sorting a large server-backed table, I want to see that my click registered while I
> wait for the new order to arrive — not a table that looks frozen, or worse, flickers through a
> stale order first.

**Acceptance criteria**

- Some visible feedback exists between the click landing and the new data arriving.

**Failure behavior:** the community research found this exact complaint a decade apart in two
different libraries — AG Grid, 2016: "it is blinking my grid two times"; MUI X, 2026: "no overlay
when sorting or filtering." The shape is consistent across both: the indicator changes, and nothing
else visibly happens until the server answers.

**Covered by:** nothing. `manual: true` has zero story or demo coverage — this repo's two
server-mode stories (`server-filtering/`) are `withFiltering({ manual })`, not sorting.

**Design status:** state layer shipped (D-S4), zero product-facing demonstration anywhere. See
[`research-sorting-community-pain.md`](../1-state/work/sorting/active/story-discovery/research-sorting-community-pain.md)
Theme 9.

---

# 5. Cross-feature interactions

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to sorting — the same convention `filtering.md` and `selection.md` state
explicitly. Where a story already lives in another feature's doc, it is **linked, not restated**,
and that file keeps owning its coverage mark. Per
[`research-sorting-internal-coverage.md`](../1-state/work/sorting/active/story-discovery/research-sorting-internal-coverage.md)
§4, this is the entire existing cross-feature surface for sorting — nothing else needs writing.

## Owned by grouping _(built)_

**S-G1 and S-G2 already exist** at [`grouping.md`](grouping.md) §"Owned by sorting" — S-G1 (✅
covered, contingent), sorting the column a table is grouped by does not produce a "dead header" that
shows a sort indicator while nothing moves, because group order follows first-occurrence over the
already-sorted rows; S-G2 (🟡 partly covered), sorting rows inside a group leaves the groups
themselves in place — demonstrated for the rows half only, since no story composes
`withGrouping({ groupOrder })` with `withSorting()` together. **S-G1's ✅ is contingent on the
composed story supplying no `groupOrder`, not on a shipped guarantee** — supplying one reintroduces
the dead header, and `grouping.md` says so explicitly.

## Owned by row editing _(built, unshipped)_

**S-1, S-2 and 2.2 already exist** at [`row-editing.md`](row-editing.md) §"Owned by sorting" — S-1
(🟡 partly covered), a row must not move while the person is working in it: **decided** 2026-08-27
(OQ-3 — hold the edited row's position for the gated session) but **not implemented**;
`sorting-editing/` renders the violation on canvas deliberately, as the demonstration of the gap
rather than a hidden one. S-2 (✅ covered), a blank/empty value sorts somewhere predictable —
`sortNulls()`, the same mechanism as §3.1 above, "tagged to sorting because sorting is what
must change." `row-editing.md` §2.2 (❌ not covered), finding the row just added under an active
sort — the comparator half is fixed by S-2, the row-hold half is OQ-3; row-editing keeps the mark
because the person meets this during Add, not during an existing edit.

## Owned by selection _(built)_

**No "Owned by sorting" section exists in [`selection.md`](selection.md), on purpose** — sorting
reorders rows and changes no selection at all, which is entirely selection's guarantee to make and
keep ([`selection.md:332,339`](selection.md)), demonstrated in
[`filtering-selection/`](../../src/stories/selection/filtering-selection/). There is nothing for
sorting to add here.

## Owned by filtering _(built)_

**No "Owned by sorting" section exists in [`filtering.md`](filtering.md) either.** Filtering and
sorting compose without a documented collision — the fixed pipeline order (`filter → group → sort →
expand`, D-S18) means a filter always narrows the rows sorting then orders, in either composition
order, with no sorting-specific wiring required.

---

# 6. What multi-column sort activation _is_

Not a story — a question that sits underneath 2.2 and both open UI questions about it (OQ-sort-2,
OQ-sort-3), recorded here because answering it once frames both.

**Is multi-column sort a mode the developer turns on for the whole table, or a gesture the person
performs per click?**

| If it's **the developer's mode**                                                                                          | If it's **the person's gesture**                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withSorting({ multi: true })` fully describes the behavior — every click accumulates, by click order, no modifier needed | A modifier key (shift/ctrl/meta) has to be read off each click event and translated into `{ accumulate: boolean }`                                                  |
| No priority-indicator ambiguity about _whether_ a click was a multi-sort click — every click is                           | The moment a modifier+click "worked" is otherwise the only feedback a person gets that it registered at all — a priority badge becomes load-bearing, not decorative |
| A table either supports multi-sort everywhere or nowhere, decided once at construction                                    | Multi-sort can coexist with single-column replace as the default gesture, discoverable or not depending on whether a badge exists                                   |

**Both answers are "accepted" in this repo today, and they are not the same product.** ADR-0001
answered the first question — single-column replace is the default, `multi: true` is a
construction-time opt-in restoring the original always-additive behavior. `sort.md` then answered
the _second_ question — a configurable modifier key, read per click — without reopening the first,
and specced `toggleSort(id, { accumulate })` against a `multi` flag the shipped code only reads
once. Neither doc names this as a reopened decision; both are simply true today, of two different
mechanisms, only one of which is built.

**What the competitor research says about which one the market has converged on:** three of four
surveyed libraries (AG Grid, MUI X, TanStack) now ship _both_ a modifier gesture **and** a
no-modifier "always multi-sort" mode (`alwaysMultiSort`, `multipleColumnsSortingMode: "always"`,
`isMultiSortEvent: () => true`) — which reads as tacit agreement that the gesture alone is
undiscoverable enough that a table-wide mode is worth offering as an escape hatch, not that the
mode has replaced the gesture. The one place the market disagrees sharply is money: MUI X meters
_plain_ multi-column sorting — the least exotic version of this feature — behind its Pro plan, while
AG Grid, otherwise the most aggressively metered of the four, gives multi-sort, the priority badge,
and keyboard multi-sort away in Community. See
[`research-sorting-ux-capabilities.md`](../1-state/work/sorting/active/story-discovery/research-sorting-ux-capabilities.md)
Axis 2 and Axis 8.

---

# 7. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-sort-1 — Does the library recommend or ship any active-sort visibility convention? — open.**
_Recommendation:_ no shipped UI, consistent with the same call `filtering.md`'s OQ-4 makes — but a
documented recipe using `sortDirections()`'s existing `columnId → direction` map for a glyph and
`aria-sort`, since the data already exists and the gap is entirely a missing example.
_To decide:_ whether the recipe belongs in `features/sorting.md` or waits for `sort.md` to actually
ship.
_Sequencing:_ not blocked; cheap, and every existing sorting story has already independently
reinvented the same fifteen lines.

**OQ-sort-2 — Is multi-column sort a construction-time mode or a per-click gesture? — open, and the
sharpest one in this document.**
_Recommendation:_ resolve this before building `ngpTableSort`, not while building it. §6 lays out
both positions; the market split (three of four now ship _both_ a gesture and a no-modifier mode) is
evidence that a person-facing multi-sort table probably wants both eventually, but the shipped state
layer (`multi: true`, construction-time only) and the specced UI layer (`toggleSort(id, {
accumulate })`, per-click) currently answer two different questions without saying so.
_To decide:_ whether `toggleSort()` grows a per-call options argument (the state-layer change
`3-ui/architecture.md` already names as open and unticketed), or whether `sort.md` is revised to
build against the shipped `multi` flag instead.
_Sequencing:_ blocks `ngpTableSort` and, transitively, OQ-sort-1 and OQ-sort-3 — a directive can't be
built against a signature that doesn't exist.

**OQ-sort-3 — Multi-sort priority indicator: shape and timing — open, elevated.**
_Recommendation:_ once OQ-sort-2 resolves, ship _some_ numbered indicator rather than none — every
surveyed competitor except headless TanStack renders one, and the community research is explicit
that without one, a successful modifier+click has no other feedback that it registered at all.
PrimeNG's detail worth copying: it gates the badge on there being a _second_ sorted column, so a lone
sorted column never shows a redundant "1."
_To decide:_ component vs. documented recipe — same open question as the sort icon itself
(`3-ui/architecture.md`).
_Sequencing:_ depends on OQ-sort-2; already flagged in three docs as more load-bearing than
previously assessed.

**OQ-sort-4 — Should a table be able to start already sorted? — open.**
_Recommendation:_ yes, worth a small, focused addition independent of the larger (and currently
unshipped) persistence feature — a table-level initial-sort option is a much smaller surface than
the full `sorting?: SortRule[]` persistence snapshot, and "reopen a saved view" is unreachable
without it regardless of how that larger feature lands.
_To decide:_ whether it belongs on `withSorting({ initialSort })` or is folded entirely into
whenever `state-persistence.md` ships.
_Sequencing:_ not blocked; independently useful even if persistence never ships.

**OQ-sort-5 — Fix the `sortFn` throw-blanks-the-table bug — not really open, a bug to schedule.**
_Recommendation:_ wrap `compare(a, b)` the same way filtering wraps a predicate (per-callback, once
per evaluation, reporting in production too) — ADR-0014 already names this as the contract; the code
just doesn't do it yet.
_To decide:_ nothing structural — this is closing an implementation gap against an already-agreed
policy, not a design decision.
_Sequencing:_ small, isolated, no dependency on anything else in this document. Worth doing before a
custom `sortFn` gets its first story (§3.2), so that story doesn't have to also demonstrate a crash.

**OQ-sort-6 — Table-wide `nulls` default? — open, already named in `features/sorting.md` as
"not proposed."**
_Recommendation:_ no change — the per-column default (`'last'`) already fixes the crash and the
direction-flip for every table with zero configuration; a table-wide override is worth adding only
once a real consumer asks for `'first'` everywhere.
_To decide:_ nothing yet — revisit on demand.
_Sequencing:_ not blocked on anything.

**OQ-sort-7 — Which per-column config surface is current? — resolved 2026-09-25 (#100).**
[#100](https://github.com/DvirMon/ng-table/issues/100) shipped `withSorting({ schema })`
(`sortNulls`/`sortFn`/`sortable`, plus the `sortingSchema<Row>(fn)` reuse helper) as the single
per-column surface. `ColumnDef` carries no feature config at all — `sortFn`, `enableSorting` and
the columns-schema `sortNulls()` are deleted from `src/`, not deprecated. This document's own
practice of writing every story against the _capability_ rather than a specific spelling is why
none of the stories above needed a rewrite for the API to change underneath them — see
`docs/decisions/sorting.md` SO19/21/22/25–29 for the full ruling.
[`tier-3-feature-config.md`](../2-columns/reference/tier-3-feature-config.md)'s
`applyEnableSorting`/`applySortFn`/`applyDefaultSort` proposal never shipped and has been
corrected to match the shipped surface.
_To decide:_ nothing — closed.
_Sequencing:_ n/a.

---

# 8. Gap analysis, split by owning layer

**The stories above are deliberately layer-free** — a person does not perceive layers, and a story
that names one has drifted back into being a spec. The gaps are a different thing: each is work
someone has to do, and the first question about any piece of work is who does it. Every gap below
is tagged **state**, **UI**, or **both**, and where it is both, what each layer owes.

## 8.1 State-layer gaps

Owned by `1-state/features/sorting.md` and `1-state/work/sorting/`.

| #      | Gap                                                                                                                                                                                  | Story                             | Note                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1     | A throwing `sortFn` blanks the table instead of degrading                                                                                                                            | 4.1                               | `with-sorting.ts:123` calls `compare()` unwrapped. ADR-0014 names the fallback in its own policy table; the code doesn't implement it. **OQ-sort-5**    |
| S2     | No initial/default sort — a table cannot open already sorted                                                                                                                         | 2.4                               | `sorting` always initializes to `[]`. `sorting?: SortRule[]` exists only inside the larger, unshipped persistence spec. **OQ-sort-4**                   |
| S3     | `toggleSort()` has no per-call options argument                                                                                                                                      | 2.2, §6                           | `sort.md`'s `{ accumulate }` design is unbuildable against the shipped signature. Named as open and unticketed in `3-ui/architecture.md`. **OQ-sort-2** |
| ~~S4~~ | ~~Three incompatible per-column config surfaces exist across the docs~~ — resolved: `withSorting({ schema })` (`sortNulls`/`sortFn`/`sortable`) shipped as the single surface (#100) | §6 note, all of §1–4 by extension | **OQ-sort-7**, closed                                                                                                                                   |
| S5     | No table-wide `nulls` default                                                                                                                                                        | —                                 | Explicitly "not proposed" in `features/sorting.md`. **OQ-sort-6**                                                                                       |
| S6     | `features/sorting.md` still lists the auto-detect algorithm as an open question                                                                                                      | —                                 | It shipped (`detectComparator`, `with-sorting.ts:62-80`). Documentation-only fix.                                                                       |
| S7     | Two broken links inside `features/sorting.md` itself (null-ordering handoff, gap-analysis)                                                                                           | —                                 | Both files exist, at different paths than written. Documentation-only fix.                                                                              |

## 8.2 UI-layer gaps

Owned by `3-ui/directives/sort.md` and whichever story-planning effort picks up a dedicated sorting
story.

| #   | Gap                                                                                           | Story        | Note                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | `ngpTableSort` doesn't exist                                                                  | 2.1, 3.4, §6 | `spec: drafted, code: none`. Every affordance below is hand-rolled per consumer today. Blocked on **OQ-sort-2**.                                                                                                                                                                       |
| U2  | No dedicated sorting story exists anywhere                                                    | all of §1–4  | Every sorting demo is filed under Grouping, Row Editing, or Selection's Storybook title. Five shipped capabilities (`multi`, `manual`, custom `sortFn`, `sortable({ enable: () => false })`, any `sortNulls()` override) are demonstrated in none of them.                             |
| U3  | No multi-sort priority indicator, component or recipe                                         | 2.2          | Elevated from "low stakes" to load-bearing in three docs — once accumulation requires a deliberate gesture, the badge is the only confirmation it registered. **OQ-sort-3**                                                                                                            |
| U4  | No active-sort visibility convention (glyph, `aria-sort` wiring)                              | 2.1          | Recipe exists ad hoc in two stories; no shared component or documented pattern. **OQ-sort-1**                                                                                                                                                                                          |
| U5  | No server-mode sort loading-state recipe                                                      | 4.3          | No story composes `withSorting({ manual: true })` at all.                                                                                                                                                                                                                              |
| U6  | `aria-live` announcement of a sort change is deferred, by explicit decision                   | —            | Accepted cost, recorded at `3-ui/architecture.md:96`. The sharpest evidence this matters: a JAWS user's verbatim complaint about an unrelated grid is the only genuine end-user voice found anywhere in the competitor research corpus (`research-sorting-community-pain.md` Theme 6). |
| U7  | No affordance convention for what a sortable (or deliberately non-sortable) header looks like | 3.4          | Depends on U1 existing first — there is currently nothing shared to get right or wrong.                                                                                                                                                                                                |

## 8.3 Gaps needing both layers

| Gap                                         | State owes                                                                                                                                   | UI owes                                                                                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-column sort (2.2, §6)                 | Resolve **OQ-sort-2** — whether `toggleSort()` grows a per-call options argument, or `sort.md` is revised to target the shipped `multi` flag | Once resolved: the modifier-key config (if the gesture model wins) and the priority badge (**OQ-sort-3**)                                                                                                                                               |
| Row-hold under sort (4.2 / row-editing S-1) | OQ-3's decision (hold the edited row's position for the gated session) — **decided, not implemented**                                        | Making the move perceptible once it lands — the FLIP row-reorder animation (D-S20) already ships as opt-in infrastructure for exactly this, wired into `sorting-editing/` alone; it needs to be the _general_ answer, not one story's opt-in stylesheet |

## 8.4 Confirmed right — do not re-litigate

- **Empties resolve before the comparator and outside the direction multiply (D-S8).** The single
  most differentiated piece of this feature against every surveyed competitor — an eleven-year-old,
  cross-library, still-unmet request that this repo already answers by construction, not by
  documentation. See §3.1.
- **Fixed pipeline order (`filter → group → sort → expand`, D-S18).** Sorting structurally cannot
  reorder groups by accident — the same guarantee `filtering.md` §8.4 credits for filtering, and
  what makes S-G1 (§5) correct by construction rather than by convention.
- **Locale-aware string comparison by default (D-S7).** Ahead of AG Grid, which requires opting into
  a documented-as-slower `accentedSort` for the same behavior.
- **No runtime type-inference in the click cycle (D-S1/D-S7).** Sidesteps TanStack's
  highest-reaction sorting bug entirely, by never doing the thing that causes it. See §1.3.
- **The FLIP row-reorder animation existing as shared, opt-in infrastructure (D-S20).** Not
  sorting-specific, but it is what will make row-hold (4.2) perceptible once it ships, and it already
  works — it just isn't turned on everywhere yet.

---

# 9. Capabilities with no owner

Distinct from the gaps above: these are not missing paragraphs in an existing spec, they are
**features with no doc at all**. Checked against `docs/status.md` (the generated capability
registry) rather than against memory — `sorting` is present there (`drilled | shipped | drafted |
none`), so nothing at the capability level is unowned; what follows is unowned at the
_sub-capability_ level.

### 9.1 A sort-criteria panel (Notion/Airtable-style) — **UI**

No doc anywhere in this repo names this, and it is unclaimed ground category-wide: MUI X's own
open request for exactly this ([`mui/mui-x#1196`](https://github.com/mui/mui-x/issues/1196), 8 👍,
open five and a half years) explicitly asks for a listing of active sort criteria a person can
reorder directly, rather than a header-click gesture — which would also happen to solve
discoverability, touch, priority display, and screen-reader exposure all at once instead of one at a
time. Worth naming here precisely because nothing else in this document or its siblings mentions it.

### 9.2 Debounce for rapid sort clicks under server mode — **state or UI, undecided which**

No doc, and — per `research-sorting-community-pain.md`'s own "not researched" list — no issue was
found in any of the four competitor trackers asking for it explicitly either, so this is a genuine
blind spot rather than a documented demand. It is the natural analog of filtering's shipped 300ms
debounce (`server-filtering/`), which `manual`-mode sorting has no equivalent of. Listed here rather
than as a numbered story because nothing establishes it as a real person's pain yet — flagged so it
isn't silently forgotten if `manual: true` ever gets its first story (§4.3, U5).

---

# 10. Not user-facing

Real problems, but the integrating developer's, not the person using the table. Listed so they are
not mistaken for missing stories.

- **Whether `sortChanged` is an `Observable` or some other event shape (D-S15).** Invisible in
  itself; its consequence (a `manual` consumer can wire an `effect()` to it) is what's product-visible
  and is credited in the mode-split at the top of this doc.
- **Whether sorting reads `columns` as core config rather than depending on `withColumns()`
  (D-S19).** A retroactively-corrected framing across three docs; a wiring detail invisible to
  anyone using the table.
- **`sortNulls()`'s single-writer enforcement (D-S12) and its schema-only availability
  (D-S13).** The _effect_ — a per-column override existing at all — is product-visible and already
  credited in §3.1; the mechanism enforcing "only one rule per column" is a construction-time
  developer error, not something a person sorting a table ever perceives.
- **`sortNulls()`'s declaration site (`withSorting({ schema })`, `api/features/with-sorting/schema.ts`
  as of #100).** Pure implementation detail behind `sortNulls()` — invisible to a person clicking a
  header.
