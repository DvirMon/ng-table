import { computed } from '@angular/core';

/**
 * Store-member write surface (D30): `()` reads the current value, `.update(updater)` writes
 * through to whatever signal backs it. Built the same way Angular's own `signal()` is built —
 * `Object.assign` onto a real `computed()` so the result carries Angular's reactive-node brand
 * and stays a valid `Signal` anywhere one's expected.
 */
export interface WritableView<T, Updater> {
  (): T;
  update(updater: Updater): void;
}

export function createWritableView<T, Updater>(
  read: () => T,
  applyUpdater: (updater: Updater) => void
): WritableView<T, Updater> {
  return Object.assign(computed(read), { update: applyUpdater });
}
