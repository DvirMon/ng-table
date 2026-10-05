import { PaginationEntry } from './pagination.types';

export const PAGINATION_PREV_MOCK: PaginationEntry = {
  label: 'Getting Started',
  href: '/docs/getting-started',
};

export const PAGINATION_NEXT_MOCK: PaginationEntry = {
  label: 'State Layer Architecture',
  href: '/docs/state-layer-architecture',
};

/** Both sides present — the common case. */
export const PAGINATION_BOTH_SIDES_MOCK: {
  readonly prev: PaginationEntry;
  readonly next: PaginationEntry;
} = {
  prev: PAGINATION_PREV_MOCK,
  next: PAGINATION_NEXT_MOCK,
};

/** First entry in the tree — no prev side. */
export const PAGINATION_NEXT_ONLY_MOCK: { readonly prev: null; readonly next: PaginationEntry } = {
  prev: null,
  next: PAGINATION_NEXT_MOCK,
};

/** Last entry in the tree — no next side. */
export const PAGINATION_PREV_ONLY_MOCK: { readonly prev: PaginationEntry; readonly next: null } = {
  prev: PAGINATION_PREV_MOCK,
  next: null,
};
