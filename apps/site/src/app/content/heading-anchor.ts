// Imported by both the Angular app and `apps/site/tools/generate-content.mts` (run by Node with
// type stripping), so this file must stay dependency-free: no imports, no Angular, no DOM.

/**
 * Turns heading text into its URL anchor: diacritics folded, lowercased, every run of
 * characters other than letters and digits collapsed to one `-`, leading and trailing `-`
 * trimmed. `"Sort order (multi-column)"` → `"sort-order-multi-column"`.
 *
 * The one heading-to-anchor rule for the site. The content generator writes these anchors into
 * the manifest and the search index, and the page renderer writes them as heading `id`s; both
 * must call this function, so a search result's `#anchor` always exists on its page.
 */
export function toHeadingAnchor(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Anchor function for one page. Repeats of the same anchor on that page get `-1`, `-2`, … in
 * document order, so two "Example" headings become `example` and `example-1`. Create one per
 * page and feed it headings top to bottom; the generator and the renderer must both walk in
 * that order to agree.
 */
export function createPageAnchors(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = toHeadingAnchor(text) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}
