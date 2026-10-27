import { computed, signal, type Signal } from '@angular/core';
import type { ColumnDef, RenderRow, RowId } from '../api/types';
import { buildDataCells, buildGroupCells, withAccessorReports } from './cells';
import {
  foldColumnRules,
  resolveColumnDefs,
  selectRenderColumns,
  type ColumnRuleEntry,
} from './columns';
import { flattenVisible } from './flatten';
import { runPipeline, type RowTransform } from './pipeline';
import { runRenderStages, type RenderNodeTransform } from './render-stages';
import { buildDefaultRenderNodes, normalizeTrackBy, unionIdSets } from './rows';
import type { ResolvedStage } from './stage-order';
import type { ParentLink, TableCore, TableEngineConfig } from './types';
import { createWritableView } from './writable-view';

/**
 * `createTableCore()`'s return, consumed by `composeTable()`. `stages`, `renderStages` and
 * `columnRules` are mutable registries read at evaluation time: `columnRules` fills during the
 * fold, the stage registries once after it — all before any consumer reads them.
 */
export interface TableCoreHandle<TRow> {
  readonly core: TableCore<TRow>;
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly renderColumns: Signal<ColumnDef<TRow>[]>;
  readonly stages: ResolvedStage<RowTransform<TRow>>[];
  readonly renderStages: ResolvedStage<RenderNodeTransform<TRow>>[];
  readonly columnRules: ColumnRuleEntry<TRow>[];
  /** Additively populated by `composeTable()`'s fold — one entry per feature declaring
   * `expandedRows`. Unioned below and fed into `flattenVisible`. */
  readonly expandedSources: Signal<ReadonlySet<RowId>>[];
  /** One entry per feature declaring `contextRows`. Unioned below into the
   * `isContextRow` stamp. */
  readonly contextSources: Signal<ReadonlySet<RowId>>[];
  /** The union of every contributed `contextRows` set; `undefined` when none contributed. */
  readonly contextRows: Signal<ReadonlySet<RowId> | undefined>;
  // Note: a box, so `rows`/`renderRows` read `value` at evaluation time — the fold sets it
  // after construction.
  /** The contributed parent link, set at most once during `composeTable()`'s fold. */
  readonly parentLink: { value?: ParentLink<TRow> };
}

/**
 * Builds the feature-independent half of the store: the writable `baseColumns` signal, the
 * derived `columns`, and the pipeline computeds over the consumer's `config.data`. Owns the
 * slots features contribute to, but knows nothing about any specific feature.
 */
export function createTableCore<TRow>(config: TableEngineConfig<TRow>): TableCoreHandle<TRow> {
  // Normalized once at construction so there's zero branching at render/comparison time.
  const trackBy = normalizeTrackBy(config.trackBy);

  const baseColumns = signal<ColumnDef<TRow>[]>(resolveColumnDefs(config.columns, 'createTable'));
  const columnRules: ColumnRuleEntry<TRow>[] = [];
  const columns = computed(() => foldColumnRules(baseColumns(), columnRules));
  const renderColumns = computed(() => selectRenderColumns(columns()));

  const stages: ResolvedStage<RowTransform<TRow>>[] = [];
  const renderStages: ResolvedStage<RenderNodeTransform<TRow>>[] = [];
  const expandedSources: Signal<ReadonlySet<RowId>>[] = [];
  const contextSources: Signal<ReadonlySet<RowId>>[] = [];
  const parentLink: TableCoreHandle<TRow>['parentLink'] = {};
  // Always runs first, never replaced — the `RenderNode[]` seed every render stage chain
  // starts from.
  const seedRenderNodes = buildDefaultRenderNodes(trackBy);

  // One accessor-report set per data evaluation, shared by pipeline stages and the cells build
  // (ADR-0014): `rows` opens it, the next `renderRows` evaluation consumes it. A `renderRows`
  // rerun without a fresh `rows` (e.g. a column change) starts its own.
  let pendingAccessorReports: Set<string> | undefined;
  const rows = computed(() => {
    const reportedColumns = new Set<string>();
    pendingAccessorReports = reportedColumns;
    return withAccessorReports(reportedColumns, () =>
      runPipeline(config.data(), stages, { parentOf: parentLink.value }),
    );
  });

  // Unions every contributed `expandedRows` set for `flattenVisible`. `undefined` when zero
  // features contributed the slot (a no-op — everything stays open); a defined — possibly
  // empty — `Set` once at least one has, even if nothing is currently expanded. Recomputed on
  // read like `rows`/`renderRows`, so a feature registering during the fold is visible by the
  // time a consumer first reads `renderRows`.
  const expanded = computed<ReadonlySet<RowId> | undefined>(() => {
    if (expandedSources.length === 0) {
      return undefined;
    }
    return unionIdSets(expandedSources);
  });

  // Unions every contributed `contextRows` set. `undefined` when no feature contributed (the
  // stamp stays `undefined`); a defined, possibly empty, `Set` once one has.
  const context = computed<ReadonlySet<RowId> | undefined>(() => {
    if (contextSources.length === 0) {
      return undefined;
    }
    return unionIdSets(contextSources);
  });

  // Maps a row's trackBy id to its position in `data()` — the source of `sourceIndex`,
  // stamped below. Built from `data()` directly (not `rows()`, the pipeline output), so a
  // filter/group/sort/expand stage reordering or dropping rows doesn't change what index a
  // surviving row resolves to.
  const indexById = computed(() => {
    const map = new Map<ReturnType<typeof trackBy>, number>();
    config.data().forEach((row, index) => map.set(trackBy(row), index));
    return map;
  });

  // Depends on `rows` and on `data` (via `indexById`) — recomputes on every
  // filter/group/sort/expand change, not only when `data` re-emits.
  // `index`, `sourceIndex` and `cells` are assigned here, not by a render stage: `index` is the
  // row's position in the final array (feeds `aria-rowindex`), set after the whole render-stage
  // chain runs; `sourceIndex` resolves via `indexById`, `undefined` for a synthesized row
  // (`row.data === null`, no `data()` entry). `cells` reads `columns()`, so any column change
  // recomputes every render row (ADR-0022).
  const renderRows = computed(() => {
    const byId = indexById();
    const resolvedColumns = columns();
    const contextIds = context();
    // Read before taking the set, so a `rows` rerun has already replaced it.
    const pipelineRows = rows();
    const reportedColumns = pendingAccessorReports ?? new Set<string>();
    pendingAccessorReports = undefined;
    const tree = runRenderStages(seedRenderNodes(pipelineRows), renderStages, {
      parentOf: parentLink.value,
    });
    return flattenVisible(tree, expanded()).map((row, index) => {
      const isSynthesizedRow = row.data === null;
      const hasNoContextFlag = isSynthesizedRow || !contextIds;
      return {
        ...row,
        index,
        sourceIndex: isSynthesizedRow ? undefined : byId.get(row.id),
        isContextRow: hasNoContextFlag ? undefined : contextIds.has(row.id),
        cells: isSynthesizedRow
          ? buildGroupCells(row.aggregates)
          : buildDataCells(row.data, resolvedColumns, reportedColumns),
      };
    });
  });

  const core: TableCore<TRow> = {
    columns: createWritableView(
      () => columns(),
      (updater) => baseColumns.update(updater),
    ),
    baseColumns: baseColumns.asReadonly(),
    rows,
    renderRows,
    renderColumns,
    trackBy,
    indexById,
    value: createWritableView(
      () => config.data(),
      (updater) => config.data.update((rows) => updater(rows, { trackBy, indexById: indexById() })),
    ),
  };

  return {
    core,
    renderRows,
    renderColumns,
    stages,
    renderStages,
    columnRules,
    expandedSources,
    contextSources,
    contextRows: context,
    parentLink,
  };
}
