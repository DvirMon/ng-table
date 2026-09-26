import { expectTypeOf } from 'vitest';
import type { PipelineStage } from './pipeline';

expectTypeOf<PipelineStage>().toEqualTypeOf<'filter' | 'group' | 'sort'>();
