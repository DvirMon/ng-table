import type { FilterRuleRecord } from '../filters.types';

/** A 'group' record's own paths come from its children; every other kind carries them directly. */
export function pathsOf<TRow>(record: FilterRuleRecord<TRow>): readonly string[] {
  return record.children ? record.children.map((child) => child.path) : record.paths;
}

/** Construction-time validation (ADR-0014): one filter per path, no colliding keys, no empty
 *  `anyOf` group. All deterministic, fire before data flows — throw. */
export function validateRecords<TRow>(records: readonly FilterRuleRecord<TRow>[]): void {
  const keyOwnerByPath = new Map<string, string>();
  const seenKeys = new Set<string>();

  for (const record of records) {
    if (!record.key) {
      throw new Error(
        "[createFilters] anyOf(key, …) requires a non-empty key — a group has no path to " +
          'borrow one from.'
      );
    }
    if (record.kind === 'group' && (!record.children || record.children.length === 0)) {
      throw new Error(`[createFilters] anyOf("${record.key}", …) declared no rules.`);
    }

    if (seenKeys.has(record.key)) {
      throw new Error(
        `[createFilters] Two filters both resolve to the key "${record.key}". Give one an ` +
          "explicit, distinct `as` name."
      );
    }
    seenKeys.add(record.key);

    for (const path of pathsOf(record)) {
      const existingOwner = keyOwnerByPath.get(path);
      if (existingOwner !== undefined && existingOwner !== record.key) {
        throw new Error(
          `[createFilters] "${existingOwner}" and "${record.key}" both filter path "${path}". ` +
            'Only one filter may target a given path — an `as` rename does not license a ' +
            'second one. Combine with filter() over a compound criterion instead.'
        );
      }
      keyOwnerByPath.set(path, record.key);
    }
  }
}
