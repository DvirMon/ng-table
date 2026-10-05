---
title: '/audit-docs results — issue #44 gate'
type: audit
issue: 78
date: 2026-09-14
---

# `/audit-docs` over `libs/shared/table` — the #44 gate

Run as Step 8's AC 6. Scope: the library's permanent docs (`docs/**` excluding `docs/**/work/**`,
plus `CLAUDE.md`) verified against `src/` by five parallel `Explore` agents, batched by doc group.
Work folders are historical records and are expected to hold the old call shape — every grep and
every agent brief excluded them.

## Verdict

**The gate passes.** Every objective grep is clean, and no agent found a surviving reference to
the array/thunk form, the config-builder helper, or `ComposedFeatureMembers` outside `work/`.

### Objective half — the Step 7 greps, library-wide, `work/` excluded

| Grep                     | Hits                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `createTableSchema`      | 0                                                                                       |
| `ComposedFeatureMembers` | 0                                                                                       |
| `features: [`            | 0                                                                                       |
| `createTable(.*() => ({` | 0                                                                                       |
| `optsFn`                 | 1 — ADR-0002's own amendment, naming the removed thunk as history                       |
| `TableStoreConfig`       | 0                                                                                       |
| `with[A-Za-z]+<[A-Z]`    | 3 — all in ADR-0003's historical example (Step 1), phrased as past or negated behaviour |

Two further `with…<…>` hits are type-parameter _declarations_, not row types on a call, and are
correct as written: `adr/0015:220`'s `withSelectionSliced<In extends Shape, D extends DerivedDict>`
and `CLAUDE.md:170`'s `withFeature<In extends Shape>` authoring pattern.

### Subjective half — what the agents returned

| Batch                         | Files  | STALE findings | In #44 scope |
| ----------------------------- | ------ | -------------- | ------------ |
| ADRs                          | 14     | 39             | 9            |
| `1-state/` core + `CLAUDE.md` | 7      | 46             | 11           |
| `1-state/features/`           | 12     | 32             | 2            |
| `2-columns/` + `3-ui/`        | 19     | 70             | 9            |
| `0-product/` + top-level      | 9      | 53             | 0            |
| **Total**                     | **61** | **240**        | **31**       |

`docs/status.md` audited clean — its 17 rows match every spec's `capability:`/`spec:`/`code:`
frontmatter row for row. No regeneration needed.

## In scope — fixed on this issue (31)

Everything below was a surviving trace of the pre-#33 composition surface, or a claim #33 itself
falsified. All are fixed in the #44 commit.

**ADRs (9)**

- `0002:17, :34, :40, :43, :56` — the Decision section still described `createTable(data, optsFn, options?)`,
  an `optsFn()` that runs once over a `features` key, `setData()` as public, and `options.injector`.
  Rewritten to `createTable(data, config, ...features)`, the `WritableView` write path, and
  `config.injector`, with a dated note that the thunk was the shape until #33.
- `0003:75` — a feature's factory parameter documented as `Pick<TableCore<TRow>, …>`. It is
  `Pick<TableStore<RowOf<In>>, …> & Shape` since #33; `TableCore` reaches internal features only.
- `0007:44` — the quoted collision message (`Error: feature #2 already claims member 'editing'…`)
  matched no string in `engine/slots.ts`. Replaced with what `claimMember` actually emits.
- `0007:64` — "both features in the `features` array" → positional arguments.
- `0008:16, :47` — the `api/` inventory listed `table-schema.ts`, the home of the removed
  `createTableSchema()`. Replaced with `create-table.overloads.ts`.

**`1-state/` core and `CLAUDE.md` (11)**

- `prd.md:35` — "compose … via a `features` array" → trailing positional arguments.
- `prd.md:45, :94` — `createTable(data, optsFn)` → `createTable(data, config, ...features)`.
- `prd.md:94` — "pass `{ injector }`" → `config.injector`.
- `prd.md:110` — the `TestBed.runInInjectionContext` snippet still built a thunk.
- `prd.md:43, :62, :112` — three user stories demanded a compile-time "`withGrouping()` requires
  `withExpansion()`" contract. #33 settled it as argument-order type-level visibility; story 23 is
  struck as withdrawn and the `@ts-expect-error` test requirement is restated as a type-level
  fixture over the ordering rule.
- `row-mutations.md:219` — O8 ("compile-time feature dependencies have no mechanism
  post-migration; `composed` is untyped `Record<string, unknown>`") closed against `Feature<In, Out>`.
- `architecture.md:14` — "the working `signalStoreFeature()` code" → `composeTable()` / `TableFeatureSpec`.
- `overview.md:200` — the same `Pick<TableCore<TRow>, …>` factory-parameter claim as ADR-0003.

**`1-state/features/` (2)**

- `grouping.md:60` — "without `withExpansion()` in the feature list" → "composed".
- `row-editing.md:232` — "composes `withOptimistic()` internally — not through the `features`
  array". Both halves were wrong: there is no array, and `withRowEdit()` builds its own
  `createEditingStore()` rather than composing the other feature.

**`2-columns/` and `3-ui/` (9)**

- `2-columns/architecture.md:67, :290` — the `optsFn` thunk, twice.
- `2-columns/architecture.md:234` — the config surface block still declared
  `TableStoreConfig<TRow, Features extends readonly AnyTableFeature[]>` with a `features?: Features`
  key. Rewritten as the shipped `TableConfig<TRow>` plus a note that features are positional.
- `2-columns/architecture.md:151` — the reference feature-factory shape, restated against
  `createTableFeature` + `In` / `RowOf<In>`.
- `2-columns/architecture.md:195, :319` — two more `TableStoreConfig` references.
- `tier-3-feature-config.md:13, :22` — "dead unless that feature is in `features`", twice.
- `tier-3-feature-config.md:81` — "matches the store's `type<>` dependency posture"; `type<>` is
  ngrx API removed in ADR-0003, and the posture is now the F-bounded `Feature<In, Out>` slice.
- `3-ui/directives/core.md:28` — `createTable(data, optsFn)`.

Two further corrections were folded in while editing the same lines, both because leaving them
would have made the file self-contradictory: `RowRestorePoint.detached` → `op: PendingOp`
(ADR-0013) in `CLAUDE.md` and `1-state/architecture.md`, and the overload-count wording in
`CLAUDE.md` (16 signatures, arity 0-15 — the doc and D27 were each right about a different number).

## Out of scope — not fixed, listed for triage (209)

None of these are #33 artifacts. They are pre-existing drift from other tickets, and fixing them
here would have made a docs-reconciliation issue unreviewable. Grouped by what would close them:

1. **ADR-0013's `op: PendingOp` rename** — `detached: boolean` survives in `row-editing.md:287,
:300, :317, :340` and `adr/0006:16, :110`. ADR-0013 is still `status: proposed` though its
   Decision 6 shipped.
2. **Features that ship but are documented as unbuilt** — `withGrouping()`, `withFiltering()`,
   `withSelection()`, `everExpanded`. Affects `row-editing.md:515, :596, :645, :663, :875, :893`,
   `filtering.md:99`, `selection.md:197`, `3-ui/architecture.md:133`, `3-ui/directives/grouping.md:37`,
   `3-ui/directives/expansion.md:28, :253`, `prd.md:118`, `1-state/architecture.md:83, :92, :94, :104`.
3. **`updateColumns()` — a symbol that exists nowhere in `src/`** — named in `columns.md:90-136`,
   `2-columns/architecture.md:47`, `ownership-model.md:43-56`, `3-ui/directives/columns.md:47`.
   The shipped path is `table.columns.update(setColumns(defs))` (D30).
4. **`.store()` → `.ngpTable()`** — the UI docs' store-access call shape is wrong in four files:
   `3-ui/directives/core.md:67, :140`, `columns.md:68`, `sort.md:50`, `expansion.md:101`.
5. **`ColumnDef` field drift** — `label` ships and is required; `filterFn` / `enableFiltering` were
   removed with the filtering redesign. Flips claims in `columns.md`, `prd.md:97`,
   `tier-1-intrinsic.md:46`, `tier-3-feature-config.md:40`, `3-ui/directives/columns.md:53, :58`
   and `3-ui/architecture.md:100, :131`.
6. **ngrx residue outside the composition surface** — `buildStoreClass` / `withState` /
   `withMethods` / `withHooks` / `coreFeature` and `EmptyFeatureResult` in
   `2-columns/architecture.md:291-303`.
7. **`ngpTableColumn` never shipped under that name** (it is `ngpTableHeaderCell`) —
   `overview.md:49`, `README.md:57`, `ticket.md:20`.
8. **ADR-0014's Context table** — the throw-site count, all five line numbers, two of five
   triggers, and the "no `try`/`catch` anywhere in `engine/` or `api/`" claim are all stale against
   current source. The Decision and this issue's amendment are correct; only the Context is wrong.
9. **ADR-0015 names `rowIdsOf`**, a symbol that never shipped — the member is `rowsOf`, returning
   rows not ids.
10. **Story-path drift** — `row-editing.md:605`, `0-product/row-editing.md:422, :428, :429`,
    `3-ui/stories.md` (18 vs 19 stories, `predicate-filtering/` unlisted) and
    `0-product/filtering.md` (three stories vs four).
11. **Self-referential staleness in the product docs** — `0-product/filtering.md` and
    `selection.md` flag `status.md`, `3-ui/architecture.md:60` and `filters.md`'s frontmatter as
    stale; all four were fixed since. `0-product/grouping.md` cites `state-persistence.md:90`'s
    old `string | null` type, corrected 2026-09-10, and contradicts itself on `RenderRow.groupKey`.
12. **`README.md` navigation gaps** — no `0-product/` section, `row-editing.md` and
    `row-animation.md` unlisted, work-effort list covers 3 of 31 folders.
13. **Three malformed nested markdown links** — `0-product/grouping.md:79-81`.
14. **Status-marker drift** — ADR-0005 and ADR-0013 are `status: proposed` but shipped;
    ADR-0004's `with-columns-schema/` path; `0009`'s absence from the ADR sequence is unexplained.

Items 1-3 and 5 are the highest-leverage: each is one rename repeated across four-plus files, and
each currently teaches an agent to generate code that does not compile.
