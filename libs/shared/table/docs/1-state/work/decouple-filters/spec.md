---
title: Spec — decouple createFilters() from withFiltering()
type: spec
date: 2026-09-14
status: drafted
audience: developers
---

# Decouple the filter model from the table

Decisions: [migration-decouple-filters-from-table.md](../with-filtering/migration-decouple-filters-from-table.md)
(S1–S6). This document is the contract; that one is why.

## Problem Statement

The table library ships two things that read as one. `createFilters()` builds a filter model that
is meant to work with no table at all — that is the whole point of it, and server mode depends on
it. `withFiltering()` applies a filter model to rows in the pipeline. They were designed as
separate domains and implemented as a single welded unit, and every seam between them leaks:

- **The feature cannot be used without the filters closure.** A developer who already has a
  predicate — a handwritten `(row) => boolean`, a permission check, a rule from somewhere else
  entirely — has no way to hand it to the table. The only supported input is a whole
  `createFilters()` object, so the cheapest possible filter is also the one the library refuses.
- **The filters object cannot be used without the table's evaluator.** Everything needed to turn
  a filter model into a row predicate lives behind an internal symbol stamped onto the object
  after construction, readable only by a function the feature imports. A consumer holding a
  filters object cannot ask it the one question it exists to answer: *does this row match?*
- **The feature declares a type parameter it never uses.** The criterion-map type is threaded
  through the feature's config purely so it survives the trip, and doing so leaks two rules a
  developer must know and cannot discover: the type must be declared one particular way, and one
  particular type argument must never be passed explicitly. Both are landmines with no diagnostic
  — the compile error, when it comes, names neither cause.
- **The row type is a lie.** The filters type declares which row it reads but never uses that
  declaration, so a table of one row type accepts a filter set built for a completely different
  one. Every predicate then reads fields that do not exist, silently, and the table renders an
  empty or unfiltered result with no error at any level.
- **The docs are coupled too.** One spec file is pointed at by both the feature and the
  primitive, so there is no document describing either one alone.

None of this is load-bearing. It is the shape the two landed in when they were built in one pass.

## Solution

Cut the seam in both directions, so that each side is usable and testable with no knowledge of
the other.

**The table asks for predicates, not for filters.** The feature's config takes a function
returning a list of row predicates. It imports nothing from the filters domain, names no filter
type, and declares no criterion-map type parameter. A developer with one handwritten predicate
composes the feature with one line and never touches `createFilters()`.

**The filter model answers the match question itself.** The filters root gains a method returning
a row predicate compiled from its own current criteria. The internal side channel that the
evaluator reached through is deleted; the evaluator becomes a private detail of the filters
domain, and the filters object exposes the one thing a consumer actually wants from it.

Wiring the two together is then ordinary composition — the consumer passes the filter model's
predicate into the table's predicate list — and neither side has a compile-time dependency on the
other.

Two consequences fall out rather than being designed in:

- **The row type stops being phantom.** The new method consumes it, so a filter set built for the
  wrong row type is rejected at compile time instead of failing silently at runtime.
- **The criterion-map type parameter disappears from the feature**, and with it both call-site
  landmines and the closed issue that reported them.

Finally, the filters domain moves to its own top-level folder with its own barrel, so the seam is
visible in the directory listing before anyone tries to cut it for real. Extracting it to a
separate package later becomes a move, not a rewrite — but that extraction is explicitly not part
of this work.

## User Stories

### Using the table with a plain predicate

1. As a developer filtering a table, I want to hand the table a plain row predicate, so that I can
   filter without adopting a filter-model library I do not need.
2. As a developer with one condition, I want composing filtering to cost one line, so that the
   simplest case is not priced like the most complex one.
3. As a developer, I want the table's filtering config to name no filter-model type, so that I can
   read its signature and understand it without opening another domain's documentation.
4. As a developer, I want to pass several independent predicates at once, so that I can express
   unrelated conditions without hand-combining them into one function.
5. As a developer, I want the table to combine my predicates with AND, so that each one narrows
   the result further and the combination needs no explanation.
6. As a developer, I want my predicate list recomputed when its inputs change, so that filtering
   reacts to state the same way every other part of the table does.
7. As a developer, I want one evaluation to see one consistent predicate list, so that rows within
   a single pass are never tested against different criteria.
8. As a developer, I want to keep composing the feature but skip its work, so that a table
   filtering server-side can still declare filtering without paying for it client-side.

### Using the filter model on its own

9. As a developer holding a filter model, I want to ask it directly for a row predicate, so that I
   can use it without the table library's internals.
10. As a developer, I want that predicate to reflect the model's current criteria, so that I do
    not have to track invalidation myself.
11. As a developer filtering server-side, I want the filter model to remain fully usable with no
    table composed at all, so that the model can feed the request that produces the data.
12. As a developer, I want to filter a plain array with my filter model, so that I can reuse one
    declaration outside a table entirely.
13. As a developer, I want the filter model's public surface to include the match question, so
    that answering it is not an undocumented internal capability.
14. As a developer, I want the model's predicate to apply the same combination and emptiness rules
    the table applied before, so that decoupling changes no result.

### Type safety

15. As a developer, I want a filter set built for the wrong row type rejected at compile time, so
    that a mismatch surfaces where I can fix it rather than as an empty table in production.
16. As a developer with a structurally compatible row type, I want my filter set still accepted,
    so that the check catches real mistakes without forcing me to duplicate declarations.
17. As a developer, I want a row type carrying extra fields still accepted by a narrower filter
    set, so that the check does not punish ordinary widening.
18. As a developer, I want the table's filtering config to require no type parameter from me, so
    that there is no argument I can pass wrongly.
19. As a developer, I want to declare my criterion-map type however I like, so that a rule about
    which type-declaration form is legal stops existing.
20. As a developer composing filtering alongside other features, I want the store's recovered type
    to stay exact, so that trailing blocks and derived state keep reading correct members.

### Errors and degradation

21. As a developer, I want one throwing predicate dropped for that pass rather than crashing the
    table, so that a bad condition degrades visibly instead of taking down a screen.
22. As a developer, I want sibling predicates to keep narrowing when one fails, so that a partial
    failure does not silently widen my result to everything.
23. As a developer, I want the failure reported once per pass, not once per row, so that one bad
    predicate over a large dataset does not flood the console.
24. As a developer, I want the report to identify which predicate failed, so that I can find it
    without bisecting my list.
25. As a developer using the filter model, I want its own failures still reported under its own
    filter keys, so that I keep the better diagnostic when I have named filters.
26. As a developer, I want the degradation reported in production as well as development, so that
    the failures I cannot reproduce locally are still visible.
27. As a developer, I want construction-time mistakes to keep throwing, so that wiring errors stay
    loud and data-dependent ones stay soft.

### Migration

28. As a maintainer, I want every existing call site migrated in the same change, so that the
    library is never left in a state where filtering is half-decoupled.
29. As a maintainer, I want cross-feature tests that only needed to narrow rows to stop building
    whole filter schemas, so that they get shorter and stop testing a domain they do not own.
30. As a maintainer, I want the feature's tests to cover only table behavior, so that ownership is
    legible from the test file alone.
31. As a maintainer, I want the filter model's type behavior tested in the filter model's own
    tests, so that the feature's tests stop asserting another domain's contract.
32. As a maintainer, I want exactly one integration test proving the two compose, so that the seam
    is verified without re-testing both sides through each other.
33. As a maintainer, I want a story showing the table filtering with no filter model at all, so
    that the decoupling is demonstrated rather than merely claimed.
34. As a maintainer, I want the existing stories to keep working with a one-line change, so that
    migration cost is proportional to the change's real size.

### Structure and documentation

35. As a maintainer, I want the filter model in its own top-level folder, so that the domain
    boundary is visible before anyone tries to enforce it.
36. As a maintainer, I want that folder to own its barrel, so that a later package extraction is a
    move rather than a rewrite.
37. As a maintainer, I want the public barrel to state honestly that it re-exports a sibling
    domain, so that its own header stops being wrong.
38. As a maintainer, I want the feature and the primitive to have separate specs, so that reading
    about one does not require reading about the other.
39. As a maintainer, I want the row-type behavior change recorded as an architectural decision, so
    that a future reader finds the reasoning rather than re-deriving it.
40. As a maintainer, I want the workspace's spec pointers split, so that the coupling does not
    survive in documentation after being removed from code.

## Implementation Decisions

### The table's contract

The filtering feature's config takes a **thunk returning a list of row predicates**, replacing the
filter-model field. The thunk is the reactivity boundary and the evaluation boundary at once:

```ts
interface WithFilteringConfig<TRow> {
  /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}
```

- **One call is one evaluation.** Calling the thunk begins a pass; the returned list is used for
  every row in it. This is what scopes per-pass error reporting without any additional plumbing,
  and it is the same "one instance is one evaluation" contract the current evaluator already
  documents for itself.
- **AND is the only combinator the table may assume.** Anything richer — OR groups, conditional
  activation, shared criteria — is the filter model's business, and it has already resolved to a
  single predicate by the time the table sees it. The table composes terms; it does not interpret
  them.
- **The criterion-map type parameter is deleted** from the config interface and from both of the
  feature's overloads. Nothing in the feature reads it.
- **Both imports from the filters domain are deleted** — the evaluator factory and the filters
  type. This is the stated requirement, and it is checkable by inspection rather than by
  reasoning.
- `manual` is retained, with its rationale reduced: now that the input is a consumer-supplied
  predicate list, "skip the stage" is very close to "do not compose the feature". It stays for
  symmetry with the sort feature, which is the same argument as before, one step weaker.

### The filter model's contract

The filters root gains a method returning a row predicate compiled from its current criteria:

```ts
matcher(): (row: TRow) => boolean;
```

- **On the root, not on the callable.** The filters object is a mapped type over the criterion
  keys, so a top-level member would collide with a filter literally named `matcher`. The root is
  already a plain interface with no such hazard — the same structural reasoning that put `value`,
  `active`, `reset` and `dirty` there.
- **The row type is threaded into the root** so the method can name it. This is the mechanism by
  which the row type stops being phantom; no separate branding member is needed, and the one
  previously planned for that purpose is dropped as redundant.
- **The internal side channel is deleted** — the symbol, the function that stamps it on, and the
  function that reads it back. The evaluator takes the compiled internal state directly and
  becomes file-internal to the filters domain. It is no longer exported past the domain boundary.
- **Evaluation semantics are unchanged.** Emptiness skipping, conditional gating, OR within a
  group, AND across filters, the null-cell policy, and per-filter error dedup all stay exactly
  where they are, inside the evaluator, where the filter keys exist.

### Composition

Wiring is the consumer's, and it is one expression:

```ts
withFiltering({ predicates: () => [this.filters().matcher()] })
```

Neither side imports the other. The table never learns what a criterion is; the filter model never
learns what a pipeline stage is.

### Error isolation

The catch unit is **one term**, decided against two alternatives:

- Per row is rejected: it yields a half-filtered result set — some rows tested, some skipped — and
  puts a `try` inside the hot loop.
- Per pass is rejected: one throwing term would return every row unfiltered, which is the silent,
  unrecoverable direction.

On a throw, the term is dropped for that pass and reported once, identified by its index in the
list. A term that owns real names — one produced by the filter model — already reports under its
own filter key from inside the evaluator, so the index-based report is the floor for anonymous
terms rather than a replacement for the better diagnostic.

The reporting channel is unchanged and deliberately not widened here; making degradation
observable through something other than the console is tracked separately.

### Row-type rejection is a public behavior change

A filter set built for an unrelated row type currently compiles and is accepted. After this change
it is rejected. This is a fix, but it is a change to public type behavior and is recorded as such
in an ADR rather than slipped in as a refactor. Structural compatibility is preserved: an
identically shaped row type, or a wider one carrying extra fields, still works. Only genuinely
unrelated row types are rejected.

### Layout

The filters domain moves out of the table's API folder into its own top-level sibling of the API,
engine and directives folders, and drops the now-redundant domain prefix from the filenames inside
it, per the repo's existing folder-supplies-the-domain invariant.

The move is sequenced **last** among the code changes. It is pure churn and would conflict with
every other step's diff if done earlier.

The public barrel then either carves out an explicit filters block with a comment stating that it
re-exports a sibling domain, or delegates wholesale to the filters domain's own barrel. The second
is preferred: it makes the eventual package extraction a move rather than a rewrite, and it keeps
the barrel's own claim about being the only definition of the consumer surface honest.

### Sequencing

The two entry points are independent and can be built in parallel; everything else is sequenced
behind them:

```
S1 matcher() on the root ──┬──> S3a specs   ──┐
                           │                  ├──> S4 move to its own folder ──> S6 barrel split
S2 predicates config ──────┼──> S3b stories ──┘
                           │
                           └──> S5 docs + ADR
```

Parallel-safe: `[S1, S2]`, then `[S3a, S3b, S5]`. Chain: `S1,S2 → S3 → S4 → S6`.

### Relationship to the inferred-criterion-map work

A separate grilled design (recorded against the filtering workspace) removes the criterion-map
type parameter from `createFilters()` by making schema rules return their records. That work is
**explicitly sequenced after this one**. Two of its decisions are affected:

- The one requiring the feature's config to carry a non-defaulted criterion-map type parameter is
  moot — this change deletes that parameter entirely.
- The one adding a branding member to consume the row type is **dropped as dead work** — the new
  root method consumes the row type already.

Its remaining decisions are untouched, because they concern the schema's inference channel, which
this change does not go near.

## Testing Decisions

### What makes a good test here

Test the two contracts through their public surfaces — the feature through composing a table and
reading rows back, the filter model through building one and calling its own members. Do not test
the evaluator, the compiled records, or the removed side channel: all three are implementation,
two of them are being deleted, and the third becomes private.

The single most valuable property to test is **ownership**: after this change, reading a test file
should tell you which domain it belongs to. A test that builds a filter schema in order to check
table behavior is the exact defect being removed.

### Seams

Two existing seams, no new ones:

| Seam | Owns |
|---|---|
| The filter-model factory's own spec | the new root method, the row-type rejection, and the criterion-map typing that currently lives in the feature's spec |
| The filtering feature's spec | composition, narrowing by predicates, AND across terms, contributing no members, manual mode, trailing blocks seeing post-filter rows, and per-term degradation |

The integration case proving the two compose lands on the feature's seam, and there is exactly one
of it. Its purpose is to prove the wiring expression works, not to re-test either side.

The matcher and state specs of the filter model are untouched — neither storage nor matching
changes. No test file is deleted outright, so no coverage is lost in the move.

### Modules tested

- **The filtering feature** — rewritten to predicates. Kept and rewritten: composes into a table,
  narrows rows, ANDs across terms, never narrows when nothing is active, contributes no members,
  manual mode, trailing block sees post-filter rows. Deleted: the criterion-map type tests, since
  the parameter is gone. Inverted: the assertion that a mismatched row type is *accepted* becomes
  an assertion that it is rejected. Added: a throwing term is dropped while siblings keep
  narrowing.
- **The filter-model factory** — gains the new root method's tests, and receives the OR-semantics,
  empty-criterion and typed-criterion-map tests that currently sit in the feature's spec.
- **Cross-feature specs** (selection utilities, grouping) — these build whole filter schemas only
  to narrow rows. Each is replaced with a bare predicate. They get shorter and stop depending on a
  domain they are not testing.

### Prior art

The repo's existing feature specs are the model: compose the feature into a real table, drive it
through its public config, and read rows or members back. Type-level assertions use the same
`expectTypeOf` style already present in the filtering feature's spec, and the degradation test
follows the shape used for the existing per-filter reporting tests.

### Stories

One new story: a host filtering with a plain predicate and **no filter model at all**. This is the
only artifact that demonstrates the decoupling rather than asserting it structurally, and without
it the claim rests entirely on import lists.

Existing story hosts change by one line each.

## Out of Scope

- **Extracting the filter model to a separate npm package.** The folder move and barrel split make
  that a move rather than a rewrite; do it when there is a second consumer, not before.
- **Per-column filter awareness for header UI.** Nothing in the directives layer reads filter state
  today. If the answer turns out to be yes, it lands as a second table-owned config field and still
  imports nothing from the filters domain. Open, deliberately unanswered here.
- **The inferred-criterion-map redesign.** Sequenced after this work, specced separately.
- **Widening the degradation reporting channel** beyond the console. Tracked separately; this
  change reuses the existing channel and does not extend it.
- **Property access on criteria under strict index-signature settings**, and the naming of the
  active-criteria member. Both are filter-model defects, unaffected either way — though both get
  cheaper to fix once the domain stands alone.
- **Changing any filtering semantics.** Emptiness, null cells, OR/AND combination, conditional
  gating and per-filter reporting are all preserved exactly.

## Further Notes

**The issue reporting the criterion-map landmines is already closed.** The decision record says to
close it as fixed-by-design; that has already happened, so no action is owed there.

**The docs pointer is itself the coupling.** The filtering workspace's spec and architecture
pointers both aim at the filter model's documentation, which is why no document describes the
feature alone. This work gets its own workspace for exactly that reason, and splitting the older
workspace's pointers is part of the documentation step rather than an afterthought.

**The folder move will collide with anything in flight.** It touches every file in the domain and
is sequenced last for that reason. Any parallel work inside the filters domain should land before
it, not alongside it.
