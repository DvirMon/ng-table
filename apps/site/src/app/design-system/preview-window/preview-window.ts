import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideTriangleAlert } from '@ng-icons/lucide';
import { CodeBlock } from '../code-block/code-block';
import { CopyConfirm } from '../copy-confirm/copy-confirm';
import { IconButton } from '../icon-button/icon-button';
import { TabSwitcher } from '../tab-switcher/tab-switcher';
import type { TabItem } from '../tab-switcher/tab-switcher.types';

const PREVIEW_WINDOW_TABS: readonly TabItem[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'source', label: 'Source' },
];

/**
 * Live-example container (`docs/spec.md`) — toolbar (Tab Switcher + one Copy icon-button) above
 * either a projected preview canvas or the source `code-block`. Leaf this round: no page consumes
 * it yet, so the canvas only projects whatever content a future caller supplies
 * (`docs/CONVENTIONS.md`'s fixed contract deliberately narrows scope from the full spec — the
 * "Example CSS" dropdown-pill and the Run icon-button aren't built; see docs/decisions.md).
 */
@Component({
  selector: 'ngpt-preview-window',
  imports: [TabSwitcher, CodeBlock, IconButton, CopyConfirm, NgIcon],
  templateUrl: './preview-window.html',
  styleUrl: './preview-window.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideCopy, lucideCheck, lucideTriangleAlert })],
})
export class PreviewWindow {
  readonly code = input<string>();
  readonly language = input<string>();

  protected readonly tabs = PREVIEW_WINDOW_TABS;
  protected readonly activeTab = signal<string>('preview');
  protected readonly showsSource = computed<boolean>(() => this.activeTab() === 'source');
}
