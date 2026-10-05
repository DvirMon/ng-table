# Step 3 — `RenderRow.cells` and the `accessor` wrap

**PR scope:** The cell-value surface itself — the public field, the pure builder, the ADR-0014
wrap around `accessor`, and the central stamp in `renderRows`. The behavioral centre of #80.
**Parallel-safe with:** Step 1, Step 2, Step 4.
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                            | Action                                                       |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `libs/table/src/api/types.ts`                   | edit — `cells` on `RenderRow`                                |
| `libs/table/src/engine/cells.ts`                | create — `readAccessor`, `buildDataCells`, `buildGroupCells` |
| `libs/table/src/engine/render-stages.ts`        | edit — `StagedRow<TRow>` alias, signatures                   |
| `libs/table/src/engine/core.ts`                 | edit — `renderRows` reads `columns()`, stamps `cells`        |
| `libs/table/src/engine/rows.ts`                 | edit — `StagedRow` in `buildDefaultRenderRows`'s return type |
| `libs/table/src/engine/grouping/render.ts`      | edit — `StagedRow`                                           |
| `libs/table/src/api/features/with-expansion.ts` | edit — `StagedRow`                                           |
| `libs/table/src/table.mock.ts`                  | edit — `cells: {}` on both render-row factories              |

## Why This Step Exists

A consumer template has no way to read a cell's value without calling `ColumnDef.accessor` on
every change-detection pass. Both workarounds — a host method, or a parallel view model in a
`computed()` — re-derive what the engine already built. This step gives the engine's own answer
one place to live.

It also lands the ADR-0014 wrap for `accessor` (D9). The wrap and the build pass are the same
site, so splitting them would mean writing an unguarded call and guarding it one PR later.

## What To Do

### `api/types.ts` — the public field

Add to `RenderRow<TRow>`, beside `aggregates`:

```ts
// The resolved value per column, keyed by declared column id — `accessor` output for a
// `kind: 'row'`, the group's own aggregates for a `kind: 'group'`. Stamped centrally in
// `engine/core.ts` after the whole RENDER_ORDER chain runs, alongside `index`/`sourceIndex`
// (ADR-0011). Does not follow column visibility or order: the consumer's own visible-column
// loop still decides what renders (ADR-0022). Values are raw — format with a pipe.
readonly cells: Readonly<Record<string, unknown>>;
```

**Required, not optional.** It is present on every render row of every table, unlike
`isExpanded`/`hasChildren`/`aggregates`, which are feature-contributed and would be a lie when
their feature is absent.

### `engine/render-stages.ts` — the `StagedRow` alias

A required `cells` means a render stage's in-flight row shape is no longer
`Omit<RenderRow<TRow>, 'index'>`. Name it once, next to the stage signature it belongs to:

```ts
/** A render row mid-chain: `index` and `cells` are both stamped centrally in `engine/core.ts`
 * after the whole chain runs, so a stage never sees or sets either. */
export type StagedRow<TRow> = Omit<RenderRow<TRow>, 'index' | 'cells'>;
```

Then replace every `Omit<RenderRow<TRow>, 'index'>` with `StagedRow<TRow>` — six files, listed in
the Files table. This is mechanical; no behavior changes.

### `engine/cells.ts` — the pure builder

New file. Pure, no signals, no Angular — same rule as the rest of `engine/`.

```ts
function reportAccessorError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[createTable] accessor threw for column "${columnId}". Falling back to an undefined cell ` +
      'value for the affected row(s) in this evaluation.',
  );
}

/** ADR-0014 wrap: a throwing `accessor` degrades that one cell to `undefined` and reports once
 * per column per evaluation — `reportedColumns` is shared across the whole `renderRows` pass, so
 * a column throwing on 4,000 rows produces one report, not 4,000. */
export function readAccessor<TRow>(
  column: ColumnDef<TRow>,
  row: TRow,
  reportedColumns: Set<string>,
): unknown {
  try {
    return column.accessor(row);
  } catch {
    if (!reportedColumns.has(column.id)) {
      reportedColumns.add(column.id);
      reportAccessorError(column.id);
    }
    return undefined;
  }
}

export function buildDataCells<TRow>(
  row: TRow,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
): Readonly<Record<string, unknown>> {
  const cells: Record<string, unknown> = {};
  for (const column of columns) {
    cells[column.id] = readAccessor(column, row, reportedColumns);
  }
  return cells;
}

/** D5: a `kind: 'group'` row's cells are its aggregates, nothing else. The group's own label is
 * `groupKey.label`, never a `cells` entry — `aggregates` and `groupKey.columnId` name different
 * vocabularies (ADR-0021), so merging them would put a group value in an unrelated column. */
export function buildGroupCells(
  aggregates: Record<string, unknown> | undefined,
): Readonly<Record<string, unknown>> {
  return { ...aggregates };
}
```

Mirror `computeAggregates` (`engine/grouping/render.ts:33`) deliberately — same dedup shape, same
`Set<string>` threading, same comment on the `console.error`. Two wrap sites reading the same way
is the point.

### `engine/core.ts` — the stamp

`renderRows` gains a `columns()` read and stamps `cells` in the same `.map()` that already
assigns `index`/`sourceIndex`:

```ts
const renderRows = computed(() => {
  const byId = indexById();
  const resolvedColumns = columns();
  const reportedColumns = new Set<string>();
  const shaped = runRenderStages(seedRenderRows(rows()), renderStages, expanded());
  return shaped.map((row, index) => {
    const isSynthesizedRow = row.data === null;
    return {
      ...row,
      index,
      sourceIndex: isSynthesizedRow ? undefined : byId.get(row.id),
      cells: isSynthesizedRow
        ? buildGroupCells(row.aggregates)
        : buildDataCells(row.data, resolvedColumns, reportedColumns),
    };
  });
});
```

One `reportedColumns` set per evaluation, created outside the `.map()` — that is what makes the
dedup "once per column per evaluation" rather than once per row.

`isSynthesizedRow` is the existing discriminator and already narrows `row.data` to `TRow` in the
else branch; reuse it rather than adding a second test on `row.kind`.

### `table.mock.ts`

`mockDataRenderRow` and `mockGroupRenderRow` each gain `cells: {}` before the `...overrides`
spread, so a caller can still override it.

## Implementation Notes

**`renderRows` now depends on `columns()`.** Any column change — visibility toggle, reorder,
`setColumns` — recomputes every render row. This is accepted and recorded in ADR-0022: it is a
cost of building values in `renderRows` at all, not a cost of the record shape. Do not try to
avoid it by moving the build into a separate computed keyed off `rows()` — that reintroduces the
parallel view model #80 exists to delete.

**Cells are built after the render-stage chain, not inside it.** ADR-0011/ADR-0005 set the
precedent with `index`/`sourceIndex`: a stage never stamps a centrally-owned field. A stage that
synthesizes a row therefore does not have to know `cells` exists — which is exactly why
`engine/grouping/render.ts` needs no logic change here, only the `StagedRow` rename.

**Why a group row reads `aggregates` rather than running `accessor` over `row.data`.** There is
no `TRow` behind a group header (`data: null`), so there is nothing to accessor. The aggregate
_is_ the column's value for that row.

**A column with no `aggregateFn` yields `undefined` in a group row's `cells`** — identical to
what `row.aggregates?.[column.id]` returns today. The story migration in Step 8 depends on that
equivalence.

Per `file-organization`, `engine/cells.ts` is its own file rather than a section of
`engine/rows.ts`: it owns the accessor wrap and its dedup contract, and it is independently
testable without a store.

## Risks / Watchouts

- **`cells` is required, so every `RenderRow` literal in `src/` must supply it.** The compiler
  finds them; `table.mock.ts` is the one outside `engine/`. Do not make the field optional to
  silence an error — an optional `cells` means every consumer writes `row.cells?.[id]` forever.
- **Do not filter by `visible`.** `cells` carries every resolved column (D3). The consumer's
  `visibleColumns()` loop is what hides a column, and it still is.
- **Do not put `groupKey.value` into `cells`.** D5 was amended specifically to remove it:
  `groupKey.columnId` is a _row field_ name, `cells` is keyed by _declared column id_, and
  merging the two vocabularies puts a group value in the wrong column whenever they coincide. A
  group header renders `row.groupKey.label`.
- **One `Set` per evaluation, not per row.** Creating it inside the `.map()` is a silent
  regression to once-per-row reporting — ADR-0014 names that as a failure mode, not a detail.
- **Wrap per callback, never per row.** `readAccessor`'s `try` is around one `accessor` call,
  which is the callback's own granularity here — a cell _is_ one invocation. Do not hoist the
  `try` to wrap the whole `buildDataCells` loop: that would degrade every column in a row because
  one column threw.
- **`with-sorting.ts:117-118` stays unwrapped.** It is the one remaining legacy `accessor` site
  and it is deliberately out of scope (D9) — ADR-0014's `accessor` and `sortFn` rows give
  contradictory fallbacks inside a comparator. Leave it, and leave the follow-up to ADR-0022's
  Consequences.
- No tests in this step — Step 5.

## Non-Goals

- No lazy `cellsOf(row)` store method (D2), no per-cell signal or computed (D1, and the forked
  per-cell-granularity thread in `decisions.md`).
- No removal of `aggregates` from `RenderRow`. `cells` reads through it; it stays.
- No value generic on `ColumnDef` and no discriminated cell union (D8).
- No template or story changes — Step 8.
- No change to `engine/grouping/**` beyond the `StagedRow` rename.

## Acceptance Checks

- [ ] `RenderRow<TRow>` carries `readonly cells: Readonly<Record<string, unknown>>`, required.
- [ ] `StagedRow<TRow> = Omit<RenderRow<TRow>, 'index' | 'cells'>` is declared once in
      `engine/render-stages.ts`; no file still spells the `Omit` inline.
- [ ] `engine/cells.ts` exports `readAccessor`, `buildDataCells`, `buildGroupCells`; imports
      nothing from `@angular/core`.
- [ ] `renderRows` creates exactly one `reportedColumns` set per evaluation, outside the `.map()`.
- [ ] A `kind: 'row'` render row's `cells[column.id]` equals `column.accessor(row.data)` for every
      column in `columns()`, visible or not.
- [ ] A `kind: 'group'` render row's `cells` deep-equals its `aggregates`, and carries no entry
      for `groupKey.columnId` unless a column of that id has an `aggregateFn`.
- [ ] A throwing `accessor` yields `undefined` for that cell, leaves every other cell intact, and
      logs once per column per evaluation.
- [ ] `index`/`sourceIndex` stamping is unmoved; no render stage sets `cells`.
- [ ] `table.mock.ts`'s two render-row factories default `cells` to `{}` and still honour
      `overrides`.
- [ ] Every existing engine, feature and directive test passes **unedited**.
- [ ] `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` clean — re-run each
      after fixing any `.ts` error.

---

← [Step 2: Duplicate column id throws](step-2-duplicate-column-id-throw.plan.md) | [Step 4: Non-primitive group value reports](step-4-non-primitive-group-value-report.plan.md) →
