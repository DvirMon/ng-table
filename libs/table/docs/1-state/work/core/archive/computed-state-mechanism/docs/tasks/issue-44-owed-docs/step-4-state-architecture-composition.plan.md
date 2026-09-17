---
title: "Step 4 — state-layer architecture: argument-order visibility, fixed pipeline order"
type: task-step
issue: 78
---

# Step 4 — state-layer architecture: argument-order visibility, fixed pipeline order

**PR scope:** One doc. The largest single rewrite in this issue.

**Task type:** docs

**Skills used:** —

**Depends on:** Step 1 (ADR-0003 settles the reversal's wording; this doc cites it)
**Parallel-safe with:** Step 5, Step 6, Step 7

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/1-state/architecture.md` (edit — `:120–:205`, the rejected-alternatives
  block and the composition description)

## Why This Step Exists

This doc carries the longest surviving statement of the old world. `:129` opens "Today every
feature call repeats the row type", `:132` shows `createTableSchema(columns, { features: [...] })`
with `withExpansion<Department>()`, `:154` explains the contextual-typing idea that was *not*
taken, `:167` explains why ngrx blocked it, and `:201` is a whole paragraph titled "Why the `TRow`
fix still hasn't shipped". All five are now false. A reader landing here is told the library works
the opposite of how it works.

It depends on Step 1 because ADR-0003 is where the reversal is *decided*; this doc *describes*.
Writing the description first risks two different accounts of the same change.

## What To Do

1. **Delete the "still hasn't shipped" framing.** `:201` and the surrounding rejected-alternatives
   block describe a deferral that is over. What survives is the *history* — keep a short dated
   paragraph saying the `features: (ctx) => [...]` direction was explored and superseded by
   positional composition (#33), and link ADR-0003's amendment for the reasoning. Do not keep the
   full argument; ADR-0003 owns it now.
2. **Rewrite the composition description to argument-order member visibility.** The rules, stated
   plainly:
   - Features are trailing positional arguments to `createTable(data, config, ...features)`.
   - The base store is built *before* the fold; each feature is handed the store as accumulated so
     far, so a feature sees the members of every feature to its **left**, and none to its right.
   - **Member visibility follows argument order. Pipeline execution order does not.** The pipeline
     runs in `PIPELINE_ORDER` regardless of how the consumer ordered the arguments. This is the
     single most confusable point in the model — state it as its own line, not inside a paragraph.
   - Types are stricter than runtime: `withGrouping()` reads `composed['expandedRows']` as a lazy
     guarded read, so it *works* in either order at runtime but is only *typed* when
     `withExpansion()` precedes it (D25). Give this as the worked example of the previous rule.
3. **Update `:132`'s snippet** to positional form. `createTableSchema()` is deleted from the
   library (D25) — the snippet must not show it.
4. **Fix the remaining stale call sites** in this file (`:133`, `:154`'s `ComposedFeatureMembers`
   reference, `:167`'s `withSorting<Person>()`).

## Implementation Notes

- `ComposedFeatureMembers` no longer exists in `src/api/types.ts`. Any sentence whose point was
  "keeping each element's precise return type intact for `ComposedFeatureMembers`" needs the new
  mechanism (the accumulating `Feature<In, Out>` fold) or deletion — not a rename.
- The argument-order/pipeline-order distinction is also owed by `CLAUDE.md` (Step 6). Keep the two
  consistent; this file explains, `CLAUDE.md` states the invariant.

## Risks / Watchouts

- This section is long and mostly obsolete; the temptation is to delete it wholesale. Don't — the
  ngrx blocker (`:167`, contravariant parameter types) is the reason the engine is in-house, and
  deleting it strands ADR-0003's context.
- Do not reuse "the one surviving direction" phrasing anywhere. It survived into something else.

## Non-Goals

- ADR-0003's amendment text (Step 1).
- `CLAUDE.md` (Step 6), `row-editing.md` (Step 5), the call-shape sweep (Step 7).

## Acceptance Checks

- [ ] No sentence in the file says the row-type fix is deferred, unshipped, or future
- [ ] The composition section states argument-order member visibility and fixed pipeline order as two separate rules
- [ ] The `withGrouping()`/`expandedRows` lazy guarded read appears as the worked example of "types are stricter than runtime"
- [ ] No `createTableSchema()` and no `ComposedFeatureMembers` remain in the file
- [ ] `grep -n 'with[A-Za-z]*<[A-Z]' docs/1-state/architecture.md` returns nothing
- [ ] ADR-0003's amendment is linked, not restated

---
← [Step 3: ADR-0014 derived-signal errors](step-3-adr-0014-derived-signal-errors.plan.md) | [Step 5: row-editing shared-store rationale](step-5-row-editing-shared-store-rationale.plan.md) →
