---
title: "Step 3 — wire config.groupWhen through withGrouping()"
type: task-step
issue: 119
---

# Step 3 — wire `config.groupWhen` through `withGrouping()`

**PR scope:** The public config member and the three call sites that have to agree on it. This is
the PR where the feature becomes observable.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming

**Depends on:** Step 2 — and, through Step 1, on #84 Step 1's reshaped `WithGroupingConfig`.

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)
- `libs/shared/table/src/engine/grouping.ts` (edit — signatures only)
- `libs/shared/table/src/index.ts` (edit — export `ClusterSummary` / `GroupWhen` if the barrel
  enumerates types rather than re-exporting the module)

## Why This Step Exists

Steps 1 and 2 built a mechanism nothing invokes. This step gives it its one public spelling:

```ts
withGrouping({
  initial: ['region'],
  groupWhen: (c) => c.key != null,        // no region ⇒ stays flat
});
```

One predicate rather than `minGroupSize` / `groupNulls` / `groupEmptyString` / `skipUnknownValues`
— four spellings of one question, plus the ones nobody has thought of yet
(`design-group-admission.md` § Why one predicate rather than named flags,
`general-mechanism-over-enumerated-cases`).

Three engine entry points walk the cluster tree — `clusterRows` (pipeline stage),
`buildGroupRenderRows` (render stage), `collectGroupIds` (`table.groupIds()`). All three take the
predicate, or the pipeline order, the render order, and the expand-all id set disagree about which
clusters exist.

## What To Do

### 1. The config member

```ts
export interface WithGroupingConfig<TRow> {
  initial?: ColumnId<TRow>[];
  /** Table-wide admission — judged at every active level. A cluster returning `false` renders its
   * rows flat at the parent's depth: no header, no group id, no aggregates. Throws: the cluster is
   * admitted, reported once per column per evaluation. */
  groupWhen?: GroupWhen<TRow>;
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  groupingRule?: () => string[] | undefined;
  schema?: GroupingSchemaFn<TRow>;
  rules?: AnyGroupingRule<TRow>[];
}
```

### 2. Thread it through the three engine entry points

Each already takes an optional `groupOrder`; `groupWhen` joins it. Inside each, the order is
**admit → order → emit**:

```ts
export function clusterRows<TRow>(
  rows: TRow[],
  grouping: readonly string[],
  columns: ColumnDef<TRow>[],
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number,
  groupWhen?: GroupWhen<TRow>,
): TRow[] {
  const levels = resolveGroupingLevels(grouping, columns);
  if (levels.length === 0) return rows;
  const nodes = buildClusterNodes(rows, levels, columns);
  const admitted = admitClusters(nodes, groupWhen, (items) => items, new Set());
  const ordered = sortClusters(admitted, groupOrder, (items) => items, { done: false });
  return flattenLeaves(ordered);
}
```

`buildGroupRenderRows` does the same with its render-row `toRows` bridge
(`(items) => items.map((item) => item.data).filter(isRowData)`), and `collectGroupIds` with the
identity bridge. **A fresh `Set` per call** — that is what "once per column per evaluation" means.

Five positional parameters is one too many to read. Prefer collapsing the two callbacks into a
single trailing options object on all three functions:

```ts
interface ClusterOpts<TRow> {
  readonly groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  readonly groupWhen?: GroupWhen<TRow>;
}
```

This is internal engine surface, not public API, so the churn is contained to the four call sites
in `with-grouping.ts` plus `engine/grouping.spec.ts`. Take it now rather than after #86 and #87
add more.

### 3. Pass the config through in `buildGroupingSpec`

```ts
const clusterOpts = { groupOrder: config.groupOrder, groupWhen: config.groupWhen };

const groupIds = computed(() =>
  collectGroupIds(input.rows(), grouping(), input.columns(), clusterOpts),
);

return {
  members: { grouping: groupingView, rowsOf, groupIds },
  stages: {
    group: (rows) => clusterRows(rows, grouping(), input.columns(), clusterOpts),
  },
  renderStages: {
    group: (rows) => buildGroupRenderRows(rows, grouping(), input.columns(), clusterOpts),
  },
};
```

### 4. Export the new types

`ClusterSummary` and `GroupWhen` are consumer-facing — a consumer writing a predicate in a separate
`.utils.ts` needs to name the argument type. Check how `index.ts` handles `GroupSummary` and follow
it exactly.

## Implementation Notes

- **The predicate is evaluated inside a reactive context, and that is a feature.** Both stages run
  inside computeds, so a predicate reading a signal (`(c) => !skipBlanks() || c.key != null`)
  re-evaluates when that signal changes. Step 5's story depends on this. Do not memoize the
  predicate's results or hoist the call outside the computed.
- **`rowsOf` deliberately does not take the predicate.** `rowsBeneathGroup` resolves a group id;
  a dissolved cluster has no id to resolve, so the answer falls out as `[]` with no code — while a
  *parent* group's `rowsOf` still includes rows that render flat beneath it, because dissolution
  changes depth, not membership. That is Q3, recommended as correct; Step 4 tests it either way.
- **`groupWhen` is table-wide here, and there is no per-column counterpart yet.** #86 adds a
  `Map<columnId, GroupWhen>` collected off the rules array and AND-combines it with this one. Leave
  a seam, not an implementation — do not build the map now.
- **`groupWhen` does not flow through `foldGroupingRules`.** That function resolves level *order*
  and abstains for the whole set when any `when` is pending (D13); a row-data predicate has nothing
  to say about either. Keep the two apart (`design-group-admission.md` § `groupWhen` does not flow
  through `foldGroupingRules`).

## Risks / Watchouts

- **Do not share one `reportedColumns` Set across the three entry points.** They are three separate
  evaluations of three separate computeds; sharing one would silence the render stage's report
  because the pipeline stage already fired.
- **A `groupWhen` on a level that is not active is a silent no-op by construction** — the predicate
  is only called for clusters that exist. Do not add a validation warning for it.
- **Do not add an `ungroupedPlacement` key, in any spelling.** Placement is the comparator's, and
  the default stable partition already yields the tail a person pictures.

## Non-Goals

- No per-column `groupWhen` on `applyGrouping` — #86.
- No `applyGroupOrder` — #87.
- No story, no tests, no docs — Steps 4, 5, 6.

## Acceptance Checks

- [ ] `config.groupWhen` returning `false` leaves that cluster's rows flat at the parent's depth —
      no header, no group id, no aggregates.
- [ ] The `group` pipeline stage and the `'group'` render stage agree on which clusters are
      admitted.
- [ ] `table.groupIds()` omits dissolved clusters.
- [ ] Dissolution happens after ordering — a comparator placing a dissolved cluster first puts its
      flat rows first.
- [ ] With no comparator, admitted siblings come first in first-occurrence order, then dissolved
      ones.
- [ ] A throwing `groupWhen` admits the cluster and reports once per column per evaluation.
- [ ] A predicate reading a signal re-evaluates when that signal changes.
- [ ] Omitting `groupWhen` leaves `renderRows()` byte-identical to before this slice.
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.
- [ ] `shared-table` suite green in CI on the PR. Not run locally.

---
← [Step 2: Emission honours admission](step-2-emission-honors-admission.plan.md) | [Step 4: Tests](step-4-tests.plan.md) →
