---
title: Migration — decouple createFilters() from withFiltering()
type: plan
date: 2026-09-14
status: in progress — S1 (#68) and S2 (#69) shipped; S3a/S3b/S4/S5/S6 outstanding and now
  merged into R47's ranking
---

# Migration: make each side standalone

> **Sequencing superseded by R47** in
> [design-options-hybrid-api.md](design-options-hybrid-api.md#sync-with-the-decoupling-migration-2026-09-14).
> S3a and S3b rewrite the same call sites the inferred-`TState` re-grill (R34–R46) rewrites, so
> the two plans were merged into one ranking rather than run in sequence. The step contents below
> stand; read R47 for the order.

Target contract, restated:

```ts
// table side — imports nothing from the filters closure
export interface WithFilteringConfig<TRow> {
  /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}

// filters side — knows nothing about tables
withFiltering({ predicates: () => [this.filters().matcher()] });
```

## Dependency graph

```
S1 matcher() on the root ──┬──> S3a specs   ──┐
                           │                  ├──> S4 move to src/filters/ ──> S6 barrel split
S2 predicates config ──────┼──> S3b stories ──┘
                           │
                           └──> S5 docs + ADR-0016
```

Parallel-safe: `[S1, S2]`, then `[S3a, S3b, S5]`.
Dependency chain: `S1,S2 → S3 → S4 → S6`.

---

## S1 — `matcher()` on the filters root — ✅ shipped (#68, `fded966`)

**Depends on:** nothing. **Parallel-safe with:** S2.
**Files:** `api/filters.types.ts`, `api/filters/evaluator.ts`, `api/filters/state.ts`,
`api/create-filters.ts`.

- Thread `TRow` into `FiltersRoot` → `FiltersRoot<TRow, TState>`, add
  `matcher(): (row: TRow) => boolean`.
- Implement in `create-filters.ts`, closing over the `internal` object already in scope at the
  end of the factory.
- **Delete the side channel:** `FILTERS_INTERNAL`, `attachFiltersInternal`,
  `getFiltersInternal`. `createFilterEvaluator` takes `FiltersInternal<TRow>` directly and stays
  file-internal.
- ADR-0014's per-filter dedup stays exactly where it is — inside the evaluator, where the keys
  exist. Unchanged behavior.

**Deliberate side effect — flag before starting.** `TRow` on `Filters<TRow, TState>` is
currently **phantom**; `matcher()` consumes it, so `Filters<OtherRow>` starts being rejected.
`with-filtering.spec.ts:256` asserts the current (permissive) behavior and **flips**. That is a
fix, not a regression — but it is a public-type behavior change and belongs in the ADR.

> **Done.** The assertion flipped and now lives at `with-filtering.spec.ts:458` ("a matcher over
> `OtherRow` cannot stand in for one over `Row`"), with a second at `create-filters.spec.ts:711`.
> This is what makes **R43 obsolete** — build no phantom brand member.

Why a method on the root rather than a property on the callable: `Filters` is a mapped type over
`keyof TState`, so a top-level `matcher` key would collide with a filter literally named
`matcher`. The root is already a plain interface.

## S2 — `withFiltering` takes `predicates` — ⚠️ shipped partially (#69, `8184df5`)

**Depends on:** nothing. **Parallel-safe with:** S1.
**Files:** `api/features/with-filtering.ts`, `index.ts`.

> **Shipped with a deliberate divergence — the first two bullets below did not happen.**
> `predicates` was **added** beside `filters` rather than replacing it, both fields optional:
> "either input alone is enough; supplying both ANDs the filter model with the predicate terms."
> So `createFilterEvaluator` and `type Filters` are still imported, and the `TState` generic is
> still on the interface and both overloads — meaning the two call-site landmines and
> [#56](https://github.com/DvirMon/ng-table/issues/56) are still live.
>
> **Resolved by [R48](design-options-hybrid-api.md#r48) — finish the step as written.** `filters`
> leaves the config, `predicates` becomes required, both imports and the `TState` generic delete,
> and #56 closes as fixed-by-design. Hard-blocks R47's call-site pass, since every `withFiltering`
> site changes shape.
>
> The third and fourth bullets shipped as written.

- Replace `filters: Filters<TRow, TState>` with `predicates`.
- **Delete both imports** (`createFilterEvaluator`, `type Filters`) — the stated requirement.
- **Delete the `TState` generic** from the interface and both overloads. This removes the two
  documented call-site landmines (`TState` must be a `type` not an `interface`; never pass `In`
  explicitly) and **obsoletes [#56](https://github.com/DvirMon/ng-table/issues/56)** — close it as
  fixed-by-design, not as work.
- **Add stage-level degradation.** Per ADR-0014 the catch unit is one term: try the term, and on
  a throw drop that term for this pass and report once. Not per row (half-filtered set plus a
  `try` in the hot loop), not per pass (one throw would return every row unfiltered). The report
  names the term by index; an owner with real names (`createFilters`) already reports its own.
  Relates to [#58](https://github.com/DvirMon/ng-table/issues/58) — same console-only channel, do not
  widen it here.

## S3a — specs

**Depends on:** S1, S2. **Parallel-safe with:** S3b, S5.
**Files:** `api/features/with-filtering.spec.ts`, `selection.utils.spec.ts:32`,
`with-grouping.spec.ts` (5 sites: 208, 489, 535, 863, 875).

- Cross-feature specs (`selection.utils`, `with-grouping`) currently build a whole
  `createFilters` schema just to narrow rows. Replace with a bare predicate — they get shorter
  and stop testing filtering.

  > **Merged into R47's call-site pass**, same reason as S3b — these specs are rewritten once, for
  > `predicates` and the array schema together. Note `selection.utils.spec.ts` and
  > `with-grouping.spec.ts` **delete** their `createFilters` schemas rather than migrating them,
  > which corrects R41's claim that `selection.utils.spec.ts:27` becomes generic in `S`.

- `with-filtering.spec.ts` splits by ownership:
  - **Keeps, rewritten to predicates:** composes into `createTable` (:59), narrows rows (:72),
    AND across terms (:87), never narrows when nothing active (:126), contributes no members
    (:142), manual mode (:157), trailing block sees post-filter rows (:212).
  - **Moves to the filters lib's specs:** anyOf OR semantics (:106), empty-criterion skipping,
    the typed-`TState` block (:297–:327) — none of these are table behavior.
  - **Deleted:** the `TState` type tests (:239, :270) — the generic is gone. `:256`
    (phantom `TRow`) flips per S1.
  - **New:** a term that throws is dropped while sibling terms keep narrowing.
  - **New (one only):** integration case proving `createFilters` + `withFiltering` compose
    through `matcher()`.

## S3b — story hosts

**Depends on:** S1, S2. **Parallel-safe with:** S3a, S5.
**Files (5 call sites):** `composition/derived-state/…:37`,
`filtering/client-filtering/…:188`, `filtering/selection-filtering/…:75`,
`grouping/grouping-selection/…:72`, `grouping/grouping-static/…:177`. Plus prose in
`filtering/server-filtering/…:73` and `filtering/fixtures/schema.ts:25,38`.

Mechanical: `{ filters: this.filters }` → `{ predicates: () => [this.filters().matcher()] }`.

**Worth adding one story** — a host filtering with a plain predicate and **no `createFilters`
at all**. That story is the proof the decoupling is real; without it the claim is only
structural. ✅ **shipped** — `stories/filtering/predicate-filtering/`.

> **Merged into R47's call-site pass.** Each of the five hosts also converts its void schema to
> R36's array schema and drops its `*FilterState` annotation in the same edit — do not run this
> step on its own.

## S4 — physical move

**Depends on:** S3. **Blocks:** S6.

Move the closure out of `api/` to `src/filters/` — a sibling of `api/`, `engine/`,
`directives/` — so the seam is visible before it is cut:

```
src/filters/{index.ts, create-filters.ts, types.ts, evaluator.ts, recorder.ts, state.ts,
             validate.ts, rules.ts, matchers.ts}
```

Per ADR-0004's invariant, the folder supplies the domain — drop the `filters.` prefix inside it.
Sequenced last because it is pure churn that would conflict with every other step's diff.

## S5 — docs + ADR

**Depends on:** S2. **Parallel-safe with:** S3a, S3b.

- **ADR-0016** (next free number): _the filter model is the consumer's, the table takes a
  predicate list_. Records the general-mechanism choice, why the term is the error-isolation
  unit, why AND is the only combinator the table may assume, and the phantom-`TRow` flip.
- `1-state/features/filtering.md` — rewrite Config, delete the whole `TState` section, rewrite
  Compile-Time Dependencies ("None" is finally literally true), trim `manual` (its R23 rationale
  shrinks further: with a consumer predicate, "skip the stage" ≈ "don't compose the feature").
- `1-state/filters.md` — add the `matcher()` contract and the "one call = one evaluation"
  boundary.
- `state.json` — `specPath`/`architecturePath` currently point the feature at the filters spec.
  That pointer is itself the coupling, in doc form. Split it.

## S6 — barrel split

**Depends on:** S4.

`index.ts`'s header calls itself "the only definition of the consumer surface." Once filters is a
separate domain that stops being true. Either carve out an explicit filters block with a comment
saying it re-exports a sibling domain, or give `src/filters/index.ts` its own barrel and
re-export it wholesale. The second option makes the eventual package extraction a move, not a
rewrite.

---

## Not in scope

- Extracting to an actual separate npm package. S4+S6 make it a move; do it when there is a
  second consumer, not before.
- Per-column filter awareness for header UI (`activeColumns?: () => ReadonlySet<ColumnId>`).
  **Still an open question** — nothing in `directives/` reads filter state today. If the answer
  is yes, it lands as a second table-owned field and still imports nothing.
- [#57](https://github.com/DvirMon/ng-table/issues/57) (property access under
  `noPropertyAccessFromIndexSignature`) and
  [#62](https://github.com/DvirMon/ng-table/issues/62) (`active()` naming) are filters-lib bugs,
  unaffected either way — but both get cheaper to fix once the lib stands alone.
