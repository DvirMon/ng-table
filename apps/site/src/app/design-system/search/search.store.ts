import { Injectable, computed, effect, resource, signal } from '@angular/core';
import { CONTENT_MANIFEST } from '../../content/content.manifest';
import { loadSearchIndex } from './search.index';
import type { SearchResultRecord } from './search.types';

/**
 * Open state of the one app-level search overlay, shared by every page and the ⌘K shortcut, plus
 * the search index behind it. The index is fetched the first time the overlay opens, never before.
 */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  readonly open = signal(false);

  /** Set once, on first open; the resource stays idle until then. */
  private readonly indexRequested = signal(false);

  private readonly index = resource({
    params: () => (this.indexRequested() ? true : undefined),
    loader: ({ abortSignal }) => loadSearchIndex(abortSignal),
  });

  /** The generated search records; empty while loading and if loading failed. */
  readonly records = computed<readonly SearchResultRecord[]>(() =>
    this.index.hasValue() ? this.index.value() : [],
  );

  /** No-results prefill chips: the nav tree's section labels, in tree order. */
  readonly suggestions: readonly string[] = CONTENT_MANIFEST.tree.flatMap((section) =>
    section.label ? [section.label] : [],
  );

  constructor() {
    // A failed load degrades to an empty index; report it so it isn't silent.
    effect(() => {
      const error = this.index.error();
      if (error) {
        console.error(error);
      }
    });
  }

  show(): void {
    this.indexRequested.set(true);
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }
}
