import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Title part of a feature-grid cell, attribute-hosted on the consumer's `<h3>` (directive-per-part,
 * `docs/decisions.md`). Styles its own host — no descendant reach needed, so this stays under
 * default encapsulation, unlike the `ViewEncapsulation.None` it replaces.
 */
@Component({
  selector: 'h3[ngptFeatureGridTitle]',
  templateUrl: './feature-grid-title.html',
  styleUrl: './feature-grid-title.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGridTitle {}
