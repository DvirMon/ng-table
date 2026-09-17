import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { RowId } from '../../../api/types';

/** Toolbar for the raw-form-write demo — add a row via the form's root value signal, and the
 * current editing map / last save error for context. */
@Component({
  selector: 'ngp-form-write-mutations-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe],
  templateUrl: './form-write-mutations-toolbar.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class FormWriteMutationsToolbarComponent {
  readonly editingIds = input.required<readonly RowId[]>();
  readonly saveError = input.required<string | null>();

  readonly addRowViaForm = output<void>();
}
