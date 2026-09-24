# Step 5 — Record it

**PR scope:** standalone. **Depends on:** Step 3, Step 4.
**Parallel-safe with:** —

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/CLAUDE.md` (edit — the code-layout table and
  the "Errors" bullet)
- `libs/table/docs/decisions/grouping.md` (edit — G76 row)
- The log that holds N2/R7/E12. Architecture's "Where the
  rows go" names it, so don't guess.
- `libs/table/docs/1-state/work/core/active/single-value-source/3-architecture.md`
  (edit — correct the R8 sentence at `:159-162`)

## Why This Step Exists

Spec D15 says the consequence "must be documented, not
merely done". ADR-0014's amendment already records the
policy (dev-gated ≠ policy violation), so this step doesn't
re-argue it. It records **where** the gates are and the one
fact the architecture got wrong.

## What To Do

1. **`CLAUDE.md` code-layout table.**
   - `schema/validate.ts` row: two exports. Name the
     dev-gated construction check and the ungated writer
     check (Step 1's name). The gate is in the body.
   - Add or update the `api/create-columns.ts` row: it runs
     the three construction checks. Only if the table has
     such a row. #130 may have added it.
2. **`CLAUDE.md` "Errors" bullet.** One sentence: construction
   checks are dev-only (ADR-0014 amendment), and each gates
   inside its own body, never at a call site. A check
   whose ids can come from a user action at runtime
   (grouping's writer, G76) stays ungated. Keep "throw vs
   degrade" as the bullet's subject.
3. **G76 row.** Add that the split is now structural:
   the writer calls its own ungated export. Link #132.
4. **N2 / R7 / E12 rows.** Mark them shipped and link #132.
   Add the gate-placement ruling as its own line: each
   check gates in its own body (2026-09-24, R7 applied to
   the two non-shared checks).
5. **Architecture `:159-162`.** Its claim that "the writer
   throw lives elsewhere" was false at HEAD. Replace it with
   what shipped, one line.

## Implementation Notes

- `claude-md-no-implementation-status`: `CLAUDE.md` gets the
  lasting rule ("gate in the body"), not "#132 shipped".
- One line per decision-log row.

## Non-Goals

- Editing ADR-0014. Its amendment already covers the policy.
- `llms.txt` / public docs. Error behavior isn't on the
  public surface (#141 owns the prose migration).

## Acceptance Checks

- [ ] `CLAUDE.md` names both `validate.ts` exports and the
      rule that gates go in the body.
- [ ] G76's row says the split is structural.
- [ ] N2/R7/E12 are marked shipped, and the gate-placement
      ruling is recorded.
- [ ] The architecture's R8 sentence matches the code.

---
← [Step 4: G76 split specs](step-4-g76-split-specs.plan.md)
