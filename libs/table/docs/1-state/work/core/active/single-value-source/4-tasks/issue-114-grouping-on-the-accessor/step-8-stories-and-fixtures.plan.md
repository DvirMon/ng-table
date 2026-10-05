# Step 8 — Stories and fixtures migrate

**PR scope:** standalone. **Depends on:** Step 3 (`TId` keying), Step 4
(`applyAggregate`) and Step 5 (the deleted label tier, which one story
teaches as a lesson).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/grouping/fixtures/schema.ts` (edit)
- `libs/table/src/stories/grouping/grouping-keys/grouping-keys-story-host.component.ts` (edit)
- `libs/table/src/stories/grouping/grouping-keys/grouping-keys-story-host.component.html` (edit)
- `libs/table/src/stories/grouping/grouping-keys/grouping-keys.stories.ts` (edit)
- `libs/table/src/stories/grouping/grouping-aggregates/grouping-aggregates-story-host.component.ts` (edit)
- `libs/table/src/stories/grouping/grouping-aggregates/grouping-aggregates.stories.ts` (edit)
- Remaining grouping hosts — recheck only, edit if typecheck says so

## Why This Step Exists

The fixtures encode the old model in their **annotations**, not just
their values. `fixtures/schema.ts` annotates its column list
`ColumnDefInput<DealRow>[]`, which widens `TId` to `string` and turns
every re-keyed `path` into an index signature with no error — so the
stories would compile while proving nothing. Its own comment says as
much, and states the now-false reason: _"Grouping no longer reads a
column's `accessor` at all (D7)."_

Two stories teach lessons this slice retires: `grouping-aggregates`
teaches that `aggregateFn` is a column option, and `grouping-keys`
teaches a three-tier label resolution whose third tier is gone.

One step, not six, because all six hosts change for the same three
reasons and they share one fixture file.

## What To Do

**1. `fixtures/schema.ts` — let the ids infer.**

- Drop the `ColumnDefInput<DealRow>[]` annotation from `dealColumns`.
  Use the `create-table.spec.ts:20-36` shape instead: `id: '…' as const`
  per entry, closed with `satisfies ColumnDefInput<DealRow>[]`. Without
  this the literal union never reaches `path`.
- Rewrite that comment. Grouping now reads the accessor; the `owner`
  column's accessor is what makes `owner` groupable by name, and that is
  worth saying since it is the slice's whole point.
- **`dealColumnsWithTotals` disappears.** `sumAmount` no longer belongs
  on a column. Export `sumAmount` instead, for `grouping-aggregates`'
  host to declare. `groupingConfig` and `plainGroupingConfig` collapse
  into one config — keep both names only if a story still distinguishes
  them; otherwise delete `groupingConfig` and rename.
- **`MISSING_GROUPING_LEVEL` is deleted.** `'territory'` names no column,
  so both declaring it and writing it now throw.
- The four level constants (`BASE_`, `COLLAPSIBLE_`, `RENESTED_`,
  `SELECTION_GROUPING_LEVELS`) lose their `ColumnId<DealRow>[]`
  annotation — that type is gone. Annotate `as const` / `satisfies` so
  they stay literal rather than widening to `string[]`, which would
  defeat the union at the `initial` slot.

**2. `grouping-aggregates` — the lesson inverts.**

The host composes `withGrouping({ initial: BASE_GROUPING_LEVELS })` and
inherits totals from the column list. It now declares them:

```ts
withGrouping({
  initial: BASE_GROUPING_LEVELS,
  schema: (path) => applyAggregate(path.amount, sumAmount),
});
```

Rewrite the host's doc block and the `.stories.ts` description. The
current text — _"`aggregateFn` is a **column** option, not a
`withGrouping()` one: the column says how to summarise a set of rows,
and grouping is what supplies the sets"_ — is now exactly backwards.
The replacement lesson: aggregation is a grouping declaration, keyed by
declared column id like every other data concern, so a column with no
row field of its own can carry a total too.

The ADR-0014 half of the story is unchanged — the toolbar still poisons
one row, `sumAmount` still throws, one column's aggregate still blanks
for the affected groups and reports once per evaluation. Keep it.

**3. `grouping-keys` — drop the third tier, keep the other two.**

- `initial: [{ key: 'region', label: 'Sales Region' }, 'closedAt']`
  becomes `{ columnId: 'region', label: 'Sales Region' }`.
- **Delete `toggleTerritoryLevel`, `groupedByTerritory`**, their template
  control, and the `addGroupLevel`/`removeGroupLevel` imports if nothing
  else uses them. The lesson they taught no longer exists.
- The remaining lesson is still two-declarator and still worth a story:
  `applyGroupKey` decides what a level clusters _on_; an `initial`
  entry's `label` decides what its header _calls itself_. `Sales Region`
  wins over the `region` column's own label; `Closed` has none and falls
  back to the `closedAt` column's. Two tiers, one render.
- `monthOf(date: Date)` now receives `unknown` from the extractor
  (Step 3, G68). Narrow with the existing `isDateValue` guard rather than
  a cast — the host already has one.
- Rewrite the host doc block and `.stories.ts` description to two tiers.

**4. Recheck the other four hosts.**

`grouping-basic`, `grouping-collapsible`, `grouping-columns`,
`grouping-selection`, `grouping-order`, `grouping-when`,
`grouping-async-rule` should need nothing beyond what the fixture change
gives them — their `path.region` / `path.category` / `path.rep` accesses
are all declared column ids already. Let `typecheck` decide; do not
pre-emptively edit them.

## Implementation Notes

- **Run `nx run shared-table:typecheck` twice.** `ngc` stops at the first
  `.ts` error and never reaches the template phase, so only a
  source-clean second run says anything about the story templates
  (`.claude/rules/typecheck-angular-templates.md`). A binding to a
  member deleted in this step — `groupedByTerritory` — is exactly the
  class of error the second run exists to catch, and #60 is the bug that
  proves it ships otherwise.
- **`grouping-story.pipes.ts` and the shared CSS are untouched.**
- **One lesson per story stays the rule** (G47). Do not fold the
  aggregates lesson into `grouping-keys` because both now use a schema.

## Risks / Watchouts

- **The widening trap is the real risk here.** If `dealColumns` keeps any
  array-level annotation, every story compiles and every `path.*` access
  becomes an index signature — a green run that proves nothing. Verify by
  introducing `path.regionn` locally once and confirming it errors.
- **Template bindings are invisible to `tsc`.** The deleted
  `groupedByTerritory` is referenced from
  `grouping-keys-story-host.component.html`. Delete both halves in the
  same commit.
- **`.mdx` is out of scope here.** `grouping.mdx`'s code tabs and prose
  (lines ~166-177, ~215) describe both changed lessons and are Step 9's,
  so the story text and the `.mdx` text will disagree between these two
  steps. That is expected and is why Step 9 depends on this one.
- **`DEAL_COLUMN_IDS`** derives from `dealColumns` — confirm it still
  yields `string[]` for `grouping-columns`' order logic after the
  `satisfies` change.

## Non-Goals

- **No new stories.** The story set is unchanged in count; two change
  their lesson text, one loses a control.
- **No carrier-column story.** G54 is proven by specs in Step 6; whether
  it deserves a story is a `story-plan` question, not this slice's.
- **No `visible`-enforcement change.** The hosts keep filtering
  `column.visible` themselves.
- **No filtering-story changes.** `dealFilters` in the fixture file is
  #115's.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean, **run twice** — the second
      run is what checks the story templates.
- [ ] `nx test shared-table` fully green, including the grouping story
      specs.
- [ ] `path.regionn` inside any grouping story's `schema` is a compile
      error — verified once, manually, then reverted.
- [ ] `ColumnId`, `MISSING_GROUPING_LEVEL` and `dealColumnsWithTotals`
      appear nowhere under `src/stories/`.
- [ ] `grouping-aggregates` still blanks one column's total and reports
      once when the toolbar poisons a row.

---

← [Step 7: The public-surface spec](step-7-public-surface-spec.plan.md) | [Step 9: Docs, decisions and `llms.txt`](step-9-docs-and-decisions.plan.md) →
