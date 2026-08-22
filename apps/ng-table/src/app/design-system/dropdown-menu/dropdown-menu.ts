import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import type { DropdownMenuItem } from './dropdown-menu.types';

/** Typeahead keystrokes reset if the next one doesn't arrive within this window. */
const TYPEAHEAD_RESET_MS = 500;

/**
 * Floating menu panel — the shared surface behind Dropdown Pill and Select Trigger (spec:
 * `docs/spec.md`). Owns its own open/close motion, full keyboard model (roving tabindex,
 * Home/End, typeahead, Escape/Tab close), and outside-click dismissal. Does not position itself
 * relative to a trigger and does not decide when it opens — the caller sets `open` and renders
 * this inside a positioned wrapper (`docs/decisions.md`).
 */
@Component({
  selector: 'ngpt-dropdown-menu',
  templateUrl: './dropdown-menu.html',
  styleUrl: './dropdown-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideCheck })],
  host: {
    role: 'menu',
    '[attr.data-open]': 'open() || null',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class DropdownMenu {
  readonly items = input<readonly DropdownMenuItem[]>([]);
  readonly open = input<boolean>(false);

  readonly select = output<string>();
  readonly closed = output<void>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly optionElements = viewChildren<ElementRef<HTMLElement>>('optionElement');

  /** Id of the option currently carrying roving `tabindex="0"` / DOM focus; `null` while closed. */
  protected readonly highlightedId = signal<string | null>(null);

  private readonly enabledItems = computed<readonly DropdownMenuItem[]>(() =>
    this.items().filter((item) => !item.disabled),
  );

  private typeaheadBuffer = '';
  private typeaheadTimeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.focusInitialOption();
      } else {
        this.highlightedId.set(null);
      }
    });

    inject(DestroyRef).onDestroy(() => clearTimeout(this.typeaheadTimeoutId));
  }

  /** New group starts at `index` when its `group` differs from the previous item's. */
  protected isGroupStart(item: DropdownMenuItem, index: number): boolean {
    if (item.group === undefined) {
      return false;
    }
    return this.items()[index - 1]?.group !== item.group;
  }

  protected optionRole(item: DropdownMenuItem): 'menuitem' | 'menuitemradio' {
    return item.selected === undefined ? 'menuitem' : 'menuitemradio';
  }

  protected onOptionClick(item: DropdownMenuItem): void {
    if (item.disabled) {
      return;
    }
    this.commit(item);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlight(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.highlightAt(0);
        break;
      case 'End':
        event.preventDefault();
        this.highlightAt(this.enabledItems().length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.commitHighlighted();
        break;
      case 'Escape':
        event.preventDefault();
        this.closed.emit();
        break;
      case 'Tab':
        this.closed.emit();
        break;
      default:
        if (event.key.length === 1) {
          this.typeahead(event.key);
        }
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && !this.elementRef.nativeElement.contains(target)) {
      this.closed.emit();
    }
  }

  private focusInitialOption(): void {
    const enabled = this.enabledItems();
    if (enabled.length === 0) {
      return;
    }
    const initial = enabled.find((item) => item.selected) ?? enabled[0];
    this.highlightedId.set(initial.id);
    this.focusOption(initial.id);
  }

  private moveHighlight(delta: number): void {
    const enabled = this.enabledItems();
    if (enabled.length === 0) {
      return;
    }
    const currentIndex = enabled.findIndex((item) => item.id === this.highlightedId());
    const nextIndex = (currentIndex + delta + enabled.length) % enabled.length;
    this.highlightAt(nextIndex);
  }

  private highlightAt(index: number): void {
    const item = this.enabledItems().at(index);
    if (!item) {
      return;
    }
    this.highlightedId.set(item.id);
    this.focusOption(item.id);
  }

  private commitHighlighted(): void {
    const id = this.highlightedId();
    const item = this.items().find((candidate) => candidate.id === id);
    if (item) {
      this.commit(item);
    }
  }

  private commit(item: DropdownMenuItem): void {
    this.highlightedId.set(item.id);
    this.select.emit(item.id);
    this.closed.emit();
  }

  private typeahead(char: string): void {
    clearTimeout(this.typeaheadTimeoutId);
    this.typeaheadBuffer += char.toLowerCase();
    this.typeaheadTimeoutId = setTimeout(() => {
      this.typeaheadBuffer = '';
    }, TYPEAHEAD_RESET_MS);

    const enabled = this.enabledItems();
    const currentIndex = enabled.findIndex((item) => item.id === this.highlightedId());
    const searchOrder = [...enabled.slice(currentIndex + 1), ...enabled.slice(0, currentIndex + 1)];
    const match = searchOrder.find((item) => item.label.toLowerCase().startsWith(this.typeaheadBuffer));
    if (match) {
      this.highlightedId.set(match.id);
      this.focusOption(match.id);
    }
  }

  private focusOption(id: string): void {
    const index = this.items().findIndex((item) => item.id === id);
    this.optionElements().at(index)?.nativeElement.focus();
  }
}
