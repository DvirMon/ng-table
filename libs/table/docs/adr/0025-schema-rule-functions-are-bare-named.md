# ADR-0025 — Schema rule functions are bare-named, not `apply`-prefixed

**Status:** accepted — decided 2026-09-22.
**Related:** [ADR-0018](0018-when-vs-enable-predicate-naming.md) (predicate naming precedent), [ADR-0024](0024-single-value-source-accessor.md), [ADR-0019](0019-columns-path-keyed-by-declared-column-ids.md), [ADR-0027](0027-schema-declaration-surface.md) (reader-naming addendum, 2026-09-25), [issue #100](https://github.com/DvirMon/ng-table/issues/100), and `.claude/rules/declarative-naming.md`.

Every function that registers a declaration into a schema is named for the constraint it asserts, with no `apply` prefix. Ten functions are affected: `applyVisible` → `visible`, `applyVisibleAsync` → `visibleAsync`, `applySortNulls` → `sortNulls`, `applyGrouping` → `grouping`, `applyGroupingAsync` → `groupingAsync`, `applyGroupKey` → `groupKey`, `applyGroupOrder` → `groupOrder`, `applyAggregate` → `aggregate`, `applySortFn` → `sortFn`, and `applySortable` → `sortable`.

**A function that *reads* a declaration, rather than registering one, ends in `Of`** — `valueOf`, `criterionOf`, `stateOf` ([ADR-0027](0027-schema-declaration-surface.md)). The two rules are complementary, not competing: a registrar asserts a constraint and is bare-named; a resolver answers a question about an existing declaration and is named for what it returns, suffixed `Of`. Added 2026-09-25 so both naming rules for the schema-declaration surface live in one file.

This is not a new convention — it is already shipped in filtering's eight rules: `anyOf`, `contains`, `equals`, `filter`, `hasAny`, `hasNone`, `inDateRange`, `inRange`. The eight `apply*` functions across columns, grouping and sorting are the deviation, not the proposal. `.claude/rules/declarative-naming.md` already states the rule: a function returning a boolean takes an `is*`/`has*` prefix (predicate), while a bare name is reserved for a function that *does* something — explicitly, "a declaration rule that registers a filter." That is exactly what these ten functions are. Angular Signal Forms names its schema rules `required`, `min`, `max` — the constraint, not the verb that applies it.

## Alternatives considered

- **Name the property rather than the constraint** (`visibility` instead of `visible`, `aggregation` instead of `aggregate`). Rejected: filtering's existing rules assert a constraint, not a property — `equals`, `inRange`, `hasAny`, never `equality`, `range`, `presence` — and Signal Forms matches. It also has no spelling for the compound names: `applyVisibleAsync` and `applySortNulls` have no natural property-noun form. And it turns what is otherwise a mechanical prefix strip into case-by-case re-wording.
- **Columns only, deferring grouping and sorting.** Rejected: it leaves the library teaching two conventions simultaneously, and #100 would still have to pick a side for its two unshipped functions (`sortFn`, `sortable`).
- **Set the convention now, defer the rename to its own issue.** Rejected: the rename is mechanical and the inconsistency is the whole cost being paid; splitting it leaves the issue sitting indefinitely while the confusion stays live.
- **Keeping `apply*`** — there is no argument for the prefix that filtering's eight exports do not already contradict.

## Consequences

- Breaking rename of eight exported functions plus two unshipped. Every story host, spec and doc snippet naming them changes with it.
- #100's `sortFn` and `sortable` land named correctly rather than being renamed immediately after shipping.
- One open flag, deliberately not resolved here: `grouping()` the rule sits beside `table.grouping` the store member that `withGrouping()` declares. No compile collision — one is a module export, the other a store property — but the bare name reads worst there, and it is worth revisiting on its own rather than blocking the whole convention.
- The convention now governs any future schema rule. A new rule is named for what it asserts, bare.
- `applyColumnOrder` in `libs/table/src/engine/columns.ts` keeps its name — it is not a schema rule, it is an internal pure transform, and is not exported from `src/index.ts`. This is noted explicitly so the next reader does not treat it as an oversight.
- Bare names are broad identifiers to export from a flat barrel. That trade was already accepted for `filter` and `equals`, which are more collision-prone than any name in this set, and a consumer can alias on import.
