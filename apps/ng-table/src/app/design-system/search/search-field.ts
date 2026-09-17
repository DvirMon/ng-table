import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { Kbd } from '../kbd/kbd';
import type { SearchFieldVariant } from './search.types';

/**
 * Navbar search trigger. Attribute-hosted on the consumer's `<button>` (ADR-0005) — the host **is**
 * the button, so no wrapper ships and native click/Enter/Space/focus need no re-plumbing.
 *
 * `<button>` only, never `<a>` and never an `<input>`: it opens the overlay rather than navigating,
 * and the real query input lives in `ngpt-search-overlay`, so there is exactly one focusable text
 * field for the query.
 *
 * The icon + placeholder + ⌘K chip stay in this template — this is a pre-composed widget whose
 * fixed content is its identity, and the glyph is chosen here, so the local `provideIcons`
 * registration stays too (ADR-0004).
 *
 * No `open` output: the consumer binds the native `(click)`. See `docs/decisions.md`.
 */
@Component({
  selector: 'button[ngptSearchField]',
  templateUrl: './search-field.html',
  styleUrl: './search-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, Kbd],
  viewProviders: [provideIcons({ lucideSearch })],
  host: {
    'aria-label': 'Search docs',
    'aria-haspopup': 'dialog',
    'aria-keyshortcuts': 'Meta+K',
    '[attr.data-variant]': 'variant()',
    '[attr.aria-expanded]': 'open()',
  },
})
export class SearchField {
  readonly variant = input<SearchFieldVariant>('default');
  readonly open = input<boolean>(false);

  constructor() {
    // A bare <button> defaults to type="submit" inside a form, which a search trigger never wants.
    // Set as a default rather than a host binding so a consumer's own type still wins.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (!host.hasAttribute('type')) {
      host.setAttribute('type', 'button');
    }
  }
}
