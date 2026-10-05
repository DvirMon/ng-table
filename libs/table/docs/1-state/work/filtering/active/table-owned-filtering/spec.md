---
title: 'Filtering moves into the table'
type: spec
status: ready-for-issues
date: 2026-09-16
audience: developers
---

# Filtering moves into the table

Decisions: [design-options-hybrid-api.md](../../archive/with-filtering/design-options-hybrid-api.md)
(R50–R56). Evidence:
[research-filter-state-ownership.md](../../archive/with-filtering/research-filter-state-ownership.md),
[research-typescript-inference-probes.md](../../archive/filters-inferred-state/research-typescript-inference-probes.md),
[review-filters-table-coupling.md](../../archive/with-filtering/review-filters-table-coupling.md).

## Problem Statement

`createFilters()` is a standalone product a consumer must construct, type and wire before a table
can filter anything. It is not table machinery: `withFiltering` imports nothing from it and the
whole bridge is `predicates: () => [filters().matcher()]`.

R10 justified that separation on one claim — in server mode filters feed the request that
_produces_ the data, so a table-owned filter object cannot be constructed at all. **The claim is
false.** `create-table.ts:28` reads rows through a thunk inside a `computed()`, so a `resource()`
whose `params` read `table.filters().criteria()` wires with no construction cycle. The shipped
server story proves the ordering works today — it builds its table on `signal<InvoiceRow[]>([])`
before the first fetch (`server-filtering-story-host.component.ts:126-128`).

With the blocker gone, the survey rule in `research-filter-state-ownership.md` — _ownership tracks
who originates the value_ — plus the stated constraint that **filters are always born with a
table** puts filtering table-owned, alongside AG Grid, PrimeNG, NgRx and `MatTableDataSource`
(4 of the 7 libraries surveyed).

Everything the standalone shape required then falls out: the row carrier existed only because
`createFilters` had nothing else to infer `TRow` from; the key-derivation layer
(`as`/`__key`/`RuleKey`/`Flatten`) existed only because rules were collected in an array;
`matcher()` was promoted to public only to bridge a decoupled feature.

## Target API

```ts
// invoice-filters.schema.ts — standalone, composable by spread (R55)
export const invoiceFilters = (path: FiltersPath<Invoice>) => ({
  status:  equals(path.status),
  amount:  inRange(path.amount, { source: () => bounds() }),
  dueDate: inDateRange(path.dueDate, { when: isAdvanced }),
  search:  anyOf([contains(path.note), filter(path.id, matchesInvoiceNumber)]),
});

// component
readonly table = createTable(
  () => this.invoices.value() ?? [],
  config,
  withFiltering({ manual: true }, invoiceFilters),
);

readonly invoices = resource({
  params: () => this.table.filters().criteria(),
  loader: ({ params }) => this.api.fetchInvoices(params),
});
```

### Signature

```ts
export interface WithFilteringConfig {
  manual?: boolean;
}

export interface FilteringMembers<TRow, TState extends Record<string, unknown>> {
  readonly filters: Filters<TRow, TState>;
}

export function withFiltering<In extends Shape>(config: WithFilteringConfig): Feature<In, {}>;

export function withFiltering<In extends Shape, S extends Record<string, AnyRule>>(
  config: WithFilteringConfig,
  schema: (path: FiltersPath<RowOf<In>>) => S,
): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>>>;

type StateOf<S> = { [K in keyof S]: CriterionOf<S[K]> };
```

`TRow` is `RowOf<In>` — supplied by the table. No carrier, no `rowOf()` (R52).

### Rules

`equals` · `contains` · `inRange` · `inDateRange` · `hasAny` · `hasNone` ·
`filter(path, predicate)` · `anyOf([...children])`

```ts
export interface FilterOptions<TSource = unknown, TRow = unknown> {
  readonly source?: () => TSource;
  /** Extra empty criterion — joins the rule's own empty set and seeds `reset(null)`. */
  readonly emptyValue?: TSource;
  /** Total emptiness override — the only way to subtract from the rule's empty set. */
  readonly isEmpty?: (criterion: NoInfer<TSource>) => boolean;
  /** Gated off: `criterion()` and `isActive()` go dark. `value` and `reset` do not. */
  readonly when?: (ctx: FilterValueOfContext<TRow>) => boolean;
}
```

`emptyValue` and `isEmpty` carry the semantics
[#82](https://github.com/DvirMon/ng-table/issues/82) shipped, unchanged by this work: **`isEmpty`
replaces; `emptyValue` extends and seeds; with neither, the rule's own holds.** `isEmpty` is on
every rule, not just `filter()`, and `NoInfer` keeps it from typing the criterion a second time.
`equals`' criterion is therefore `TRow[K] | null | TEmpty` — an override widens it, never narrows
it.

`when` returns `boolean`, not grouping's `boolean | undefined` — filtering has no async rule to
produce a pending state (R53).

### Members — eight (R56)

|                                      | Root `filters()`                | Per key `filters.status()`             |
| ------------------------------------ | ------------------------------- | -------------------------------------- |
| Writable criterion                   | `value: WritableSignal<TState>` | `value: WritableSignal<TCriterion>`    |
| Effective criterion, empties omitted | `criteria(): Partial<TState>`   | `criterion(): TCriterion \| undefined` |
| Narrowing right now                  | `isActive()`                    | `isActive()`                           |
| Back to the declared source          | `reset(value?)`                 | `reset()`                              |

`matcher()` and `dirty()` become internal.

## Out of scope

- **A raw-predicate escape hatch.** `predicates` is deleted and no `where()` replaces it. A
  predicate with no criterion is a _scope_, not a filter, and a scope is expressed by narrowing
  the rows signal — `filter` precedes `group`/`sort`/`expand` in `PIPELINE_ORDER`, so the pipeline
  output is identical (R54).
- **A `filterSchema()` helper.** A hoisted arrow annotated `(path: FiltersPath<Row>)` already
  works, and beating it requires currying (R55).
- **Tri-state `when`.** Add it the day an async filter gate lands (R53).
- **Filter persistence / URL sync.** Unchanged by this work.

## Behaviour that must not change

Criterion semantics, `source` defaults and the late-default race, empty criteria (additive
`emptyValue`, total `isEmpty` — #82), the null-cell
policy, ADR-0014 per-filter/per-evaluation degradation, `anyOf` OR semantics and its
homogeneous-criterion compile check, the duplicate-**path** construction throw, and
`form(filters().value, schema)` binding with no adapter (R18).

The duplicate-**key** throw is deleted — an object literal cannot repeat a key (R51).

## Work breakdown

```
[1 feature owns the model] ──┬─> [3 `when`, delete applyWhen]
[2 object schema + StateOf] ─┤   [4 delete carrier/rowOf]
                             ├─> [5 member audit, drop predicates]
                             └─> [6 barrel + FiltersPath] ──┬─> [7 call sites]
                                                            └─> [8 specs] ──> [9 docs] ──> [10 relocate]
```

| #   | Step                                                                           | Depends on |
| --- | ------------------------------------------------------------------------------ | ---------- |
| 1   | `withFiltering(config, schema)` builds the model, exposes the member           | —          |
| 2   | Object-literal schema, `StateOf<S>`, delete the key-derivation layer           | —          |
| 3   | `when` in `FilterOptions`; delete `applyWhen` and the conditional node         | 2          |
| 4   | Delete carrier, `rowOf`, `RowToken`, the `[TRow] extends [never]` brand        | 1          |
| 5   | `matcher()`/`dirty()` internal; delete `predicates`                            | 1          |
| 6   | Barrel: drop `createFilters`/`rowOf`/`RowToken`/`applyWhen`; add `FiltersPath` | 1,2,4,5    |
| 7   | Call sites — 5 story hosts, fixtures; server host moves to `resource()`        | 6          |
| 8   | Specs — `create-filters.types.spec.ts` rewritten; others migrated              | 6          |
| 9   | Docs — `filters.md` folds into `features/filtering.md`; ADR-0016 successor     | 7,8        |
| 10  | Relocate the domain + amend ADR-0004                                           | 9          |

Parallel-safe: `[3,4,5]` after 1–2; `[7,8]` after 6.

### Step 10 — where the domain lands

`src/filters/` exists because standalone was the trajectory
([review-filters-table-coupling.md](../../archive/with-filtering/review-filters-table-coupling.md): _"move
the closure to `src/filters/` … so the seam is visible before it is cut"_). R50 closes that
trajectory, so the folder now misstates the architecture under ADR-0004's contract-boundary axis.

| File                                                                                              | Lands in                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------ |
| `rules.ts`, `matchers.ts`, public types (`Filters`, `FilterNode`, `FilterOptions`, `FiltersPath`) | `api/features/with-filtering/` |
| model builder, `state.ts`, `evaluator.ts`, `validate.ts`, internal types                          | `engine/filters/`              |
| `row-of.ts`                                                                                       | deleted in step 4              |

Mirrors `api/features/with-columns-schema/`'s declare / compile / run split. Last step by design:
mechanical once the surface is settled, and a churning rename early would inflate every other
diff.

## Acceptance

- [ ] `nx run shared-table:typecheck` clean — run twice, since `ngc` aborts before the template
      phase on a `.ts` error.
- [ ] No `createFilters`, `rowOf`, `RowToken` or `applyWhen` in `src/index.ts`.
- [ ] `FiltersPath` exported; a hoisted schema const compiles against a table of the same row type.
- [ ] Server story drives its request from `resource({ params: () => table.filters().criteria() })`
      with no `effect`/`untracked` loop.
- [ ] A schema returning nothing throws at construction, message naming the object form (R40).
- [ ] Duplicate **path** across two keys still throws; duplicate **key** is a compile error.
