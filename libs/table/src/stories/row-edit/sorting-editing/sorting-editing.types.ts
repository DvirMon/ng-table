import type { RowId } from '../../../api/types';

/** Local to `sorting-editing/` — deliberately not merged into the shared `row-edit.types.ts`
 * (`EditRow`), which has no nullable field. `dueDate` is what S-2's null/empty sort-placement
 * demo needs; keeping the type here keeps this story file-independent of `gated-edit/` and the
 * other row-editing stories (`docs/3-ui/work/row-edit-stories/2-gap-analysis.md` §5). */
export interface SortEditRow {
  id: string;
  name: string;
  /** ISO date string, or `null` for "no due date yet" — the nullable column S-2 needs. */
  dueDate: string | null;
}

/** S-1 row-hold regression (OQ-3, not implemented): the render position a row held when it was
 * opened for edit vs. its current position, emitted by `createRowHoldProbe()` when they diverge. */
export interface RowHoldViolation {
  readonly id: RowId;
  readonly indexAtOpen: number;
  readonly currentIndex: number;
}
