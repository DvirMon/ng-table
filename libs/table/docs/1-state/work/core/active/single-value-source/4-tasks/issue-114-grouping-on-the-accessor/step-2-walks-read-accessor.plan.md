# Step 2 — Both cluster walks read the accessor

**PR scope:** standalone. **Depends on:** Step 1 (every level must be
guaranteed to name a declared column before the read switches to
`readAccessor`, or a columnless level degrades from "raw field value" to
`undefined` with no signal).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/grouping/clusters.ts` (edit)
- `libs/table/src/engine/grouping/pipeline.ts` (edit)
- `libs/table/src/engine/grouping/queries.ts` (edit)
- `libs/table/src/engine/grouping/render.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit)

## Why This Step Exists

This is the slice's reason to exist. Grouping reads `row[key]` today
(`clusters.ts`'s `readGroupFieldValue`), so it disagrees with the cell
above it whenever a column has a derived accessor — and a carrier column
(`{ id, accessor, visible: false }`, G54) is not groupable at all,
because no row field backs it.

**Two walks build the tree, and only one has the columns.**
`buildGroupRenderRows(rows, grouping, columns, opts)` takes them;
`clusterRows(rows, grouping, opts)` and `queries.ts`'s three readers do
not. Both walks must resolve identically or the pipeline `TRow[]` and the
render tree disagree about which rows belong to which cluster — the exact
bug class ADR-0024 exists to close. Threading `columns` into the pipeline
walk is therefore not optional, and the spec proving the two agree is
Step 6's gate.

## What To Do

**1. Replace `readGroupFieldValue` with an accessor read, in
`clusters.ts`.**

The current body brackets into the row and runs the extractor:

```ts
export function readGroupFieldValue<TRow>(
  row: TRow, key: string,
  extractValueByColumn?: ReadonlyMap<string, (v: unknown) => unknown>
): unknown {
  const raw = (row as Record<string, unknown>)[key];
  const extractValue = extractValueByColumn?.get(key);
  return extractValue ? extractValue(raw) : raw;
}
```

Rename it `readGroupValue` and source the raw value from the column:

```ts
export function readGroupValue<TRow>(
  row: TRow,
  columnId: string,
  columnById: ReadonlyMap<string, ColumnDef<TRow>>,
  reportedColumns: Set<string>,
  extractValueByColumn?: ReadonlyMap<string, (v: unknown) => unknown>
): unknown {
  const column = columnById.get(columnId);
  const raw = column ? readAccessor(column, row, reportedColumns) : undefined;
  const extractValue = extractValueByColumn?.get(columnId);
  return extractValue ? extractValue(raw) : raw;
}
```

The extractor still runs last — that ordering is what makes G68 true:
`applyGroupKey`'s extractor receives **the accessor's output**, not the
raw field. Step 6 pins it.

Take a `ReadonlyMap`, not a `ColumnDef[]`: this runs once per row per
level, and `columns.find(...)` in that position is a linear scan inside
the hot loop.

**2. Thread `columns` through `buildClusterNodes`.**

Give it a third positional parameter, `columns: ColumnDef<TRow>[]`,
matching `buildGroupRenderRows`'s existing shape. Build the id map and
the `reportedColumns` set once per call, then close over them in the
accessor lambda it hands `buildClusters`.

**3. Thread `columns` into every caller.**

- `pipeline.ts` — `clusterRows(rows, grouping, columns, opts)`.
- `queries.ts` — `rowsBeneathGroup`, `collectGroupIds` and
  `collectAppliedLevels` each gain `columns` in the same third position.
  Note `rowsBeneathGroup`'s `opts` is currently
  `Pick<ClusterOpts<TRow>, 'extractValueByColumn'>`; leave that narrowing
  as it is.
- `render.ts` — `buildGroupRenderRows` already has `columns`. Replace its
  inline `readGroupFieldValue(item.data, key, opts?.extractValueByColumn)`
  call with `readGroupValue`, using a map and a `reportedColumns` set it
  builds once, so the render walk and the pipeline walk run the same
  body. Keep the `isRowData` throw guarding the `'group'`-stage-runs-first
  invariant.
- `feature.ts` — pass `input.columns()` at all four call sites
  (`stages.group`, `renderStages.group`, `rowsOf`, `groupIds`) and inside
  the `appliedGrouping` computed. Each reads the signal at evaluation
  time, which is what keeps the walks reactive to `setColumns()`.

## Implementation Notes

- **One `reportedColumns` set per walk, not per row.** ADR-0014's dedupe
  contract: a column whose accessor always throws reports once per
  evaluation. `buildDataCells` and `with-sorting.ts:149` already thread
  one the same way — match them.
- **`buildClusters` itself does not change.** It already takes
  `accessor: (item, columnId) => unknown` precisely so it never needs to
  know whether `T` is a `TRow` or a render-row wrapper. Everything here
  happens in what the callers pass it.
- **Keep `reportedFields` (the non-primitive-collapse reporter) separate**
  from the new accessor `reportedColumns` set. They report different
  failures and dedupe independently.
- **`ClusterOpts` gains nothing in this step.** `columns` is positional
  because `ClusterOpts` is built once per `buildGroupingSpec` call and is
  not reactive, while `input.columns()` must be read per evaluation.
  Putting columns in the opts object would force rebuilding it inside
  every computed.
- `clusters.ts` must now import `ColumnDef` from `../../api/types` and
  `readAccessor` from `../cells`.

## Risks / Watchouts

- **The two walks must stay one body.** The whole point is that
  `render.ts` and `pipeline.ts` resolve the same value. If the render
  path keeps any bespoke resolution, Step 6's gate spec is testing a
  coincidence. After the edit, `readGroupValue` should have exactly two
  reachable call paths and no third spelling.
- **`readAccessor` swallows a throw and returns `undefined`.** That is
  correct (ADR-0014), but it means a throwing accessor now produces an
  `undefined`-keyed cluster rather than a raw field value. Expected,
  reported once, and worth a line in Step 9's docs.
- **The default accessor is `(row) => row[id]`** (resolved at store
  construction, `ColumnDefInput`'s contract). So for a plain column this
  step is behaviour-preserving — the change is visible only on columns
  with a real accessor. Do not "improve" the default while here.
- **`collectAppliedLevels` early-stops per level.** Passing columns must
  not change its loop; only the value each cluster keys on changes.

## Non-Goals

- **No re-keying.** `grouping` levels are still row-field strings at this
  point; Step 3 makes them declared column ids. This step works for both
  because it looks the id up in the column map either way.
- **No label change.** `resolveGroupLabel` keeps all three tiers here;
  Step 5 deletes the last one.
- **No aggregate change.** `computeAggregates` still reads
  `column.aggregateFn`; Step 4 moves it.
- **No filtering.** `withFiltering`'s accessor read is #115.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] Grouping by a column whose `accessor` derives a value groups by that
      value, not `undefined` — verified by Step 6's spec, not by hand.
- [ ] A carrier column (`visible: false`, accessor-only, no matching row
      field) is groupable.
- [ ] `readGroupValue` is the only value-resolution body in
      `engine/grouping/`; `readGroupFieldValue` no longer exists.
- [ ] Composing `withGrouping()` over plain columns produces byte-identical
      trees to before — the default accessor makes this step a no-op there.

---
← [Step 1: Grouping ids validate at construction and on the writer](step-1-grouping-id-check.plan.md) | [Step 3: Re-key the grouping surface to `TId`](step-3-rekey-to-tid.plan.md) →
