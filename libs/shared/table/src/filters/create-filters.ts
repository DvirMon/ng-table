import { Injector, inject, runInInjectionContext } from '@angular/core';
import { buildValueOfContext, type FiltersInternal } from './evaluator';
import type { RowToken } from './row-of';
import { buildFilterState, buildFiltersObject, gateByCondition } from './state';
import {
  type FilterHandle,
  type FilterNode,
  type FilterRuleRecord,
  type FilterValueOfContext,
  type Filters,
  type FiltersPath,
  type StateOf,
} from './types';
import { pathsOf, validateRecords } from './validate';

/**
 * Runtime shape of the node `applyWhen()` returns. `ConditionalRule<S>`'s static type
 * is a pure `{ kind, children }` carrier with no `condition` member; at runtime the node
 * additionally carries `condition`. This asserts that shape back when the flattener recurses
 * into it — the assertion is narrow and local to this one read.
 */
interface ConditionalNode<TRow> {
  readonly kind: 'conditional';
  readonly children: readonly unknown[];
  readonly condition: (ctx: FilterValueOfContext<TRow>) => boolean;
}

function isConditionalNode<TRow>(item: unknown): item is ConditionalNode<TRow> {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  // Every member the flattener goes on to destructure is checked here — `kind` alone would
  // license reading `children`/`condition` off a record that merely shares the discriminant,
  // and a re-tagged leaf record carries `kind: 'conditional'` without either of them.
  const isTaggedConditional = 'kind' in item && item.kind === 'conditional';
  const hasChildren = 'children' in item && Array.isArray(item.children);
  const hasCondition = 'condition' in item && typeof item.condition === 'function';
  return isTaggedConditional && hasChildren && hasCondition;
}

/**
 * Runtime mirror of `types.ts`'s `Flatten` — recurses through nested arrays and through a
 * conditional node's children, re-tagging each leaf record found inside a conditional with
 * `kind: 'conditional'` plus the shared `condition` — the re-tag happens here, not in
 * `rules.ts`, because the node's static type carries no `condition` to re-tag from.
 */
function flattenRules<TRow>(items: readonly unknown[]): FilterRuleRecord<TRow>[] {
  const records: FilterRuleRecord<TRow>[] = [];
  for (const item of items) {
    if (Array.isArray(item)) {
      records.push(...flattenRules<TRow>(item));
      continue;
    }
    if (isConditionalNode<TRow>(item)) {
      const { children, condition } = item;
      for (const child of flattenRules<TRow>(children)) {
        records.push({ ...child, kind: 'conditional', condition });
      }
      continue;
    }
    records.push(item as FilterRuleRecord<TRow>);
  }
  return records;
}

/**
 * Structural `path` proxy handed to a schema fn — fabricates a `FilterHandle` per string
 * property and caches it, so a schema passing the same path to two rules gets identity-stable
 * handles. No argument and no recorder: every rule builds and returns its own record.
 */
function buildFiltersPath<TRow>(): FiltersPath<TRow> {
  const handleCache = new Map<string, FilterHandle<TRow, Extract<keyof TRow, string>>>();

  // `FiltersPath<TRow>` is a conditional type — TRow isn't concrete here, so the
  // conditional can't resolve and a direct `as FiltersPath<TRow>` is rejected as a non-overlapping
  // cast. Widen through `unknown` rather than weakening the brand.
  return new Proxy(
    {},
    {
      get(_target, property): FilterHandle<TRow, Extract<keyof TRow, string>> | undefined {
        if (typeof property !== 'string') {
          return undefined;
        }
        const cached = handleCache.get(property);
        if (cached) {
          return cached;
        }
        const handle: FilterHandle<TRow, Extract<keyof TRow, string>> = {
          id: property as Extract<keyof TRow, string>,
        };
        handleCache.set(property, handle);
        return handle;
      },
    }
  ) as unknown as FiltersPath<TRow>;
}

/**
 * `rows` is an inference anchor. It is never read at runtime.
 *
 * Accepts row data — an array, a readonly array, any callable returning rows (`Signal`,
 * `WritableSignal`, a signal of rows-or-undefined, a bare store accessor) — or `rowOf<TRow>()`
 * when no row data exists yet (server mode, R10/R11). See `docs/1-state/filters.md`.
 */
export function createFilters<TRow, S extends readonly unknown[]>(
  rows: readonly TRow[] | (() => readonly TRow[] | undefined) | RowToken<TRow>,
  schema: (path: FiltersPath<TRow>) => S,
  opts?: { injector?: Injector }
): Filters<TRow, StateOf<S>> {
  void rows;
  const injector = opts?.injector ?? inject(Injector);

  const path = buildFiltersPath<TRow>();
  const declared = schema(path);

  if (!Array.isArray(declared)) {
    throw new Error(
      '[createFilters] The schema function must return its rules. A body that calls rules as ' +
        'statements declares nothing — return an array: (path) => [equals(path.status)]'
    );
  }

  const records = flattenRules<TRow>(declared);

  return runInInjectionContext(injector, () => {
    validateRecords(records);

    const nodesByKey = new Map<string, FilterNode<unknown>>();
    const pathToKey = new Map<string, string>();
    const pendingGates: { key: string; condition: (ctx: FilterValueOfContext<TRow>) => boolean }[] = [];

    for (const record of records) {
      const { node } = buildFilterState(record);
      nodesByKey.set(record.key, node);
      for (const filterPath of pathsOf(record)) {
        pathToKey.set(filterPath, record.key);
      }
      if (record.condition) {
        pendingGates.push({ key: record.key, condition: record.condition });
      }
    }

    // Holds the same `nodesByKey` reference the gating pass mutates below, so it exposes the
    // gated nodes either way.
    const internal: FiltersInternal<TRow> = { records, nodesByKey, pathToKey };

    // Second pass: applyWhen's condition may read any filter's value, including one declared
    // after it — gate only once every node exists.
    if (pendingGates.length > 0) {
      const ctx = buildValueOfContext<TRow>(internal);
      for (const { key, condition } of pendingGates) {
        const base = nodesByKey.get(key);
        if (base) {
          nodesByKey.set(key, gateByCondition(base, condition, ctx));
        }
      }
    }

    return buildFiltersObject<TRow, StateOf<S>>(internal);
  });
}
