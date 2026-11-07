import { InjectionToken } from '@angular/core';

import { classifyCellWidgets, findSingleWidget, removeFromTabOrder } from './cell-widgets';
import type { CellWidgetKind } from './cell-widgets.types';
import type { BodyCell } from './keyboard-nav.types';

/** One table's lookup between body cells and their rendered elements. */
export interface FocusRegistry {
  register(cell: BodyCell, element: HTMLElement): void;
  unregister(element: HTMLElement): void;
  elementOf(cell: BodyCell): HTMLElement | null;
  /** The registered cell at or above `node`, stopping at `boundary`. */
  cellContaining(node: Node, boundary: HTMLElement): BodyCell | null;
  /** The widget kind last computed for `cell`; `'none'` when it is not registered. */
  widgetKindOf(cell: BodyCell): CellWidgetKind;
  /**
   * Takes controls added under `node` out of the Tab order and refreshes the owning cell's
   * widget kind. Does nothing when `node` is outside every registered cell.
   */
  refreshWidgets(node: Node, boundary: HTMLElement): void;
  /**
   * Keeps exactly one Tab stop: the active cell's lone widget when it has one, else the cell.
   * The previous widget drops back to `-1`.
   */
  syncTabStop(active: BodyCell | null): void;
  /** The element focus should land on for `cell`: its lone widget, else the cell itself. */
  focusTargetOf(cell: BodyCell): HTMLElement | null;
}

/** Creates the registry one `ngpTable` host provides to its cells. */
export function createFocusRegistry(): FocusRegistry {
  const elementByKey = new Map<string, HTMLElement>();
  const cellByElement = new Map<HTMLElement, BodyCell>();
  const kindByElement = new Map<HTMLElement, CellWidgetKind>();
  let tabStopWidget: HTMLElement | null = null;

  // Note: the key carries the id's type so row `1` and row `'1'` stay distinct.
  function keyOf(cell: BodyCell): string {
    return `${typeof cell.rowId}:${String(cell.rowId)}|${cell.columnId}`;
  }

  function register(cell: BodyCell, element: HTMLElement): void {
    unregister(element);
    elementByKey.set(keyOf(cell), element);
    cellByElement.set(element, cell);
    markDescendants(element);
    kindByElement.set(element, classifyCellWidgets(element));
  }

  // Note: never marks the cell element itself; it carries the roving tabindex.
  function markDescendants(cellElement: HTMLElement): void {
    for (const child of Array.from(cellElement.children)) removeFromTabOrder(child);
  }

  function unregister(element: HTMLElement): void {
    const cell = cellByElement.get(element);
    if (cell === undefined) return;
    cellByElement.delete(element);
    kindByElement.delete(element);
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

  function widgetKindOf(cell: BodyCell): CellWidgetKind {
    const element = elementByKey.get(keyOf(cell));
    return (element && kindByElement.get(element)) ?? 'none';
  }

  function refreshWidgets(node: Node, boundary: HTMLElement): void {
    const cell = cellContaining(node, boundary);
    if (cell === null) return;
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return;

    if (node === element) markDescendants(element);
    else removeFromTabOrder(node);
    kindByElement.set(element, classifyCellWidgets(element));
  }

  function focusTargetOf(cell: BodyCell): HTMLElement | null {
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return null;
    return findSingleWidget(element) ?? element;
  }

  function syncTabStop(active: BodyCell | null): void {
    const element = active === null ? undefined : elementByKey.get(keyOf(active));
    const widget = element === undefined ? null : findSingleWidget(element);

    if (tabStopWidget !== null && tabStopWidget !== widget)
      tabStopWidget.setAttribute('tabindex', '-1');
    tabStopWidget = widget;
    if (element === undefined) return;

    kindByElement.set(element, classifyCellWidgets(element));
    if (widget === null) {
      element.setAttribute('tabindex', '0');
    } else {
      element.setAttribute('tabindex', '-1');
      widget.setAttribute('tabindex', '0');
    }
  }

  return {
    register,
    unregister,
    elementOf,
    cellContaining,
    widgetKindOf,
    refreshWidgets,
    syncTabStop,
    focusTargetOf,
  };
}

/** Token for the focus registry of the nearest `ngpTable` host. */
export const NGP_TABLE_FOCUS_REGISTRY = new InjectionToken<FocusRegistry>(
  'NGP_TABLE_FOCUS_REGISTRY',
);
