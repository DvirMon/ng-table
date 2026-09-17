import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<div>` (ADR-0005). Home's six-cell feature grid: the
 * consumer authors each cell with `ngptFeatureGridTitle`/`ngptFeatureGridText` (directive-per-part,
 * `docs/decisions.md`), this owns only the track formula and the gap.
 *
 * Page-local, not a DS component — no cell primitive, because a cell has no box of its own
 * (no cards, borders or tint per spec). Icons were added per explicit user request
 * (`docs/decisions.md`, 2026-08-23); this component stays icon-agnostic — the consumer
 * (`home.html`) authors the `<ng-icon>` and registers it locally.
 */
@Component({
  selector: 'div[ngptHomeFeatureGrid]',
  templateUrl: './feature-grid.html',
  styleUrl: './feature-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureGrid {}
