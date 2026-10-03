import { computed, InjectionToken, signal, type Signal } from '@angular/core';

import type { RowId } from '../api/types';

/** One table's row-id lookup for its panels' minted DOM ids and their toggle elements. */
export interface PanelRegistry {
  registerPanel(id: RowId, host: HTMLElement): string;
  movePanel(host: HTMLElement, id: RowId): string;
  unregisterPanel(host: HTMLElement): void;
  registerToggle(id: RowId, host: HTMLElement): void;
  unregisterToggle(id: RowId, host: HTMLElement): void;
  panelId(id: RowId): Signal<string | null>;
  toggleOf(id: RowId): HTMLElement | null;
}

// Note: one sequence number per table. Two tables can share row ids, so ids minted from the
// row id alone would collide in one document.
let nextTableSeq = 0;

/**
 * Creates the registry one `ngpTable` host provides to its panels and toggles.
 *
 * @remarks
 * Panel ids take the form `ngp-t<table>-panel-<row id>`, URI-encoded so a row id containing
 * a space still yields a single-token `id`. Panels are keyed by host element, so a host
 * unregisters only its own entry. Note: in dev mode, registering a second panel for the
 * same row throws; `movePanel` skips that check so two reused views can swap rows.
 */
export function createPanelRegistry(): PanelRegistry {
  const tableSeq = nextTableSeq++;
  const rowOfHost = signal<ReadonlyMap<HTMLElement, RowId>>(new Map());
  const toggles = new Map<RowId, HTMLElement>();

  function mintPanelId(id: RowId): string {
    return `ngp-t${tableSeq}-panel-${encodeURIComponent(String(id))}`;
  }

  function hasOtherHostFor(id: RowId, host: HTMLElement): boolean {
    for (const [other, rowId] of rowOfHost()) {
      if (other !== host && rowId === id) return true;
    }
    return false;
  }

  function registerPanel(id: RowId, host: HTMLElement): string {
    const isDev = typeof ngDevMode !== 'undefined' && !!ngDevMode;
    if (isDev && hasOtherHostFor(id, host)) {
      throw new Error(
        `ngpTablePanel: row "${String(id)}" already has a panel — one panel per row.`,
      );
    }
    return movePanel(host, id);
  }

  function movePanel(host: HTMLElement, id: RowId): string {
    rowOfHost.update((prev) => new Map(prev).set(host, id));
    return mintPanelId(id);
  }

  function unregisterPanel(host: HTMLElement): void {
    rowOfHost.update((prev) => {
      const next = new Map(prev);
      next.delete(host);
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
    return computed(() => {
      for (const rowId of rowOfHost().values()) {
        if (rowId === id) return mintPanelId(id);
      }
      return null;
    });
  }

  function toggleOf(id: RowId): HTMLElement | null {
    return toggles.get(id) ?? null;
  }

  return {
    registerPanel,
    movePanel,
    unregisterPanel,
    registerToggle,
    unregisterToggle,
    panelId,
    toggleOf,
  };
}

/** Injects the panel registry of the nearest `ngpTable` host. */
export const NGP_TABLE_PANEL_REGISTRY = new InjectionToken<PanelRegistry>(
  'NGP_TABLE_PANEL_REGISTRY',
);
