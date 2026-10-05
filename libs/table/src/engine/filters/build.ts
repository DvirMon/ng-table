import { buildCriterionOfContext, type FiltersInternal } from './evaluator';
import { buildFilterState, buildFiltersObject, gateByCondition } from './state';
import type {
  AnyRule,
  FilterHandle,
  FilterRuleRecord,
  FilterValueOfContext,
  StateOf,
} from './types';
import type { Filters, FiltersPath, FilterNode } from '../../api/features/with-filtering/types';
import type { ColumnDef, ColumnValueMap } from '../../api/types';
import { createPathProxy } from '../../schema/path-proxy';
import { assertDeclarationsAreKnown } from '../../schema/validate';
import { pathsOf, validateRecords } from './validate';

// Stamps each declared rule's key from its object-literal property name — the schema's object
// shape is itself the key source, so there is nothing left to flatten.
function keyRules<TRow>(declared: Record<string, AnyRule>): FilterRuleRecord<TRow>[] {
  return Object.entries(declared).map(
    ([key, rule]) =>
      ({ ...(rule as Omit<FilterRuleRecord<TRow>, 'key'>), key }) satisfies FilterRuleRecord<TRow>,
  );
}

// Structural `path` proxy handed to a schema fn — fabricates a `FilterHandle` per string
// property, via the same Proxy+cache mechanism columns/grouping use. No recorder session here,
// deliberately: unlike `visible`/`grouping` (imperative calls that must be collected
// as a side effect while the schema fn runs), every filter rule builder is a pure function that
// immediately returns its own record — the schema fn's own returned object *is* the full
// declaration, so there is nothing a session would need to collect.
function buildFiltersPath<TRow, TValues extends ColumnValueMap>(): FiltersPath<TRow, TValues> {
  // `createPathProxy` returns `Record<string, THandle>` — its key domain (every string) doesn't
  // structurally overlap with `FiltersPath`'s mapped-type domain (`ColumnIdIn<TValues>` literals),
  // so a single `as` isn't accepted; the proxy's runtime behavior (fabricate-per-property) is what
  // actually enforces the narrower domain.
  return createPathProxy(
    (id): FilterHandle<TRow, Extract<keyof TValues, string>> => ({
      id: id as Extract<keyof TValues, string>,
    }),
  ) as unknown as FiltersPath<TRow, TValues>;
}

/**
 * Builds the filter model from a schema function — the internal engine behind `withFiltering`'s
 * `schema` config. Not part of the public API; the feature is the only caller. See
 * `docs/1-state/features/filtering.md`.
 *
 * @remarks
 * `columns` is a getter, not an array — `table.columns` is writable (`setColumns`), so the
 * evaluator re-resolves the current list at evaluation time rather than a construction-time
 * snapshot.
 */
export function buildFilterModel<
  TRow,
  TValues extends ColumnValueMap,
  S extends Record<string, AnyRule>,
>(
  schema: (path: FiltersPath<TRow, TValues>) => S,
  columns: () => readonly ColumnDef<TRow>[],
): Filters<TRow, StateOf<S>> {
  const path = buildFiltersPath<TRow, TValues>();
  const declared = schema(path);

  const isSchemaObject =
    typeof declared === 'object' && declared !== null && !Array.isArray(declared);
  if (!isSchemaObject) {
    throw new Error(
      '[withFiltering] The schema function must return its rules as an object literal. A body ' +
        'that calls rules as statements declares nothing — return an object: ' +
        '(path) => ({ status: equals(path.status) })',
    );
  }

  const records = keyRules<TRow>(declared);
  validateRecords(records);
  assertDeclarationsAreKnown(
    records.flatMap((record) => pathsOf(record)),
    columns().map((column) => column.id),
    'withFiltering',
  );

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
  const internal: FiltersInternal<TRow> = { records, nodesByKey, pathToKey, columns };

  // Second pass: a `when` condition may read any filter's value, including one declared after
  // it — gate only once every node exists.
  if (pendingGates.length > 0) {
    const ctx = buildCriterionOfContext<TRow>(internal);
    for (const { key, when } of pendingGates) {
      const base = nodesByKey.get(key);
      if (base) {
        nodesByKey.set(key, gateByCondition(base, when, ctx));
      }
    }
  }

  return buildFiltersObject<TRow, StateOf<S>>(internal);
}
