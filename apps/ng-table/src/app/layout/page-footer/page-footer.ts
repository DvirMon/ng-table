import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FooterLink } from './page-footer.types';

@Component({
  selector: 'ngpt-page-footer',
  templateUrl: './page-footer.html',
  styleUrl: './page-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'attr.role': 'contentinfo',
  },
})
export class PageFooter {
  /** Empty renders the plain docs footer (copyright only); non-empty adds the link row above it. */
  readonly links = input<readonly FooterLink[]>([]);
}
