import type { CodeToken } from './code-block.types';

/** One dark theme: the site is dark-only (CONVENTIONS.md). */
const THEME = 'github-dark';

/**
 * Highlights `code` into one token list per line. Shiki is imported on first use, so it stays out
 * of the initial bundle, and its top-level `codeToTokensBase` shares one highlighter across every
 * call. Resolves `null` for a missing or unknown language; the caller keeps the plain text.
 */
export async function highlightCode(
  code: string,
  language: string | undefined,
): Promise<readonly (readonly CodeToken[])[] | null> {
  if (!language) {
    return null;
  }
  try {
    const { codeToTokensBase, bundledLanguages } = await import('shiki');
    if (!(language in bundledLanguages)) {
      return null;
    }
    const lines = await codeToTokensBase(code, {
      // Narrowed by the `in bundledLanguages` check above.
      lang: language as keyof typeof bundledLanguages,
      theme: THEME,
    });
    return lines.map((line) => line.map(({ content, color }) => ({ content, color })));
  } catch {
    return null;
  }
}
