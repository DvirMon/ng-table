import { describe, expect, it } from 'vitest';
import {
  CORE_MEMBER_KEYS,
  describeFeature,
  describeInnerFeature,
  describeInternalFeature,
  SlotRegistry,
} from './slots';

describe('describeFeature', () => {
  it('names a consumer feature by its 1-based argument position', () => {
    expect(describeFeature(2)).toBe('feature 2');
  });

  it('appends the display name when given one', () => {
    expect(describeFeature(3, 'withComputed')).toBe('feature 3 (withComputed)');
  });
});

describe('describeInternalFeature', () => {
  it('names an engine-internal feature by its 1-based position', () => {
    expect(describeInternalFeature(1)).toBe('internal feature 1');
  });
});

describe('describeInnerFeature', () => {
  it('names a feature by its 1-based position inside a composite', () => {
    expect(describeInnerFeature(2)).toBe('composeFeatures inner feature 2');
  });

  it('appends the display name when given one', () => {
    expect(describeInnerFeature(1, 'withSorting')).toBe(
      'composeFeatures inner feature 1 (withSorting)'
    );
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

  describe('core member keys', () => {
    it.each(CORE_MEMBER_KEYS)(
      'throws naming core and the feature when a feature claims "%s"',
      (key) => {
        const registry = new SlotRegistry();
        registry.claimCoreMembers();

        expect(() => registry.claimMember(key, 'feature 1')).toThrowError(
          new RegExp(`core and feature 1 both provide the "${key}" store member`)
        );
      }
    );

    it('leaves totalRowCount claimable (ADR-0005)', () => {
      const registry = new SlotRegistry();
      registry.claimCoreMembers();

      expect(() =>
        registry.claimMember('totalRowCount', 'feature 1')
      ).not.toThrow();
    });

    it('throws when the core members are pre-claimed twice', () => {
      const registry = new SlotRegistry();
      registry.claimCoreMembers();

      expect(() => registry.claimCoreMembers()).toThrowError(
        /core and core both provide the "\w+" store member/
      );
    });

    it('leaves a non-core member unaffected', () => {
      const registry = new SlotRegistry();
      registry.claimCoreMembers();

      expect(() => registry.claimMember('editing', 'feature 1')).not.toThrow();
    });
  });
});
