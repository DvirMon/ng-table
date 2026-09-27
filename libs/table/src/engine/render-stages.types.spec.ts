import { describe, it } from 'vitest';
import type { RenderStage } from './render-stages';

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
