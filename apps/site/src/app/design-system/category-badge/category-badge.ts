import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<span>` — the old `ngpt-category-badge` was a non-semantic
 * custom element that existed only to style a text run, which ADR-0005 rules out.
 *
 * `<span>` only: the spec's a11y note ("purely visual; do not use as the accessible heading")
 * makes a semantics-free host the point. No inputs: projected text only.
 */
@Component({
  selector: 'span[ngptCategoryBadge]',
  templateUrl: './category-badge.html',
  styleUrl: './category-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBadge {}
