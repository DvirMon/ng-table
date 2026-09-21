# Step 9 — Docs, decisions and `llms.txt`

**PR scope:** standalone. **Depends on:** Step 8 (the `.mdx` code tabs
must match the story code they describe, so the stories settle first).

**Task type:** docs

**Skills used:** — (main thread, no agent)

## Files

- `libs/table/docs/1-state/features/grouping.md` (edit)
- `libs/table/src/stories/grouping/grouping.mdx` (edit)
- `libs/table/docs/decisions/grouping.md` (edit)
- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md` (edit)
- `libs/table/docs/1-state/work/core/active/single-value-source/issue-graph.md` (edit)
- `libs/table/docs/adr/0019-columns-path-keyed-by-declared-column-ids.md` (edit)
- `llms.txt` (regenerate)

## Why This Step Exists

`grouping.md` currently carries a **"Migration in flight (G42–G45)"**
block announcing a move this slice completes, and its API surface section
still prints `ColumnId<TRow>` and `GroupingLevel.key`. `grouping.mdx`
tells a reader that `aggregateFn` is a column option and that group
labels resolve in three tiers. Both are now wrong in ways a reader acts
on.

Stale status in a doc is not neutral — `CLAUDE.md`'s own rule
(`claude-md-no-implementation-status.md`) exists because an always-loaded
file claiming a closed migration was in flight propagated into a wrong
answer. The same failure mode applies to a feature doc that announces a
migration after it lands.

## What To Do

**1. `1-state/features/grouping.md`.**

- **Delete the "Migration in flight (G42–G45)" block** (~line 186). It
  describes exactly what this slice shipped.
- API surface: `initial?: (TId | GroupingLevel<TId>)[]`,
  `GroupingLevel.columnId`, `schema?: GroupingSchemaFn<TRow, TId>`.
  `ColumnId<TRow>` is gone from the library — remove every mention.
- The declarator table gains `applyAggregate(path.x, aggregateFn)`.
- **Value resolution** — the section saying a level's value comes off the
  row field (~line 69) is the core reversal. It now reads
  `readAccessor(column, row)`, optionally transformed by `applyGroupKey`.
  Say plainly that the extractor receives the accessor's output, and give
  the two cases the issue names: a column whose accessor already computes
  the group value needs no `applyGroupKey`; `closedAt: Date` still does.
- **Label resolution is two tiers**, not three.
- **New: the construction throw and the writer throw.** One rule, both
  paths, `[withGrouping]` naming the offending id. Note that index bounds
  on `reorderGroupLevels` still degrade — that distinction is the part a
  reader gets wrong.
- **New: carrier columns.** `{ id, accessor, visible: false }` is how a
  value the table groups by but never renders is declared (G54), with the
  standing caveat that `visible` is not enforced by the library —
  consumers filter themselves.
- Aggregates section: declared through the grouping schema, keyed by
  declared column id, validated at construction. The ADR-0014 degrade
  wording is unchanged.

**2. `grouping.mdx`.**

- **~line 215** — the `aggregateFn`-is-a-column-option paragraph inverts.
  Must match `grouping-aggregates`' host text from Step 8 word for word
  in substance; they teach the same lesson.
- **~lines 166-177** — `grouping-keys`' description drops the third
  label tier and the `territory` control. Keep the `applyGroupKey`
  `YYYY-MM` bucketing lesson.
- **~line 53 and ~line 73** — `Basic`'s "no `aggregateFn`" framing still
  holds as a statement about scenery, but the spelling changes. Check
  every code tab against the real host after Step 8.

**3. `docs/decisions/grouping.md` — status column.**

G53, G54, G55, G57, G58, G59, G60, G68 move from `accepted, unbuilt` to
`shipped`. G43 and G45 already read `superseded`; leave them. G44
(`ColumnDef.aggregateFn` deleted outright) moves to `shipped`.

G46 (the `#100 → #47 → #45` sequencing) is listed `open` and this slice
reorders it — #47 assumes `ColumnDef`-declared `aggregateFn`, which no
longer exists. Add a line saying so; do not attempt to re-sequence #47
here.

**4. Add the new decision.** The writer-throws ruling has no G-number yet
— it was settled while planning on 2026-09-21. Register it as the next
free G-number in `docs/decisions/grouping.md`:

> A grouping level naming no declared column throws on **both** paths —
> at construction and on `table.grouping`'s writer. One rule, since the
> writer is the only other way an unknown id can reach the applied
> levels, and AC #5 deletes `groupingLevels`' filter on the claim that it
> cannot. Index bounds on `reorderGroupLevels` still degrade.

Record the same ruling in the workspace `decisions.md`, under "Questions
settled while sequencing", with the question as asked and the reasoning
for the rejected options (engine-drops-silently, degrade-and-report,
keep-the-filter).

**5. `decisions.md` + `issue-graph.md` — node states.**

Mark K2, K4, V2 and V4 done. `#114` moves to ✅ CLOSED with its commit,
and `#117` becomes unblocked on the `#114` side (still waiting on
`#115`). Update the "Current frontier" bullet.

**6. `ADR-0019` amendment line.** The workspace `decisions.md` lists an
ADR-0019 amendment among D2's docs scope. Add the line recording that
grouping's declarations now key by declared column id — ADR-0019 is
where the `ColumnsPath`-keyed-by-declared-ids decision lives, and
grouping joining it is the fact worth stating there.

**7. `npm run llms` and confirm `npm run llms:check` is clean.**

## Implementation Notes

- **`~/.claude/rules/claude-md-no-implementation-status.md` applies to
  `grouping.md` too.** Delete the status block rather than editing it to
  say "shipped" — status lives in `docs/decisions/grouping.md` and the
  issue, and `grouping.md` should point there.
- **Do not restate rationale in the feature doc.** ADR-0024 holds it.
  `grouping.md` says what the API does; the decisions log says why.
- **`libs/table/CLAUDE.md`** — check it for any grouping claim this slice
  invalidates (keying, `aggregateFn`, label tiers). Same rule: invariants
  only, no status.
- Line-wrap prose at ~80 chars to match the surrounding docs.

## Risks / Watchouts

- **`.mdx` code tabs drift silently.** They are prose, not compiled. AC
  #10 asks specifically that they match the code — diff each tab against
  the host file rather than reading for plausibility.
- **`llms:check` failing after regeneration** usually means a doc the
  generator reads moved or changed heading level. Fix the source doc, not
  the generated file.
- **Do not close `#100` or `#47` here.** They have their own slices, and
  `#47`'s reordering is a note, not an action.

## Non-Goals

- **No ADR-0024 edit.** It already describes the end state; this slice
  implements it.
- **No `#116`.** The cross-cutting schema-declaration ADR is its own
  issue and blocks nothing mechanically.
- **No filtering or sorting docs.** #115 and #100 own theirs.
- **No new capability doc.** `1-state/features/grouping.md` is the
  contract file; this slice edits it, it does not restructure the doc
  set.

## Acceptance Checks

- [ ] `npm run llms:check` clean.
- [ ] No occurrence of `ColumnId<` or `aggregateFn` on a column anywhere
      under `libs/table/docs/` or `grouping.mdx`.
- [ ] The "Migration in flight" block is gone from `grouping.md`.
- [ ] Every `.mdx` code tab for a grouping story matches its host file.
- [ ] G53/G54/G55/G57/G58/G59/G60/G68 and G44 read `shipped`; the
      writer-throws decision has its own G-number.
- [ ] `issue-graph.md` shows `#114` closed and the frontier updated.

---
← [Step 8: Stories and fixtures migrate](step-8-stories-and-fixtures.plan.md)
