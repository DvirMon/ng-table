import { InjectionToken } from '@angular/core';

import type { BodyCell } from './keyboard-nav.types';

/** One table's lookup between body cells and their rendered elements. */
export interface FocusRegistry {
  register(cell: BodyCell, element: HTMLElement): void;
  unregister(element: HTMLElement): void;
  elementOf(cell: BodyCell): HTMLElement | null;
  /** The registered cell at or above `node`, stopping at `boundary`. */
  cellContaining(node: Node, boundary: HTMLElement): BodyCell | null;
}

/** Creates the registry one `ngpTable` host provides to its cells. */
export function createFocusRegistry(): FocusRegistry {
  const elementByKey = new Map<string, HTMLElement>();
  const cellByElement = new Map<HTMLElement, BodyCell>();

  // Note: the key carries the id's type so row `1` and row `'1'` stay distinct.
  function keyOf(cell: BodyCell): string {
    return `${typeof cell.rowId}:${String(cell.rowId)}|${cell.columnId}`;
  }

  function register(cell: BodyCell, element: HTMLElement): void {
    unregister(element);
    elementByKey.set(keyOf(cell), element);
    cellByElement.set(element, cell);
  }

  function unregister(element: HTMLElement): void {
    const cell = cellByElement.get(element);
    if (cell === undefined) return;
    cellByElement.delete(element);
    const key = keyOf(cell);
    const isRegisteredElement = elementByKey.get(key) === element;
    if (isRegisteredElement) elementByKey.delete(key);
  }

  function elementOf(cell: BodyCell): HTMLElement | null {
    return elementByKey.get(keyOf(cell)) ?? null;
  }

  function cellContaining(node: Node, boundary: HTMLElement): BodyCell | null {
    let current: Node | null = node;
    while (current !== null && current !== boundary) {
      const cell = current instanceof HTMLElement ? cellByElement.get(current) : undefined;
      if (cell !== undefined) return cell;
      current = current.parentNode;
    }
    return null;
  }

  return { register, unregister, elementOf, cellContaining };
}

/** Token for the focus registry of the nearest `ngpTable` host. */
export const NGP_TABLE_FOCUS_REGISTRY = new InjectionToken<FocusRegistry>(
  'NGP_TABLE_FOCUS_REGISTRY',
);
