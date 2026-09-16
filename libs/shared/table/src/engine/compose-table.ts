import { computed, DestroyRef, effect, inject } from '@angular/core';
import type { AnyTableFeature, RowId, TableStore } from '../api/types';
import { createTableCore, type TableCoreHandle } from './core';
import { PIPELINE_ORDER } from './pipeline';
import { CLAIMABLE_RENDER_STAGES } from './render-stages';
import { diffRemovedIds } from './rows';
import { describeFeature, describeInternalFeature, SlotRegistry } from './slots';
import type { TableCore, TableEngineConfig, TableFeatureSpec } from './types';

interface FeatureHooks {
  readonly setup: (() => void)[];
  readonly onDestroy: (() => void)[];
  readonly onRowsRemoved: ((ids: readonly RowId[]) => void)[];
}

/** Engine-supplied features receive the core handle — never a consumer `Feature`. */
export type InternalFeature<TRow> = (core: TableCore<TRow>) => TableFeatureSpec<TRow>;

/**
 * A feature paired with the claimant label its collision messages use, and a thunk that
 * already knows which argument to call it with. Pre-binding here is what lets `foldFeatures`
 * run one loop body for both consumer and internal features instead of branching on kind.
 */
interface LabeledFeature<TRow> {
  readonly run: () => TableFeatureSpec<TRow>;
  readonly label: string;
}

/**
 * The store while it is still being folded onto: the core members are already concrete, and
 * feature members arrive as unknown keys.
 */
type FoldingStore<TRow> = TableStore<TRow> & Record<string, unknown>;

/**
 * Pairs each feature with its 1-based positional label and pre-binds the argument it will be
 * called with — `call` closes over the store for consumer features, the engine core for
 * internal ones — so the fold loop never needs to know which kind it is running.
 */
function labelFeatures<TRow, TFeature>(
  features: readonly TFeature[],
  describe: (position: number, displayName?: string) => string,
  call: (feature: TFeature) => TableFeatureSpec<TRow>,
  displayNameOf?: (feature: TFeature) => string | undefined
): LabeledFeature<TRow>[] {
  return features.map((feature, index) => ({
    run: () => call(feature),
    label: describe(index + 1, displayNameOf?.(feature)),
  }));
}

/**
 * Builds the core half of the store before any feature runs, so a feature factory already
 * sees `renderRows` and `totalRowCount` on the store it is handed.
 */
function createBaseStore<TRow>(
  handle: TableCoreHandle<TRow>
): FoldingStore<TRow> {
  // Default is the row count before any virtualization/pagination trims what's actually
  // rendered — equals `renderRows().length` until a feature overrides it.
  const totalRowCount = computed(() => handle.core.rows().length);

  return {
    columns: handle.core.columns,
    rows: handle.core.rows,
    trackBy: handle.core.trackBy,
    value: handle.core.value,
    renderRows: handle.renderRows,
    totalRowCount,
    indexById: handle.core.indexById,
  };
}

/**
 * Calls every feature's pre-bound thunk in array order, registering what each one declares.
 * Members are merged into `store` as they arrive, which is what makes the feature-to-feature
 * seam order-dependent at factory time and complete afterwards: `store` is one shared
 * reference, so a feature that captures it and reads lazily (a method, a `computed()`, a
 * stage) sees every later feature too, not just the ones folded so far.
 */
function foldFeatures<TRow>(
  features: readonly LabeledFeature<TRow>[],
  store: FoldingStore<TRow>,
  handle: TableCoreHandle<TRow>,
  registry: SlotRegistry
): FeatureHooks {
  const hooks: FeatureHooks = { setup: [], onDestroy: [], onRowsRemoved: [] };

  for (const { run, label } of features) {
    const spec: TableFeatureSpec<TRow> = run();

    if (spec.stages) {
      for (const stage of PIPELINE_ORDER) {
        const transform = spec.stages[stage];
        if (!transform) {
          continue;
        }
        registry.claimStage(stage, label);
        handle.stages[stage] = transform;
      }
    }

    if (spec.renderStages) {
      for (const stage of CLAIMABLE_RENDER_STAGES) {
        const transform = spec.renderStages[stage];
        if (!transform) {
          continue;
        }
        registry.claimRenderStage(stage, label);
        handle.renderStages[stage] = transform;
      }
    }

    if (spec.members) {
      for (const key of Object.keys(spec.members)) {
        registry.claimMember(key, label);
      }
      Object.assign(store, spec.members);
    }

    if (spec.columnRules) {
      handle.columnRules.push(...spec.columnRules);
    }

    // Accumulates rather than single-claims — see `TableFeatureSpec.expandedRows` (ADR-0017).
    if (spec.expandedRows) {
      handle.expandedSources.push(spec.expandedRows);
    }

    if (spec.setup) {
      hooks.setup.push(spec.setup);
    }
    if (spec.onDestroy) {
      hooks.onDestroy.push(spec.onDestroy);
    }
    if (spec.onRowsRemoved) {
      hooks.onRowsRemoved.push(spec.onRowsRemoved);
    }
  }

  return hooks;
}

/**
 * Composes the table's state layer from a core config plus an ordered feature list, and
 * returns a live store **instance** — no class, no DI token. Features declare what they
 * contribute (`members`, `stages`, `renderStages`, hooks); this function is the only place
 * that wires those declarations together.
 *
 * `internalFeatures` are engine-supplied (e.g. the column-schema wiring) and fold first, so a
 * consumer feature's position in `features` is what its collision messages name.
 *
 * Must run inside an Angular injection context: `setup` hooks create `effect()` /
 * `resource()`, and `onDestroy` hooks register on the ambient `DestroyRef`.
 */
export function composeTable<TRow>(
  config: TableEngineConfig<TRow>,
  features: readonly AnyTableFeature[],
  internalFeatures: readonly InternalFeature<TRow>[] = []
): TableStore<TRow> {
  const handle = createTableCore<TRow>(config);

  // The core members are owned by the engine, so a feature declaring one collides at
  // construction like any other member clash instead of silently shadowing it.
  const registry = new SlotRegistry();
  registry.claimCoreMembers();

  // Stable reference — features that read it at factory time see the core members plus only
  // earlier features, features that read it from a method or computed see everything.
  const store = createBaseStore(handle);

  const hooks = foldFeatures(
    [
      ...labelFeatures<TRow, InternalFeature<TRow>>(
        internalFeatures,
        describeInternalFeature,
        (feature) => feature(handle.core)
      ),
      // `AnyTableFeature` erases `In`/`Out` to `any`, so calling it back statically resolves to
      // `TableFeatureSpec<unknown>` — the same static/dynamic seam `create-table.ts` bridges
      // with its own cast, just met here instead of there.
      ...labelFeatures<TRow, AnyTableFeature>(
        features,
        describeFeature,
        (feature) => feature(store) as TableFeatureSpec<TRow>,
        (feature) => feature.displayName
      ),
    ],
    store,
    handle,
    registry
  );

  // Hooks run only once every feature is composed, so a `setup` can read any other
  // feature's members.
  for (const setup of hooks.setup) {
    setup();
  }
  if (hooks.onDestroy.length > 0) {
    const destroyRef = inject(DestroyRef);
    for (const onDestroy of hooks.onDestroy) {
      destroyRef.onDestroy(onDestroy);
    }
  }

  // Reconciles feature state (expanded rows, open edits, ...) against `data`. An effect, not
  // a hook inside `updateRows` — a full `data.set(...)` replacement (paging,
  // refetch, a WebSocket snapshot) never passes through `core.value.update(...)`, so a
  // write-site hook would miss exactly the case where every id is orphaned at once. Seeding
  // `previousIds` before the effect exists means its first run diffs against itself instead of
  // reporting every row as removed at construction.
  if (hooks.onRowsRemoved.length > 0) {
    let previousIds = new Set(handle.core.indexById().keys());
    effect(() => {
      const currentIds = new Set(handle.core.indexById().keys());
      const removed = diffRemovedIds(previousIds, currentIds);
      previousIds = currentIds;
      if (removed.length > 0) {
        for (const onRowsRemoved of hooks.onRowsRemoved) {
          onRowsRemoved(removed);
        }
      }
    });
  }

  // The one seam where static typing gives way to dynamic composition: feature members are
  // folded from a runtime-length array. The cast in `create-table.ts` is the static/dynamic
  // boundary.
  return store;
}
