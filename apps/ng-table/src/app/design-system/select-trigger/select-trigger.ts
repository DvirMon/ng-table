import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu';
import type { DropdownMenuItem } from '../dropdown-menu/dropdown-menu.types';
import { withSelection } from './select-trigger.utils';

/** Gives every instance a stable, collision-free id for the `aria-controls` wiring below. */
let nextInstanceId = 0;

/**
 * Select-style combobox trigger (spec: `docs/spec.md`). Owns the trigger button and its own
 * open/closed state; renders `ngpt-dropdown-menu` as the option list and positions it (that
 * component only owns the floating box itself, not its placement — its own `docs/decisions.md`).
 * Role model deviates from a literal `role="listbox"` combobox — see `docs/decisions.md`.
 */
@Component({
  selector: 'ngpt-select-trigger',
  templateUrl: './select-trigger.html',
  styleUrl: './select-trigger.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DropdownMenu, NgIcon],
  viewProviders: [provideIcons({ lucideChevronDown })],
  host: {
    '[attr.data-open]': 'open() || null',
    '[attr.data-filled]': 'selectedLabel() ? "" : null',
  },
})
export class SelectTrigger {
  readonly options = input<readonly DropdownMenuItem[]>([]);
  readonly value = input<string>();
  readonly placeholder = input<string>('Select an option');

  readonly valueChange = output<string>();

  protected readonly open = signal(false);
  protected readonly menuId = `ngpt-select-trigger-menu-${nextInstanceId++}`;

  private readonly triggerButton = viewChild<ElementRef<HTMLButtonElement>>('triggerButton');

  protected readonly items = computed<readonly DropdownMenuItem[]>(() =>
    withSelection(this.options(), this.value()),
  );

  protected readonly selectedLabel = computed<string | undefined>(
    () => this.options().find((option) => option.id === this.value())?.label,
  );

  protected onTriggerClick(event: MouseEvent): void {
    // Stops the click from reaching dropdown-menu's `(document:click)` outside-click listener
    // in the same tick it opens — see docs/decisions.md "outside-click race".
    event.stopPropagation();
    this.open.update((isOpen) => !isOpen);
  }

  protected onSelect(id: string): void {
    this.valueChange.emit(id);
  }

  protected onClosed(): void {
    this.open.set(false);
    this.triggerButton()?.nativeElement.focus();
  }
}
