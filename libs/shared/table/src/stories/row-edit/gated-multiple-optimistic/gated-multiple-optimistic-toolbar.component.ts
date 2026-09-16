import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { SaveAllOutcome } from './gated-multiple-optimistic.types';

/** Toolbar for multi-row gated editing — insert position, Clear all, Save All, and the last
 * Save All outcome. */
@Component({
  selector: 'ngp-gated-multiple-optimistic-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gated-multiple-optimistic-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class GatedMultipleOptimisticToolbarComponent {
  readonly saveAllOutcome = input.required<SaveAllOutcome | null>();

  protected readonly insertAt = signal(0);

  readonly addRow = output<number>();
  readonly clearAll = output<void>();
  readonly saveAll = output<void>();

  protected onInsertAtInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.insertAt.set(event.target.valueAsNumber);
    }
  }

  protected onAddRow(): void {
    this.addRow.emit(this.insertAt());
  }
}
