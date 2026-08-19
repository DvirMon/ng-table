import { describe, expect, it } from 'vitest';
import { describeFeature, SlotRegistry } from './slots';

describe('describeFeature', () => {
  it('names a feature by its position in the features array', () => {
    expect(describeFeature(2)).toBe('features[2]');
  });
});

describe('SlotRegistry', () => {
  it('allows different stages', () => {
    const registry = new SlotRegistry();

    registry.claimStage('sort', 'features[0]');

    expect(() => registry.claimStage('filter', 'features[1]')).not.toThrow();
  });

  it('throws naming both features when a stage is claimed twice', () => {
    const registry = new SlotRegistry();
    registry.claimStage('sort', 'features[0]');

    expect(() => registry.claimStage('sort', 'features[1]')).toThrowError(
      /features\[0\] and features\[1\] both provide the "sort" pipeline stage/
    );
  });

  it('throws naming both features when renderRows is claimed twice', () => {
    const registry = new SlotRegistry();
    registry.claimRenderRows('features[0]');

    expect(() => registry.claimRenderRows('features[1]')).toThrowError(
      /features\[0\] and features\[1\] both provide `renderRows`/
    );
  });
});
