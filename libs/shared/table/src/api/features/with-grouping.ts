import { computed, signal, type Signal } from '@angular/core';
import {
  buildGroupRenderRows,
  clusterRows,
  collectGroupIds,
  rowsBeneathGroup,
} from '../../engine/grouping';
import {
  buildAsyncGroupingRuleEntry,
  buildGroupingRuleEntries,
  foldGroupingRules,
  isGroupingAsyncRule,
  isGroupingRule,
} from '../../engine/grouping-rules';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import { runColumnsSchemaFn } from '../../schema/column-schema';
import type { AnyGroupingRule, GroupingSchemaFn } from '../../schema/grouping-schema.types';
import { createTableFeature } from '../create-table-feature';
import type {
  ColumnId,
  DerivedDict,
  GroupingUpdater,
  GroupSummary,
  RenderRow,
  RowId,
  TableStore,
} from '../types';

/** The slice of the accumulating store this feature reads, row-typed via `RowOf<In>`. */
type GroupingInput<In> = Pick<TableStore<RowOf<In>>, 'columns' | 'rows'>;

export interface WithGroupingConfig<TRow> {
  /** Seeds `grouping` at construction. An id naming no known column throws — a wiring error,
   * parallel to `engine/rows.ts`'s `trackBy` throw site. */
  initial?: ColumnId<TRow>[];
  /** Orders clusters by their contents, siblings only, at every depth. Omitted: stable
   * first-occurrence order. Throws: falls back to stable order for the affected level and
   * reports once per evaluation. Decoupled from `sorting`. See `withGrouping()`'s decisions
   * doc. */
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  /** Base+overlay fold. Returning `string[]` overrides `initial`; `undefined` abstains and holds
   * it; `[]` is actively grouped by nothing — distinct from abstain. Mutually exclusive with
   * `rules`/`schema` in practice (both compile to this same slot) — the rules-array layer (below)
   * is sugar that produces exactly this shape. */
  groupingRule?: () => string[] | undefined;
  /** Declarative per-column rules. Records by side effect; returns nothing. Call order is level
   * order. Composes with `rules` — both land in the same array, `schema`-recorded rules first. */
  schema?: GroupingSchemaFn<TRow>;
  /** Rules-array layer: compiles to `groupingRule` via `foldGroupingRules`. The pre-recorded form
   * of what `schema` records. */
  rules?: AnyGroupingRule<TRow>[];
}

export interface GroupingMembers<TRow> {
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
  /** Leaf rows beneath a group header, at any depth — post-filter by construction, since
   * `filter` precedes `group` in `PIPELINE_ORDER`. Resolved by `group.id`, so a header from an
   * earlier render pass still works; a group that no longer exists returns `[]`. Reads
   * `input.rows()` (pipeline output), independent of collapse/expand state. */
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];
  /** Every group header id that exists in the data, at every level, collapse-independent —
   * derives from the cluster tree, not `renderRows()`. `[]` when ungrouped. Feeds
   * `expandAll(table.groupIds())` (issue #131). */
  readonly groupIds: Signal<RowId[]>;
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
  const knownIds = new Set(input.columns().map((c) => c.id));
  const unknownIds = initial.filter((id) => !knownIds.has(id));
  if (unknownIds.length > 0) {
    throw new Error(
      `[withGrouping] initial names unknown column id(s): ${unknownIds.join(', ')}.`
    );
  }
  const schemaRules = config.schema
    ? [...runColumnsSchemaFn<TRow, AnyGroupingRule<TRow>>(config.schema)]
    : [];
  const rules = [...schemaRules, ...(config.rules ?? [])];
  const unknownRuleIds = rules.map((rule) => rule.columnId).filter((id) => !knownIds.has(id));
  if (unknownRuleIds.length > 0) {
    throw new Error(
      `[withGrouping] rules name unknown column id(s): ${unknownRuleIds.join(', ')}.`
    );
  }

  const baseGrouping = signal<string[]>(initial);

  const ruleEntries = [
    ...buildGroupingRuleEntries(rules.filter(isGroupingRule)),
    ...rules.filter(isGroupingAsyncRule).map(buildAsyncGroupingRuleEntry),
  ];
  const rulesGroupingRule =
    ruleEntries.length > 0 ? (): string[] | undefined => foldGroupingRules(ruleEntries) : undefined;
  const effectiveGroupingRule = config.groupingRule ?? rulesGroupingRule;
  const grouping = computed(() => effectiveGroupingRule?.() ?? baseGrouping());

  const groupingView = createWritableView<string[], GroupingUpdater<TRow>>(
    () => grouping(),
    (updater) => baseGrouping.update(updater)
  );

  const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
    rowsBeneathGroup(input.rows(), grouping(), input.columns(), group.id);

  const groupIds = computed(() =>
    collectGroupIds(input.rows(), grouping(), input.columns(), config.groupOrder)
  );

  return {
    members: { grouping: groupingView, rowsOf, groupIds },
    stages: {
      group: (rows) => clusterRows(rows, grouping(), input.columns(), config.groupOrder),
    },
    renderStages: {
      group: (rows) => buildGroupRenderRows(rows, grouping(), input.columns(), config.groupOrder),
    },
  };
}

/**
 * Adds column-based row grouping to a `createTable()`. Reads only `columns`/`rows` off the
 * store handed in, with zero knowledge of expansion. Claims the `'group'` pipeline and render
 * stages (`engine/grouping.ts`'s `clusterRows`/`buildGroupRenderRows`). `table.grouping` folds
 * `groupingRule`/`rules`/a schema fn over `baseGrouping` — see the decisions doc. `groupOrder`
 * orders cluster siblings.
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
