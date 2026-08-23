import { DOCUMENT } from '@angular/common';
import { Directive, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';

/** Tracks whether the page has scrolled past a pixel threshold. SSR-safe (no-ops without a `Window`). */
@Directive({ selector: '[ngptScrolledPastThreshold]' })
export class ScrolledPastThreshold {
  readonly threshold = input(24, { alias: 'ngptScrolledPastThreshold' });

  readonly scrolled = signal(false);

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) {
        return;
      }

      const onScroll = (): void => {
        this.scrolled.set(view.scrollY > this.threshold());
      };

      onScroll();
      view.addEventListener('scroll', onScroll, { passive: true });
      this.destroyRef.onDestroy(() => view.removeEventListener('scroll', onScroll));
    });
  }
}
