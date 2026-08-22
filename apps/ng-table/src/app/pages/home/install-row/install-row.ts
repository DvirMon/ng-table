import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { IconButton } from '../../../design-system/icon-button/icon-button';
import type { IconButtonState } from '../../../design-system/icon-button/icon-button.types';

/** Mirrors `--ngpt-comp-icon-btn-confirm-hold` (sizing.css). A CSS custom property can't drive a
 *  TS `setTimeout` directly without a `getComputedStyle` round-trip, which no other component in
 *  this app does for a duration — kept as a literal, flagged in docs/decisions.md. */
const CONFIRM_HOLD_MS = 1400;

/**
 * Home's install command row (page-local, not a design-system component — `docs/CONVENTIONS.md`
 * fixed contract). A flex row inside one bordered `--ngpt-bg-deep` surface, not a `code-block`.
 * Drives icon-button's confirmation states itself: icon-button renders + emits only, this
 * component owns the clipboard write and the idle → copied/failed → idle timer.
 */
@Component({
  selector: 'ngpt-home-install-row',
  imports: [IconButton],
  templateUrl: './install-row.html',
  styleUrl: './install-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallRow {
  private readonly destroyRef = inject(DestroyRef);
  private revertTimer: ReturnType<typeof setTimeout> | undefined;

  readonly command = input<string>();

  protected readonly copyState = signal<IconButtonState>('idle');

  protected readonly copyLabel = computed<string>(() => {
    switch (this.copyState()) {
      case 'copied':
        return 'Copied';
      case 'failed':
        return 'Copy failed — select the command manually';
      case 'idle':
        return 'Copy install command';
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearRevertTimer());
  }

  protected async onCopyPressed(): Promise<void> {
    const command = this.command();
    if (!command) {
      return;
    }
    try {
      await navigator.clipboard.writeText(command);
      this.settle('copied');
    } catch {
      this.settle('failed');
    }
  }

  private settle(state: IconButtonState): void {
    this.clearRevertTimer();
    this.copyState.set(state);
    this.revertTimer = setTimeout(() => this.copyState.set('idle'), CONFIRM_HOLD_MS);
  }

  private clearRevertTimer(): void {
    if (this.revertTimer !== undefined) {
      clearTimeout(this.revertTimer);
      this.revertTimer = undefined;
    }
  }
}
