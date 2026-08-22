import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import type { SearchFieldVariant } from './search.types';

/**
 * Navbar search trigger. Renders as a `<button>`, never a text input — the real query input
 * lives in `ngpt-search-overlay`, so there is exactly one focusable text field for the query.
 */
@Component({
  selector: 'ngpt-search-field',
  templateUrl: './search-field.html',
  styleUrl: './search-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideSearch })],
  host: {
    '[attr.data-variant]': 'variant()',
  },
})
export class SearchField {
  readonly variant = input<SearchFieldVariant>('default');
  readonly open = output<void>();
}
