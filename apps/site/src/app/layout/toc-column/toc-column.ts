import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ContentHeading } from '../../content/content.types';

/**
 * Right column of the page grid — "On this page" (`specs/layout/TOC Column.md`). Desktop-only,
 * scroll-spy not wired. Headings come from `PageState.headings` (the manifest), never authored here.
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
  readonly headings = input.required<readonly ContentHeading[]>();
  readonly activeId = input<string | null>(null);
}
