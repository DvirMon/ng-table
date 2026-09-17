import type { TocHeading } from './toc-column.types';

/**
 * Stand-in headings, shaped like the row-editing updaters in `libs/shared/table/src/api/row-edit-mutations.ts`
 * once that file becomes the `/state-layer/row-editing` article's content. Real TOC data is always
 * derived from the current article's own H2/H3 (`Content Model.md`), never hand-authored per page —
 * this file exists only because no real article exists yet.
 */
export const TOC_MOCK_HEADINGS: readonly TocHeading[] = [
  { level: 2, text: 'beginEdit', id: 'begin-edit' },
  { level: 2, text: 'addNewRow', id: 'add-new-row' },
  { level: 2, text: 'endEdit', id: 'end-edit' },
  { level: 2, text: 'clearEditing', id: 'clear-editing' },
  { level: 2, text: 'revertEdit', id: 'revert-edit' },
  { level: 3, text: 'Snapshot resolution', id: 'revert-edit-snapshot-resolution' },
  { level: 2, text: 'rebaseEdit', id: 'rebase-edit' },
  { level: 2, text: 'settleEdit', id: 'settle-edit' },
];
