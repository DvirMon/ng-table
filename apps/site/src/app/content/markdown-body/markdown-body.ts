import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Callout } from '../../design-system/callout/callout';
import { CodeBlock } from '../../design-system/code-block/code-block';
import { renderMarkdown } from './markdown-body.render';
import type { MarkdownBlock } from './markdown-body.types';

/**
 * Renders one page's Markdown body: prose HTML with anchored headings, `:::` callouts as
 * `aside[ngptCallout]`, fences as `ngpt-code-block`. Place it inside the page's `ngptProse`
 * article. Heading ids come from the same anchor walk as the content generator.
 */
@Component({
  selector: 'ngpt-markdown-body',
  imports: [NgTemplateOutlet, Callout, CodeBlock],
  templateUrl: './markdown-body.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class MarkdownBody {
  readonly source = input.required<string>();

  protected readonly blocks = computed<readonly MarkdownBlock[]>(() =>
    renderMarkdown(this.source()),
  );
}
