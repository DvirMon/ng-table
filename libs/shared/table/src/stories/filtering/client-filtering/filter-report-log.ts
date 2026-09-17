import { DestroyRef, inject, signal, type Signal } from '@angular/core';

export interface FilterReportLog {
  readonly entries: Signal<readonly string[]>;
  clear(): void;
}

/** Mirrors the library's `[withFiltering]` degradation reports onto the canvas. The evaluator
 *  reports through `console.error` with no observable channel, so capturing them means patching
 *  it — deferred a tick because the report fires inside the pipeline's own `computed()`, where a
 *  signal write is illegal. Restored on destroy. Must be created in an injection context. */
export function createFilterReportLog(): FilterReportLog {
  const entries = signal<readonly string[]>([]);
  const destroyRef = inject(DestroyRef);

  const originalError = console.error;
  console.error = (...args: unknown[]): void => {
    originalError(...args);
    const [message] = args;
    if (typeof message === 'string' && message.startsWith('[withFiltering]')) {
      setTimeout(() => entries.update((current) => [...current, message]));
    }
  };
  destroyRef.onDestroy(() => {
    console.error = originalError;
  });

  return {
    entries: entries.asReadonly(),
    clear(): void {
      entries.set([]);
    },
  };
}
