---
title: Spec — positional feature composition and library-declared derived state
type: spec
capability: composition
spec: drilled
code: none
status: ready for issues
date: 2026-09-12
audience: developers
---

# Positional feature composition and library-declared derived state

Grounded in [`3-decisions.md`](3-decisions.md) (D19-D24) and [`2-research.md`](2-research.md).

## Problem Statement

Two problems, one root cause.

**A consumer cannot ask the table for a value derived from its own state.** "How many rows are
selected but hidden by the active filter" is a question the table has every input for —
`selectedRows()`, `rows()`, `value()` — yet the answer has to be assembled by hand in a component
field, where no directive can reach it and nothing can pass it around as one object. The table owns
the state; the consumer owns the derivation. Every product re-derives the same handful of values,
slightly differently, and a table-level concept ends up living in component-level code.

**Composing features is noisy in a way that has nothing to do with the consumer's intent.** Every
feature call has to repeat the row type — `withSorting<Invoice>()`, `withGrouping<Invoice>()`,
`withSelection<Invoice>()` — even though the row type was already stated, unambiguously, one
argument earlier when the data signal was passed. Forget one and the feature silently types against
`unknown`. The library's own documentation records this as unavoidable.

The root cause is the same in both: a feature declares its own row type, and a row type declared in
one place cannot be inferred from another. That also blocks the first problem, because a derivation
has to be written where the store's full type is known, and that place is the consumer's component.

## Solution

Features stop carrying a row type. A feature becomes a function of the store built so far, and
recovers the row type from what it is handed. The row type is then stated exactly once — where the
data is passed — and flows through every feature after it.

That unlocks positional composition: each feature is an argument to `createTable()`, and each one
sees the accumulated store type of everything before it. Nothing needs an explicit type argument.

Derived state then falls out for free rather than needing a mechanism of its own. `withComputed()`
is a feature like any other — it takes the store built so far and returns signals to add to it. It
composes in two places, with the same meaning in both:

- **inside the feature that owns the state** — `withSelection(config, withComputed(...))` — where it
  sees core plus that feature's members;
- **as its own argument** — where it sees core plus every feature declared before it.

The consumer writes what they mean, once, and reads it back off the store as a first-class member:
`table.hiddenSelected()`.

```ts
// Shape verified against the library's real types; see 2-research.md.
const table = createTable(
  this.data,
  { trackBy: 'id', columns, columnsSchema: (c) => [applyVisible(c.total, () => this.showAmounts())] },

  withSelection(
    { enableMultiRowSelection: (row) => row.status === 'open' },   // row: Invoice
    withComputed((store) => ({
      hiddenSelected: computed(() => store.selectedRows().size - store.rows().length),
    })),
  ),
  withGrouping({ initial: ['status'] }),
  withSorting(),

  withComputed((store) => ({
    groupTick: computed(() => store.hiddenSelected() + store.grouping().length),
  })),
);
// table: TableStore<Invoice> & SelectionMembers & { hiddenSelected: Signal<number> }
//        & GroupingMembers<Invoice> & SortingMembers & { groupTick: Signal<number> }
```

## User Stories

### Composing a table

1. As a table consumer, I want to pass my row-data signal directly as the first argument, so that the
   row type is stated once and nothing repeats it.
2. As a table consumer, I want to compose features without writing a type argument on any of them, so
   that adding a feature is one call and not a call plus a type I have to keep in sync.
3. As a table consumer, I want the required configuration — `trackBy`, `columns` — to be a plain
   object in a fixed position, so that I cannot forget it and it is never confused with an optional
   feature.
4. As a table consumer, I want `with*` to mean exactly one thing — an optional feature — so that
   reading a `createTable()` call tells me immediately what is required and what is opt-in.
5. As a table consumer, I want a table with no features at all to be one call with two arguments, so
   that the simplest case stays simple.
6. As a table consumer, I want my editor to autocomplete column ids from my row type inside feature
   config, so that a typo in a grouping or sorting default is caught as I type.
7. As a table consumer, I want a feature's row-typed callbacks to receive my row type, so that
   `enableMultiRowSelection: (row) => row.status === 'open'` type-checks without annotation.
8. As a table consumer, I want the column schema callback to receive the typed column path proxy, so
   that schema rules keep the autocompletion they have today.
9. As a table consumer, I want to compose more features than the positional form natively accepts, so
   that the library never caps how composable my table can be.
10. As a table consumer, I want to group a set of features I always use together into one reusable
    unit, so that my app's standard table is a single call.
11. As a table consumer, I want to construct a table outside an injection context by supplying an
    injector, so that services and tests can build one.

### Declaring derived state

12. As a table consumer, I want to declare a derived value where I compose the feature it derives
    from, so that the derivation lives next to the state it reads.
13. As a table consumer, I want a derived value to appear on the store as an ordinary signal member,
    so that I can read it in a template, pass it to a directive, or hand the whole store to a child.
14. As a table consumer, I want a derivation that spans several features to see all of them, so that
    "are all visible rows selected" can be expressed at all.
15. As a table consumer, I want the store passed to my derivation to be fully typed, so that reading
    a member of a feature I did not compose is a compile error rather than a runtime `undefined`.
16. As a table consumer, I want my derivation to be read-only over the store, so that I cannot
    accidentally write state from inside a computation.
17. As a table consumer, I want derived members to recompute only when their inputs change, so that
    they cost the same as a `computed()` I would have written myself.
18. As a table consumer, I want a derived member that clashes with an existing member to fail loudly
    at construction, so that the collision is never resolved silently by declaration order.
19. As a table consumer, I want a derivation that throws to name the member it was computing, so that
    I can find it without stepping through the framework's anonymous computations.
20. As a table consumer, I want derived values excluded from persisted state, so that a snapshot
    never restores a stale derivation over a fresh one.
21. As a feature author, I want to offer a derive block on my own feature without writing any
    plumbing, so that a third-party feature behaves exactly like a first-party one.

### Keeping what already works

22. As a table consumer, I want pipeline order to stay fixed — filter, group, sort, expand —
    regardless of the order I pass features, so that reordering arguments never changes which rows
    are shown.
23. As a table consumer, I want two features claiming the same store member, pipeline stage, or
    render stage to keep throwing at construction, so that composition errors stay loud.
24. As a table consumer, I want feature state to keep reconciling when rows are removed, so that
    selection and open edits do not retain dead ids.
25. As a table consumer, I want `setup` hooks to keep running after the whole composition, so that a
    feature can still read any other feature's members.
26. As a table consumer, I want the store instance to stay owned by the component that created it, so
    that teardown behaviour does not change.
27. As a table consumer, I want my row data to remain the single source of truth with no internal
    copy, so that writes through the store and writes through my own signal cannot diverge.

### Migrating

28. As an existing consumer, I want a clear mechanical rewrite from the array form to the positional
    form, so that migrating is find-and-replace rather than redesign.
29. As an existing consumer, I want the library's own documentation to stop telling me to repeat the
    row type, so that the guidance matches the code.
30. As a maintainer, I want each shipped feature converted in one pass with its own tests, so that a
    half-migrated library never exists on the main branch.

## Implementation Decisions

### The feature contract

- A feature is a function from the store built so far to a feature spec. It no longer takes a row
  type parameter of its own; the row type is recovered from the store shape it is handed. This
  reverses ADR-0003's recorded rejection of inferring the row type into feature calls, and that ADR
  owes an update.
- A feature's declared members are its contribution only. The composed store type is the
  intersection of the base store and every feature's contribution, accumulated in argument order.
- The feature-to-feature seam (`composed`, the factory's second parameter) is retired. Positional
  accumulation replaces it, typed. One shipped feature reads it today — grouping reads expansion's
  `expandedRows` lazily inside its group render stage, guarded — and that read survives unchanged
  as a lazy, guarded read of the store handed in. The rule it illustrates: the **type** of a
  feature's input includes only the features declared before it; the **runtime** object is one
  shared reference, so a read deferred to a method, a `computed()` or a stage sees every feature
  regardless of order. Types are the stricter of the two. (Review finding 1, 11.)
- `createTableFeature()` — the authoring identity helper — is re-typed to the new contract and keeps
  its purpose: an external author never names the engine's types directly. It also carries the
  one-time plumbing that lets any feature accept a trailing derive block — call the block with the
  input intersected with the feature's own members, merge its contribution — so a third-party
  feature offers a derive block without writing it.
- Two engine-internal members features read today are settled (D25): `indexById` (row id →
  position in `data`) becomes a public read-only store member, since both editing features need it
  and a feature can only reach what is on the store; `baseColumns` stays engine-only, because the
  column-schema wiring that reads it is spliced internally and keeps taking the core handle.

### The call shape

- `createTable(data, config, ...features)`. Data is passed directly. Required configuration
  (`trackBy`, `columns`, optional `columnsSchema`, optional `injector`) is a plain object in the
  second position. Every remaining argument is an optional feature.
- The configuration thunk is removed. Arguments already evaluate once, and nothing in the
  configuration was ever reactive — only `data` is.
- `injector` moves into the configuration object. A trailing options argument cannot coexist with a
  variadic argument list.
- The existing configuration builder, whose only purpose is producing that thunk, is removed; the
  object literal stands on its own and `trackBy` is stated explicitly at every call site (consistent
  with story 3 — required config cannot be forgotten). Settled as D25.
- The migration is documented as a before/after table (thunk + array → positional; `withX<TRow>()`
  → `withX()`; config builder → plain object with explicit `trackBy`; trailing `injector` option →
  `config.injector`), owed to the library `CLAUDE.md` (story 28).
- `columnsSchema` keeps accepting both an inline schema function and a standalone schema value. The
  always-spliced internal column-schema wiring step stays internal — it does not become a
  consumer-facing feature, so ADR-0010 is untouched.

### Typing

- `createTable()` is declared as a set of per-arity overloads; slot N is typed against the base store
  intersected with every preceding slot's contribution. This is the mechanism that makes inference
  work without type arguments, and it is the reason for the arity limit below.
- Arity: 15 slots, settled (D27). A `withComputed()` occupies a slot like any other feature.
  Exceeding the limit is a compile error at the call site, naming no overload as matching. The
  overloads are **generated** — `composeFeatures()` needs the same accumulating set, so ~30
  near-identical blocks exist — from a repo-side script whose committed output is checked for
  drift.
- `composeFeatures(...)` collapses a group of features into a single feature, which occupies one
  slot. This is the documented escape hatch for the arity limit and doubles as the way an app
  packages its standard feature set. Verified: a following slot still sees the composite's full
  member contribution.
- A feature contributing no members must declare an empty contribution, not a bare object type, or a
  cosmetic artefact leaks into the composed store type.
- Three inference hazards must be guarded in the shipped types, because each one degrades silently to
  `any` at a consumer's call site rather than erroring at the declaration. They were found by
  prototype and are recorded with reproductions in the research doc: a wildcard in a constraint's
  derived slot collapses the entire store type; an omitted optional callback infers its type
  parameter as its constraint rather than its default, leaking an index signature that swallows
  every member lookup; and declaring the derive helper's return type as an intersection of two
  shapes breaks slot inference outright.

### Derived state

- `withComputed(factory)` is a feature. It returns the same type every feature returns, which is
  precisely why it composes both as its own argument and as an argument to another feature. No
  separate derive-specification type exists.
- A derive block returns a dictionary of signals only. Parameterized queries stay ordinary feature
  members; the block composes them rather than replacing them.
- The store handed to a derive block is read-only. This is a **type-level projection** of the
  input — write views (`value`, `columns`, `editing`) lose their `.update` path, so writing through
  them is a compile error (story 16). Mutating *methods* a feature contributes (`selectRow`,
  `beginEdit`) cannot be distinguished from queries statically and stay visible; not calling them
  from a block is convention, stated in the docs, not enforced.
- The evaluation-error wrapper and the non-signal check below live **inside** `withComputed()`,
  not in the fold. The fold treats a derive feature like any other; a fold-level signal check
  would reject every method member an ordinary feature contributes.
- Derived members are claimed through the existing member registry, with a claimant label naming the
  feature and the block rather than a bare argument position. A collision throws at construction,
  exactly like a feature-vs-feature member collision.
- Core member keys are pre-claimed before the fold, closing a pre-existing hole: today a feature
  declaring a core key silently shadows it, and the resulting type is a lie rather than merely
  silent — the colliding declarations intersect into an overloaded signature, and overload
  resolution reports the core type while the runtime returns the shadowing one. One key stays
  deliberately unclaimed, because the store's own contract promises a pagination or virtualization
  feature may override it.
- Error classification follows the runtime-error ADR. A derive block throwing while declaring its
  members is a wiring error: throw, wrapped with context naming the block. A derived signal throwing
  during evaluation is a graph leaf — nothing in the engine reads it — so it costs one binding, not
  the table: report once with the member key, then rethrow. The framework already caches a
  computation's error, so "once per evaluation" needs no dedupe logic. Degrading to a fallback is
  rejected: there is no neutral value for an unknown type, and a retained last-good value reads as
  correct while being wrong. This owes the runtime-error ADR a new row.
- A block returning a non-signal throws at construction, naming the key. The constraint is
  type-level only, so a JavaScript consumer can defeat it, and the alternative is a member that looks
  like a signal to every consumer and is not one.
- Derived state is not state: it must be unserializable by construction, and a derive block must not
  be able to declare a persistence slice. Trivially true today — the feature spec has no
  persistence field — so this change lands without waiting on the persistence spec. The persistence
  spec owes one row stating the exclusion, and must keep it once a persistence slice exists on the
  feature contract.

### What changes semantically

- **Argument order governs member visibility.** A feature sees only the features declared before it.
  This is new: the current fold is deliberately order-independent, and the two editing features share
  state through a standalone store specifically so composition order never mattered. That rationale
  is no longer load-bearing; the shared store stays, but the reason recorded against it changes.
- **Pipeline and render-stage order stay fixed.** Argument order never affects which rows are
  produced — only which members a given argument can see.
- **Types are stricter than runtime.** The store is one shared object; a read deferred past
  construction (method, `computed()`, stage) sees every feature in any order, exactly as the old
  `composed` late-read did. Only the factory-time type is order-dependent.
- Reconciliation on row removal, `setup` ordering, destroy hooks, and the injection-context
  requirement are all unchanged.

## Testing Decisions

A good test here asserts what a consumer can observe: the members a composed store exposes, the
values those members produce as data and state change, and the errors thrown at construction. It
does not assert how the fold is implemented, how many times a factory ran, or what the registry
holds internally.

Two seams, both existing files:

- **The public factory's runtime behaviour.** Composition of several features, derived members
  recomputing when their inputs change, member-collision and core-key-collision throws, the
  non-signal-returned throw, the named rethrow when a derived signal throws during evaluation,
  reconciliation still pruning removed ids, and `setup` still seeing every feature. Prior art: the
  existing factory spec and the existing compose spec, which already cover folding, hook ordering,
  and removal reconciliation.
- **The public factory's types**, as type assertions alongside the runtime ones in the same file,
  using the test runner's built-in type-assertion API. This seam is new in kind, not in location, and
  it exists because the payload of this change is type-level: inference with no type arguments,
  accumulated member types across slots, a derive block's parameter type (including that a write
  view's `.update` is absent), a member of an uncomposed feature being absent, a slot that cannot
  see a *later* slot's member (compile error, not a silent `any` — verified in D24), a slot after
  `composeFeatures(...)` seeing the composite's full contribution, and explicitly that the composed
  store is not `any` — that last one is the regression test for the three silent collapses found by
  prototype.

Feature-level specs stay where they are, one per feature, and are updated in the same pass as the
feature they cover. The registry keeps its own unit spec for the new core-key claims, since it is
pure and already tested standalone.

## Out of Scope

- Any change to the pipeline or render-stage model: the fixed stage order, the stage names, and the
  claiming rules are untouched.
- The proposed split of the expansion feature into panel and tree features.
- Persistence itself. This spec only fixes that derived state is excluded from it.
- The unresolved grouping semantics behind the group-header tick — the cross-feature derivation this
  mechanism enables is now expressible, but what it should compute is a separate question.
- Parameterized derived queries. Derive blocks return signals; anything taking arguments stays an
  ordinary feature member.
- Directive-layer changes. Derived members are ordinary signals and need no new binding.
- A compatibility layer keeping the array form working alongside the positional form.

## Further Notes

The sequencing that matters: the core-key pre-claim is a prerequisite, not a follow-up. It closes a
hole that exists today and that this change makes reachable — a derive block is the first mechanism
that lets a consumer name a core key by accident.

The arity limit is the one accepted limitation, taken knowingly against the library's stated goal of
being maximally composable. It is a type-level artefact only: the runtime accepts any number of
features, and no configuration, provider, or injection can raise the type-level count — an injection
token has a single declared type, so features supplied through it arrive untyped and every derived
member degrades. If the limit ever bites, the composite helper absorbs it; if it bites often, that is
the signal to revisit.

Everything above is typing-verified against the library's real types and nothing is verified at
runtime. The earlier judgement that no prototype branch was needed predates the architecture change
and should be re-taken when the work is planned.
