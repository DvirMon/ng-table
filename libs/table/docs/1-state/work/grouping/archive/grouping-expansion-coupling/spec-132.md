# Spec — #98 `RenderRow.parentId` + engine-owned prune stage

**Issue:** [#98](https://github.com/DvirMon/ng-table/issues/98) — sub of epic
[#96](https://github.com/DvirMon/ng-table/issues/96).
**Epic contract:** [`plan.md`](plan.md) Part B (B0–B2). This spec settles only what B2 left open.
**Architecture:** [`architecture-132.md`](architecture-132.md).

## Problem Statement

A consumer composing `withGrouping()` gets a table whose behavior depends on which other feature
happens to be composed beside it, and in which order they were written.

`withGrouping()` reaches into `withExpansion()`'s state to decide whether a collapsed group's
members should be emitted at all. Three consequences a consumer actually meets:

- Grouping is typed against expansion only when expansion is listed first, so the same two
  features produce different compile-time surfaces depending on argument order — while behaving
  identically at runtime. The consumer has to know an ordering rule that nothing enforces.
- The grouping feature's documented contract carries a caveat about a lazy cross-feature read
  that no consumer should have to reason about.
- Any future feature that also synthesizes child rows has to repeat the same reach, or its rows
  cannot be hidden at all.

Underneath all three is one gap in the row model: a render row knows how deep it sits but not
what it sits under. "Hide everything beneath this id" is therefore unanswerable by generic code,
so the only code that can hide is the code that already knows the parent/child relation at the
moment it emits — the grouping feature. The coupling is a workaround for a missing field, not a
decision anyone made about expansion.

## Solution

Give the row model the parent link it lacks, and move descendant-hiding out of the emitting
feature into a single pass the engine runs after every feature has finished emitting.

From the consumer's perspective nothing changes in this slice. Collapsing a group still hides its
members; pagination still counts only visible rows. That is deliberate: the replacement lands
while the existing prune is still in place, and pruning twice is idempotent, so this slice is
green on its own and the coupling is deleted in the following slice.

What changes for the consumer at the end of the epic is that grouping composes with zero
knowledge of expansion, in any order, typed or not — and that a row's parent is now something
they can read rather than infer from depth.

## User Stories

1. As a consumer, I want to compose `withGrouping()` and `withExpansion()` in either order, so that argument order is a style choice rather than a correctness requirement.
2. As a consumer, I want `withGrouping()` to compose on a table with no expansion feature at all, so that grouping without collapsing is a supported configuration rather than an accident.
3. As a consumer, I want a collapsed group to hide its members, so that collapsing means what it says.
4. As a consumer, I want a collapsed group nested inside another collapsed group to stay hidden, so that hiding composes down arbitrary depth.
5. As a consumer, I want expanding a parent to reveal only its own children and not its collapsed grandchildren, so that each collapse state is independently honored.
6. As a consumer, I want a page of a paginated grouped table to contain the page size in *visible* rows, so that collapsing a group does not silently produce short pages.
7. As a consumer, I want `aria-rowindex` to count visible rows only, so that assistive technology reports the grid a sighted user sees.
8. As a consumer, I want to read a render row's parent id, so that I can render indent guides, breadcrumbs, or a "scroll to parent" affordance without parsing a composite id.
9. As a consumer, I want a top-level row's parent id to be absent rather than a sentinel value, so that "has no parent" is expressible in the type rather than by convention.
10. As a consumer of a table with no nesting of any kind, I want no parent id on any row, so that the field's presence is a real signal and not noise.
11. As a consumer, I want a nested tree child to carry its parent id in exactly the same field as a grouped cluster member, so that generic row-rendering code handles both without branching on row kind.
12. As a consumer, I want the parent id never to be taken apart to recover its components, so that a group id's internal punctuation stays an implementation detail.
13. As a maintainer, I want descendant-hiding to happen in one place, so that a bug in hiding is fixed once.
14. As a maintainer, I want the hiding pass to run after every feature has emitted, so that no feature has to know whether it is the last to run.
15. As a maintainer, I want the feature that owns collapse state to keep owning it, so that the engine gains an ordering responsibility and not a state slice.
16. As a maintainer, I want a feature to hand the engine a read-only view of its collapsed ids, so that the engine can never write a feature's state.
17. As a maintainer, I want a future row-synthesizing feature to get hiding for free by setting a parent id, so that the next feature does not repeat grouping's workaround.
18. As a maintainer, I want the `withTree()` split to inherit one shared prune rather than two feature-owned ones, so that the split is cheaper than it would be today.
19. As a maintainer, I want the detail-panel feature and the tree feature to keep separate open-id sets after the split, so that an expanded tree row and an open detail panel remain distinguishable states.
20. As a maintainer, I want a table composing both of those features to construct without throwing, so that the split's own verification plan still passes.
21. As a maintainer, I want every existing grouping, expansion and pagination test to pass unchanged, so that "no behavior change" is demonstrated rather than asserted.
22. As a maintainer, I want the decision recorded as an ADR that names what it supersedes, so that the next person finds the reasoning rather than re-deriving it.
23. As a maintainer, I want the ADR to state its relationship to the render-stage ADR and the expansion-split ADR, so that the three are readable as one sequence.
24. As a maintainer, I want the superseded decision in the grouping work folder marked as such, so that a stale rationale cannot be cited as current.

## Implementation Decisions

### D1 — The row model gains an optional parent link

`RenderRow` gains an optional parent row id. It is populated on creation by whichever stage
synthesizes the child — the grouping stage for cluster members, the tree stage for nested
children — exactly like the existing optional, populated-on-create fields. No lookup table, no
map, no second pass: the emitting code already holds the parent's id at the moment it emits.

Absent on a top-level row and on every row of a table with no nesting. Absence is the "no parent"
encoding; there is no sentinel.

The id is an opaque marker. Nothing in this work parses one back apart to recover the column or
value it was built from — prior art records a live upstream bug caused by exactly that, and a
group id's internal punctuation differs from a tree id's.

### D2 — Hiding becomes a terminal engine pass, not a feature stage

A descendant-hiding pass is added to the fixed render-stage order, positioned after every
feature-claimable stage and before pagination. One linear pass, dropping any row that has a
collapsed ancestor, by walking the parent link upward.

It is owned by the engine rather than offered as a feature slot. The reason is ordering, not
ownership: the pass must run after every feature has finished emitting, and a feature's stage
sits at a fixed position in the order, so no feature can know it is last. This is the same
category as the existing central assignment of a row's final position, which is likewise derived
from feature output but computable by no feature.

Two ordering constraints, both load-bearing:

- It runs before pagination, so a page counts visible rows.
- It runs before the central position assignment, so the reported row index matches what is
  rendered.

### D3 — Collapse state stays in the feature; the engine gets a read-only view

The engine stores nothing. The feature that owns collapse state keeps owning it — the writable
set, the expand and collapse verbs, the bookkeeping, the removal-pruning obligation. What the
feature contributes is a read-only signal of the ids whose descendants are hidden, declared
through the feature contract alongside its other declarations.

This mirrors how render stages already work: the feature owns the transform, the engine owns
knowing when to call it. Here the feature owns the set, the engine owns knowing when to read it.

### D4 — The collapsed-set slot accumulates; it is not single-claim

Every other slot in the feature contract is single-occupancy — a second claimant throws at
construction. This one is the exception: it collects contributors, and the pass hides a row if
*any* contributed set collapses one of its ancestors.

The reason is a decision already taken in the expansion-split ADR, not a preference of this
slice. That ADR splits expansion into a detail-panel feature and a tree feature, gives each its
own independent open-id set — explicitly rejecting a shared one, on the grounds that a
tree-expanded row and an open detail panel are semantically different states that must not
collide — and *also* delegates group collapse to the panel feature. So after the split two
independent sets both legitimately hide descendants, and that ADR's own verification plan
requires a table composing both features to construct without throwing. A single-claim slot would
throw on exactly that case.

Union needs no conflict rule, because hiding here is monotonic: a contributed set can only hide
descendants of its own ids, and nothing in the contract lets one contributor un-hide another's
rows. There is no "winner" to define.

### D5 — No contributor means nothing is hidden

A table that composes no collapse-owning feature registers no set, and the pass is a no-op. This
preserves today's semantics exactly, where the absence of expansion means unconditionally
expanded.

### D6 — This slice changes no behavior

The grouping stage keeps its own prune in place and additionally emits the parent link
unconditionally. Pruning twice is idempotent, so the slice lands green with both paths active.
Deleting the grouping-side prune, and the cross-feature read that feeds it, is the following
slice's work and its acceptance is that nothing observable changed.

### D7 — The ADR is the first deliverable

A new ADR records D1–D5. It supersedes the render-stage ADR's allocation of stage
responsibilities in part, closes out the grouping work folder's decision that documented the
cross-feature read as deliberate, and cites the prior-art survey already in this workspace.

It states its relationship to the expansion-split ADR in both directions: that ADR's decisions
are what force D4's accumulating slot, and this ADR's central pass is what makes that split
cheaper, since the tree and panel features share one prune instead of each owning one.

### D8 — Prior art is consistent with this shape

Every surveyed implementation carries both a depth and a parent link, none prunes using depth
alone, and all prune centrally rather than in the emitting code. One of them registers the
identical visibility lookup for row grouping and for tree data — the same unification D2 and D4
describe. Claims are pinned to published artifacts in this workspace's prior-art document.

## Testing Decisions

A good test here asserts what a consumer can observe from the composed table: which rows come
back from the render output, in what order, with what visible fields. It does not assert that a
particular stage ran, that a particular internal slot was populated, or how many passes occurred.
The whole point of this slice is that hiding moved without anything observable changing, so a
test that can tell the difference is testing the wrong thing.

**Seam.** The existing public-store seam, and no new one. Tests construct a table with the real
factory, compose the real features, and read the render output. This is the seam the grouping and
expansion specs already use, so the "behavior unchanged" criterion is demonstrated by those
suites passing untouched rather than by new assertions duplicating them.

One lower seam is reused, not added: the render-stage order module already has a spec covering
stage sequencing, and the new pass's position is asserted there, because position relative to
pagination and to the central index assignment is an engine fact with no consumer-visible
expression other than the outcomes already covered above.

**Modules under test.** The row-model type (compile-time assertions only — that the parent link
is optional, and that a top-level row satisfies the type without it). The grouping feature. The
expansion feature. The render-stage order. Pagination in combination with grouping.

**Prior art in this codebase.** The grouping feature's spec is the model for cluster-emission
assertions; the expansion feature's spec is the model for collapse-state assertions; the
render-stage order spec is the model for sequencing assertions; the compile-time assertion file
convention is the model for the optionality checks, which the runner executes but does not check
— only the spec typecheck target enforces them.

**Cases that must exist.**

- Every existing grouping, expansion and pagination case passes with no edit. This is the primary
  criterion.
- A cluster member carries its header's id as its parent; a nested header carries its own
  parent's.
- A tree child carries its parent row's id, in the same field.
- A top-level row, and every row of a flat ungrouped table, has no parent link.
- A collapsed group hides its members, and a collapsed group nested in a collapsed group stays
  hidden when only the outer one opens.
- With a collapsed group present, a paginated table's page contains the page size in visible rows.
- A table composing grouping with no collapse-owning feature shows everything.
- A table composing two independent collapse-owning features constructs without throwing, and a
  row is hidden if either set collapses one of its ancestors.
- The pass runs before the central position assignment, so no visible row's reported index has a
  gap.

**Not tested.** That the pass is engine-owned rather than feature-owned; the internal shape of the
collapsed-set registration; anything requiring a group id to be parsed.

## Out of Scope

- **Deleting the grouping-side prune and the cross-feature read.** That is the next slice
  (#99), gated on this one. Doing it here would make "no behavior change" unverifiable, since
  both the old and new paths would be moving in one step.
- **The expansion split itself.** This slice takes the split's already-recorded decisions as given
  — they are what force D4 — but builds neither the tree feature nor the panel feature, and moves
  no member between them.
- **The write-side gap.** Discovering group ids to expand is a separate slice (#97), independent
  of this one and unaffected by it: the parent link fixes who gets hidden, not who gets found.
- **Any consumer-facing API for reading ancestry beyond the single parent link.** No ancestor
  walk, no parent-row accessor, no depth-to-parent mapping. If one is wanted later it derives from
  the field this slice adds.
- **Performance work.** The pass is linear and additive; no benchmarking, no memoization strategy,
  no incremental-prune design.
- **Documentation rewrites beyond the ADR and the superseded-decision marker.** The feature specs
  whose caveats disappear are updated when the caveat actually disappears, in #99.

## Further Notes

The epic's written contract is `plan.md`; this spec does not restate it, and where the two differ
on the collapsed-set question this spec supersedes it, since that question is what `plan.md` left
open and what this spec was written to close.

The accumulating slot in D4 is the engine's first, and that is a genuine departure from a
convention this codebase otherwise holds uniformly. It is justified by a decision recorded
elsewhere rather than by this slice's own convenience, which is why D7 requires the ADR to name
that dependency explicitly. If the expansion split is ever abandoned, D4 should be revisited —
single-claim would then be correct again.

Verification is manual and run by the repo owner: the template-aware typecheck target (re-run
after fixing any source error, since the compiler aborts before the template phase on one), the
test suite, and the grouping Storybook entry, whose behavior must be identical with no change to
the story's own code.
