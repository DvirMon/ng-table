import type { PipelineStage } from './pipeline';

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
  private renderRowsOwner: string | undefined;

  claimStage(stage: PipelineStage, feature: string): void {
    const currentOwner = this.ownerByStage.get(stage);
    const isAlreadyClaimed = currentOwner !== undefined;
    if (isAlreadyClaimed) {
      throw new Error(
        `[createTable] ${currentOwner} and ${feature} both provide the "${stage}" ` +
          'pipeline stage. Only one feature may provide each stage.'
      );
    }
    this.ownerByStage.set(stage, feature);
  }

  claimRenderRows(feature: string): void {
    const isAlreadyClaimed = this.renderRowsOwner !== undefined;
    if (isAlreadyClaimed) {
      throw new Error(
        `[createTable] ${this.renderRowsOwner} and ${feature} both provide ` +
          '`renderRows`. Only one feature may override how render rows are built.'
      );
    }
    this.renderRowsOwner = feature;
  }
}
