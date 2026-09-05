import type { PipelineStage } from './pipeline';
import type { RenderStage } from './render-stages';

/** Names a feature by its position in the `features` array, for collision messages. */
export function describeFeature(index: number): string {
  return `features[${index}]`;
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
}
