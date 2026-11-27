/**
 * The site's one Markdown configuration: `marked` plus the `:::note|tip|warning` callout block.
 * The content generator lexes pages with it; the page renderer (plan step B) must render with
 * the same instance, so both see the same headings in the same order.
 */

import { Marked, type TokenizerExtension, type Tokens } from 'marked';

export type CalloutVariant = 'note' | 'tip' | 'warning';

/** A `:::variant` … `:::` block. Its body is lexed as ordinary block Markdown. */
export interface CalloutToken extends Tokens.Generic {
  type: 'callout';
  raw: string;
  variant: CalloutVariant;
  tokens: Tokens.Generic[];
}

const CALLOUT_PATTERN = /^:::(note|tip|warning)[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/;

function isCalloutVariant(value: string): value is CalloutVariant {
  return value === 'note' || value === 'tip' || value === 'warning';
}

const callout: TokenizerExtension = {
  name: 'callout',
  level: 'block',
  start: (src) => src.match(/^:::/m)?.index,
  tokenizer(src) {
    const match = CALLOUT_PATTERN.exec(src);
    if (!match || !isCalloutVariant(match[1])) {
      return undefined;
    }
    const token: CalloutToken = {
      type: 'callout',
      raw: match[0],
      variant: match[1],
      tokens: [],
    };
    this.lexer.blockTokens(match[2], token.tokens);
    return token;
  },
  childTokens: ['tokens'],
};

export function createMarkdown(): Marked {
  return new Marked({ gfm: true, extensions: [callout] });
}
