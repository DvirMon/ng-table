import { computed, signal, type Signal } from '@angular/core';
import {
  buildGroupRenderRows,
  clusterRows,
  collectAppliedLevels,
  collectGroupIds,
  rowsBeneathGroup,
  type ClusterOpts,
} from '../../engine/grouping';
import {
  buildAsyncGroupingRuleEntry,
  buildGroupingRuleEntries,
  collectGroupLabels,
  collectGroupOrder,
  collectGroupPredicates,
  collectExtractValue,
  isGroupingAsyncRule,
  isGroupingRule,
  maskGroupingLevels,
  type GroupingRuleEntry,
} from '../../engine/grouping-rules';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import { runGroupingSchemaFn } from '../../schema/grouping-rules';
import type { AnyGroupingRule, GroupingRule, GroupingSchemaFn } from '../../schema/grouping-schema.types';
import { createTableFeature } from '../create-table-feature';
import type {
  ColumnDef,
  ColumnId,
  DerivedDict,
  GroupingUpdater,
  GroupWhen,
  RenderRow,
  RowId,
  TableStore,
} from '../types';

/** The slice of the accumulating store this feature reads, row-typed via `RowOf<In>`. */
type GroupingInput<In> = Pick<TableStore<RowOf<In>>, 'columns' | 'rows'>;

export interface WithGroupingConfig<TRow> {
  /** The declared grouping levels, outermost first — array order *is* nesting order. Seeds the
   * writable `grouping` view; rules gate these levels but can never add one. Stays a free string
   * (not a `ColumnsPath`-checked field): a level names a row field, which may or may not have a
   * matching column (D7) — a level naming a field no row actually carries degrades to one
   * `undefined`-keyed cluster rather than throwing (matches `schema`'s own runtime contract). */
  initial?: ColumnId<TRow>[];
  /** Table-wide admission — judged at every active level. A cluster returning `false` renders its
   * rows flat at the parent's depth: no header, no group id, no aggregates. Throws: the cluster is
   * admitted, reported once per column per evaluation. */
  when?: GroupWhen<TRow>;
  /** Declarative per-field rules — the single declarative entry. Records by side effect; returns
   * nothing. Call order carries no meaning — nesting order comes from `initial`. Path is keyed by
   * row field (`keyof TRow`), not declared column id — grouping partitions data, not a display
   * concept (D7, `2-decisions.md`). */
  schema?: GroupingSchemaFn<TRow>;
}

export interface GroupingMembers<TRow> {
  /** Reads the *applied* levels — the declared prefix with at least one admitted cluster (D5);
   * a level `when` rejects entirely is absent here even while it stays declared. Writes the
   * *declared* set via `.update()`, so a temporarily gated-off level survives a round-trip
   * instead of being silently dropped by it. */
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
  /** Leaf rows beneath a group header, at any depth — post-filter by construction, since
   * `filter` precedes `group` in `PIPELINE_ORDER`. Resolved by `group.id`, so a header from an
   * earlier render pass still works; a group that no longer exists returns `[]`. Reads
   * `input.rows()` (pipeline output), independent of collapse/expand state. */
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];
  /** Every group header id that exists in the data, at every level, collapse-independent —
   * derives from the cluster tree, not `renderRows()`. `[]` when ungrouped. Feeds
   * `expandAll(table.groupIds())`. */
  readonly groupIds: Signal<RowId[]>;
  /** Current *applied* grouping levels (D5) as `ColumnDef`s, ordered outermost first — the
   * inverse of `isGroupedBy`. A level naming no known column is omitted here (no `ColumnDef` to
   * report) even while applied; a level `when` rejects entirely is omitted too. `[]` when
   * ungrouped. */
  readonly groupingLevels: Signal<ColumnDef<TRow>[]>;
  /** O(1) membership check for one column against the *applied* levels (D5), backed by a set
   * derived alongside `groupingLevels` — a toggle row over N columns stays O(N). `false` for an
   * unknown column id or a level `when` rejects entirely, never a throw. */
  readonly isGroupedBy: (columnId: string) => boolean;
}

/**
 * The factory body: builds the feature spec from the store slice it reads plus its resolved
 * config. Shared by both `withGrouping()` overloads via the generic `factory` below.
 */
function buildGroupingSpec<TRow>(
  input: Pick<TableStore<TRow>, 'columns' | 'rows'>,
  config: WithGroupingConfig<TRow>
): TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  const initial: string[] = config.initial ?? [];
  const rules = config.schema ? [...runGroupingSchemaFn<TRow>(config.schema)] : [];
  const emptyRule = rules.find(
    (rule): rule is GroupingRule<TRow> => isGroupingRule(rule) && !rule.enable && !rule.when
  );
  if (emptyRule) {
    throw new Error(
      `[withGrouping] applyGrouping on field '${emptyRule.columnId}' declares neither enable nor when.`
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
  // result, or `stages.group` would need the render tree it's about to build (D5).
  const grouping = computed(() => maskGroupingLevels(baseGrouping(), ruleEntries));

  const columnWhen = collectGroupPredicates(rules);
  const groupOrderByColumn = collectGroupOrder(rules);
  const extractValueByColumn = collectExtractValue(rules);
  const labelByColumn = collectGroupLabels(rules);

  const clusterOpts: ClusterOpts<TRow> = {
    groupOrderByColumn: groupOrderByColumn.size > 0 ? groupOrderByColumn : undefined,
    when: config.when,
    columnWhen: columnWhen.size > 0 ? columnWhen : undefined,
    extractValueByColumn: extractValueByColumn.size > 0 ? extractValueByColumn : undefined,
    labelByColumn: labelByColumn.size > 0 ? labelByColumn : undefined,
  };

  // Applied (D5): declared, filtered to the prefix that actually admitted at least one cluster.
  // Read-only derivation off the same tree `clusterRows` builds — never feeds clustering itself,
  // so there is no cycle with `grouping` above.
  const appliedGrouping = computed(() =>
    collectAppliedLevels(input.rows(), grouping(), clusterOpts)
  );

  // `table.grouping` reads applied, writes declared — a gated-off/unadmitted level is never
  // silently dropped by a round-trip through `.update()` (D5).
  const groupingView = createWritableView<string[], GroupingUpdater<TRow>>(
    () => appliedGrouping(),
    (updater) => baseGrouping.update(updater)
  );

  const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
    rowsBeneathGroup(input.rows(), grouping(), group.id, clusterOpts);

  const groupIds = computed(() => collectGroupIds(input.rows(), grouping(), clusterOpts));

  const groupingLevels = computed(() => {
    const columnById = new Map<string, ColumnDef<TRow>>(
      input.columns().map((c) => [c.id, c])
    );
    return appliedGrouping()
      .map((id) => columnById.get(id))
      .filter((column): column is ColumnDef<TRow> => column !== undefined);
  });
  const groupedIds = computed(() => new Set(appliedGrouping()));
  const isGroupedBy = (columnId: string): boolean => groupedIds().has(columnId);

  return {
    members: { grouping: groupingView, rowsOf, groupIds, groupingLevels, isGroupedBy },
    stages: {
      group: (rows) => clusterRows(rows, grouping(), clusterOpts),
    },
    renderStages: {
      group: (rows) => buildGroupRenderRows(rows, grouping(), input.columns(), clusterOpts),
    },
  };
}

/**
 * Adds row-field grouping to a `createTable()`. Reads only `columns`/`rows` off the store handed
 * in, with zero knowledge of expansion. Claims the `'group'` pipeline and render stages
 * (`engine/grouping.ts`'s `clusterRows`/`buildGroupRenderRows`). `table.grouping` reads `initial`
 * masked by `schema`, then filtered to the levels `when` actually admitted (D5) — writes still
 * target the unfiltered declared set. See the decisions doc. Per-column `applyGroupOrder` rules
 * order cluster siblings. `schema`'s `path` is keyed by `keyof TRow` (D7), not a declared column
 * id — grouping partitions data, and a field with no display column is nameable too.
 */
export function withGrouping<In extends GroupingInput<In>>(
  config?: WithGroupingConfig<RowOf<In>>
): Feature<In, GroupingMembers<RowOf<In>>>;
export function withGrouping<In extends GroupingInput<In>, D extends DerivedDict>(
  config: WithGroupingConfig<RowOf<In>> | undefined,
  compute: Feature<NoInfer<In> & GroupingMembers<RowOf<In>>, D>
): Feature<In, GroupingMembers<RowOf<In>> & D>;
export function withGrouping(
  config: WithGroupingConfig<any> = {},
  compute?: Feature<any, any>
): Feature<any, any> {
  const factory = <In extends GroupingInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, GroupingMembers<RowOf<In>>> => buildGroupingSpec(input, config);
  const feature: Feature<any, any> = compute
    ? createTableFeature(factory, compute)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withGrouping' });
}
