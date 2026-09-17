import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<footer>` (ADR-0005). The consumer authors the link row and
 * the copyright line; this owns the strip itself — divider, padding, centered muted type, and the
 * column gap between whatever it is given.
 *
 * No `role="contentinfo"`: `<footer>` already exposes that landmark implicitly unless it is a
 * descendant of `<article>`/`<aside>`/`<main>`/`<nav>`/`<section>`. See `docs/decisions.md`.
 */
@Component({
  selector: 'footer[ngptPageFooter]',
  templateUrl: './page-footer.html',
  styleUrl: './page-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageFooter {}
