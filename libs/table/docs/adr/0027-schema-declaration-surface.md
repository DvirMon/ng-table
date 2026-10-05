# ADR-0027 — The schema-declaration surface: keying, authoring forms, resolver naming

**Status:** accepted
**Date:** 2026-09-25
**Related:** [ADR-0019](0019-columns-path-keyed-by-declared-column-ids.md) (owed this ADR since
its 2026-09-20 amendment — see below), [ADR-0020](0020-open-stage-registration-for-third-party-features.md)
(a third-party feature author is bound by every rule here), [ADR-0021](0021-column-concerns-and-data-concerns-are-separate-surfaces.md)
(its path-vocabulary rule is reconciled below — read this instead of inferring it from
ADR-0024's header), [ADR-0024](0024-single-value-source-accessor.md) (the keying rule this ADR
formalizes), [ADR-0025](0025-schema-rule-functions-are-bare-named.md) (gains the reader-naming
sentence below)

**Source:** [`docs/1-state/work/grouping/active/grouping-config-simplification/2-decisions.md`](../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md)
D11(b)/(c)/(d) — the reasoning lives there and explicitly does not claim ownership of it. Logged
as [G61–G68](../decisions/grouping.md) in the grouping decisions log.

## Context

ADR-0019's 2026-09-18 amendment deferred a cross-cutting rule to its own ADR: _"a schema fn on
`TableConfig` names columns; a schema fn on a feature's config names row fields."_ That ADR was
never written. ADR-0024 then inverted the rule it would have stated — every schema fn now names
declared columns, not row fields — so the unwritten ADR would have been wrong regardless.

Three rules governing the schema-declaration surface exist only as reasoning in one capability's
work folder (grouping's D11), even though every feature slice under the single-value-source epic
(#110) — sorting (#100), filtering (#115), grouping (#114, shipped) — and the third-party
registration mechanism (ADR-0020) already depend on them. A reviewer of any of those has had to
take the rule on trust from a folder that explicitly disclaims owning it. This ADR is that
document.

## Decision

### Rule 1 — every schema fn names declared column ids

Whether declared on `TableConfig` (via `createColumns()`'s `schema` argument) or on a feature's
own config (`withSorting({ schema })`, `withGrouping({ schema })`, `withFiltering({ schema })`),
a schema fn's path proxy resolves to **declared column ids**, never to raw row fields.

This is what [ADR-0024](0024-single-value-source-accessor.md) established by making the column
accessor the single value source: once grouping and filtering must read through
`readAccessor(column, row)` like cells and sorting already do, the value a rule declares against
has to be a column, because that is the only thing `readAccessor` takes. [ADR-0021](0021-column-concerns-and-data-concerns-are-separate-surfaces.md)'s
now-superseded path-vocabulary table said the opposite for a feature's own config ("path names
row fields"); that row is reconciled below, not merely superseded in the abstract.

**Reconciling ADR-0021.** ADR-0021's _capability test_ — a capability belongs to the column
surface if it needs nothing from row data, to a feature if it reads rows — is unaffected and
still governs where a rule is declared (on `columnsSchema` vs. on a feature's own config). What
changes is only the **vocabulary** a feature's path uses once declared: it used to name
`Extract<keyof TRow, string>` (a row field); it now names a declared column id, the same
vocabulary `columnsSchema` always used. The two ADRs no longer disagree on vocabulary — they
agree, and ADR-0021's surface-placement test is the one that survives unmodified.

### Rule 2 — two authoring forms, permanently, and the rule that picks between them

A schema fn takes one of two forms:

```ts
schema: (path) => {
  grouping(path.region, { enable });
}; // recording — returns void
schema: (path) => ({ status: equals(path.status) }); // declaring — returns the rule map
```

Both are correct, permanently — this is not a historical inconsistency to converge. **A schema
fn returns an object when each declaration has an identity the feature's own state is keyed by;
it records (returns `void`) when declarations are per-target policy with no state of their
own.** Filtering returns an object because a filter criterion is consumer-named state the UI
binds and writes (`node.value()`); columns, grouping and sorting record because their
declarations — visibility, a grouping level, a sort comparator — are policy attached to a target,
not named state of their own.

Sorting is the rule's worked test, not an assumption built into it: it was classified "no schema
of its own" on 2026-09-20 and reclassified the same day, once [#100](https://github.com/DvirMon/ng-table/issues/100)
gave it per-column config (`sortFn`, `sortable`) that needed a schema entry — the rule predicted
recording, and recording is what it got.

**Every feature with per-column config declares it through a schema entry — there is no second
spelling.** A keyed `columns: { [id]: config }` record on a feature's own config object was
considered for sorting and rejected: it says the same thing the schema mechanism already says,
and two spellings of one idea is exactly what the shared mechanism (`schema/path-proxy.ts`)
exists to prevent. `columnsSchema` itself is left holding only `visible`/`visibleAsync` and the
raw `metadata()` channel — it carries no feature's config.

### Rule 3 — resolvers come in two tiers, and the tier decides the arity

Once a feature reads through the accessor (Rule 1), a rule callback holding raw rows has no
legal way to read a _different_ declared column's value — the accessor is the value source and
`readAccessor` is engine-internal. The declaration surface answers this with a context object
exposing three resolvers, one per **register**:

```ts
ctx.valueOf(path.total, row); // the data          → 250              (per row)
ctx.criterionOf(path.status); // the filter input  → { min, max }     (table-wide)
ctx.stateOf(path.region); // the column config  → { visible, label, meta }
```

> `valueOf` answers _what does the data say?_ `criterionOf` answers _what did the user ask for?_
> `stateOf` answers _how is this column configured?_

**The tier rule, stated generally, for any feature author (including third-party, ADR-0020):** a
resolver that reads another **declaration** in the same schema is bound to the schema and takes
only a path (`criterionOf`, `stateOf`). A resolver that reads **data** takes a path _and a
subject_, because a column-keyed path names a cross-section of every row, not one instance —
`valueOf(path, row)`. A custom feature's own resolver follows the same test: it takes a subject
argument if and only if it reads rows. This is not enumerated per this library's four existing
contexts; it is derived from what the path names, so it extends to a resolver ADR-0020 has not
yet been written.

**Why `criterionOf` is not `valueOf` under another name.** `equals` is the one rule where the two
happen to share a type, which makes them look interchangeable if that is the only example
consulted:

| rule                    | criterion type        | cell value type          |
| ----------------------- | --------------------- | ------------------------ |
| `equals(path.status)`   | `TRow[K]` — `'won'`   | `'won'` ← the only match |
| `inRange(path.total)`   | `{ min, max }`        | `number`                 |
| `anyOf(path.status)`    | `readonly string[]`   | `string`                 |
| `contains(path.region)` | `'nor'` (a substring) | `'north-east'`           |

`inRange` makes the divergence visible: a criterion of `{ min: 100, max: 500 }` against a cell
value of `250` cannot be the same function under one name. Even where the types coincide, the two
differ in three ways that hold regardless of type:

- **Cardinality.** One criterion, table-wide; N values, one per row — this is why one resolver
  needs a subject argument and the other cannot take one.
- **Direction.** The criterion is _written_ — `node.value()` is a writable signal the UI binds to
  (`engine/filters/evaluator.ts:15-19`). The value is _read_ — the accessor's output, never
  written.
- **Lifetime.** A criterion exists before any rows load and survives a refetch. There is no row
  value without rows.

Collapsing the two into one `valueOf` would mean `ctx.valueOf(path.total)` and
`ctx.valueOf(path.total, row)` return `{ min, max }` and `250` from what reads like the same
function — the concrete failure the split prevents.

**The evidence for the two-tier split is an inventory, not a guess.** Across every consumer
callback in all four schemas — columns' `when`/`metadata()` logic/async `params`, grouping's
`enable`/async hooks/`extractValue`/`when`/`aggregate`/`groupOrder`, filtering's
`when`/`isEmpty`/rule `predicate`, sorting's `sortFn` — **none has exactly one row as its
subject.** Columns and `enable` get no row; `extractValue` and a filter `predicate` get a value
the library already resolved; grouping `when` and `aggregate` get N rows; `sortFn` and
`groupOrder` get two. A bound, one-argument value resolver has nowhere to attach anywhere in the
mechanism — which is why the tier rule is arity, not a per-domain convenience.

**The Signal Forms comparison, stated precisely.** The naive version of this comparison — "a
table handles more rows than a form handles fields, so it needs a different shape" — is false.
`computeChildrenMap` (`@angular/forms@22.1.2`) creates one `FieldNode` per array item,
identity-tracked by a `Symbol` stamped on the row object, with its context memoized per node
(`fesm2022/_validation_errors-chunk.mjs:1168-1210,1352-1355`). A thousand rows under `form()` is
a thousand nodes; nothing about Signal Forms is small. Its _schema path_ also names a type-level
slot (`keyof TModel`, an array collapsed to one `DYNAMIC` builder) — the same cross-section shape
`ColumnsPath` has. The real difference is narrower and lives one level down, in the **field
tree**: Signal Forms' field tree names **instances** (`p.rows[i].name` materializes per item, so
a recorded rule instantiates per item and its subject _is_ the path — one argument suffices).
This library's schema path names **columns**, a cross-section of every row, so a bound one-
argument resolver has nowhere to be the subject of. The tier rule follows from that structural
difference, not from a scale difference that does not exist.

## Alternatives considered

- **One `TableConfig.schema` every declarator records into.** Rejected — a feature's rules must
  sit with the feature; under one schema, `grouping()` could be declared with no
  `withGrouping()` composed, forcing a new inert-or-throw rule for the uncomposed case.
- **Converge filtering onto the recording (`void`) form.** Rejected — `StateOf<S>` is inferred
  from the _return type_; a `void` body erases it, and TypeScript cannot accumulate literal keys
  across imperative statements. Filtering is the only one of the four schemas with consumer-named
  state (a criterion the UI writes), which is exactly the case the object-returning form exists
  for.
- **A keyed `columns: { [id]: config }` record on a feature's own config**, considered for
  sorting. Rejected — it duplicates what the schema mechanism already expresses, producing two
  spellings for one idea.
- **One `valueOf` resolver covering both declarations and data**, with an optional second
  argument. Rejected — see "Why `criterionOf` is not `valueOf` under another name" above; an
  optional-arity function returning structurally different shapes per call site is the confusion
  the split exists to prevent.
- **A one-argument value resolver, matching Signal Forms' `valueOf(path)`.** Rejected on the
  inventory evidence: no consumer callback in this library's four schemas has exactly one row as
  its subject, so a one-argument binding has nothing to bind to.

## Consequences

- `ColumnsPath`'s keying (ADR-0019) and the single-value-source accessor (ADR-0024) are now
  joined by a stated general rule, rather than the rule living only as an inference from two
  narrower ADRs.
- ADR-0019's Amendment (2026-09-20), which deferred "the general rule now inverted... still
  owed its own ADR," is satisfied by this document; its text is updated to point here.
- ADR-0021's "Path vocabulary follows the surface" table is reconciled above, not left
  contradicted by ADR-0024's header note alone.
- ADR-0025 gains one sentence: a function that _reads_ a declaration (rather than registering
  one) ends in `Of` — `valueOf`, `criterionOf`, `stateOf` — alongside its existing bare-named
  rule for registrars.
- A third-party feature (ADR-0020) declaring its own schema and resolvers is bound by all three
  rules here: it names declared columns, picks recording vs. declaring by the same test, and its
  own resolver takes a subject argument iff it reads rows.
- G61–G68 in [`docs/decisions/grouping.md`](../decisions/grouping.md) move from `accepted, not
built` to `shipped`, each now pointing at this ADR as their built record alongside D11.

## Open

None. All three rules were already fully reasoned in D11; this ADR is the missing document, not
a new decision.
