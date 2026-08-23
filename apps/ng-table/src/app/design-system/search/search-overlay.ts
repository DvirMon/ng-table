import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { NgpFocusTrap } from 'ng-primitives/focus-trap';
import { RECENT_SEARCHES_MOCK, SEARCH_INDEX_MOCK } from './search.mock';
import type { RecentSearchEntry, SearchResultGroup, SearchResultRecord } from './search.types';
import { wrapIndex } from './search-overlay.utils';

/**
 * The ⌘K overlay: scrim, panel, query input, result list, empty/no-results states, recent
 * searches. Doesn't own the ⌘K listener or the `open` toggle — the app-level composition
 * (Wave 2) wires the shortcut and flips `open`; this component only renders correctly for
 * either value and handles Escape / scrim-click / focus trap+restore internally.
 *
 * Index is stubbed this round (`search.mock.ts`): the index is always empty, so
 * `resultGroups` never actually populates. No matching/ranking logic is implemented — that's
 * `Search Index.md`'s job once Content Model.md is wired. The render paths for "results" and
 * "no results" both exist so a populated index needs no rework here.
 */
@Component({
  selector: 'ngpt-search-overlay',
  templateUrl: './search-overlay.html',
  styleUrl: './search-overlay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, NgpFocusTrap],
  viewProviders: [provideIcons({ lucideSearch })],
  host: {
    '[attr.data-open]': 'open()',
    '[attr.inert]': 'open() ? null : ""',
  },
})
export class SearchOverlay {
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private readonly index = signal<readonly SearchResultRecord[]>(SEARCH_INDEX_MOCK);
  /**
   * Grouped results for the current query. No matching/ranking is implemented — deferred to
   * `Search Index.md` until Content Model.md is wired. Reads `index()` (always empty this
   * round) so the reactive graph is already correct for when a real computation replaces the
   * body; it doesn't branch on the query at all yet.
   */
  readonly resultGroups = computed<readonly SearchResultGroup[]>(() => {
    this.index();
    return [];
  });
  readonly recentSearches = signal<readonly RecentSearchEntry[]>(RECENT_SEARCHES_MOCK);

  readonly query = signal('');
  private readonly activeResultIndex = signal(0);

  readonly hasQuery = computed(() => this.query().trim().length > 0);
  private readonly flatResults = computed(() => this.resultGroups().flatMap((group) => group.results));
  readonly hasResults = computed(() => this.flatResults().length > 0);
  readonly activeResultId = computed(() => {
    const active = this.flatResults()[this.activeResultIndex()];
    return active ? `search-result-${active.id}` : null;
  });
  readonly liveRegionText = computed(() =>
    this.hasQuery() ? `${this.flatResults().length} results` : '',
  );

  private previouslyFocused: HTMLElement | null = null;
  private previousBodyOverflow = '';

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      } else {
        document.body.style.overflow = this.previousBodyOverflow;
        this.previouslyFocused?.focus();
        this.previouslyFocused = null;
        this.query.set('');
        this.activeResultIndex.set(0);
      }
    });

    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = this.previousBodyOverflow;
    });
  }

  onQueryInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.query.set(target.value);
      this.activeResultIndex.set(0);
    }
  }

  setActiveById(id: string): void {
    const matchIndex = this.flatResults().findIndex((result) => result.id === id);
    if (matchIndex >= 0) {
      this.activeResultIndex.set(matchIndex);
    }
  }

  selectResult(result: SearchResultRecord): void {
    this.setActiveById(result.id);
    // Navigation to `result.id` (Search Index.md § Selecting a result) is deferred to the
    // Routing and Page State.md wiring — out of scope this round. Closing is the only effect.
    this.closed.emit();
  }

  selectRecent(entry: RecentSearchEntry): void {
    this.query.set(entry.query);
    this.activeResultIndex.set(0);
    this.searchInput()?.nativeElement.focus();
  }

  onPanelKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closed.emit();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        break;
      case 'Enter': {
        const active = this.flatResults()[this.activeResultIndex()];
        if (active) {
          event.preventDefault();
          this.selectResult(active);
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Walks `resultGroups()` only — the "Recent" list (shown pre-query) is real `<button>`
   * elements navigated with Tab, not `role="option"` rows in this listbox model, so it's
   * intentionally excluded here.
   */
  private moveActive(delta: number): void {
    const total = this.flatResults().length;
    if (total === 0) {
      return;
    }
    this.activeResultIndex.update((current) => wrapIndex(current + delta, total));
  }
}
