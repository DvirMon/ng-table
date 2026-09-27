import { computed, type Signal } from '@angular/core';
import type { ColumnRuleEntry } from '../../engine/columns';
import type { PipelineStage, RowTransform } from '../../engine/pipeline';
import type { RenderNodeTransform, RenderStage } from '../../engine/render-stages';
import { describeInnerFeature, SlotRegistry } from '../../engine/slots';
import type { TableFeatureSpec } from '../../engine/types';
import type { StageRule } from '../../schema/stage-rules';
import type { AnyTableFeature, RowId } from '../types';
import type { ComposeFeaturesOverloads } from './compose-features.overloads';

function runInOrder<Args extends unknown[]>(
  callbacks: readonly ((...args: Args) => void)[]
): (...args: Args) => void {
  return (...args: Args) => {
    for (const callback of callbacks) {
      callback(...args);
    }
  };
}

function claimInnerStages<TRow>(
  spec: TableFeatureSpec<TRow>,
  label: string,
  registry: SlotRegistry,
  into: StageRule<RowTransform<TRow>>[]
): void {
  if (!spec.stages) {
    return;
  }
  for (const rule of spec.stages) {
    // Claim form (no `name`) occupies a built-in anchor's own slot — collision detection
    // stays here. Declare form is forwarded unchanged; the outer fold resolves it.
    if (!('name' in rule)) {
      registry.claimStage(rule.anchor as PipelineStage, label);
    }
    into.push(rule);
  }
}

function claimInnerRenderStages<TRow>(
  spec: TableFeatureSpec<TRow>,
  label: string,
  registry: SlotRegistry,
  into: StageRule<RenderNodeTransform<TRow>>[]
): void {
  if (!spec.renderStages) {
    return;
  }
  for (const rule of spec.renderStages) {
    if (!('name' in rule)) {
      registry.claimRenderStage(rule.anchor as RenderStage, label);
    }
    into.push(rule);
  }
}

// Folds `features` into a single spec, the same way the engine's own fold does, but against a
// private registry so only inner-vs-inner collisions surface here — the outer fold claims the
// merged result again, which is what names a cross-boundary collision.
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
  const stages: StageRule<RowTransform<unknown>>[] = [];
  const renderStages: StageRule<RenderNodeTransform<unknown>>[] = [];
  const columnRules: ColumnRuleEntry<unknown>[] = [];
  const expandedRowsSignals: Signal<ReadonlySet<RowId>>[] = [];
  let parentLink: ((row: unknown) => RowId | null) | undefined;
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
    // Single-claim (ADR-0028). Claimed here so a second inner contributor throws naming both
    // inner positions — the outer fold only ever sees the merged result.
    if (spec.parentLink) {
      registry.claimParentLink(label);
      parentLink = spec.parentLink;
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
  const hasStages = stages.length > 0;
  const hasRenderStages = renderStages.length > 0;
  const hasColumnRules = columnRules.length > 0;
  const hasExpandedRows = expandedRowsSignals.length > 0;
  const hasParentLink = parentLink !== undefined;
  const hasSetup = setups.length > 0;
  const hasOnDestroy = onDestroys.length > 0;
  const hasOnRowsRemoved = onRowsRemoveds.length > 0;

  return {
    members,
    ...(hasStages ? { stages } : {}),
    ...(hasRenderStages ? { renderStages } : {}),
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
    ...(hasParentLink ? { parentLink } : {}),
    ...(hasSetup ? { setup: runInOrder(setups) } : {}),
    ...(hasOnDestroy ? { onDestroy: runInOrder(onDestroys) } : {}),
    ...(hasOnRowsRemoved ? { onRowsRemoved: runInOrder(onRowsRemoveds) } : {}),
  };
}

/**
 * Collapses several features into one `createTable()` argument, the escape hatch for the
 * type-level 15-feature cap.
 *
 * @remarks
 * Inner features see the arguments before the composite plus earlier inner features; a later
 * argument sees the whole composite.
 *
 * @example
 * createTable(data, { trackBy: 'id', columns }, composeFeatures(withSelection(), withTree()));
 *
 * @see docs/1-state/architecture.md
 */
export const composeFeatures = ((
  ...features: readonly AnyTableFeature[]
): AnyTableFeature => {
  const composite: AnyTableFeature = (input) => foldInnerFeatures(features, input);
  return Object.assign(composite, { displayName: 'composeFeatures' });
}) as ComposeFeaturesOverloads;
