import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import type { ProseMeasure } from './prose.types';

/**
 * Typographic layer for arbitrary projected article markup — headings, lists, blockquote, hr,
 * strong/em, and heading anchor links. Attribute-hosted (ADR-0005) on the consumer's own
 * `<article>` (a standalone doc page) or `<div>` (a prose run inside a larger section).
 *
 * The one `ViewEncapsulation.None` component in this build (CONVENTIONS.md #9) and it stays that
 * way after the attribute-host conversion: projected nodes carry the *declaring* component's
 * encapsulation id, so under emulated encapsulation no `:host h2` rule here could ever match
 * content delivered through `<ng-content>`. Changing the host element does not change that.
 * Because every rule is therefore global, the static `class: 'ngpt-prose'` below is what scopes
 * them — every selector in `prose.css` is written under `.ngpt-prose`. Neither is removable; see
 * docs/decisions.md § "Encapsulation and class scoping survive the conversion".
 *
 * Does not restyle inline `<code>`/`<a>` — consumers author `<ngpt-code-chip>` /
 * `<ngpt-inline-link>` directly inside the projected content instead. See docs/decisions.md.
 */
@Component({
  selector: 'article[ngptProse], div[ngptProse]',
  templateUrl: './prose.html',
  styleUrl: './prose.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ngpt-prose',
    '[attr.data-measure]': 'measure()',
  },
})
export class Prose {
  readonly measure = input<ProseMeasure>('default');
}
