---
title: "createFilters: infer TState from the schema"
type: spec
status: ready-for-issues
date: 2026-09-14
audience: developers
---

# createFilters — infer `TState` from the schema

Decisions: [design-options-hybrid-api.md](../with-filtering/design-options-hybrid-api.md)
(R34–R48). Evidence: [research-typescript-inference-probes.md](research-typescript-inference-probes.md).
Architecture: [architecture.md](architecture.md).

## Problem Statement

`createFilters()` builds a filter model whose criterion map — which keys exist and what shape
each criterion is — is fully determined by the schema the consumer just wrote. The consumer has
to write it a second time anyway.

Every call site today declares a hand-written `TState`:

```ts
type ClientInvoiceFilterState = {
  status: string | null;
  amount: { min: number | null; max: number | null };
  search: string;
};
readonly filters = createFilters<InvoiceRow, ClientInvoiceFilterState>((path) => {
  equals(path.status);
  inRange(path.amount);
  anyOf('search', (path) => { contains(path.customer); contains(path.notes); });
});
```

Four things go wrong with that.

1. **The two halves drift silently.** Nothing cross-checks the hand-written map against the rules.
   Rename a path, add a rule, change a criterion shape, and the type still compiles — now
   describing a filter set that no longer exists.
2. **Forget `TState` and everything widens.** It defaults to `Record<string, unknown>`, so
   `filters().value()` hands back `unknown` criteria and `filters.status()` is not reachable at
   all. The failure is silent: no error, just criteria you cannot read.
3. **Partial type-argument inference does not exist in TypeScript.** Naming `TRow` — which every
   call site must, since there is no data argument to infer it from — forces `TState` to be named
   too. One annotation drags in the other.
4. **Two documented landmines come with it.** `TState` must be declared as a `type`, never an
   `interface`; and the feature's `In` type parameter must never be passed explicitly. Both are
   consequences of the manual parameter, and both are things a consumer has to be told.

Seven exported `*FilterState` types exist in this library purely to feed the parameter. None of
them carries information the schema beside it does not already state.

## Solution

The schema's rules return their own records, and the schema returns the collection of them. That
return is the inference channel — `TState` folds out of it, and the second type parameter goes.

```ts
readonly filters = createFilters(this.invoices, (path) => [
  equals(path.status),
  inRange(path.amount),
  contains(path.customer, { as: 'client' }),
  anyOf('search', [contains(path.notes), filter(path.id, matchesInvoiceNumber)]),
]);
// Filters<InvoiceRow, { status: string | null; amount: {min;max}; client: string; search: string }>
```

Nothing is annotated. `TRow` comes from the first argument — the rows themselves, in any shape
the consumer already holds (an array, a signal, a resource's value, a store method) — and where
no data exists yet, from `rowOf<InvoiceRow>()`, a row-type token that carries nothing else.
`TState` comes from the returned array. The declaration is the single statement of the filter
set; there is no second copy to keep in sync.

The criterion shapes infer exactly, including a custom `filter()`'s — taken from the predicate's
own annotation — so even a bespoke compound criterion needs no hand-written entry.

Three guards make the shapes that used to fail silently fail loudly instead: an empty untyped
first argument reports that the row type could not be inferred and names the fix; a schema that
calls rules as bare statements instead of returning them throws at construction; and an `anyOf`
group that mixes criterion types, or declares no children, stops compiling.

## User Stories

1. As a table consumer, I want `createFilters` to infer the criterion map from my schema, so that
   I state each filter once instead of twice.
2. As a table consumer, I want to delete my hand-written `*FilterState` type, so that renaming a
   filter cannot leave a stale type behind that still compiles.
3. As a table consumer, I want `filters().value()` to return my exact criterion map, so that I can
   read each criterion without a cast.
4. As a table consumer, I want `filters.status()` reachable by property access with its own
   criterion type, so that binding one filter to one control is type-safe.
5. As a table consumer, I want `filters().active()` typed as a partial of my map, so that the
   object I hand to a request builder is checked against what I declared.
6. As a table consumer, I want `filters().reset(value)` to accept a partial of my map, so that
   restoring a persisted snapshot is checked key by key.
7. As a table consumer, I want to pass my existing rows to `createFilters` and get `TRow` for
   free, so that I never annotate a row type I already have a value for.
8. As a table consumer holding rows in a signal, a writable signal, or a resource's value that is
   `undefined` before it loads, I want all three accepted as the row carrier, so that I do not
   unwrap anything to declare filters.
9. As a table consumer holding rows behind a store method, I want a bare `() => Row[]` accepted,
   so that I can pass the accessor I already have.
10. As a server-mode consumer, I want `rowOf<Row>()` to stand in for data that does not exist yet,
    so that I can declare filters that produce the request that produces the rows.
11. As a server-mode consumer, I want `rowOf<Row>()` to be the only special case I learn, so that
    client and server mode share one function signature.
12. As a table consumer, I want it stated plainly that the first argument is an inference anchor
    and is never read, so that I do not believe the filter set is bound to that data.
13. As a table consumer, I want a custom `filter()`'s criterion type inferred from my predicate,
    so that a compound criterion needs no hand-written map entry.
14. As a table consumer, I want `as` to keep renaming a borrowed key, so that two filters over
    related paths can coexist without contriving path names.
15. As a table consumer, I want `{ as: someStringVariable }` rejected, so that a widened key
    cannot silently produce an untyped entry in my criterion map.
16. As a table consumer, I want `anyOf` to keep its positional key, so that a group that has no
    path to borrow from still names itself once.
17. As a table consumer, I want an `anyOf` group with no children rejected at compile time, so
    that an empty group is caught where I wrote it rather than at construction.
18. As a table consumer, I want an `anyOf` group mixing a string child with a range child
    rejected, so that the shared emptiness test cannot be applied to a criterion it does not fit.
19. As a table consumer, I want `applyWhen` to keep gating a set of rules behind one condition,
    so that a dependent filter only applies once its parent criterion is chosen.
20. As a table consumer, I want each rule inside `applyWhen` to keep its own top-level key in the
    criterion map, so that nesting is syntax and not a change in the state shape.
21. As a table consumer, I want a gated rule set placed directly in the schema array to keep its
    filters, and a spread of it to fail loudly at compile time, so that no spelling of `applyWhen`
    can silently drop filters from both the type and the runtime.
22. As a table consumer who passed an empty untyped array, I want an error naming `rowOf()` as the
    fix, so that I am not left with a path object that accepts any property name.
23. As a table consumer migrating from the previous shape, I want a schema body that calls rules
    as bare statements to throw at construction with the array form in the message, so that the
    one migration mistake I am likely to make is caught on first run.
24. As a table consumer, I want duplicate keys and duplicate paths to keep throwing at
    construction, so that a declaration conflict is reported before any data flows.
25. As a table consumer, I want `Filters<Row, State>` to require its criterion map, so that a
    hand-written annotation cannot silently widen every criterion to `unknown`.
26. As a table consumer, I want the "`TState` must be a `type`, not an `interface`" rule gone, so
    that I have one less library-specific constraint to remember.
27. As a table consumer, I want the "never pass the feature's `In` explicitly" rule gone, so that
    the table feature has no type parameter left for me to get wrong.
28. As a table consumer, I want a shared schema to stay a plain exported function, so that I can
    reuse a filter declaration across call sites with no new concept.
29. As a table consumer, I want `path.` autocomplete over my row's fields preserved, so that I
    keep the checking the previous shape gave me.
30. As a table consumer, I want a cell's type available inside a custom `filter()` predicate where
    I write it, so that the predicate is checked at its declaration.
31. As a table consumer, I want `createFilters` to stay standalone and take no table, so that the
    server-mode ordering — filters produce the request that produces the rows — still works.
32. As a table consumer, I want the table to keep taking only a predicate list, so that the filter
    model reaches it through one visible line and the two objects stay independent.
33. As a table consumer, I want filter-set state semantics unchanged — `value`, `active`, `reset`,
    `dirty`, `matcher`, source defaults, empty criteria, null-cell handling, throwing-predicate
    degradation — so that only the declaration shape changes.
34. As a library maintainer, I want the ambient recorder deleted outright rather than kept beside
    the new channel, so that no schema can declare a rule the inferred type does not know about.
35. As a library maintainer, I want a hard cutover with no dual-mode overload, so that a mixed
    schema cannot run a rule the type omits.
36. As a library maintainer, I want the rule collection constrained without ever naming the key
    type, so that contextual typing cannot widen every rule's key to `string`.
37. As a library maintainer, I want the type facts asserted in a compiled spec, so that an
    inference regression fails the typecheck rather than being discovered at a call site.
38. As a library maintainer, I want every story host and spec rewritten in one pass, so that the
    call-site layer is edited once rather than once per plan.
39. As a documentation reader, I want the filters docs to show the array schema and the carrier
    argument, so that the published surface and the shipped one agree.
40. As a documentation reader, I want the superseded decisions marked where they stand, so that
    the design record reads as a history rather than as competing instructions.

## Implementation Decisions

**Scope.** R34–R42 and R44–R47 of the decisions doc. R43 is obsolete — `matcher()` already puts
the row type in the body, so the phantom brand it proposed must not be built. R48 has shipped; the
table already takes a predicate list and nothing else.

### The inference channel

- **Rules return their record; the side-effect recorder is deleted (R34).** `equals`, `contains`,
  `inRange`, `inDateRange`, `hasAny`, `hasNone` and `filter` return a rule record instead of
  `void`. Hard cutover — the ambient recorder module, its stack, its session, its symbol and its
  path-staleness assertion all go, along with the non-reentrancy caveat and the `anyOf` row-type
  gap that came with them.
- **No dual-mode overload.** Rejected on correctness, not migration cost: a schema that returned
  some rules and called others bare would run the bare rule and omit it from the inferred map —
  the type lying about the runtime, silently. Under the cutover that same statement is merely
  inert, which is a lint problem rather than a divergence.
- **The schema returns an array of rules; keys stay implicit (R36).** The criterion map is folded
  from the returned tuple by mapping each rule's key to its criterion. The array is what preserves
  today's ergonomics — one key space, keys borrowed from paths, `as` renaming, `anyOf`'s positional
  key. An object-literal schema infers equally exactly and was rejected on cost: it would delete
  `as` and the positional key, and make every call restate in a property name what the path
  already says.
- **A third `model` argument was rejected.** Signal Forms needs no return channel because its model
  *is* its type. Filters have two key spaces — rules read row paths and write criterion keys, and
  the row does not determine the criterion. A model would state every key a second time with
  nothing cross-checking the two.
- **`path` stays a callback parameter (R38).** Rest arguments over a free-standing path token
  became possible once rules stopped recording, and were rejected: rules evaluate eagerly as
  arguments, so the path must be bound to a name first, and a loose path can be paired with the
  wrong carrier. String keys were rejected outright — they drop path autocomplete, drop row-key
  checking where the rule is written, and leave a custom predicate's cell untyped.
- **A shared schema is a plain exported function** taking the path and returning rules. It carries
  no inferred state of its own until applied; the criterion map materialises at `createFilters`.

### The row carrier

- **`createFilters(rows, schema)` takes a wide first slot (R35).** Data *or* a row-type token. One
  argument serves both modes, with no named carrier or evidence type. Accepted: an array, a
  readonly array, a signal, a writable signal, a signal of `rows | undefined`, a bare accessor
  returning rows, and the token. Non-row values are rejected.
- **The carrier is an inference anchor and is never read at runtime.** `createFilters` stays
  standalone; rows reach the engine through the table feature's predicate list. The wide slot was
  chosen over a token-only slot for ergonomics, accepting that the call reads as if it binds —
  which must be stated at the top of the signature's documentation, not left to be discovered.
- **The server-mode token is `rowOf<Row>()`, exported publicly (R42).** A phantom value carrying
  only a row type. Its near-collision with the internal row-extraction helper is accepted —
  casing separates them. Dropping the token and naming the row type instead is not viable:
  partial type-argument inference does not exist, so naming one parameter forces the other.
- **Supersedes "no data argument" (R11).** Data is accepted when it exists; the token is the
  server-mode escape hatch rather than a separate API.

### Guards

- **An empty untyped carrier resolves the path to an error-shaped type (R39).** Inferring the row
  type as `never` makes the path an index signature, so every property access compiles and every
  criterion degrades. The path type instead becomes a single branded property whose name and value
  say the row type could not be inferred and to pass the token. The error lands on the first
  property access. Guarding the schema parameter instead was rejected: it blames the schema rather
  than the empty carrier that caused it.
- **A schema that does not return its rules throws at construction (R40).** Deterministic, fires
  on first run before data flows — the construction class of the error-handling ADR, alongside the
  existing duplicate-key and duplicate-path checks. The message names the array form. It catches
  the whole-body mistake, which is the one a reader migrating from the previous shape will make; a
  mixed body that returns some and bare-calls others is accepted residue rather than paid for with
  a purpose-written lint rule. The off-the-shelf unused-expression rule does not fire here — it
  deliberately permits bare calls, and after the cutover these calls have no side effects.
- **Duplicate keys and paths keep throwing at construction.** The type-level merge a duplicate key
  would produce is unobservable: construction throws before anyone reads the map.

### Composition rules

- **`anyOf` takes a non-empty tuple of children, and its shared criterion is checked (R44).** Two
  things the previous shape could not express: an empty group becomes a compile error rather than
  only a construction throw, and a group mixing criterion types stops compiling. The group borrows
  its emptiness definition from its first child, which becomes sound rather than merely
  conventional once one shared criterion type is inferred. The runtime throw stays as a backstop
  for untyped callers. The constraint names no key type, so the widening trap below does not apply.
- **`applyWhen` returns one nestable node (R37).** Returning an array for the caller to spread
  introduces a failure the previous shape could not have: a forgotten spread leaves a nested array
  that the fold skips, and those filters disappear from both the type and the runtime with no error
  at either level. Instead it returns a single value carrying its children and the fold recurses,
  so the node is placed directly and never spread. **Corrected 2026-09-14 during `/implement`:** the
  spread form does not "also work" as first written — a node has no `[Symbol.iterator]`, so
  `...applyWhen(…)` is a `TS2488` compile error. That is strictly better than the equivalence
  originally specified: the omitted spread is correct and the written one is loud. Cost: one
  recursive conditional paid once in the library, against silent data loss paid at every call site. Gating semantics are
  unchanged — every rule inside shares the one gate, each keeps its own top-level key.

### Type surface

- **The criterion map loses its `Record<string, unknown>` default (R41).** It existed only because
  the parameter was optional to supply. Kept, it is a silent-widening trap: the filter type is not
  assignable to its own defaulted form, because each node holds an invariant writable signal, so a
  helper annotated with the defaulted form receives unreadable criteria. No consumer writes the
  parameter any more — declaration infers it, and the table feature has none left.
- **`as` becomes genuinely enforceable (R45).** The literal-key guard already existed but never
  bit, because the key had no real inference site. With rules returning their record it is
  inferred per rule call from the option itself, and the guard fires.
- **Do not build the phantom row brand (R43, obsolete).** `matcher()` compiles a real row
  predicate, so the row type is already in the body. Both assertions the brand was for already
  exist and already pass.
- **The table feature is untouched.** It takes a required predicate list and an optional manual
  flag, has no type parameter to infer, and imports nothing from the filters domain. The two
  documented landmines delete with the parameter, and the issue tracking them closes as
  fixed-by-design rather than as work.

### Call sites and layout

- **The call-site layer is one pass.** Every site that changes shape gets its schema rewritten and
  its annotation deleted in the same edit. Five story hosts and fixtures plus the surviving spec
  sites; five exported criterion-map types delete along with two spec-local ones.
- **Three reviewable units: library, call sites, docs.** The library change breaks every call site
  until the second lands, so the first two share one branch and the build is green only at the end
  of the second. Docs are parallel-safe once the signature is settled.
- **The filters barrel split is sequenced after, not merged in.** It is pure churn that conflicts
  with every other diff; the token is exported from wherever the domain's public surface lives
  when it lands.

## Testing Decisions

**What makes a good test here.** Assert what a consumer can observe from the public call: which
criterion map comes back, what the runtime does with a given schema and a given row set, and which
malformed declarations are rejected. Never assert the shape of a rule record, the fold's
intermediate types, or how the path object is fabricated — those are the mechanism, and the whole
point of this change is that the mechanism moved while the semantics did not.

**Two seams, both at the public `createFilters()` call.**

1. **Runtime** — the existing filters spec. Declaration through to narrowed rows: criteria read
   and written, source defaults, empty criteria skipped, groups OR'd, gates applied, resets,
   dirtiness, and the construction throws. Every existing case must keep passing with only its
   schema rewritten to the array form; a case that needs its *assertion* changed is a semantic
   regression and must be justified against the decisions doc, not accommodated.
2. **Types** — a new compiled type spec, a sibling of the runtime spec. Type facts only, asserted
   with the test runner's type-assertion helper and expected-error comments. This seam is new and
   was chosen over growing the runtime spec: the two are enforced by different tools, and the
   existing spec is already long enough that a third of it being inert at runtime would mislead.

**The type spec is enforced by the project typecheck, not the test runner.** The runner does not
typecheck assertions — they are inert when executed. The file must therefore be picked up by the
spec typecheck configuration; naming it so it matches the existing spec glob is preferred to
widening the configuration.  Existing prior art: the type-assertion block at the end of the
current filters spec, and the equivalent block in the table feature's spec, both of which carry
the same note about which tool enforces them.

**What the type spec must assert.** That the criterion map folds from the returned array, keys and
criterion shapes both; that a custom predicate's criterion type survives; that every accepted
carrier yields the right row type and non-row values are rejected; that the token yields its row
type; that an empty untyped carrier produces the branded error type on first property access; that
a widened `as` key is rejected; that an empty group and a mixed-criterion group are rejected; that
a nested gate's rules land as top-level entries when the node is placed directly, and a spread of
it is rejected; that the filter type no
longer accepts a missing criterion map; and that the row type is enforced by `matcher()`.

**Not tested.** The table feature's spec needs no new cases — it already takes only predicates.
Cross-feature specs stopped building filter schemas when the decoupling landed and must not
acquire them again; a cross-feature spec asserting a filters type fact is coupling, not coverage.

## Out of Scope

- **The table feature's config.** Already settled and shipped: a required predicate list, nothing
  else. Not reopened here.
- **The phantom row brand.** Obsolete — do not build it.
- **Persistence and the shared storage feature.** Deferred by design to a separate feature; the
  consumer serialises the criterion map and restores it through reset.
- **Debounce.** The consumer debounces, through a form over the model.
- **Runtime operator pickers, data-derived filter options, per-filter server encoding, a second
  filter on one path, and any null-cell option.** All settled as deliberately-not-shipped.
- **New filter kinds.** The shipped set is fixed; anything else is a custom predicate.
- **Changing filtering semantics.** Combination, emptiness, null cells, pipeline position and
  degradation on a throwing predicate are all unchanged.
- **The filters barrel split and the domain relocation.** Tracked in the decoupling ticket.
- **Whether the shipped kinds remain sugar.** The acceptance test stands — a consumer must be able
  to ignore every kind and lose nothing but typing convenience — but it is a standing standard,
  not work in this spec.

## Further Notes

- Every type-level claim behind this spec is a compiled assertion under this repo's own TypeScript
  and strict settings, in the inference-probes research doc. Two of its stated holes are corrected
  by the decisions doc: key collision is not open, because construction throws first; and the
  off-the-shelf lint rule it proposed for bare statements does not fire.
- The decisions doc must be reconciled as part of the docs unit: the row-type-recovery claim is
  factually wrong, the recorder decision ceases to exist rather than being superseded, and the
  obsolete brand needs its banner to stay legible.
- Migration cost is not a factor in any decision here. Every call site is inside this library;
  there are no external consumers.
- The standalone-primitive half of this design remains unprecedented among the surveyed table
  libraries. That was accepted on the grounds that server mode leaves no alternative, and it is
  unchanged by this spec — which only changes how a filter set is declared, not whether it can
  exist without a table.
