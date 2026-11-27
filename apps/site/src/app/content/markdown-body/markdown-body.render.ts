import { Parser, type Token, type Tokens } from 'marked';
import { createMarkdown, type CalloutToken } from '../../../../tools/content/markdown.mjs';
import { createPageAnchors } from '../heading-anchor';
import { inlineText } from '../inline-text';
import type { MarkdownBlock } from './markdown-body.types';

const markdown = createMarkdown();

function isCalloutToken(token: Token): token is CalloutToken {
  return token.type === 'callout';
}

function isCodeToken(token: Token): token is Tokens.Code {
  return token.type === 'code';
}

function isHeadingToken(token: Token): token is Tokens.Heading {
  return token.type === 'heading';
}

/** H2/H3 only: the generator gives anchors to nothing else, so the renderer must not either. */
function isAnchoredHeading(token: Token): token is Tokens.Heading {
  return isHeadingToken(token) && (token.depth === 2 || token.depth === 3);
}

function renderHeading(token: Tokens.Heading, id: string): string {
  const inner = Parser.parseInline(token.tokens, markdown.defaults);
  return `<h${token.depth} id="${id}">${inner}</h${token.depth}>\n`;
}

/**
 * Renders page Markdown to blocks, with the same `createMarkdown()` instance and
 * `createPageAnchors()` walk as `tools/generate-content.mts`, so a heading's `id` equals its
 * anchor in the manifest and the search index. Only top-level H2/H3 are anchored, in document
 * order, exactly as the generator lexes them.
 */
export function renderMarkdown(source: string): readonly MarkdownBlock[] {
  const anchorFor = createPageAnchors();
  return toBlocks(markdown.lexer(source), anchorFor);
}

function toBlocks(
  tokens: readonly Token[],
  anchorFor: ((text: string) => string) | null,
): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let html = '';
  const flushHtml = (): void => {
    if (html) {
      blocks.push({ kind: 'html', html });
      html = '';
    }
  };

  for (const token of tokens) {
    if (isCalloutToken(token)) {
      flushHtml();
      // Callout bodies are not walked for anchors by the generator; their headings get no id.
      blocks.push({
        kind: 'callout',
        variant: token.variant,
        blocks: toBlocks(token.tokens, null),
      });
    } else if (isCodeToken(token)) {
      flushHtml();
      blocks.push({
        kind: 'code',
        code: token.text,
        language: token.lang?.split(/\s/)[0] || undefined,
      });
    } else if (anchorFor && isAnchoredHeading(token)) {
      html += renderHeading(token, anchorFor(inlineText(token.tokens).trim()));
    } else {
      html += Parser.parse([token], markdown.defaults);
    }
  }
  flushHtml();
  return blocks;
}
