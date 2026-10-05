import { describe, expectTypeOf, it } from 'vitest';
import type { RenderNodeTransform } from '../engine/render-stages';
import { stage } from './stage-rules';
import { stageSchema } from './stage-schema';
import type { StageHandle } from './stage-schema';

/**
 * Compile-time seams: a declared stage's `name` is typed to the layer's own registry
 * keys (`StagePath`'s key union carried through `StageHandle`'s `TName`), so an
 * unmerged name is a compile error. **`nx run shared-table:typecheck-spec` is what
 * enforces this file** — `nx test` executes `@ts-expect-error` without typechecking
 * it, so a green run proves nothing about it.
 *
 * The two merges below make step 2's `pin`/`audit` runtime fixtures
 * (`engine/compose-table.spec.ts`, `api/features/compose-features.spec.ts`) typecheck.
 */
declare module '../engine/render-stages' {
  interface RenderStageRegistry {
    pin: true;
  }
}
declare module '../engine/pipeline' {
  interface PipelineStageRegistry {
    audit: true;
  }
}

interface Row {
  id: string;
}

/** Typechecks its argument and never calls it. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

describe('declared stage name typing (#155)', () => {
  it('rejects an unknown anchor on the path (base case)', () => {
    typecheckOnly(() => {
      stageSchema<Row>('render', (s) => {
        // @ts-expect-error — 'tre' is not a member of the render layer's anchor union
        s.tre;
      });
    });
  });

  it("carries the layer's merged key union onto a handle, not just its own anchor", () => {
    typecheckOnly(() => {
      stageSchema<Row>('render', (s) => {
        expectTypeOf(s.pin).toEqualTypeOf<
          StageHandle<Row, RenderNodeTransform<Row>, 'group' | 'tree' | 'pin'>
        >();
      });
    });
  });

  it('rejects a declared name outside the registry', () => {
    typecheckOnly(() => {
      stageSchema<Row>('render', (s) => {
        stage(s.tree, {
          // @ts-expect-error — 'pinn' is not a member of RenderStageRegistry
          name: 'pinn',
          placement: 'after',
          run: (n) => n,
        });
      });
    });
  });

  it('accepts a declared name inside the merged registry', () => {
    typecheckOnly(() => {
      stageSchema<Row>('render', (s) => {
        stage(s.tree, {
          name: 'pin',
          placement: 'after',
          run: (n) => n,
        });
      });
    });
  });

  it('does not let the pipeline layer see render-registry keys', () => {
    typecheckOnly(() => {
      stageSchema<Row>('pipeline', (s) => {
        stage(s.sort, {
          // @ts-expect-error — 'pin' is a render-registry key, not a pipeline one
          name: 'pin',
          placement: 'after',
          run: (r) => r,
        });
      });
    });
  });
});
