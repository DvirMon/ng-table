import { computed, signal, type Signal } from '@angular/core';
import type { ColumnDef, RenderRow, RowId } from '../api/types';
import { foldColumnRules, resolveColumnDefs, type ColumnRuleEntry } from './columns';
import { runPipeline, type PipelineStages } from './pipeline';
import { runRenderStages, type RenderStages } from './render-stages';
import { buildDefaultRenderRows, normalizeTrackBy } from './rows';
import type { TableCore, TableEngineConfig } from './types';
import { createWritableView } from './writable-view';

/**
 * What `composeTable()` gets back from core construction. `stages`, `renderStages`, and
 * `columnRules` are handed out as mutable registries rather than store members — the
 * `rows` / `renderRows` / `columns` computeds read them at *evaluation* time, so features
 * registering during the fold are visible by the time a consumer first reads any of them.
 */
export interface TableCoreHandle<TRow> {
  readonly core: TableCore<TRow>;
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly stages: PipelineStages<TRow>;
  readonly renderStages: RenderStages<TRow>;
  readonly columnRules: ColumnRuleEntry<TRow>[];
  // Additively populated by `composeTable()`'s fold, one entry per feature declaring
  // `TableFeatureSpec.expandedRows` — accumulating, not single-claimed. Unioned below and fed
  // into the terminal `'prune'` render stage (ADR-0017).
  readonly expandedSources: Signal<ReadonlySet<RowId>>[];
}

/**
 * Builds the feature-independent half of the store: the writable source signals
 * (`baseColumns`, `data`), the derived `columns`, and the pipeline computeds. Knows nothing
 * about features.
 */
export function createTableCore<TRow>(
  config: TableEngineConfig<TRow>
): TableCoreHandle<TRow> {
  // Normalized once at construction so there's zero branching at render/comparison time.
  const trackBy = normalizeTrackBy(config.trackBy);

  const baseColumns = signal<ColumnDef<TRow>[]>(resolveColumnDefs(config.columns));
  const columnRules: ColumnRuleEntry<TRow>[] = [];
  const columns = computed(() => foldColumnRules(baseColumns(), columnRules));

  const stages: PipelineStages<TRow> = {};
  const renderStages: RenderStages<TRow> = {};
  const expandedSources: Signal<ReadonlySet<RowId>>[] = [];
  // Always runs first, never replaced — the `RenderRow[]` seed every render stage chain
  // starts from.
  const seedRenderRows = buildDefaultRenderRows(trackBy);

  const rows = computed(() => runPipeline(config.data(), stages));

  // Unions every contributed `expandedRows` set for the terminal `'prune'` stage. `undefined`
  // when zero features contributed the slot (a no-op prune); a defined — possibly empty —
  // `Set` once at least one has, even if nothing is currently expanded. Recomputed on read
  // like `rows`/`renderRows`, so a feature registering during the fold is visible by the time a
  // consumer first reads `renderRows`. See ADR-0017.
  const expanded = computed<ReadonlySet<RowId> | undefined>(() => {
    if (expandedSources.length === 0) {
      return undefined;
    }
    const union = new Set<RowId>();
    for (const source of expandedSources) {
      for (const id of source()) {
        union.add(id);
      }
    }
    return union;
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

  // Downstream of `rows` (the pipeline output), not `data` directly — recomputes on every
  // filter/group/sort/expand change, not just when the consumer's `data` signal re-emits.
  // `index` and `sourceIndex` are assigned here, centrally, rather than by any render stage:
  // `index` is purely the row's position in the final array (feeds `aria-rowindex`),
  // assigned once after the whole render-stage chain runs, and `sourceIndex` resolves via
  // `indexById` — `undefined` for a synthesized row (`row.data === null`) since there is no
  // `data()` entry to point to.
  const renderRows = computed(() => {
    const byId = indexById();
    const shaped = runRenderStages(seedRenderRows(rows()), renderStages, expanded());
    return shaped.map((row, index) => {
      const isSynthesizedRow = row.data === null;
      return {
        ...row,
        index,
        sourceIndex: isSynthesizedRow ? undefined : byId.get(row.id),
      };
    });
  });

  const core: TableCore<TRow> = {
    columns: createWritableView(
      () => columns(),
      (updater) => baseColumns.update(updater)
    ),
    baseColumns: baseColumns.asReadonly(),
    rows,
    renderRows,
    trackBy,
    indexById,
    value: createWritableView(
      () => config.data(),
      (updater) =>
        config.data.update((rows) => updater(rows, { trackBy, indexById: indexById() }))
    ),
  };

  return {
    core,
    renderRows,
    stages,
    renderStages,
    columnRules,
    expandedSources,
  };
}
