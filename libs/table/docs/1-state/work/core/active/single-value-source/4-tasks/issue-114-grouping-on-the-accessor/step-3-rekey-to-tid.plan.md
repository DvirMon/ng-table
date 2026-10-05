# Step 3 — Re-key the grouping surface to `TId`

**PR scope:** standalone, and **breaking**. **Parallel-safe with:**
Step 1 (types and declarator signatures here; `feature.ts` body there).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-grouping/types.ts` (edit)
- `libs/table/src/api/features/with-grouping/schema.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit)
- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/mutations/update-grouping.ts` (edit)
- `libs/table/src/index.ts` (edit)

## Why This Step Exists

Three things are named across this feature and two of them share the word
`key`: the declared column id, the row field name, and the grouped value.
`initial`'s object form says `{ key: 'region' }` meaning _which column_;
one interface over, `ClusterSummary` says `key: 'north'` meaning _what
value_ and calls the column `columnId`. `ClusterSummary.key` is the one
that stays — it matches SQL's `GROUP BY` key and LINQ's `IGrouping.Key`.

**Why the rename cannot ship alone (G60).** While the field stays typed
`ColumnId<TRow> = Extract<keyof TRow, string> | (string & {})`, renaming
it to `columnId` moves the lie rather than fixing it: the name would
promise declared-column-id space while the type keeps autocompleting row
fields and accepting any string. It is honest only once the keying moves,
which is this step. `ColumnId<TRow>` is retired in the same change — it is
the type that lets both readings coexist.

#113 supplies what makes this possible: `ColumnIdOf<In>` recovers the
declared literal union off an accumulating store shape, and
`create-table.overloads.ts` carries `TId` into every feature slot.
`with-sorting.ts:22` is the worked precedent for the input-slice shape.

## What To Do

**1. `types.ts` — key the path by `TId`.**

Mirror `columns-schema/types.ts`'s `ColumnsPath`:

```ts
export type GroupingPath<TRow, TId extends string = string> = {
  readonly [K in TId]: GroupingHandle<TRow, K>;
};

export type GroupingSchemaFn<TRow, TId extends string = string> = (
  path: GroupingPath<TRow, TId>,
) => void;
```

Rewrite `GroupingPath`'s doc comment: it no longer says "keyed by row
field, not a declared column id" — that sentence, and CS D7's reasoning
behind it, are what ADR-0024 reverses.

**2. `types.ts` — `GroupingLevel.key` becomes `columnId`.**

```ts
export interface GroupingLevel<TId extends string = string> {
  readonly columnId: TId;
  readonly label?: string;
}
```

Note the type parameter changes meaning: `GroupingLevel<TRow>` becomes
`GroupingLevel<TId>`. It never read `TRow` for anything but `ColumnId<TRow>`.

**3. `schema.ts` — the four declarators stop indexing `TRow`.**

Each is generic `<TRow, K extends Extract<keyof TRow, string>>` today.
Widen to `<TRow, K extends string>` — the constraint that matters now
lives on `GroupingPath`'s key set, and `K` is inferred from the handle.
`applyGroupOrder` already has this shape; match it.

`applyGroupKey`'s extractor is the one real signature change (G68):

```ts
export function applyGroupKey<TRow, K extends string>(
  path: GroupingHandle<TRow, K>,
  extractValue: (value: unknown) => unknown,
): void;
```

It was `(fieldValue: TRow[K]) => unknown`. `TRow[K]` no longer resolves
once `K` is a declared column id, and the value the extractor receives is
the accessor's output, which the type system cannot recover from
`ColumnDef.accessor: (row: TRow) => unknown`. `unknown` is the honest
type; the `as` cast inside the body goes away with it.

Update the JSDoc to say **what value arrives**, because it is not
obvious: a column whose accessor already computes the group-relevant
value needs no `applyGroupKey` at all, while `closedAt: Date` still needs
one to key a month out of what the accessor returns.

**4. `feature.ts` — thread `TId` through the config and the feature.**

```ts
type GroupingInput<In> = Pick<TableStore<RowOf<In>, ColumnIdOf<In>>, 'columns' | 'rows'>;

export interface WithGroupingConfig<TRow, TId extends string = string> {
  initial?: (TId | GroupingLevel<TId>)[];
  when?: GroupWhen<TRow>;
  schema?: GroupingSchemaFn<TRow, TId>;
}
```

Both `withGrouping()` overloads take
`WithGroupingConfig<RowOf<In>, ColumnIdOf<In>>`. `normalizeGroupingLevels`
reads `level.columnId` instead of `level.key`; its local variable names
(`keys`, `labelByKey`) should follow — `columnIds`, `labelByColumnId` —
since the whole point is that this vocabulary is now one thing.

`buildGroupingSpec`'s internal `string[]` state is unchanged.
`GroupingUpdater<TRow> = (grouping: string[]) => string[]` stays as is.

**5. Retire `ColumnId<TRow>`.**

- Delete the type from `api/types.ts`.
- Delete `export type { ColumnId }` from `index.ts:48`.
- `mutations/update-grouping.ts` — `setGroupLevels`, `addGroupLevel` and
  `removeGroupLevel` take `string` instead of `ColumnId<TRow>`. They have
  no `TId` in scope (a `GroupingUpdater` is built before it reaches a
  table), so the autocomplete is genuinely gone here, not relocated.
  Keep the `<TRow>` parameter — `GroupingUpdater<TRow>` still needs it.
- `index.ts` — export `GroupingLevel` unchanged in name; it is the only
  grouping type whose shape changed.

## Implementation Notes

- **`GroupingHandle` is unchanged.** Its `K extends string = string`
  already fits; only what populates `K` changes.
- **The string shorthand must keep compiling.** `initial: ['region',
'status']` is a `TId[]`, so it works once the union is literal — this
  is AC #7 and Step 7 pins it with a type-level case.
- **Do not export `ColumnIdOf`.** The workspace decisions log settles it:
  neither `RowOf` nor `ColumnIdOf` is in the public barrel, and a call
  site recovers the union structurally.
- **Widening watch.** If a consumer annotates their `columns` array
  `ColumnDefInput<Row>[]`, `TId` degrades to `string` silently and every
  path becomes an index signature. `create-table.types.spec.ts` (#113
  Step 3) already pins that failure mode; Step 7 adds the grouping case
  on top of it rather than re-deriving the guard.
- **`api/types.ts` keeps `ClusterSummary`/`GroupSummary` exactly as they
  are** — `{ columnId, key, rows }`. AC #9: the summary gains nothing,
  and the value resolver is #117's, on a context argument (G67).

## Risks / Watchouts

- **`normalizeGroupingLevels`'s `typeof level === 'string'` branch.**
  With `TId` a literal union, that narrowing still works, but confirm the
  `else` branch narrows to `GroupingLevel<TId>` and not to `never` under
  a single-member union.
- **Every grouping story breaks here**, because `fixtures/schema.ts`
  annotates its column list `ColumnDefInput<DealRow>[]` and its level
  constants `ColumnId<DealRow>[]`. That is Step 8's work — do not fix the
  fixtures in this PR, and expect `typecheck` to be red on
  `src/stories/**` until Step 8 lands.
- **`GroupingLevel<TRow>` → `GroupingLevel<TId>` is a silent breakage for
  a consumer who named it.** Both parameters are a single type argument in
  the same position, so `GroupingLevel<DealRow>` keeps compiling and means
  something new. Call it out in Step 9's docs; there is no compiler-level
  mitigation.

## Non-Goals

- **No filtering, no sorting.** Their re-keying is #115 and #100.
- **No `applyAggregate`.** Step 4, which depends on this step's path.
- **No behaviour change.** Nothing here alters which rows land in which
  cluster; that was Step 2.
- **No generator change.** `tools/generate-overloads.ts` already carries
  `TId` after #113 Step 2 — this step consumes it.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean on `src/api/**`,
      `src/engine/**` and `src/mutations/**` (`src/stories/**` is
      expected red until Step 8).
- [ ] `nx run shared-table:typecheck-spec` — existing specs compile or
      are left for Step 7; no assertion is softened to make them pass.
- [ ] `ColumnId` appears nowhere in `libs/table/src` (`grep -rn
'ColumnId\b' libs/table/src` returns only `ColumnIdOf`).
- [ ] `path.<declaredId>` autocompletes the declared ids inside a
      `withGrouping({ schema })` slot, and a typo is a compile error.

---

← [Step 2: Both cluster walks read the accessor](step-2-walks-read-accessor.plan.md) | [Step 4: `applyAggregate` keys by column id](step-4-apply-aggregate.plan.md) →
