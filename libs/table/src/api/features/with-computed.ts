import { computed, isSignal, type Signal } from '@angular/core';
import type { Feature, Shape } from '../../engine/types';
import type { DerivedDict, ReadonlyStore } from '../types';

/**
 * Type-level projection only — at runtime the store is the same object as `In`; the mapped
 * type `ReadonlyStore<In>` isn't provably assignable from `In`, so this is the file's one
 * assertion. No `Object.freeze`, no proxy: method members on the store stay callable.
 */
function toReadonlyStore<In extends Shape>(input: In): ReadonlyStore<In> {
  return input as unknown as ReadonlyStore<In>;
}

/** Construction-class: the `DerivedDict` type constraint alone is defeated by a JavaScript
 * consumer, so every returned value is checked at runtime too. */
function assertDerivedSignals(dict: Record<string, unknown>): asserts dict is DerivedDict {
  for (const [key, value] of Object.entries(dict)) {
    if (!isSignal(value)) {
      throw new Error(
        `[createTable] withComputed: member "${key}" is not a signal — a derive block returns signals only`,
      );
    }
  }
}

/**
 * Reports a throw and rethrows — always, not dev-only. Reporting is once per evaluation with
 * no dedupe logic: the outer `computed` caches the error and rethrows it on every read until
 * a dependency changes.
 */
function wrapDerivedSignal(key: string, source: Signal<unknown>): Signal<unknown> {
  return computed(() => {
    try {
      return source();
    } catch (error) {
      console.error(`[createTable] derived member "${key}" threw`, error);
      throw error;
    }
  });
}

/**
 * Rebuilds the dictionary key-for-key with every signal wrapped, so the members reaching the
 * store are read-only and self-reporting. Declared signature only — the implementation is
 * loosely typed because a loop-built object can't be checked against `D` (same shape as
 * `mergeMembers` in `create-table-feature.ts`), which keeps the file free of an assertion.
 */
function wrapDerivedMembers<D extends DerivedDict>(declared: D): D;
function wrapDerivedMembers(declared: DerivedDict): DerivedDict {
  const wrapped: DerivedDict = {};
  for (const [key, source] of Object.entries(declared)) {
    wrapped[key] = wrapDerivedSignal(key, source);
  }
  return wrapped;
}

/**
 * A feature that adds derived signals. At the top level it sees core plus every feature
 * declared before it; as a feature's trailing derive-block argument it sees core plus that
 * feature's own members. The store handed to `factory` is read-only; `factory` must return
 * signals only.
 */
export function withComputed<In extends Shape, D extends DerivedDict>(
  factory: (store: ReadonlyStore<In>) => D,
): Feature<In, D> {
  const feature: Feature<In, D> = (input) => {
    let declared: D;
    try {
      declared = factory(toReadonlyStore(input));
    } catch (cause) {
      throw new Error('[createTable] withComputed block threw while declaring its members', {
        cause,
      });
    }

    assertDerivedSignals(declared);

    return { members: wrapDerivedMembers(declared) };
  };

  return Object.assign(feature, { displayName: 'withComputed' });
}
