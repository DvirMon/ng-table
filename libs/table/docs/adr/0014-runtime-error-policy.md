# ADR-0014 — Consumer callbacks degrade at runtime, throw at construction

**Status:** proposed
**Date:** 2026-09-10
**Related:** [ADR-0007](0007-feature-member-claims.md) (construction-time member claims),
[ADR-0003](0003-in-house-table-store-engine.md) (the single-claim slot and its throw),
[ADR-0006](0006-row-id-state-reconciliation.md) (a runtime contract the type system does not enforce),
`docs/1-state/work/with-filtering/design-options-hybrid-api.md` (R27 — the decision that surfaced this)

## Context

The library throws in six places today, and every one of them fires at construction:

| Site | Trigger |
|---|---|
| `engine/slots.ts:28` | two features claiming one pipeline stage, render stage, or member key |
| `engine/rows.ts:18` | a `trackBy` that names no field |
| `engine/columns-schema/resolve.ts:25,50` | duplicate schema registration on one column |
| `schema/column-schema.ts:51` | an unknown path on the columns proxy |
| `api/features/with-selection.ts:90` | a duplicate member claim |

There is no `try`/`catch` anywhere in `engine/` or `api/`. The only `catch` blocks in `src/` are
in story hosts — consumer code, not library code.

That reads as a settled convention, and it was cited as one while grilling `createFilters()`. It
is not. **Every throw above is a wiring error detected once, before any data flows.** The library
has never taken a position on the other class, and the one runtime path it already has —
`withSorting()`'s comparator — is unguarded by *omission*, not by decision. Nothing was recorded.

### The two classes do not share a trade

|  | Construction-time | Runtime, per row |
|---|---|---|
| Examples | slot collision, duplicate member key, bad `trackBy`, duplicate filter on a path | a predicate throws on a cell, a criterion shape mismatch |
| Fires | first render, every run, before data | row 4,318, in production, months after deploy |
| Deterministic | yes | no — depends on that day's data |
| Reaches the developer | always | only if dev fixtures contain the bad row |
| Sane degraded behavior exists | **no** — two features on one key has no correct reading | **yes** — that filter does not apply |

Throwing is right for the left column *because* there is nothing else to do and it cannot ship
accidentally. Neither is true on the right.

### What a runtime throw actually costs

Consumer callbacks run inside computeds. `accessor` runs per row per column; `sortFn` per
comparison; a filter predicate per row per filter; `aggregateFn` per group. A throw propagates to
whoever reads `rows()` — the template — so the host component fails to render and stays failed
until the data or the criterion changes.

The blast radius is not "filtering breaks." It is **the entire table goes blank**, from one null
in one record in one column.

[R27](../1-state/work/with-filtering/design-options-hybrid-api.md) makes this concrete: shipped
matchers guard their own nulls, but `filter(path, predicate)` hands the
consumer an unguarded cell by design, so that it stays possible to write a filter that *matches*
nulls. Custom predicates are therefore the likeliest thing in the library to throw. The sharper
source is the criterion side — R21 leaves persistence to the consumer as
`JSON.parse(localStorage.getItem(…))`, so a snapshot written by an older schema revives with a
shape the predicate never expected.

## Decision

**Consumer-supplied callbacks never take the table down. Construction-time validation keeps
throwing; runtime failures degrade to a defined fallback and report themselves.**

```
construction   duplicate filter on a path, unknown path, anyOf without a key,
               slot/member collisions, bad trackBy
               → throw. Deterministic, no degraded reading, caught on first render.

runtime        a consumer callback throws — filter predicate, accessor, sortFn, aggregateFn
               → never throw. Fall back per the table below, and report once per
                 callback per evaluation with enough context to find it.
```

Per-callback fallback, chosen so the failure is *visible* rather than *silent*:

| Callback | Fallback when it throws | Why |
|---|---|---|
| filter predicate | that filter does not apply for this evaluation | showing unfiltered rows is obvious and recoverable; hiding rows is neither |
| `sortFn` | that column's sort does not apply; row order falls back to input order | same reasoning — visibly unsorted beats silently mis-sorted |
| `accessor` | the cell reads `undefined` | one cell degrades, not the row and not the table |
| `aggregateFn` | that aggregate reads `undefined` | the group still renders |
| `sortable`'s `enable` | the column is treated as sortable | still-sortable is the visible direction — a column that silently stopped responding to clicks is the harder failure to notice; see the 2026-09-25 amendment (#100) |
| a derived signal (`withComputed()`) | **none — reported, then rethrown** | no fallback is distinguishable from a working derivation; see the 2026-09 amendment |

Two properties of the reporting, both load-bearing:

- **Once per callback per evaluation, not once per row.** A predicate that throws on 4,000 rows
  produces one report, not 4,000. Deduped by the callback's key.
- **Always reported, not dev-only.** `console.error` with the filter key / column id, the
  callback, and the offending cell value. Dev-only reporting would make production failures
  invisible, which is the failure mode this ADR exists to prevent.

### Granularity: the callback, not the row

A filter predicate is wrapped **per filter per evaluation**, not per row. Catching per row
produces an inconsistent row set — rows 1–4,317 tested, 4,318 skipped, the rest tested — which is
strictly harder to diagnose than a filter that uniformly does nothing. It also keeps the `try` out
of the hot loop: one wrap per filter, not one per row.

### Residue, documented deliberately

A filter that failed still appears in `filters().active()`. `active()` describes which *criteria*
are set (R14), not which evaluations succeeded. This is correct — the user did set that criterion
— but it means `active()` can name a filter that did not narrow anything on the last pass. Specs
that reference `active()` must say so.

## Alternatives considered

**Let it throw, consistent with the existing six throw sites.** Rejected once the two classes were
separated: the existing sites are all wiring errors, so "consistency" was an argument from a
convention that does not cover this case. Keeping it would mean one null in one production record
blanks a screen — disproportionate to the fault, and undiagnosable from the symptom.

**Catch per row, treat a throw as no-match.** Rejected on two counts: it silently *hides* rows,
which is the unrecoverable direction of failure, and it puts a `try`/`catch` in the per-row loop
for every filter on every evaluation.

**A per-member fallback for a throwing derived signal.** Rejected (#33). A fallback value —
`undefined`, the previous value, a zero — makes a broken derivation indistinguishable from a
working one, and the member's consumers (template bindings, other features' reads) carry the wrong
value silently. Unlike the four degrading callbacks above, there is no reading the library can pick
that is *visibly* wrong. Reported-then-rethrown instead; see the 2026-09 amendment.

**Throw in dev, degrade in production.** Rejected — dev and production would take different code
paths through the pipeline, so the behavior under test is not the behavior shipped. Reporting
loudly in both, and degrading in both, gets the same visibility without the divergence.

**Scope the policy to `createFilters()` and leave `sortFn`/`accessor` unguarded.** Rejected: it
would leave two features with different runtime behavior, and would have the filter spec quietly
setting library-wide policy it does not own.

## Consequences

- Every consumer callback needs one wrap site in the engine. Filter predicates land with
  `createFilters()`; `sortFn`, `accessor` and `aggregateFn` are a retrofit, tracked separately —
  **this ADR is not implemented by the filtering work alone.**
- Feature specs cite this ADR in one line rather than restating the policy. `filtering.md` and
  `sorting.md` both get that line; `sorting.md` gets it when next touched.
- A new feature that takes a consumer callback inherits the answer instead of re-deciding it, and
  is expected to name its own fallback in the table above.
- The reporting channel is `console.error` for now. If the library later grows an injectable error
  handler, this is the decision it replaces — and every wrap site is already in one place per
  callback.
- Not enforced by the type system, in the same way as ADR-0006's `onRowsRemoved` contract: adding
  a new consumer callback without a wrap site compiles fine and reintroduces the exposure.

## Amendment (2026-09, #33): derived signals

`withComputed()` introduced a consumer callback that splits across both classes of this ADR, and
one half of it is the policy's only exception. Both halves live inside `withComputed()`
(`api/features/with-computed.ts`), never in the fold — a fold-level check would reject the method
members features legitimately contribute.

**Construction: a derive block that throws while declaring, throws.** The block runs once, at
composition, before any data. A block that never produced its members has no correct degraded
reading — the "Sane degraded behavior exists: **no**" column of the two-classes table — and it
fires on the first run, so it cannot ship accidentally:

```
[createTable] withComputed block threw while declaring its members
```

The original error is attached as `cause`. The same class covers a block returning a non-signal,
which the `DerivedDict` constraint cannot enforce against a JavaScript consumer:

```
[createTable] withComputed: member "total" is not a signal — a derive block returns signals only
```

**Runtime: a derived signal that throws at evaluation is reported, then rethrown.** Each declared
signal is rebuilt wrapped, so the failure names the member that produced it:

```ts
console.error(`[createTable] derived member "${key}" threw`, error);
```

Reported always, not dev-only, consistent with the rest of this ADR. Reporting is once per
evaluation with no dedupe logic needed: the outer `computed` caches the error and rethrows it on
every read until a dependency changes.

**Why rethrow rather than degrade.** The four degrading callbacks each have a fallback that is
*visibly* wrong and recoverable — unfiltered rows, unsorted order, an `undefined` cell. A derived
member has none. The library cannot know whether `undefined`, the previous value or a zero is a
safe reading of a consumer's own derivation, and every choice is silently wrong at the exact moment
the value matters. `classify-errors-construction-vs-runtime` puts it as "hiding data is the
unrecoverable direction"; here the *fallback* is what hides, so the same reasoning lands on the
opposite conclusion. Reporting and rethrowing keeps the failure loud.

The rule above stands as written for this, the one runtime-class callback in the library that
does not degrade — it is not softened to "usually"; this is its single, justified exception.

## Amendment (2026-09-24): construction checks are dev-only

**This ADR never took a position on dev vs. production** — it argued *throw
vs. degrade*. Whether a construction check still runs in a production build
was never asked; its absence was read as a ruling. It was not one.

**Construction-time checks are gated to dev builds and stripped from
production.** They are developer errors: they fire on first render, every run,
before any data, so a check has already done its job by the time an app ships.
Wrapping them in `ngDevMode` matches Angular's own practice and matches this
ADR's own reason for throwing — *"it cannot ship accidentally"* — which is a
statement about when the check fires, not about which build runs it.

**Runtime reporting is untouched.** *"Always reported, not dev-only"* stands
exactly as written for every consumer callback. Nothing in the fallback table
or the reporting rules changes.

**Where the gates live.** Each construction check gates `ngDevMode` inside its
own body, never at a call site: `assertUniqueColumnIds` (`engine/columns.ts`),
`assertRuleColumnIdsAreKnown` and `assertMetadataKeysAreUnique`
(`api/create-columns.ts`). `libs/table/CLAUDE.md`'s Errors bullet states the
same rule for the next check that gets added.

**Why this is not the rejected "throw in dev, degrade in production"
alternative.** That one is about *runtime* callbacks, and it was rejected
because dev and production would take **different code paths through the
pipeline** — the behavior under test would not be the behavior shipped. A
construction check has no second path: it either runs and throws, or does not
run. The wiring it validates is identical in both builds, and a failure it
would have caught has already been caught in dev, before the production build
exists.

**Accepted risk, stated and taken.** Once columns stop being static — a
server-sent or user-saved layout, [#127](https://github.com/DvirMon/ng-table/issues/127)
— an unknown column id is no longer guaranteed to appear in dev, so a dev-only
check can miss a real production failure. No carve-out was taken for checks
whose ids can arrive at runtime. #127's grill should reopen this line rather
than assume it was decided with that case in view.

## Amendment (2026-09-25, #100): `sortable`'s `enable`

`withSorting()`'s `sortable(path, { enable })` (SO28, `docs/decisions/sorting.md`)
is a fifth degrading runtime callback, added to the fallback table above. It is
read live inside `toggleSort()`, never cached, so a throw is scoped to the call
it happened on rather than poisoning the feature's state. Fallback and
rationale are the table row above; reported once per column per evaluation,
same floor as `reportComparatorError`.
