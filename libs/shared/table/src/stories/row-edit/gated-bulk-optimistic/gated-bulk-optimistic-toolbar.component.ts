import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import type { AddBulkRowsPayload } from './gated-bulk-optimistic.types';

/** Toolbar for bulk row creation — how many blank rows to open, where, and the batch
 * save/discard actions. Owns the count/insert-position knobs; `gated-bulk-optimistic.state.ts`
 * keeps only the pending-row tracking the host needs for its own table. */
@Component({
  selector: 'ngp-gated-bulk-optimistic-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gated-bulk-optimistic-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GatedBulkOptimisticToolbarComponent {
  protected readonly count = signal(3);
  protected readonly insertAt = signal(0);

  readonly addBulkRows = output<AddBulkRowsPayload>();
  readonly saveBatch = output<void>();
  readonly discardAllPending = output<void>();

  protected setCount(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.count.set(event.target.valueAsNumber);
    }
  }

  protected setInsertAt(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.insertAt.set(event.target.valueAsNumber);
    }
  }

  protected emitAddBulkRows(): void {
    this.addBulkRows.emit({ count: this.count(), insertAt: this.insertAt() });
  }
}
