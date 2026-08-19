import type { ColumnSchema, ColumnsSchemaFn } from './column-schema.types';
import type {
  AnyTableFeature,
  ColumnDefInput,
  TableStoreConfig,
  TrackByConfig,
} from './types';

export const createTableSchema = <
  TRow,
  Features extends readonly AnyTableFeature[] = []
>(
  columns: ColumnDefInput<TRow>[],
  schema?: {
    trackBy?: TrackByConfig<TRow>;
    features?: Features;
    columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>;
  }
) => () => ({
  trackBy: schema?.trackBy ?? ('id' as TrackByConfig<TRow>),
  columns,
  columnsSchema: schema?.columnsSchema,
  features: schema?.features ?? [],
}) as TableStoreConfig<TRow, Features>;
