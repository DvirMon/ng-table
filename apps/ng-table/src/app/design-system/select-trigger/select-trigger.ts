import { ChangeDetectionStrategy, Component, TemplateRef, computed, effect, input, output, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { NgpMenuTrigger, injectMenuTriggerState } from 'ng-primitives/menu';
import type { NgpOverlayTemplateContext } from 'ng-primitives/portal';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu';
import type { DropdownMenuItem } from '../dropdown-menu/dropdown-menu.types';
import { withSelection } from './select-trigger.utils';

/**
 * Select-style combobox trigger (spec: `docs/spec.md`). Host is the real `<button>` itself
 * (`button[ngptSelectTrigger]`) so `[ngpMenuTrigger]` (hostDirectives) lands `aria-haspopup` /
 * `aria-expanded` / `aria-controls` on the actual focusable element; `role="combobox"` stays a
 * manual static attribute — the primitive is role-agnostic, only the ARIA menu-open state is its
 * job. Renders `ngpt-dropdown-menu` as the option list inside its own `<ng-template>`.
 * Role model deviates from a literal `role="listbox"` combobox — see `docs/decisions.md`.
 */
@Component({
  selector: 'button[ngptSelectTrigger]',
  templateUrl: './select-trigger.html',
  styleUrl: './select-trigger.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DropdownMenu, NgIcon],
  hostDirectives: [NgpMenuTrigger],
  viewProviders: [provideIcons({ lucideChevronDown })],
  host: {
    type: 'button',
    role: 'combobox',
    class: 'select-trigger',
    '[attr.data-open]': 'open() || null',
    '[attr.data-filled]': 'selectedLabel() ? "" : null',
  },
})
export class SelectTrigger {
  readonly options = input<readonly DropdownMenuItem[]>([]);
  readonly value = input<string>();
  readonly placeholder = input<string>('Select an option');

  readonly valueChange = output<string>();

  private readonly menu = viewChild.required<TemplateRef<NgpOverlayTemplateContext<unknown>>>('menu');
  private readonly triggerState = injectMenuTriggerState();

  protected readonly open = computed<boolean>(() => this.triggerState().open());

  protected readonly items = computed<readonly DropdownMenuItem[]>(() =>
    withSelection(this.options(), this.value()),
  );

  protected readonly selectedLabel = computed<string | undefined>(
    () => this.options().find((option) => option.id === this.value())?.label,
  );

  constructor() {
    effect(() => this.triggerState().setMenu(this.menu()));
  }

  protected onSelect(id: string): void {
    this.valueChange.emit(id);
  }
}
