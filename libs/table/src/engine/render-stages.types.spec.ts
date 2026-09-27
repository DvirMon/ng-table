import { describe, expectTypeOf, it } from 'vitest';
import type { RenderNodeTransform, RenderStage } from './render-stages';
import type { StageContext } from './types';

type Row = { id: string };

/**
 * Compile-time seam: `RenderStage` stays a closed union derived from `RenderStageRegistry` — an
 * unregistered key must not widen to `string`. **`nx run shared-table:typecheck-spec` is what
 * enforces this file** — `nx test` executes `@ts-expect-error` without typechecking it, so a
 * green run proves nothing about it.
 */

/** Typechecks its argument and never calls it. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

describe('RenderStage — closed union', () => {
  it('rejects a value not declared in RenderStageRegistry', () => {
    typecheckOnly(() => {
      // @ts-expect-error — 'pinned' is not a member of RenderStageRegistry
      const bad: RenderStage = 'pinned';
      void bad;
    });
  });
});

describe('RenderNodeTransform — ctx parameter carries TRow, not the node', () => {
  it('types the second argument as StageContext<TRow>, where TRow is the row data', () => {
    expectTypeOf<Parameters<RenderNodeTransform<Row>>[1]>().toEqualTypeOf<StageContext<Row>>();
  });
});
