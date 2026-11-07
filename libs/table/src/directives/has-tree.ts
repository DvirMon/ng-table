import type { TreeMembers } from '../api/features/with-tree/types';

/** Whether `table` composes `withTree()` and so carries the `tree` members. */
export function hasTree(table: unknown): table is TreeMembers {
  if (typeof table !== 'object' || table === null || !('tree' in table)) return false;
  return typeof table.tree === 'function' && 'toggle' in table.tree;
}
