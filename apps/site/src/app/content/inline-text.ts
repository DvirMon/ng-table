// Imported by both the Angular app and `apps/site/tools/generate-content.mts` (run by Node with
// type stripping), so this file may only `import type`: no runtime imports, no Angular, no DOM.

import type { Token } from 'marked';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

export function hasChildTokens(token: Token): token is Token & { tokens: Token[] } {
  return 'tokens' in token && Array.isArray(token.tokens);
}

/**
 * Inline tokens → plain text. Inline code keeps its identifier; HTML and images are dropped.
 * The generator derives a heading's text (and so its anchor) with this, and the page renderer
 * must too, so both feed `createPageAnchors` the same string.
 */
export function inlineText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'html':
        case 'image':
          return '';
        case 'br':
          return ' ';
        case 'codespan':
        case 'escape':
          return decodeEntities(token.text);
        case 'text':
          return hasChildTokens(token) ? inlineText(token.tokens) : decodeEntities(token.text);
        default:
          return hasChildTokens(token) ? inlineText(token.tokens) : '';
      }
    })
    .join('');
}
