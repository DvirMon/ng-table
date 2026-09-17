import { Pipe, type PipeTransform } from '@angular/core';
import type { EditRow } from './fixtures/types';
import { rowLabel } from './fixtures/utils';

/** What a row is called in announcements and accessible labels (see `fixtures/utils.ts`). */
@Pipe({ name: 'rowLabel' })
export class RowLabelPipe implements PipeTransform {
  transform(row: EditRow): string {
    return rowLabel(row);
  }
}

/** Every pipe above, for a story host's `imports`. */
export const ROW_EDIT_STORY_PIPES = [RowLabelPipe] as const;
