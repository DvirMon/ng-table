import { describe, expectTypeOf, it } from 'vitest';
import type { PipelineStage, RowTransform } from './pipeline';
import type { StageContext } from './types';

type Row = { id: string };

/** Typechecks its argument and never calls it. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

describe('PipelineStage — registry-derived key type', () => {
  it('equals the literal union of the registered anchors', () => {
    expectTypeOf<PipelineStage>().toEqualTypeOf<'filter' | 'group' | 'sort' | 'audit'>();
  });
});

describe('RowTransform — ctx parameter carries TRow', () => {
  it('types the second argument as StageContext<TRow>, not unknown/any', () => {
    expectTypeOf<Parameters<RowTransform<Row>>[1]>().toEqualTypeOf<StageContext<Row>>();
  });

  it('still accepts a one-argument stage', () => {
    typecheckOnly(() => {
      const oneArg: RowTransform<Row> = (rows) => rows;
      void oneArg;
    });
  });
});
