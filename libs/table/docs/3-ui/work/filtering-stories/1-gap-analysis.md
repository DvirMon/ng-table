---
title: Gap analysis — Storybook stories vs. product filtering stories
type: plan
status: >
  built 2026-09-14. All three story folders shipped — `client-filtering/`, `server-filtering/`,
  `selection-filtering/` — then were reworked in review (see `2-review-criterion-control.md`):
  `fixtures/filters.ts` deleted, each host declares its own `createFilters<TRow, TState>()`, and
  Signal Forms binds straight to the criterion model. Three library gaps were fixed to allow that
  — root `value` is a `WritableSignal`, `withFiltering()` carries `TState`, `reset()` takes a
  `Partial<TState>`. Coverage re-derived into `0-product/filtering.md`: 14 ✅, 1 🟡 (F-S1's hidden
  count), 2 ❌ (1.4 by design, F-P1 needs pagination). Deferred: node H (the hidden-selection count
  signal), owned by `work/computed-state-mechanism/`. Revision 2 (research corpus folded in).
date: 2026-09-14
parent: ../../architecture.md
---

# Filtering — Story Coverage Report

Compares [`0-product/filtering.md`](../../../0-product/filtering.md)'s user stories against the
9 existing Storybook stories in `src/stories/`, then proposes the target set — minimal count,
standalone only where a mechanism is large or cross-cutting enough to need its own showcase.
Shape conventions come from [`3-ui/stories.md`](../../stories.md); structure follows the
precedent at [`row-edit-stories/2-gap-analysis.md`](../row-edit-stories/2-gap-analysis.md).

> **Revised 2026-09-13** to incorporate the `1-state/work/with-filtering/research-*.md` corpus,
> which the first pass was written without — above all
> [`research-filter-ux-capabilities.md`](../../../1-state/work/with-filtering/research-filter-ux-capabilities.md),
> the version-pinned inventory of what a person can click, type and see across AG Grid,
> TanStack v8, MUI X, PrimeNG and Material React Table. The product doc says what a person needs
> to be able to *do*; that research says what affordance peer libraries actually *render* for it.
> The first pass had only the former, so its story shapes were invented rather than conventional.
> The new §"Conventions from peer libraries" holds the matrix; every target story's affordance
> list is re-derived against it, with changed rows called out per story.

> **The product doc's premise is stale (written 2026-09-10, re-derived 2026-09-13).** It states
> `createFilters()` "has zero code" and that the shipped `withFiltering()` "still implements the
> shape it replaces". Neither holds now: `src/api/create-filters.ts` plus `src/api/filters/`
> (`rules.ts`, `matchers.ts`, `state.ts`, `evaluator.ts`, `recorder.ts`, `validate.ts`) ship with
> full spec coverage, and `src/api/features/with-filtering.ts` is the v2.0 adapter over it
> (`createFilterEvaluator`, `manual` mode). **§8.1's S3 and S4 are resolved.**
> [`1-state/filters.md`](../../../1-state/filters.md)'s frontmatter still reads `code: none` —
> see node E.
>
> **Checked against `research-filter-internal-coverage.md` (2026-09-10), which wins on everything
> it covers — with one dated exception.** Its §4 (no story exercises filtering, verified host by
> host) and its R1–R31 product-visible/internal-only table are both confirmed and are folded in
> below. Its §6 and §5 code-status claims ("`createFilters()` is unwritten", "today's shipped
> filtering UX is the old imperative shape") are the *same* stale premise as the product doc's —
> both were written the day before the code landed, and `src/` as of 2026-09-13 contradicts them.
> Two of its §5 contradictions have since **resolved on their own**: `docs/status.md` has been
> regenerated, so `filtering` now reads `drilled | shipped` (#2 closed) and a `filters` row now
> exists (#3 closed). Node E shrinks accordingly — see the build order.

## What actually ships today (re-derived from `src/`, not from spec marks)

| Surface | Shipped |
|---|---|
| Declaration rules (`api/filters/rules.ts`) | `equals`, `contains`, `inRange`, `inDateRange`, `hasAny`, `hasNone`, `filter` (custom predicate), `anyOf` (OR group), `applyWhen` (conditional activation) |
| Matchers (`api/filters/matchers.ts`) | `isEqual`, `isContaining`, `isInRange`, `isInDateRange`, `hasAnyOf`, `hasNoneOf` — each guards its own null cell (R27) |
| Per-filter state (`FilterNode`) | `value` (`WritableSignal`), `active()` (`undefined` when empty), `reset(v?)` / `reset(null)` (R17), `dirty()` (`linkedSignal`, R19) |
| Root state (`FiltersRoot`) | `value()`, `active()` (empties omitted), `reset()`, `dirty()` |
| Options | `source` (late default), `as` (key rename, string-literal enforced) |
| Feature | `withFiltering({ filters, manual? })` — one `filter` pipeline stage, **declares no members**. `manual: true` is an identity pass-through that still claims the `filter` stage |
| Degradation | `createFilterEvaluator` reports a throwing predicate **once per evaluation** and continues without narrowing ([ADR-0014](../../../adr/0014-runtime-error-policy.md), R29) |
| Match count | **`table.totalRowCount()` — a first-class member after all.** `computed(() => core.rows().length)`, i.e. post-`filter` stage. Landed via ADR-0005 to feed `aria-rowcount`, not via filtering, and it is the **only** core member a feature may override (`engine/slots.ts`'s `OverridableCoreKey`) |
| Registry | `docs/status.md` now carries both rows (`filtering \| drilled \| shipped`, `filters \| drilled \| none`). `filters.md`'s own frontmatter is the one still-wrong fact — node E |

**OQ-1 is closer to answered than the product doc knows.** Its recommendation — "a derived member
alongside `active()`, computed over the same filtered row set" — describes `totalRowCount()`,
which already exists for an unrelated reason. Its server-mode half ("must instead be whatever the
response reports") is also already mechanised: a feature overriding `totalRowCount` is the
supported way to substitute the server's total. Worth folding back into `filters.md`, but out of
scope here.

## Existing stories — what they actually cover (read from the story-host code, not the mdx)

| Story | Composes / configured with | Actually demonstrates |
|---|---|---|
| — | — | **Nothing. No existing story touches filtering.** |

Confirmed twice, independently: by grepping every file under `src/stories/` for `withFiltering` /
`createFilters` / `filters` / `Filter` — zero hits — and by
`research-filter-internal-coverage.md` §4, which read all nine `*-story-host.component.ts` files
line by line and found only unrelated `Array.prototype.filter()` calls (cited down to the line
number in six of them). All nine belong to the row-editing cluster; the only non-editing feature
any of them composes is `withSorting()`.

**Redundancy:** nothing to merge — there is nothing to merge *with*. The merge risk is
forward-looking: a client story and a server story differing only by `manual` would normally be a
merge candidate, but [`stories.md`](../../stories.md) is explicit that a toggle between two
incompatible code paths earns separate folders rather than a control, because the host would
otherwise always carry a dead branch. Recorded as a decision, not an oversight.

**Fixtures cannot be reused as-is.** `row-edit.types.ts`'s `EditRow` is `{ id, name, dept }` —
three always-populated strings. It can exercise `equals` and `contains` and nothing else: no
number (`inRange`), no `Date` (`inDateRange`), no array (`hasAny`/`hasNone`), no nullable cell
(§4.1).

---

## Cross-reference against the product doc

**Partially covered** here means: the mechanism ships and is spec-tested, but nothing on screen
lets a person see or trigger it. That is every row but four.

| Product story | Mark | Evidence |
|---|---|---|
| 1.1 narrow a column | 🟡 partial | All six rule kinds ship and are spec-tested (`create-filters.spec.ts`). No input renders one |
| 1.2 search several columns | 🟡 partial | `anyOf` ORs children over one shared criterion; the developer names the paths (deliberate — §1.2's trade, and the PrimeNG `globalFilterFields` shape, `ux §4`) |
| 1.3 empty filter is inactive | 🟡 partial | Per-kind `isEmpty` (`''`, `{min:null,max:null}`, `[]`) — R14, skipped before evaluation |
| 1.4 choose the operator at runtime | ❌ none | R1 fixes it at declaration; no picker exists, by design (OQ-3). `ux §2`: 4 of 4 UI-bearing peers ship one free |
| 2.1 see that a filter is active | 🟡 partial | `active()` returns exactly the data this needs. Nothing renders it (U1). Only MUI X documents an affordance (`ux §5`); PrimeNG [#16576](https://github.com/primefaces/primeng/issues/16576) (👍 11, open) is a regression report for its *absence* (`pain T9`) |
| 2.2 clear one / clear all | 🟡 partial | `reset()` / `reset(null)` / root `reset` all ship. The `reset()` ≠ clear trap (R17/OQ-5) is undemonstrated anywhere — and **no peer library has a reset-to-source concept at all**, so the trap is a real deviation, not a naming quibble (`ux §5`) |
| 2.3 how many rows match | 🟡 partial (both modes) | `totalRowCount()` ships post-filter and is feature-overridable for the server total. **Nothing renders a visible count** — the gap is entirely UI, not state. No peer renders one either; it is an unmet ask in 3 trackers (`pain T5`) |
| 2.4 late default must not stomp my value | 🟡 partial | `linkedSignal` + `dirty()` gate ships, spec-tested ("a later source change does not stomp a dirty filter value"). **Invisible unless raced on purpose** |
| 3.1 AND across filters | 🟡 partial | Root-level AND in the evaluator, spec-tested. Universal convention (`ux §6` — every peer AND's across columns) |
| 3.2 OR within one criterion | 🟡 partial | `anyOf` group, spec-tested. Developer-authored OR matches every peer but MUI X Pro (`ux §6`) |
| 3.3 two conditions on one column | 🟡 partial | Only via a compound `filter()` criterion (`{include, exclude}` + `hasAnyOf`/`hasNoneOf`). R5 forbids a second filter per path — spec-tested both ways |
| 4.1 blank cell under a filter | 🟡 partial | `matchers.spec.ts` covers null/undefined for all six matchers. **No fixture anywhere has a blank cell.** This is the highest-reaction bug class in the peer trackers (`pain T3`: TanStack [#4280](https://github.com/TanStack/table/issues/4280) 👍 29, [#4919](https://github.com/TanStack/table/issues/4919) 👍 10, [#4711](https://github.com/TanStack/table/issues/4711)) |
| 4.2 a broken filter widens, never blanks | 🟡 partial | `createFilterEvaluator` degrades and reports once per evaluation. No way to trigger it on screen. No peer documents an equivalent guarantee (`ux §7`) |
| 4.3 stale persisted criterion | ❌ none | R21 puts persistence out of scope; no guard, no recipe (OQ-6) |
| 4.4 filtered down to nothing | ❌ none | No empty-state, no recipe, and the AG Grid/MUI X stale-rows trap is unwarned (OQ-7, `ux §7`) |
| F-S1 selection under a filter | 🟡 partial | `selectAllIds(table)` scopes to `rows()` (D59) — bullet 1 shipped. Bullet 2 (hidden-selection count) unbuilt. **No selection story exists either.** `pain T1` is the largest cluster in the corpus — 9 issues, 4 libraries, 2019→2026 |
| F-G1 / F-G2 grouping under a filter | 🟡 partial | Structurally guaranteed by `PIPELINE_ORDER` (filter → group). `withGrouping()` ships; **no grouping story exists** |
| F-P1 page total under a filter | ❌ none | `withPagination()` does not exist. `ux §7` marks the filter-then-paginate guarantee "inferred, not verified" for all four peers |

**Shipped with no product story:** `applyWhen()` (conditional activation, R15) is implemented,
exported, and spec-tested, and **no story in `filtering.md` owns it**. That is a product-doc gap,
not a story gap — see "Left out on purpose".

---

## Conventions from peer libraries

The affordance layer the first pass was missing. Every claim cites the research, not the library
docs — the research already did the citation and version-pinning work.

Shorthand: **`ux §n`** = [`research-filter-ux-capabilities.md`](../../../1-state/work/with-filtering/research-filter-ux-capabilities.md)
(AG Grid 36.1.0, TanStack v8.21.3, MUI X 9.13.0, PrimeNG 22.1.1, MRT 3.2.1, all read 2026-09-10).
**`pain Tn`** = [`research-filter-community-pain.md`](../../../1-state/work/with-filtering/research-filter-community-pain.md).
**`cov §n`** = [`research-filter-internal-coverage.md`](../../../1-state/work/with-filtering/research-filter-internal-coverage.md).

TanStack v8 renders **no filter UI of any kind** (`ux §1`), so it is a convention data point only
where it says something about state. "Convergent" below means three or more of the four UI-bearing
peers render the same shape, free.

### A. Affordances a story should demonstrate

| Affordance | AG Grid | MUI X | PrimeNG | MRT | Convergent? | What our story renders |
|---|---|---|---|---|---|---|
| **Per-column input, always visible** (floating-filter row) | Free, under the headers, editable in place | **Pro** (Header Filters) | Free (`display="row"`, the default) | Free (default, below the header) | **Yes, 3/4 free** — and `ux §9` reads MUI X paywalling exactly this as the sharpest signal that "filter visible without a click" is the valuable shape | A filter row under the header, one input per filtered column, no click to reveal |
| **Filter menu / popover per column** | Free (column-menu icon) | Default entry point (side panel) | Free (`display="menu"`) | Free (`'popover'`) | Offered by 4/4 — but always as the *alternative* to the inline row, never the only shape | **Nothing.** This library ships no column menu at all to hang one on; inventing a popover would imply chrome that doesn't exist |
| **Global / quick filter box** | Free, scans **all** columns, word-AND | Free toolbar field, word-AND, `debounceMs` | Free, `globalFilterFields` names the columns | Free toolbar box, fuzzy-ranked | **Yes, 4/4**, in the toolbar, AND'd with the column filters (`ux §4` — no peer lets the end user change how the two interact) | One toolbar search box above the table, AND'd with the column filters. Paths named explicitly (`anyOf`), the PrimeNG shape — not AG Grid's scan-everything |
| **Range input** | Two inputs for `inRange` | Operator-paired inputs | `type="numeric"` | `range` / `range-slider` | **Yes** — two bound inputs, never one free-text | Two inputs, min and max, feeding one `inRange` criterion (R2) |
| **Date-range input** | Calendar-picker input **per bound** | Date picker per operator | `type="date"` | `date-range` | **Yes** — a picker per bound | Two date inputs, from and to, feeding one `inDateRange` criterion |
| **Set / checkbox-list filter** (widget only) | Checkbox list + mini-search + Select-All | `singleSelect` dropdown | MultiSelect (`matchMode="in"`) | `multi-select` | **Yes on the widget.** Divergent only on where the options come from — see non-goals | Multi-select checkbox list with Select-All, options from a **hand-supplied** `TAG_OPTIONS` |
| **Per-column "this is filtered" marker** | Filter icon changes appearance; floating filter shows the live value | Not documented beyond the panel row | Regressed in v18 — [#16576](https://github.com/primefaces/primeng/issues/16576) open, 👍 11, >1yr | Unverified | **Weak (2/4 documented)** — but its *absence* is a filed, upvoted regression, which is stronger evidence than its presence | An active marker on the input itself, driven by `active()` |
| **Active-filter summary + clear-one** | None documented | **× per active constraint** (`ux §5`) | Apply/Clear per field in menu mode | Unverified | **No** — MUI X is the only documented precedent | A summary row of active criteria, one × each → `reset(null)`. Named as MUI X's affordance relocated, not as a convention |
| **Clear-all** | Set Filter has Clear/Reset buttons | Documented **"Remove all"** | Per-field Clear only | Unverified | **Weak (2/4)** — but every peer that has one means *empty* by "clear" | **Two** buttons side by side: `Reset to defaults (reset())` and `Clear all (reset(null))`. No peer has reset-to-source, so R17 needs the contrast on screen, not in prose (OQ-5) |
| **Match-count display** | Nothing | Nothing | Nothing | Nothing | **No peer ships one** — but `pain T5` has it open in 3 trackers (MUI X [#7583](https://github.com/mui/mui-x/issues/7583) 👍 23, [#1106](https://github.com/mui/mui-x/issues/1106) 👍 8; AG Grid #1112, #7374) | "N of M match" from `totalRowCount()` |
| **Empty-result state** | `overlayNoRowsTemplate`, distinct from no-data | `noResultsOverlay`, distinct from no-data | Generic `emptymessage` only | Unverified | **Yes, 2/4 explicitly + both warn about the same trap** — the overlay fails to fire if the developer filters rows themselves without updating the rows prop ([ag-grid#3716](https://github.com/ag-grid/ag-grid/issues/3716)) | A no-matches block keyed on `active()` non-empty **and** `totalRowCount() === 0`, visibly distinct from no-data, with the trap named in the host doc-comment |
| **Server-mode loading indication** | Server-Side Row Model | `filterMode="server"` | `lazy` + `onLazyLoad` | Inherits TanStack | Server filtering is 4/4; **no peer documents a loading affordance** (`ux §7`) | Three visibly distinct states — loading, no matches, request failed. Our own call, extending the empty-state convergence to the async case |
| **Debounce / typing latency** | None | **`debounceMs` on the quick filter — the only one** | None | None | **No.** And `pain T9` shows the demand pulls *both* ways: PrimeNG [#9581](https://github.com/primefaces/primeng/issues/9581) (👍 19, open 5 years) wants *instant*, MUI X [#12150](https://github.com/mui/mui-x/pull/12150) wants debounce specifically for **async server-side** filtering | Demonstrated in the **server** story only, via Signal Forms' `debounce()` (R25) — where a keystroke costs a request. See the moved row under story 1 |

### B. Explicit non-goals — named so a story never implies they are first-class

`cov §6` lists nine deliberately-unshipped items; these are the ones with an on-screen shape.

| Affordance | Peer position | Why we don't ship it | Story treatment |
|---|---|---|---|
| **Runtime operator picker** (`[contains ▾] [text]`) | **4/4 UI-bearing peers ship it free** (`ux §2`). The only peer without one is TanStack — the only peer with no filter UI at all | R1 — the operator is the developer's, fixed at declaration. `ux §2` states plainly there is *no precedent* for our position among libraries that render anything; defensible only because we render nothing. Still open-and-wanted elsewhere (`pain T2`: MUI X #6419 👍 10, #13610 👍 9, #14897 👍 9, #9243 👍 11) | **No story.** A picker falls out of the general mechanism by putting the operator inside the criterion value (`research-generic-filter-utilities.md` Finding 7) — but demoing it would present an unsupported pattern as first-class. Revisit trigger (OQ-3), not a mechanism |
| **A second filter on one column** | AG Grid Filter Conditions (free, user-toggled AND/OR, max 2); PrimeNG per-field `operator`/`showOperator` (free); MUI X multi-filter (Pro) (`ux §6`) | R5/R6/R31 — one filter per path, a duplicate throws at construction | Only the compound-`filter()` workaround is demoed (story 1). A story of the throw would demonstrate a guard, not a capability |
| **Cross-column AND/OR toggle** | **MUI X only**, Pro-gated. Every other peer treats cross-column as implicit, fixed AND (`ux §6`) | `anyOf` is a developer-authored OR group (R8) — the majority position, not an outlier | Story 1 shows `anyOf` wired by the developer. No toggle |
| **Data-derived filter options** (distinct values from the loaded rows) | AG Grid Set Filter (**Enterprise**), MRT `select`/`multi-select` (free, via faceting). MUI X and PrimeNG require hand-supplied options at every tier (`ux §3`) | R11 — `createFilters()` takes no `data` argument. Structurally impossible, and impossible to restore in server mode anyway | The multi-select's options come from `TAG_OPTIONS` and the host doc-comment **says so**. `ux §3` notes a person has no visual way to tell a derived dropdown from a hardcoded one — so the story must say which it is. `pain T9` is the strongest evidence this is a good trade: every peer that ships it has fielded distinct-value derivation bugs (AG Grid #3314 perf, #6747 complex objects, a documented case-sensitivity dedup trap; PrimeNG #10122 👍 21 breaks on `string[]`) |
| **Built-in debounce** | MUI X quick filter only (`ux §4`) | R25 — debounce via Signal Forms' `debounce()` over the model; nothing shipped for a consumer not using Signal Forms | Shown as the consumer-side recipe in the server story, framed as "here is how you add it", not as a feature |
| **Persistence / storage adapter** | Three-way split: TanStack/MRT ship nothing; AG Grid/MUI X ship export/import with no storage; **PrimeNG alone** ships automatic `stateStorage` (`ux §8`) | R21 — consumer's own `JSON.stringify` + `reset(value)` | Story 1's 4.3 row demos the consumer-owned load path plus a shape guard (OQ-6). The host doc-comment names PrimeNG as the single-library precedent for the road not taken |
| **Auto-deselect rows a filter hides** | **MUI X's stated behavior**: "selected rows that do not pass the filtering criteria are automatically deselected." The only peer with any documented position (`ux §7`) | Deliberately rejected — F-S1 bullet 2 argues for retain-and-flag | Story 3 demonstrates retention *against* this convention, and says so. `pain T1` shows most of its 9 bug reports are people asking for exactly what MUI X's documented behavior denies them |

---

## Target story set

Three new folders plus one shared fixture cluster. Nothing to extend and nothing to merge, because
nothing exists. Every async effect is a real MSW-intercepted round trip driven by the existing
`forceFailure` / `latencyMs` → request-header pattern from `row-edit.handlers.ts`; no new
simulation mechanism is invented.

### 1. `client-filtering/` — NEW — the filtering baseline

**Composes:** `withFiltering({ filters })`. Client filtering is synchronous, so per `stories.md`
this story gets a single `Default` export and no MSW — the "reserve a plain stub for a story that
isn't about save/delete at all" carve-out, taken deliberately.

**Layout follows the convergent shape, not an invented one:** per-column inputs in an
always-visible filter row under the header (`ux §1`, 3/4 free); the search box in a toolbar above
the table (`ux §4`, 4/4). No popover, no column menu.

| Product story covered | Covered by |
|---|---|
| 1.1 narrow a column | **new** — one input per shipped rule kind, in the filter row: status `<select>` (`equals`), customer text (`contains`), amount **two inputs, min and max** (`inRange`), issued-at **two date inputs, from and to** (`inDateRange`), tag **multi-select checkbox list with Select-All** (`hasAny`), tag exclude (`hasNone`) — each the widget its peers converged on (`ux §3`) |
| 1.2 / 3.2 search several columns | **new** — one toolbar search box wired to `anyOf('search', …)` across customer + note + id, AND'd with the column filters (universal, `ux §4`). The host doc-comment names the trade: paths are declared, PrimeNG-style, not scanned, AG-Grid-style |
| 1.2 / 4.1 failure behavior — the quick filter does not break on a non-string cell | **new** — `anyOf` deliberately spans a nullable `note` and a numeric `id`, so the typed matcher visibly returns `false` where a stringify-and-substring quick filter throws. This is `pain T3`, the highest-reaction filtering bug class found anywhere (TanStack [#4280](https://github.com/TanStack/table/issues/4280) 👍 29 `toLowerCase is not a function` on number fields, [#4919](https://github.com/TanStack/table/issues/4919) 👍 10 null accessor, [#4711](https://github.com/TanStack/table/issues/4711) null first value) |
| 1.3 empty filter does nothing | **new** — the summary row and the count are both visibly unchanged while every box is empty, driven by the shipped per-kind `isEmpty`, not by a story-local guard |
| 2.1 see what's active | **new** — two affordances, not one: an **active marker on each filtered input** (AG Grid's icon-state convention, and the affordance PrimeNG [#16576](https://github.com/primefaces/primeng/issues/16576) regressed), plus a **summary row of active criteria** rendered from `filters().active()`. This is OQ-4's recipe made executable |
| 2.2 clear one / clear all | **new** — × per summary entry → `filters.<key>().reset(null)` (MUI X's per-constraint delete, `ux §5`); plus **two** toolbar buttons side by side, `Reset to defaults (reset())` and `Clear all (reset(null))`. No peer library has a reset-to-source concept — every peer's "Clear" means empty — so R17's trap is a real cross-library deviation and has to be watched, not read (OQ-5) |
| 2.3 match count | **new** — "N of M match" from `table.totalRowCount()`, the shipped member, not story-local arithmetic. No peer renders one; three trackers have it open (`pain T5`). Closes the pure-UI half of OQ-1 |
| 3.1 AND across filters | **new** — two filters on at once; the count only ever shrinks, never widens |
| 3.3 include + exclude on one column | **new** — one compound `filter(path.tags, (cell, { include, exclude }) => hasAnyOf(cell, include) && hasNoneOf(cell, exclude))` fed by two multi-selects into one criterion. Makes R5/R6's documented workaround copy-pasteable instead of prose, and stands in for the free multi-constraint UI AG Grid and PrimeNG both ship (`ux §6`) |
| 4.1 blank cells | **new** — fixture rows carry `note: null` and `tags: []`; a positive filter excludes them and `hasNone` includes them, shown side by side (R27) |
| 1.1 failure behavior — date-range bounds | **new** — a same-day from/to case plus a row whose `issuedAt` carries a time-of-day, so `inDateRange`'s inclusive bounds are visible rather than assumed. `pain T9`'s PrimeNG date cluster is one bug filed four times in 15 months ([#18676](https://github.com/primefaces/primeng/issues/18676), [#15684](https://github.com/primefaces/primeng/issues/15684), #14886, #14589) — all "the time part gets silently dropped" |
| 4.2 a broken filter widens | **new** — a "Break the notes filter" toggle that a custom `filter()` predicate throws on. The result set visibly **widens**, one console report per evaluation, every other filter keeps narrowing (ADR-0014 / R29). No peer documents an equivalent guarantee (`ux §7`), so this story is the only place the behavior exists to be seen |
| 4.3 stale persisted criterion | **new** — "Load a saved filter (stale shape)" twice: once as a raw `filters().reset(json)`, once behind a shape guard. Turns OQ-6's recommendation into something runnable |
| 4.4 filtered to nothing | **new** — a no-matches block keyed on `active()` non-empty **and** `totalRowCount() === 0`, plus an "Empty the data" button proving it is distinct from "no data exists" (the AG Grid / MUI X two-overlay split, `ux §7`). The host doc-comment names the stale-rows trap both libraries independently warn about ([ag-grid#3716](https://github.com/ag-grid/ag-grid/issues/3716), OQ-7) |

**Changed vs. the original plan**

| Row | Was | Now | Why |
|---|---|---|---|
| Control placement | "on-canvas controls", placement unspecified | Filter row under the header + toolbar search box | `ux §1`/`§4` — the two conventional positions, 3/4 and 4/4 respectively. The original invented no placement at all, which is how an invented one gets built |
| `inRange` / `inDateRange` | "amount min/max", "issued-at from/to" | Two bound inputs each, explicitly — number inputs and date inputs, not free-text | `ux §3` — unanimous where these exist. Was underspecified, not wrong |
| `hasAny` / `hasNone` | "tag multi-select", "tag exclude" | Multi-select **checkbox list with Select-All**, options hand-supplied and labelled as such | `ux §3` — the widget is convergent, the data-derivation is the non-goal (R11). The original didn't say which it was, and `ux §3` says a person can't tell by looking |
| 2.1 active-filter visibility | "a persistent chip row" | Active marker per input **plus** a summary row | **Invented affordance, replaced.** No peer renders a chip row. What MUI X actually ships is a × per constraint *inside the filter panel* (`ux §5`); what AG Grid/PrimeNG render is state on the input itself. Keeping only the chip row would have missed the affordance whose absence is an upvoted open regression |
| R25 debounce | On the `contains` box, in this story | **Moved to the server story** | `ux §4`: MUI X's only shipped debounce is on the quick filter, and `pain T9`'s MUI X debounce PR was explicitly "for async server-side filtering" — while PrimeNG #9581 (👍 19, 5 years open) asks for the *opposite*, instant filtering, in the client case. A debounce in a synchronous story has no visible consequence, which fails `stories.md`'s "which feature does this line serve" test |
| Quick-filter failure path | absent | New row — `anyOf` spans a null and a number | `pain T3`. A story showing a known failure mode handled is worth more than one showing only the happy path |
| Date-range bounds | absent | New row — same-day and time-of-day cases | `pain T9`'s four-times-filed PrimeNG date bug |

**New on-canvas controls:** six filter inputs in the filter row, toolbar search box, two
multi-selects, per-input active marker, summary row with per-entry ×, Reset-to-defaults,
Clear-all, Break-the-notes-filter, Load-saved-filter (raw / guarded), Empty-the-data.

### 2. `server-filtering/` — NEW — standalone: filters that produce the data

**Why standalone:** the server path is a different code path, not an argument — no client `filter`
stage runs and the rows arrive already narrowed. `stories.md` is explicit that a toggle between two
incompatible paths earns its own folder, because otherwise the host permanently carries a dead
branch. It is also the only place three product criteria can exist at all: 2.4's late-default race,
2.3's server-supplied total, and R25's debounce.

**Decision closed (was: "settle before building").** The host composes **no filtering feature at
all** — `createFilters()` alone, feeding the request. Settled by
[`research-filter-state-ownership.md`](../../../1-state/work/with-filtering/research-filter-state-ownership.md)'s
superseded-verdict banner, which records why the design moved: there is no table-owned filter
slice, `createFilters()` is a standalone consumer-held primitive, and that shape was **forced by
server-side mode, where the filters feed the request that produces the data** (R10/R11). `cov §1`
closes the other half: R23 keeps `withFiltering({ manual: true })` "for symmetry with
`withSorting`, though **redundant** under R10's server path". The code agrees — `manual: true` is
an identity pass-through that still claims the `filter` pipeline stage, so composing it here would
demo an empty stage claim and occupy a slot for nothing. `with-filtering.spec.ts`'s manual-mode
block stays valid as symmetry coverage; it is not the recommended server shape.

| Product story covered | Covered by |
|---|---|
| 1.1 / 1.2 in server mode | **new** — the same `createFilters()` object, serialized into `GET /api/invoices` from `filters().active()`. The declaration surface is identical; only what consumes it changes (R10). R16 means the query mapping is hand-written in the host — that *is* the shipped DX, so the story shows it rather than hiding it |
| R25 (§10) debounced filter input | **new**, moved here from story 1 — the search box bound through Signal Forms with `debounce(path, 300)`, same shape as `row-edit.schema.ts`'s `editRowsSchema`. With `latencyMs` on, the request count per keystroke is the visible difference. This is the one place debounce has a consequence, and the one shape a peer library ships (`ux §4`, MUI X `debounceMs`) |
| 2.3 match count (server half) | **new** — a tiny inline `createTableFeature` overrides `totalRowCount` with the response's `total`, which is the supported mechanism (ADR-0005 / `OverridableCoreKey`) rather than a story-local signal. Rendered next to `renderRows().length` so "the server's number, not an approximation from one page" is visible rather than asserted. `pain T5`'s MUI X [#7583](https://github.com/mui/mui-x/issues/7583) (👍 23) is exactly this reconciliation, still open |
| 2.4 late default must not stomp my value | **new** — the amount filter declares `source: () => serverDefaultRange()`; a `latencyMs` arg plus a "Deliver server default now" button lets a person type into the box *before* the default lands and watch `dirty()` block the overwrite (R19). This behavior is invisible unless raced on purpose, which is exactly why it needs a story |
| 4.4 zero matches in server mode | **new** — a `total: 0` response renders the same no-matches state, keyed on `active()` + `total === 0` |
| three states, visibly distinct | **new** — loading, no-matches, and request-failed are three different blocks, not one empty table. `ux §7` confirms all four peers support server filtering and **none** documents a loading affordance, so this extends the empty-state convergence to the async case rather than copying a convention |
| failure path | **new** — `forceFailure` → a `ForcedFailure` export: the request fails and the previously-loaded rows **stay on screen** behind an error marker rather than the table blanking, mirroring R29's "wider, never blank" instinct at the transport layer. Gets its own `## Forced failure` mdx section and an `@if (forceFailure())` branch in the host's hint paragraph, per `stories.md` |

**Changed vs. the original plan**

| Row | Was | Now | Why |
|---|---|---|---|
| Composition | Open decision: `manual: true` vs. compose nothing | **Closed: compose nothing** | `research-filter-state-ownership.md`'s banner (R10, forced by server mode) + `cov §1`'s R23 ("redundant under R10's server path") + `with-filtering.ts` being an identity pass-through that still claims the stage |
| R25 debounce | In story 1 | Here | See story 1's change table |
| Loading / no-match / failure | Folded into the 4.4 row as a parenthetical | Its own row | `ux §7` — no peer documents this, so it is a decision this story makes, not a detail it inherits |

**New on-canvas controls:** filter inputs (a subset of story 1's), debounced search box,
Deliver-server-default-now, Retry. Storybook args: `forceFailure`, `latencyMs`.

### 3. `selection-filtering/` — NEW — standalone: selection under an active filter

**Ownership (settled 2026-09-13):** the selection plan
([`../selection-stories/1-gap-analysis.md`](../selection-stories/1-gap-analysis.md)) independently
proposed a folder of the same name. **This plan owns it** — the story is only meaningful over a
fixture that can exercise real filters (six rule kinds, a nullable field, an array field), which is
`filter-demo.*`/`InvoiceRow`; the selection half adds only a checkbox column on top. Three rows
below are migrated from that draft and marked *(from the selection plan)*.

**Why standalone:** two features composed (`withFiltering()` + `withSelection()`), neither of which
any story touches today; `pain T1` is the largest single cluster in the whole corpus — 9 issues
across all four libraries, 2019 → 2026, every one of them having shipped the wrong default at least
once; and half of it is unbuilt, so the story doubles as an honest regression demo — the same shape
`sorting-editing/` uses for the unshipped row-hold. Bolting this onto story 1 would break
`stories.md`'s rule against adding a second feature to a single-feature story.

| Product story covered | Covered by |
|---|---|
| F-S1 bullet 1 — "select all" scopes to what I see | **new** — two buttons side by side: `selectAllIds(table)` (defaults to `rows()`, post-filter/post-sort — D59) and `selectAllIds(table, { includeHidden: true })`. Makes the scoping decision something you can see instead of a sentence. This is the literal bug in MUI X [#976](https://github.com/mui/mui-x/issues/976) (maintainer: "makes selection + filtering effectively useless when combined"), [#1141](https://github.com/mui/mui-x/issues/1141), [#1863](https://github.com/mui/mui-x/issues/1863) and AG Grid [#2139](https://github.com/ag-grid/ag-grid/issues/2139) (7 years old, still active 2025-06) |
| F-S1 bullet 1, header checkbox | **new** — a header select-all checkbox whose indeterminate state is scoped to the **visible** rows. TanStack [#4781](https://github.com/TanStack/table/issues/4781) (👍 11, still active 2026-08) is exactly this confusion: `getIsAllRowsSelected()` reporting true when only the current subset is selected |
| F-S1 bullet 2 — a hidden selection is retained and counted | **new**, and expected to **fail today** — select rows, then filter them out. `withSelection()` retains them, but no signal reports "M not currently visible". A `hiddenSelectionNotice` states that gap live, routed to [`work/computed-state-mechanism/1-intake.md`](../../../1-state/work/computed-state-mechanism/1-intake.md) and [`0-product/selection.md`](../../../0-product/selection.md) §2.5. It starts passing on its own once the signal ships — no story rework. **The host doc-comment names MUI X's opposite, documented behavior** — "selected rows that do not pass the filtering criteria are automatically deselected" (`ux §7`, the only peer position that exists) — so the reader sees that retention is a rejected convention, not an unconsidered default |
| F-S1 bullet 3 — clearing the filter restores the selection exactly | **new** — Clear all, then confirm nothing was added and nothing lost. TanStack [#2210](https://github.com/TanStack/table/issues/2210) (👍 13, `selectedFlatRows` empty after filtering) and MUI X [#14074](https://github.com/mui/mui-x/issues/14074) (selection lost across a filter change, still receiving reports 2026-05) are the failure this proves absent |
| F-S1 failure behavior | **new** — when the hidden count is unavailable, only the count display degrades; the selection itself is never reset as a side effect |
| §2.4 selection survives a **sort** *(from the selection plan)* | **new** — a sort toggle reorders rows; the selection is unchanged. Cheap to render once the filter surface exists, and it separates "the row moved" from "the row left the visible set" — two things the same count would otherwise conflate |
| §2.4 failure — only a **real removal** changes the selection *(from the selection plan)* | **new** — delete a row that is selected *and* currently filtered out; the count drops (D11), where filtering it out never did. The contrast is the point: retention and pruning are the same mechanism seen from two sides |
| §2.3 the tri-state **denominator** *(from the selection plan)* | **new** — the header checkbox reads `all` while selected-but-hidden rows exist, because `selectionStateOf(selectAllIds(table))`'s denominator is the visible set. Rendered deliberately: `ux §5` names this denominator question unanswered by **every** library researched, and MRT [PR #1499](https://github.com/KevinVandy/material-react-table/pull/1499) is open and unmerged. The story shows the state; the doc-comment names it open rather than pretending it is decided |

**Changed vs. the original plan**

| Row | Was | Now | Why |
|---|---|---|---|
| Header select-all checkbox | absent | New row, indeterminate state scoped to visible rows | `pain T1` / TanStack #4781 — the tri-state checkbox is the specific affordance people misread, and every peer renders one |
| MUI X contrast | absent | Named in the bullet-2 host doc-comment | `ux §7` — MUI X's auto-deselect is the *only* documented peer position, and ours is its opposite. A story that doesn't say so reads as if no one had considered it |
| Standalone rationale | "the product doc names F-S1 as the largest community-pain cluster" | Same, now cited to the 9 issues directly | The claim was correct; it was second-hand |

**New on-canvas controls:** header select-all checkbox (tri-state), Select all (visible), Select
all (including hidden), Clear selection, a sort toggle, a delete-row button, story 1's filter
inputs, the hidden-selection notice.

The two select-all buttons sit side by side as **co-equal, separately-named** controls — deliberately
TanStack's shape (`ux §1`: the only library exposing visible- and dataset-scope as two equally
first-class named functions rather than one flag with a chosen default), because the matrix says
there is no convergent default to inherit.

### 0. `filter-demo.*` — NEW — shared fixture cluster (not a story)

Lives one level up in `src/stories/`, split by concern, mirroring the `row-edit.*` set.

| File | Contents |
|---|---|
| `filter-demo.types.ts` | `InvoiceRow { id, customer, status, amount, issuedAt, tags, note }` — `id` numeric, `note` nullable, `tags` an array, so every shipped rule kind, §4.1's blank cell, and `pain T3`'s non-string quick-filter case all have somewhere to land |
| `filter-demo.mock.ts` | Fixture rows including blank `note`, empty `tags`, a same-day `issuedAt` pair and one carrying a time-of-day (`pain T9`'s date cluster); `STATUS_OPTIONS`, `TAG_OPTIONS` — **hand-supplied, not derived** (R11) |
| `filter-demo.filters.ts` | The `createFilters()` schema-body factories, one per story. Factories rather than module consts: `createFilters()` needs an injection context (R24) |
| `filter-demo.schema.ts` | All three `createTableSchema()` factories — client (`withFiltering`), server (**no filtering feature**), selection (`withFiltering` + `withSelection`) — plus the Signal Forms `filterFormSchema` carrying R25's `debounce(path, 300)`, the same way `row-edit.schema.ts` holds `editRowsSchema` alongside its table schemas |
| `filter-demo.handlers.ts` | MSW `GET /api/invoices` returning `{ rows, total }`, reading filter query params plus the same `x-force-failure` / `x-latency-ms` headers `row-edit.handlers.ts` uses |
| `filter-demo.http.ts` | `injectInvoiceApi()` — `HttpClient` wrapper, Observable-based, matching `row-edit.http.ts`'s transport decision |
| `filter-demo-story.css` | The filter-row layout (`ux §1`'s always-visible input row) and the active-marker / summary-row styling. New, and in the cluster rather than in any one story, because all three stories render a filter row — putting it in B would create a write-edge from C and D into a file B owns |

`row-edit-story.css` and `code-tabs.css` are reused unchanged.

**`EditRow` is deliberately not widened.** Adding number/date/array/nullable fields to it would put
a write-edge from this work into all nine existing row-edit hosts for no gain. `stories.md` already
treats shared fixtures as per-cluster; filtering is its own cluster.

---

## Build order — dependency graph

Re-validated against the revised story shapes. **The revision changed affordances inside nodes,
not the ranking:** no node added, no node removed, no edge added or removed. The two artifacts the
revision introduces (`filter-demo-story.css`, and `filterFormSchema` inside the existing
`filter-demo.schema.ts`) both land in node A, which is exactly A's purpose — everything more than
one of B/C/D touches ships up front so the three stay parallel-safe. Node E shrinks, because two of
its three facts fixed themselves when `status.md` was regenerated.

### Nodes

**A — `filter-demo.*` shared fixture cluster.** *core.*
`Depends on: nothing.` Blocks B, C and D. **A ships all three schema factories, all three
filters-declaration factories, the Signal Forms schema and the shared stylesheet up front**,
specifically so B/C/D stay parallel-safe — any of these added later by one story would be a
write-edge into a file another story already owns.

**B — `client-filtering/` story folder.** `Depends on: A.` `Parallel-safe with: C, D.`
Host + template + `.stories.ts` + `.mdx`. Single `Default` export, no MSW.

**C — `server-filtering/` story folder.** `Depends on: A.` `Parallel-safe with: B, D.`
`Default` + `ForcedFailure` exports, `## Forced failure` mdx section, branching hint paragraph.
Composes **no filtering feature** — the open decision is closed above, so this node no longer
carries one.

**D — `selection-filtering/` story folder.** `Depends on: A.` `Parallel-safe with: B, C.`
Ships complete without H; bullet 2 renders the honest-gap notice until H lands. **Owns the
`selection-filtering/` folder outright** (see the story section) — the selection plan's node E was
removed in favour of this one, so there is no shared file between the two plans and no edge back to
`selection.*`. Composes `withSorting()` as well, for the migrated sort-survival row; the schema
variant that needs it lives in `filter-demo.filters.ts`, inside node A.

This node is a **cross-plan blocker**: the selection plan's node I cannot flip its §1.4/§2.3/§2.4/
§2.5 marks until this story renders.

**E — `1-state/filters.md` frontmatter `code: none` → `code: shipped`, then regenerate
`docs/status.md` (`npm run table:status`).** *independent / leaf.*
`Depends on: nothing.` `Parallel-safe with: everything.` **Scope reduced by the research check:**
`cov §5`'s contradictions #2 and #3 have both resolved on their own — `status.md` has since been
regenerated, so the `filtering` row now reads `drilled | shipped` and a `filters` row now exists.
What remains is one wrong fact: `filters.md` declares `code: none` while `src/api/create-filters.ts`
and `src/api/filters/` ship, which makes the regenerated `filters` row wrong in its own way. (The
product doc's §9 opening note — "`status.md` has no row for `capability: filters` at all" — is now
stale and should be corrected by node F.)

**F — refresh `0-product/filtering.md`'s coverage marks, its §8.1 S3/S4 rows, OQ-1's status, and
§9's stale "no `filters` row in the registry" claim.** `Depends on: B, C, D.` The ✅/🟡 marks
cannot be re-derived until the stories exist. The stale *code-status* correction does not wait on
this — that is E.

**G — `3-ui/architecture.md` U5: the filtering row names `setColumnFilter()` /
`setGlobalFilter()`, which no longer exist.** *independent / leaf.*
`Depends on: nothing.` `Parallel-safe with: everything.` The underlying verdict ("ordinary form
inputs, Angular owns a11y") still holds — `cov §2b` reaches the same conclusion independently;
only the method names are wrong.

**H — the hidden-selection read-side count signal.** *external, unbuilt, parked.*
Owned by `1-state/work/computed-state-mechanism/`. **Not a blocker for D** — it is downstream of
it: when H ships, D's notice is deleted and bullet 2 flips to covered.

**I — `3-ui/stories.md`: add the `filter-demo.*` cluster to the shared-fixtures table and the three
new folders to Reference implementations.** `Depends on: B, C, D.` The conventions doc currently
documents exactly one fixture cluster and describes the story set as "the 8 stories in
src/stories/".

### Graph

```
                    ┌──────────────────────────────────┐
                    │ A · filter-demo.* fixtures       │  core
                    │   types · mock · filters ·       │
                    │   schema(+form) · handlers ·     │
                    │   http · story.css               │
                    └────────────────┬─────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
   │ B · client-        │ │ C · server-        │ │ D · selection-     │
   │     filtering/     │ │     filtering/     │ │     filtering/     │
   └──────────┬─────────┘ └──────────┬─────────┘ └──────────┬─────────┘
              └──────────────────────┼──────────────────────┘
                                     │  joined — F and I each need all three
                       ┌─────────────┴─────────────┐
                       ▼                           ▼
            ┌─────────────────────┐     ┌─────────────────────┐
            │ F · 0-product/      │     │ I · 3-ui/stories.md │
            │     filtering.md    │     │     fixtures table +│
            │     coverage marks  │     │     reference impls │
            └─────────────────────┘     └─────────────────────┘

   no blockers — start any time:
   ┌─────────────────────────────┐   ┌─────────────────────────────┐
   │ E · filters.md code: none   │   │ G · 3-ui/architecture.md U5 │
   │     → shipped + table:status│   │     stale method names      │
   └─────────────────────────────┘   └─────────────────────────────┘

   parked (external, never upstream):
   H · hidden-selection count signal · 1-state/work/computed-state-mechanism/
       D ──▶ ships without it;   H ──▶ later retires D's notice
```

`Parallel-safe: [B,C,D] after A; [E,G] immediately.`
`Dependency: A → [B,C,D] → [F,I].  H is downstream of D, never upstream.`

---

## Left out on purpose

| Item | Why not a story |
|---|---|
| 1.4 / §6 / OQ-3 runtime operator picker | Declined by R1, and defensible only because the library ships no filter UI. `ux §2`: 4 of 4 UI-bearing peers ship one free and there is **no precedent** for our position among libraries that render anything — which is why a story would present an unsupported pattern as first-class. It is a revisit trigger, not a mechanism |
| A filter menu / popover per column | 4/4 peers offer one, but always as the alternative to the inline row (`ux §1`). This library ships no column menu to hang it on; a story would invent chrome |
| A second filter on the same path (3.3's literal reading) | R5 makes it throw at construction. Only the compound-`filter()` workaround is demoed (story 1); a story of the throw would demonstrate a guard, not a capability |
| Cross-column AND/OR toggle | MUI X Pro only (`ux §6`); every other peer treats cross-column as fixed AND, as we do. Nothing to demonstrate that `anyOf` doesn't already cover |
| `applyWhen()` conditional activation | Ships, is exported, is spec-tested — and **no product story owns it**. `cov §1` tags R15 product-visible ("sub-category only after category is chosen"), which makes the product-doc gap sharper, not smaller. Route back to `0-product/filtering.md` first; storying it now would invent its acceptance criteria |
| F-G1 / F-G2 grouping under a filter, and grouping's OQ-1 (collapsed-group checkbox) | Owned by [`grouping.md`](../../../0-product/grouping.md), not filtering. `withGrouping()` ships but has **no baseline story** — a cross-feature story ahead of its own baseline is backwards. `pain T4` (sub-rows vanishing under a filter, re-filed two TanStack versions apart) says this seam deserves a story *once grouping has one* |
| F-P1 page total under a filter | `withPagination()` does not exist. Structurally guaranteed by `PIPELINE_ORDER` today; `ux §7` marks the same guarantee "inferred, not verified" for every peer, so it is worth a test when pagination ships, not a story |
| U4 screen-reader announcement of filter-state changes | Accepted cost already recorded at `3-ui/work/core-directives/2-decisions.md:91`. Filtering inherits it; it does not create it. `ux` explicitly did not research a11y of any peer filter UI, so there is no convention to copy either |
| §9.3 set-filter / data-derived distinct values | Structurally impossible — `createFilters()` takes no `data` argument (R11). The multi-select widget *is* demoed; only the derivation isn't, and the host says so |
| Filter-input-as-editor keyboard conflict (U6) | `pain T6` (PrimeNG #17128 open, #14567/#14556 re-reported; MUI X #16206) is real, but no such widget exists in this library and none of the three stories creates one. Flagged for whoever builds an editable-select editor, not storied here |
| Built-in persistence / URL sync | R21, and `pain T8` reads the whole industry as settled the same way — the library gives you a serializable model, the app does the saving. Story 1 demos the consumer-owned load path and its guard; nothing more is ours to show |
| Widening `EditRow` with number/date/array/nullable fields | Would create a write-edge from node A into all nine existing row-edit hosts. Filtering gets its own fixture cluster instead |
| §10 items (rules-vs-matchers file split, injection context, `manual` symmetry, row-id exemption) | Integrating-developer concerns with no on-screen form, by the product doc's own classification. The one exception, R25's debounce, is folded into story 2 (moved there from story 1 — see that story's change table) |

---

## Summary: 3 new stories + 1 fixture cluster

| Story | Status | Standalone reason |
|---|---|---|
| `filter-demo.*` | **new** (shared fixtures) | — not a story; the graph's core node |
| `client-filtering/` | **new** | — baseline: the whole declaration surface, in the conventional filter-row + toolbar layout, plus every §4 failure path in one place |
| `server-filtering/` | **new** | Incompatible code path, not an arg (`stories.md`'s separate-folder rule); composes no filtering feature (R10/R23, closed above); the only home for 2.4's late-default race, the server-supplied total, and R25's debounce |
| `selection-filtering/` | **new** | Two features composed, neither storied today; `pain T1` is the corpus's largest cluster (9 issues, 4 libraries, 2019→2026) and this library's retain-and-flag position is the deliberate opposite of the only documented peer behavior |
| the 9 existing stories | unchanged | None composes `withFiltering()` or reads `createFilters()`; nothing to extend, nothing to merge |

Net change: 9 existing files stay untouched, plus 3 new story folders and one shared fixture
cluster. **Existing 0 · extend 0 · new 3 · merge 0.**
