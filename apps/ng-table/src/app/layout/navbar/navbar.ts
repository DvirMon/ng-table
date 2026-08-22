import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconButton } from '../../design-system/icon-button/icon-button';
import { PillButton } from '../../design-system/pill-button/pill-button';
import { SearchField } from '../../design-system/search/search-field';
import type { NavbarVariant } from './navbar.types';

/**
 * Home hero's two-state scroll swap threshold (`pages/home/docs/spec.md` § Scrolled state).
 * Not a `--ngpt-*` token — the spec fixes it as a bare number, not a design value.
 */
const SCROLL_THRESHOLD_PX = 24;

/**
 * `role="banner"` landmark — logo, search trigger, right-group links
 * (`src/styles/docs/Focus and Keyboard.md` § Landmark order, item 2).
 *
 * `docs` variant is a plain sticky bar, statically styled. `band` variant (Home's hero) is
 * transparent-over-band until the page scrolls past `SCROLL_THRESHOLD_PX`, then swaps to
 * `--ngpt-navbar-scrolled`. The scroll listener is only ever registered for `band` — the docs
 * bar never changes on scroll, so `scrolled` stays permanently `false` there and nothing reads it.
 */
@Component({
  selector: 'ngpt-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchField, PillButton, IconButton],
  host: {
    role: 'banner',
    '[attr.data-variant]': 'variant()',
    '[attr.data-scrolled]': 'scrolled()',
  },
})
export class Navbar {
  private readonly destroyRef = inject(DestroyRef);

  readonly variant = input<NavbarVariant>('docs');

  /**
   * Re-emitted when the search trigger fires its own `open` output. The Home composition
   * (Wave 3) owns the actual `ngpt-search-overlay` instance and listens to this to open it.
   */
  readonly openSearch = output<void>();

  /** Written by the passive scroll listener below; drives `[attr.data-scrolled]`. */
  protected readonly scrolled = signal(false);

  constructor() {
    afterNextRender(() => {
      if (this.variant() !== 'band') {
        return;
      }

      const onScroll = (): void => {
        this.scrolled.set(window.scrollY > SCROLL_THRESHOLD_PX);
      };

      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
    });
  }

  protected forwardOpenSearch(): void {
    this.openSearch.emit();
  }
}
