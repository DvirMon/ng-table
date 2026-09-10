import type { TableFeature } from '../engine/types';
import type { ColumnSchema, ColumnsSchemaFn } from '../schema/column-schema.types';
import type { ColumnDefInput, TableStoreConfig, TrackByConfig } from './types';

export const createTableSchema = <
  TRow,
  Features extends readonly TableFeature<NoInfer<TRow>, any>[]
>(
  columns: ColumnDefInput<TRow>[],
  schema?: {
    trackBy?: TrackByConfig<TRow>;
    features?: Features;
    columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>;
  }
): (() => TableStoreConfig<TRow, Features>) => () => ({
  trackBy: schema?.trackBy ?? ('id' as TrackByConfig<TRow>),
  columns,
  columnsSchema: schema?.columnsSchema,
  features: schema?.features ?? [],
}) as TableStoreConfig<TRow, Features>;
