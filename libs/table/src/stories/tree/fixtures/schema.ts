import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { TaskRow } from './types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const taskData = (): readonly TaskRow[] | undefined => undefined;

// One column set for every tree story — they differ in composed features, not table contents.
// Written as a module-level const so each `col()` call's literal id survives
// (`create-columns.types.spec.ts`'s case 1) instead of widening to `string` when read back off
// the const. `name` comes first per TR41 (indentation in the name cell only).
const taskColumnSet = createColumns(taskData, (col) => [
  col('name', { label: 'Task' }),
  col('owner', { label: 'Owner' }),
  col('status', { label: 'Status' }),
]);

// Note: no `TableConfig<TaskRow>` annotation. It would widen `columns` to the wide union and lose
// `taskColumnSet`'s literal ids; `satisfies` checks the shape without widening.
/** The config shared by every tree story. */
export const treeConfig = {
  trackBy: 'id',
  columns: taskColumnSet,
} satisfies TableConfig<TaskRow>;

/** The column set behind `treeConfig`, for typing column-id paths. */
export const treeColumns = taskColumnSet;
