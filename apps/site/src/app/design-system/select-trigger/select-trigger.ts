import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { NgpMenuTrigger } from 'ng-primitives/menu';
import type { NgpOverlayTemplateContext } from 'ng-primitives/portal';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu';
import type { DropdownMenuItem } from '../dropdown-menu/dropdown-menu.types';
import { withMenuTriggerPanel } from '../dropdown-menu/with-menu-trigger-panel';
import { withSelection } from './select-trigger.utils';

/**
 * Select-style menu-button trigger (spec: `docs/spec.md`). Host is the real `<button>` itself
 * (`button[ngptSelectTrigger]`) so `[ngpMenuTrigger]` (hostDirectives) lands `aria-haspopup` /
 * `aria-expanded` / `aria-controls` on the actual focusable element. No `role="combobox"` — the
 * popup it opens is `ngpt-dropdown-menu` (`role="menu"`), and ARIA's combobox contract requires
 * a listbox/tree/grid/dialog popup, so this follows the same Menu Button pattern as
 * `dropdown-pill` instead. See `docs/decisions.md`.
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
    class: 'select-trigger',
    '[attr.data-open]': 'open() || null',
    '[attr.data-filled]': 'selectedLabel() ? "" : null',
  },
})
export class SelectTrigger {
  readonly items = input<readonly DropdownMenuItem[]>([]);
  readonly value = input<string>();
  readonly placeholder = input<string>('Select an option');

  readonly valueChange = output<string>();

  private readonly menu =
    viewChild.required<TemplateRef<NgpOverlayTemplateContext<unknown>>>('menu');

  protected readonly open = withMenuTriggerPanel(this.menu).open;

  protected readonly menuItems = computed<readonly DropdownMenuItem[]>(() =>
    withSelection(this.items(), this.value()),
  );

  protected readonly selectedLabel = computed<string | undefined>(
    () => this.items().find((option) => option.id === this.value())?.label,
  );

  protected onSelect(id: string): void {
    this.valueChange.emit(id);
  }
}
