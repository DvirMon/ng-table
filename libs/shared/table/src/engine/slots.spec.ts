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

  it('allows different members', () => {
    const registry = new SlotRegistry();

    registry.claimMember('editing', 'features[0]');

    expect(() => registry.claimMember('pending', 'features[1]')).not.toThrow();
  });

  it('throws naming both features when a member is claimed twice', () => {
    const registry = new SlotRegistry();
    registry.claimMember('editing', 'features[0]');

    expect(() => registry.claimMember('editing', 'features[1]')).toThrowError(
      /features\[0\] and features\[1\] both provide the "editing" store member/
    );
  });

  it('allows different render stages', () => {
    const registry = new SlotRegistry();

    registry.claimRenderStage('tree', 'features[0]');

    expect(() => registry.claimRenderStage('group', 'features[1]')).not.toThrow();
  });

  it('throws naming both features when a render stage is claimed twice', () => {
    const registry = new SlotRegistry();
    registry.claimRenderStage('tree', 'features[0]');

    expect(() => registry.claimRenderStage('tree', 'features[1]')).toThrowError(
      /features\[0\] and features\[1\] both provide the "tree" render stage/
    );
  });
});
