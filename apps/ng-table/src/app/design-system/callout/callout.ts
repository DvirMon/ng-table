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

/**
 * Attribute-hosted on a real `<aside>` (ADR-0005). Composes its own structure (icon + content
 * column), so unlike a pure styling primitive it keeps a template — only the host element changed.
 *
 * `role="note"` is kept explicitly: `<aside>`'s implicit role is `complementary`, and a *nested*
 * unnamed `<aside>` (which is where callouts live — inside prose) maps to `generic`. Neither is
 * the `note` the spec's a11y front-matter requires. `note` is a permitted role on `<aside>`.
 *
 * The visible label input is `heading`, not `title`: on this host `title` is a global HTML
 * attribute. See `docs/decisions.md`.
 */
@Component({
  selector: 'aside[ngptCallout]',
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
  readonly heading = input<string>();

  protected readonly icon: Signal<string> = computed(() => CALLOUT_ICON_NAME[this.kind()]);
}
