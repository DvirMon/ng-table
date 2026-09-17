import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import type { RowId } from '../../../api/types';

export interface UndoWindow {
  readonly rowId: Signal<RowId | null>;
  arm(id: RowId): void;
  disarm(): RowId | null;
}

/**
 * Holds one row's restore point open for `windowMs` after a settled action, so an Undo click
 * within the window can still act on it. Owns the timer + `DestroyRef` cleanup — must be created
 * in an injection context. `arm(id)` (re)starts the window; `onExpire(id)` fires once it elapses
 * unarmed. `disarm()` cancels the timer and returns the armed id (or `null`), leaving the caller
 * to decide what an explicit undo does with it.
 */
export function createUndoWindow(windowMs: number, onExpire: (id: RowId) => void): UndoWindow {
  const rowId = signal<RowId | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  inject(DestroyRef).onDestroy(() => clearTimer());

  return {
    rowId: rowId.asReadonly(),
    arm(id) {
      clearTimer();
      rowId.set(id);
      timer = setTimeout(() => {
        timer = null;
        onExpire(id);
        rowId.set(null);
      }, windowMs);
    },
    disarm() {
      const id = rowId();
      clearTimer();
      rowId.set(null);
      return id;
    },
  };
}
