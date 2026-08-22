import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FeatureCell } from './feature-grid.types';

/**
 * Home's six-cell feature grid: `title` + `description` per cell, no cards/borders/icons —
 * the grid gap alone carries the separation. Layout only; the section eyebrow/H2/paragraph
 * above it is owned by the page composition (home.html), not this component.
 */
@Component({
  selector: 'ngpt-home-feature-grid',
  templateUrl: './feature-grid.html',
  styleUrl: './feature-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGrid {
  readonly features = input<readonly FeatureCell[]>();

  protected readonly cells = computed<readonly FeatureCell[]>(() => this.features() ?? []);
}
