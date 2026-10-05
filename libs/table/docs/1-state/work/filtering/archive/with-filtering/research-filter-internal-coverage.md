---
title: Research — internal coverage audit for filtering (N3)
type: research
status: complete
date: 2026-09-10
audience: product (story-discovery), developers
---

# Filtering — internal coverage audit

Read-only audit feeding the product user-stories pass for filtering. Does not restate the
settled spec ([filters.md](../../../../filters.md), [features/filtering.md](../../../../features/filtering.md))
or the decision log ([design-options-hybrid-api.md](design-options-hybrid-api.md), R1–R31) —
those are linked, not duplicated, below.

## 1. Every settled decision from R1–R31, tagged product-visible / internal-only

| #   | Decision (one line)                                                                                                           | Tag                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | No runtime operator picker — operators fixed at declaration, end user changes values only                                     | **product-visible** — no `[contains ▾]` dropdown UI, ever, in the shipped design                                                                                                                                    |
| R2  | A criterion may be a compound object (`{min,max}`, `{from,to}`); a range is one filter, not two                               | internal-only — model shape, not observable behavior                                                                                                                                                                |
| R3  | A filter declares a key and a read path; 1:1 by default                                                                       | internal-only                                                                                                                                                                                                       |
| R4  | Global search is the many-paths case of the same mechanism (superseded in syntax by R8)                                       | internal-only (historical)                                                                                                                                                                                          |
| R5  | One filter per path; a duplicate throws at construction                                                                       | **product-visible** indirectly — dev-facing error, but shapes what a consumer _can_ offer (no two independent operators on one column out of the box)                                                               |
| R6  | No `{ as }` escape hatch for a second filter on one path; combine via one predicate over a compound criterion                 | **product-visible** — include/exclude-style UI on one column costs a custom predicate; nothing shipped for it                                                                                                       |
| R7  | Named rules + one general rule (`filter`), matchers exported separately                                                       | internal-only                                                                                                                                                                                                       |
| R8  | `anyOf(key, schema)` — one criterion, many paths, OR'd; across filters, AND                                                   | **product-visible** — this is the combination semantics the end user experiences (global search hits several columns; multiple column filters narrow together)                                                      |
| R9  | Key from path when singular; named positionally for a group                                                                   | internal-only                                                                                                                                                                                                       |
| R10 | `createFilters()` is standalone, not inside `withFiltering()` — forced by server mode                                         | **product-visible** consequence — in server mode there is no client-side table filter feature composed at all; the request itself changes                                                                           |
| R11 | `createFilters` takes no `data` argument, `TRow` only; no data-derived filter options                                         | **product-visible** — set-filter dropdowns (AG Grid style, values from the loaded data) are not a capability; consumer must supply their own options                                                                |
| R12 | `ColumnDef.filterFn` / `enableFiltering` deleted; predicates live in the schema                                               | internal-only (API surface), but see §5 — this is a **breaking change**, not yet executed                                                                                                                           |
| R13 | Issue #6 left untouched until spec time; ~7/12 of its requirements contradicted                                               | internal-only (process)                                                                                                                                                                                             |
| R14 | `value()` (complete) vs `active()` (empties omitted); empty criteria skip their predicate, per-predicate emptiness            | **product-visible** — "N filters applied" chips, URL params, and what counts as "cleared" all derive from this                                                                                                      |
| R15 | `applyWhen()` — conditional filter activation                                                                                 | **product-visible** — enables dependent filters (e.g. sub-category only after category is chosen); nothing ships this today (see §6, no code)                                                                       |
| R16 | No per-filter `encode`; consumer maps `active()` to their own query shape                                                     | internal-only — but consequence is product-visible: server filtering DX is "bring your own query mapper," not a shipped adapter                                                                                     |
| R17 | One `reset(value?)`: no-arg → source, `null` → empty, value → arbitrary. `clear()` doesn't exist                              | **product-visible** — "Clear filters" behavior is reset-to-source, not reset-to-blank, when a source exists. A consumer expecting AG-Grid-style "clear means empty" must call `reset(null)` explicitly              |
| R18 | `filters().value` is a real `WritableSignal`; a Signal Form can wrap it with no adapter                                       | internal-only (DX), enables product-visible things (debounce, validation) per R25                                                                                                                                   |
| R19 | `dirty` gates source reconciliation — a written value blocks a late server default from overwriting it                        | **product-visible** — directly the "my typed value must not get clobbered when the server default arrives late" behavior a user would notice                                                                        |
| R20 | Every filter node is callable for state, navigable for children (Signal Forms shape)                                          | internal-only                                                                                                                                                                                                       |
| R21 | No shipped persistence/storage adapter; consumer's own `JSON.stringify` + `reset(value)`                                      | **product-visible** consequence — "filters survive a reload" is not free; if a team doesn't wire it, filters reset on every page load                                                                               |
| R22 | `state-persistence.md`'s filter slice conflicts with R10, re-scoped to a future persistence feature                           | internal-only (see §5)                                                                                                                                                                                              |
| R23 | `withFiltering({ manual: true })` kept for symmetry with `withSorting`, though redundant under R10's server path              | internal-only                                                                                                                                                                                                       |
| R24 | `createFilters(schema, { injector? })`, mirrors `createTable`/`form()`                                                        | internal-only                                                                                                                                                                                                       |
| R25 | No built-in debounce; debounce via Signal Forms' `debounce()` over the model                                                  | **product-visible** consequence — a consumer not using Signal Forms must debounce their own input signal or every keystroke triggers a server request (server mode) or a full re-filter (client mode)               |
| R26 | Superseded `with-filtering.ts` stays on disk until `createFilters()` lands; removal is a planned `feat!`/breaking-change step | internal-only (process), but the _interim state_ is product-visible: today's shipped filtering UX is the old imperative shape, not the spec'd one (see §4)                                                          |
| R27 | Null/undefined cells fail every positive matcher, pass every negative one (`hasNone`); guarded in matchers, not the runner    | **product-visible** — directly determines what a user sees for blank cells under each filter kind (e.g. a row with no tags is excluded by `hasAny(tags)` but included by `hasNone(tags)`)                           |
| R28 | `toggle()` dropped; a boolean column uses `equals()`                                                                          | **product-visible** — a boolean/checkbox filter's "off" state is `null` (filter inactive), not `false` (show unarchived); no separate semantics for "show archived only" vs "filter off" beyond what `equals` gives |
| R29 | A throwing predicate deactivates that filter for the evaluation; never takes the table down. Per ADR-0014                     | **product-visible** — a bad/stale criterion degrades to "that filter silently stops narrowing" rather than a blank screen; the row set widens, not narrows, on failure                                              |
| R30 | Rules keep bare verbs (`equals`); matchers get `is*`/`has*` prefixes (`isEqual`)                                              | internal-only                                                                                                                                                                                                       |
| R31 | `as` overrides a borrowed key; does not license a second filter on one path (R6 upheld)                                       | **product-visible** — lets the same UI/URL vocabulary (`?due=`) diverge from the model's field name (`dueDate`), a purely cosmetic but user-facing surface (URLs, persisted keys)                                   |

**Summary for the product pass:** the highest-leverage product-visible decisions are R8 (AND/OR
combination), R10/R11 (server mode has no client-side filter feature and no data-derived
options), R14 (`value()` vs `active()` — what "N filters applied" means), R17 (reset-to-source,
not reset-to-empty), R19 (typed value beats a late server default), R21/R25 (no persistence, no
debounce — both are consumer-build-it-yourself), R27 (null-cell behavior differs by
positive/negative matcher), R28 (boolean filter has no third "show unarchived only" state beyond
what `equals` gives), R29 (a broken filter widens the result set instead of blanking the table).

## 2. Filtering stories that already exist elsewhere in the docs

All of these are **owned by filtering** per their own headers even though they live in another
feature's doc, per the docs-by-responsibility convention. Link to them; do not restate them in
the new product doc.

| Story                                                                                                                                                                                             | File:line                                       | Currently filed under                                         | Status marked there                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-1** — "My own edit must not make the row vanish" (a row edited out of the active filter stays visible, flagged, until the filter next changes; same rule for a newly added non-matching row)  | `docs/0-product/row-editing.md:644-660`         | row-editing, "Owned by filtering _(unbuilt)_" section         | ❌ not covered (forward-looking)                                                                                                                                                                                                                         |
| D25 — the retention-with-flag rule F-1 depends on (state layer already decided it)                                                                                                                | `docs/0-product/row-editing.md:791` (cross-ref) | row-editing                                                   | referenced, not restated                                                                                                                                                                                                                                 |
| Undo restoring a row into an active filter that no longer matches it — same retention rule as D25                                                                                                 | `docs/0-product/row-editing.md:458-460`         | row-editing, §Undo delete                                     | 🟡 partial — this specific sub-case ("filtered-position handling") explicitly called out as still missing at `row-editing.md:486`                                                                                                                        |
| A validation error on a filtered-out row must never silently block "save all"                                                                                                                     | `docs/0-product/row-editing.md:720`             | row-editing                                                   | mentioned, not a dedicated story                                                                                                                                                                                                                         |
| **F-G1** — "Filtering a grouped table" (counts/summaries computed over surviving rows; an empty group disappears rather than rendering empty; clearing the filter restores groups + expand state) | `docs/0-product/grouping.md:667-685`            | grouping, "Owned by filtering _(built, uncommitted)_" section | ❌ not covered (forward-looking); design status: **structurally covered** — `filter` precedes `group` in `PIPELINE_ORDER`, `filtering.md:66-67` already resolved the aggregation half                                                                    |
| **F-G2** — "Filtering by a group's summary" (a filter on the group's aggregate, not the rows — e.g. "campaigns whose total is over a threshold")                                                  | `docs/0-product/grouping.md:687-697`            | grouping, same section                                        | ❌ not covered; **explicitly deliberately out of scope for a first release**, but the aggregation contract must not make it impossible later. Only prior art (AG Grid `groupAggFiltering`) has two documented caveats; MUI X has this as an open request |
| Ticking a collapsed group under an active filter selects what the visible count implies (filtered descendants), not the whole unfiltered group                                                    | `docs/0-product/grouping.md:607, 820-826`       | grouping/selection intersection                               | "to decide" — recommendation given (select filtered descendants) but not settled                                                                                                                                                                         |

Not found as dedicated stories anywhere (checked column-pinning.md, column-sizing.md,
expansion.md, pagination.md, selection.md — see §2a): filtering × column-pinning interaction,
filtering × column-sizing, filtering × pagination (beyond the generic "phantom" mentions in §2b),
filtering × selection beyond the grouping-selection note above.

### 2a. Passing filter-adjacent mentions in other feature specs (not full stories, but relevant)

| Mention                                                                                                                                                                                                                                | File:line                                            | Nature                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `withSelection()` deliberately has **no** dependency on `withFiltering()` — every selection write names its own ids, refusing the "select all" scope ambiguity rather than resolving it against filtered/paginated state               | `docs/1-state/features/selection.md:17-22`           | Architectural non-dependency, product-relevant: "select all" cannot silently mean "select all filtered rows" — a consumer must compute that themselves |
| Column-pinning's region computeds "filter by `visible`" — unrelated `Array.filter`, not the filtering feature                                                                                                                          | `docs/1-state/features/column-pinning.md:66-75`      | False positive — not a filtering story                                                                                                                 |
| Column-sizing: "let both features filter lazily on read" — unresolved shared question, again `Array.filter`/visibility, not the filtering feature                                                                                      | `docs/1-state/features/column-sizing.md:149`         | False positive                                                                                                                                         |
| Expansion: no filtering interaction found beyond generic pipeline-order mentions elsewhere                                                                                                                                             | `docs/1-state/features/expansion.md`                 | none found                                                                                                                                             |
| Pagination: "missing" stub; no filtering-specific content yet (pagination itself has no code)                                                                                                                                          | `docs/1-state/features/pagination.md:27`             | none found                                                                                                                                             |
| Row-editing state spec: "snapshot feature anyway for columns/sort/filters" and "stale-id validation for columns/sort/filters" — both about the _future shared persistence feature_ (R21/R22), not row-editing's own filter interaction | `docs/1-state/features/row-editing.md:186, 259, 267` | Persistence cross-reference, not a row-editing↔filtering story                                                                                        |

### 2b. UI-layer and ADR mentions

| Mention                                                                                                                                                                                                          | File:line                                                | Note                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Decided to have no UI layer: filtering" — filter controls are ordinary form inputs calling `setColumnFilter()`/`setGlobalFilter()`; no `ngpTableFilterInput` directive; Angular forms already own accessibility | `docs/3-ui/architecture.md:23,55,121`                    | **Stale** — names the superseded imperative API. Under `createFilters()` + Signal Forms (R18), the "ordinary form input" reasoning still holds, but the specific methods named no longer will once R26's removal lands. Should be re-checked when the UI architecture doc is next touched — not fixed here |
| Accessibility: "a single sort/filter/page action can change many cell values in one tick — per-cell live regions would drown out the meaningful change"; "sorting/filtering does not warrant `grid`"             | `docs/3-ui/cross-cutting/accessibility.md:57,76`         | Accessibility constraint that will bind whatever UI is eventually built over `createFilters()` — genuinely still applicable, not stale                                                                                                                                                                     |
| `aria-live` status-message ownership deferred; "sort/filter/page state changes are not announced to screen readers" — accepted cost, "revisit before any user-facing ship"                                       | `docs/3-ui/work/core-directives/2-decisions.md:91`       | Live gap for the product/a11y pass                                                                                                                                                                                                                                                                         |
| G11 — "a chip or muted styling so the user can tell why an out-of-filter row is showing" (the UI-side of F-1/D25)                                                                                                | `docs/3-ui/work/row-editing/5-gaps.md:96-98,144,175,187` | Explicitly marked **phantom** — "`withFiltering()` does not exist [in the new shape]; do not build from these notes, re-derive when the feature is designed"                                                                                                                                               |
| O17 — `applyEach` validates rows the user cannot see (filtered out / other pages); how are "submit" and "save all" scoped?                                                                                       | `docs/3-ui/work/row-editing/5-gaps.md:141`               | Marked phantom until filtering/pagination exist; directly related to the row-editing.md:720 mention above                                                                                                                                                                                                  |

## 3. What shipped code gives filtering "for free," and what it does not

**For free, already in the engine (not filtering-specific work):**

- **Pipeline ordering.** `PIPELINE_ORDER = ['filter', 'group', 'sort', 'expand']`
  (`engine/pipeline.ts`) already runs `filter` first, unconditionally, regardless of which
  features are composed. This is what makes F-G1 (grouping) "structurally covered" without any
  filtering-specific grouping code, and it means `aggregateFn`/`sortFn`/expansion all see
  already-filtered rows automatically — no filtering-specific wiring bought that.
- **ADR-0014's runtime error policy.** The per-callback-degrades / construction-throws split is a
  library-wide policy, not filtering-specific — filtering was merely the feature whose grill
  (R27/R29) surfaced the gap and forced the ADR into existence. `sortFn`/`accessor`/`aggregateFn`
  are still **unguarded** pending a retrofit (ADR-0014 Consequences, and `CLAUDE.md`'s error
  section: "not enforced by types... absence of a wrap in existing code is not precedent").
  Filtering gets the policy on day one because `createFilters()` is unwritten; the rest of the
  library does not yet have it applied.
- **`ColumnsPath<TRow>` proxy** (`schema/column-schema.ts`) — already implemented, reused
  directly by `createFilters()`'s schema for compile-checked paths. Not new engineering for
  filtering.
- **`SlotRegistry` single-occupancy pattern** (`engine/slots.ts`) — the mechanism R5's "duplicate
  filter on one path throws" borrows from, already proven for pipeline stages and member keys.

**Not free / filtering must build its own:**

- **ADR-0006's row-id reconciliation obligation does not apply.** Filtering holds no `RowId`s —
  criteria are keyed by filter key (`status`, `amount`, `search`), not by row. `createFilters()`
  is exempt from `onRowsRemoved` by construction, not by an explicit exemption grant; confirmed
  by inspecting `docs/adr/0006-row-id-state-reconciliation.md`'s feature table (only
  `withExpansion`, `withRowEdit`, `withSelection` store `RowId`-keyed state).
- **`WritableView`** (`engine/writable-view.ts`) is reused conceptually (R18's model-as-signal
  shape mirrors it) but `createFilters()` is a standalone primitive outside the table entirely
  (R10) — it does not compose through `engine/core.ts` or `engine/compose-table.ts` at all in
  server mode, and only through the thin `withFiltering()` adapter's `stages: { filter }` claim in
  client mode.
- **The render-stage chain (ADR-0011) is irrelevant to filtering** — filtering is a `PipelineStages`
  (`TRow[] → TRow[]`) participant, not a `RenderStages` (`RenderRow[] → RenderRow[]`) one. It
  claims the `filter` pipeline stage only, never a render stage, so none of ADR-0011's
  multi-claim-chain work benefits or blocks it.
- **No persistence mechanism exists to reuse.** R21 defers a shared persistence feature (for
  sort/columns/filters together) as future work; filtering gets nothing from it today, and
  `state-persistence.md`'s existing (superseded) filter slice cannot be repurposed (§5).
- **No debounce mechanism to reuse** — R25 routes debounce through Signal Forms' `debounce()`,
  which `createFilters()` does not itself provide or depend on; a consumer not using Signal Forms
  has literally nothing shipped to reach for.

## 4. Real demo/story coverage — plainly stated

**No Storybook story exercises table filtering at all, in either the old or the new shape.**

Verified by reading every `*-story-host.component.ts` file under `src/stories/` (`live-optimistic`,
`gated-bulk-optimistic`, `gated-multiple-optimistic`, `gated-single-optimistic`,
`gated-single-pessimistic`, `external-write`, `form-write-mutations`, `sorting-editing`,
`live-table`) — none imports or composes `withFiltering()`, none calls `setColumnFilter` /
`setGlobalFilter` / `clearFilters`, none reads `columnFilters` / `globalFilter`. The only
occurrences of the string "filter" in any story host are plain `Array.prototype.filter()` calls
unrelated to the table feature (id/field diffing, disabled-element filtering) — confirmed line by
line in `live-optimistic-story-host.component.ts:232-233`,
`gated-bulk-optimistic-story-host.component.ts:99`,
`gated-multiple-optimistic-story-host.component.ts:236`,
`external-write-story-host.component.ts:132`, `form-write-mutations-story-host.component.ts:91`,
`row-edit.utils.ts:28`, `external-write.utils.ts:9`.

There is no `filtering/` story folder at all (compare `sorting-editing/`, `live-table/`, etc.). The
`docs/3-ui/architecture.md:23` "no UI layer for filtering" decision (filter controls are ordinary
form inputs, no dedicated directive) is consistent with there being no story — but it also means
nothing in Storybook demonstrates the currently-shipped imperative API, let alone the unbuilt
`createFilters()` one. Filtering's competitive-verdict block in `features/filtering.md:151-159`
independently confirms this: "**Verdict: still missing** ... the baseline gap is not closed."

This matches the `story-plan` skill's territory (comparing product stories against actual story
host code) — flagging for the product pass that any coverage marks (✅/🟡/❌) attached to
filtering user stories should default to ❌ for "does a demo exist" until `createFilters()` +
`withFiltering()` v2 ship and a story is built.

## 5. Contradictions between newer and older docs

| #   | Contradiction                                                                                                                                                                                                                                                                                                                                                                                             | Where                                                                                                                                                                                           | Resolution status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `state-persistence.md`'s `LayoutSnapshot.filters?: { columnFilters: FilterRule[]; globalFilter: string }` shape assumes the table owns a filter slice it can snapshot                                                                                                                                                                                                                                     | `docs/1-state/state-persistence.md` vs. `filters.md:392-396` (R22)                                                                                                                              | **Already flagged by the spec itself.** Under R10 the table cannot populate that slice (filters live outside the table entirely in the new design), and the shape is separately superseded by R12's deletion of `FilterRule`. Explicitly deferred to a future, not-yet-designed shared persistence feature — not fixed here, per instructions                                                                                                                                                                                                                                          |
| 2   | `docs/status.md`'s `filtering` row reads `spec: drafted, code: partial`                                                                                                                                                                                                                                                                                                                                   | `docs/status.md:22` vs. `docs/1-state/features/filtering.md` frontmatter (`spec: drilled, code: partial`, version 2.0, dated 2026-09-10)                                                        | **Stale — generator hasn't been rerun.** `filtering.md` was rewritten to v2.0 (drilled) today; `status.md` still reflects a pre-rewrite `drafted` value. Confirmed generated, not hand-edited (`tools/generate-status.ts`) — fix is `npm run table:status`, not a doc edit                                                                                                                                                                                                                                                                                                             |
| 3   | `docs/status.md` has **no row at all for `capability: filters`**                                                                                                                                                                                                                                                                                                                                          | `docs/status.md` (full table, §16-31) vs. `filters.md` frontmatter (`capability: filters`) and `tools/generate-status.ts:20-23` (`CROSS_FEATURE_FILES` already lists `docs/1-state/filters.md`) | **Bigger than #3 — an entire capability is invisible in the generated registry.** The generator script is already wired to read `filters.md` (it's in the `CROSS_FEATURE_FILES` array), so this is not a missing-config problem — `status.md` simply predates `filters.md`'s creation (`filters.md` is untracked/new per git status) and has not been regenerated since. Until `npm run table:status` runs, anyone reading `status.md` alone would not know `createFilters()` is spec'd at all — they'd see only the `filtering` row and reasonably assume that's the whole capability |
| 4   | `docs/3-ui/architecture.md:23,55` describes filtering's "no UI layer" decision entirely in terms of the superseded imperative API (`setColumnFilter()` / `setGlobalFilter()`)                                                                                                                                                                                                                             | `docs/3-ui/architecture.md` vs. `filters.md`/`features/filtering.md` (createFilters + Signal Forms)                                                                                             | **Not self-flagged anywhere.** New contradiction found in this audit. The underlying UI verdict (ordinary form inputs, no dedicated directive, Angular owns a11y) likely still holds under R18 (a Signal Form wraps `filters().value` directly), but the doc names methods that will not exist once R26's removal lands. Recommend re-checking `architecture.md`'s filtering section when the UI layer doc is next touched — flagging only, not fixing                                                                                                                                 |
| 5   | `docs/3-ui/work/row-editing/5-gaps.md` (G11, O17) and `docs/0-product/row-editing.md` (F-1) both describe the same retention-with-flag story but were last touched when `withFiltering()` didn't exist at all; both are explicitly marked **phantom**, consistent with each other — not a contradiction, but worth the product pass knowing both exist and should be resolved together, not independently | `docs/3-ui/work/row-editing/5-gaps.md:96-98` and `docs/0-product/row-editing.md:644-660`                                                                                                        | Consistent, not contradictory — noted so the product doc doesn't accidentally treat them as two different open questions                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## 6. The "Deliberately not shipped" table — 9 items, as live gap candidates

Verbatim from `filters.md`'s "Deliberately not shipped" section (also in
`design-options-hybrid-api.md`'s consolidated design). Each is a candidate the product pass must
weigh against community/competitive evidence — the design has consciously declined each, but
"consciously declined" is not the same as "no one will ask for it."

1. **Runtime operator picker** (AG Grid/PrimeNG-style column filter menu — `[contains ▾] [text]`)
   — instead, operators are fixed at declaration (R1). A consumer wanting a user-selectable
   operator must build it themselves by putting the operator inside the criterion value (the
   `{ op, text }` pattern shown in `research-generic-filter-utilities.md` Finding 7) — no library
   surface for it.
2. **A second filter on one path** (`as` renames a key, it does not license a duplicate — R6,
   R31) — instead, one predicate over a compound criterion (e.g. include/exclude tags in one
   `filter()` call). Flagged in the design doc itself as "the strongest case found" for the
   rejected escape hatch — include/exclude is called out as "a genuinely common pattern."
3. **`toggle()`** for boolean columns (R28) — instead, `equals()` over a boolean column, with
   `null` meaning "filter off" rather than a distinct "show unarchived only" semantic.
4. **`ColumnDef.filterFn` / `enableFiltering`** (R12) — being actively removed as a breaking
   change (not yet executed — see §5 items and R26).
5. **Per-filter `encode` for server params** (R16) — instead, the consumer maps `active()` to
   their own query shape by hand, per table.
6. **Debounce** (R25) — instead, Signal Forms' `debounce()` over the model; no shipped mechanism
   for a consumer not using Signal Forms.
7. **Persistence / storage adapter** (R21) — instead, the consumer's own `JSON.stringify` +
   `reset(value)`; no versioning, migration, or `Date`-revival help shipped. A future shared
   persistence feature is only proposed, not designed.
8. **Data-derived filter options** (AG-Grid-style "set filters" whose dropdown values come from
   the distinct values in the loaded rows) (R11) — instead, the consumer computes their own
   options from their own data. Explicitly impossible to fully restore in server mode (rows arrive
   already filtered), so this is a structural gap, not just an unshipped convenience.
9. **Any null/empty-cell option** (`matchEmpty`, `cell:` normalizer, `isBlank()`/`isPresent()`
   rules, `orEmpty()`/`onlyEmpty()` combinators) (R27) — instead, one fixed internal policy
   (positive matchers fail on null, negative ones pass) with `filter()` as the escape hatch for
   anything else. The design doc records that four alternatives were "prototyped and deferred, not
   rejected on merit," and that `isBlank()`/`isPresent()` is "the one case a user actually raised."

---

**Sources consulted in full:** `filters.md`, `features/filtering.md`,
`design-options-hybrid-api.md` (complete, both halves), `research-filter-state-ownership.md`,
`research-generic-filter-utilities.md`, `state.json`, `docs/0-product/row-editing.md`,
`docs/0-product/grouping.md`, `docs/0-product/performance.md`, all seven
`docs/1-state/features/*.md` cross-checked for "filter", `docs/3-ui/architecture.md`,
`docs/3-ui/cross-cutting/accessibility.md`, `docs/3-ui/directives/columns.md`,
`docs/3-ui/directives/sort.md`, `docs/3-ui/work/core-directives/2-decisions.md`,
`docs/3-ui/work/row-editing/5-gaps.md`, ADR-0006, ADR-0011, ADR-0012, ADR-0014, `docs/status.md`,
`tools/generate-status.ts`, `src/api/features/with-filtering.ts` (+ its `.spec.ts` existence
confirmed), `src/api/types.ts`, `src/index.ts`, and every story host under `src/stories/`.
