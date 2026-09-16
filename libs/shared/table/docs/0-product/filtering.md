---
title: Product — Filtering User Stories
type: product
capability: filtering
status: >
  14 of 16 stories ✅. 1.4 is ❌ by design (R1, no runtime operator picker); F-S1 is 🟡 (the
  selected-but-hidden count has no shipped signal); F-P1 is ❌ because pagination does not exist.
  Written after `filters.md` and `features/filtering.md` (both `spec: drilled`, R1–R31 settled) —
  this doc's job is what the design does not cover.
date: 2026-09-14
audience: product, design, engineering
---

# Filtering — user stories

What a person narrowing a table down to the rows they care about needs to be able to do, and what
they should experience when the data — or their own filter — does not cooperate. Engineering
derives API from this document, not the reverse.

> **Ownership.** Maintained by the product pass. State-layer and UI-layer efforts should **link**
> to it, not rewrite it — coverage marks here are updated from the product side as capabilities
> land.

> **This doc was written after the spec, not before it.** [`filters.md`](../1-state/filters.md)
> and [`features/filtering.md`](../1-state/features/filtering.md) are both `status: drilled`,
> carrying R1–R31 — a large, careful decision log. That log is written in the developer's voice
> (`createFilters(rows, (path) => [equals(path.status)])`), because it is a spec for an API.
> It does not answer what a person filtering a table sees, clicks, or is told when nothing
> matches. That is this document. Where the two disagree — and in one place they do — §8 says so
> explicitly rather than leaving it to be discovered at implementation time.

## Scope

**Filtering means: rows that do not match what I asked for are not in my way.** A person
perceives five things, and does not care which layer produces them:

1. I can narrow a column, or several, to just the values I want.
2. I can tell, at a glance, that a filter is active and what it is.
3. I can clear one filter or all of them, in one action.
4. Several filters work together the way I'd expect — narrowing together, or matching if any one
   applies.
5. When nothing matches, or my own filter breaks, I am told — not shown a blank table I have to
   debug myself.

The codebase splits this across a standalone `createFilters()` object (state the consumer holds,
usable with no table at all) and a thin `withFiltering()` adapter that applies it inside the
pipeline's `filter` stage. That split is invisible to the person using the table and is ignored
here.

Two modes, genuinely different products:

| Mode | What the person sees |
|---|---|
| **Client** (`createFilters()` + `withFiltering()`) | All rows are already on the table; filtering narrows what's shown, instantly, without a round trip. |
| **Server** (`createFilters()` alone, feeding a request) | `withFiltering()` is not composed at all — filters feed the request that produces the data (R10). The person sees the same narrowing, but it costs a request, and anything that would need the *unfiltered* rows (a full match count against everything that could exist, a set-filter's full distinct-value list) is either unavailable or means a second, deliberately-shaped request. |

Where the two need different answers to the same need, they get separate acceptance criteria
rather than one story that papers over the difference. **Server mode is not a degraded version of
client mode** — a table backed by a million rows that only ever renders a filtered page is a
legitimate product, and it is where several stories below (2.3, 4.4) have to be answered
differently.

## Coverage marks

| Mark | Meaning |
|---|---|
| ✅ **covered** | Demonstrable today in `src/stories/` or a demo app, with the failure path included |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not — no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

Three stories exist, read as host components rather than `.mdx` wrappers:

| Story | Composes | What it demonstrates |
|---|---|---|
| [`client-filtering/`](../../src/stories/filtering/client-filtering/) | `withFiltering({ predicates })`, client, synchronous | Five filter kinds plus a declared `anyOf` quick filter; active markers and a chip summary with per-chip ×; `Reset to defaults` vs. `Clear all` as two visibly different buttons; a broken-predicate toggle that widens the result set and mirrors the library's report onto the canvas; raw vs. guarded load of a stale saved filter; no-data and no-matches as two separate states |
| [`server-filtering/`](../../src/stories/filtering/server-filtering/) | `createFilters()` alone — no filtering feature | Criteria feed the request; a 300ms debounce made visible by a request counter; the server's own `total` overriding core `totalRowCount` per ADR-0005; the late-default race gated by `dirty()`; loading / no-matches / request-failed as three distinct blocks, with the last-loaded page kept on screen |
| [`selection-filtering/`](../../src/stories/filtering/selection-filtering/) | `withFiltering()` + `withSelection()` + `withSorting()` | Two separately named select-all scopes; retention of a selection across a filter, restored exactly; sorting changing nothing and deleting pruning; the missing selected-but-hidden count stated on canvas rather than faked |

Two marks are not ✅, and both stay explicit rather than being rounded up: **1.4** (no runtime
operator picker — R1, deliberate) and **F-S1** (the "N selected, M hidden" count has no shipped
signal). **F-P1** is ❌ only because pagination does not exist yet.

The **Design status** line on each story is unchanged — it records whether R1–R31 answers the
story. The new **Covered by** line records which shipped story proves it.

**The stories name no layers; §8 does.** A person cannot perceive the difference between a value
nothing computes and a control nothing renders, so the stories do not draw one. §8 sorts every
resulting gap into state, UI, or both, because that difference decides who does the work — and §9
collects the ones that belong to no existing feature at all.

Where a competitor's behavior is cited, it comes from
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md)
(version-pinned, 2026-09-10) or
[`research-filter-community-pain.md`](../1-state/work/with-filtering/research-filter-community-pain.md)
(issue numbers, states, and 👍 counts read from the GitHub API/pages the same day). Neither is
restated here beyond what a story needs.

---

# 1. Narrow the rows I'm looking at

Ordered by how badly the person is hurt if it is missing.

## 1.1 — Filter a column to just the values I want — ✅ covered

> As someone looking at four hundred invoices, I want to see only the ones that are still open, so
> I don't have to scan past the ones I've already dealt with.

**Acceptance criteria**

- A column can be narrowed by an exact match, a substring, a range, a date range, or membership in
  a set of values — whichever shape fits that column's data.
- Turning a filter on changes only which rows are visible, never their values, their order beyond
  what removal implies, or what's selected/expanded on the rows that remain.
- Turning it back off restores exactly what was there before.

**Failure behavior**

- A filter with no value entered yet does nothing — it never narrows the table to zero rows before
  I've typed anything.
- A cell with no value in the filtered column is excluded by a "does it equal / contain / fall in
  range" filter, and included by a "does it lack these" filter — never a `NaN`/blank comparison
  that behaves unpredictably.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) —
`equals(status)`, `contains(customer)`, `inRange(amount)`, `inDateRange(issuedAt)` and a compound
`filter(tags)` all narrow at once, and each unwinds from its own chip ×. Emptying a number box stops
that bound narrowing with no story-local guard. The same-day pair (1005 at midnight, 1006 at 16:45)
is on canvas so a date bound is visibly an instant, not a day.

**Design status:** covered — R1–R9, R27 (`filters.md` §Rules, §Semantics).

## 1.2 — Search across several columns at once — ✅ covered

> As someone who doesn't remember which column a customer's name is in, I want to type into one
> box and have it check everywhere sensible, so I don't have to know the schema to find something.

**Acceptance criteria**

- One search narrows the table by checking several columns, and a row shows if *any* of them
  matches.
- Adding this search on top of per-column filters narrows further, it never widens back out.

**Failure behavior**

- Clearing the search box returns exactly the rows the per-column filters alone would show —
  never an empty table and never everything.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — the toolbar
search runs `anyOf('search', …)` over `note` and `id`. Both legs are typed: the nullable `note` and
the numeric `id` return `false` where a stringify-and-substring quick filter would throw. Clearing
the box leaves the per-column filters exactly as they were.

**Design status:** covered — R8/R9's `anyOf(key, schema)`, deliberately narrower than every
UI-bearing competitor's auto-scan quick filter. See
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md) §4.

## 1.3 — Not have an empty filter narrow anything — ✅ covered

> As someone who cleared a filter's input back to nothing, I want the rows that were hidden to come
> back, the same as if I'd never touched it.

**Acceptance criteria**

- An empty/default criterion is treated as inactive and never reaches evaluation.
- What counts as "empty" is sensible per filter kind — `''` for text, `{min: null, max: null}` for
  a range, `[]` for a multi-select — not one universal falsy check that also empties a valid `0`
  or `false`.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — all three
empty shapes are reachable on canvas: `''` (customer), `{min: null, max: null}` (amount), `[]`
(tags). Invoice 1008's amount of `0` stays matchable, which is what a universal falsy check would
break.

**Design status:** covered — R14, empty criteria skipped before evaluation, per-predicate.

## 1.4 — Choose how strict the match is — ❌ not covered *(deliberate — R1, OQ-3)*

> As someone filtering a status column, I sometimes want "is exactly open" and sometimes want
> "contains the word open" — I want to pick which, not have a developer decide for me once and
> for everyone.

**Acceptance criteria**

- A person can change the comparison a filter uses (contains vs. equals vs. starts-with, before/
  after/between) without a code change.

**Covered by:** nothing, on purpose. No story renders an operator control, because none exists to
render — the operator is fixed at declaration (R1). This is the one story in §1–§4 left deliberately
uncovered, not an omission.

**Design status — deliberate gap (R1).** No runtime operator picker. See
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md) §2. **OQ-3**.

---

# 2. Know what's filtered, and control it

## 2.1 — See at a glance that a filter is active, and which one — ✅ covered

> As someone who filtered a table five minutes ago and got pulled into something else, I want to
> look at the table and immediately know it's been narrowed, without opening a menu to check.

**Acceptance criteria**

- Somewhere persistent and visible, it is stated that filtering is active.
- Which filters, and roughly what they're set to, is discoverable without re-opening each one.
- A filter with a value that has no visible effect (because nothing in the current data would ever
  fail it) is not indistinguishable from no filter at all — I can still tell it's set.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — an active
field carries a marker, and the summary row lists one chip per active criterion with its value and
its own ×. With nothing set it reads "no active criteria — nothing is narrowing". The third
criterion holds too: ticking *Select all* under Tags excludes no row, and still reads as active.
[`server-filtering/`](../../src/stories/filtering/server-filtering/) marks its active fields the
same way. This is U1's recipe demonstrated — the library still ships no chip component.

**Design status — gap.** No decision covers this; `criteria()` already carries the data. See
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md) §5. **OQ-4**.

## 2.2 — Clear a filter, or all of them, in one action — ✅ covered

> As someone done comparing two date ranges, I want to get back to the full list in one click, not
> by clearing three separate boxes.

**Acceptance criteria**

- One action clears a single filter; one action clears all of them.
- Clearing restores exactly what the un-filtered table shows — nothing partially reset.

**Failure behavior**

- Clearing never throws or leaves a filter in a state where its own value and its own "active"
  reading disagree.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — three
separate actions, and the trap OQ-5 names is the point of two of them: the amount filter starts at
its declared `source` (min 1000), so *Reset to defaults* (`reset()`) and *Clear all* (`reset(null)`)
land on visibly different tables. A chip's × empties that one criterion and leaves the rest
narrowing.

**Design status — covered (R17), naming trap.** `reset()` (no arg) resets to the *declared
source*, not empty — `reset(null)` is "clear". Deliberate (enables reset-to-server-default);
a docs/example obligation, not an API gap. **OQ-5**.

## 2.3 — See how many rows currently match — ✅ covered *(both modes)*

> As someone who just narrowed a big table down, I want a number that tells me how many rows are
> left, so I know whether I'm looking at 3 invoices or 300 before I start scrolling.

**Acceptance criteria**

- A count of currently-matching rows is available without the person doing their own arithmetic
  from what's rendered.
- In client mode, the count reflects the same rows the table renders. In server mode, it reflects
  what the server says matched, not an approximation from one page.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) for client mode
— "N of M match", where N is the shipped `totalRowCount()` and not story-local arithmetic. And
[`server-filtering/`](../../src/stories/filtering/server-filtering/) for server mode — the server's
own `total`, overriding core `totalRowCount` through the one member ADR-0005 leaves overridable,
rendered beside the page length so the two are never confused. Both halves of the acceptance
criteria are on canvas. See OQ-1, now resolved.

**Design status — gap.** No decision exposes this; cheap in client mode (table already computes
the filtered row set). See
[`research-filter-community-pain.md`](../1-state/work/with-filtering/research-filter-community-pain.md). **OQ-1**.

## 2.4 — Not have my typed value overwritten by a late default — ✅ covered *(server story only)*

> As someone who typed "500" into a minimum-amount filter before the page's default range finished
> loading, I don't want my number silently replaced once that default arrives.

**Acceptance criteria**

- A criterion I've actively set is never overwritten by a server-supplied default that arrives
  after I've already touched it.
- A default that arrives *before* I've touched anything is exactly what I see, and narrows the
  table accordingly.

**Covered by:** [`server-filtering/`](../../src/stories/filtering/server-filtering/) **only** — the
client story is synchronous and has no late arrival to race. *Deliver server default now* supplies
the default after the fact: type into the amount box first and the field reads "dirty" and keeps
what you typed; leave it alone and the arriving default is what you see.

**Design status:** covered — `dirty` (R19) is the reconciliation gate; a written value blocks a
late source from overwriting it.

---

# 3. Combine filters

## 3.1 — Narrow by more than one column at once — ✅ covered

> As someone filtering by both status and date range, I want rows that satisfy both, not either.

**Acceptance criteria**

- Every active filter must pass for a row to show. Adding a second filter never widens the result.
- Removing one filter widens the result back toward what the remaining ones alone would show.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — six filters
narrow simultaneously and the chip row names each one. Removing one widens back to what the rest
alone show.

**Design status:** covered — R8, across filters, AND.

## 3.2 — Match if any one of several things is true — ✅ covered

> As someone typing into a single search box that's meant to check name, notes, and account
> number, I want a match on any of those to count, not require all three.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — the same
`anyOf('search', …)` group as 1.2, matching on `note` **or** invoice number.

**Design status:** covered — `anyOf` (R8/R9), same trade as 1.2. See
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md) §6.

## 3.3 — Combine more than one condition on the same column — ✅ covered *(via the compound-criterion workaround)*

> As someone who wants tags that include "urgent" but exclude "resolved," I want to say both at
> once for one column, not pick one condition and lose the other.

**Acceptance criteria**

- Two conditions on the same underlying value (an include list and an exclude list; a range with
  an additional exclusion) can be expressed as one filter.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — the Tags
filter is one `filter()` call over a `{ include, exclude }` criterion, rendered as two checkbox
groups a person ticks independently. That is the workaround the design doc calls "the strongest case
found" for the rejected escape hatch, built and on screen. **It is a data point against R6, not for
it** — the first story written for this feature reached for the compound criterion immediately. R6's
revisit trigger is "reached for repeatedly"; this is one.

**Design status — deliberate gap (R5/R6/R31).** One filter per path; the compound-criterion
workaround is the escape hatch, reversible if reached for repeatedly. See
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md) §6.

---

# 4. When filtering does not cooperate

## 4.1 — A blank cell under an active filter — ✅ covered

> As someone filtering invoices to "has a customer note," I want invoices with no note excluded —
> and if I filter to "has no note," I want exactly those blank ones, not a mix I can't explain.

**Acceptance criteria**

- A missing value behaves consistently and predictably under every filter kind: excluded by every
  positive check, included by every negative one.
- This behavior does not vary column to column unless a consumer deliberately writes a custom
  predicate that says otherwise.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — five of the
twelve invoices have a blank `note` and two have no tags at all, both rendered as a visible blank
rather than an empty cell. The quick filter excludes the blank-note rows; Tags — exclude
(`hasNoneOf`) includes the no-tag rows.

**Design status:** covered — R27, guarded per-matcher, not in the runner.

## 4.2 — A filter that breaks does not break my table — ✅ covered

> As someone whose saved filter refers to a shape the app no longer produces, I want the table to
> keep working — even if that one filter stops narrowing anything — not a blank screen.

**Acceptance criteria**

- A predicate that throws deactivates only that filter for that evaluation. Every other active
  filter keeps narrowing normally.
- The failure is reported once, not once per row, and in production as well as development.

**Failure behavior**

- The visible consequence of a broken filter is the result set getting **wider** (that filter stops
  narrowing), never the table going blank or crashing. A wrong, silently-narrower result would be
  worse — a person would trust a result they can't see is incomplete.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — *Break the
tags filter* makes the compound tags predicate throw. The result set gets **wider**, every other
filter keeps narrowing, the table stays up, and the library's own report is mirrored onto the canvas
so "once per evaluation, not once per row" is checkable rather than asserted. An empty tags
criterion is skipped before the predicate runs, so a tag has to be picked for the throw to be
reachable — 1.3 and 4.2 agreeing on screen.

**Design status:** covered — R29, per [ADR-0014](../adr/0014-runtime-error-policy.md).

## 4.3 — A saved filter that no longer makes sense — ✅ covered *(as a story recipe; no shipped guard)*

> As someone reopening a view I saved weeks ago, I want the app to cope if the saved filter's shape
> is now stale, not throw an error at me on load.

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — *Load saved
filter (raw)* and *(guarded)* apply the same stale snapshot two ways. Raw, a `status` value that no
longer exists is applied verbatim and the table looks broken rather than empty-because-you-asked,
and pre-rename `amount` keys read as an empty range and narrow nothing, silently. Guarded, the
unusable halves fail their shape check and drop back to their declared defaults while `customer`
survives. The story is OQ-6's worked defensive pattern; the library still ships no migration or
guard helper, and the raw button has to step outside the type to exist at all — which is the
finding.

**Design status — named, accepted risk (R21, persistence out of scope).** No migration/shape-guard
helper ships. **OQ-6**.

## 4.4 — Filtering down to nothing — ✅ covered *(both modes)*

> As someone whose filter combination turned out to match no rows, I want to be told that plainly,
> not shown an empty table that looks the same as "still loading" or "no data at all."

**Acceptance criteria**

- An all-filtered-out state is visibly distinct from "no data exists" and from "still loading."
- It's obvious from that state alone how to get back to seeing rows (nothing hidden, no menu-diving
  required).

**Covered by:** [`client-filtering/`](../../src/stories/filtering/client-filtering/) — *Empty the
data* and *Restore the data* make no-data and no-matches two reachable states with two different
messages, the second of which says how to get rows back.
[`server-filtering/`](../../src/stories/filtering/server-filtering/) splits it three ways — loading,
no-matches (the server's own `total` of 0, "not an empty page of a larger result"), and
request-failed, which keeps the last loaded page on screen instead of blanking. This is U2's recipe
demonstrated; no overlay component ships, per the attribute-only invariant.

**Design status — gap.** No decision addresses this. See
[`research-filter-ux-capabilities.md`](../1-state/work/with-filtering/research-filter-ux-capabilities.md) §7. **OQ-7**.

---

# 5. Cross-feature interactions

**Each story below belongs to the feature that has to change its behavior to resolve the
collision**, not to filtering. That is this repo's existing convention
(`row-editing.md:592-596`, restated in `grouping.md` §5) — where a story already lives in another
feature's doc, it is **linked, not restated**, and that file keeps owning its coverage mark.

## Owned by row editing *(built)*

**F-1 already exists** at [`row-editing.md`](row-editing.md) §"Owned by filtering *(unbuilt)*" —
a row edited (or added) so it no longer matches the active filter must stay visible, flagged, and
leave only on the next filter change. It is **linked, not restated**; row-editing.md updates its
coverage mark from the product side. Two adjacent mentions in the same file, also linked rather
than restated:

- The same retention rule applies to **undo** — a deleted row restored into a filter it no longer
  matches must come back visible and flagged (`row-editing.md:458-460`), and this specific
  sub-case ("filtered-position handling") is explicitly named as still missing
  (`row-editing.md:486`).
- A validation error on a row the person can't currently see — because it's filtered out — must
  never silently block a bulk "save all" without saying which row and how to reach it
  (`row-editing.md:720`).

## Owned by grouping *(built, uncommitted)*

**F-G1 and F-G2 already exist** at [`grouping.md`](grouping.md) §5, "Owned by filtering *(built,
uncommitted)*" — F-G1, a filtered grouped table's counts/summaries reflecting only surviving rows
and an emptied group disappearing rather than rendering hollow; F-G2, filtering by a group's own
summary rather than its rows (explicitly out of scope for a first release, but the aggregation
contract must not foreclose it). They are **linked, not restated**; `grouping.md` owns them and
notes F-G1 is already "structurally covered" by `PIPELINE_ORDER` running `filter` before `group`.

Also linked from there: the recommendation (grouping's **OQ-1**) that ticking a collapsed group's
checkbox under an active filter should select what the group's **visible** count implies, not the
whole unfiltered group (`grouping.md:820-826`) — this is the sharpest concrete instance of the
selection story below, decided in one place rather than two.

## Owned by selection *(built)*

### F-S1 — Selecting everything I can currently see stays true to what I see — 🟡 partly covered

> As someone who filtered a list down to "unpaid" and ticked "select all," I expect to have
> selected the unpaid invoices — not every invoice in the table, and not nothing.

**Acceptance criteria**

- "Select all" under an active filter selects the rows that currently match, not the full
  unfiltered set. What it means is stated plainly, not left to guesswork.
- Rows selected before a filter is applied are **not silently dropped** from the selection just
  because the filter now hides them — they stay selected, and the count shown reflects that (e.g.
  "6 selected, 2 not currently visible"), rather than the selection quietly shrinking to whatever
  happens to still be on screen.
- Clearing the filter shows the selection exactly as it was, with nothing added and nothing lost.

**Failure behavior**

- If the count of selected-but-hidden rows can't be computed for some reason, the selection state
  itself is never guessed at or reset as a side effect — only the count display degrades.

**Covered by:** [`selection-filtering/`](../../src/stories/filtering/selection-filtering/) — two of
the three bullets render. *Select all (visible)* and *Select all (including hidden)* are separate,
separately named buttons, so bullet 1 is checkable rather than asserted. Filtering a selected row
out keeps it selected and clearing the filter restores the selection exactly — the story prints the
selected ids, so "nothing added, nothing lost" is read off the screen, not trusted. Sorting changes
no selection; deleting a selected row drops it even while it is filtered out, which is what
separates "the row moved" from "the row left".

**Why it is still 🟡:** the **"N selected, M not currently visible" count does not render**, because
no shipped signal reports it. The story states that on canvas instead of computing it in the host —
which is also this story's failure behavior holding: the count display is the only thing that
degrades, and the selection itself is never guessed at or reset. It stops rendering that notice once
the read-side count lands. Tracked at [`selection.md`](selection.md) §2.5 and
`work/computed-state-mechanism/1-intake.md`.

**Design status — half-shipped (D59).** `selectAllIds(table)` covers bullet 1 (default scope
`rows()`, post-filter/sort). **Bullet 2 (hidden-count) is unbuilt** — tracked at
[`0-product/selection.md`](selection.md) §2.5/§8.1 (S1). See
[`research-filter-community-pain.md`](../1-state/work/with-filtering/research-filter-community-pain.md). **OQ-2**.

## Owned by pagination *(unbuilt)*

### F-P1 — A page total reflects what's actually shown — ❌ not covered *(pagination does not exist)*

> As someone paging through a filtered list of 340 matching invoices, I want the page count to be
> based on those 340, not the full unfiltered table.

**Design status:** structurally covered — `filter` runs before any future `paginate` stage in
`PIPELINE_ORDER`. Worth a test once pagination ships.

---

# 6. What a filter's operator *is*

Not a story — a question that sits underneath four of them (1.4, 3.2, 3.3, and the general shape
of §1), recorded here because answering it once frames all four.

**Is the operator part of the contract the developer sets, or a choice the person filtering makes?**

| If it's **the developer's** | If it's **the person's** |
|---|---|
| `equals(path.status)` fully describes the filter; there is nothing left to render for choosing *how* to compare | A control (dropdown, toggle) for "contains / equals / starts with" has to exist somewhere, backed by state for which operator is currently selected |
| A compound need (3.3) is a code change | A compound need can sometimes be expressed by picking two conditions and an AND/OR toggle, no code change |
| Nothing here is exposed to persistence/URL state beyond the value itself | The chosen operator is itself state that needs to persist alongside the value |

**Our current position is the developer's, stated once, deliberately (R1).** Every UI-bearing
competitor answers the other way, for free, at the baseline tier
(`research-filter-ux-capabilities.md` §2) — this is not an oversight converging on convention, it
is a considered minority position. It is defensible precisely because the library, separately,
chose to ship **no filter UI at all** (`3-ui/architecture.md`'s "no UI layer for filtering"
decision — ordinary form inputs, Angular owns accessibility): a runtime operator picker matters
enormously to a library that renders its own filter chrome, and matters much less to one that
hands the developer typed primitives and expects them to build their own. The open question is not
whether R1 was reasonable — it was — but whether it should be revisited if `filter()`'s compound-
predicate escape hatch (3.3) turns out to be reached for as often in practice as the design doc's
own "strongest case" framing suggests it might be. See **OQ-3**.

---

# 7. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-1 — Should `createFilters()` expose a first-class match count? — resolved.**
*Resolved:* the count is the **core** `totalRowCount` member (`rows().length`, post-filter), not
a `createFilters()`/`withFiltering()` member. Server mode overrides the same member via
ADR-0005 (`server-filtering/`). Both render on canvas: "N of M match" (client), "server total N ·
rows on this page M" (server).

**OQ-2 — What does "select all" mean under an active filter, and what happens to a hidden
selection? — half-resolved (D59).**
*Resolved:* "select all" means *currently matching* rows — `selectAllIds(table)` defaults to
`rows()` (post-filter/sort), `{ includeHidden: true }` for the full set. `withSelection()` still
never reads `active()` directly (D1 non-dependency kept).
*Still open:* the hidden-count signal ("N selected, M not currently visible") — tracked at
[`0-product/selection.md`](selection.md) OQ-1/OQ-4.
*To decide:* whether that signal belongs on `createFilters()` or the computed-state mechanism.
*Sequencing:* not blocking; decide together with `grouping.md`'s OQ-1, not twice.

**OQ-3 — Should a runtime operator picker exist, even as an opt-in layer? — open.**
*Recommendation:* no change for v1. The library ships no filter UI at all, which is what makes R1
defensible rather than merely narrow; a picker only matters once something renders. Revisit if
`filter()`'s compound-predicate escape hatch (3.3) is reached for often enough in practice that
"the developer decides the operator" starts reading as a real limitation rather than a reasonable
default.
*To decide:* what "reached for often enough" means in practice — this needs real usage evidence,
not a guess made now.
*Sequencing:* not blocked on anything; purely a future revisit trigger, named so it isn't lost.

**OQ-4 — Does the library recommend or ship any active-filter visibility convention? — open.**
*Recommendation:* no shipped UI (consistent with "no UI layer for filtering"), but a documented
recipe using `active()`'s size for a count and its keys for a chip list — since `active()` already
carries everything this needs, the gap is entirely a missing example, not a missing primitive.
*To decide:* whether that recipe belongs in `filters.md` itself or in a future `3-ui/directives/`
doc once one exists for filtering.
*Sequencing:* nothing blocks it; cheap, and the one library that ships something here (MUI X) shows
what "good" looks like — a delete icon per active filter, one "remove all."

**OQ-5 — Is `reset()`'s "no-arg resets to source, not to empty" behavior discoverable enough? —
open.**
*Recommendation:* keep R17 as designed — a "clear" that always went to empty would make
reset-to-server-default unrepresentable, and that's a real capability, not a hypothetical one.
Fix the discoverability gap in documentation (a worked "clear = `reset(null)`" example next to
"clear = `reset()`" so the two are never conflated) rather than the API.
*To decide:* nothing structural — this is a docs/example obligation, tracked here so it isn't
forgotten once `createFilters()` ships.
*Sequencing:* trivial, can land with the first real usage example.

**OQ-6 — What should a consumer do about a persisted filter criterion that no longer matches the
current schema? — open.**
*Recommendation:* no new API — persistence is deliberately out of scope (R21) — but `filters.md`'s
Errors section should carry a worked defensive pattern (validate/guard shape before `reset(value)`)
alongside the existing statement that a stale criterion is the likeliest cause of a throwing
predicate.
*To decide:* whether that guard belongs as a documented recipe only, or as an exported helper
(e.g. a shape-checking utility) — leans toward recipe-only, consistent with R21's "no adapter
shipped" stance, but worth a deliberate call rather than a default.
*Sequencing:* not blocked; purely additive documentation.

**OQ-7 — What happens, visibly, when a filter combination matches nothing? — open.**
*Recommendation:* no shipped overlay component (consistent with "attribute-only, no structural DOM
injection" — this library's own locked invariant), but a documented recipe: `active()` non-empty
plus zero rendered rows is the trigger a consumer's own empty-state template should key off of.
Explicitly warn about the AG Grid/MUI X trap both independently documented — a stale, manually-
filtered `data` signal can mask this exactly the way a stale unfiltered `rows` prop masks their
built-in overlays.
*To decide:* whether this recipe belongs in `filters.md` or waits for a UI-layer doc.
*Sequencing:* not blocked; the underlying signal (`active()`, row count) already exists in the
spec, so this is a documentation gap, not a design one.

---

# 8. Gap analysis, split by owning layer

The point of writing this after `filters.md`/`features/filtering.md` was to find these. Listed
plainly so they are absorbed rather than discovered.

**The stories above are deliberately layer-free** — a person does not perceive layers, and a story
that names one has drifted back into being a spec. The gaps are a different thing: each is work
someone has to do, and the first question about any piece of work is who does it. So every gap
below is tagged **state**, **UI**, or **both**, and where it is both, what each layer owes.

## 8.1 State-layer gaps

Owned by `1-state/work/with-filtering/` and `filters.md` itself.

| # | Gap | Story | Note |
|---|---|---|---|
| ~~S1~~ | ~~No first-class filtered-row match count~~ — **resolved** | 2.3 | Core `totalRowCount` member, not `createFilters()`/`withFiltering()`. See OQ-1 |
| S2 | Selection-under-filter semantics — **half resolved** | F-S1 | Scope half settled by D59's `selectAllIds()`. Hidden-count half owned by [`selection.md`](selection.md) §8.1 S1. OQ-2 |
| ~~S3~~ | ~~`createFilters()` has zero implementation~~ — **resolved** | — | `src/filters/` domain ships, `filters.md` reads `code: shipped` |
| ~~S4~~ | ~~Shipped `withFiltering()` implements the superseded imperative shape~~ — **resolved** | — | `with-filtering.ts` applies a predicate list with `manual` pass-through for server mode (ADR-0016). `3-ui/architecture.md` still names the old API (U5) |
| S5 | No **shipped** guard for a persisted criterion that no longer fits the schema | 4.3 | `filters.md`'s Errors section names the risk, ships nothing. `client-filtering/`'s raw-vs-guarded load buttons are the recipe, not an API. OQ-6 |
| ~~S6~~ | ~~No per-filter or `active()`-derived count~~ — **resolved with S1** | 2.3, F-P1 | F-P1 reads the same core `totalRowCount` once pagination exists |

## 8.2 UI-layer gaps

Owned by `3-ui/architecture.md`'s filtering section (currently describes the superseded API —
see §8.4) and whatever directive doc, if any, is written once `createFilters()` ships.

| # | Gap | Story | Note |
|---|---|---|---|
| U1 | No active-filter visibility convention (chip list, count, per-filter clear) | 2.1 | Recipe exists in `client-filtering/` (per-field marker, chip list, "no active criteria" state); no component ships. OQ-4 |
| U2 | ~~No documented empty-state recipe~~ — **shipped** | 4.4 | `client-filtering/` (no-data vs. no-matches) and `server-filtering/` (loading / no-matches / request-failed) both render it. No overlay component ships (attribute-only invariant). OQ-7 |
| U3 | No runtime operator-picker recipe | 1.4, §6 | By design (R1). OQ-3 |
| U4 | Filter-state changes are not announced to screen readers | all of §1–§4 | Accepted cost, recorded at `3-ui/work/core-directives/2-decisions.md:91` |
| U5 | `3-ui/architecture.md`'s filtering section names the pre-`createFilters()` API | — | `setColumnFilter()`/`setGlobalFilter()` are gone (R26); doc needs a re-check when next touched |
| U6 | No guidance for a widget that is simultaneously an editor and a filter input | — | Forward-looking; no such widget exists here yet. See `primeng#17128` |

## 8.3 Gaps needing both layers

| Gap | State owes | UI owes |
|---|---|---|
| ~~Match count (2.3)~~ — **both halves landed** | ~~S1's derived count~~ — core `totalRowCount`, already there | ~~rendering it~~ — "N of M match" in `client-filtering/`, "server total N · rows on this page M" in `server-filtering/` |
| Selection under a filter (F-S1) | ~~what "select all" scopes to~~ — D59. **Still owed:** the hidden-count signal (`selection.md` S1) | ~~showing that hidden selections survive~~ — `selection-filtering/` renders retention and prints the ids. **Still owed:** the "N selected, M hidden" split, which nothing can compute yet |

## 8.4 Confirmed right — do not re-litigate

- **`filter` runs before every other pipeline stage** (`PIPELINE_ORDER`) — this is what makes F-G1
  (grouping) and F-P1 (pagination) structurally correct with zero filtering-specific wiring in
  either feature, and it's the same guarantee AG Grid, MUI X, TanStack and PrimeNG all rely on
  architecturally, none of which states it as a promise the way this codebase's fixed order does.
- **Per-callback error degradation (R29, ADR-0014)** — a broken filter widens the result set rather
  than blanking the table or crashing. No surveyed library documents an equivalent guarantee.
- **`dirty` as the reconciliation gate (R19)** — a typed value is never silently overwritten by a
  late-arriving server default. Nothing in the survey names this as a solved problem elsewhere;
  it's solved here as a side effect of the Signal Forms-shaped design, not a bolt-on.
- **Null/undefined handling guarded per-matcher, not in the runner (R27)** — a custom `filter()`
  predicate can always opt back into seeing raw nulls; the shipped kinds get sensible defaults
  without the two ever fighting each other.
- **One filter per path (R5)** — closes off an entire class of bug this codebase's own
  `SlotRegistry` precedent already solved for pipeline stages and member keys; extending the same
  mechanism here rather than inventing a second one is a deliberate reuse worth keeping.

---

# 9. Capabilities with no owner

Distinct from the gaps above: these are not missing paragraphs in an existing spec, they are
**features with no doc at all**. Checked against `docs/status.md` (the generated capability
registry) rather than against memory.

The `filters` capability is in the registry (`filters | drilled | shipped`), regenerated with
`npm run table:status`, never hand-edited.

### 9.1 Active-filter chips / clear-all toolbar — **UI**

No doc, no directive, nothing in the registry (§2.1, OQ-4).

### 9.2 ~~Filtered-row match count~~ — **withdrawn, it had an owner all along**

The count is `core`'s `totalRowCount` (`rows().length`, post-filter, ADR-0005 overridable), not
filtering's. F-P1 will read the same member once pagination ships.

### 9.3 Data-derived filter options (set-filter / distinct values) — **state**, deliberately declined

`createFilters()` takes no `data` argument by design (R11) — there is structurally no way to
auto-populate a dropdown's options from the rows actually loaded, the way AG Grid's Set Filter
(Enterprise) or Material React Table's `select`/`multi-select` (free) do. This is the sharpest
"deliberately not shipped meets real, bug-prone territory" finding in the community research: every
library that *does* ship this has fielded correctness and performance bugs specifically in the
distinct-value derivation step — AG Grid **[#3314](https://github.com/ag-grid/ag-grid/issues/3314)**
(resetting set filters recomputes distinct values expensively across many columns),
**[#6747](https://github.com/ag-grid/ag-grid/issues/6747)** (breaks on complex-object values), a
documented case-sensitivity dedup trap in AG Grid's own docs, and PrimeNG
**[#10122](https://github.com/primefaces/primeng/issues/10122)** (👍 21, breaks on the simplest
possible shape — a plain `string[]`). Declining to ship this trades away a feature that is
genuinely hard to get right, not a trivial convenience — worth stating exactly that way rather
than as an oversight.

### 9.4 Runtime operator picker — **UI**, deliberately declined

Named already in §6/§1.4/OQ-3; listed here too because, like 9.3, it is a capability with
*zero* ownership anywhere in the docs — not scoped-out-with-a-note, simply absent, because the
"no UI layer for filtering" decision predates `createFilters()` and never had occasion to mention
it.

**Settled boundaries, not gaps — checked and explicitly not counted above:** saved/named filter
presets (every surveyed library gives an integrator a serializable model — `getFilterModel()`,
`filterModel`, `active()` here — and leaves saving/naming/sharing to the app; no library treats
this as a library-owned feature) and URL/query-string sync (same pattern — TanStack's own docs
punt this to userland explicitly, and no tracked pain point was found asking a *library* to own
it). Both are real integrator work, correctly left alone.

---

# 10. Not user-facing

Real problems, but the integrating developer's, not the person using the table. Listed so they are
not mistaken for missing stories.

- **Whether rules and matchers live in one file or two** (R30, `filters/rules.ts` vs.
  `matchers.ts`) — pure code organization, invisible to anyone using the table.
- **Whether `createFilters()` requires an injection context, with `{ injector }` as an escape
  hatch** (R24) — developer ergonomics, mirrors `createTable()`/`form()` exactly.
- **Whether `filters().value` is a real `WritableSignal` versus some other reactive shape** (R18)
  — invisible in itself; its *consequence* (a Signal Form wraps it with no adapter, giving
  debounce and validation for free per R25) is genuinely product-visible and is credited where it
  matters, in §1 and the open questions.
- **Whether `manual` is kept on `withFiltering()` for symmetry with `withSorting()`** (R23) — a
  configuration-surface consistency call with no on-screen form.
- **Whether filtering participates in `ADR-0006`'s row-id reconciliation** — it does not, by
  construction: criteria are keyed by filter key, not by row id, so `createFilters()` is exempt
  from `onRowsRemoved` the same way it would be from any row-identity concern. An implementation
  fact, not a product one.
- **`docs/status.md`'s stale/missing rows for `filtering`/`filters`** (§9's opening note) — a
  documentation-tooling problem for maintainers, not something a person filtering a table would
  ever perceive.
- **`3-ui/architecture.md` naming the pre-`createFilters()` method names** (§8.2, U5) — the same
  category as the previous item: a maintainer will hit a stale doc; nobody using the table ever
  will, because that code path doesn't render anything today either way.
