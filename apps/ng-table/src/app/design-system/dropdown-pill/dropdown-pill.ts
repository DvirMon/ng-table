import { ChangeDetectionStrategy, Component, TemplateRef, computed, effect, input, output, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { NgpMenuTrigger, injectMenuTriggerState } from 'ng-primitives/menu';
import type { NgpOverlayTemplateContext } from 'ng-primitives/portal';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu';
import type { DropdownMenuItem } from '../dropdown-menu/dropdown-menu.types';

/**
 * Pill-styled trigger that opens a `ngpt-dropdown-menu` (spec: `docs/spec.md`). Host is the real
 * `<button>` itself (`button[ngptDropdownPill]`, styled inline rather than composing
 * `ngptPillButton` — see `docs/decisions.md`) so `[ngpMenuTrigger]` (host directive) lands its
 * ARIA/focus wiring on the actual focusable element, not a wrapper.
 *
 * `label` is static trigger text, not the selected item's label — that reactive-value behavior
 * belongs to `select-trigger`'s combobox contract, not this menu-style trigger (`docs/decisions.md`).
 */
@Component({
  selector: 'button[ngptDropdownPill]',
  templateUrl: './dropdown-pill.html',
  styleUrl: './dropdown-pill.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DropdownMenu, NgIcon],
  hostDirectives: [NgpMenuTrigger],
  viewProviders: [provideIcons({ lucideChevronDown })],
  host: {
    type: 'button',
    class: 'dropdown-pill',
    '[attr.data-open]': 'open() || null',
  },
})
export class DropdownPill {
  readonly items = input<readonly DropdownMenuItem[]>([]);
  readonly label = input<string>('');

  readonly select = output<string>();

  private readonly menu = viewChild.required<TemplateRef<NgpOverlayTemplateContext<unknown>>>('menu');
  private readonly triggerState = injectMenuTriggerState();

  protected readonly open = computed<boolean>(() => this.triggerState().open());

  constructor() {
    effect(() => this.triggerState().setMenu(this.menu()));
  }

  protected onSelect(id: string): void {
    this.select.emit(id);
  }
}
