import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
} from '@angular/core';

/**
 * Attribute-hosted on the consumer's `<a>` (ADR-0005) — no wrapper element ships.
 *
 * No `href` input: the consumer sets the native attribute.
 *
 * `external` is kept because it is not native capability — it is a single flag that owns three
 * coupled things at once (`target="_blank"`, the `rel` security pair, and the visually-hidden
 * "(opens in new tab)" text this primitive projects). See `docs/decisions.md`.
 */
@Component({
  selector: 'a[ngptInlineLink]',
  templateUrl: './inline-link.html',
  styleUrl: './inline-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.target]': "external() ? '_blank' : authoredTarget",
    '[attr.rel]': "external() ? 'noopener noreferrer' : authoredRel",
  },
})
export class InlineLink {
  /** Bare-attribute form `<a ngptInlineLink external>` passes `''`; the transform makes it true. */
  readonly external = input(false, { transform: booleanAttribute });

  /**
   * The consumer's own `target`/`rel`, captured before any host binding runs. A host binding
   * evaluating to `null` *removes* the attribute, so without these an `external`-less link that
   * authored its own `target` would be silently stripped of it.
   */
  protected readonly authoredTarget: string | null;
  protected readonly authoredRel: string | null;

  constructor() {
    const host = inject<ElementRef<HTMLAnchorElement>>(ElementRef).nativeElement;
    this.authoredTarget = host.getAttribute('target');
    this.authoredRel = host.getAttribute('rel');
  }
}
