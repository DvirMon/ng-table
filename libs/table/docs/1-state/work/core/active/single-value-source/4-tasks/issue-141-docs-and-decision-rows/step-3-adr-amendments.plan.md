# Step 3 — ADR amendments

**PR scope:** standalone.
**Parallel-safe with:** Step 1, Step 2, Step 4, Step 6

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/adr/0019-columns-path-keyed-by-declared-column-ids.md`
  (edit: new amendment and status line)
- `libs/table/docs/adr/0014-runtime-error-policy.md` (read and
  check; edit only if the check fails)

## Why This Step Exists

#141 acceptance items 5 and 7.

- **ADR-0019.** It says `ColumnsPath` is keyed from
  `TableConfig.columns`. After #131/#139 the path is keyed from
  the declaring call, `createColumns(data, build, schema)`: the
  schema is the third argument of the same call that captures
  the ids. Consequence 1 ("literal inference is required, and
  its absence is silent") was something the config shape
  happened to allow. It is now structural.
- **ADR-0014.** Its `## Amendment (2026-09-24): construction
  checks are dev-only` (`:193`) already opens with "This ADR
  never took a position on dev vs. production. It argued throw
  vs. degrade". That is the clarification #141 asks for, in the
  place readers of the error policy will look. This step checks
  it; it does not re-write it.

## What To Do

1. **ADR-0019: add `## Amendment 2026-09-25 — keyed from
   the declaring call`** above the 2026-09-20 amendment, and
   update the header's read-first pointer to it. Content:
   - `ColumnsPath` is keyed from `createColumns`, whose builder
     mints `ColumnDecl`s inside the call (spec D3). It is no
     longer keyed from `TableConfig.columns`, and
     `columnsSchema` is gone (D11, R14).
   - Consequence 1, restated: the ids and the schema now come
     from one call, and the builder captures literals written
     inside that call. So a widened id cannot reach the path
     through the sanctioned spelling. Say which parts are
     structural and which still rely on a probe. A spread
     variant `{ ...col('x'), id: 'y' }` still widens (R11).
     `col.from` with an id omitted widens too (R10). These two
     stay guarded by `create-columns.types.spec.ts`, not by the
     type system.
   - The "What still stands" sentence (`:44-45`, "declared in
     `TableConfig.columns`") gets a one-line pointer to the new
     amendment. Don't rewrite it.
   - Cite spec D1/D3/D11, R10, R11, R14, and #129.
2. **ADR-0019 `Affected surface` line (`:10`)** names "every
   `apply*` rule". Change it to "every schema rule" and link
   ADR-0025.
3. **ADR-0014: check the amendment**, and fill any gap in it:
   - It says a dev-gated construction throw is **not** a
     violation of throw-at-construction.
   - It names where the gates live (each check's own body,
     never a call site) or links `libs/table/CLAUDE.md`'s
     Errors bullet, which does.
   - It records the #127 accepted risk (R7).
   If all three hold, no edit.

## Implementation Notes

- One amendment, dated, above older ones. That is ADR-0019's
  own established pattern. Do not edit the Decision or
  Consequences bodies in place.
- `claude-md-no-implementation-status` does not apply here.
  ADRs carry their own status line.

## Non-Goals

- ADR-0025's reader-naming sentence (`*Of`). R3 assigns that to
  #116.
- ADR-0020's header (R5, done separately).

## Acceptance Checks

- [ ] ADR-0019 has a dated amendment saying paths are keyed
      from `createColumns`, and consequence 1 is restated as a
      structural guarantee, with its two probe-guarded limits
      named.
- [ ] ADR-0019's status line points at the new amendment.
- [ ] ADR-0014's amendment states the dev-gating ≠ policy
      violation point, checked or edited.

---
← [Step 2: Columns and UI docs](step-2-columns-and-ui-docs.plan.md) | [Step 4: CLAUDE.md invariants](step-4-claude-md-invariants.plan.md) →
