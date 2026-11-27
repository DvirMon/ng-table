import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SearchOverlay } from './design-system/search/search-overlay';
import { injectGlobalShortcut, isSearchShortcut } from './design-system/search/search.shortcut';
import { SearchStore } from './design-system/search/search.store';

@Component({
  selector: 'ngpt-root',
  imports: [RouterOutlet, SearchOverlay],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly search = inject(SearchStore);

  constructor() {
    injectGlobalShortcut(isSearchShortcut, () => this.search.show());
  }
}
