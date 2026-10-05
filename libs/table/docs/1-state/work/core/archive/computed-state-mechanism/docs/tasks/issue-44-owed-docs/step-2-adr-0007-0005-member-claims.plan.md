---
title: 'Step 2 — ADR-0007 + ADR-0005: core-key pre-claims, the unclaimed totalRowCount, derive-block labels'
type: task-step
issue: 78
---

# Step 2 — ADR-0007 + ADR-0005: core-key pre-claims, the unclaimed `totalRowCount`, derive-block labels

**PR scope:** Two ADRs, one topic. ADR-0005's owed sentence is _about_ the claim path ADR-0007
defines, so splitting them would put half a rule in each PR.

**Task type:** docs

**Skills used:** —

**Depends on:** —
**Parallel-safe with:** Step 1, Step 3, Step 6, Step 7

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/adr/0007-feature-member-claims.md` (edit)
- `libs/shared/table/docs/adr/0005-generic-table-host.md` (edit — one sentence at `:82`)

## Why This Step Exists

ADR-0007 decided that a feature claims its member keys and a collision throws. #34 extended the
mechanism in three ways the ADR does not mention, and all three are things a feature author hits:

- **Core keys are pre-claimed.** The base store is built before the fold, and its members are
  claimed up front, so a feature claiming a core key collides at construction instead of shadowing
  the core.
- **`totalRowCount` is deliberately left unclaimed.** It is the one core-adjacent key a feature is
  _allowed_ to provide — which is what ADR-0005 needs a sentence about, since ADR-0005 names the
  override path (`:82`, `aria-rowcount`) without saying how a feature legitimately takes it.
- **Derive blocks are claimants too**, and they carry their own label in the collision message.

ADR-0005's gap is pre-existing — the workspace architecture doc already named it. It closes here
because the answer is ADR-0007's rule, not a new decision.

## What To Do

**ADR-0007** — add a dated `## Amendment (2026-09, #33)` section covering, in this order:

1. **Core-key pre-claim.** `composeTable()` builds the base store first and pre-claims every core
   member key before the fold runs. State what the collision message looks like for a core key vs.
   a feature-vs-feature collision, and that pre-claims do not shift a consumer feature's position
   (positions stay as the consumer wrote them — `internal feature N` labels are separate).
2. **`totalRowCount` is deliberately not pre-claimed.** Say why: it is the documented override
   point for `aria-rowcount` under server-side paging, so a feature must be able to claim it. This
   is the one core-adjacent key where a feature wins by design rather than by collision.
3. **Derive-block claimant labels.** A derive block's members are claimed under a label naming the
   block and its host position, so a collision between a feature's own member and its derive
   block's member is attributable. Include the actual label shape.
4. Fix `:27`'s `features: [withOptimistic<Person>(), withRowEdit<Person>()]` to the positional
   form. The example must keep making its point — composing both still throws; only the call shape
   changes.

**ADR-0005** — at `:82`, after the existing `totalRowCount` bullet, add one sentence: a feature
legitimately claims `totalRowCount` because the engine deliberately leaves it unclaimed
(ADR-0007's amendment, #33), so a server-paged table can report the true total for `aria-rowcount`
without an engine change. One sentence, with the cross-link. Not a section.

## Implementation Notes

- The exact collision-message shapes and label strings are in `engine/slots.ts` and its spec. Read
  them and quote what the code emits — do not invent a message format.
- ADR-0007's existing voice is short and concrete (`Error: feature #2 already claims member
'editing' (claimed by feature #0)`). Match it.

## Risks / Watchouts

- ADR-0005 is a _host_ ADR; it must not grow a composition section. One sentence and a link, or
  the concern leaks across ADR boundaries.
- `totalRowCount` being unclaimed is deliberate, not an oversight — say so explicitly, or the next
  reader "fixes" it by pre-claiming it.

## Non-Goals

- ADR-0003 (Step 1), ADR-0014 (Step 3).
- The `defineFeature()` overload-prologue dedupe found on #40 — a code issue, not this one.

## Acceptance Checks

- [ ] ADR-0007 covers core-key pre-claims, the unclaimed `totalRowCount`, and derive-block claimant labels
- [ ] Both ADRs carry the date and a pointer to #33
- [ ] ADR-0005's `totalRowCount` bullet states the legitimate claim path in one sentence, linked to ADR-0007
- [ ] ADR-0007's collision example uses the positional form and still throws
- [ ] Quoted error/label strings match `engine/slots.ts`

---

← [Step 1: ADR-0003 row-type reversal](step-1-adr-0003-row-type-reversal.plan.md) | [Step 3: ADR-0014 derived-signal errors](step-3-adr-0014-derived-signal-errors.plan.md) →
