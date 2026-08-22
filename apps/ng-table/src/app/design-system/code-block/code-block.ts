import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';
import type { IconButtonState } from '../icon-button/icon-button.types';

/**
 * Mirrors `--ngpt-comp-icon-btn-confirm-hold` (src/styles/tokens/sizing.css). A `setTimeout`
 * duration can't read a CSS custom property without a runtime `getComputedStyle` call — no
 * precedent for that in this app — so the value is duplicated here. See docs/decisions.md.
 */
const COPY_CONFIRMATION_HOLD_MS = 1400;

@Component({
  selector: 'ngpt-code-block',
  imports: [IconButton],
  templateUrl: './code-block.html',
  styleUrl: './code-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeBlock {
  readonly code = input<string>();
  readonly language = input<string>();
  readonly showGutter = input<boolean>(true);

  private readonly destroyRef = inject(DestroyRef);
  private revertTimeoutId: ReturnType<typeof setTimeout> | undefined;

  /** Drives the copy button's confirmation state — this component owns the clipboard write. */
  protected readonly copyState = signal<IconButtonState>('idle');

  /**
   * No Shiki this round (spec `does_not_own`: syntax colors). Split into one span per line so
   * the CSS counter gutter and the `.line` block model still match the spec's HTML/CSS mock —
   * this is where a future Shiki-rendered `.line` output would replace the plain split.
   */
  protected readonly lines = computed<readonly string[]>(() => (this.code() ?? '').split('\n'));

  /** a11y front-matter: "Scrollable region is focusable and has an accessible name." */
  protected readonly accessibleName = computed<string>(() => {
    const language = this.language();
    return language ? `${language} code sample, scrollable horizontally` : 'Code sample, scrollable horizontally';
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearRevertTimeout());
  }

  protected async onCopyPressed(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code() ?? '');
      this.copyState.set('copied');
    } catch {
      this.copyState.set('failed');
    }
    this.scheduleRevert();
  }

  private scheduleRevert(): void {
    this.clearRevertTimeout();
    this.revertTimeoutId = setTimeout(() => {
      this.copyState.set('idle');
    }, COPY_CONFIRMATION_HOLD_MS);
  }

  private clearRevertTimeout(): void {
    if (this.revertTimeoutId !== undefined) {
      clearTimeout(this.revertTimeoutId);
      this.revertTimeoutId = undefined;
    }
  }
}
