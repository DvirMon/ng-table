import { DestroyRef, Directive, ElementRef, computed, inject, input, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { CopyConfirmAnnouncer } from './copy-confirm.announcer';
import type { CopyConfirmOutcome, CopyConfirmState } from './copy-confirm.types';
import { parseCssDurationMs } from './copy-confirm.utils';

const HOLD_CUSTOM_PROPERTY = '--ngpt-comp-icon-btn-confirm-hold';

/**
 * Last-resort guard for environments where computed styles are unavailable (jsdom without the
 * token file, SSR). Not a CSS `var()` fallback — at runtime in the browser the token in
 * `src/styles/tokens/sizing.css` is always the value used. See docs/decisions.md.
 */
const HOLD_UNRESOLVED_MS = 1400;

/**
 * Clipboard-write + confirmation hold, placed by the consumer *beside* a component on the same
 * `<button>` (ADR-0005 § Corollary):
 *
 * ```html
 * <button ngptIconButton ngptCopyConfirm #copy="ngptCopyConfirm" [text]="command()">…</button>
 * ```
 *
 * Legal because Angular forbids only component + component on one host. Deliberately *not*
 * `hostDirectives` on `icon-button`: that is statically resolved, so every icon button in the app
 * would carry clipboard behavior it never uses, and `icon-button` would have to re-declare
 * `text`/`idleLabel`/`failedLabel` in its own metadata.
 *
 * The directive does not swap the glyph — the consumer authors it and branches on `state()`.
 */
@Directive({
  selector: 'button[ngptCopyConfirm]',
  exportAs: 'ngptCopyConfirm',
  host: {
    '[attr.data-copy-state]': 'state()',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
    '(click)': 'copy()',
  },
})
export class CopyConfirm {
  /** What to write to the clipboard. Empty or unset makes the click a no-op. */
  readonly text = input<string>();

  readonly idleLabel = input<string>('Copy');
  readonly copiedLabel = input<string>('Copied');
  readonly failedLabel = input<string>('Copy failed, select manually');

  private readonly settledState = signal<CopyConfirmState>('idle');

  /** Read by the consumer's template to pick the glyph. */
  readonly state: Signal<CopyConfirmState> = this.settledState.asReadonly();

  /** Drives both `aria-label` and `title` on the host, and the live-region announcement. */
  readonly label: Signal<string> = computed<string>(() => {
    switch (this.state()) {
      case 'copied':
        return this.copiedLabel();
      case 'failed':
        return this.failedLabel();
      case 'idle':
        return this.idleLabel();
    }
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer = inject(CopyConfirmAnnouncer);
  private revertTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private cachedHoldMs: number | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearRevertTimeout());
  }

  /**
   * Bound to the host's own `click`. Public and synchronous so a consumer can also trigger a copy
   * programmatically, and so the host listener never returns a promise.
   */
  copy(): void {
    void this.writeAndSettle();
  }

  private async writeAndSettle(): Promise<void> {
    const text = this.text();
    if (text === undefined || text === '') {
      return;
    }

    try {
      // `navigator.clipboard` is absent outside a secure context, and present-but-rejecting under
      // an unfocused document or a restrictive permissions policy. Both land in the same branch.
      await navigator.clipboard.writeText(text);
      this.settle('copied');
    } catch {
      this.settle('failed');
    }
  }

  /** Re-clicking during the hold restarts the hold rather than queueing a second one. */
  private settle(outcome: CopyConfirmOutcome): void {
    this.clearRevertTimeout();
    this.settledState.set(outcome);
    this.announcer.announce(this.label());
    this.revertTimeoutId = setTimeout(() => {
      this.settledState.set('idle');
      this.revertTimeoutId = undefined;
    }, this.resolveHoldMs());
  }

  /**
   * Reads `--ngpt-comp-icon-btn-confirm-hold` off the host once, so the token stays the single
   * source for the duration and no `1400` literal survives at a call site. Read lazily at first
   * settle — by then stylesheets are applied — and cached, since a `getComputedStyle` call forces
   * style recalculation.
   */
  private resolveHoldMs(): number {
    if (this.cachedHoldMs !== undefined) {
      return this.cachedHoldMs;
    }

    const view = this.host.ownerDocument.defaultView;
    const declared =
      view === null ? '' : view.getComputedStyle(this.host).getPropertyValue(HOLD_CUSTOM_PROPERTY);
    this.cachedHoldMs = parseCssDurationMs(declared) ?? HOLD_UNRESOLVED_MS;
    return this.cachedHoldMs;
  }

  private clearRevertTimeout(): void {
    if (this.revertTimeoutId !== undefined) {
      clearTimeout(this.revertTimeoutId);
      this.revertTimeoutId = undefined;
    }
  }
}
