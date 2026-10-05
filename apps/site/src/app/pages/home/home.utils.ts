import { DOCUMENT } from '@angular/common';
import { DestroyRef, afterNextRender, inject } from '@angular/core';

/** Registers a document-level keydown shortcut, cleaned up on destroy. Client-only (guards SSR). */
export function injectGlobalShortcut(
  matches: (event: KeyboardEvent) => boolean,
  onMatch: () => void,
): void {
  const destroyRef = inject(DestroyRef);
  const document = inject(DOCUMENT);

  afterNextRender(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (matches(event)) {
        event.preventDefault();
        onMatch();
      }
    };

    document.addEventListener('keydown', onKeydown);
    destroyRef.onDestroy(() => document.removeEventListener('keydown', onKeydown));
  });
}
