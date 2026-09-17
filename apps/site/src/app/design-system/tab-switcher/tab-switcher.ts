import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgpTabButton, NgpTabList, NgpTabset, provideTabsConfig } from 'ng-primitives/tabs';
import { TabItem } from './tab-switcher.types';

/**
 * Two-way segmented control (e.g. Preview/Source). Wired onto ng-primitives/tabs
 * (NgpTabset + NgpTabList as hostDirectives, NgpTabButton per item) for tablist ARIA,
 * roving-tabindex, and arrow-key focus. `activateOnFocus: false` preserves manual
 * activation (focus moves on arrow keys, selection only on click/Enter/Space via the
 * button's native activation) — see docs/decisions.md.
 */
@Component({
  selector: 'ngpt-tab-switcher',
  templateUrl: './tab-switcher.html',
  styleUrl: './tab-switcher.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgpTabButton],
  hostDirectives: [
    {
      directive: NgpTabset,
      inputs: ['ngpTabsetValue: selected'],
      outputs: ['ngpTabsetValueChange: selectedChange'],
    },
    NgpTabList,
  ],
  providers: [provideTabsConfig({ activateOnFocus: false })],
})
export class TabSwitcher {
  readonly tabs = input<readonly TabItem[]>([]);
}
