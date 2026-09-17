import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

/**
 * Shared "at: / Add row" toolbar for single-row gated editing — optimistic and pessimistic use
 * identical controls, so both hosts import this instead of duplicating it (second importer →
 * promoted to `ui/`).
 */
@Component({
  selector: 'ngp-insert-row-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insert-row-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class InsertRowToolbarComponent {
  protected readonly insertAt = signal(0);

  readonly addRow = output<number>();

  protected setInsertAt(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.insertAt.set(event.target.valueAsNumber);
    }
  }

  protected emitAddRow(): void {
    this.addRow.emit(this.insertAt());
  }
}
