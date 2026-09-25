import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { CompositionRow } from './types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const compositionData = (): readonly CompositionRow[] | undefined => undefined;

/** The two columns every `composition/derived-state/` story renders. */
export const compositionColumns = createColumns(compositionData, (col) => [
  col('name'),
  col('dept'),
]);

/** Consumed by `composition/derived-state/`, which layers `withComputed()` over these columns. */
// No `TableConfig<CompositionRow>` annotation — that would default `columns` to the wide union
// and lose `compositionColumns`'s literal ids; `satisfies` checks the shape without widening it.
export const derivedStateConfig = {
  trackBy: 'id',
  columns: compositionColumns,
} satisfies TableConfig<CompositionRow>;
