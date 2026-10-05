import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideTriangleAlert } from '@ng-icons/lucide';
import { CopyConfirm } from '../copy-confirm/copy-confirm';
import { IconButton } from '../icon-button/icon-button';

@Component({
  selector: 'ngpt-code-block',
  imports: [IconButton, CopyConfirm, NgIcon],
  templateUrl: './code-block.html',
  styleUrl: './code-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideCopy, lucideCheck, lucideTriangleAlert })],
})
export class CodeBlock {
  readonly code = input<string>();
  readonly language = input<string>();
  readonly showGutter = input<boolean>(true);
  /** Set false by a host that renders its own copy affordance (e.g. Preview Window's toolbar). */
  readonly showCopyButton = input<boolean>(true);
  /** 'panel' matches a containing surface's 12px radius (Preview Window's Source tab); 'standalone' keeps the spec's own 10px. */
  readonly radius = input<'standalone' | 'panel'>('standalone');

  /**
   * No Shiki this round (spec `does_not_own`: syntax colors). Split into one span per line so
   * the CSS counter gutter and the `.line` block model still match the spec's HTML/CSS mock —
   * this is where a future Shiki-rendered `.line` output would replace the plain split.
   */
  protected readonly lines = computed<readonly string[]>(() => (this.code() ?? '').split('\n'));

  /** a11y front-matter: "Scrollable region is focusable and has an accessible name." */
  protected readonly accessibleName = computed<string>(() => {
    const language = this.language();
    return language
      ? `${language} code sample, scrollable horizontally`
      : 'Code sample, scrollable horizontally';
  });
}
