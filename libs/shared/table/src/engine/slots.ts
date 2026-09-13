import type { TableStore } from '../api/types';
import type { PipelineStage } from './pipeline';
import type { RenderStage } from './render-stages';

/** ADR-0005: the one core member a feature may override. */
type OverridableCoreKey = 'totalRowCount';
type ClaimedCoreKey = Exclude<keyof TableStore<unknown>, OverridableCoreKey>;

/**
 * Identity, but the parameter type collapses to `never` unless `keys` covers every claimed
 * core member — the completeness check `satisfies` alone cannot express, since it only
 * validates each entry rather than the list as a whole. Add a non-overridable member to
 * `TableStore` without listing it below and this call stops compiling.
 */
function exhaustiveCoreMemberKeys<const Keys extends readonly ClaimedCoreKey[]>(
  keys: Exclude<ClaimedCoreKey, Keys[number]> extends never ? Keys : never
): Keys {
  return keys;
}

/** Core store members the engine claims before any feature folds. */
export const CORE_MEMBER_KEYS = exhaustiveCoreMemberKeys([
  'columns',
  'rows',
  'trackBy',
  'value',
  'renderRows',
  'indexById',
]);

/** The owner name core members are registered under, for collision messages. */
const CORE_CLAIMANT = 'core';

/** Names a consumer feature by its 1-based argument position, for collision messages. */
export function describeFeature(position: number, displayName?: string): string {
  const base = `feature ${position}`;
  return displayName ? `${base} (${displayName})` : base;
}

/** Names an engine-internal feature (e.g. column-schema wiring) that never has a consumer position. */
export function describeInternalFeature(position: number): string {
  return `internal feature ${position}`;
}

/** Names a feature nested inside `composeFeatures()` by its 1-based position within the
 * composite. The composite's own argument position is not known at runtime — a `Feature`
 * receives only the store — so the label names the composite by kind. */
export function describeInnerFeature(position: number, displayName?: string): string {
  const base = `composeFeatures inner feature ${position}`;
  return displayName ? `${base} (${displayName})` : base;
}

/**
 * Tracks which feature claimed each single-occupancy slot, so a collision can name both sides.
 * Under the previous `@ngrx/signals` engine features injected behavior by mutating a shared
 * slot, and a second claimant silently won by array order (ADR-0003).
 */
export class SlotRegistry {
  private readonly ownerByStage = new Map<PipelineStage, string>();
  private readonly ownerByRenderStage = new Map<RenderStage, string>();
  private readonly ownerByMember = new Map<string, string>();

  private claim<TKey>(
    owners: Map<TKey, string>,
    key: TKey,
    claimant: string,
    describeCollision: (currentOwner: string, claimant: string) => string
  ): void {
    const currentOwner = owners.get(key);
    const isAlreadyClaimed = currentOwner !== undefined;
    if (isAlreadyClaimed) {
      throw new Error(describeCollision(currentOwner, claimant));
    }
    owners.set(key, claimant);
  }

  claimStage(stage: PipelineStage, feature: string): void {
    this.claim(
      this.ownerByStage,
      stage,
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the "${stage}" ` +
        'pipeline stage. Only one feature may provide each stage.'
    );
  }

  /** ADR-0011: named-stage collision replaces the old whole-layer `claimRenderRows()`. */
  claimRenderStage(stage: RenderStage, feature: string): void {
    this.claim(
      this.ownerByRenderStage,
      stage,
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the "${stage}" ` +
        'render stage. Only one feature may provide each render stage.'
    );
  }

  /**
   * ADR-0007. Members are merged with `Object.assign`, so without this the later feature wins
   * silently and the earlier one's state signal is orphaned — still written by its own closures,
   * read by nobody. Quieter than a stage collision (which at least produces visibly wrong rows),
   * so it throws for the same reason the other two do.
   */
  claimMember(key: string, feature: string): void {
    this.claim(
      this.ownerByMember,
      key,
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the "${key}" ` +
        'store member. Only one feature may provide each member.'
    );
  }

  /**
   * Claims every non-overridable core member, so a feature declaring one collides at
   * construction like any other member clash rather than shadowing the engine's own.
   */
  claimCoreMembers(): void {
    for (const key of CORE_MEMBER_KEYS) {
      this.claimMember(key, CORE_CLAIMANT);
    }
  }
}
