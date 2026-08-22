import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { NgpMenu, NgpMenuItem, NgpMenuItemRadio, NgpMenuItemRadioGroup } from 'ng-primitives/menu';
import type { DropdownMenuItem } from './dropdown-menu.types';

/**
 * Menu content — the shared panel behind Dropdown Pill and Select Trigger (spec: `docs/spec.md`).
 * Rendered by the caller inside a `<ng-template>` bound to `[ngpMenuTrigger]`; the trigger owns
 * positioning, the portal, ARIA sync, focus trap/return, outside-click and Escape (all via
 * `ng-primitives/menu`). This component owns only the panel's box/motion and its item markup —
 * see `docs/decisions.md` for how the previous hand-rolled keyboard model maps onto the primitive.
 */
@Component({
  selector: 'ngpt-dropdown-menu',
  templateUrl: './dropdown-menu.html',
  styleUrl: './dropdown-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, NgpMenuItem, NgpMenuItemRadio, NgpMenuItemRadioGroup],
  hostDirectives: [NgpMenu],
  viewProviders: [provideIcons({ lucideCheck })],
})
export class DropdownMenu {
  readonly items = input<readonly DropdownMenuItem[]>([]);

  readonly select = output<string>();

  /** Drives `ngpMenuItemRadioGroup`'s controlled value — the id of whichever item is `selected`. */
  protected readonly currentValue = computed<string | null>(
    () => this.items().find((item) => item.selected)?.id ?? null,
  );

  protected onOptionClick(item: DropdownMenuItem): void {
    if (item.disabled) {
      return;
    }
    this.select.emit(item.id);
  }
}
