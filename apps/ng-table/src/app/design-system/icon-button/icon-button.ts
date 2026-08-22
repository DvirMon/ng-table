import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideArrowUp,
  lucideCheck,
  lucideChevronDown,
  lucideCopy,
  lucideInfo,
  lucideLightbulb,
  lucideMenu,
  lucideSearch,
  lucideTriangleAlert,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import type { IconButtonSize, IconButtonState } from './icon-button.types';

@Component({
  selector: 'ngpt-icon-button',
  imports: [NgIcon],
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideArrowUp,
      lucideCheck,
      lucideChevronDown,
      lucideCopy,
      lucideInfo,
      lucideLightbulb,
      lucideMenu,
      lucideSearch,
      lucideTriangleAlert,
      lucideX,
      lucideZap,
    }),
  ],
  host: {
    '[attr.data-size]': 'size()',
    '[attr.data-copy-state]': 'state()',
  },
})
export class IconButton {
  readonly icon = input<string>();
  readonly label = input<string>();
  readonly size = input<IconButtonSize>(30);
  readonly state = input<IconButtonState>('idle');

  readonly pressed = output<void>();

  /** Non-empty only for the confirmation states — doubles as the polite live-region text. */
  protected readonly confirmationMessage = computed<string>(() => {
    switch (this.state()) {
      case 'copied':
        return 'Copied';
      case 'failed':
        return 'Copy failed, select manually';
      case 'idle':
        return '';
    }
  });

  protected readonly displayIcon = computed<string | undefined>(() => {
    switch (this.state()) {
      case 'copied':
        return 'lucideCheck';
      case 'failed':
        return 'lucideTriangleAlert';
      case 'idle':
        return this.icon();
    }
  });

  protected readonly accessibleLabel = computed<string | undefined>(
    () => this.confirmationMessage() || this.label(),
  );

  protected onPressed(): void {
    this.pressed.emit();
  }
}
