import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

/** Toolbar for the live (no edit-session) table — insert position and the last-action Undo
 * affordance. Sort controls live in the `<th>` headers, not here. The commit counter reads
 * table state, so it stays on the host, not here. */
@Component({
  selector: 'ngp-live-table-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-table-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css', './live-table-story-host.component.css'],
})
export class LiveTableToolbarComponent {
  readonly undoLabel = input.required<string | null>();

  protected readonly insertAt = signal(0);

  readonly insertRow = output<number>();
  readonly undoLastAction = output<void>();

  protected setInsertAt(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.insertAt.set(event.target.valueAsNumber);
    }
  }

  protected emitInsertRow(): void {
    this.insertRow.emit(this.insertAt());
  }
}
