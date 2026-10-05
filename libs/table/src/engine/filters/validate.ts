import type { FilterRuleRecord } from './types';

/** A 'group' record's own paths come from its children; every other kind carries them directly. */
export function pathsOf<TRow>(record: FilterRuleRecord<TRow>): readonly string[] {
  return record.children ? record.children.map((child) => child.path) : record.paths;
}

/** Construction-time validation: one filter per path, no empty `anyOf` group. Duplicate keys
 *  are already a compile error (an object literal can't repeat a key). All deterministic,
 *  fire before data flows — throw. */
export function validateRecords<TRow>(records: readonly FilterRuleRecord<TRow>[]): void {
  const keyOwnerByPath = new Map<string, string>();

  for (const record of records) {
    if (record.kind === 'group' && (!record.children || record.children.length === 0)) {
      throw new Error(`[withFiltering] "${record.key}": anyOf(…) declared no rules.`);
    }

    for (const path of pathsOf(record)) {
      const existingOwner = keyOwnerByPath.get(path);
      if (existingOwner !== undefined && existingOwner !== record.key) {
        throw new Error(
          `[withFiltering] "${existingOwner}" and "${record.key}" both filter path "${path}". ` +
            'Only one filter may target a given path — two keys may not target one path. ' +
            'Combine with filter() over a compound criterion instead.',
        );
      }
      keyOwnerByPath.set(path, record.key);
    }
  }
}
