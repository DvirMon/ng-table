import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBlocks,
  lucideColumns3,
  lucidePuzzle,
  lucideRows,
  lucideTable,
  lucideTag,
} from '@ng-icons/lucide';
import { CategoryBadge } from '../../design-system/category-badge/category-badge';
import { Prose } from '../../design-system/prose/prose';
import { SearchStore } from '../../design-system/search/search.store';
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
  viewProviders: [
    provideIcons({
      lucideTable,
      lucideColumns3,
      lucideTag,
      lucidePuzzle,
      lucideRows,
      lucideBlocks,
    }),
  ],
})
export class Home {
  protected readonly content = HOME_CONTENT;

  protected readonly search = inject(SearchStore);

  protected scrollToInstall(): void {
    document.getElementById('install')?.scrollIntoView();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- GitHub repo URL isn't available this round (`CONTEXT.md` § Deliberate gaps: brand assets); wire once it exists.
  protected onSecondaryClick(): void {}
}
