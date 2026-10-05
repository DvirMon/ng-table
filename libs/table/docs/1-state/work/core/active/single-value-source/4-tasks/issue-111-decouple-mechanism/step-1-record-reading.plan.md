# Step 1 — Record reading B before any code moves

**PR scope:** standalone. Blocks Steps 2 and 4.

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md` (edit)
- `libs/table/docs/decisions/grouping.md` (edit)

## Why This Step Exists

[#111](https://github.com/DvirMon/ng-table/issues/111)'s third acceptance
criterion is not "a particular reading wins" — it is that the choice is
**written down before any code moves**. The issue offers three readings
(A, B, C) of how much of the schema mechanism to extract, and states that
none of them changes what #114 / #115 / #100 consume. So the record is the
deliverable, and the code steps are downstream of it.

The reading chosen is **B**.

`decisions.md`'s node **M2** currently names two runners
(`runRecordedSchema`, `runDeclaredSchema`, `keyDeclarations`). Under B only
the first is built. M2 must say so, or the next reader takes the node list
as the contract and builds a declaring runner nobody asked for.

## What To Do

1. In [`decisions.md`](../../decisions.md), append to **Questions settled
   while sequencing** (the list that already holds the `#100 Q2` / `Q4`
   entries), matching that section's existing shape — bolded question,
   answer inline, evidence after:

   > - **#111 — extract one runner or two? One. Reading B.**
   >   The recording form's runner has real duplication to collapse:
   >   `runColumnsSchemaFn` (`columns-schema/schema.ts:36-44`) and
   >   `runGroupingSchemaFn` (`with-grouping/schema.ts:38-46`) are the
   >   same five statements, and sorting (#100, G69) is a third caller.
   >   The declaring form's would have exactly one caller —
   >   `buildFilterModel` — since `buildFiltersPath` already shares
   >   `createPathProxy` and `keyRules` is six lines. Its second caller is
   >   `stageSchema` (ADR-0020, #102), which is unbuilt and is its own
   >   epic. Reading A was rejected on
   >   `general-mechanism-over-enumerated-cases`' own caveat — a general
   >   mechanism nobody extends is cost without payoff. Reading C was
   >   rejected because it leaves the recording body duplicated, which is
   >   the one piece of real duplication in the file set. `engine/filters/
build.ts` is untouched by #111; #102 reopens it.

2. In the same file, amend node **M2** in the **Nodes** table so it names
   one runner, not three symbols. Replace its cell text with:

   > Shared recording runner — `runRecordedSchema` in `schema/run-schema.ts`;
   > rewire columns and grouping. The declaring form keeps `buildFiltersPath`
   > / `keyRules` in `engine/filters/build.ts` until `stageSchema`
   > (ADR-0020) is a second caller — #111 reading B, see "Questions settled".

3. In the **Nodes added after this ranking was written** section, amend the
   first bullet (`**M2 is two runners, not one** (G62)`). G62 is about the
   two _authoring forms_ being permanent, which stays true — what changes is
   that only one of them gets an extracted runner in this slice. Reword the
   bullet's second half to say that, and link the new "Questions settled"
   entry.

4. In [`docs/decisions/grouping.md`](../../../../../../../decisions/grouping.md),
   append one row at the end of the table, continuing the existing numbering
   (the last row is **G69**):

   > | G70 | One extracted runner, not two — the recording form's body is
   > shared (`schema/run-schema.ts`); the declaring form's stays in
   > `engine/filters/build.ts` until ADR-0020's `stageSchema` is its second
   > caller. Does not narrow G62: both authoring forms remain permanent |
   > 09-20 | accepted | [#111](https://github.com/DvirMon/ng-table/issues/111),
   > [workspace decisions](../1-state/work/core/active/single-value-source/decisions.md) |

   Match the column order and date format the neighbouring rows use —
   copy the shape of G69's row rather than the sketch above, which is only
   showing the content.

## Implementation Notes

- **Why the G-row goes in `grouping.md` and not a new log.** G60–G69 all
  record mechanism-wide schema decisions in that file, including G62, which
  this row qualifies. The repo's rule is one log per capability with its own
  numbering; splitting the mechanism's history across a second file is what
  `libs/table/CLAUDE.md`'s "The decisions log" section exists to prevent.
- **This step restates no rationale in `decisions.md`.** That file's own
  header says so. The "Questions settled" entry records the answer and its
  evidence; the full A/B/C comparison stays on the issue.

## Risks / Watchouts

- Do not renumber or edit any existing `G`-row. G70 is an append.
- Node M3 in `decisions.md` is unchanged — the shared validator is still
  built, under every reading (it is #111's AC #6).

## Non-Goals

- No source change. No `llms:check` — the generated `llms.txt` covers
  specs, not the work folder.
- Not updating `issue-graph.md`'s line 77 ("`#111` extracts two runners,
  not one"). That line is the graph's summary of M2 and is corrected in
  Step 6, once the code proves the shape.

## Acceptance Checks

- [ ] `decisions.md` names reading B in "Questions settled while sequencing",
      and M2's node row no longer promises `runDeclaredSchema` /
      `keyDeclarations`.
- [ ] `docs/decisions/grouping.md` has a G70 row, appended, no existing row
      renumbered.
- [ ] Every relative link added resolves (the workspace sits seven levels
      below `libs/table/docs`).

---

[Step 2: Decouple `path-proxy.ts` from the columns schema](step-2-decouple-path-proxy.plan.md) →
