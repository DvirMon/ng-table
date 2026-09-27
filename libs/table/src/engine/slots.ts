import type { TableStore } from '../api/types';
import type { PipelineStage } from './pipeline';
import type { RenderStage } from './render-stages';

// Angular's global dev-mode flag. Declared locally because `tsconfig.lib.json` sets
// `"types": []`, so no ambient declaration is in scope. Module-scoped, so it cannot
// collide with another file's declaration. See `engine/stage-order.ts`.
declare const ngDevMode: boolean | undefined;

// `undefined` counts as on — only an explicit `false` disables the checks.
function isNgDevModeOff(): boolean {
  return typeof ngDevMode !== 'undefined' && !ngDevMode;
}

// The one core member a feature may override.
type OverridableCoreKey = 'totalRowCount';
type ClaimedCoreKey = Exclude<keyof TableStore<unknown>, OverridableCoreKey>;

// Note: identity, but the parameter collapses to `never` unless `keys` covers every claimed
// core member. `satisfies` checks each entry, not the list's completeness. Adding a
// non-overridable `TableStore` member without listing it below stops this call compiling.
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
  'renderColumns',
  'indexById',
  '__columnValues',
]);

// The owner name core members are registered under, for collision messages.
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

/** Tracks which feature claimed each single-occupancy slot, so a collision can name both sides. */
// docs/adr/0003-in-house-table-store-engine.md
export class SlotRegistry {
  private readonly ownerByStage = new Map<PipelineStage, string>();
  private readonly ownerByRenderStage = new Map<RenderStage, string>();
  private readonly ownerByMember = new Map<string, string>();
  private readonly ownerByParentLink = new Map<'parentLink', string>();

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

  /** Claims a pipeline stage; with `ngDevMode` off, a second claim replaces the first silently. */
  claimStage(stage: PipelineStage, feature: string): void {
    if (isNgDevModeOff()) {
      this.ownerByStage.set(stage, feature);
      return;
    }
    this.claim(
      this.ownerByStage,
      stage,
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the "${stage}" ` +
        'pipeline stage. Only one feature may provide each stage.'
    );
  }

  /** Claims a render stage; with `ngDevMode` off, a second claim replaces the first silently. */
  claimRenderStage(stage: RenderStage, feature: string): void {
    if (isNgDevModeOff()) {
      this.ownerByRenderStage.set(stage, feature);
      return;
    }
    this.claim(
      this.ownerByRenderStage,
      stage,
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the "${stage}" ` +
        'render stage. Only one feature may provide each render stage.'
    );
  }

  /** Claims a store member key; always throws on a second claim, dev mode or not. */
  claimMember(key: string, feature: string): void {
    // Note: members merge via `Object.assign`, so an unchecked clash lets the later feature win
    // silently and orphans the earlier one's state signal — written by its closures, read by
    // nobody — quieter than a stage clash, which at least shows wrong rows.
    this.claim(
      this.ownerByMember,
      key,
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the "${key}" ` +
        'store member. Only one feature may provide each member.'
    );
  }

  /** Claims the parent-link slot; always throws on a second claim, dev mode or not. */
  claimParentLink(feature: string): void {
    // Note: an unchecked duplicate silently nests every row by whichever feature folded last —
    // quieter than a stage clash, so no `ngDevMode` bypass, same as `claimMember`.
    this.claim(
      this.ownerByParentLink,
      'parentLink',
      feature,
      (currentOwner, claimant) =>
        `[createTable] ${currentOwner} and ${claimant} both provide the parent link. ` +
        'Only one feature may provide a parent link.'
    );
  }

  /** Claims every non-overridable core member, so a feature redeclaring one throws, not shadows. */
  claimCoreMembers(): void {
    for (const key of CORE_MEMBER_KEYS) {
      this.claimMember(key, CORE_CLAIMANT);
    }
  }
}
