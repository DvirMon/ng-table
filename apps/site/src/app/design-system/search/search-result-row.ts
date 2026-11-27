import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCornerDownLeft, lucideFile, lucideHash } from '@ng-icons/lucide';
import { createTrackedPointer } from './search-overlay.utils';
import type { SearchResultRecord, SearchTreeConnector } from './search.types';

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
    '[attr.title]': 'result().breadcrumb',
    '[attr.data-active]': "active() ? '' : null",
    '(mouseenter)': 'onPointerEnter($event)',
    '(mousemove)': 'onPointerMove($event)',
    '(click)': 'selectResult.emit(result())',
  },
})
export class SearchResultRow {
  readonly result = input.required<SearchResultRecord>();
  readonly active = input(false, { transform: booleanAttribute });
  readonly tree = input<SearchTreeConnector>('none');

  readonly activate = output<string>();
  readonly selectResult = output<SearchResultRecord>();

  protected readonly rowId = computed(() => `search-result-${this.result().id}`);

  /**
   * Branch sits at the row's vertical middle (y=28 of 56). The trunk starts above the row and,
   * unless closing, runs past its bottom so it meets the next row across the gap.
   */
  protected readonly treePath = computed(() =>
    this.tree() === 'close' ? 'M8 -4v32M20 28H8.3' : 'M8 -4v64M20 28H8.3',
  );

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
