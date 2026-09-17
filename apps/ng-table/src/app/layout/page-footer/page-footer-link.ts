import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<a>` (ADR-0005) — one entry in the footer's link row.
 * `href`/`target`/`rel` are native and set by the consumer.
 *
 * Not a reuse of `a[ngptInlineLink]` (underlined, accent-colored, built for prose sentences) or
 * `a[ngptNavItem]` (pill hover fill): these inherit the footer's own muted type and only brighten
 * on hover. See `docs/decisions.md`.
 */
@Component({
  selector: 'a[ngptPageFooterLink]',
  templateUrl: './page-footer-link.html',
  styleUrl: './page-footer-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageFooterLink {}
