import type { RowId } from '../../../index';
import type { DealRow } from '../fixtures/types';

// One copier per column id that can be a grouping level. Folded per active level rather than
// spreading the template row wholesale: a spread would also carry `id` and `amount`, the two
// fields a new row must not inherit.
const LEVEL_COPIERS: Record<
  string,
  (from: DealRow, draft: DealRow) => DealRow
> = {
  region: (from, draft) => ({ ...draft, region: from.region }),
  category: (from, draft) => ({ ...draft, category: from.category }),
  rep: (from, draft) => ({ ...draft, rep: from.rep }),
  owner: (from, draft) => ({ ...draft, owner: from.owner }),
  amount: (from, draft) => ({ ...draft, amount: from.amount }),
  closedAt: (from, draft) => ({ ...draft, closedAt: from.closedAt }),
};

function createBlankRow(id: RowId, template: DealRow): DealRow {
  return {
    id,
    region: null,
    category: 'Hardware',
    rep: 'Unassigned',
    amount: 0,
    closedAt: new Date(),
    owner: template.owner,
  };
}

/**
 * Builds the row a group's Add row to group button inserts, keyed to that group on every level
 * in `levels`. `template` is any leaf already in the group.
 *
 * @remarks
 * Note: leaf-level headers only. An ancestor group pins its own level and leaves the deeper ones
 * undecided, so `template`'s values for those would be an arbitrary pick.
 */
export function createRowForGroup(
  template: DealRow,
  levels: readonly string[],
  id: RowId,
): DealRow {
  return levels.reduce(
    (draft, level) => LEVEL_COPIERS[level]?.(template, draft) ?? draft,
    createBlankRow(id, template),
  );
}
