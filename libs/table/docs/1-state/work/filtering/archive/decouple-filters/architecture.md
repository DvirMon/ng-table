---
title: Architecture — decouple createFilters() from withFiltering()
type: architecture
date: 2026-09-14
status: settled
audience: developers
---

# Architecture — decouple the filter model from the table

Consumed immediately by `/to-tasks`. Paths, types and snippets are exact as of `feat/table` @
`25f5c15`. Settled decisions below are **not open for relitigation** — see
[the spec](spec.md) for the contract and
[migration-decouple-filters-from-table.md](../with-filtering/migration-decouple-filters-from-table.md)
for the reasoning.

## Where the coupling physically lives

Four concrete bindings, all verified in source:

| #   | Binding                                                  | Site                                                                                                                                                      |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Feature imports the evaluator factory                    | `src/api/features/with-filtering.ts:2` — `import { createFilterEvaluator } from '../create-filters'`                                                      |
| 2   | Feature imports the filters type                         | `src/api/features/with-filtering.ts:4` — `import type { Filters } from '../filters.types'`                                                                |
| 3   | Feature declares a `TState` it never reads               | `src/api/features/with-filtering.ts:13-19`, `:26-37` (both overloads)                                                                                     |
| 4   | Evaluator reaches into the built object through a symbol | `src/api/filters/evaluator.ts:6` `FILTERS_INTERNAL`, `:16` `attachFiltersInternal`, `:23` `getFiltersInternal`; stamped at `src/api/create-filters.ts:70` |

Binding 4 is the load-bearing one: `createFilterEvaluator` is re-exported from
`src/api/create-filters.ts:8` purely so the feature can reach it, and `FiltersInternal` exists only
to carry `records` / `nodesByKey` / `pathToKey` back out of the closure that built them.

## Target contract

```ts
// table side — imports nothing from the filters domain
export interface WithFilteringConfig<TRow> {
  /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}

// filters side — knows nothing about tables
export interface FiltersRoot<
  TRow,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  value: WritableSignal<TState>;
  active(): Partial<TState>;
  reset(value?: Partial<TState> | null): void;
  dirty(): boolean;
  matcher(): (row: TRow) => boolean;
}

// consumer wiring — ordinary composition
withFiltering({ predicates: () => [this.filters().matcher()] });
```

## Types touched

| Type                                                                | File                                | Change                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `FiltersRoot<TState>`                                               | `api/filters.types.ts:40`           | → `FiltersRoot<TRow, TState>`; gains `matcher()`                                                |
| `Filters<TRow, TState>`                                             | `api/filters.types.ts:63`           | root call site becomes `FiltersRoot<TRow, TState>`; `TRow` stops being phantom as a consequence |
| `WithFilteringConfig<TRow, TState>`                                 | `api/features/with-filtering.ts:13` | → `WithFilteringConfig<TRow>`; `filters` → `predicates`                                         |
| `FiltersInternal<TRow>`                                             | `api/filters/evaluator.ts:8`        | stays, becomes domain-internal — no longer reachable from outside                               |
| `FILTERS_INTERNAL` + `attachFiltersInternal` + `getFiltersInternal` | `api/filters/evaluator.ts:6,16,23`  | **deleted**                                                                                     |

`FilterNode`, `FilterOptions`, `FilterRuleRecord`, `FilterGroupChild`, `FilterValueOfContext`,
`FilterHandle`, `FiltersPath`, `FilterSchemaRecorder` are all unchanged.

## Why `matcher()` on the root, not on the callable

`Filters<TRow, TState>` (`api/filters.types.ts:63-68`) is:

```ts
(() => FiltersRoot<TState>) & { readonly [K in keyof TState]: () => FilterNode<TState[K]> }
```

The intersection's second half is a mapped type over `keyof TState`, so a top-level `matcher`
member would collide with a filter literally keyed `matcher`. `FiltersRoot` is a plain interface
with no such hazard — the same reason `value`, `active`, `reset` and `dirty` already live there.

## Why `TRow` stops being phantom, and what that costs

`TRow` is declared on `Filters` but never appears in the type body today, so `Filters<OtherRow>`
and `Filters<Row>` are the same type once `TState` matches. `api/features/with-filtering.spec.ts:256`
asserts that outright:

```ts
it('filters: TRow is phantom — a Filters<OtherRow> is not rejected', () => { … });
```

`matcher(): (row: TRow) => boolean` puts `TRow` in the body, so this **flips** to an assertion of
rejection. Structural typing is preserved — an identically shaped row type, or a wider one, still
works; only genuinely unrelated row types are rejected.

**This is a public type-behavior change and belongs in the ADR, not in a refactor commit.**

## Error isolation at the stage

Two reporting layers, deliberately, because they have different information:

| Layer                    | Unit              | Names the failure by        | Where                                                        |
| ------------------------ | ----------------- | --------------------------- | ------------------------------------------------------------ |
| Filter model (unchanged) | one filter record | its filter key              | `api/filters/evaluator.ts:39-49`, dedup at `:98`, `:119-122` |
| Table stage (new)        | one term          | its index in `predicates()` | `api/features/with-filtering.ts`                             |

A term produced by `matcher()` reports under its own filter key from inside the evaluator and
never surfaces as a throw, so the index-based report is the floor for **anonymous** terms, not a
replacement. Per ADR-0014 both report in production as well as dev, through the existing
`console.error` channel — do not widen it here ([#58](https://github.com/DvirMon/ng-table/issues/58)).

Catch per **term**: per row yields a half-filtered set plus a `try` in the hot loop; per pass means
one throw returns every row unfiltered, which is the silent, unrecoverable direction.

## Call-site inventory — verified, not estimated

**Story hosts (5)** — mechanical, `{ filters: this.filters }` → `{ predicates: () => [this.filters().matcher()] }`:

| File                                                                                    | Line |
| --------------------------------------------------------------------------------------- | ---- |
| `src/stories/composition/derived-state/derived-state-story-host.component.ts`           | 37   |
| `src/stories/filtering/client-filtering/client-filtering-story-host.component.ts`       | 188  |
| `src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts` | 75   |
| `src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts`    | 72   |
| `src/stories/grouping/grouping-static/grouping-static-story-host.component.ts`          | 177  |

**Prose only** — `src/stories/filtering/server-filtering/server-filtering-story-host.component.ts:73`,
`src/stories/filtering/fixtures/schema.ts:25,38`, plus the three `.mdx` files
(`client-filtering.mdx:13`, `server-filtering.mdx:14,17`).

**Specs** — `with-filtering.spec.ts` (13 composition sites: 65, 78, 96, 117, 135, 148, 164, 195,
218, 245, 263, 276, 318), `selection.utils.spec.ts:32`, `with-grouping.spec.ts` (5 sites: 208, 489,
535, 863, 875).

## File layout for the implementation

### S1 — `matcher()` on the root

| File                       | Action                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/filters.types.ts`     | thread `TRow` into `FiltersRoot`; add `matcher()`                                                                                                                           |
| `api/filters/state.ts:155` | `buildFiltersRoot` gains `TRow` + a `matcher` field                                                                                                                         |
| `api/filters/evaluator.ts` | delete `FILTERS_INTERNAL`, `attachFiltersInternal`, `getFiltersInternal`; `createFilterEvaluator` takes `FiltersInternal<TRow>` directly; drop its `export` past the domain |
| `api/create-filters.ts`    | drop the `createFilterEvaluator` re-export (`:8`) and the `attachFiltersInternal` call (`:70`); build the root with the `internal` object already in scope                  |

**Ordering note inside S1:** `buildFiltersObject` (`state.ts:197`) builds the root _before_
`create-filters.ts` has the `internal` object. Either pass `internal` down into
`buildFiltersObject`, or attach `matcher` to the root after construction inside the factory. Pick
one and state it in the step file — this is the only non-mechanical decision in S1.

### S2 — `predicates` config

| File                             | Action                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `api/features/with-filtering.ts` | delete both imports (`:2`, `:4`); `WithFilteringConfig<TRow>`; `predicates` replaces `filters`; delete `TState` from the interface and both overloads (`:26-37`); add per-term try/catch + once-per-pass report in the `filter` stage (`:44-52`) |
| `index.ts`                       | no export change — `WithFilteringConfig` is exported via `export * from './api/features/with-filtering'` (`:13`)                                                                                                                                 |

The stage body becomes: call `config.predicates()` once per pass, then `rows.filter(row => …)`
applying each term under its own guard.

### S3a — specs

`with-filtering.spec.ts` splits by ownership:

- **Keeps, rewritten to predicates:** `:59` composes, `:72` narrows, `:87` ANDs, `:126` no-op when
  nothing active, `:142` contributes no members, `:157` manual, `:212` trailing block sees
  post-filter rows.
- **Moves to `create-filters.spec.ts`:** `:106` anyOf OR semantics, empty-criterion skipping, and
  the typed-`TState` block `:297-327`.
- **Deleted:** `:239`, `:270` — the `TState` type tests; the generic is gone.
- **Inverted:** `:256` — phantom `TRow` becomes rejection.
- **New:** a throwing term is dropped while siblings keep narrowing.
- **New, one only:** integration case proving `createFilters` + `withFiltering` compose through
  `matcher()`.

`selection.utils.spec.ts:23-32` and the five `with-grouping.spec.ts` sites replace their
`createFilters` schemas with bare predicates. `selection.utils.spec.ts` can then drop its
`FiltersPath` / `Filters` imports entirely.

`api/filters/matchers.spec.ts` and `api/filters/state.spec.ts` — **untouched**.

### S3b — stories

The five hosts above, plus one **new** story host filtering with a plain predicate and no
`createFilters` at all. Without it the decoupling claim rests entirely on import lists.

### S4 — physical move (sequenced last)

```
src/filters/{index.ts, create-filters.ts, types.ts, evaluator.ts, recorder.ts,
             state.ts, validate.ts, rules.ts, matchers.ts}
```

Sibling of `api/`, `engine/`, `directives/`. Per ADR-0004 the folder supplies the domain — drop the
`filters.` prefix inside it (`filters/types.ts`, not `filters/filters.types.ts`). Specs move with
their sources.

Pure churn; it conflicts with every other step's diff, which is why it is last.

### S5 — docs + ADR

| File                                          | Action                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/0016-*.md`                          | **new** — 0016 is the next free number (0009 is absent; 0001-0008 + 0010-0015 exist). Records: the filter model is the consumer's and the table takes a predicate list; why the term is the error-isolation unit; why AND is the only combinator the table may assume; the phantom-`TRow` flip as a public type-behavior change |
| `docs/1-state/features/filtering.md`          | rewrite Config; delete the whole `TState` section (`:62-72`); rewrite Compile-Time Dependencies — "None" becomes literally true; trim `manual`'s R23 rationale                                                                                                                                                                  |
| `docs/1-state/filters.md`                     | add the `matcher()` contract and the "one call = one evaluation" boundary                                                                                                                                                                                                                                                       |
| `docs/1-state/work/with-filtering/state.json` | split `specPath` / `architecturePath` — they currently both point at the filters docs, which is the coupling in doc form                                                                                                                                                                                                        |
| `docs/status.md`                              | **generated** — run `npm run table:status`, never hand-edit                                                                                                                                                                                                                                                                     |

### S6 — barrel split

`index.ts:1-3` calls itself "the only definition of the consumer surface". Once filters is a
separate domain that is false. Two options; **take the second**:

1. Carve out an explicit filters block with a comment saying it re-exports a sibling domain.
2. Give `src/filters/index.ts` its own barrel and re-export it wholesale — makes the eventual
   package extraction a move, not a rewrite.

Current filters exports to relocate: `index.ts:87-104` — `createFilters`, the `Filters` /
`FilterNode` / `FilterOptions` types, the nine rules, and the six matchers.

## Settled — do not relitigate

- `matcher()` on the root, not the callable (mapped-type collision).
- The catch unit is one **term**.
- AND is the only combinator the table may assume.
- `manual` is retained.
- S4 is sequenced last.
- The `TRow` brand planned in the inferred-criterion-map work is **dropped** — `matcher()` consumes
  `TRow` already, so the brand would be written and immediately deleted.

## Open questions

1. **S1's construction ordering** — pass `internal` into `buildFiltersObject`, or attach `matcher`
   to the root post-construction in `create-filters.ts`? Both work; pick one in the step file.
2. **Per-column filter awareness for header UI** (`activeColumns?: () => ReadonlySet<ColumnId>`).
   Nothing in `directives/` reads filter state today. If yes, it lands as a second table-owned
   field and still imports nothing. **Deliberately unanswered — out of scope for this work.**
3. **`index.ts` ordering after S6** — whether the filters barrel re-export goes first or last in
   the file. Cosmetic; decide during S6.

## Known-stale references in the decision record

- **[#56](https://github.com/DvirMon/ng-table/issues/56) is already CLOSED.** S2 says to close it as
  fixed-by-design; that is already done. No action owed.
- **S4's file list includes `recorder.ts`.** Correct as of today. The inferred-criterion-map work
  deletes that file — but it is sequenced _after_ this one, so the list stands.
