# Step 4 — Record the probe answers

**PR scope:** standalone. **Depends on:** Step 3 (the answers
come from its probes).

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** none (main thread)

## Files

- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md` (edit)
- `libs/table/docs/1-state/work/core/active/single-value-source/3-architecture.md` (edit — Open questions 1, 2, 3, 6 only)

## Why This Step Exists

#130's acceptance list requires two open questions to be
"settled by probe" **and recorded**, plus the two shaping
questions the architecture left to the session. An answer
that lives only in a spec's assertion is invisible to the
next reader deciding whether D8's severity claim holds.

## What To Do

Append to `decisions.md`'s "`/to-tasks #130` rulings
(2026-09-24)" section (where R9 lives), one settled row per
answer, citing the case in `create-columns.types.spec.ts`:

1. **`col.from` id capture** (case 13) — captured or not, and
   what `from` without `id` yields.
2. **Spread widening** (case 14) — observed `id` type.
   **If it does not widen**, add the correction D8 anticipates:
   `col.from` stands on the stated-rule argument, but the
   "types confidently wrong" severity claim is withdrawn.
3. **Row carrier** (case 11) — `TRow` recovered off `rules`,
   no phantom; or the phantom Step 1 had to add, and why.
4. **Brand leak** (case 12) — none, or where it shows.

In `3-architecture.md` § Open questions, mark 1, 2, 3 and 6
answered with a pointer to the new rows. Leave the others.

## Implementation Notes

- One line per row; the rationale is the spec case it cites.
- Report the ids used.

## Non-Goals

- No edit to `2-spec.md` D1/D8 — R9 and these rows amend
  them by reference; the spec rewrite belongs to #141's docs
  pass.
- No `docs/decisions/*.md` capability-log rows — where this
  work's rows land is still open (`3-architecture.md` §
  "Where the rows go").

## Acceptance Checks

- [ ] Four rows added, each citing its spec case.
- [ ] Open questions 1, 2, 3, 6 marked answered.

---
← [Step 3: Type proofs](step-3-type-proofs.plan.md)
