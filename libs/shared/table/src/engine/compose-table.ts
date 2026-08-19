import { computed, DestroyRef, inject } from '@angular/core';
import type { AnyTableFeature, TableStore } from '../api/types';
import { createTableCore, type TableCoreHandle } from './core';
import { PIPELINE_ORDER } from './pipeline';
import { describeFeature, SlotRegistry } from './slots';
import type { TableCore, TableEngineConfig, TableFeatureSpec } from './types';

interface FeatureHooks {
  readonly onInit: (() => void)[];
  readonly onDestroy: (() => void)[];
}

/**
 * Calls every feature factory in array order, registering what each one declares. Members are
 * merged into `composed` as they arrive, which is what makes the feature-to-feature seam
 * order-dependent at factory time and complete afterwards.
 */
function foldFeatures<TRow>(
  features: readonly AnyTableFeature[],
  core: TableCore<TRow>,
  composed: Record<string, unknown>,
  handle: TableCoreHandle<TRow>
): FeatureHooks {
  const registry = new SlotRegistry();
  const hooks: FeatureHooks = { onInit: [], onDestroy: [] };

  features.forEach((feature, index) => {
    const spec: TableFeatureSpec<TRow> = feature(core, composed);
    const label = describeFeature(index);

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

    if (spec.renderRows) {
      registry.claimRenderRows(label);
      handle.setRenderRowsBuilder(spec.renderRows);
    }

    Object.assign(composed, spec.members);

    if (spec.columnRules) {
      handle.columnRules.push(...spec.columnRules);
    }

    if (spec.onInit) {
      hooks.onInit.push(spec.onInit);
    }
    if (spec.onDestroy) {
      hooks.onDestroy.push(spec.onDestroy);
    }
  });

  return hooks;
}

/**
 * Composes the table's state layer from a core config plus an ordered feature list, and
 * returns a live store **instance** — no class, no DI token. Features declare what they
 * contribute (`members`, `stages`, `renderRows`, hooks); this function is the only place
 * that wires those declarations together.
 *
 * Must run inside an Angular injection context: `onInit` hooks create `effect()` /
 * `resource()`, and `onDestroy` hooks register on the ambient `DestroyRef`.
 */
export function composeTable<TRow>(
  config: TableEngineConfig<TRow>,
  features: readonly AnyTableFeature[]
): TableStore<TRow> {
  const handle = createTableCore<TRow>(config);

  // Stable reference — features that read it at factory time see only earlier features,
  // features that read it from a method or computed see everything.
  const composed: Record<string, unknown> = {};
  const hooks = foldFeatures(features, handle.core, composed, handle);

  // ADR-0005: default is the row count before any virtualization/pagination trims what's
  // actually rendered — equals `renderRows().length` until a future feature overrides it.
  const totalRowCount = computed(() => handle.core.rows().length);

  const store = Object.assign(
    { ...handle.core, renderRows: handle.renderRows, totalRowCount },
    composed
  );

  // Hooks run only once every feature is composed, so an `onInit` can read any other
  // feature's members.
  for (const onInit of hooks.onInit) {
    onInit();
  }
  if (hooks.onDestroy.length > 0) {
    const destroyRef = inject(DestroyRef);
    for (const onDestroy of hooks.onDestroy) {
      destroyRef.onDestroy(onDestroy);
    }
  }

  // The one seam where static typing gives way to dynamic composition: `composed` is
  // built by folding a runtime-length feature array. `createTable()` reconstructs the
  // full member type independently via `ComposedFeatureMembers<Features>`.
  return store;
}
