import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TOC_MOCK_HEADINGS } from './toc-column.mock';
import type { TocHeading } from './toc-column.types';

/**
 * Right column of the page grid — "On this page" (`specs/layout/TOC Column.md`). Desktop-only,
 * scroll-spy not wired: there's no real scrollable article yet to observe, only mock headings.
 */
@Component({
  selector: 'ngpt-toc-column',
  templateUrl: './toc-column.html',
  styleUrl: './toc-column.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-label': 'On this page',
  },
})
export class TocColumn {
  readonly headings = input<readonly TocHeading[]>(TOC_MOCK_HEADINGS);
  readonly activeId = input<string | null>(null);
}
