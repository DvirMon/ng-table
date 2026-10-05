import { describe, expect, it } from 'vitest';
import { getNgDevMode, setNgDevMode } from '../ng-dev-mode.testing';
import type { LabelledStageRule } from './stage-order';
import { resolveStageOrder } from './stage-order';

type Layer = 'pipeline' | 'render';
type Run = () => void;

/** A distinct identity function per call, so a resolved stage's `run` can be checked against
 *  the exact reference it was declared with, not just its name. */
function run(id: string): Run {
  const fn = (): void => undefined;
  Object.defineProperty(fn, 'name', { value: `run:${id}` });
  return fn;
}

/** Claim form fixture — reuses a built-in anchor's own slot. */
function claim(label: string, anchor: string): LabelledStageRule<Run> {
  return { label, rule: { anchor, run: run(anchor) } };
}

/** Declare form fixture — introduces a new stage next to `anchor`. */
function declare(
  label: string,
  name: string,
  anchor: string,
  placement: 'before' | 'after',
  opts: { synthesizesRows?: boolean } = {},
): LabelledStageRule<Run> {
  return {
    label,
    rule: { anchor, name, placement, synthesizesRows: opts.synthesizesRows, run: run(name) },
  };
}

/** For each resolved stage, the run it must be paired with — the resolved name is the anchor
 *  for a claim, or the declared name for a declare. */
function expectedRunByName(rules: readonly LabelledStageRule<Run>[]): Map<string, Run> {
  return new Map(rules.map(({ rule }) => ['name' in rule ? rule.name : rule.anchor, rule.run]));
}

function assertResolvesTo(
  layer: Layer,
  rules: readonly LabelledStageRule<Run>[],
  expectedNames: readonly string[],
): void {
  const resolved = resolveStageOrder(layer, rules);
  expect(resolved.map((stage) => stage.name)).toEqual(expectedNames);

  const byName = expectedRunByName(rules);
  for (const stage of resolved) {
    expect(stage.run).toBe(byName.get(stage.name));
  }
}

describe('resolveStageOrder', () => {
  describe('resolves the order (dev gate on)', () => {
    it.each<[string, Layer, LabelledStageRule<Run>[], string[]]>([
      [
        'A: built-in claims registered in reverse — pipeline',
        'pipeline',
        [claim('withSort', 'sort'), claim('withGroup', 'group'), claim('withFilter', 'filter')],
        ['filter', 'group', 'sort'],
      ],
      [
        'A: built-in claims registered in reverse — render',
        'render',
        [claim('withTree', 'tree'), claim('withGroup', 'group')],
        ['group', 'tree'],
      ],
      [
        'B: unclaimed built-in left out',
        'pipeline',
        [claim('withFilter', 'filter'), claim('withSort', 'sort')],
        ['filter', 'sort'],
      ],
      [
        'D: declared before',
        'pipeline',
        [
          claim('withFilter', 'filter'),
          claim('withSort', 'sort'),
          declare('withAudit', 'audit', 'filter', 'before'),
        ],
        ['audit', 'filter', 'sort'],
      ],
      [
        'F: unclaimed built-in still anchors',
        'render',
        [claim('withGroup', 'group'), declare('withPin', 'pin', 'tree', 'after')],
        ['group', 'pin'],
      ],
      [
        'G: declared anchors on declared, resolved in registration order',
        'render',
        [
          claim('withGroup', 'group'),
          claim('withTree', 'tree'),
          declare('withBadge', 'badge', 'pin', 'after'),
          declare('withPin', 'pin', 'tree', 'after'),
        ],
        ['group', 'tree', 'pin', 'badge'],
      ],
      [
        'H: different gaps are not a tie',
        'pipeline',
        [
          claim('withFilter', 'filter'),
          claim('withSort', 'sort'),
          declare('withA', 'a', 'filter', 'after'),
          declare('withB', 'b', 'sort', 'before'),
        ],
        ['filter', 'a', 'b', 'sort'],
      ],
      [
        'P: tie resolved by anchoring one on the other',
        'render',
        [
          claim('withGroup', 'group'),
          claim('withTree', 'tree'),
          declare('withAudit', 'audit', 'tree', 'after'),
          declare('withBadge', 'badge', 'audit', 'after'),
        ],
        ['group', 'tree', 'audit', 'badge'],
      ],
      [
        'R: synthesizesRows after render group is allowed',
        'render',
        [
          claim('withGroup', 'group'),
          declare('withHeaders', 'headers', 'group', 'after', { synthesizesRows: true }),
        ],
        ['group', 'headers'],
      ],
    ])('%s', (_description, layer, rules, expectedNames) => {
      assertResolvesTo(layer, rules, expectedNames);
    });
  });

  describe('carries the owning feature label', () => {
    it("a resolved claim and a resolved declare each carry their owning feature's label", () => {
      const resolved = resolveStageOrder('pipeline', [
        claim('withFilter', 'filter'),
        claim('withSort', 'sort'),
        declare('withAudit', 'audit', 'filter', 'after'),
      ]);

      expect(resolved.map((stage) => [stage.name, stage.label])).toEqual([
        ['filter', 'withFilter'],
        ['audit', 'withAudit'],
        ['sort', 'withSort'],
      ]);
    });
  });

  describe('throws on wiring errors (dev gate on)', () => {
    it.each<[string, Layer, LabelledStageRule<Run>[], RegExp[]]>([
      [
        'I: unknown anchor',
        'render',
        [declare('withBadge', 'badge', 'pin', 'after')],
        [/^\[createTable\]/, /withBadge/, /"pin"/, /unknown anchor/i],
      ],
      [
        'J: pipeline group anchor is not anchor-eligible',
        'pipeline',
        [claim('withGrouping', 'group'), declare('withAudit', 'audit', 'group', 'after')],
        [/^\[createTable\]/, /withAudit/, /"group"/, /not anchor-eligible/],
      ],
      [
        'K: cycle',
        'pipeline',
        [declare('withA', 'a', 'b', 'after'), declare('withB', 'b', 'a', 'after')],
        [/^\[createTable\]/, /cycle/i, /withA/, /withB/, /"a"/, /"b"/],
      ],
      [
        'L: duplicate declared name',
        'render',
        [declare('withPinA', 'pin', 'tree', 'after'), declare('withPinB', 'pin', 'tree', 'after')],
        [/^\[createTable\]/, /withPinA/, /withPinB/, /"pin"/, /duplicate/i],
      ],
      [
        'M: declared name equals a built-in',
        'render',
        [declare('withShadow', 'tree', 'group', 'after')],
        [/^\[createTable\]/, /withShadow/, /"tree"/, /duplicate/i],
      ],
      [
        'O: tie in one gap, different anchors',
        'render',
        [
          claim('withGroup', 'group'),
          claim('withTree', 'tree'),
          declare('withA', 'a', 'group', 'after'),
          declare('withB', 'b', 'tree', 'before'),
        ],
        [/^\[createTable\]/, /"a"/, /"b"/, /withA/, /withB/, /anchor one on the other/],
      ],
      [
        'N: tie in one gap, same anchor and placement',
        'render',
        [
          claim('withGroup', 'group'),
          claim('withTree', 'tree'),
          declare('withA', 'a', 'tree', 'after'),
          declare('withB', 'b', 'tree', 'after'),
        ],
        [/^\[createTable\]/, /"a"/, /"b"/, /withA/, /withB/, /anchor one on the other/],
      ],
      [
        'Q: synthesizesRows before render group',
        'render',
        [declare('withHeaders', 'headers', 'group', 'before', { synthesizesRows: true })],
        [/^\[createTable\]/, /withHeaders/, /"headers"/, /"group"/, /synthesizesRows/],
      ],
    ])('%s', (_description, layer, rules, patterns) => {
      let message = '';
      expect(() => {
        try {
          resolveStageOrder(layer, rules);
        } catch (error) {
          message = (error as Error).message;
          throw error;
        }
      }).toThrow();
      for (const pattern of patterns) {
        expect(message).toMatch(pattern);
      }
    });
  });

  describe('dev checks off', () => {
    it.each<[string, Layer, LabelledStageRule<Run>[], string[]]>([
      [
        'S: tie falls back to name order',
        'render',
        [
          claim('withGroup', 'group'),
          claim('withTree', 'tree'),
          declare('withZeta', 'zeta', 'tree', 'after'),
          declare('withAlpha', 'alpha', 'tree', 'after'),
        ],
        ['group', 'tree', 'alpha', 'zeta'],
      ],
      [
        'T: offending declared stages are dropped, valid ones still run in order',
        'pipeline',
        [
          claim('withFilter', 'filter'),
          claim('withSort', 'sort'),
          declare('withAudit', 'audit', 'filter', 'after'),
          declare('withGhost', 'ghost', 'nonexistent', 'after'),
          declare('withBadAnchor', 'bad', 'group', 'after'),
          declare('withX', 'x', 'y', 'after'),
          declare('withY', 'y', 'x', 'after'),
          declare('withDup1', 'dup', 'filter', 'after'),
          declare('withDup2', 'dup', 'sort', 'after'),
        ],
        ['filter', 'audit', 'sort', 'dup'],
      ],
    ])('%s', (_description, layer, rules, expectedNames) => {
      const previous = getNgDevMode();
      setNgDevMode(false);
      try {
        assertResolvesTo(layer, rules, expectedNames);
      } finally {
        setNgDevMode(previous);
      }
    });
  });
});
