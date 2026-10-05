import type { ExpansionMembers } from '../api/features/with-expansion';

export function hasExpansion(table: unknown): table is ExpansionMembers {
  if (typeof table !== 'object' || table === null || !('expansion' in table)) return false;
  return typeof table.expansion === 'function' && 'expand' in table.expansion;
}
