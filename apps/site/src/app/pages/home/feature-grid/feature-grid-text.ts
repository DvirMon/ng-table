import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Description part of a feature-grid cell, attribute-hosted on the consumer's `<p>`
 * (directive-per-part, `docs/decisions.md`). Styles its own host only, default encapsulation.
 */
@Component({
  selector: 'p[ngptFeatureGridText]',
  templateUrl: './feature-grid-text.html',
  styleUrl: './feature-grid-text.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGridText {}
