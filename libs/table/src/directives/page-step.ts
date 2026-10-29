const FALLBACK_PAGE_STEP = 10;

function isScrollableY(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  return overflowY === 'auto' || overflowY === 'scroll';
}

function findScrollContainer(host: HTMLElement): HTMLElement | null {
  for (let el: HTMLElement | null = host; el; el = el.parentElement) {
    if (isScrollableY(el)) return el;
  }
  return null;
}

/**
 * Number of whole rows that fit in the host's nearest vertical scroll container.
 *
 * @param host - Grid host; the search starts here and walks up.
 * @param cell - Any rendered cell, measured for row height.
 * @returns At least 1 when measurable; `10` when there is no scroll container or either height is 0.
 */
export function pageStepOf(host: HTMLElement, cell: HTMLElement): number {
  const container = findScrollContainer(host);
  if (!container) return FALLBACK_PAGE_STEP;

  const containerHeight = container.clientHeight;
  const rowHeight = cell.offsetHeight;
  const isMeasurable = containerHeight > 0 && rowHeight > 0;
  if (!isMeasurable) return FALLBACK_PAGE_STEP;

  return Math.max(1, Math.floor(containerHeight / rowHeight));
}

/**
 * Whether the host resolves to right-to-left. Read on each call, never cached.
 *
 * @param host - Element whose computed `direction` is read.
 */
export function isRtlAt(host: HTMLElement): boolean {
  return getComputedStyle(host).direction === 'rtl';
}
