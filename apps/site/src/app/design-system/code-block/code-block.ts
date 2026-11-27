import { ChangeDetectionStrategy, Component, computed, input, resource } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideTriangleAlert } from '@ng-icons/lucide';
import { CopyConfirm } from '../copy-confirm/copy-confirm';
import { IconButton } from '../icon-button/icon-button';
import { highlightCode } from './code-block.highlight';
import type { CodeToken } from './code-block.types';

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

  private readonly highlighted = resource({
    params: () => ({ code: this.code() ?? '', language: this.language() }),
    loader: ({ params }) => highlightCode(params.code, params.language),
  });

  /**
   * One token list per line. Plain text until Shiki has loaded (or when the language is unknown),
   * then the highlighted tokens; the `.line` split is the same either way, so the CSS gutter
   * does not move.
   */
  protected readonly lines = computed<readonly (readonly CodeToken[])[]>(
    () =>
      (this.highlighted.hasValue() ? this.highlighted.value() : null) ??
      (this.code() ?? '').split('\n').map((line) => [{ content: line }]),
  );

  /** a11y front-matter: "Scrollable region is focusable and has an accessible name." */
  protected readonly accessibleName = computed<string>(() => {
    const language = this.language();
    return language
      ? `${language} code sample, scrollable horizontally`
      : 'Code sample, scrollable horizontally';
  });
}
