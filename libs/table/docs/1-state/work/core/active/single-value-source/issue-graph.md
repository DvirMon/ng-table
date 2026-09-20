# Issue graph — single-value-source epic (#110)

Epic: [#110](https://github.com/DvirMon/ng-table/issues/110) — the column accessor becomes the
single value source for cells, sorting, grouping and filtering; data concerns key by declared
column id ([ADR-0024](../../../../adr/0024-single-value-source-accessor.md)).

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#111](https://github.com/DvirMon/ng-table/issues/111) | Decouple the schema path mechanism from the columns schema | 🟡 OPEN | — | #114, #115, #100 |
| [#112](https://github.com/DvirMon/ng-table/issues/112) | `sortRows` calls accessor and `sortFn` unwrapped, escaping ADR-0014 | 🟡 OPEN | — | #100 |
| [#113](https://github.com/DvirMon/ng-table/issues/113) | The declared column-id union reaches a feature's config | 🟡 OPEN | — | #114, #115, #100 |
| [#114](https://github.com/DvirMon/ng-table/issues/114) | Grouping reads the accessor; levels and aggregates key by column id | 🟡 OPEN | #111, #113 | #117 |
| [#115](https://github.com/DvirMon/ng-table/issues/115) | Filtering reads the accessor; criteria key by column id | 🟡 OPEN | #111, #113 | #117 |
| [#100](https://github.com/DvirMon/ng-table/issues/100) | Per-column sorting config moves off `ColumnDef` into `withSorting()` | 🟡 OPEN | #111, #112, #113 | — |
| [#116](https://github.com/DvirMon/ng-table/issues/116) | ADR for the schema-declaration surface — keying, authoring forms, resolver naming | 🟡 OPEN | — | — |
| [#117](https://github.com/DvirMon/ng-table/issues/117) | Rule contexts resolve declared columns — `valueOf`, `criterionOf`, `stateOf` | 🟡 OPEN | #114, #115 | — |

## Graph

```
#116  (ADR — docs, cites nothing, cited by everything)

#111 ──────────┐
   (mechanism) ├──► #114  (grouping + aggregates) ──┐
#113 ──────────┤                                    │
   (id union)  │                                    ├──► #117  (resolvers)
               ├──► #115  (filtering) ──────────────┘
#111 ──────────┘

#111 ──────────┐
   (mechanism) │
#112 ──────────┼──► #100  (sorting schema + config)
   (ADR-0014)  │
#113 ──────────┘
   (id union)
```

## Summary

- **Parallel-safe:** `#111`, `#112`, `#113`, `#116` — no edge between them. `#112` touches only
  `with-sorting.ts`; `#111` only the schema mechanism; `#113` only the generic plumbing and its
  generated overloads; `#116` is docs and blocks nothing mechanically.
- **Also parallel-safe once their blockers close:** `#114`, `#115`, `#100` — they share blockers
  but nothing with each other, and they touch disjoint engines.
- **Sequenced:** `#111 → #114/#115/#100` gated on the shared construction check — and for
  `#100`, also on the recording runner that its new schema fn calls;
  `#113 → #114/#115/#100` gated on the literal id union (and on the types-spec guard inside
  `#113` that proves the union did not silently widen); `#112 → #100` gated on the comparator
  call sites, which both change; `#114/#115 → #117` gated on the features actually reading the
  accessor — a resolver over accessor values is meaningless before that.
- **Current frontier:** `#111`, `#112`, `#113`, `#116` — `#100` left it on 2026-09-20. `#112` is
  the cheapest and is a standalone bug fix; `#113` is the riskiest and gates five of the eight,
  so starting it early is worth more than finishing it fast; `#116` can land any time and is
  what the rest cite.
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
- **`#111` extracts two runners, not one** — one per authoring form (G62). The forms share the
  path proxy, the handle and the recorder session; only the runner splits.

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
same day when `withSorting()` gained a schema fn (G69). Related docs:
[ADR-0024](../../../../adr/0024-single-value-source-accessor.md),
[`docs/decisions/grouping.md`](../../../../decisions/grouping.md) G53–G59.
