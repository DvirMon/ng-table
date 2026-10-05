# Step 7 — Document `accessor` as the value contract

**PR scope:** Reference-doc updates only — `accessor` gets the section it has never had, and
`cells` gets named in the core-config spec. Closes #80's C4.
**Depends on:** Step 1 (the ADR it points at), Step 3 (the shipped shape it describes).
**Parallel-safe with:** Step 5, Step 6, Step 8.
**Task type:** `docs`
**Skills used:** —
**Scaffolding agent:** — (main thread)

## Files

| File                                                      | Action                                  |
| --------------------------------------------------------- | --------------------------------------- |
| `libs/table/docs/2-columns/reference/tier-1-intrinsic.md` | edit — new `accessor` section           |
| `libs/table/docs/1-state/columns.md`                      | edit — `cells` named in the state shape |

## Why This Step Exists

`accessor` is the oldest field on `ColumnDef` and has never been documented as anything. It is
mentioned twice in `docs/2-columns/reference/`, both times in passing as an example of a field
that defaults (`ownership-model.md:18`, `tier-1-intrinsic.md:50`). Nothing says what it _means_.

That gap is what produced #80's S8: grouping keyed on `column.accessor(row)`, and an accessor
returning a primitive silently doubled as the group label — a load-bearing contract nobody had
written down. Now that `cells` makes `accessor` the documented way a value reaches a template,
leaving it undocumented is how the next undeclared contract grows.

`accessor` is Tier 1 — intrinsic, column-owned, array-only, static. It sits next to `label`,
which made the same ownership call for the same reason.

## What To Do

### `docs/2-columns/reference/tier-1-intrinsic.md`

Add an `## accessor — the value contract` section, placed beside the existing `label` section
(both are array-only statics; `applyVisible` is the reactive outlier and should stay first).

Cover, in the file's existing voice — claim, then constraint, no narration:

- **What it is.** `(row: TRow) => unknown` — the single derivation from a row to that column's
  value. Defaults to `(row) => row[id]` in `resolveColumnDefs()`, same optionality posture as
  `visible`/`order`/`label`.
- **Array-only and static.** No `applyAccessor` in `columnsSchema`. Same ownership call as
  `label` and `applyOrder`: no reactive or async case has surfaced. State the revisit condition
  rather than leaving it open-ended.
- **`accessor` defines, `cells` reads** (D7). These are not two ways to one value: `accessor` is
  the input — how a value is derived — and `RenderRow.cells` is the output, what it resolved to.
  Give the one-line template shape:

  ```html
  @for (column of visibleColumns(); track column.id) {
  <td>{{ row.cells[column.id] | dealAmount }}</td>
  }
  ```

  and say plainly that calling `column.accessor(rowData)` in a template is the pattern `cells`
  replaces — unmemoised, once per cell per change-detection pass. Link ADR-0022.

- **Values are raw.** Formatting is a pipe's job (D6). `grouping-story.pipes.ts` is the worked
  example: one pure pipe per concern, each taking `unknown` because `accessor`'s return type is
  erased.
- **It is a consumer callback under ADR-0014.** A throwing `accessor` degrades that one cell to
  `undefined` and reports once per column per evaluation. One line plus the link — do not restate
  the policy table.
- **Ids must be unique** (D10). `cells` is keyed by column id, so two columns sharing an id
  collapse to last-wins and both cells render the same value. `resolveColumnDefs` throws on this
  under `ngDevMode`. Two columns sharing an `accessor` under different ids stays legal and is the
  supported way to show one field twice.
- **`accessor` is not in the grouping path.** Since grouping's D7 (ADR-0021), a grouping level
  names a _row field_ and reads it by bracket access; value narrowing there is the rule's own
  `extractValue`, not the column's `accessor`. Say this explicitly — the old "accessor is today's
  label contract" reading is what #80 inherited and it is no longer true.

### `docs/1-state/columns.md`

Smaller edit. In the State Shape / resolution section, name `cells` as the read side of a
resolved column: `store.columns()` is the resolved `ColumnDef[]`, and
`store.renderRows()[i].cells[columnId]` is that column's value for that row. One short paragraph
plus the ADR-0022 link — the full contract lives in `tier-1-intrinsic.md`, and this file should
point there rather than carry a second copy.

Note the group-row half in one sentence: a `kind: 'group'` row's `cells` carries its aggregates,
and its header text is `groupKey.label`, not a `cells` entry.

## Implementation Notes

Both files have frontmatter. `tier-1-intrinsic.md` and `columns.md` are `type: architecture` with
a free-text `status:` — they are **not** feature specs, so they do not carry the
`capability`/`spec`/`code` triple and do not feed `docs/status.md`. Do not add those fields, and
do not run `npm run table:status`.

Keep the prose at the density of the surrounding sections. Per `terse-jsdoc-for-ai-and-humans`
and `concise-docs`, the doc states the contract; the reasoning and the alternatives live in
ADR-0022 and `decisions.md`, which it links to.

## Risks / Watchouts

- **Do not restate ADR-0014 or ADR-0022.** Cite them. A second copy of either drifts.
- **Do not describe `cells` as filtered by visibility.** It carries every resolved column; the
  consumer's `visibleColumns()` loop is what hides one (D3).
- **Check the surrounding claims while editing.** `tier-1-intrinsic.md` is dated 2026-07-24 and
  its `label` section still says "Not yet on `ColumnDef`" — `label` has since shipped
  (`api/types.ts:79`, defaulted in `resolveColumnDefs`). Fix that line while in the file; a stale
  "not yet implemented" in an always-read reference is exactly the failure
  `claude-md-no-implementation-status` describes.
- `llms.txt` indexes ADRs and context files, not these reference docs — but run
  `npm run llms:check` anyway to confirm nothing drifted.

## Non-Goals

- No new ADR — Step 1 owns that.
- No `docs/status.md` regeneration.
- No edits to `docs/1-state/features/grouping.md`. The D11 report is a diagnostic, not a
  grouping contract change, and grouping's spec is already superseded by its own work folder.
- No rewrite of `ownership-model.md`. Its passing mention of `accessor` stays correct; the new
  section is what it now implicitly points at.

## Acceptance Checks

- [ ] `tier-1-intrinsic.md` has an `accessor` section covering: signature and default; array-only
      and static, with the revisit condition; `accessor` defines / `cells` reads with the template
      snippet; raw values and pipes; the ADR-0014 degradation in one line; id uniqueness; and that
      `accessor` is not in the grouping path.
- [ ] The stale `label` "Not yet on `ColumnDef`" claim in that file is corrected.
- [ ] `columns.md` names `cells` as the read side, points at `tier-1-intrinsic.md` and ADR-0022,
      and covers the group-row case in one sentence.
- [ ] Neither file gained `capability`/`spec`/`code` frontmatter.
- [ ] ADR-0014 and ADR-0022 are linked, not restated.
- [ ] Every link in both files resolves.
- [ ] `npm run llms:check` clean.

---

← [Step 6: Grouping report test](step-6-grouping-report-test.plan.md) | [Step 8: Migrate the grouping story hosts](step-8-migrate-grouping-story-hosts.plan.md) →
