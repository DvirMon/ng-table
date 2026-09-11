import { computed, linkedSignal, signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  FilterNode,
  FilterRuleRecord,
  FilterValueOfContext,
  Filters,
  FiltersRoot,
} from '../filters.types';

/** Structural equality for the criterion shapes this library ships: primitives, plain range
 *  objects (`{min,max}`/`{from,to}`), and arrays. Not a general deep-equal — custom `filter()`
 *  criteria with richer shapes get reference equality, which only affects `dirty()`'s harmless
 *  "user typed exactly the source value" case, not correctness elsewhere. */
export function equalsCriterion(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => equalsCriterion(value, b[index]));
  }
  if (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every((key) => equalsCriterion(aRecord[key], bRecord[key]));
  }
  return false;
}

interface FilterState<TCriterion> {
  readonly node: FilterNode<TCriterion>;
  readonly sourceValue: Signal<TCriterion>;
}

/** Builds one filter's reactive state (`value`/`active`/`reset`/`dirty`) per `filters.md`'s
 *  "State" and "Sources" sections. `dirty` is a `computed()`, never a stored flag (R19). */
export function buildFilterState<TCriterion>(
  record: FilterRuleRecord<unknown, unknown, TCriterion>
): FilterState<TCriterion> {
  const emptyValue = record.emptyValue;
  const source = record.options?.source;

  const sourceValue: Signal<TCriterion> = source ? computed(source) : computed(() => emptyValue);

  const value: WritableSignal<TCriterion> = source
    ? linkedSignal<TCriterion, TCriterion>({
        source: sourceValue,
        computation: (src, previous) => {
          if (previous !== undefined && !equalsCriterion(previous.value, previous.source)) {
            return previous.value; // dirty — a later source arrival must not stomp it
          }
          return src;
        },
      })
    : signal(emptyValue);

  const dirty = computed(() => !equalsCriterion(value(), sourceValue()));

  const reset = (next?: TCriterion | null): void => {
    if (next === undefined) {
      value.set(sourceValue());
    } else if (next === null) {
      value.set(emptyValue);
    } else {
      value.set(next);
    }
  };

  const active = (): TCriterion | undefined => (record.isEmpty(value()) ? undefined : value());

  return { node: { value, active, reset, dirty }, sourceValue };
}

/** Wraps a base node so `active()` also depends on `applyWhen`'s condition — the criterion,
 *  `reset`, and `dirty` are unaffected by the gate. */
export function gateByCondition<TRow, TCriterion>(
  base: FilterNode<TCriterion>,
  condition: (ctx: FilterValueOfContext<TRow>) => boolean,
  ctx: FilterValueOfContext<TRow>
): FilterNode<TCriterion> {
  return {
    value: base.value,
    reset: base.reset,
    dirty: base.dirty,
    active: (): TCriterion | undefined => (condition(ctx) ? base.active() : undefined),
  };
}

export function buildFiltersRoot<TState extends Record<string, unknown>>(
  nodesByKey: ReadonlyMap<string, FilterNode<unknown>>
): FiltersRoot<TState> {
  return {
    value: (): TState => {
      const result: Record<string, unknown> = {};
      for (const [key, node] of nodesByKey) {
        result[key] = node.value();
      }
      return result as TState;
    },
    active: (): Partial<TState> => {
      const result: Record<string, unknown> = {};
      for (const [key, node] of nodesByKey) {
        const criterion = node.active();
        if (criterion !== undefined) {
          result[key] = criterion;
        }
      }
      return result as Partial<TState>;
    },
    reset: (next?: TState | null): void => {
      for (const [key, node] of nodesByKey) {
        if (next === undefined) {
          node.reset();
        } else if (next === null) {
          node.reset(null);
        } else {
          node.reset((next as Record<string, unknown>)[key]);
        }
      }
    },
    dirty: (): boolean => {
      for (const node of nodesByKey.values()) {
        if (node.dirty()) {
          return true;
        }
      }
      return false;
    },
  };
}

/** Callable (root state) + indexable (child nodes) — mirrors Signal Forms: property access is
 *  a child, a call is state. Each indexed property returns a *function* yielding the node
 *  (`filters.status()` → node), per `Filters<TRow, TState>`'s mapped-type shape. */
export function buildFiltersObject<TRow, TState extends Record<string, unknown>>(
  nodesByKey: ReadonlyMap<string, FilterNode<unknown>>
): Filters<TRow, TState> {
  const root = buildFiltersRoot<TState>(nodesByKey);
  const callable = ((): FiltersRoot<TState> => root) as Filters<TRow, TState>;
  const childGetters = new Map<string, () => FilterNode<unknown>>();
  for (const [key, node] of nodesByKey) {
    childGetters.set(key, () => node);
  }

  return new Proxy(callable, {
    apply(target, thisArg, args): unknown {
      return Reflect.apply(target as (...a: unknown[]) => unknown, thisArg, args);
    },
    get(target, property, receiver): unknown {
      if (typeof property === 'string') {
        const getter = childGetters.get(property);
        if (getter) {
          return getter;
        }
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
