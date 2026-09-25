import { afterRenderEffect, Directive, inject, input, untracked } from '@angular/core';

import { NGP_TABLE_ROW_ANIMATION, NGP_TABLE_STORE } from './table.tokens';
import type { RenderRow, RowId } from '../api/types';

const DEFAULT_FLIP_TIMING: KeyframeAnimationOptions = {
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

// One row's glide, as `translateY` offsets from its new layout slot.
interface RowGlide {
  fromOffset: number;
  toOffset: number;
}

// A row glides only if it is on screen at either end of its move; one off screen at both ends
// jumps. A far end off screen is replaced by the nearest screen edge, so a row arriving from far
// away slides in from that edge, and a leaving row slides out to it, at the normal duration —
// instead of crossing thousands of pixels in one frame. The window is the viewport, not a scroll
// container: a row the container clips still counts as on screen. `getBoundingClientRect()`
// includes an in-flight transform, so a reorder mid-glide starts from where the row is drawn.
function planGlide(
  element: HTMLElement,
  delta: number,
  viewportHeight: number,
): RowGlide | undefined {
  const { top, bottom } = element.getBoundingClientRect();
  const isOnScreenAfter = bottom >= 0 && top <= viewportHeight;
  const isOnScreenBefore = bottom + delta >= 0 && top + delta <= viewportHeight;
  const isOnScreenThroughout = isOnScreenAfter && isOnScreenBefore;
  if (isOnScreenThroughout) {
    return { fromOffset: delta, toOffset: 0 };
  }
  if (isOnScreenAfter) {
    const isArrivingFromBelow = delta > 0;
    const edgeOffset = isArrivingFromBelow ? viewportHeight - top : -bottom;
    return { fromOffset: edgeOffset, toOffset: 0 };
  }
  if (isOnScreenBefore) {
    const isLeavingDownward = top > viewportHeight;
    const edgeOffset = isLeavingDownward ? viewportHeight - top : -bottom;
    return { fromOffset: delta, toOffset: edgeOffset };
  }
  return undefined;
}

function toTransform(offset: number): string {
  const isInLayoutSlot = offset === 0;
  return isInLayoutSlot ? 'none' : `translateY(${offset}px)`;
}

// Dual-tag selector, matches `ngpTable`'s pattern. Opt-in: without this directive on the host,
// `ngpTableRow` registers nothing (docs/3-ui/directives/row-animation.md).
@Directive({
  selector: 'table[ngpTableRowAnimation], div[ngpTableRowAnimation]',
  providers: [
    { provide: NGP_TABLE_ROW_ANIMATION, useExisting: NgpTableRowAnimationDirective },
  ],
  host: {
    'data-row-animation': '',
  },
})
export class NgpTableRowAnimationDirective<TRow = unknown> {
  /** Duration, easing and any other Web Animations timing for a row's move. */
  readonly flipTiming = input<KeyframeAnimationOptions>(DEFAULT_FLIP_TIMING);

  // Required: this directive is meaningless without `ngpTable` on the same host element.
  private readonly parentTable = inject(NGP_TABLE_STORE);

  // FLIP row-reorder animation (docs/3-ui/directives/row-animation.md), keyed by `RowId`.
  private previousRowTops = new Map<RowId, number>();

  // Row elements, keyed by id instead of DOM position — `animate.leave` keeps a leaving `<tr>`
  // in the DOM past its removal from `renderRows()`, which would otherwise shift index-paired
  // lookups for every row after it.
  private readonly rowElements = new Map<RowId, HTMLElement>();

  constructor() {
    // Re-runs only when `renderRows()` changes, after the DOM reflects it. The invert is the
    // first keyframe, so it never has to render on its own; a later `animate()` on the same
    // element overrides an earlier one, so a reorder mid-glide needs no cancel.
    afterRenderEffect({
      earlyRead: () => this.measureMoves(this.parentTable.ngpTable().renderRows()),
      write: (moves) => {
        const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
          return;
        }
        const timing = untracked(this.flipTiming);
        moves().forEach(({ fromOffset, toOffset }, rowId) =>
          this.rowElements
            .get(rowId)
            ?.animate(
              [{ transform: toTransform(fromOffset) }, { transform: toTransform(toOffset) }],
              timing,
            ),
        );
      },
    });
  }

  /**
   * Registers a row's host element for FLIP offset measurement.
   *
   * @remarks
   * Always overwrites any existing entry for `rowId`.
   */
  registerRowElement(rowId: RowId, element: HTMLElement): void {
    this.rowElements.set(rowId, element);
  }

  /**
   * Unregisters a row's element.
   *
   * @remarks
   * Removes the entry only if `element` still matches what's registered for `rowId` — a
   * re-entering row with the same id may already have registered its own element before the
   * leaving instance is destroyed.
   */
  unregisterRowElement(rowId: RowId, element: HTMLElement): void {
    if (this.rowElements.get(rowId) === element) {
      this.rowElements.delete(rowId);
    }
  }

  // Each moved row's glide, for rows on screen at either end of the move. DOM reads only.
  private measureMoves(renderRows: readonly RenderRow<unknown>[]): Map<RowId, RowGlide> {
    const newTops = this.captureRowTops(renderRows.map((row) => row.id));

    // Read once per pass: inside an iframe it may re-check the parent's layout on every read.
    const viewportHeight = window.innerHeight;
    const moves = new Map<RowId, RowGlide>();
    newTops.forEach((newTop, rowId) => {
      const oldTop = this.previousRowTops.get(rowId);
      const element = this.rowElements.get(rowId);
      const hasMovedRegisteredRow =
        oldTop !== undefined && element !== undefined && oldTop !== newTop;
      if (!hasMovedRegisteredRow) {
        return;
      }
      const glide = planGlide(element, oldTop - newTop, viewportHeight);
      if (glide !== undefined) {
        moves.set(rowId, glide);
      }
    });
    this.previousRowTops = newTops;
    return moves;
  }

  private captureRowTops(rowIds: readonly RowId[]): Map<RowId, number> {
    const tops = new Map<RowId, number>();
    rowIds.forEach((rowId) => {
      const element = this.rowElements.get(rowId);
      if (element !== undefined) {
        tops.set(rowId, element.offsetTop);
      }
    });
    return tops;
  }
}
