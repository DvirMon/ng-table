# Step 6 — Columns decisions log

**PR scope:** standalone.
**Parallel-safe with:** Step 1, Step 2, Step 3, Step 4, Step 5

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/decisions/columns.md` (**new**)
- `libs/table/docs/decisions/grouping.md` (edit: G74 status)
- `libs/table/docs/decisions/sorting.md` (edit: SO25 status)
- `libs/table/docs/status.md` (**generated**: `npm run
table:status`, never hand-edited)
- `libs/table/docs/1-state/work/core/active/single-value-source/3-architecture.md`
  (edit: "Where the rows go", `:455-473`)

## Why This Step Exists

#141 acceptance item 8, and the archive gate (item 10). R15
settled the home: a new `columns.md`. `columns` is already a
registered capability in `status.md`, with `—` in its
Decisions column. `libs/table/CLAUDE.md` says a work folder
may not move to `archive/` until every decision in it is
registered in its capability's log.

## What To Do

1. **Create `columns.md`.** Follow
   `~/.claude/conventions/doc-contracts/decisions-log.md` and
   copy `grouping.md`'s header and table shape: frontmatter
   (`capability: columns`, `type: decisions-log`), a
   "read this first" paragraph pointing at the columns spec,
   "restates nothing", and a Source keys table.
   **Prefix `COL`** (user ruling, 2026-09-25). This leaves `C`
   free for a future core log. State the prefix in the header.
2. **Enumerate from `decisions.md` directly.** Don't trust
   "sixteen + four". Walk each `### Settled` block, oldest
   first:
   - `createColumns() grill` (2026-09-22): N4, N1, the N4
     addendum, runtime-dynamic ids, the rename, N3, accessor
     placement, N2, the G65 correction, N6, the row witness,
     the brand, the default accessor, the empty list,
     `col.from`, the order slice (#128).
   - Conflict-audit R1–R8.
   - `/to-tasks #130` R9–R13.
   - `/implement #131` R14.
   - issue-141 R15–R16.
   - Any later block (for example a #139 or #140 ruling) that
     exists when this step runs.
   - The K0 bullets in "Questions settled while sequencing"
     (curried `createColumns`, `TCols`/`TValues`). Register
     them as superseded by the grill rows, unless G73 already
     covers them. Check G73 first.
3. **One line per row.** Columns: `#`, decision, date, status,
   record link (anchor into `decisions.md` or the spec's `D`
   number). Use the log contract's status vocabulary. R3 and R6
   are **owed** to #116 and #117: mark them open, not shipped.
4. **Rows already in another log.** G74 (rename), G75
   (correction) and G76 (R8) stay in `grouping.md`. SO25 stays
   in `sorting.md`. In `columns.md`, write a row that
   cross-references them rather than duplicating. The contract
   says each log records nothing recorded elsewhere.
5. **Status flips.** G74 and SO25 read `accepted, unbuilt`.
   #136 shipped the eight renames. Flip both rows to shipped
   for the shipped names. `sortFn`/`sortable` stay unbuilt
   until #100. If one row can't hold both states, say so in
   the row, same as G76 does.
6. **`3-architecture.md` "Where the rows go".** Replace the
   open-question body with one line: the rows live in
   `docs/decisions/columns.md` (R15). Also mark open question 5
   (`:440`) answered.
7. **Run `npm run table:status`.** `generate-status.ts` finds
   logs by filename, so the `columns` row's Decisions column
   stops showing `—`.

## Implementation Notes

- Link targets: prefer a heading anchor into `decisions.md`.
  Where the rationale lives in the spec (`D1`–`D25`), link the
  spec section.
- The row statuses (shipped vs. accepted) must match what
  `src/` has at the time this step runs, not the issue list.
  Check with `git log`.

## Risks / Watchouts

- The decisions-log contract lives outside the repo
  (`~/.claude/conventions/`). Read it before writing, not
  after.

## Non-Goals

- Archiving the work folder. That happens after #141, and
  only once every row exists.
- A `core.md` log. R15: it would ship empty.

## Acceptance Checks

- [ ] `columns.md` exists, uses `COL` numbering, and has one row
      per settled decision found in `decisions.md`, counted at
      run time.
- [ ] No decision is duplicated across logs. Cross-references
      only.
- [ ] G74 and SO25 statuses match `src/`.
- [ ] `status.md` was regenerated, and the `columns` row links
      the log.
- [ ] `3-architecture.md`'s "Where the rows go" is resolved.

---

← [Step 5: Check #140's order-window doc](step-5-verify-order-window-doc.plan.md) | [Step 7: Regenerate and gate](step-7-regenerate-and-gate.plan.md) →
