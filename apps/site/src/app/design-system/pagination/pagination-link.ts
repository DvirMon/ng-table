import { ChangeDetectionStrategy, Component, computed, input, type Signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight } from '@ng-icons/lucide';
import type { PaginationSide } from './pagination.types';

/** Eyebrow copy per side — fixed by the spec, so it is derived from `side`, never authored. */
const PAGINATION_DIRECTION_LABEL: Record<PaginationSide, string> = {
  prev: 'Previous',
  next: 'Next',
};

/**
 * Attribute-hosted on the consumer's `<a>` (ADR-0005) — the item half of the pair. No `href`
 * input: the consumer sets the native attribute.
 *
 * Keeps a real template (like `callout`): the eyebrow's arrow *and* its "Previous"/"Next" label
 * are both a function of `side`, not consumer content, so the seam sits below them — only the
 * card title is projected.
 */
@Component({
  selector: 'a[ngptPaginationLink]',
  templateUrl: './pagination-link.html',
  styleUrl: './pagination-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideArrowRight })],
  host: {
    '[attr.data-side]': 'side()',
  },
})
export class PaginationLink {
  /** Required: the side also places the card in `nav[ngptPagination]`'s grid, so it has no default. */
  readonly side = input.required<PaginationSide>();

  protected readonly directionLabel: Signal<string> = computed(
    () => PAGINATION_DIRECTION_LABEL[this.side()],
  );
}
