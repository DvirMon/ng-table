import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<a>` (ADR-0005) — no wrapper element ships.
 *
 * No `href` input: the consumer sets the native attribute.
 *
 * `data-active`, `data-nested` and `aria-current` now all land on the one element; the old shape
 * split them across the host and an inner `<a>`, which ADR-0005 names as a defect.
 */
@Component({
  selector: 'a[ngptNavItem]',
  templateUrl: './nav-item.html',
  styleUrl: './nav-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-active]': "active() ? '' : null",
    '[attr.data-nested]': "nested() ? '' : null",
    '[attr.aria-current]': "active() ? 'page' : null",
  },
})
export class NavItem {
  /** Bare-attribute form `<a ngptNavItem active>` passes `''`; the transform makes it true. */
  readonly active = input(false, { transform: booleanAttribute });
  readonly nested = input(false, { transform: booleanAttribute });
}
