import { DestroyRef, DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * One app-wide polite live region for copy outcomes.
 *
 * `[ngptCopyConfirm]` is a `@Directive`, so it has no template and cannot render the
 * visually-hidden `<span aria-live="polite">` the old `icon-button` component did. A live region
 * only announces when *text content inside it changes* while it is already in the document, so a
 * per-state `aria-label` swap on the button is not a substitute — accessible-name changes are not
 * a live-region trigger, and screen-reader support for announcing them is inconsistent. This
 * service owns a single body-level region instead, created lazily on the first announcement.
 *
 * `@angular/cdk`'s `LiveAnnouncer` does exactly this, but CDK is not a declared dependency of this
 * repo — `search-overlay` already hand-rolls its focus trap for the same reason.
 */
@Injectable({ providedIn: 'root' })
export class CopyConfirmAnnouncer {
  private readonly document = inject(DOCUMENT);
  private region: HTMLElement | undefined;
  private pendingId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  /**
   * Announces `message` politely. Clearing first and writing on the next task is what makes a
   * *repeat* copy announce at all — re-assigning the identical string produces no content change,
   * which is precisely the "click copy twice" case.
   */
  announce(message: string): void {
    const region = this.ensureRegion();
    this.clearPending();
    region.textContent = '';

    if (message === '') {
      return;
    }

    this.pendingId = setTimeout(() => {
      region.textContent = message;
      this.pendingId = undefined;
    });
  }

  private ensureRegion(): HTMLElement {
    if (this.region !== undefined) {
      return this.region;
    }

    const region = this.document.createElement('div');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');

    // `.visually-hidden` lives in src/styles/global.css, which is unscoped — it reaches this
    // node even though the node sits outside any component's view.
    region.classList.add('visually-hidden');

    this.document.body.appendChild(region);
    this.region = region;
    return region;
  }

  private clearPending(): void {
    if (this.pendingId !== undefined) {
      clearTimeout(this.pendingId);
      this.pendingId = undefined;
    }
  }

  private dispose(): void {
    this.clearPending();
    this.region?.remove();
    this.region = undefined;
  }
}
