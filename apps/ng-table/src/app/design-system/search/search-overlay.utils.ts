import type { SearchResultGroup, SearchResultRecord } from './search.types';

export interface TrackedPointer {
  /** True once the pointer has genuinely moved in screen space since the last `update`/check. */
  wasMoved(event: MouseEvent): boolean;
  /** Seeds the baseline position without treating it as a move (call from `mouseenter`). */
  update(event: MouseEvent): void;
}

/**
 * Distinguishes a real pointer move from a `mousemove` fired by the DOM shifting under a
 * stationary cursor (e.g. a keyboard-triggered `scrollIntoView`) — no timing heuristic, just
 * comparing `screenX`/`screenY` (screen-space, so page scroll doesn't count as movement) against
 * the last known position. Same technique Headless UI's `useTrackedPointer` uses to keep hover
 * from fighting keyboard nav for the active item — see
 * `~/.claude/skills/pointer-keyboard-active-state/SKILL.md`.
 */
export function createTrackedPointer(): TrackedPointer {
  let lastScreenX = -1;
  let lastScreenY = -1;
  return {
    wasMoved(event) {
      if (event.screenX === lastScreenX && event.screenY === lastScreenY) {
        return false;
      }
      lastScreenX = event.screenX;
      lastScreenY = event.screenY;
      return true;
    },
    update(event) {
      lastScreenX = event.screenX;
      lastScreenY = event.screenY;
    },
  };
}

/** Wraps `index` into `[0, length)`. Returns 0 when `length` is 0. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

const MAX_RESULTS_PER_GROUP = 5;

/** Case-insensitive substring match against title/body — matching only, `body` never renders. */
function matchesQuery(record: SearchResultRecord, needle: string): boolean {
  return record.title.toLowerCase().includes(needle) || record.body.toLowerCase().includes(needle);
}

/**
 * Filters `records` against `query`, groups by section in tree order (`entryOrder`), and caps
 * each group at `MAX_RESULTS_PER_GROUP` — no scroll-to-fit, matching the DocSearch reference
 * (gaps-ngp-reference.md #5).
 */
export function groupSearchResults(
  records: readonly SearchResultRecord[],
  query: string,
): readonly SearchResultGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }

  const matches = records
    .filter((record) => matchesQuery(record, needle))
    .slice()
    .sort((a, b) => a.entryOrder - b.entryOrder);

  const resultsBySection = new Map<string, SearchResultRecord[]>();
  for (const record of matches) {
    const sectionResults = resultsBySection.get(record.section) ?? [];
    sectionResults.push(record);
    resultsBySection.set(record.section, sectionResults);
  }

  return Array.from(resultsBySection, ([label, results]) => ({
    label,
    results: results.slice(0, MAX_RESULTS_PER_GROUP),
  }));
}

/**
 * True when `results[index]` is the last `heading` in its consecutive run — the tree connector's
 * closing corner instead of the continuing trunk (DocSearch reference: `M8 6v21…` vs `M8 6v42…`,
 * verified live via chrome-devtools against angularprimitives.com's search dropdown).
 */
export function isLastHeadingInRun(results: readonly SearchResultRecord[], index: number): boolean {
  return results[index + 1]?.kind !== 'heading';
}
