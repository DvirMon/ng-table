import { computed, signal, type Signal } from '@angular/core';
import { clusterRows } from '../../../engine/grouping/pipeline';
import { buildGroupRenderRows, reportOrphanedGroupingColumn } from '../../../engine/grouping/render';
import { collectAppliedLevels, collectGroupIds, rowsBeneathGroup } from '../../../engine/grouping/queries';
import type { ClusterOpts } from '../../../engine/grouping/clusters';
import {
  buildAsyncGroupingRuleEntry,
  buildGroupingRuleEntries,
  collectAggregates,
  collectGroupKeys,
  collectGroupOrder,
  collectGroupPredicates,
  isGroupingAsyncRule,
  isGroupingRule,
  maskGroupingLevels,
  type GroupingRuleEntry,
} from '../../../engine/grouping/rules';
import type { TreeLinkSource } from '../../../engine/tree-links';
import type { ColumnValuesOf, Feature, RowOf, StageContext, TableFeatureSpec } from '../../../engine/types';
import { createWritableView, type WritableView } from '../../../engine/writable-view';
import { assertDeclarationsAreKnown, assertWrittenIdsAreKnown } from '../../../schema/validate';
import { runGroupingSchemaFn } from './schema';
import type { GroupingLevel, GroupingRule, GroupingSchemaFn } from './types';
import { createTableFeature } from '../../create-table-feature';
import { stageSchema } from '../../../schema/stage-schema';
import { stage } from '../../../schema/stage-rules';
import type {
  ColumnDef,
  ColumnIdIn,
  ColumnValueMap,
  DerivedDict,
  GroupingUpdater,
  GroupWhen,
  RenderRow,
  RowId,
  TableStore,
} from '../../types';

// The slice of the accumulating store this feature reads, row-typed via `RowOf<In>`. Recovers
// the value map via `ColumnValuesOf<In>` rather than `Record<ColumnIdOf<In>, unknown>` — the
// latter circularly self-references under `withGrouping`'s F-bounded `In`, because it derives
// from `In.columns` through an extra `keyof Record<...>` indirection. `ColumnValuesOf<In>` reads
// `In`'s own `__columnValues` phantom directly, with no circularity.
type GroupingInput<In> = Pick<TableStore<RowOf<In>, ColumnValuesOf<In>>, 'columns' | 'rows' | 'trackBy'>;

export interface WithGroupingConfig<TRow, TValues extends ColumnValueMap = ColumnValueMap> {
  /** Declared grouping levels, outermost first — array order is nesting order. A bare column id
   * or a `GroupingLevel` carrying its own `label`. Rules may gate a level off, never add one; an
   * unknown id throws at construction. */
  initial?: (ColumnIdIn<TValues> | GroupingLevel<ColumnIdIn<TValues>>)[];
  /** Table-wide admission — judged at every active level. A cluster returning `false` renders its
   * rows flat at the parent's depth: no header, no group id, no aggregates. A throwing `when`
   * still admits the cluster, reported once per column per evaluation. */
  when?: GroupWhen<TRow>;
  /** Declarative per-column rules, recorded by side effect (returns nothing). Call order carries
   * no meaning — nesting order comes from `initial`. `path` is keyed by declared column id, the
   * same space `columns` declares. */
  schema?: GroupingSchemaFn<TRow, TValues>;
}

export interface GroupingMembers<TRow> {
  /** Reads the *applied* levels — the declared prefix with at least one admitted cluster; a level
   * `when` rejects entirely is absent here even while it stays declared. Writes the *declared*
   * set via `.update()`, so a gated-off level survives a round-trip instead of being dropped. */
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
  /** Leaf rows beneath a group header, at any depth — post-filter by construction, since
   * `filter` precedes `group` in `PIPELINE_ORDER`. Resolved by `group.id`, so a header from an
   * earlier render pass still works; a group that no longer exists returns `[]`. Reads
   * `input.rows()` (pipeline output), independent of collapse/expand state. */
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];
  /** Every group header id that exists in the data, at every level, collapse-independent —
   * derives from the cluster tree, not `renderRows()`. `[]` when ungrouped. Feeds
   * `table.tree.expand(table.groupIds())`. */
  readonly groupIds: Signal<RowId[]>;
  /** Current *applied* grouping levels as `ColumnDef`s, outermost first — the inverse of
   * `isGroupedBy`. A level `when` rejects entirely is omitted here. If a level's column was
   * removed via `setColumns()` after being applied, it's also omitted and reported once per
   * evaluation. `[]` when ungrouped. */
  readonly groupingLevels: Signal<ColumnDef<TRow>[]>;
  /** O(1) membership check for one column against the *applied* levels, backed by a set derived
   * alongside `groupingLevels` — a toggle row over N columns stays O(N). `false` for an unknown
   * column id or a level `when` rejects entirely, never a throw. */
  readonly isGroupedBy: (columnId: string) => boolean;
}

function normalizeGroupingLevels<TId extends string>(
  levels: readonly (TId | GroupingLevel<TId>)[]
): { columnIds: string[]; labelByColumnId: Map<string, string> } {
  const columnIds: string[] = [];
  const labelByColumnId = new Map<string, string>();
  for (const level of levels) {
    if (typeof level === 'string') {
      columnIds.push(level);
    } else {
      columnIds.push(level.columnId);
      if (level.label) labelByColumnId.set(level.columnId, level.label);
    }
  }
  return { columnIds, labelByColumnId };
}

// Shared by both `withGrouping()` overloads via the generic `factory` below. Generic in
// `TValues` (matching `TableStore`'s value-map parameter directly, no `Record<>` wrapping —
// see `GroupingInput<In>`), with `TId` recovered as `ColumnIdIn<TValues>`.
function buildGroupingSpec<TRow, TValues extends ColumnValueMap>(
  input: Pick<TableStore<TRow, TValues>, 'columns' | 'rows' | 'trackBy'>,
  config: WithGroupingConfig<TRow, TValues>,
  ctx: StageContext<TRow>
): TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  const { columnIds: initial, labelByColumnId } = normalizeGroupingLevels<ColumnIdIn<TValues>>(
    config.initial ?? []
  );
  const rules = config.schema
    ? [...runGroupingSchemaFn<TRow, TValues>(config.schema)]
    : [];
  // Fixed at this factory's own construction time, reused below by both the declared-id
  // check and the `when`/`columnWhen` resolver guard `clusterOpts.knownIds` feeds — never
  // rebuilt from a later, live `input.columns()` read (that's `columnById`'s job, and it's
  // what lets a column removed via `setColumns()` degrade instead of throwing).
  const knownColumnIds = new Set(input.columns().map((column) => column.id));
  assertDeclarationsAreKnown(
    [...initial, ...rules.map((rule) => rule.columnId)],
    knownColumnIds,
    'withGrouping'
  );
  const emptyRule = rules.find(
    (rule): rule is GroupingRule<TRow> => isGroupingRule(rule) && !rule.enable && !rule.when
  );
  if (emptyRule) {
    throw new Error(
      `[withGrouping] grouping on field '${emptyRule.columnId}' declares neither enable nor when.`
    );
  }

  const baseGrouping = signal<string[]>(initial);

  // One pass in recorded order so sync/async entries interleave in true call order (a
  // `when`-only grouping rule and every group-order rule contribute no entry at all).
  const ruleEntries: GroupingRuleEntry[] = [];
  for (const rule of rules) {
    if (isGroupingRule(rule)) {
      if (rule.enable) ruleEntries.push(...buildGroupingRuleEntries([rule]));
    } else if (isGroupingAsyncRule(rule)) {
      ruleEntries.push(buildAsyncGroupingRuleEntry(rule));
    }
  }
  // Declared: masked by `enable` only. Feeds clustering itself — never the render-admission
  // result, or the pipeline `'group'` stage claim would need the render tree it's about to
  // build.
  const grouping = computed(() => maskGroupingLevels(baseGrouping(), ruleEntries));

  const columnWhen = collectGroupPredicates(rules);
  const groupOrderByColumn = collectGroupOrder(rules);
  const extractValueByColumn = collectGroupKeys(rules);
  const aggregateByColumn = collectAggregates(rules);

  const clusterOpts: ClusterOpts<TRow> = {
    groupOrderByColumn: groupOrderByColumn.size > 0 ? groupOrderByColumn : undefined,
    when: config.when,
    columnWhen: columnWhen.size > 0 ? columnWhen : undefined,
    extractValueByColumn: extractValueByColumn.size > 0 ? extractValueByColumn : undefined,
    labelByColumn: labelByColumnId.size > 0 ? labelByColumnId : undefined,
    aggregateByColumn: aggregateByColumn.size > 0 ? aggregateByColumn : undefined,
    knownIds: knownColumnIds,
    label: 'withGrouping',
    // Note: a getter, not a copy. A feature folded after this one may contribute
    // `ctx.parentOf`; a factory-time read would make grouping ignore the parent link.
    get treeLinks(): TreeLinkSource<TRow> | undefined {
      const parentOf = ctx.parentOf;
      return parentOf ? { parentOf, trackBy: input.trackBy } : undefined;
    },
  };

  // Applied: declared, filtered to the prefix that actually admitted at least one cluster.
  // Read-only derivation off the same tree `clusterRows` builds — never feeds clustering itself,
  // so there is no cycle with `grouping` above.
  const appliedGrouping = computed(() =>
    collectAppliedLevels(input.rows(), grouping(), input.columns(), clusterOpts)
  );

  // `table.grouping` reads applied, writes declared — a gated-off/unadmitted level is never
  // silently dropped by a round-trip through `.update()`.
  const groupingView = createWritableView<string[], GroupingUpdater<TRow>>(
    () => appliedGrouping(),
    (updater) => {
      const next = updater(baseGrouping());
      assertWrittenIdsAreKnown(
        next,
        input.columns().map((column) => column.id),
        'withGrouping'
      );
      baseGrouping.set(next);
    }
  );

  const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
    rowsBeneathGroup(input.rows(), grouping(), input.columns(), group.id, clusterOpts);

  const groupIds = computed(() =>
    collectGroupIds(input.rows(), grouping(), input.columns(), clusterOpts)
  );

  const groupingLevels = computed(() => {
    const columnById = new Map<string, ColumnDef<TRow>>(
      input.columns().map((c) => [c.id, c])
    );
    const levels: ColumnDef<TRow>[] = [];
    const reported = new Set<string>();
    for (const id of appliedGrouping()) {
      const column = columnById.get(id);
      if (!column) {
        // Runtime, data-dependent: the id was valid when applied, but setColumns() can remove
        // a column while it's still an active grouping level. Not the construction/writer
        // contract assertDeclarationsAreKnown enforces, so this degrades rather than throws
        // (ADR-0014) — omit the level and report once per evaluation.
        reportOrphanedGroupingColumn(
          id,
          'Omitting it from groupingLevels() for this evaluation.',
          reported
        );
        continue;
      }
      levels.push(column);
    }
    return levels;
  });
  const groupedIds = computed(() => new Set(appliedGrouping()));
  const isGroupedBy = (columnId: string): boolean => groupedIds().has(columnId);

  return {
    members: { grouping: groupingView, rowsOf, groupIds, groupingLevels, isGroupedBy },
    stages: stageSchema('pipeline', (s) => {
      stage(s.group, {
        run: (rows) => clusterRows(rows, grouping(), input.columns(), clusterOpts),
      });
    }),
    renderStages: stageSchema('render', (s) => {
      stage(s.group, {
        run: (rows) => buildGroupRenderRows(rows, grouping(), input.columns(), clusterOpts),
      });
    }),
  };
}

/**
 * Adds row-field grouping to a `createTable()`, with zero knowledge of expansion.
 *
 * @remarks
 * Claims the `'group'` pipeline and render stages. `table.grouping` reads the applied
 * (post-`when`) levels but writes the full declared set, so a gated-off level survives a
 * round-trip. `schema`'s `path` and `initial` both key by declared column id.
 *
 * @example
 * ```ts
 * withGrouping({
 *   initial: ['region'],
 *   schema: (path) => aggregate(path.amount, sum),
 * })
 * ```
 */
export function withGrouping<In extends GroupingInput<In>>(
  config?: WithGroupingConfig<RowOf<In>, ColumnValuesOf<In>>
): Feature<In, GroupingMembers<RowOf<In>>>;
export function withGrouping<In extends GroupingInput<In>, D extends DerivedDict>(
  config: WithGroupingConfig<RowOf<In>, ColumnValuesOf<In>> | undefined,
  compute: Feature<NoInfer<In> & GroupingMembers<RowOf<In>>, D>
): Feature<In, GroupingMembers<RowOf<In>> & D>;
export function withGrouping(
  config: WithGroupingConfig<any, any> = {},
  compute?: Feature<any, any>
): Feature<any, any> {
  const factory = <In extends GroupingInput<In>>(
    input: In,
    ctx: StageContext<RowOf<In>>
  ): TableFeatureSpec<RowOf<In>, GroupingMembers<RowOf<In>>> =>
    buildGroupingSpec(input, config, ctx);
  const feature: Feature<any, any> = compute
    ? createTableFeature(factory, compute)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withGrouping' });
}
