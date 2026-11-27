import type { SearchResultRecord } from './search.types';

/**
 * Published by `npm run site:content` into `apps/site/public/`, so it ships as a static asset.
 * It is fetched (not imported) so body text stays out of every eagerly-loaded bundle.
 */
const SEARCH_INDEX_PATH = 'search-index.json';

function isSearchResultRecord(value: unknown): value is SearchResultRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record: Partial<Record<keyof SearchResultRecord, unknown>> = value;
  const hasKind = record.kind === 'page' || record.kind === 'heading';
  const hasText = [record.id, record.title, record.section, record.breadcrumb, record.body].every(
    (field) => typeof field === 'string',
  );
  return hasKind && hasText && typeof record.entryOrder === 'number';
}

function isSearchIndex(value: unknown): value is readonly SearchResultRecord[] {
  return Array.isArray(value) && value.every(isSearchResultRecord);
}

/**
 * Fetches and validates the generated index. Throws on a network error or a malformed file; the
 * caller degrades to an empty index, so search shows "no results" instead of breaking the overlay.
 */
export async function loadSearchIndex(
  abortSignal: AbortSignal,
): Promise<readonly SearchResultRecord[]> {
  const response = await fetch(new URL(SEARCH_INDEX_PATH, document.baseURI), {
    signal: abortSignal,
  });
  if (!response.ok) {
    throw new Error(`[search] ${SEARCH_INDEX_PATH} failed to load: HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!isSearchIndex(data)) {
    throw new Error(`[search] ${SEARCH_INDEX_PATH} is malformed — run \`npm run site:content\``);
  }
  return data;
}
