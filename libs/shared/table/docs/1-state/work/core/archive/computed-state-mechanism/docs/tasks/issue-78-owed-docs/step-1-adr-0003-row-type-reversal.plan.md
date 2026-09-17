---
title: "Step 1 — ADR-0003: the deferred row-type inference shipped; record the reversal"
type: task-step
issue: 78
---

# Step 1 — ADR-0003: the deferred row-type inference shipped; record the reversal

**PR scope:** One ADR amendment. No other file.

**Task type:** docs

**Skills used:** —

**Depends on:** —
**Parallel-safe with:** Step 2, Step 3, Step 6, Step 7

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/adr/0003-in-house-table-store-engine.md` (edit)

## Why This Step Exists

ADR-0003's `## Deferred: features: (ctx) => [...]` section (lines ~127–147) says consumers still
repeat `<TRow>` per feature, names the `features: (t) => [...]` shape as the fix, and defers it on
two grounds — DX-only gains, and `composed` always empty at factory time. #67 shipped the
capability, and it shipped by a *different* mechanism than the one this ADR deferred. Left as-is
the ADR tells a reader the opposite of what the code does.

This is the core step: `1-state/architecture.md` (Step 4) carries the same deferral argument at
greater length and cites this ADR, so the wording settles here first.

## What To Do

Replace the `## Deferred` section with an amendment section in the ADR's existing amendment style
(see `## Amendment (2026-08-17): TableFeatureSpec.columnRules is now read` at the bottom of the
file — same heading shape, same voice).

The amendment must state, in this order:

1. **It shipped.** Dated `2026-09`, pointing at #67. A feature call no longer takes a row type:
   `withExpansion()`, not `withExpansion<Department>()`.
2. **By a different mechanism than the one deferred.** Not `features: (t) => [...]`. Features
   became `Feature<In, Out>` functions passed as trailing positional arguments to
   `createTable(data, config, ...features)`; each is F-bounded on the store shape it reads
   (`In extends Pick<TableStore<RowOf<In>>, …>`), so the row type flows from the contextual type
   of the argument position rather than from a `ctx` handle.
3. **Why the functional surface made it typable.** The deferral's blocker was that building every
   spec inside one expression leaves `composed` empty at factory time. The positional fold does
   not have that problem: the base store is built before the fold, and each feature is handed the
   store *as accumulated so far*, so a later argument sees earlier arguments' members. Argument
   order, not a `ctx` closure, is what makes the seam typable — and the seam stays open.
4. **The correctness win the deferral called "modest" is now in force.** A mismatched
   `withExpansion<Person>()` on a `Department` table no longer compiles, because there is no type
   argument to mismatch.
5. **What did not change.** `TableStore<TRow>` is still the public contract. Tree-shaking is
   unaffected — both shapes import features top-level, as the original section already said.

Then fix the two stale call sites this ADR owns:

- `:129` — `withExpansion<Department>()` in prose.
- `:142` — `withExpansion<Person>()` in the correctness-win sentence. Keep the example (it is the
  point being made) but phrase it as what *used to* compile.

## Implementation Notes

- Keep the original deferral text readable as history — this is an ADR, so the amendment records
  the reversal rather than erasing the reasoning that justified the defer. Strike-through is not
  the house style here; a dated `## Amendment` section that says "this section is superseded" is.
- The mechanism details above are settled in `3-decisions.md` (D21 onward) and the workspace
  `architecture.md`. Read them before writing; do not re-derive the design from the source.

## Risks / Watchouts

- Do not restate the whole composition model here. ADR-0003 owns *the engine decision*; the
  argument-order visibility rule belongs to `1-state/architecture.md` (Step 4), which cites this.
- `docs/1-state/architecture.md:201` contains a near-duplicate paragraph ("Why the `TRow` fix
  still hasn't shipped"). It is Step 4's, not this step's — do not edit it here.

## Non-Goals

- ADR-0005, ADR-0007, ADR-0014 — Steps 2 and 3.
- Any non-ADR doc.

## Acceptance Checks

- [ ] ADR-0003 no longer records row-type inference into feature calls as deferred/rejected
- [ ] The amendment carries the date and a pointer to #67
- [ ] The amendment names the positional `Feature<In, Out>` mechanism, not `features: (ctx) => [...]`
- [ ] `grep -n 'with[A-Za-z]*<[A-Z]' docs/adr/0003-*.md` returns only the historical example, phrased as past behaviour
- [ ] No other file changed

---
[Step 2: ADR-0007 + ADR-0005 member claims](step-2-adr-0007-0005-member-claims.plan.md) →
