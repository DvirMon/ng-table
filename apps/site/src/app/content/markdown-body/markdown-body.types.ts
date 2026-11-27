import type { CalloutKind } from '../../design-system/callout/callout.types';

/** A run of ordinary Markdown rendered to HTML (headings carry their anchor `id`). */
export interface HtmlBlock {
  readonly kind: 'html';
  readonly html: string;
}

/** A fenced code block, mounted as `ngpt-code-block`. */
export interface CodeFenceBlock {
  readonly kind: 'code';
  readonly code: string;
  readonly language: string | undefined;
}

/** A `:::note|tip|warning` block, mounted as `aside[ngptCallout]`. */
export interface CalloutBlock {
  readonly kind: 'callout';
  readonly variant: CalloutKind;
  readonly blocks: readonly MarkdownBlock[];
}

export type MarkdownBlock = HtmlBlock | CodeFenceBlock | CalloutBlock;
