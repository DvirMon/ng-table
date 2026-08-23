import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on a real `<kbd>` (ADR-0005 pattern) — the host *is* the element, content is
 * consumer-authored via `<ng-content />`. One key/glyph per instance; a shortcut like `⌘K` is
 * two adjacent `kbd[ngptKbd]` in a flex wrapper, not one element with both chars (see search-field).
 */
@Component({
  selector: 'kbd[ngptKbd]',
  templateUrl: './kbd.html',
  styleUrl: './kbd.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Kbd {}
