# Issue graph — single-value-source epic (#110)

Epic: [#110](https://github.com/DvirMon/ng-table/issues/110) — the column accessor becomes the
single value source for cells, sorting, grouping and filtering; data concerns key by declared
column id ([ADR-0024](../../../../adr/0024-single-value-source-accessor.md)).

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#111](https://github.com/DvirMon/ng-table/issues/111) | Decouple the schema path mechanism from the columns schema | ✅ CLOSED 09-20 (`a9e437b`) | — | #114, #115, #100 |
| [#112](https://github.com/DvirMon/ng-table/issues/112) | `sortRows` calls accessor and `sortFn` unwrapped, escaping ADR-0014 | ✅ CLOSED 09-20 | — | #100 (cleared) |
| [#113](https://github.com/DvirMon/ng-table/issues/113) | The declared column-id union reaches a feature's config | 🟡 OPEN — steps 1-4 implemented, pending `/ship` | — | #114, #115, #100, #125 |
| [#125](https://github.com/DvirMon/ng-table/issues/125) | The declared column's **value type** reaches a feature's schema — `createColumns()` + `ColumnValues<>` | 🟡 OPEN — steps 1-6 implemented, pending `/ship` | #113 (implemented) | #115, #100, grouping retrofit |
| [#114](https://github.com/DvirMon/ng-table/issues/114) | Grouping reads the accessor; levels and aggregates key by column id | 🟡 OPEN — steps 1-9 implemented, pending `/ship` | #111 (cleared), #113 (implemented) | #117 (cleared on this side; #117 still waits on #115) |
| [#115](https://github.com/DvirMon/ng-table/issues/115) | Filtering reads the accessor; criteria key by column id | 🟡 OPEN — back on the frontier since 2026-09-21 (`#125` implemented) | #111 (cleared), #113 (implemented), #125 (implemented) | #117 |
| [#100](https://github.com/DvirMon/ng-table/issues/100) | Per-column sorting config moves off `ColumnDef` into `withSorting()` | 🟡 OPEN — back on the frontier since 2026-09-21 (`#125` implemented) | #111 (cleared), #113 (implemented), #125 (implemented) | — |
| [#116](https://github.com/DvirMon/ng-table/issues/116) | ADR for the schema-declaration surface — keying, authoring forms, resolver naming | 🟡 OPEN | — | — |
| [#117](https://github.com/DvirMon/ng-table/issues/117) | Rule contexts resolve declared columns — `valueOf`, `criterionOf`, `stateOf` | 🟡 OPEN | #114, #115 (and #125 transitively — its resolvers return `unknown` until the value map lands, but the edge runs through #115, not direct) | — |

## Graph

```
#116  (ADR — docs, cites nothing, cited by everything)

#111 ──────────┐
   ✅ closed   ├──► #114  (grouping + aggregates) ──┐
#113 ──────────┤                                    │
   (id union)  │                                    ├──► #117  (resolvers)
               │                                    │
               └──► #125 ──┬──► #115  (filtering) ──┘
                (value map)│     ▲
                           │     └── #111 ✅ closed
                           │
                           └──► grouping retrofit  (follow-up, not filed)

#111 ──────────┐
   ✅ closed   │
#112 ──────────┼──► #125 ──► #100  (sorting schema + config)
   ✅ closed   │  (value map)
#113 ──────────┘
   (id union)
```

## Summary

- **Parallel-safe:** `#113`, `#116` — no edge between them. `#113` touches only the generic
  plumbing and its generated overloads; `#116` is docs and blocks nothing mechanically. `#111` and
  `#112` were both in this set until they closed on 2026-09-20 — `#112` touched only
  `with-sorting.ts`, `#111` only the schema mechanism.
- **Also parallel-safe once their blockers close:** `#114`, `#115`, `#100` — they share blockers
  but nothing with each other, and they touch disjoint engines. `#115` and `#100` gained a
  shared blocker on 2026-09-21 (`#125`), and lost it the same day when `#125`'s six steps landed;
  they stay parallel-safe *with each other*.
- **Sequenced:** `#111 → #114/#115/#100` was gated on the shared construction check — and for
  `#100`, also on the recording runner that its new schema fn calls — **cleared**, `#111` shipped
  as `a9e437b`;
  `#113 → #114/#115/#100` gated on the literal id union (and on the types-spec guard inside
  `#113` that proves the union did not silently widen); `#112 → #100` was gated on the comparator
  call sites, which both change — **cleared**, `#112` shipped as `94e8050`;
  `#114/#115 → #117` gated on the features actually reading the accessor — a resolver over
  accessor values is meaningless before that.
- **The type channel was the gap, and no table vendor closes it.** `#113` carried the declared
  **id** union into a feature's config; the **value** behind each id stayed `unknown`, because
  `ColumnDef.accessor` returns `unknown` and the array erases per-element types. That is what
  `#125` adds. Prior art says nobody has it: TanStack's `TValue` reaches `cell`/`footer`/`meta`
  only — `filterFn`/`sortingFn`/`aggregationFn` are `<TData>`-only and `Row.getValue<TValue>(columnId)`
  is an unchecked caller assertion; AG Grid's `TValue` is hand-annotated, never inferred. Every
  library that *does* deliver a declared-key → value map switched its declaration to an object
  keyed by the id — rejected here, it costs column order. Evidence, with pinned versions and
  URLs: [`discovery-column-value-typing.md`](discovery-column-value-typing.md).
- **Current frontier:** `#113`, `#116`, `#125`, `#114`, `#115`, `#100`. `#115` and `#100` briefly
  left it on 2026-09-21 when `#125` was ranked ahead of them — planning against `unknown` means
  planning twice — and rejoined the same day once `#125`'s six steps implemented the value map,
  pending `/ship`. `#112` closed 2026-09-20, `#111` closed the same day too (`a9e437b`).
  `#113` is the riskiest and still gates **everything unplanned**, now one hop further out —
  `#125` directly, `#115`/`#100` through it, `#117` through those — so starting it early is
  worth more than finishing it fast; `#116` can land any time and is what the rest cite; `#114`
  is implemented and waits on `/ship` alongside `#113` and `#125`.
- **The grouping retrofit — moving grouping from the erased id union onto the value map,
  unfiled — is unblocked as of 2026-09-21.** It was `#125`'s other dependent (`decisions.md`'s
  "K0 does not gate what already shipped" — `#114` landed on the erased union, and the retrofit
  is its own follow-up node); now that `#125` is implemented, filing it is no longer premature.
- **`#113` and `#114` are both implemented, not yet shipped.** `#113`: `TableStore<TRow, TId>`
  carries the declared id union into every feature slot, `create-table.overloads.ts` was
  regenerated, `api/create-table.types.spec.ts` proves the union stays literal (not widened to
  `string`) and proves the arity escape hatch (`composeFeatures()`) carries it too with no
  generator change. `#114`: all nine of its own task-plan steps landed — grouping validates
  declared column ids at construction and on `table.grouping`'s writer (G71), both cluster walks
  read the column's `accessor`, the grouping surface re-keys to `TId`, `applyAggregate` replaces
  `ColumnDef.aggregateFn`, the raw-name label tier and the `groupingLevels()` filter are gone, and
  a plain `setColumns()` orphaning an active level degrades rather than throws (G72). `#115` is no
  longer gated on the id union existing — only on `#113` actually merging. Both issues stay open
  until `/ship`'s PR goes green on CI, per this repo's issue-tracker convention.
- **`#117` is additive by construction.** No existing `when` predicate migrates into it —
  `cluster.key` is already accessor-resolved after `#114`, and plain model fields stay directly
  readable. It exists for the carrier-column case that has no spelling, which is why it is a
  separate slice rather than scope inside `#114`/`#115`.
  Its resolver lands on a context argument, not as a `ClusterSummary` member (G67), so the
  summary type is unchanged and every one-argument predicate still compiles.
- **The resolver rule is two-tier (G65), and it is mechanism-wide, not grouping's.** A resolver
  reading another *declaration* is bound and takes a path (`criterionOf`, `stateOf`); one reading
  *data* takes a path and a subject (`valueOf(path, row)`), because a column-keyed path names a
  cross-section, not an instance. The evidence (G66): no consumer callback in any of the four
  schemas has exactly one row as its subject. `#116` is where this gets written as a rule a
  third-party feature author can apply, along with why `criterionOf` is not `valueOf` renamed
  (G63/G64) — the two share a type only under `equals`.
- **`#100` grew a `#111` edge on 2026-09-20.** `withSorting()` now takes a schema fn in the
  recording form (G69, reversing D11a), and `applySortNulls` moves out of `columnsSchema` into it.
  Sorting is therefore a consumer of the shared mechanism, not independent of it. This closes the
  two spellings `#100` briefly owned: a schema fn puts a `path` in scope, so `sortFn` reaches the
  resolver with no second form, and there is no keyed `columns` record to design.
- **`#115` does not rename filtering's context method.** The `valueOf` → `criterionOf` rename is
  `#117`'s; `#115`'s "public surface unchanged" claim is only true with that scoped out.
- **`#111` extracts one runner, not two** — the recording form's (**G70**, 2026-09-20). Both
  authoring forms stay permanent (G62); what changed is that only one of them gets an extracted
  runner in this slice. The declaring form's body stays in `engine/filters/build.ts` until
  ADR-0020's `stageSchema` is a second caller, which is `#102`'s epic. The forms still share the
  path proxy, the handle and the recorder session.

## Not in this epic

- **No non-data gate, no display-column kind** (G56, closed). This library is headless — a
  checkbox or action cell is consumer markup, never a column.
- **`visible` is not enforced by the library.** Nothing reads it to filter rendering; consumers
  filter themselves. Carrier columns (G54) rest on that convention. Deserves its own issue, not
  a node here.
- **#47** (typed aggregates channel) assumes `ColumnDef`-declared `aggregateFn`. `#114` changes
  that, which reorders the `#100 → #47 → #45` sequence #100 originally recorded.
- **#102** (ADR-0020 open stage registration) is unblocked by `#111` — the mechanism has to be
  decoupled and exported before a third-party feature can declare a schema — but it is its own
  epic.

## Source

Edges derived from the dependency ranking in
[`decisions.md`](decisions.md), re-checked at issue grain and confirmed by the user
2026-09-20. `#116` and `#117` added 2026-09-20 from the schema-plumbing design session recorded
as D10/D11 in
[`../../../grouping/active/grouping-config-simplification/2-decisions.md`](../../../grouping/active/grouping-config-simplification/2-decisions.md)
— neither is covered by `decisions.md`'s M/V/K/S node list, which predates that session.
Titles and states pulled from `gh issue view` on 2026-09-20; `#100`'s `#111` edge added the
same day when `withSorting()` gained a schema fn (G69). States re-verified against
`gh issue list` on 2026-09-20 after `#112` closed (`94e8050`) and again after `#111` closed
(`a9e437b`) via `/ship`. GitHub's native `blockedBy`/`blocking` fields are empty on every node —
these edges live in the issue bodies' **Blocked by** sections and in this file, nowhere else.
`#125` and its edges into `#115`/`#100` were added 2026-09-21 from the design pass that ranked
the column value map as **K0** in [`decisions.md`](decisions.md); its prior art is cited to
[`discovery-column-value-typing.md`](discovery-column-value-typing.md), not restated here.
Filed and reconciled the same day: `#125` carries the `110/column-value-map` slice marker and is
`#110`'s ninth native sub-issue, `#115` and `#100` each gained a `#125` line in their **Blocked
by** sections, and `#117`/`#114` carry comments recording what the map does and does not change
for them — `#114` shipped on the erased union, so its retrofit stays a follow-up node.
`#125`'s six-step task plan implemented the same day (2026-09-21); `#115`/`#100` are back on the
frontier and the grouping retrofit is unblocked. See [`decisions.md`](decisions.md)'s K0 row and
"Questions settled while sequencing" for what implementing it settled.
Related docs:
[ADR-0024](../../../../adr/0024-single-value-source-accessor.md),
[`docs/decisions/grouping.md`](../../../../decisions/grouping.md) G53–G59.
