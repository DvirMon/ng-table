import { Pipe, type PipeTransform } from '@angular/core';
import type { RenderRow } from '../../index';
import type { DealRow } from './fixtures/types';
import { formatAmount, isBlankGroupValue } from './fixtures/utils';

/**
 * One pure pipe per formatting concern, so the grouping templates branch with `@switch` and hold
 * no method calls of their own. Each takes `unknown` because a cell reads through
 * `ColumnDef.accessor`, whose return type is erased.
 */

/** `amount`, for a data cell and a group summary alike. */
@Pipe({ name: 'dealAmount' })
export class DealAmountPipe implements PipeTransform {
  transform(value: unknown): string {
    return formatAmount(value);
  }
}

/** `closedAt`. Non-`Date` input renders empty rather than `[object Object]`. */
@Pipe({ name: 'dealDate' })
export class DealDatePipe implements PipeTransform {
  transform(value: unknown): string {
    return value instanceof Date ? value.toLocaleDateString('en-GB') : '';
  }
}

/** `null` / `undefined` / `''` — three separate groups today, none of them labelled (S7). */
@Pipe({ name: 'isBlankGroup' })
export class IsBlankGroupPipe implements PipeTransform {
  transform(value: unknown): boolean {
    return isBlankGroupValue(value);
  }
}

/**
 * A group header's row count. Takes the `rowsOf` owner rather than the whole table so the pipe
 * names only what it uses; memoisation is keyed on the render row, which is a new object on every
 * pipeline evaluation, so a filter change recomputes and an unrelated render does not.
 */
@Pipe({ name: 'groupRowCount' })
export class GroupRowCountPipe implements PipeTransform {
  transform(
    row: RenderRow<DealRow>,
    source: { rowsOf: (group: RenderRow<DealRow>) => readonly DealRow[] }
  ): number {
    return source.rowsOf(row).length;
  }
}

/** A header's `aria-sort`, from `table.sortDirections()`'s per-column value. */
@Pipe({ name: 'ariaSort' })
export class AriaSortPipe implements PipeTransform {
  transform(direction: 'asc' | 'desc' | undefined): 'ascending' | 'descending' | 'none' {
    if (direction === 'asc') return 'ascending';
    if (direction === 'desc') return 'descending';
    return 'none';
  }
}

/** Every pipe above, for a story host's `imports`. */
export const GROUPING_STORY_PIPES = [
  DealAmountPipe,
  DealDatePipe,
  IsBlankGroupPipe,
  GroupRowCountPipe,
  AriaSortPipe,
] as const;
