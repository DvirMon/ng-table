import type { ResolveFn } from '@angular/router';
import { CONTENT_MANIFEST } from './content.manifest';
import type { ContentPage } from './content.types';
import type { PageState } from './page-state.types';

const PRODUCT_NAME = 'NGP Table';

const pagesBySlug = new Map<string, ContentPage>(
  CONTENT_MANIFEST.pages.map((page) => [page.slug, page]),
);

/** Strips query string, hash and trailing slash. Matching stays case-sensitive. */
export function normalizePath(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed.startsWith('/') ? trimmed : '/' + trimmed;
}

/** Resolves a URL to its page state: exact slug match (hidden included), else Not Found. */
export function resolvePageState(url: string): PageState {
  const entry = pagesBySlug.get(normalizePath(url)) ?? null;

  if (!entry) {
    return {
      archetype: 'Not Found',
      entry: null,
      section: null,
      eyebrow: null,
      h1: 'Page not found',
      prev: null,
      next: null,
      headings: [],
      title: `Page not found · ${PRODUCT_NAME}`,
    };
  }

  return {
    archetype: entry.archetype,
    entry,
    section: entry.section,
    eyebrow: entry.eyebrow,
    h1: entry.label,
    prev: entry.prev ? (pagesBySlug.get(entry.prev) ?? null) : null,
    next: entry.next ? (pagesBySlug.get(entry.next) ?? null) : null,
    headings: entry.headings,
    title: entry.section
      ? `${entry.label} · ${entry.section} · ${PRODUCT_NAME}`
      : `${entry.label} · ${PRODUCT_NAME}`,
  };
}

/** The one resolver every docs and Not Found route uses; read it as `route.data['pageState']`. */
export const pageStateResolver: ResolveFn<PageState> = (_route, state) =>
  resolvePageState(state.url);

/** Same source as the H1, so the two never disagree. */
export const pageTitleResolver: ResolveFn<string> = (_route, state) =>
  resolvePageState(state.url).title;
