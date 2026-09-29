import { describe, expectTypeOf, it } from 'vitest';
import type { TableStore } from '../api/types';
import type { Feature, StageContext, TableFeatureSpec } from './types';

type Row = { id: string };

describe('Feature — ctx parameter carries the recovered row type', () => {
  it('types the second argument as StageContext<Row>, not unknown/any', () => {
    expectTypeOf<Parameters<Feature<TableStore<Row>, {}>>[1]>().toEqualTypeOf<
      StageContext<Row>
    >();
  });

  it('keeps a one-argument factory assignable to Feature', () => {
    expectTypeOf<(input: TableStore<Row>) => TableFeatureSpec<Row, {}>>().toMatchTypeOf<
      Feature<TableStore<Row>, {}>
    >();
  });
});
