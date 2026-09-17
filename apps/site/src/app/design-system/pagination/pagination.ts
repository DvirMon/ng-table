import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<nav>` (ADR-0005) — the container half of the pair. It owns
 * only the two-column track; the consumer authors the `<a ngptPaginationLink>` cards, so nothing
 * here inserts, removes or reorders DOM (`libs/table/CLAUDE.md` § Locked invariants).
 *
 * `aria-label` is a static host attribute, not an input: the spec's a11y front-matter fixes the
 * label to "Pagination" for every instance (same call as `callout`'s `role="note"`).
 *
 * Each card places itself in the grid from its own stylesheet (`:host([data-side='prev'])`);
 * emulated encapsulation puts projected content out of this component's reach, which is why the
 * item is a primitive rather than a descendant rule here.
 */
@Component({
  selector: 'nav[ngptPagination]',
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-label': 'Pagination',
  },
})
export class Pagination {}
