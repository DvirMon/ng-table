import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideColumns3, lucidePuzzle, lucideRows, lucideTable, lucideTag, lucideZap } from '@ng-icons/lucide';
import { CategoryBadge } from '../../design-system/category-badge/category-badge';
import { Prose } from '../../design-system/prose/prose';
import { SearchOverlay } from '../../design-system/search/search-overlay';
import { Navbar } from '../../layout/navbar/navbar';
import { PageFooter } from '../../layout/page-footer/page-footer';
import { PageFooterLink } from '../../layout/page-footer/page-footer-link';
import { FeatureGrid } from './feature-grid/feature-grid';
import { FeatureGridText } from './feature-grid/feature-grid-text';
import { FeatureGridTitle } from './feature-grid/feature-grid-title';
import { HOME_CONTENT } from './home.content';
import { HomeHeroBand } from './hero-band/hero-band';
import { InstallRow } from './install-row/install-row';

/**
 * The marketing page at `/` (`docs/spec.md`). Full-width vertical stack, not the docs 3-column
 * grid — owns the navbar/search-overlay wiring and the page-footer link row directly, since Home
 * is the app's only composition this round (`search-overlay.ts`'s own doc comment: "the app-level
 * composition… wires the shortcut and flips `open`").
 */
@Component({
  selector: 'ngpt-home',
  imports: [
    HomeHeroBand,
    Navbar,
    SearchOverlay,
    CategoryBadge,
    Prose,
    FeatureGrid,
    FeatureGridTitle,
    FeatureGridText,
    NgIcon,
    InstallRow,
    PageFooter,
    PageFooterLink,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideTable, lucideColumns3, lucideTag, lucidePuzzle, lucideRows, lucideZap })],
})
export class Home {
  protected readonly content = HOME_CONTENT;

  protected readonly searchOpen = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const onKeydown = (event: KeyboardEvent): void => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          this.searchOpen.set(true);
        }
      };

      window.addEventListener('keydown', onKeydown);
      destroyRef.onDestroy(() => window.removeEventListener('keydown', onKeydown));
    });
  }

  protected openSearch(): void {
    this.searchOpen.set(true);
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
  }

  protected scrollToInstall(): void {
    document.getElementById('install')?.scrollIntoView();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- GitHub repo URL isn't available this round (`CONTEXT.md` § Deliberate gaps: brand assets); wire once it exists.
  protected onSecondaryClick(): void {}
}
