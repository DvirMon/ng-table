import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<div>` (ADR-0005). Home's six-cell feature grid: the
 * consumer authors each `<article><h3>…</h3><p>…</p></article>`, this owns only the track formula,
 * the gap, and the cells' prose-scale typography.
 *
 * Page-local, not a DS component — no cell primitive, because a cell has no box of its own
 * (no cards, borders, icons or tint per spec).
 *
 * `ViewEncapsulation.None` for the same reason `prose` needs it (CONVENTIONS.md #8): the cells are
 * projected, and emulated encapsulation stamps projected nodes with the *declaring* component's id,
 * so a descendant selector from here would never match them. Every rule in `feature-grid.css` is
 * scoped under the `.ngpt-home-feature-grid` host class so these global-scope rules cannot leak.
 */
@Component({
  selector: 'div[ngptHomeFeatureGrid]',
  templateUrl: './feature-grid.html',
  styleUrl: './feature-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'ngpt-home-feature-grid',
  },
})
export class FeatureGrid {}
