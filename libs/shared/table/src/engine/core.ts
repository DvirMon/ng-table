import { computed, signal, type Signal } from '@angular/core';
import type { ColumnDef, RenderRow } from '../api/types';
import { foldColumnRules, resolveColumnDefs, type ColumnRuleEntry } from './columns';
import {
  runPipeline,
  type PipelineStages,
  type RenderRowsBuilder,
} from './pipeline';
import { buildDefaultRenderRows, normalizeTrackBy } from './rows';
import type { TableCore, TableEngineConfig } from './types';
import { createWritableView } from './writable-view';

/**
 * What `composeTable()` gets back from core construction. `stages`, `columnRules`, and the
 * render-rows builder are handed out as mutable registries rather than store members — the
 * `rows` / `renderRows` / `columns` computeds read them at *evaluation* time, so features
 * registering during the fold are visible by the time a consumer first reads any of them
 * (ADR-0003).
 */
export interface TableCoreHandle<TRow> {
  readonly core: TableCore<TRow>;
  readonly renderRows: Signal<RenderRow<TRow>[]>;
  readonly stages: PipelineStages<TRow>;
  readonly columnRules: ColumnRuleEntry<TRow>[];
  setRenderRowsBuilder(build: RenderRowsBuilder<TRow>): void;
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
  let buildRenderRows: RenderRowsBuilder<TRow> = buildDefaultRenderRows(trackBy);

  const rows = computed(() => runPipeline(config.data(), stages));

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
  // `index` and `sourceIndex` are assigned here, centrally, rather than by each `renderRows`
  // builder: `index` is purely the row's position in the final array (ADR-0005's
  // `aria-rowindex` source), and `sourceIndex` resolves via `indexById` — `undefined` for a
  // synthesized row (`row.data === null`) since there is no `data()` entry to point to.
  const renderRows = computed(() => {
    const byId = indexById();
    return buildRenderRows(rows()).map((row, index) => ({
      ...row,
      index,
      sourceIndex: row.data === null ? undefined : byId.get(row.id),
    }));
  });

  const core: TableCore<TRow> = {
    columns: createWritableView(
      () => columns(),
      (updater) => baseColumns.update(updater)
    ),
    baseColumns: baseColumns.asReadonly(),
    rows,
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
    columnRules,
    setRenderRowsBuilder(build: RenderRowsBuilder<TRow>): void {
      buildRenderRows = build;
    },
  };
}
