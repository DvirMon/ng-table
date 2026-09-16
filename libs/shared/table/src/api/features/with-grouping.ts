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
  initialGrouping?: ColumnId<TRow>[];
  /** Orders clusters by their contents, siblings only, at every depth. Omitted: stable
   * first-occurrence order. Throws: falls back to stable order for the affected level and
   * reports once per evaluation. Decoupled from `sorting`. See `withGrouping()`'s decisions
   * doc. */
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  /** Base+overlay fold. Returning `string[]` overrides `baseGrouping`; `undefined` abstains
   * and holds it; `[]` is actively grouped by nothing — distinct from abstain. Mutually
   * exclusive with `rules` in practice (both compile to this same slot) — the rules-array layer
   * (below) is sugar that produces exactly this shape. */
  groupingRule?: () => string[] | undefined;
  /** Rules-array layer: compiles to `groupingRule` via `foldGroupingRules`. Call order (array
   * order here, schema-fn call order when using the function-argument overload) determines level
   * order. */
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
  const initial: string[] = config.initialGrouping ?? [];
  const knownIds = new Set(input.columns().map((c) => c.id));
  const unknownIds = initial.filter((id) => !knownIds.has(id));
  if (unknownIds.length > 0) {
    throw new Error(
      `[withGrouping] initialGrouping names unknown column id(s): ${unknownIds.join(', ')}.`
    );
  }
  const rules = config.rules ?? [];
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
  configOrSchemaFn?: WithGroupingConfig<RowOf<In>> | GroupingSchemaFn<RowOf<In>>
): Feature<In, GroupingMembers<RowOf<In>>>;
export function withGrouping<In extends GroupingInput<In>, D extends DerivedDict>(
  configOrSchemaFn: WithGroupingConfig<RowOf<In>> | GroupingSchemaFn<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & GroupingMembers<RowOf<In>>, D>
): Feature<In, GroupingMembers<RowOf<In>> & D>;
export function withGrouping(
  configOrSchemaFn: WithGroupingConfig<any> | GroupingSchemaFn<any> = {},
  derive?: Feature<any, any>
): Feature<any, any> {
  const config: WithGroupingConfig<any> =
    typeof configOrSchemaFn === 'function'
      ? { rules: [...runColumnsSchemaFn<any, AnyGroupingRule<any>>(configOrSchemaFn)] }
      : configOrSchemaFn;
  const factory = <In extends GroupingInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, GroupingMembers<RowOf<In>>> => buildGroupingSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withGrouping' });
}
