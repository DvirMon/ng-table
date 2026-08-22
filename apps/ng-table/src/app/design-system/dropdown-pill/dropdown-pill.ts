import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu';
import type { DropdownMenuItem } from '../dropdown-menu/dropdown-menu.types';
import { PillButton } from '../pill-button/pill-button';

/**
 * Pill-styled trigger that opens a `ngpt-dropdown-menu` (spec: `docs/spec.md`). Owns the trigger
 * pill's own border/text treatment (default/hover/focus/open) and forwards `items` straight
 * through to the menu; does not own the menu itself (`does_not_own`).
 *
 * `label` is static trigger text, not the selected item's label — that reactive-value behavior
 * belongs to `select-trigger`'s combobox contract, not this menu-style trigger (`docs/decisions.md`).
 *
 * `ngpt-pill-button` renders its own inner `<button>` and has no ARIA/focus passthrough for it, so
 * `aria-haspopup`/`aria-expanded` are synced onto that real button imperatively via `triggerButton()`
 * rather than bound in the template (`docs/decisions.md`).
 */
@Component({
  selector: 'ngpt-dropdown-pill',
  templateUrl: './dropdown-pill.html',
  styleUrl: './dropdown-pill.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PillButton, DropdownMenu, NgIcon],
  viewProviders: [provideIcons({ lucideChevronDown })],
  host: {
    '[attr.data-open]': 'open() || null',
  },
})
export class DropdownPill {
  readonly items = input<readonly DropdownMenuItem[]>([]);
  readonly label = input<string>('');

  readonly select = output<string>();

  protected readonly open = signal<boolean>(false);

  private readonly triggerHost = viewChild<ElementRef<HTMLElement>>('trigger', { read: ElementRef });

  constructor() {
    effect(() => {
      const button = this.triggerButton();
      if (!button) {
        return;
      }
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', this.open() ? 'true' : 'false');
    });
  }

  protected onTriggerClick(event: MouseEvent): void {
    // dropdown-menu's own (document:click) listener would otherwise see this same click bubble to
    // document and immediately treat it as "outside", closing the menu it just opened
    // (dropdown-menu/docs/decisions.md § Outside-click integration note). Stopping propagation here
    // keeps the click from ever reaching that listener.
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  protected onSelect(id: string): void {
    this.select.emit(id);
    this.close();
  }

  protected onClosed(): void {
    this.close();
  }

  private close(): void {
    this.open.set(false);
    this.triggerButton()?.focus();
  }

  /** The real `<button>` pill-button renders internally — its DOM structure is a fixed contract
   *  (CONVENTIONS.md: "renders `<button>`"), not a guess. */
  private triggerButton(): HTMLButtonElement | null {
    return this.triggerHost()?.nativeElement.querySelector<HTMLButtonElement>('button') ?? null;
  }
}
