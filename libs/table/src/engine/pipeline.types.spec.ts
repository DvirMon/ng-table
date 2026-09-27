import { describe, expectTypeOf, it } from 'vitest';
import type { PipelineStage } from './pipeline';

describe('PipelineStage — registry-derived key type', () => {
  it('equals the literal union of the registered anchors', () => {
    expectTypeOf<PipelineStage>().toEqualTypeOf<'filter' | 'group' | 'sort' | 'audit'>();
  });
});
