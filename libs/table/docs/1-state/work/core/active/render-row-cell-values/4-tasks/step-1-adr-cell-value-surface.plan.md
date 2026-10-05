# Step 1 — ADR-0022: the cell-value surface

**PR scope:** One new ADR recording what `decisions.md` D1–D8 and D10 settled, plus the
`llms.txt` regeneration that adding an ADR requires. No source changes.
**Parallel-safe with:** Step 2, Step 3, Step 4 — an ADR is the written form of decisions that
already exist on disk, so nothing waits on it to compile.
**Task type:** `docs`
**Skills used:** —
**Scaffolding agent:** — (main thread)

## Files

| File                                                 | Action                      |
| ---------------------------------------------------- | --------------------------- |
| `libs/table/docs/adr/0022-render-row-cell-values.md` | create                      |
| `llms.txt`                                           | regenerate — `npm run llms` |

## Why This Step Exists

#80's Scope opens with "ADR: the cell-value surface, deciding Q1–Q5". Those five questions are
answered — D1 (eager), D2 (lazy rejected), D3 (record keyed by `columnId`, no visibility
filtering), D6 (raw values), D7 (`accessor` defines, `cells` reads), D8 (no value generic) — but
they are answered in an episodic work folder that gets archived. `cells` is a **public**
`RenderRow` field with a shape that has to survive: the next person asking "why isn't this an
ordered array?" or "why can't I pipe `cell.value` through `currency`?" needs the answer in
`docs/adr/`, not in a closed work folder.

D10's duplicate-id throw belongs in the same ADR rather than its own: it is not an independent
policy, it is the _consequence_ of choosing a record keyed by column id. Separating them loses
the causal link, which is the only thing that explains why the library suddenly validates
something it ignored for its whole life.

## What To Do

Write `libs/table/docs/adr/0022-render-row-cell-values.md`, following the shape of the
neighbouring ADRs (`0021-column-concerns-and-data-concerns-are-separate-surfaces.md` is the
closest model — Context / Decision / Alternatives considered / Consequences).

**Header**

```
# ADR-0022 — Resolved cell values live on the render row

**Status:** accepted
**Date:** 2026-09-19
**Related:** ADR-0011 (chained render stages — where `cells` is stamped),
ADR-0005 (central stamping precedent), ADR-0014 (the `accessor` wrap),
ADR-0021 (column ids vs. row fields — why `cells` is column-keyed on both row kinds)

**Source:** `../1-state/work/core/active/render-row-cell-values/decisions.md` (D1–D11)
```

**Context.** The problem as #80 states it: the only path from a render row to a rendered value is
`ColumnDef.accessor`, and calling it lives in the template — unmemoised, once per cell per change
detection pass. Both workarounds a consumer reaches for (a host method, or a parallel view model
in a `computed()`) re-derive something the engine already has. Name the two shipped examples:
`grouping-static/` had the host method; five other grouping hosts still call `accessor` in the
template.

**Decision.** State the surface first, then each sub-decision with its reason:

```ts
interface RenderRow<TRow> {
  readonly cells: Readonly<Record<string, unknown>>;
}
```

| Question (#80)                          | Decision                                                   | Source |
| --------------------------------------- | ---------------------------------------------------------- | ------ |
| Eager array, or lazy `cellsOf(row)`?    | **Eager**, built inside the existing `renderRows` computed | D1, D2 |
| Ordered array, or a record?             | **Record keyed by `columnId`**                             | D3     |
| Follows column visibility/order?        | **No** — the consumer's own `visibleColumns()` loop stays  | D3     |
| Formatted or raw?                       | **Raw** — formatting stays in pipes                        | D6     |
| Replaces `accessor`, or sits beside it? | **Beside** — `accessor` defines, `cells` reads             | D7     |
| Typed per column?                       | **No** — `unknown`, narrowed by the consumer's own pipes   | D8     |

Carry over the reasoning for each, in a sentence or two, not a transcript:

- **Eager (D1/D2).** `renderRows` already is the memo boundary, so per-cell signals would add
  N×M graph nodes and buy no extra memoization. A lazy `cellsOf` cannot live on `RenderRow`
  without allocating a closure per row — which breaks "`rows()` never returns wrapper objects" —
  so it would have to be a store method; uncached that is the same per-CD-pass cost as today,
  and cached it needs a `Map<RowId, Cell[]>` plus a second computed building the identical eager
  array.
- **Record, not ordered array (D3).** The engine owns _resolving the value_; the consumer keeps
  owning which columns render and in what order. An ordered array would promote every story
  host's local `visibleColumns` computed into core. Note the tradeoff that dissolves:
  `renderRows` gains a `columns()` dependency either way, so "hiding a column recomputes every
  row" is a cost of building values in `renderRows` at all, not a cost of declining to filter.
- **Group rows (D5, as amended).** A `kind: 'group'` row's `cells` carries its aggregates only —
  `cells = { ...aggregates }`. The group's own label is `groupKey.label`, never a `cells` entry.
  This is where ADR-0021 is load-bearing: `aggregates` is keyed by _declared column id_, while
  `groupKey.columnId` has named a _row field_ since grouping's D7. Merging them would write
  entries no template loops over, and would put a group value in an unrelated column whenever a
  field name happened to match a column id. `cells` stays wholly column-keyed on both row kinds.
- **Raw values (D6).** `{{ row.cells[column.id] | dealAmount }}` — one pure pipe per formatting
  concern, as `grouping-story.pipes.ts` already does.
- **`unknown`, no value generic (D8).** `row.cells[column.id]` indexes by a runtime `string`, so
  a per-column mapped type collapses to the union of every column's value type — narrowing only
  pays when indexing by a literal, which a loop over columns never does. Generifying `ColumnDef`
  would ripple through the columns config, `columnSchema()`, the `ColumnsPath` proxy,
  `setColumns` and the generated overloads for no gain.
- **Duplicate column ids throw (D10).** Keying `cells` by column id makes uniqueness
  load-bearing: two columns sharing an id collapse to last-wins and _both_ table cells render the
  same value. Validated in `resolveColumnDefs`, at construction, `ngDevMode`-guarded. Scope is
  the `id`, never the `accessor` — two columns reading one field under different headers stays
  legal. Record the prior art: Angular CDK throws in `_cacheColumnDefs()`; AG Grid auto-suffixes
  in `buildColumnTree`; TanStack v8 and MUI X ship no check and reproduce exactly the last-wins
  symptom.
- **The `accessor` wrap (D9).** Reading `accessor` to build a cell is a consumer callback under
  ADR-0014, whose table already names the fallback: the cell reads `undefined`, reported once per
  column per evaluation. This ADR does not restate that policy — it cites ADR-0014 and records
  that the new build pass is a wrap site.

**Alternatives considered.** Three, each one line of claim and one of rejection:

1. **Lazy `cellsOf(row)` as a store method** (TanStack's `row.getVisibleCells()` shape) — D2.
2. **An ordered `{ columnId, value }[]`, filtered by visibility** — D3; it moves column render
   order into the engine, which the engine does not own today.
3. **A forms-like cell object** (value + dirty/touched/valid/disabled) — D4. The structural
   reason it cannot merge is worth keeping verbatim in spirit: `accessor` is an arbitrary
   read-only derivation with no inverse, so a form field maps to a cell but never the reverse,
   and a computed column has no field at all. Record the extension path — a feature contributes
   its own optional `RenderRow` field, the way `isExpanded`/`hasChildren`/`aggregates` do, rather
   than thickening `cells`.

**Consequences.** At minimum:

- `renderRows` now depends on `columns()`; any column change (visibility, reorder, `setColumns`)
  recomputes every render row.
- `cells` is **required** on `RenderRow`, so the stage-internal row type becomes
  `Omit<RenderRow<TRow>, 'index' | 'cells'>` — named `StagedRow<TRow>` in Step 3. Third-party
  stage authors (ADR-0020) type against it.
- `accessor` is now documented as the value contract, in
  `docs/2-columns/reference/tier-1-intrinsic.md`.
- `aggregates` stays on `RenderRow` — `cells` reads through it for a group row, it is not
  removed. Templates stop indexing it directly.
- `ngDevMode` enters `src/` for the first time. **Noted inconsistency:** this is the only
  dev-guarded construction throw in the library; every other one is unconditional. Whether they
  should all be guarded is its own ADR, not this one.
- One legacy unguarded `accessor` site remains — `api/features/with-sorting.ts:117-118`. It is
  deliberately not fixed here: ADR-0014's `accessor` row ("the cell reads `undefined`") and its
  `sortFn` row ("that column's sort does not apply") give contradictory answers inside a sort
  comparator, and picking one quietly inside a cell-value change is how the wrong one ships.
  Record it as a follow-up.

## Implementation Notes

The ADR is a _record_, not a re-derivation. Everything above is already settled in
`decisions.md`; do not reopen a question while writing it. Where the two disagree,
`decisions.md` wins and the ADR is wrong.

Keep it at the length of ADR-0021 or shorter. Decision-history narration belongs in
`decisions.md`, which the ADR links to — per `terse-jsdoc-for-ai-and-humans`, the ADR states
what was decided and why, not the order in which it was argued.

`llms.txt` indexes `docs/adr/`, so a new ADR makes `npm run llms:check` fail until the file is
regenerated. Run `npm run llms` as part of this step.

## Risks / Watchouts

- **Do not restate ADR-0014's policy.** Cite it. A second copy of the runtime-error table is
  exactly the drift `claude-md-no-implementation-status` warns about.
- **Do not mark it `proposed`.** D1–D11 are settled and Steps 2–4 implement them in this same
  slice. `accepted` is the honest status.
- **`GroupingRule.valueOf` does not exist.** D11 uses that name; the shipped API is
  `extractValue` (`api/features/with-grouping/schema.ts:59`). If the ADR mentions it at all, use
  `extractValue`.

## Non-Goals

- No source changes. The type, the throw, the report and the story migration are Steps 2, 3, 4
  and 8.
- No ADR for the D11 grouping report. D11 explicitly extends ADR-0014's reasoning rather than
  setting new policy, and says a real diagnostics channel is its own ADR covering every report
  site at once.
- No update to `docs/status.md`. It is generated from feature-spec frontmatter; ADRs do not feed
  it.

## Acceptance Checks

- [ ] `libs/table/docs/adr/0022-render-row-cell-values.md` exists, `Status: accepted`.
- [ ] Each of #80's Q1–Q5 is answered explicitly and traceable to its D-number.
- [ ] D5's group-row shape (`cells = { ...aggregates }`, label via `groupKey.label`) is recorded,
      with the ADR-0021 link explaining why the two key spaces stay separate.
- [ ] D10's throw is recorded as a consequence of the record shape, with its `ngDevMode` guard
      and the noted inconsistency.
- [ ] The `with-sorting.ts` legacy site is recorded as an explicit, reasoned follow-up.
- [ ] ADR-0014 is cited, not restated.
- [ ] `npm run llms` run; `npm run llms:check` clean.

---

[Step 2: Duplicate column id throws](step-2-duplicate-column-id-throw.plan.md) →
