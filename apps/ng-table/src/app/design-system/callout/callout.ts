import { ChangeDetectionStrategy, Component, computed, input, type Signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideLightbulb, lucideTriangleAlert } from '@ng-icons/lucide';
import type { CalloutKind } from './callout.types';

/** Lucide icon per `CalloutKind`, per `docs/Iconography.md`'s callout mapping. */
const CALLOUT_ICON_NAME: Record<CalloutKind, string> = {
  note: 'lucideInfo',
  tip: 'lucideLightbulb',
  warning: 'lucideTriangleAlert',
};

@Component({
  selector: 'ngpt-callout',
  templateUrl: './callout.html',
  styleUrl: './callout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideInfo, lucideLightbulb, lucideTriangleAlert })],
  host: {
    role: 'note',
    '[attr.data-kind]': 'kind()',
  },
})
export class Callout {
  readonly kind = input<CalloutKind>('note');
  readonly title = input<string>();

  protected readonly icon: Signal<string> = computed(() => CALLOUT_ICON_NAME[this.kind()]);
}
