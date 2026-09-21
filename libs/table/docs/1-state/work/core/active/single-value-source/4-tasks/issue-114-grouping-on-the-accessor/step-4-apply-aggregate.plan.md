# Step 4 — `applyAggregate` keys by column id

**PR scope:** standalone, and **breaking**. **Depends on:** Step 3 (the
declarator is keyed by `TId`, so it has nowhere to attach until
`GroupingPath` is re-keyed).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-grouping/types.ts` (edit)
- `libs/table/src/api/features/with-grouping/schema.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit)
- `libs/table/src/engine/grouping/rules.ts` (edit)
- `libs/table/src/engine/grouping/clusters.ts` (edit)
- `libs/table/src/engine/grouping/render.ts` (edit)
- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/index.ts` (edit)

## Why This Step Exists

**This is in the slice, not a follow-up, and that is the one hard
sequencing constraint the epic records.** #100's aggregate decision (G43)
put `applyAggregate` on a row-field-keyed path, on the premise that an
accessor-only value can never be aggregated. ADR-0024 makes that premise
false. G58/G59 supersede G43/G45.

If this lands separately, grouping ships two key vocabularies for a
release: levels keyed by declared column id (Step 3) and aggregates keyed
by row field. If #100's original aggregate migration lands first, it is
immediately reopened. They are one change.

G44 is the other half: `ColumnDef.aggregateFn` is **deleted outright**,
not deprecated and kept.

## What To Do

**1. `types.ts` — a fourth rule kind.**

```ts
/** One `applyAggregate(path.x, aggregateFn)` declaration — computes one
 * summary value per cluster per column, over that cluster's own leaves at
 * every depth. */
export interface GroupAggregateRule<TRow = unknown> {
  readonly kind: 'grouping-aggregate';
  readonly columnId: string;
  readonly aggregateFn: (rows: TRow[]) => unknown;
}
```

Add it to the `AnyGroupingRule<TRow>` union. That union membership is
what puts it under Step 1's construction check for free (G59) — the check
reads `rule.columnId` off every recorded rule regardless of kind.

**2. `schema.ts` — the declarator.**

```ts
export function applyAggregate<TRow, K extends string>(
  path: GroupingHandle<TRow, K>,
  aggregateFn: (rows: TRow[]) => unknown
): void
```

Positional, like `applyGroupOrder` and `applyGroupKey` — one concern, no
options bag.

**3. `rules.ts` — the collector.**

```ts
export function isGroupAggregateRule<TRow>(rule): rule is GroupAggregateRule<TRow>
export function collectAggregates<TRow>(
  rules: readonly AnyGroupingRule<TRow>[]
): Map<string, (rows: TRow[]) => unknown>
```

Exactly the shape of `collectGroupKeys` / `collectGroupOrder`, including
the last-write-wins note for a duplicate `columnId`.

**4. `clusters.ts` — `ClusterOpts` carries the map.**

```ts
/** Per-column aggregate fns (G58). A columnId with no active level is
 * inert, matching `groupOrderByColumn`. */
readonly aggregateByColumn?: ReadonlyMap<string, (rows: TRow[]) => unknown>;
```

**5. `render.ts` — `computeAggregates` reads the map.**

Its loop currently walks `columns` and skips any without an
`aggregateFn`. Walk the map's entries instead:

```ts
function computeAggregates<TRow>(
  rows: TRow[],
  aggregateByColumn: ReadonlyMap<string, (rows: TRow[]) => unknown> | undefined,
  reportedColumns: Set<string>
): Record<string, unknown>
```

Keep the ADR-0014 wrap byte-for-byte: a throwing `aggregateFn` yields
`undefined` for that column only, reported once per column per
`buildGroupRenderRows` call via the shared `reportedColumns` set — not
once per group. `reportAggregateError`'s message keeps its wording.

`buildGroupNodes` no longer needs `columns` for aggregates; it still
needs them for `resolveGroupLabel` until Step 5.

**6. Delete `ColumnDef.aggregateFn`.**

Remove the field from `api/types.ts:93`. Export `applyAggregate` and the
`GroupAggregateRule` type from `index.ts`, beside the other three
declarators.

## Implementation Notes

- **`aggregates` on `RenderRow` is unchanged.** It stays
  `Record<string, unknown>` keyed by column id, and `buildGroupCells`
  still spreads it. Only where the *function* is declared moves.
- **`clusterOpts` is built once in `buildGroupingSpec`** — add
  `aggregateByColumn: map.size > 0 ? map : undefined` alongside the
  existing four, matching their `size > 0` idiom exactly so an
  aggregate-free table still passes `undefined` and changes nothing.
- **The map is keyed by declared column id**, and Step 1's check already
  guarantees each key names a real column. `computeAggregates` therefore
  needs no `columnById` lookup and no unknown-id branch.
- **JSDoc stays terse** (`~/.claude/rules/terse-jsdoc-for-ai-and-humans.md`).
  Say what value arrives and what a throw does; do not restate G43→G58's
  history in the source. That belongs in Step 9's decisions log.

## Risks / Watchouts

- **Aggregate order changes.** `computeAggregates` used to emit keys in
  `columns` order; a `Map` emits them in declaration order. Nothing reads
  `aggregates` positionally (`buildGroupCells` spreads it, templates index
  by id), but confirm no spec asserts `Object.keys(aggregates)`.
- **`feature.spec.ts` declares `aggregateFn` on column fixtures in ~6
  places** and will not compile after the field is deleted. Step 7 owns
  the spec migration — do not half-fix it here.
- **`stories/grouping/fixtures/schema.ts:44`** derives
  `dealColumnsWithTotals` by mapping `sumAmount` onto the `amount`
  column. That whole derivation disappears in Step 8; leave it.
- **Do not add validation of your own.** G59 says `applyAggregate`
  validates "via the same check as every other declaration" — Step 1's.
  A second, aggregate-specific check is exactly the enumerated-case
  surface this epic is removing.

## Non-Goals

- **No `withAggregation()` feature.** G42: aggregation stays a
  grouping-owned concept.
- **No typed aggregates channel.** That is #47, and this step reorders
  it relative to #100 rather than absorbing it.
- **No aggregate on a non-grouped table.** A rule on a column with no
  active level stays inert, like `applyGroupOrder`.
- **No deprecation shim for `ColumnDef.aggregateFn`.** G44 is explicit.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean outside `src/stories/**`.
- [ ] `aggregateFn` appears nowhere on `ColumnDef` or `ColumnDefInput`.
- [ ] `applyAggregate(path.amount, sum)` on a derived-accessor column
      produces a header aggregate — the case G43's premise said was
      impossible. Pinned by Step 7.
- [ ] `applyAggregate` on an undeclared column id throws at construction,
      through Step 1's check, with the `[withGrouping]` label.
- [ ] A throwing `aggregateFn` still blanks one column for the affected
      groups and reports once per column per evaluation.

---
← [Step 3: Re-key the grouping surface to `TId`](step-3-rekey-to-tid.plan.md) | [Step 5: Delete the raw-name label tier and the levels filter](step-5-delete-fallbacks.plan.md) →
