import {
  computed,
  linkedSignal,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import type {
  FilterNode,
  FilterRuleRecord,
  FilterValueOfContext,
  Filters,
  FiltersRoot,
} from './types';
import { createFilterEvaluatorFrom, type FiltersInternal } from './evaluator';

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
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every((key) => equalsCriterion(a[key], b[key]));
  }
  return false;
}

/** A `{}`-literal object, not a `Date`/`Map`/class instance — those carry their state outside
 *  own enumerable keys, so key-walking them would read as equal when they are not. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

/**
 * The root criterion model as a real `WritableSignal<TState>`: a read composes every child
 * node, a write fans back out to them. The nodes stay the single storage location — this is a
 * view over them, never a copy — which is what lets a Signal Form sit directly on the filter
 * model with no adapter and no sync effect (`filters.md` §Forms, R18).
 *
 * Built the way Angular's own Signal Forms builds `deepSignal` — `Object.assign` onto a
 * `computed()` — so the result carries a reactive node and is a valid `form()` model.
 *
 * The assertion is unavoidable, not a shortcut: `WritableSignal` is branded with
 * `ɵWRITABLE_SIGNAL`, a type-only `unique symbol` with no runtime counterpart, so no value can
 * satisfy the interface structurally. Angular hits the same wall and is simply untyped there.
 */
function createRootValueSignal<TState extends Record<string, unknown>>(
  nodesByKey: ReadonlyMap<string, FilterNode<unknown>>
): WritableSignal<TState> {
  const read = computed(() => {
    const result: Record<string, unknown> = {};
    for (const [key, node] of nodesByKey) {
      result[key] = node.value();
    }
    return result as TState;
  });

  // Keys the model omits are left alone rather than written as `undefined` — a partial object
  // is not a legal `TState`, but a criterion overwritten with `undefined` is unrecoverable.
  const write = (next: TState): void => {
    for (const [key, node] of nodesByKey) {
      if (key in next) {
        node.value.set(next[key]);
      }
    }
  };

  // A distinct node, not `read` itself: `read` carries the write members assigned below, so
  // handing it back would leak `set`/`update` past a `Signal<TState>` annotation at runtime.
  let readonlyView: Signal<TState> | undefined;

  const rootValue = Object.assign(read, {
    set: write,
    update: (updateFn: (value: TState) => TState): void => write(updateFn(untracked(read))),
    asReadonly: (): Signal<TState> => (readonlyView ??= computed(() => read())),
  });

  return rootValue as unknown as WritableSignal<TState>;
}

export function buildFiltersRoot<TRow, TState extends Record<string, unknown>>(
  internal: FiltersInternal<TRow>
): FiltersRoot<TRow, TState> {
  const { nodesByKey } = internal;
  return {
    value: createRootValueSignal<TState>(nodesByKey),
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
    reset: (next?: Partial<TState> | null): void => {
      for (const [key, node] of nodesByKey) {
        if (next === undefined) {
          node.reset();
        } else if (next === null) {
          node.reset(null);
        } else {
          // A key the snapshot omits arrives as `undefined`, which is `reset()` — back to
          // source. That is what makes a partial restore a complete state.
          node.reset(next[key]);
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
    // A fresh evaluator per call — one call is one evaluation, with its own error-dedup scope.
    matcher: (): ((row: TRow) => boolean) => createFilterEvaluatorFrom(internal).matchesRow,
  };
}

/** Callable (root state) + indexable (child nodes) — mirrors Signal Forms: property access is
 *  a child, a call is state. Each indexed property returns a *function* yielding the node
 *  (`filters.status()` → node), per `Filters<TRow, TState>`'s mapped-type shape. */
export function buildFiltersObject<TRow, TState extends Record<string, unknown>>(
  internal: FiltersInternal<TRow>
): Filters<TRow, TState> {
  const root = buildFiltersRoot<TRow, TState>(internal);
  const callable = ((): FiltersRoot<TRow, TState> => root) as Filters<TRow, TState>;
  const childGetters = new Map<string, () => FilterNode<unknown>>();
  for (const [key, node] of internal.nodesByKey) {
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
