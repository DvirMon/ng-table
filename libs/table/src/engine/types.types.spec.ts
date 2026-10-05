import { describe, expectTypeOf, it } from 'vitest';
import type { RowId, TableStore } from '../api/types';
import type { Feature, StageContext, TableFeatureSpec } from './types';

type Row = { id: string };

describe('Feature — ctx parameter carries the recovered row type', () => {
  it('types the second argument as StageContext<Row>, not unknown/any', () => {
    expectTypeOf<Parameters<Feature<TableStore<Row>, {}>>[1]>().toEqualTypeOf<StageContext<Row>>();
  });

  it('keeps a one-argument factory assignable to Feature', () => {
    expectTypeOf<(input: TableStore<Row>) => TableFeatureSpec<Row, {}>>().toMatchTypeOf<
      Feature<TableStore<Row>, {}>
    >();
  });
});

describe('StageContext — contextRows', () => {
  it('returns a plain ReadonlySet<RowId>, never undefined', () => {
    expectTypeOf<NonNullable<StageContext<Row>['contextRows']>>().returns.toEqualTypeOf<
      ReadonlySet<RowId>
    >();
  });
});
