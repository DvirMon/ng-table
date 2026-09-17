---
title: Research — generic, table-independent filter utilities
type: research
status: complete
date: 2026-09-09
audience: developers
---

# Generic filter utilities — what problem do they actually solve

Prerequisite research for the `createFilters()` design. The companion doc
[research-filter-state-ownership.md](research-filter-state-ownership.md) asked *who owns filter
state* across four **table** libraries. This one deliberately looks away from tables: at
utilities whose entire job is "given a criterion and a value, decide whether the value matches."
The goal is to find the **irreducible core** of the problem, so the API is designed off the
problem, not off four table libraries' inherited shapes.

Every claim below was read from released source or published docs. URLs per section.

## The five surveyed

| Library | What it is | Coupled to a table? |
|---|---|---|
| **PrimeNG `FilterService`** | Injectable Angular service; named match-mode registry | No — `p-table` is a *consumer* of it |
| **sift.js** | MongoDB-query-syntax matcher for plain JS arrays | No |
| **react-querybuilder** | Query-builder UI + a serializable rule/group tree | No |
| **json-rules-engine** | Fact/operator/value rules engine | No |
| **TanStack Table `filterFns`** | Built-in filter fns (included as the table-side control) | Yes |

Sources:
[PrimeNG filterservice.ts](https://raw.githubusercontent.com/primefaces/primeng/master/packages/primeng/src/api/filterservice.ts) ·
[PrimeNG filtermatchmode.ts](https://raw.githubusercontent.com/primefaces/primeng/master/packages/primeng/src/api/filtermatchmode.ts) ·
[sift README](https://raw.githubusercontent.com/crcn/sift.js/master/README.md) ·
[sift core.ts](https://raw.githubusercontent.com/crcn/sift.js/master/src/core.ts) ·
[react-querybuilder defaults.ts](https://raw.githubusercontent.com/react-querybuilder/react-querybuilder/main/packages/core/src/defaults.ts) ·
[json-rules-engine rules.md](https://raw.githubusercontent.com/CacheControl/json-rules-engine/master/docs/rules.md) ·
[json-rules-engine engine.md](https://raw.githubusercontent.com/CacheControl/json-rules-engine/master/docs/engine.md) ·
[TanStack filterFns.ts (v8)](https://raw.githubusercontent.com/TanStack/table/v8/packages/table-core/src/filterFns.ts)

---

## Finding 1 — the universal triple

Five libraries, five vocabularies, one shape:

| | operand source | operator | criterion |
|---|---|---|---|
| PrimeNG | `resolveFieldData(item, field)` | `filterMatchMode: string` | `filterValue` |
| sift | property path (dotted, array-aware) | `$eq` / `$in` / … | operator params |
| react-querybuilder | `field` | `operator` | `value` |
| json-rules-engine | `fact` | `operator` | `value` |
| TanStack | `columnId` → accessor | `filterFn` (string key or fn) | `filterValue` |

**`(field, operator, criterion) → boolean` is the whole problem.** Nothing else is universal.
This independently confirms the earlier conclusion — *a filter is a rule with an externalized
operand* — arrived at from this repo's own constraints rather than from precedent.

## Finding 2 — the operator signature is unanimously binary

Every one of the five evaluates the operator as `(fieldValue, criterion) => boolean`. Not
`(row, criterion)`.

```ts
// PrimeNG
(value: any, filter: any, filterLocale?: any): boolean
// json-rules-engine
engine.addOperator(String operatorName, Function evaluateFunc(factValue, jsonValue))
```

Only two extras exist anywhere: PrimeNG's optional `filterLocale`, and json-rules-engine's
*decorator* form `(factValue, jsonValue, next)` used to lift an operator over a collection
(`first`, `every`, `some`).

**Consequence:** this repo's existing `filterFn(value, filterValue) => boolean` on `ColumnDef`
already matches the industry contract exactly. Whatever shape `createFilters()` takes, the
predicate slot should not grow a row parameter — no surveyed library needs one, and giving a
predicate the whole row makes it uncacheable per cell and unserializable in principle.

json-rules-engine's decorator is worth stealing conceptually, though: it is how you get
"any element of this array matches" **without** a `containsAny` operator. One general
lifting mechanism instead of an operator per collection semantic — exactly the
`general-mechanism-over-enumerated-cases` shape.

## Finding 3 — everyone ships a named registry with an escape hatch, but the *scope* differs

| Library | Registry | Extension mechanism | Scope of a custom operator |
|---|---|---|---|
| PrimeNG | `filters: { [rule]: fn }` | `register(rule, fn)` | **Application-global mutation** |
| json-rules-engine | engine-owned | `addOperator` / `addOperatorDecorator` (+ `remove*`) | Per engine instance |
| sift | none built in by default | `options.operations` | **Per call** |
| react-querybuilder | `defaultOperators` array | `operators` prop | Per component instance |
| TanStack | `filterFns` built-ins | `filterFns` table option; string key *or* inline fn | Per table / per column |

PrimeNG's `register()` is:

```ts
register(rule: string, fn: Function) {
    this.filters[rule] = fn;
}
```

That mutates a singleton. Two features registering `'contains'` differently silently collide, and
nothing is scoped or removable. It is the one design in the survey worth explicitly **not**
copying. Every other library scopes the override to an instance or a call.

**Consequence:** a global `registerFilterOperator()` is off the table. Overrides belong on the
`createFilters()` call (or the individual filter), which is also the only scope that can be typed
against `TRow`.

## Finding 4 — the default operator sets converge on a small core

| Semantic | PrimeNG | RQB | json-rules-engine | sift | TanStack |
|---|---|---|---|---|---|
| equals | `equals` | `=` | `equal` | `$eq` | `equals`, `equalsString` |
| not equals | `notEquals` | `!=` | `notEqual` | `$ne` | — |
| substring contains | `contains`, `notContains` | `contains`, `doesNotContain` | — | `$regex` | `includesString`(+`Sensitive`) |
| starts / ends with | `startsWith`, `endsWith` | `beginsWith`, `endsWith` (+negations) | — | `$regex` | — |
| `<` `<=` `>` `>=` | `lt` `lte` `gt` `gte` | `<` `<=` `>` `>=` | `lessThan…`, `greaterThan…` | `$lt` `$lte` `$gt` `$gte` | — |
| range | `between` | `between`, `notBetween` | — | (compose) | `inNumberRange` |
| value ∈ list | `in` | `in`, `notIn` | `in`, `notIn` | `$in`, `$nin` | `arrIncludesSome` |
| list ∋ value | — | — | `contains`, `doesNotContain` | `$all` | `arrIncludes`, `arrIncludesAll` |
| null check | — | `null`, `notNull` | — | `$exists` | — |
| boolean is | `is`, `isNot` | (`=`) | — | — | — |
| date-specific | `before`, `after`, `dateIs`, `dateIsNot`, `dateBefore`, `dateAfter` | (per field type) | — | — | — |

**Present in ≥4 of 5 — the hard core:** `equals`, `notEquals`, substring `contains`,
the four comparisons, and set membership. That is roughly **eight** operators, not twenty.

Two entries in that table are cautionary rather than exemplary:

- **`between` is not a primitive.** It is `gte && lte`. PrimeNG and RQB ship it; sift and
  json-rules-engine make you compose it. Ship it only if it visibly *is* the composition.
- **PrimeNG's six date modes are a type problem wearing an operator costume.** `dateIs`,
  `dateBefore`, `dateAfter`, `dateIsNot`, `before`, `after` all exist because JS `Date`
  equality compares instants, not days. The fix belongs in *coercion* (normalise to a day
  boundary), not in six more registry entries. This is the direct precedent for the doubt
  raised against Option E's `dateRange()` — shipping a date kind means deciding inclusive
  bounds, timezone, and null semantics on the consumer's behalf.

**Note the two `contains` are different operators with the same name.** PrimeNG/RQB/TanStack's
`contains` is *substring of a string*; json-rules-engine's and sift's `$all` is *array includes
value*. Whichever this library ships must be named unambiguously — this collision is a live
source of confusion in the wild.

## Finding 5 — "what does an empty criterion mean" is part of the operator contract

The most useful practical discovery, because two libraries solved it in opposite places.

**PrimeNG — inside every predicate.** Each of the twenty match functions opens with its own
early return:

```ts
// startsWith
if (filter === undefined || filter === null || filter.trim() === '') return true;
// between
if (filter == null || filter[0] == null || filter[1] == null) return true;
// in
if (filter === undefined || filter === null || filter.length === 0) return true;
```

Twenty near-identical checks, subtly divergent (`trim()` on some, not others), and the filter
stays in state while being a no-op.

**TanStack — beside the predicate, as data.** `autoRemove` is a property *on* the filter
function:

```ts
includesString.autoRemove  = (val) => testFalsey(val)
arrIncludesSome.autoRemove = (val) => testFalsey(val) || !val?.length
inNumberRange.autoRemove   = (val) => testFalsey(val) || (testFalsey(val[0]) && testFalsey(val[1]))
```

The engine consults it and **drops the filter entry entirely** before any predicate runs.

TanStack's factoring is better on three counts: one policy point instead of twenty; the
predicate stays a pure match; and the empty filter never reaches persisted state or a server
query string. That last one matters here specifically — `state-persistence.md` and `manual`
mode both serialize filters, and a `{ columnId: 'status', value: '' }` in a URL is noise.

**Also unspecified everywhere: null *field* values.** PrimeNG returns `false` for a null field
in every operator **except `notEquals`, which returns `true`**. Defensible, undocumented, and
inconsistent. Whatever this library does, it must state it once, centrally.

→ **Spec requirement:** an operator is a pair — `{ match, isEmpty }` — plus one stated
library-wide policy for null field values. Not a bare predicate.

## Finding 6 — the operator layer knows nothing about composition

| Library | Boolean composition |
|---|---|
| PrimeNG `FilterService` | **None.** One field, one mode, one value |
| PrimeNG `Table` (layer above) | `{ operator: 'and' \| 'or', constraints: FilterMetadata[] }` |
| react-querybuilder | Full `RuleGroupType` tree: `and` / `or`, `not`, nested |
| json-rules-engine | `all` / `any` / `not`, nested |
| sift | `$and` / `$or` / `$nor` / `$not` |
| TanStack | AND across columns only |

PrimeNG's split is the instructive one: the *service* is deliberately composition-free, and the
*table* stacks AND/OR on top of it. The two concerns never mix.

**Consequence:** `createFilters()` should not become a query builder. AND-across-filters (the
current `filtering.md` behavior) is the right default. If OR/NOT is ever wanted it is a distinct
layer that composes filters — it must not complicate the operator contract, which stays binary
and composition-blind.

## Finding 7 — why the surveyed libraries name their operators, and why this library need not

Every non-table library in the survey treats the criterion as **data**, with the predicate looked
up by name:

- react-querybuilder exists largely to emit `formatQuery(query, 'sql' | 'mongodb' | 'json' | …)`.
- json-rules-engine rules are JSON by definition; operators are referenced by string name.
- A sift query *is* a MongoDB document.
- PrimeNG's `FilterMetadata` is `{ value, matchMode, operator }` — a serializable triple.

**The reason is not persistence. It is that their rules are authored at runtime, as data.**
react-querybuilder builds a rule from an end user's clicks. json-rules-engine loads rules from a
JSON file written by someone who is not a programmer. A sift query is the caller's input.
PrimeNG and AG Grid name match modes because their **column filter menu lets the end user pick
the operator from a dropdown at runtime**. In every one of those, no code exists that declares
the rule, so the operator has to be a string that can be resolved later.

This library's filters are declared in TypeScript, in a schema function, that **re-runs on every
construction**. The predicate is therefore *declaration*, not state:

```ts
// runs again on every page load, so the match function rebuilds itself
readonly filters = createFilters(this.data, (path) => {
  filter(path.customer, (cell, q) => contains(cell, q));
});
```

Restoring a snapshot means writing saved **values** back into the filter signals. Nothing about
the function is ever saved, and nothing needs to be. Likewise in `manual` mode: the consumer
wrote the schema, so they know `amount` is a range, and they build `?amount_min=…` from the
value themselves. The library never translates a criterion into a server query.

**Verdict: an inline predicate is not a serialization problem.** The earlier claim that it broke
persistence and `manual` mode was wrong.

Three smaller constraints do survive, and they are about the **criterion value**, not the
predicate:

1. **The field path is the join key.** A snapshot is `{ [path]: value }`; restore matches saved
   values to declared filters by path. That is the only identifier that has to be stable.
2. **A saved value must survive `JSON.stringify` / `parse`.** A `Date` criterion comes back as a
   string; a `Set` comes back as `{}`. Whoever declares a non-JSON criterion shape owns reviving
   it. This is a real requirement for the typed kinds — `dateRange()` shipping a `{from, to}` of
   `Date`s means `dateRange()` owns the revive step.
3. **Stale keys.** A schema that changed since the snapshot was written will have paths in the
   snapshot with no matching filter, and filters with no saved value. Needs a stated policy
   (ignore unknown, leave undeclared at default).

**Naming returns only under one condition:** if the end user gets to choose the operator at
runtime — a column filter menu of the AG Grid / PrimeNG kind (`[contains ▾] [ text ]`). Then the
operator genuinely is runtime data and needs a name to travel in state.

**Decided (2026-09-09): no built-in operator picker.** The schema declares each filter's match
logic; the end user changes values only. Runtime operator switching is a separate, consumer-side
flow, not a library surface. Named operators, a per-column operator list, and coercion-per-
operator are all out of scope with it.

This costs nothing, because a picker falls out of the general mechanism unchanged — put the
operator *inside* the criterion value:

```ts
filter(path.customer, (cell, c: { op: 'equals' | 'contains'; text: string }) =>
  c.op === 'equals' ? cell === c.text : contains(cell, c.text)
);

filters.customer.set({ op: 'contains', text: 'acme' });   // the consumer's dropdown writes this
```

The criterion stays plain data, so it still round-trips. Same shape as this repo's
`insertRow({ ...row, id: newId() })` covering duplicate-row without a `duplicateRow()` API
(`general-mechanism-over-enumerated-cases`). The exported row verbs are `insertRow` / `removeRow`
/ `patchRow` (`src/mutations/row-mutations.ts`) — there is no `addRow`, despite the global rule
file using that name in its own illustration.

## Finding 8 — field resolution: this repo is already ahead

PrimeNG and sift resolve fields by **dotted string path** (`resolveFieldData(item, 'a.b.c')`),
untyped. react-querybuilder and json-rules-engine defer resolution to the consumer entirely.
This library already has `accessor(row)` plus the typed `ColumnsPath<TRow>` proxy — same role,
compile-checked. No change needed, and nothing in the survey improves on it.

---

## What the feature must support — checklist derived from the survey

Spec input. Not implementation.

**Core (all five libraries have it, non-negotiable):**
1. Binary operator contract `(fieldValue, criterion) => boolean` — no row parameter.
2. Field resolution from a row to a comparable value (already solved: `accessor` / `ColumnsPath`).
3. A criterion **value** that survives a JSON round-trip, keyed by field path. The predicate does
   not travel with it — the schema re-declares it (Finding 7). An operator *name* is required
   only if the operator becomes end-user-selectable at runtime.
4. A named built-in operator set, ~8 entries: `equals`, `notEquals`, `contains` (substring),
   `lt` / `lte` / `gt` / `gte`, set membership.
5. Per-instance override / registration of custom operators — never a global registry.
6. Empty-criterion policy declared *beside* the predicate (`autoRemove`-shaped), not inside it,
   and applied before evaluation so empty filters never enter persisted or server state.
7. One stated, central policy for null / undefined field values.
8. AND across active filters.

**Deliberately out of the operator layer:**
9. Boolean composition beyond AND (OR / NOT / nesting) — a separate optional layer, if ever.
10. Date semantics — a coercion concern, not six operators.
11. `between` — sugar over `gte` + `lte`, shipped only if it reads as that composition.

**This repo's own additions, not from the survey:**
12. Signal reactivity: criteria are writable signals; the filtered result is derived, not pushed.
13. Server-supplied defaults that user input can override (the `linkedSignal` mechanism already
    established in `design-options-hybrid-api.md`).
14. `manual` mode: criteria handed to a server instead of evaluated — which is what makes
    requirement 3 load-bearing rather than nice-to-have.

## The sugar / generic balance — what the survey actually recommends

The requested balance ("some defaults, not complete defaults, easy override") is exactly what
four of five libraries already do, and the survey says *where* the line goes:

**Ship as the general mechanism (the `value.update()` half):**
- The binary operator contract, and one way to declare a filter from `(field, operator,
  criterion)`.
- Per-instance operator registration.
- The empty/null policy hooks.

**Ship as sugar (the `insertRow` / `removeRow` half — removable without loss):**
- The ~8 core operators, by name.
- Convenience declarations for common criterion shapes.

**The acceptance test, restated from the survey's own evidence:** sugar is genuine only if
declaring a filter with a custom operator costs the same as declaring one with a built-in.
PrimeNG passes (`register()` then use the name identically — scope defect aside). TanStack
passes (`filterFn` takes a string key *or* a function in the same slot). AG Grid's set filter
fails — its built-in carries UI and state a custom one cannot reproduce, which is precisely the
failure mode flagged in the over-reach section of
[design-options-hybrid-api.md](design-options-hybrid-api.md).

Typed kinds (`dateRange()`, `numberRange()`) sit **above** the sugar line, not on it: they bundle
an operator with a criterion *shape* and a coercion policy. Finding 4's date evidence says that
bundle is where libraries accumulate surface they can never remove. If they ship, each must
decompose visibly into `(field, operator, criterion)` and be ignorable at zero cost.

## Feeds back into the open questions

All resolved during the grill. See the `R` decisions in
[design-options-hybrid-api.md](design-options-hybrid-api.md).

- **Q "handle callable vs `.value`"** — no surveyed library constrained it; decided from Signal
  Forms instead. **R20.**
- **Q "`ColumnDef.filterFn` / `enableFiltering` obsolete?"** — Finding 2 says `filterFn`'s
  *signature* is right; its *location* is what changes. Both fields deleted. **R12.**
- **From Finding 7 — is a runtime operator picker in scope?** No. It was the only thing forcing
  named operators. **R1.**
- **From Finding 7 — who revives a non-JSON criterion value?** Nobody, for now: persistence is
  consumer-owned, so it is the reviver they already pass to `JSON.parse`. Reopens if a shared
  persistence utility is built. **R21/R22.**
- **From Finding 5 — does an empty criterion leave state?** Neither, and both: it stays in
  `value()` (stable shape, binds to controls) and is absent from `active()` (what the URL and
  the "N filters applied" chip read). The two shapes come from Signal Forms' own
  model-vs-`errors()` split. **R14.**
