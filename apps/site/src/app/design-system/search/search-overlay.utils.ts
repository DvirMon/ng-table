import type { SearchResultGroup, SearchResultRecord, SearchTreeConnector } from './search.types';

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

const MAX_RESULTS = 5;

/** Lower is better. `null` means no match. Title beats body; start-of-title beats inside-title. */
function matchTier(record: SearchResultRecord, needle: string): number | null {
  const title = record.title.toLowerCase();
  if (title.startsWith(needle)) {
    return 0;
  }
  if (title.includes(needle)) {
    return 1;
  }
  if (record.body.toLowerCase().includes(needle)) {
    return 2;
  }
  return null;
}

function compareRank(
  a: { record: SearchResultRecord; tier: number },
  b: { record: SearchResultRecord; tier: number },
): number {
  const isPageA = a.record.kind === 'page' ? 0 : 1;
  const isPageB = b.record.kind === 'page' ? 0 : 1;
  return a.tier - b.tier || isPageA - isPageB || a.record.entryOrder - b.record.entryOrder;
}

/**
 * Ranks matches (title start > title inside > body; page > heading; `entryOrder`), keeps the
 * best `MAX_RESULTS` overall, then shows them under their section groups in tree order
 * (`Search Index.md` § Groups). Rows inside a group keep rank order.
 */
export function groupSearchResults(
  records: readonly SearchResultRecord[],
  query: string,
): readonly SearchResultGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }

  const ranked = records
    .flatMap((record) => {
      const tier = matchTier(record, needle);
      return tier === null ? [] : [{ record, tier }];
    })
    .sort(compareRank)
    .slice(0, MAX_RESULTS)
    .map(({ record }) => record);

  const resultsBySection = new Map<string, SearchResultRecord[]>();
  for (const record of ranked) {
    const sectionResults = resultsBySection.get(record.section) ?? [];
    sectionResults.push(record);
    resultsBySection.set(record.section, sectionResults);
  }

  const firstEntryOrder = (group: SearchResultGroup): number =>
    Math.min(...group.results.map((result) => result.entryOrder));

  return Array.from(resultsBySection, ([label, results]) => ({
    label,
    results: nestHeadingsUnderPages(results),
  })).sort((a, b) => firstEntryOrder(a) - firstEntryOrder(b));
}

/** The page a record belongs to: `slug` for a page record, the part before `#` for a heading. */
function getPageId(record: SearchResultRecord): string {
  return record.id.split('#')[0];
}

/**
 * Puts each page record directly before the headings of that page, so a heading sits under its
 * parent. Families keep the order of their best-ranked member; standalone headings stay alone.
 */
function nestHeadingsUnderPages(results: readonly SearchResultRecord[]): SearchResultRecord[] {
  const families = new Map<string, SearchResultRecord[]>();
  for (const record of results) {
    const family = families.get(getPageId(record)) ?? [];
    family.push(record);
    families.set(getPageId(record), family);
  }
  return Array.from(families.values()).flatMap((family) =>
    family.slice().sort((a, b) => Number(a.kind === 'heading') - Number(b.kind === 'heading')),
  );
}

/**
 * Connector for `results[index]`. Only a heading whose own page record is in `results` is a
 * child; any other heading is a standalone result and gets no tree.
 */
export function getTreeConnector(
  results: readonly SearchResultRecord[],
  index: number,
): SearchTreeConnector {
  const record = results[index];
  const pageId = getPageId(record);
  const hasParentPage = results.some((other) => other.kind === 'page' && other.id === pageId);
  if (record.kind !== 'heading' || !hasParentPage) {
    return 'none';
  }
  const next = results[index + 1];
  return next?.kind === 'heading' && getPageId(next) === pageId ? 'continue' : 'close';
}
