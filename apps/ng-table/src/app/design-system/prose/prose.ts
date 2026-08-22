import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import type { ProseMeasure } from './prose.types';

/**
 * Typographic wrapper for arbitrary projected article markup — headings, lists, blockquote,
 * hr, strong/em, and heading anchor links. The one `ViewEncapsulation.None` component in this
 * build (CONVENTIONS.md #8): view encapsulation can't reach content delivered through
 * `<ng-content>`, and this component exists specifically to style that content. Every selector
 * in `prose.css` is scoped under the `.ngpt-prose` host class so these global-scope rules never
 * leak onto markup outside this component.
 *
 * Does not restyle inline `<code>`/`<a>` — consumers author `<ngpt-code-chip>` /
 * `<ngpt-inline-link>` directly inside the projected content instead. See docs/decisions.md.
 */
@Component({
  selector: 'ngpt-prose',
  templateUrl: './prose.html',
  styleUrl: './prose.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'ngpt-prose',
    '[attr.data-measure]': 'measure()',
  },
})
export class Prose {
  readonly measure = input<ProseMeasure>('default');
}
