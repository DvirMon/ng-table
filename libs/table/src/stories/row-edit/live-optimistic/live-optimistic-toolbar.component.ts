import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { RowId } from '../../../api/types';

/** Toolbar for focus-delimited optimistic editing — insert position, leave-page simulation,
 * the Undo affordance for a settled delete, and the last save error. */
@Component({
  selector: 'ngp-live-optimistic-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-optimistic-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class LiveOptimisticToolbarComponent {
  readonly undoRowId = input.required<RowId | null>();
  readonly saveError = input.required<string | null>();

  protected readonly insertAt = signal(0);

  readonly addRow = output<number>();
  readonly simulateLeavePage = output<void>();
  readonly undoDelete = output<void>();

  protected onInsertAtInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.insertAt.set(event.target.valueAsNumber);
    }
  }

  protected onAddRow(): void {
    this.addRow.emit(this.insertAt());
  }
}
