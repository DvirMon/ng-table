import { buildValueOfContext, type FiltersInternal } from './evaluator';
import { buildFilterState, buildFiltersObject, gateByCondition } from './state';
import type { AnyRule, FilterHandle, FilterRuleRecord, FilterValueOfContext, StateOf } from './types';
import type { Filters, FiltersPath, FilterNode } from '../../api/features/with-filtering/types';
import { createPathProxy } from '../../schema/path-proxy';
import { pathsOf, validateRecords } from './validate';

// Stamps each declared rule's key from its object-literal property name — the schema's object
// shape is itself the key source, so there is nothing left to flatten.
function keyRules<TRow>(declared: Record<string, AnyRule>): FilterRuleRecord<TRow>[] {
  return Object.entries(declared).map(
    ([key, rule]) =>
      ({ ...(rule as Omit<FilterRuleRecord<TRow>, 'key'>), key }) satisfies FilterRuleRecord<TRow>
  );
}

// Structural `path` proxy handed to a schema fn — fabricates a `FilterHandle` per string
// property, via the same Proxy+cache mechanism columns/grouping use. No recorder session here,
// deliberately: unlike `visible`/`grouping` (imperative calls that must be collected
// as a side effect while the schema fn runs), every filter rule builder is a pure function that
// immediately returns its own record — the schema fn's own returned object *is* the full
// declaration, so there is nothing a session would need to collect.
function buildFiltersPath<TRow>(): FiltersPath<TRow> {
  return createPathProxy(
    (id): FilterHandle<TRow, Extract<keyof TRow, string>> => ({
      id: id as Extract<keyof TRow, string>,
    })
  ) as FiltersPath<TRow>;
}

/**
 * Builds the filter model from a schema function — the internal engine behind `withFiltering`'s
 * `schema` config. Not part of the public API; the feature is the only caller. See
 * `docs/1-state/features/filtering.md`.
 */
export function buildFilterModel<TRow, S extends Record<string, AnyRule>>(
  schema: (path: FiltersPath<TRow>) => S
): Filters<TRow, StateOf<S>> {
  const path = buildFiltersPath<TRow>();
  const declared = schema(path);

  const isSchemaObject =
    typeof declared === 'object' && declared !== null && !Array.isArray(declared);
  if (!isSchemaObject) {
    throw new Error(
      '[withFiltering] The schema function must return its rules as an object literal. A body ' +
        'that calls rules as statements declares nothing — return an object: ' +
        '(path) => ({ status: equals(path.status) })'
    );
  }

  const records = keyRules<TRow>(declared);
  validateRecords(records);

  const nodesByKey = new Map<string, FilterNode<unknown>>();
  const pathToKey = new Map<string, string>();
  const pendingGates: { key: string; when: (ctx: FilterValueOfContext<TRow>) => boolean }[] = [];

  for (const record of records) {
    const { node } = buildFilterState(record);
    nodesByKey.set(record.key, node);
    for (const filterPath of pathsOf(record)) {
      pathToKey.set(filterPath, record.key);
    }
    if (record.options?.when) {
      pendingGates.push({ key: record.key, when: record.options.when });
    }
  }

  // Holds the same `nodesByKey` reference the gating pass mutates below, so it exposes the
  // gated nodes either way.
  const internal: FiltersInternal<TRow> = { records, nodesByKey, pathToKey };

  // Second pass: a `when` condition may read any filter's value, including one declared after
  // it — gate only once every node exists.
  if (pendingGates.length > 0) {
    const ctx = buildValueOfContext<TRow>(internal);
    for (const { key, when } of pendingGates) {
      const base = nodesByKey.get(key);
      if (base) {
        nodesByKey.set(key, gateByCondition(base, when, ctx));
      }
    }
  }

  return buildFiltersObject<TRow, StateOf<S>>(internal);
}
