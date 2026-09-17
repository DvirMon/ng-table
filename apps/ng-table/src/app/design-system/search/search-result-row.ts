import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCornerDownLeft, lucideFile, lucideHash } from '@ng-icons/lucide';
import { createTrackedPointer } from './search-overlay.utils';
import type { SearchResultRecord } from './search.types';

/**
 * One `role="option"` row in the results listbox. Host IS the `<li>` (ADR-0005 attribute-hosted
 * test: root is a semantic list item compensated by `role="option"`) — no wrapper ships.
 */
@Component({
  selector: 'li[ngptSearchResultRow]',
  templateUrl: './search-result-row.html',
  styleUrl: './search-result-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideFile, lucideHash, lucideCornerDownLeft })],
  host: {
    role: 'option',
    '[attr.id]': 'rowId()',
    '[attr.aria-selected]': 'active()',
    '[attr.data-active]': "active() ? '' : null",
    '(mouseenter)': 'onPointerEnter($event)',
    '(mousemove)': 'onPointerMove($event)',
    '(click)': 'selectResult.emit(result())',
  },
})
export class SearchResultRow {
  readonly result = input.required<SearchResultRecord>();
  readonly active = input(false, { transform: booleanAttribute });
  /** Last heading in its consecutive run — closes the tree connector's trunk instead of continuing it. */
  readonly last = input(false, { transform: booleanAttribute });

  readonly activate = output<string>();
  readonly selectResult = output<SearchResultRecord>();

  protected readonly rowId = computed(() => `search-result-${this.result().id}`);
  /** DocSearch reference paths (verified live): trunk continues past the branch unless closing. */
  protected readonly treePath = computed(() => (this.last() ? 'M8 6v21M20 27H8.3' : 'M8 6v42M20 27H8.3'));

  private readonly pointer = createTrackedPointer();

  /** Seeds the pointer baseline only — doesn't activate, so a scroll-under-cursor enter is a no-op. */
  protected onPointerEnter(event: MouseEvent): void {
    this.pointer.update(event);
  }

  protected onPointerMove(event: MouseEvent): void {
    if (this.pointer.wasMoved(event)) {
      this.activate.emit(this.result().id);
    }
  }
}
