import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { TabItem } from './tab-switcher.types';

/**
 * Two-way segmented control (e.g. Preview/Source). Roving-tabindex tablist with
 * manual activation: ArrowLeft/ArrowRight move focus between tabs, Enter/Space
 * (or click) activates the focused tab. See docs/decisions.md for why manual
 * activation was chosen over selection-follows-focus.
 */
@Component({
  selector: 'ngpt-tab-switcher',
  templateUrl: './tab-switcher.html',
  styleUrl: './tab-switcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'tablist',
  },
})
export class TabSwitcher {
  readonly tabs = input<readonly TabItem[]>();
  readonly selected = input<string>();
  readonly selectedChange = output<string>();

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  private readonly focusedId = signal<string | undefined>(undefined);

  protected readonly items = computed<readonly TabItem[]>(() => this.tabs() ?? []);

  /** The single tab that sits in the natural tab order (roving tabindex). */
  protected readonly focusableId = computed<string | undefined>(() => {
    const list = this.items();
    const preferred = this.focusedId() ?? this.selected();
    const match = list.find((tab) => tab.id === preferred);
    return (match ?? list[0])?.id;
  });

  protected activate(tab: TabItem): void {
    this.focusedId.set(tab.id);
    this.selectedChange.emit(tab.id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const list = this.items();
    if (list.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.moveFocus(list, index, 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveFocus(list, index, -1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.activate(list[index]);
        break;
    }
  }

  private moveFocus(list: readonly TabItem[], index: number, delta: number): void {
    const nextIndex = (index + delta + list.length) % list.length;
    const nextTab = list[nextIndex];
    this.focusedId.set(nextTab.id);
    this.tabButtons()[nextIndex]?.nativeElement.focus();
  }
}
