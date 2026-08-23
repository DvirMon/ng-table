import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMenu } from '@ng-icons/lucide';
import { IconButton } from '../../design-system/icon-button/icon-button';
import { PillButton } from '../../design-system/pill-button/pill-button';
import { SearchField } from '../../design-system/search/search-field';
import type { NavbarVariant } from './navbar.types';
import { ScrolledPastThreshold } from './scrolled-past-threshold';

/**
 * `role="banner"` landmark — logo, search trigger, right-group links
 * (`src/styles/docs/Focus and Keyboard.md` § Landmark order, item 2).
 *
 * `docs` variant is a plain sticky bar, statically styled. `band` variant (Home's hero) is
 * transparent-over-band until the page scrolls past `ScrolledPastThreshold`'s default threshold,
 * then swaps to `--ngpt-navbar-scrolled`. `ScrolledPastThreshold` always tracks scroll position;
 * `scrolled` below only surfaces it for `band` — the docs bar never changes on scroll.
 */
@Component({
  selector: 'ngpt-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchField, IconButton, NgIcon],
  viewProviders: [provideIcons({ lucideMenu })],
  hostDirectives: [ScrolledPastThreshold],
  host: {
    role: 'banner',
    '[attr.data-variant]': 'variant()',
    '[attr.data-scrolled]': 'scrolled()',
  },
})
export class Navbar {
  private readonly scrolledPastThreshold = inject(ScrolledPastThreshold);

  readonly variant = input<NavbarVariant>('docs');

  /** Reflected onto the search trigger's `aria-expanded` — mirrors the Home composition's overlay state. */
  readonly searchOpen = input<boolean>(false);

  /**
   * Re-emitted when the search trigger fires its own `open` output. The Home composition
   * (Wave 3) owns the actual `ngpt-search-overlay` instance and listens to this to open it.
   */
  readonly openSearch = output<void>();

  /** Drives `[attr.data-scrolled]`; stays `false` for `docs` regardless of actual scroll position. */
  protected readonly scrolled = computed(
    () => this.variant() === 'band' && this.scrolledPastThreshold.scrolled(),
  );

  protected forwardOpenSearch(): void {
    this.openSearch.emit();
  }
}
