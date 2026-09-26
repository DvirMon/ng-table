import { computed, type Signal } from '@angular/core';
import type { ColumnRuleEntry } from '../../engine/columns';
import type { PipelineStage, PipelineStages, RowTransform } from '../../engine/pipeline';
import type {
  RenderNodeTransform,
  RenderStage,
  RenderStages,
} from '../../engine/render-stages';
import { describeInnerFeature, SlotRegistry } from '../../engine/slots';
import type { TableFeatureSpec } from '../../engine/types';
import type { StageRule } from '../../schema/stage-rules';
import type { AnyTableFeature, RowId } from '../types';
import type { ComposeFeaturesOverloads } from './compose-features.overloads';

/** Runs every callback in `callbacks`, in order, forwarding whatever arguments it is called with. */
function runInOrder<Args extends unknown[]>(
  callbacks: readonly ((...args: Args) => void)[]
): (...args: Args) => void {
  return (...args: Args) => {
    for (const callback of callbacks) {
      callback(...args);
    }
  };
}

/** Claims and accumulates one inner feature's `stages` against `registry`, labeled `label`. */
function claimInnerStages<TRow>(
  spec: TableFeatureSpec<TRow>,
  label: string,
  registry: SlotRegistry,
  into: PipelineStages<TRow>
): void {
  if (!spec.stages) {
    return;
  }
  for (const rule of spec.stages) {
    // Declare form (`name` + `placement`): resolving/executing it is issue #155's concern —
    // no shipped feature in this issue produces one, same scope boundary as the outer fold.
    if ('name' in rule) {
      continue;
    }
    const anchor = rule.anchor as PipelineStage;
    registry.claimStage(anchor, label);
    into[anchor] = rule.run;
  }
}

/** Claims and accumulates one inner feature's `renderStages` against `registry`, labeled `label`. */
function claimInnerRenderStages<TRow>(
  spec: TableFeatureSpec<TRow>,
  label: string,
  registry: SlotRegistry,
  into: RenderStages<TRow>
): void {
  if (!spec.renderStages) {
    return;
  }
  for (const rule of spec.renderStages) {
    if ('name' in rule) {
      continue;
    }
    const anchor = rule.anchor as RenderStage;
    registry.claimRenderStage(anchor, label);
    into[anchor] = rule.run;
  }
}

/**
 * Converts an accumulated keyed stage map back into claim-form `StageRule[]` entries, one per
 * occupied anchor — this is what lets the outer fold's registry (`engine/compose-table.ts`)
 * still see the composite's inner claims and name a cross-boundary collision.
 */
function toStageRules<TAnchor extends string, TTransform>(
  stages: Partial<Record<TAnchor, TTransform>>
): StageRule<TTransform>[] {
  return (Object.keys(stages) as TAnchor[]).map((anchor) => ({
    anchor,
    run: stages[anchor] as TTransform,
  }));
}

/**
 * Folds `features` into a single spec, the same way the engine's own fold does, but against a
 * private registry so only inner-vs-inner collisions surface here — the outer fold claims the
 * merged result again, which is what names a cross-boundary collision.
 */
function foldInnerFeatures(
  features: readonly AnyTableFeature[],
  input: Record<string, unknown>
): TableFeatureSpec<unknown, Record<string, unknown>> {
  const registry = new SlotRegistry();
  registry.claimCoreMembers();

  // Own properties = inner members folded so far; prototype = the outer store, so a read
  // deferred into a method or `computed()` still sees every later outer slot (same seam as
  // `createTableFeature`'s `blockInput`).
  const innerStore: Record<string, unknown> = Object.create(input);

  const members: Record<string, unknown> = {};
  const stages: PipelineStages<unknown> = {};
  const renderStages: RenderStages<unknown> = {};
  const columnRules: ColumnRuleEntry<unknown>[] = [];
  const expandedRowsSignals: Signal<ReadonlySet<RowId>>[] = [];
  const setups: (() => void)[] = [];
  const onDestroys: (() => void)[] = [];
  const onRowsRemoveds: ((ids: readonly RowId[]) => void)[] = [];

  features.forEach((feature, index) => {
    const label = describeInnerFeature(index + 1, feature.displayName);
    const spec: TableFeatureSpec<unknown> = feature(innerStore);

    claimInnerStages(spec, label, registry, stages);
    claimInnerRenderStages(spec, label, registry, renderStages);

    if (spec.members) {
      for (const key of Object.keys(spec.members)) {
        registry.claimMember(key, label);
      }
      Object.assign(members, spec.members);
      Object.assign(innerStore, spec.members);
    }

    if (spec.columnRules) {
      columnRules.push(...spec.columnRules);
    }
    // Accumulates rather than single-claims, same as the outer fold — see
    // `TableFeatureSpec.expandedRows` (ADR-0017).
    if (spec.expandedRows) {
      expandedRowsSignals.push(spec.expandedRows);
    }
    if (spec.setup) {
      setups.push(spec.setup);
    }
    if (spec.onDestroy) {
      onDestroys.push(spec.onDestroy);
    }
    if (spec.onRowsRemoved) {
      onRowsRemoveds.push(spec.onRowsRemoved);
    }
  });

  // A key with no content must be **absent**, not `{}`: a composite of `withComputed()` blocks
  // is a valid trailing derive argument, and `mergeDerivedSpec`'s pipeline-behaviour guard
  // checks `!== undefined`.
  const hasStages = Object.keys(stages).length > 0;
  const hasRenderStages = Object.keys(renderStages).length > 0;
  const hasColumnRules = columnRules.length > 0;
  const hasExpandedRows = expandedRowsSignals.length > 0;
  const hasSetup = setups.length > 0;
  const hasOnDestroy = onDestroys.length > 0;
  const hasOnRowsRemoved = onRowsRemoveds.length > 0;

  return {
    members,
    ...(hasStages ? { stages: toStageRules<PipelineStage, RowTransform<unknown>>(stages) } : {}),
    ...(hasRenderStages
      ? { renderStages: toStageRules<RenderStage, RenderNodeTransform<unknown>>(renderStages) }
      : {}),
    ...(hasColumnRules ? { columnRules } : {}),
    // The outer contract holds one `expandedRows` signal per feature, so N inner contributors
    // union into one composite signal here — the outer fold only ever sees a single slot to push.
    ...(hasExpandedRows
      ? {
          expandedRows: computed(() => {
            const union = new Set<RowId>();
            for (const source of expandedRowsSignals) {
              for (const id of source()) {
                union.add(id);
              }
            }
            return union;
          }),
        }
      : {}),
    ...(hasSetup ? { setup: runInOrder(setups) } : {}),
    ...(hasOnDestroy ? { onDestroy: runInOrder(onDestroys) } : {}),
    ...(hasOnRowsRemoved ? { onRowsRemoved: runInOrder(onRowsRemoveds) } : {}),
  };
}

/**
 * Collapses N features into one feature occupying a single `createTable()` slot — the arity
 * escape hatch (the type-level cap is not raisable). Inner features see the slots before the
 * composite plus earlier inner features; a following slot sees the whole composite. See
 * `docs/1-state/architecture.md`.
 */
export const composeFeatures = ((
  ...features: readonly AnyTableFeature[]
): AnyTableFeature => {
  const composite: AnyTableFeature = (input) => foldInnerFeatures(features, input);
  return Object.assign(composite, { displayName: 'composeFeatures' });
}) as ComposeFeaturesOverloads;
