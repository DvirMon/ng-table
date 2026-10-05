import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHistory, lucideStar, lucideX } from '@ng-icons/lucide';
import { IconButton } from '../icon-button/icon-button';
import { FillIconOnHover } from './fill-icon-on-hover';
import { createTrackedPointer } from './search-overlay.utils';
import type { RecentSearchEntry } from './search.types';

/**
 * One `role="option"` row in the recent-searches listbox. Host IS the `<li>` (ADR-0005
 * attribute-hosted test) — no wrapper ships. Save/remove buttons stop propagation internally so
 * their click never also fires the row's own `selectEntry`.
 */
@Component({
  selector: 'li[ngptSearchRecentRow]',
  templateUrl: './search-recent-row.html',
  styleUrl: './search-recent-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, IconButton, FillIconOnHover],
  viewProviders: [provideIcons({ lucideHistory, lucideStar, lucideX })],
  host: {
    role: 'option',
    '[attr.id]': 'rowId()',
    '[attr.aria-selected]': 'active()',
    '[attr.data-active]': "active() ? '' : null",
    '(mouseenter)': 'onPointerEnter($event)',
    '(mousemove)': 'onPointerMove($event)',
    '(click)': 'selectEntry.emit(entry())',
  },
})
export class SearchRecentRow {
  readonly entry = input.required<RecentSearchEntry>();
  readonly active = input(false, { transform: booleanAttribute });

  readonly activate = output<string>();
  readonly selectEntry = output<RecentSearchEntry>();
  readonly save = output<void>();
  readonly remove = output<void>();

  protected readonly rowId = computed(() => `search-result-${this.entry().id}`);

  private readonly pointer = createTrackedPointer();

  /** Seeds the pointer baseline only — doesn't activate, so a scroll-under-cursor enter is a no-op. */
  protected onPointerEnter(event: MouseEvent): void {
    this.pointer.update(event);
  }

  protected onPointerMove(event: MouseEvent): void {
    if (this.pointer.wasMoved(event)) {
      this.activate.emit(this.entry().id);
    }
  }

  protected onSaveButtonClick(event: Event): void {
    event.stopPropagation();
    this.save.emit();
  }

  protected onRemoveButtonClick(event: Event): void {
    event.stopPropagation();
    this.remove.emit();
  }
}
