# Spec — effect-free column reactivity

Source documents: `1-gap-report.md` (the gap), `2-decisions.md` (D1–D10, settled).
Architecture: `4-architecture.md`.

## Problem Statement

The table's declarative column-visibility API looks effect-free at the call site — a consumer
declares a rule with `applyVisible` / `applyVisibleAsync` and the engine "just handles" the
reactivity. Underneath, the engine fulfils that promise with Angular `effect()`s that write
into the `columns` signal. A consumer who hand-rolls an `effect()` to flip `visible` and a
consumer who calls `applyVisibleAsync` are doing the same thing; the library hides the pattern
rather than removing it.

That has three consequences a table maintainer feels:

- Rule evaluation order is scheduler-dependent, so behavior that happens to work does so by
  timing rather than by construction — and cannot be reasoned about from the rule declarations
  alone.
- "No effect-driven state writes" cannot be enforced as a project rule while the design system's
  own solution violates it. Consumers reasonably copy what the DS does.
- There is no purely derived path for _any_ column state. Every write — rule-driven, imperative,
  or config-driven — funnels through the same imperative update call, so the three cannot be
  told apart, tested apart, or given different precedence.

The root cause is narrower than "the library uses `effect()`": `columns` is a single writable
signal merging three unrelated write sources, and `effect()` is the only mechanism that can fold
a derived source into a signal an imperative source also owns.

## Solution

Separate the three write sources. Column state becomes a derivation: a writable base holding
declared and imperatively-updated columns, a fold over the registered rules, and a derived
`columns` that overlays one on the other. The effects disappear as a consequence of the split,
not as the target of it.

From a consumer's perspective almost nothing changes. `store.columns` is already a readonly
signal in the public type and stays one. `updateColumns()` and its updaters keep their
signatures. Rules are still declared the same way in a `columnsSchema`. What changes is that
behavior becomes deterministic: a rule-governed column's visibility is now defined by its rules
at every instant, rather than by whichever effect fired most recently.

Two consumer-visible behavior changes fall out, both deliberate:

- A rule-governed column can no longer be flipped by an imperative visibility toggle — the rule
  wins. Today the effect clobbers such a toggle on its next firing anyway; this makes it
  predictable instead of racy.
- An async rule must declare what happens on error. The error handler becomes required.

## User Stories

1. As a table maintainer, I want column state to be derived rather than written, so that I can
   reason about a column's visibility from its rule declarations without simulating scheduler
   order.
2. As a table maintainer, I want the "no effect-driven state writes" rule to hold inside the
   library, so that I can enforce it in review without the DS itself being the counterexample.
3. As a table maintainer, I want the three write sources separated, so that a bug in rule
   evaluation cannot be confused with a bug in imperative column updates.
4. As a table maintainer, I want the rule fold to be a pure function, so that I can unit test it
   without an injection context or a scheduler.
5. As a table consumer, I want `applyVisible` to keep working exactly as before, so that
   adopting this change costs me nothing.
6. As a table consumer, I want a rule that reads a signal from my own component to keep working,
   so that the ordinary "toggle a column from a control" case needs no new API.
7. As a table consumer, I want multiple rules on the same column to combine predictably, so that
   adding a second condition never depends on declaration order.
8. As a table consumer, I want `updateColumns`, `setColumns`, `reorderColumns` and
   `toggleColumnVisibility` to keep their signatures, so that existing call sites compile
   unchanged.
9. As a table consumer, I want an imperative column reorder to survive a rule re-evaluating, so
   that my layout changes are not silently reverted.
10. As a table consumer, I want a column with an async visibility rule to keep showing its last
    resolved answer while a refetch is in flight, so that the column does not flicker.
11. As a table consumer, I want to be required to say what happens when an async rule's loader
    fails, so that the failure behavior is visible where I declare the rule rather than being an
    invisible default.
12. As a table consumer, I want a column whose async rule has never resolved to fall back to the
    visibility I declared on the column, so that first paint is predictable.
13. As a table consumer, I want to replace the whole column list at runtime while rules are
    active, so that a rule targeting a removed column is ignored and a rule targeting a newly
    added column applies immediately.
14. As a table consumer, I want a rule that reads the current columns to see declared and
    imperatively-updated state, so that it never observes its own output and never deadlocks.
15. As a table consumer, I want two rules that depend on the same condition to coordinate through
    a shared signal, so that I never need one rule to depend on another rule's result.
16. As a table maintainer, I want a documented reason why rule-to-rule dependency is unsupported,
    so that the constraint is not mistaken for an oversight.
17. As a table maintainer, I want the rule registry generalized beyond visibility, so that a
    future rule kind registers into the fold instead of forcing the merge to be rewritten.
18. As a table maintainer, I want the feature contract extended through the existing declaration
    mechanism, so that no new engine concept is introduced for this one feature.
19. As a table maintainer, I want the existing behavior tests to keep passing unchanged, so that
    I have evidence the refactor preserved semantics rather than redefined them.
20. As a table maintainer, I want the internal docs corrected in the same change, so that the
    engine reference does not describe a writable column signal that no longer exists.

## Implementation Decisions

All decisions are recorded with full rationale in `2-decisions.md` (D1–D10) and are settled.
Summarized here; not open for relitigation.

**Column state is derived, not written (D1, D2).** The store keeps a writable base holding the
resolved config plus imperative updates, a derived fold over registered rules, and a derived
`columns` overlaying rule results onto the base. The public `columns` member stays a readonly
signal, so no consumer type changes. `updateColumns()` retains its signature and retargets the
base internally.

**Rule precedence (D2).** Rules win over imperative writes for the state they govern. Imperative
column changes that rules do not govern — order, and visibility of unruled columns — are
preserved through the base and survive rule re-evaluation.

**Async rules need no effect (D3).** Resource _construction_ requires an injection context and
stays in the feature's init hook. Resource _reading_ is ordinary signal composition.

**A general rule reducer, not a visibility-only overlay (D4).** The fold is a per-column rule
registry keyed by rule kind. Visibility is the only kind implemented; a future kind registers
into the fold rather than reworking it. This mirrors Signal Forms' per-field rule list and its
reducer vocabulary.

**Unresolved async state holds the last resolved value (D5).** Each async rule's result is
produced by a derivation that retains its previous value while the resource is loading,
reloading or idle, and resolves through the success or error handler otherwise. Before first
resolution the rule contributes nothing and the column's declared visibility applies. The
retention lives at the resource boundary, not in the merge, so the fold stays a pure function of
its inputs. This mirrors how Angular's own resource and debounce primitives carry values forward.

**The async error handler becomes required (D5).** Breaking change to the async rule options.
Accepted: the API is Tier 1 and the demo is its only consumer.

**An optional pending override is deferred (D5).** Retention answers the previous parameters'
question when the _subject_ changes — a known, accepted limitation. A future optional pending
handler covers the fail-closed case; it is purely additive and nothing here blocks it.

**Rules reach the fold through a mutable registry on the core handle (D6).** The feature declares
its rules through a new key on the feature spec, claimed through the existing single-occupancy
registry alongside pipeline stages and the render-rows builder. This is the mechanism the engine
already uses for stages: the derivation reads the registry at evaluation time, so features
registering during the fold are visible before any consumer reads. No new engine concept.

**Rejected alternatives, with reasons, in D2/D6/D7:** a linked signal for `columns` (a rule
re-firing discards imperative reorder); a full column pipeline mirroring the row pipeline (correct
long-term symmetry, but only one stage exists to justify it); rules passed through engine config
(smallest diff, but hardcodes one feature's concern into the engine); Signal Forms' managed
metadata construction (solves dynamic per-node resource lifecycle, which this library does not
have — rules are static and resources are per-rule, not per-column).

**The rule set is static; columns and rule results are not (D9).** Which rules exist, and which
column id each targets, is fixed at construction. Rule results and the column list are both
dynamic. Only a changing _rule set_ would justify keyed lookup, and that does not exist here.
Rules key on column id, so a replaced column list needs no registration or teardown — the fold
skips ids that are absent and picks up newly added ones on its next evaluation.

**The rule context stays minimal (D8, D10).** Rule callbacks receive the base columns, never the
derived ones — this breaks the feedback cycle that would otherwise form once `columns` depends on
rule results. Rules compose with the outside world through ordinary closure capture of the
consumer's own signals, which is the mechanism the common cases already use. Three extensions
were considered and rejected: exposing pipeline rows (cyclic — the sort stage already reads
columns), exposing raw row data (acyclic but semantically wrong, since visibility is table-scoped
and row data is row-scoped), and rule-to-rule dependency (would require dependency-ordered
resolution and real cycle detection; rules coordinate through a shared external signal instead).

**Documentation corrections in the same change.** The table's internal engine reference describes
`columns` as the writable single source of truth, and the column-rules API docs describe the
effect-based wiring and an optional error handler. Both become wrong and are corrected here.

## Testing Decisions

**What makes a good test here.** Assert external behavior at the highest available seam: build a
store through the public factory, drive the consumer's own signals, and read the public columns
signal. A test that reaches into the rule wiring, asserts that a derivation is a particular
primitive, or counts evaluations is asserting implementation and must not be written — this
refactor changes the implementation on purpose while preserving behavior, so such tests would
report a false failure. Per the shared testing principles: internal helpers are not mocked and
not tested directly.

**Three existing seams, zero new ones.**

1. _The columns-schema feature spec_ — the primary behavior seam, already structured as
   "public factory in, public columns signal out". Every rule behavior is asserted here. It
   gains cases for: imperative visibility toggle losing to a rule on the same column; replacing
   the column list while rules are active, both adding and removing a rule-governed column; an
   async rule holding its value across an in-flight refetch; and a rule reading the current
   columns not cycling. One existing case must be rewritten — the one asserting that an async
   rule _without_ an error handler holds its last resolved value on error, since the handler
   becomes required.

2. _The engine columns spec_ — the rule fold is a pure columns-to-columns transform, so it is
   tested as plain unit tests with no test harness and no injection context, beside its existing
   siblings for column resolution, ordering and visibility. This follows the table's own written
   rule that everything in the engine layer except the composer is pure and must be testable
   without Angular; needing a harness there is the signal that logic landed in the wrong file.
   Cases: multiple rules merging on one column, a rule targeting an absent column id, a column
   with no rules passing through untouched, and rule results overriding base visibility.

3. _The update-columns spec_ — regression only, unchanged. The imperative updaters stay pure
   updater factories; only their target moves. It passing unmodified is the evidence that
   imperative writes were preserved.

**Prior art.** The feature spec already establishes the store-construction helper and the
controllable resource test double used to drive async rule states deterministically; both are
reused rather than replaced. The engine columns spec already establishes the plain-unit-test
style for pure column transforms.

**Not tested.** Rendering, DOM structure, and directive behavior — unchanged by this work and
excluded by the table's testing rules. The absence of `effect()` is not asserted directly; it is
a property of the implementation, and the behavior tests passing without a scheduler tick is the
meaningful evidence.

## Out of Scope

- Any rule kind other than visibility. The registry is built to accept more; none are added.
- The deferred pending-state override for async rules.
- Rule-to-rule dependency, dependency-ordered rule resolution, and cycle detection.
- Exposing row data or pipeline rows to rule callbacks.
- A consumer-extensible metadata channel for arbitrary per-column data.
- A general column pipeline mirroring the row pipeline.
- Runtime rule mutation — declaring or removing rules after the store is constructed.
- Per-row or per-cell conditional rendering, which is a consumer template concern rather than a
  column rule.
- The demo application beyond whatever the required error handler forces it to declare.
- Any change to the row pipeline, sorting, expansion, or the directive layer.

## Further Notes

The gap report framed this as a style problem and asked for a research pass before committing to
a refactor. That pass ran against Angular's shipped source rather than recollection, and three of
its early conclusions were corrected as a result — the async fallback semantics, the scope of the
"rules are static" claim, and the verdict on Signal Forms' metadata system. `2-decisions.md`
keeps the corrections visible alongside the decisions, because in each case the correction is the
substance.

One finding is worth carrying forward independently of this work: the row pipeline's sort stage
reads the columns signal, so pipeline rows already depend on columns. Any future feature that
wants to derive column state from pipeline output will close a cycle. Raw source data is the safe
upstream signal for that purpose.
