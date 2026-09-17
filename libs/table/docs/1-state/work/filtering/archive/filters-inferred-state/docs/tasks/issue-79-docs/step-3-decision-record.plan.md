# Step 3 — Mark R10, R11, R31, R32 and R33 where they stand

**PR scope:** PR 1 of 1 (`#79`). **Parallel-safe with: Step 1, Step 2.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none (main thread)

## Files

| File | Action |
|---|---|
| `libs/shared/table/docs/1-state/work/with-filtering/design-options-hybrid-api.md` | edit — five in-place banners, one factual correction |

## Why This Step Exists

The re-grill already records what it supersedes, but only in one place: the
`### What the re-grill supersedes` table at the end (~L1676). A reader who arrives at R11 or R32
directly — through a search, or through one of the R-number citations scattered across the specs —
reads a superseded decision with nothing on it saying so, and the table 600 lines below is not
reachable from there.

A decision record is a history. The fix is a banner at each decision, not an edit to its argument:
the reasoning is why the project believed what it believed, and deleting it destroys the only
account of how the current shape was reached. One of these decisions was *factually wrong* about
TypeScript, which is the most valuable kind of entry to keep legible and the one most likely to be
quietly rewritten.

## What To Do

Add a short banner immediately above each decision's own heading, in the form the file already
uses for R43 (~L1584) and for the Option A–D verdict (~L379): a blockquote opening with `⚠️`,
carrying the date and the R-number that replaced it. Match that voice; do not invent a second
banner style.

1. **R10** (~L613) — **stands.** No banner. The re-grill's table says so explicitly, and a
   "superseded" marker here would be wrong: `createFilters` is still standalone and the carrier
   involves no table. Confirm the text makes no claim the carrier broke, and move on.
2. **R11** (~L635) — **superseded by R35**, and partly wrong. Two things in one banner:
   - Data is accepted when it exists. `rowOf()` is the server-mode escape hatch, not a separate
     API, so "takes no `data` argument" is no longer the shape.
   - **The closing claim is factually wrong and the correction is the point of the banner.**
     R11 ends by asserting that TypeScript cannot recover `TRow` from a callback whose parameter
     is `ColumnsPath<TRow>`. Recovery through the *callback* was never the mechanism — R35 anchors
     `TRow` on a value in argument position, exactly as `createTable(data, …)` and `form(model, …)`
     do, which R11 itself names as the two APIs it was worse than. Cite
     `research-typescript-inference-probes.md` as the compiled evidence — from the decisions doc
     that link is `../filters-inferred-state/research-typescript-inference-probes.md`.
   - **Do not delete R11's "Accepted cost: `TRow` must be written explicitly" block.** It is the
     cost that R35 removed; erasing it erases what the change bought.
3. **R31** (~L1272) — **stands, and is finally enforceable.** Not a supersede. A short note that
   R45 gave the literal-key guard a real inference site, so the string-literal requirement R31
   specified now bites at compile time instead of being aspirational.
4. **R32** (~L1304) — **superseded by R34/R36.** The criterion map is inferred from the returned
   array; the caller-supplied type parameter is gone. R32's argument rests on `schema: (path) =>
   void` having no return channel to observe — say plainly that the change was to give it one, so
   the reasoning was sound on its own premise and the premise is what moved.
5. **R33** (~L1320) — **ceases to exist, and say that rather than "superseded".** The ambient
   recorder stack it describes is deleted, not replaced by a different recorder: rules return
   their records, so there is no enclosing session to recover. Both of its riders go with it — the
   non-reentrancy caveat and the "Known gap" that forced `anyOf<Invoice>('search', …)`. The banner
   should make clear that nothing took over this decision's job, because the job stopped existing.
6. **R43** (~L1584) — **leave the existing banner exactly as it is.** It is already correct and
   already legible. If any edit in this step lands near it, verify afterwards that it still reads
   as the first thing above R43's heading.
7. **Frontmatter.** The `status:` line already narrates the supersede history (R32, R43, R46). Add
   R11/R33 to it only if it can be done without the line becoming unreadable; otherwise leave it —
   the per-decision banners are what this step is for.

## Implementation Notes

- The `### What the re-grill supersedes` table stays. The banners are the entry points; the table
  is the index. They must not disagree — if writing a banner reveals a mismatch with the table,
  the table is the one that was written first and the banner text should be brought into line with
  it, not the reverse, unless the table is provably wrong.
- Keep each banner short. Three or four lines, pointing at the R-number that replaced it and at
  `docs/1-state/filters.md` for the shipped shape. The argument for the new decision lives at
  R34–R48; do not restate it five times.

## Risks / Watchouts

- **Never edit a superseded decision's body to make it true.** The one exception this step
  contains is a *correction appended as a banner* to R11's factual error — the wrong sentence
  stays on the page, with the correction above it. A record that silently agrees with the present
  is not a record.
- This file is ~1900 lines and heavily cross-referenced by R-number from the specs and from the
  workspace. Do not renumber, reorder or merge decisions.

## Non-Goals

- `docs/1-state/filters.md` and `features/filtering.md` — Steps 1 and 2.
- The other workspace documents that mention the landmines
  (`migration-decouple-filters-from-table.md`, `review-filters-table-coupling.md`,
  `decouple-filters/spec.md`). They are working records of their own tickets and describe what was
  true when written; the issue's landmine criterion is about living documentation.
- Adding new R-numbers. R34–R48 are recorded and settled.

## Acceptance Checks

- [ ] R11, R32 and R33 each carry a banner at their own heading, in the file's existing style
- [ ] R33's banner says it ceases to exist, not that it is superseded, and names the deleted
      recorder as the reason
- [ ] R11's banner corrects the row-type-recovery claim and cites the inference probes
- [ ] R11's "accepted cost" block and R32's argument are still on the page, unedited
- [ ] R10 and R31 are marked as standing, with R31 noting R45 made `as` enforceable
- [ ] R43's obsolete banner is intact and still sits directly above R43
- [ ] No decision was renumbered, reordered, merged or deleted
- [ ] The banners and the `What the re-grill supersedes` table agree

---
← [Step 2: Reconcile the feature doc](step-2-feature-doc.plan.md) | [Step 4: Correct the remaining surfaces](step-4-surfaces-issue-rollup.plan.md) →
