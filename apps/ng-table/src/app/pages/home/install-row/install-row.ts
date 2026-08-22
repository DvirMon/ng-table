import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideTriangleAlert } from '@ng-icons/lucide';
import { CopyConfirm } from '../../../design-system/copy-confirm/copy-confirm';
import { IconButton } from '../../../design-system/icon-button/icon-button';

/**
 * Home's install command row (page-local, not a design-system component). A flex row inside one
 * bordered `--ngpt-bg-deep` surface, not a `code-block`.
 *
 * The clipboard write and the confirmation hold belong to `[ngptCopyConfirm]` — this component
 * only supplies the command text and the two labels the spec fixes for it.
 */
@Component({
  selector: 'ngpt-home-install-row',
  imports: [IconButton, CopyConfirm, NgIcon],
  templateUrl: './install-row.html',
  styleUrl: './install-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideCopy, lucideCheck, lucideTriangleAlert })],
})
export class InstallRow {
  readonly command = input<string>();
}
