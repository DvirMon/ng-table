import { signal } from '@angular/core';
import { describe, expectTypeOf, it } from 'vitest';
import type { StageContext } from '../engine/types';
import { createTableFeature } from './create-table-feature';
import type { TableStore } from './types';

type Row = { id: string };

/** Typechecks its argument and never calls it. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

describe('createTableFeature — ctx parameter', () => {
  it('types an unannotated factory ctx from the factory’s In', () => {
    typecheckOnly(() => {
      createTableFeature((_input: TableStore<Row>, ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<StageContext<Row>>();
        return {};
      });
    });
  });

  it('types the derive block ctx through In & Out', () => {
    typecheckOnly(() => {
      createTableFeature(
        (_input: TableStore<Row>) => ({ members: { n: signal(1) } }),
        (_input, ctx) => {
          expectTypeOf(ctx).toEqualTypeOf<StageContext<Row>>();
          return {};
        },
      );
    });
  });
});
