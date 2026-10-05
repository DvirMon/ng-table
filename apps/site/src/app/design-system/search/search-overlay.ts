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
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideCornerDownLeft,
  lucideSearch,
  lucideSearchX,
  lucideX,
} from '@ng-icons/lucide';
import { NgpFocusTrap } from 'ng-primitives/focus-trap';
import { IconButton } from '../icon-button/icon-button';
import { Kbd } from '../kbd/kbd';
import { PillButton } from '../pill-button/pill-button';
import { closeFocusLock, openFocusLock, type FocusLockState } from './search-overlay.focus-lock';
import { groupSearchResults, isLastHeadingInRun, wrapIndex } from './search-overlay.utils';
import { SearchRecentRow } from './search-recent-row';
import { SearchResultRow } from './search-result-row';
import { RECENT_SEARCHES_MOCK, SEARCH_INDEX_MOCK, SEARCH_SUGGESTIONS_MOCK } from './search.mock';
import type { RecentSearchEntry, SearchResultGroup, SearchResultRecord } from './search.types';

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
  imports: [NgIcon, NgpFocusTrap, Kbd, IconButton, PillButton, SearchResultRow, SearchRecentRow],
  viewProviders: [
    provideIcons({
      lucideSearch,
      lucideCornerDownLeft,
      lucideArrowDown,
      lucideArrowUp,
      lucideX,
      lucideSearchX,
    }),
  ],
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

  /**
   * Grouped results for the current query, matched/ranked against `SEARCH_INDEX_MOCK` (a
   * fixture, not real doc content — see `search.mock.ts`). Real indexing is still deferred to
   * `Search Index.md` until Content Model.md is wired.
   */
  readonly resultGroups = computed<readonly SearchResultGroup[]>(() =>
    groupSearchResults(SEARCH_INDEX_MOCK, this.query()),
  );
  readonly recentSearches = signal<readonly RecentSearchEntry[]>(RECENT_SEARCHES_MOCK);
  protected readonly isLastHeadingInRun = isLastHeadingInRun;
  readonly suggestions: readonly string[] = SEARCH_SUGGESTIONS_MOCK;

  readonly query = signal('');
  private readonly activeResultIndex = signal(0);

  readonly hasQuery = computed(() => this.query().trim().length > 0);
  private readonly flatResults = computed(() =>
    this.resultGroups().flatMap((group) => group.results),
  );
  readonly hasResults = computed(() => this.flatResults().length > 0);
  /**
   * The active listbox — query results while there's a query, recent searches otherwise. Both
   * render as `role="option"` rows sharing one `aria-activedescendant` model
   * (`docs/gaps-ngp-reference.md` item 17), so keyboard nav and the active-id computation walk
   * whichever one is currently showing.
   */
  private readonly flatSelectable = computed<
    readonly SearchResultRecord[] | readonly RecentSearchEntry[]
  >(() => (this.hasQuery() ? this.flatResults() : this.recentSearches()));
  readonly hasSelectableRows = computed(() => this.flatSelectable().length > 0);
  /** Bare id of the active row — what each row component's `active` input compares against. */
  readonly activeRowId = computed(
    () => this.flatSelectable()[this.activeResultIndex()]?.id ?? null,
  );
  readonly activeResultId = computed(() => {
    const active = this.flatSelectable()[this.activeResultIndex()];
    return active ? `search-result-${active.id}` : null;
  });
  readonly liveRegionText = computed(() =>
    this.hasQuery() ? `${this.flatResults().length} results` : '',
  );

  private focusLock: FocusLockState | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.focusLock = openFocusLock();
        queueMicrotask(() => this.searchInput()?.nativeElement.focus());
      } else if (this.focusLock) {
        closeFocusLock(this.focusLock);
        this.focusLock = null;
        this.query.set('');
        this.activeResultIndex.set(0);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.focusLock) {
        document.body.style.overflow = this.focusLock.previousBodyOverflow;
      }
    });
  }

  onQueryInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.query.set(target.value);
      this.activeResultIndex.set(0);
    }
  }

  clearQuery(): void {
    this.query.set('');
    this.activeResultIndex.set(0);
    this.searchInput()?.nativeElement.focus();
  }

  setActiveById(id: string): void {
    const matchIndex = this.flatSelectable().findIndex((entry) => entry.id === id);
    if (matchIndex >= 0) {
      this.activeResultIndex.set(matchIndex);
    }
  }

  /**
   * `(activate)` handler shared by both row types. Each row already filters out synthetic
   * pointer events (e.g. from a keyboard-triggered `scrollIntoView`) via `createTrackedPointer`
   * before emitting — see `search-overlay.utils.ts` — so this only ever sees genuine pointer
   * movement and can just set active directly.
   */
  onRowActivate(id: string): void {
    this.setActiveById(id);
  }

  onResultRowSelect(result: SearchResultRecord): void {
    this.setActiveById(result.id);
    // Navigation to `result.id` (Search Index.md § Selecting a result) is deferred to the
    // Routing and Page State.md wiring — out of scope this round. Closing is the only effect.
    this.closed.emit();
  }

  onRecentRowSelect(entry: RecentSearchEntry): void {
    this.query.set(entry.query);
    this.activeResultIndex.set(0);
    this.searchInput()?.nativeElement.focus();
  }

  /**
   * No "saved searches" feature exists yet — this only satisfies the reference's two-action
   * trailing slot (`docs/gaps-ngp-reference.md` item 17). Deliberately a no-op; the row itself
   * stops the click from bubbling into its own `select`.
   */
  onRecentRowSave(): void {
    // no-op
  }

  onRecentRowRemove(entry: RecentSearchEntry): void {
    this.recentSearches.update((entries) => entries.filter((current) => current.id !== entry.id));
  }

  selectSuggestion(suggestion: string): void {
    this.query.set(suggestion);
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
        const active = this.flatSelectable()[this.activeResultIndex()];
        if (active) {
          event.preventDefault();
          if ('kind' in active) {
            this.onResultRowSelect(active);
          } else {
            this.onRecentRowSelect(active);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Walks `flatSelectable()` — query results while there's a query, recent searches otherwise
   * (`docs/gaps-ngp-reference.md` item 17: recent rows share the same `aria-activedescendant`
   * listbox as results, so arrow keys must reach them too).
   */
  private moveActive(delta: number): void {
    const total = this.flatSelectable().length;
    if (total === 0) {
      return;
    }
    this.activeResultIndex.update((current) => wrapIndex(current + delta, total));
  }
}
