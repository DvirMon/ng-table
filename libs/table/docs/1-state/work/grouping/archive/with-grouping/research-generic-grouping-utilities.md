---
title: Research — generic, table-independent grouping utilities
type: research
status: complete
date: 2026-09-09
audience: developers
issue: null
---

# Generic grouping utilities — what problem do they actually solve

Prerequisite research for a redesigned `withGrouping()`. Companion docs
[research-group-ordering.md](research-group-ordering.md) and
[research-grouping-state-ownership.md](research-grouping-state-ownership.md) look at **table**
libraries. This one deliberately looks away from tables: at utilities whose entire job is "group
a collection by a key," to find the irreducible core of the problem — mirroring the method used
in [../with-filtering/research-generic-filter-utilities.md](../../../filtering/archive/with-filtering/research-generic-filter-utilities.md).

Every claim below was read from released source or published docs. Versions and URLs per section.

## The four surveyed

| Library                                   | What it is                                   | Coupled to a table? |
| ----------------------------------------- | -------------------------------------------- | ------------------- |
| **Lodash `_.groupBy`**                    | Generic collection aggregator                | No                  |
| **`Object.groupBy` / `Map.groupBy`**      | Native language built-ins (Baseline 2024)    | No                  |
| **d3-array `group`/`rollup`/`groupSort`** | Generic array-grouping + reduction utilities | No                  |
| **RxJS `groupBy` operator**               | Stream/Observable grouping operator          | No                  |

Sources:
[lodash@4.18.1 groupBy.js](https://www.npmjs.com/package/lodash) (read from `npm pack lodash@4.18.1`, `groupBy.js` + `_createAggregator.js`) ·
[d3-array@3.2.4 group.js / groupSort.js](https://www.npmjs.com/package/d3-array) (read from `npm pack d3-array@3.2.4`, `src/group.js` + `src/groupSort.js`) ·
[rxjs@7.8.1 groupBy.ts](https://www.npmjs.com/package/rxjs) (read from `npm pack rxjs@7.8.1`, `src/internal/operators/groupBy.ts`) ·
[MDN Object.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy) ·
[MDN Map.groupBy()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy) ·
[MDN Object.keys()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys)

---

## Finding 1 — the key is always a plain accessor; "bucketing" is not a separate mechanism anywhere

Every surveyed utility takes exactly one shape for the grouping key: `(item) => key`. None of them
have a distinct "bucket definition" concept (ranges, date-truncation, etc.) as API surface.

```js
// lodash groupBy.js doc comment + example
_.groupBy([6.1, 4.2, 6.3], Math.floor);
// => { '4': [4.2], '6': [6.1, 6.3] }
```

Lodash's own canonical example _is_ a bucketing case (floor a number into an integer bucket) — and
it needs no dedicated bucketing API. The iteratee simply computes the bucket label itself. Same
shape everywhere else:

|                                           | key parameter                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Lodash                                    | `iteratee` (function, or property-name shorthand)                                  |
| `Object.groupBy`/`Map.groupBy`            | `callbackFn(element, index)` returning a string/symbol (Object) or any value (Map) |
| d3-array `group(values, ...keys)`         | one or more `keyof` functions, applied to nest multi-level                         |
| RxJS `groupBy(key: (value: T) => K, ...)` | `key` function                                                                     |

**Consequence for `withGrouping()`:** "bucket dates into months" or "bucket numbers into ranges" is
already fully expressible today with `ColumnDef.accessor` alone (or a computed column) — no
surveyed library needed a second config field for it, and neither should we. There is no missing
mechanism here.

## Finding 2 — group order is never a first-class output; it's always first-occurrence, or an explicit separate step

None of the four bakes in an alternate default order (alphabetical, etc.) — and none support
sorting groups as an option _on the grouping call itself_.

|                           | default order of produced groups                                                                                                                                                                                                                                                                                                                                                                                                                                         | how to get a different order                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Lodash `groupBy`          | **First-occurrence** — stated in the function's own doc comment: _"The order of grouped values is determined by the order they occur in `collection`."_ Keys land in a plain object in that order.                                                                                                                                                                                                                                                                       | Not offered — sort the resulting object's keys yourself.                                                       |
| `Object.groupBy`          | Same — insertion order into a null-prototype object, per standard object semantics. **Caveat, confirmed from MDN's own `Object.keys()` example:** integer-like string keys are reordered ascending _ahead of_ insertion order, regardless of when they were created — `{100:"a", 2:"b", 7:"c"}` → `Object.keys()` → `['2','7','100']`. A numeric group key (e.g. a numeric category id) run through `Object.groupBy` would silently stop being first-occurrence-ordered. | Not offered by the API. `Map.groupBy` exists partly to sidestep this — Maps have no key-type-based reordering. |
| `Map.groupBy`             | First-occurrence, and — unlike plain objects — this is unaffected by key type (string vs number vs object reference), since `Map` iteration order is always insertion order.                                                                                                                                                                                                                                                                                             | Not offered — sort the resulting `Map`'s entries yourself.                                                     |
| d3-array `group`/`rollup` | First-occurrence — built on an `InternMap`, iterated in source order, `Map.set()` called once per new key (`src/group.js`, `nest()`).                                                                                                                                                                                                                                                                                                                                    | **`d3.groupSort(values, reduce, key)`** — a dedicated, separate function. See Finding 3.                       |
| RxJS `groupBy`            | Order of first appearance in the _stream_ — a new `GroupedObservable` is emitted the moment a never-seen-before key arrives. Not reorderable after the fact without buffering the whole stream first, because groups are emitted incrementally, not returned as one collection.                                                                                                                                                                                          | Not applicable — inherent to the push model.                                                                   |

**This is the doc's key finding: no surveyed utility treats "group order" as a property of
grouping itself.** It's either first-occurrence-and-nothing-else, or (d3 only) a second,
independent function you compose _after_ grouping. This directly supports modeling group ordering
in `withGrouping()` as a separate, explicit concern rather than folding a sort comparator into the
grouping key logic — see Finding 3 for the shape that separation takes.

**Also a concrete, citeable warning for our engine:** if any future group-summary structure is
ever keyed by a plain JS object (rather than iterating an array of clusters, which is what
`clusterByKey`/`RenderRow` already does), a numeric or numeric-looking group value would silently
reorder ahead of insertion order. Not a risk today — worth a one-line guard note if a `Record<string,
...>`-shaped group index is ever introduced.

## Finding 3 — d3 proves ordering-by-computed-value is a real, precedented shape, and it needs the group's _values_, not just its key

`group()` and `rollup()` are not two separate implementations — they're the same internal
function, differing only in what gets done to each bucket's array at the end:

```js
// d3-array src/group.js
export default function group(values, ...keys) {
  return nest(values, identity, identity, keys); // reduce = identity → raw arrays
}
export function rollup(values, reduce, ...keys) {
  return nest(values, identity, reduce, keys); // reduce = consumer fn → aggregated value
}
```

**This directly supports this repo's existing design**, where `aggregateFn` is one `ColumnDef`
field consumed inside `withGrouping()`'s render stage rather than a split-out second primitive —
d3 arrives at the same "one grouping mechanism, reduce is a parameter" shape from a
generic-utility angle, independently of tables.

`groupSort` — the utility that actually answers "order groups by a computed value" — needs the
full per-group value array, not just the group's key:

```js
// d3-array src/groupSort.js
export default function groupSort(values, reduce, key) {
  return (
    reduce.length !== 2
      ? sort(
          rollup(values, reduce, key),
          ([ak, av], [bk, bv]) => ascending(av, bv) || ascending(ak, bk),
        )
      : sort(group(values, key), ([ak, av], [bk, bv]) => reduce(av, bv) || ascending(ak, bk))
  ).map(([key]) => key);
}
```

Two supported call shapes, both real precedent for "order by row count":

- `reduce` of arity 1 (`g => g.length`, or `g => d3.mean(g, v => v.x)`): a **reduce-to-sortkey**
  function run over each group's raw value array, results compared ascending.
- `reduce` of arity 2 (`(a, b) => number`): a **direct comparator over the two groups' full value
  arrays**, not their keys.

Either way, `groupSort` operates on **the group's member rows**, never on the bare key alone. It
returns just the ordered key list — grouping and ordering stay decoupled, composed by the caller.

**Bearing on the `compareGroups` sketch discussed in this session:** the sketched shape,
`compareGroups?: (a: GroupKey, b: GroupKey) => number` where `GroupKey = { columnId, value }`,
cannot express the user's stated "order by how many rows are in each category" case — a bare
`GroupKey` carries no row data to count. d3's precedent says the comparator (or reduce-to-sortkey
function) needs access to each group's row array, not just its key. A shape closer to d3's would
be `compareGroups?: (a: { key: unknown; rows: TRow[] }, b: { key: unknown; rows: TRow[] }) =>
number`, or a `groupOrderFn?: (rows: TRow[]) => number` reduce-to-sortkey form mirroring
`groupSort`'s arity-1 case — either covers the count case; the currently-sketched `GroupKey`-only
signature does not.

## Not researched

- Whether any SQL-query-builder or ORM abstraction (outside d3/lodash/RxJS) has its own take on
  "ORDER BY an aggregate" that differs meaningfully from `groupSort`'s shape — SQL's own `ORDER BY
COUNT(*)` is the obvious real-world precedent for the count case but wasn't independently
  source-verified here since it's a language feature, not a library API.
- Immer/Reselect or other memoization-focused utilities' treatment of grouped derived state —
  out of scope, this doc stayed at the grouping-primitive level, not caching.
