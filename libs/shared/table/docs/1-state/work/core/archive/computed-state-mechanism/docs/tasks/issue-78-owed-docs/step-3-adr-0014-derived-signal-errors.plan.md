---
title: "Step 3 — ADR-0014: the derived-signal row in the runtime-error policy"
type: task-step
issue: 78
---

# Step 3 — ADR-0014: the derived-signal row in the runtime-error policy

**PR scope:** One ADR amendment. No other file.

**Task type:** docs

**Skills used:** —

**Depends on:** —
**Parallel-safe with:** Step 1, Step 2, Step 6, Step 7

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/adr/0014-runtime-error-policy.md` (edit)

## Why This Step Exists

ADR-0014 splits consumer callbacks into construction-time (throw) and runtime per-row (degrade,
never throw) and tables the fallback per callback — filter predicate, `sortFn`, `accessor`,
`aggregateFn`. `withComputed()` introduced a consumer callback that fits **neither** row cleanly,
and #67 settled its handling. The ADR is the policy's single home, so the answer belongs here or
the next derived-state author re-derives it wrong.

The settled behaviour, from `3-decisions.md` (D28) and `with-computed.spec.ts`:

- A derive **block** that throws while *declaring* — at construction, before data — throws. There
  is no correct degraded reading of a block that never produced its members, and it fires on the
  first run.
- A derived **signal** that throws at *evaluation* — data-dependent, possibly only in production —
  is reported with its member key and then **rethrown**. It does not silently fall back.
- A fallback value was considered and **rejected**.

That last pair is the interesting part: it is the one runtime-class callback in the library that
does not degrade, and the ADR's own table says runtime callbacks degrade. The amendment must
explain the exception rather than quietly contradict the table.

## What To Do

Add a dated `## Amendment (2026-09, #67): derived signals` section that:

1. **Adds the construction-time row.** A derive block failing at declaration throws, same class as
   a slot collision — cite the existing "Sane degraded behavior exists: **no**" column.
2. **Adds the runtime row, with its exception.** A derived signal failing at evaluation is
   reported with the member key, then rethrown. Give the report's actual shape (the
   `[createTable] derived member … threw` line the #77 walkthrough watches for).
3. **Says why rethrow, not degrade.** The ADR's four degrading callbacks each have a fallback that
   is *visibly* wrong and recoverable (unfiltered rows, unsorted order, an `undefined` cell). A
   derived member has no such fallback: the library cannot know whether `undefined`, the previous
   value, or a zero is a safe reading of a consumer's own derivation, and every choice is silently
   wrong at the exact moment the value matters. Reporting and rethrowing keeps the failure loud.
   Reference `classify-errors-construction-vs-runtime`'s "hiding data is the unrecoverable
   direction" — the same reasoning, opposite conclusion, because here the *fallback* is what hides.
4. **Records the rejected alternative** in the existing `## Alternatives considered` section: a
   per-member fallback value. Why rejected: it makes a broken derivation indistinguishable from a
   working one, and the member's consumers (template bindings, other features' reads) would carry
   the wrong value silently.
5. **Notes where the wrapper lives** — inside `withComputed()`, never in the fold. A fold-level
   check would reject method members (review finding 2, D28).

## Implementation Notes

- The ADR's tables are its structure. Extend the existing `Callback | Fallback | Why` table with
  the derived-signal row rather than writing a parallel prose section, so the exception sits next
  to the rule it excepts.
- Quote the report line verbatim from `with-computed.ts`; #77's walkthrough checklist watches the
  console for exactly that string.

## Risks / Watchouts

- Do not soften the table's "runtime callbacks never throw" rule into "usually". State the rule,
  then the one exception and its justification — a hedged rule stops deciding anything.
- `withComputed()`'s construction-time validation and its evaluation-time wrapper are different
  code paths. Keep them in different rows; conflating them is how the next reader wraps the wrong one.

## Non-Goals

- ADR-0003 (Step 1), ADR-0005/0007 (Step 2).
- Changing any runtime behaviour — this step records what shipped.

## Acceptance Checks

- [ ] ADR-0014 carries a construction-throw row and an evaluation report-then-rethrow row for derived state
- [ ] The rethrow exception is justified against the ADR's own degrade rule, not left contradicting it
- [ ] The per-member fallback is recorded as rejected, with its reason, in `## Alternatives considered`
- [ ] The report string matches `with-computed.ts` verbatim
- [ ] Amendment carries the date and a pointer to #67

---
← [Step 2: ADR-0007 + ADR-0005 member claims](step-2-adr-0007-0005-member-claims.plan.md) | [Step 4: state-layer architecture](step-4-state-architecture-composition.plan.md) →
