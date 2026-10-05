import { describe, expect, it } from 'vitest';
import { flattenVisible } from './flatten';
import type { RenderNode } from './render-stages';

type Row = { id: string };

function node(id: string, overrides: Partial<RenderNode<Row>> = {}): RenderNode<Row> {
  return {
    id,
    kind: 'row',
    data: { id },
    children: [],
    ...overrides,
  };
}

describe('flattenVisible', () => {
  describe('descent', () => {
    it('yields the children of an open node', () => {
      const tree = [node('parent', { children: [node('child')] })];

      const result = flattenVisible(tree, new Set(['parent']));

      expect(result.map((r) => r.id)).toEqual(['parent', 'child']);
    });

    it('does not yield the children of a closed node', () => {
      const tree = [node('parent', { children: [node('child')] })];

      const result = flattenVisible(tree, new Set());

      expect(result.map((r) => r.id)).toEqual(['parent']);
    });

    it('is transitive: a grandchild is absent when the grandparent is closed, even when the parent id is in expanded', () => {
      const tree = [
        node('grandparent', {
          children: [node('parent', { children: [node('grandchild')] })],
        }),
      ];

      // 'parent' is open, but its own ancestor 'grandparent' is not — descent never
      // reaches 'parent' at all, so its membership in `expanded` is moot.
      const result = flattenVisible(tree, new Set(['parent']));

      expect(result.map((r) => r.id)).toEqual(['grandparent']);
    });
  });

  describe('depth', () => {
    it('derives depth from nesting position, incrementing by one at every level', () => {
      const tree = [
        node('root', {
          children: [node('child', { children: [node('grandchild')] })],
        }),
      ];

      const result = flattenVisible(tree, new Set(['root', 'child']));

      expect(result.map((r) => [r.id, r.depth])).toEqual([
        ['root', 0],
        ['child', 1],
        ['grandchild', 2],
      ]);
    });
  });

  describe('parentId', () => {
    it('derives parentId from position; a root node carries undefined', () => {
      const tree = [node('root', { children: [node('child')] })];

      const result = flattenVisible(tree, new Set(['root']));

      expect(result.map((r) => [r.id, r.parentId])).toEqual([
        ['root', undefined],
        ['child', 'root'],
      ]);
    });
  });

  describe('hasChildren resolution', () => {
    it('defaults to children.length > 0', () => {
      const tree = [node('withKids', { children: [node('kid')] }), node('leaf')];

      const result = flattenVisible(tree, undefined);

      expect(result.find((r) => r.id === 'withKids')?.hasChildren).toBe(true);
      expect(result.find((r) => r.id === 'leaf')?.hasChildren).toBe(false);
    });

    it('an explicit hasChildren: true wins on a node with children: [] (lazy row, C3)', () => {
      const tree = [node('lazy', { hasChildren: true, children: [] })];

      const result = flattenVisible(tree, undefined);

      expect(result[0].hasChildren).toBe(true);
    });

    it('an explicit hasChildren: false wins on a node that has children', () => {
      const tree = [node('flagged', { hasChildren: false, children: [node('kid')] })];

      const result = flattenVisible(tree, new Set(['flagged']));

      expect(result.find((r) => r.id === 'flagged')?.hasChildren).toBe(false);
    });
  });

  describe('descent is isOpen alone', () => {
    it('a node with hasChildren: true and an empty children array yields nothing extra when open', () => {
      const tree = [node('lazy', { hasChildren: true, children: [] })];

      const result = flattenVisible(tree, new Set(['lazy']));

      expect(result.map((r) => r.id)).toEqual(['lazy']);
    });

    it('a node with hasChildren: false but a non-empty children array still yields them when open', () => {
      const tree = [node('flagged', { hasChildren: false, children: [node('kid')] })];

      const result = flattenVisible(tree, new Set(['flagged']));

      expect(result.map((r) => r.id)).toEqual(['flagged', 'kid']);
    });
  });

  describe('isExpanded stamping (D1 / D1a)', () => {
    it('is undefined on every row, headers included, when expanded is undefined — zero contributors', () => {
      const tree = [node('header', { kind: 'group', data: null, children: [node('row1')] })];

      const result = flattenVisible(tree, undefined);

      expect(result.map((r) => r.isExpanded)).toEqual([undefined, undefined]);
      // Everything stays visible too — undefined never suppresses descent.
      expect(result.map((r) => r.id)).toEqual(['header', 'row1']);
    });

    it('is true/false per membership on nodes with children, under a contributed set', () => {
      const tree = [
        node('open', { children: [node('a')] }),
        node('closed', { children: [node('b')] }),
      ];

      const result = flattenVisible(tree, new Set(['open']));

      expect(result.find((r) => r.id === 'open')?.isExpanded).toBe(true);
      expect(result.find((r) => r.id === 'closed')?.isExpanded).toBe(false);
    });

    it('is undefined on a leaf, whether or not it is a member of the contributed set', () => {
      const leafInSet = flattenVisible([node('leaf')], new Set(['leaf']));
      const leafNotInSet = flattenVisible([node('leaf')], new Set());

      expect(leafInSet[0].isExpanded).toBeUndefined();
      expect(leafNotInSet[0].isExpanded).toBeUndefined();
    });
  });

  describe('X1 — zero contributors vs. empty set', () => {
    it('undefined shows every nested row', () => {
      const tree = [node('parent', { children: [node('child')] })];

      const result = flattenVisible(tree, undefined);

      expect(result.map((r) => r.id)).toEqual(['parent', 'child']);
    });

    it('a defined but empty set hides every nested row', () => {
      const tree = [node('parent', { children: [node('child')] })];

      const result = flattenVisible(tree, new Set());

      expect(result.map((r) => r.id)).toEqual(['parent']);
    });
  });
});
