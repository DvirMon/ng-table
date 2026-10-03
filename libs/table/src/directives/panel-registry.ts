import { computed, InjectionToken, signal, type Signal } from '@angular/core';

import type { RowId } from '../api/types';

export interface PanelRegistry {
  registerPanel(id: RowId, host: HTMLElement): string;
  unregisterPanel(id: RowId): void;
  registerToggle(id: RowId, host: HTMLElement): void;
  unregisterToggle(id: RowId, host: HTMLElement): void;
  panelId(id: RowId): Signal<string | null>;
  toggleOf(id: RowId): HTMLElement | null;
}

let nextTableSeq = 0;

export function createPanelRegistry(): PanelRegistry {
  const tableSeq = nextTableSeq++;
  const panelIds = signal<ReadonlyMap<RowId, string>>(new Map());
  const toggles = new Map<RowId, HTMLElement>();

  function registerPanel(id: RowId, _host: HTMLElement): string {
    const isDev = typeof ngDevMode !== 'undefined' && !!ngDevMode;
    const hasPanelAlready = panelIds().has(id);
    if (isDev && hasPanelAlready) {
      throw new Error(
        `ngpTablePanel: row "${String(id)}" already has a panel — one panel per row.`,
      );
    }
    const minted = `ngp-t${tableSeq}-panel-${encodeURIComponent(String(id))}`;
    panelIds.update((prev) => new Map(prev).set(id, minted));
    return minted;
  }

  function unregisterPanel(id: RowId): void {
    panelIds.update((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function registerToggle(id: RowId, host: HTMLElement): void {
    toggles.set(id, host);
  }

  function unregisterToggle(id: RowId, host: HTMLElement): void {
    const isRegisteredHost = toggles.get(id) === host;
    if (isRegisteredHost) toggles.delete(id);
  }

  function panelId(id: RowId): Signal<string | null> {
    return computed(() => panelIds().get(id) ?? null);
  }

  function toggleOf(id: RowId): HTMLElement | null {
    return toggles.get(id) ?? null;
  }

  return { registerPanel, unregisterPanel, registerToggle, unregisterToggle, panelId, toggleOf };
}

export const NGP_TABLE_PANEL_REGISTRY = new InjectionToken<PanelRegistry>(
  'NGP_TABLE_PANEL_REGISTRY',
);
