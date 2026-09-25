import { Component, signal } from '@angular/core';

import { NgpTableDirective } from '../../directives/ngp-table.directive';
import { NgpTableRowAnimationDirective } from '../../directives/ngp-table-row-animation.directive';
import { NgpTableRowDirective } from '../../directives/ngp-table-row.directive';
import { createColumns } from '../../api/create-columns';
import { createTable } from '../../api/create-table';
import type { TableConfig } from '../../api/types';
import { createMockRows, type MockRow } from '../../table.mock';

const PROFILE_ROW_COUNT = 1000;

const profileRowsWitness = (): readonly MockRow[] | undefined => undefined;

const PROFILE_TABLE_CONFIG: TableConfig<MockRow> = {
  trackBy: 'id',
  columns: createColumns(profileRowsWitness, (col) => [col('name')]),
};

// Same table as the benchmark (ngp-table-row-animation.bench.spec.ts), outside the test
// runner, so a Chrome performance profile of one reversal shows where the time goes.
@Component({
  selector: 'ngp-row-animation-profile-story-host',
  imports: [NgpTableDirective, NgpTableRowAnimationDirective, NgpTableRowDirective],
  template: `
    <div class="story-host">
      <p class="story-host__hint">
        Reverse moves every row: rows on screen slide out to the screen edge and the new ones
        slide in from it. Use it to record a profile. "Move first row down 3" shows a short glide.
      </p>
      <div class="story-host__toolbar">
        <button type="button" (click)="reverseRows()">Reverse {{ rowCount }} rows</button>
        <button type="button" (click)="moveFirstRowDown()">Move first row down 3</button>
      </div>
      <table class="story-host__table" [ngpTable]="table" ngpTableRowAnimation>
        <tbody>
          @for (row of table.renderRows(); track row.id) {
            <tr [ngpTableRow]="row">
              <td class="story-host__cell">{{ row.data?.name }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrls: ['../styles/story-host.css', './row-animation-profile.css'],
})
export class RowAnimationProfileStoryHostComponent {
  protected readonly rowCount = PROFILE_ROW_COUNT;
  private readonly data = signal<MockRow[]>(createMockRows(PROFILE_ROW_COUNT));
  protected readonly table = createTable(this.data, PROFILE_TABLE_CONFIG);

  protected reverseRows(): void {
    this.data.update((rows) => [...rows].reverse());
  }

  protected moveFirstRowDown(): void {
    this.data.update(([first, ...rest]) => [...rest.slice(0, 3), first, ...rest.slice(3)]);
  }
}
