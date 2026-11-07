import { InjectionToken } from '@angular/core';

import {
  findFirstWidget,
  findSingleWidget,
  isOwnTabindexWrite,
  isTakenOutOfTabOrder,
  removeFromTabOrder,
  restoreTabOrder,
  retrackTabindex as saveBindingTabindex,
  setSavedTabindex,
  writeTabindex,
} from './cell-widgets';
import type { BodyCell } from './keyboard-nav.types';

/** One table's lookup between body cells and their rendered elements. */
export interface FocusRegistry {
  register(cell: BodyCell, element: HTMLElement): void;
  unregister(element: HTMLElement): void;
  elementOf(cell: BodyCell): HTMLElement | null;
  /** The registered cell at or above `node`, stopping at `boundary`. */
  cellContaining(node: Node, boundary: HTMLElement): BodyCell | null;
  /**
   * Takes controls added under `node` out of the Tab order. Does nothing when `node` is outside
   * every registered cell.
   */
  refreshWidgets(node: Node, boundary: HTMLElement): void;
  /**
   * Handles a `tabindex` attribute change under a registered cell that is not entered: saves the
   * new value as the control's original and marks it `-1` again. Ignores the registry's own writes.
   */
  retrackTabindex(record: MutationRecord, boundary: HTMLElement): void;
  /**
   * Keeps exactly one Tab stop: the active cell's lone widget when it has one, else the cell.
   * The previous widget drops back to `-1`.
   */
  syncTabStop(active: BodyCell | null): void;
  /** The element focus should land on for `cell`: its lone widget, else the cell itself. */
  focusTargetOf(cell: BodyCell): HTMLElement | null;
  /** The element of the cell currently in entered mode, or `null` in navigation mode. */
  enteredElement(): HTMLElement | null;
  /**
   * Puts `cell`'s widgets back in the Tab order so Tab walks them natively.
   * Returns the first widget, for the caller to focus; `null` when there is none.
   */
  enterCell(cell: BodyCell): HTMLElement | null;
  /**
   * Returns the entered cell to navigation mode and takes its widgets out of the Tab order again.
   * Returns the cell's element, or `null` when no cell was entered.
   */
  exitCell(): HTMLElement | null;
}

/** Creates the registry one `ngpTable` host provides to its cells. */
export function createFocusRegistry(): FocusRegistry {
  const elementByKey = new Map<string, HTMLElement>();
  const cellByElement = new Map<HTMLElement, BodyCell>();
  let tabStopWidget: HTMLElement | null = null;
  let entered: HTMLElement | null = null;

  // Note: the key carries the id's type so row `1` and row `'1'` stay distinct.
  function keyOf(cell: BodyCell): string {
    return `${typeof cell.rowId}:${String(cell.rowId)}|${cell.columnId}`;
  }

  function register(cell: BodyCell, element: HTMLElement): void {
    unregister(element);
    elementByKey.set(keyOf(cell), element);
    cellByElement.set(element, cell);
    markDescendants(element);
  }

  // Note: never marks the cell element itself; it carries the roving tabindex.
  function markDescendants(cellElement: HTMLElement): void {
    for (const child of Array.from(cellElement.children)) removeFromTabOrder(child);
  }

  function unregister(element: HTMLElement): void {
    const cell = cellByElement.get(element);
    if (cell === undefined) return;
    cellByElement.delete(element);
    if (entered === element) entered = null;
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

  function refreshWidgets(node: Node, boundary: HTMLElement): void {
    const cell = cellContaining(node, boundary);
    if (cell === null) return;
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return;

    // Note: an entered cell keeps its controls in the Tab order; exit re-marks them.
    const isEnteredCell = element === entered;
    if (isEnteredCell) return;
    if (node === element) markDescendants(element);
    else removeFromTabOrder(node);
  }

  function retrackTabindex(record: MutationRecord, boundary: HTMLElement): void {
    // Note: judged for every record, so the own-write count stays in step.
    const isOwnWrite = isOwnTabindexWrite(record);
    const target = record.target;
    const isNotBindingElement = isOwnWrite || !(target instanceof HTMLElement);
    if (isNotBindingElement) return;

    const cell = cellContaining(target, boundary);
    if (cell === null) return;
    const cellElement = elementByKey.get(keyOf(cell));
    // Note: the cell element carries the roving tabindex; an entered cell keeps its controls live.
    const isIgnored =
      cellElement === undefined || cellElement === target || cellElement === entered;
    if (isIgnored) return;

    saveBindingTabindex(target, record);
  }

  function focusTargetOf(cell: BodyCell): HTMLElement | null {
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return null;
    return findSingleWidget(element) ?? element;
  }

  function syncTabStop(active: BodyCell | null): void {
    const element = active === null ? undefined : elementByKey.get(keyOf(active));
    const widget = element === undefined ? null : findSingleWidget(element);

    const previousWidget = tabStopWidget;
    const hasStaleTabStop = previousWidget !== null && previousWidget !== widget;
    if (hasStaleTabStop) writeTabindex(previousWidget, '-1');
    tabStopWidget = widget;
    if (element === undefined) return;

    if (widget === null) {
      setCellTabindex(element, '0');
    } else {
      setCellTabindex(element, '-1');
      writeTabindex(widget, '0');
    }
  }

  // Note: a cell an outer grid took out of its Tab order only gets its saved original updated, so
  // the outer grid's `-1` is not fought over; the value comes back when the outer cell is entered.
  function setCellTabindex(element: HTMLElement, value: string): void {
    if (isTakenOutOfTabOrder(element)) setSavedTabindex(element, value);
    else if (element.getAttribute('tabindex') !== value) element.setAttribute('tabindex', value);
  }

  function enteredElement(): HTMLElement | null {
    return entered;
  }

  function enterCell(cell: BodyCell): HTMLElement | null {
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return null;
    const isSwitchingCell = entered !== null && entered !== element;
    if (isSwitchingCell) exitCell();
    entered = element;
    restoreTabOrder(element);
    return findFirstWidget(element);
  }

  function exitCell(): HTMLElement | null {
    const element = entered;
    if (element === null) return null;
    entered = null;
    markDescendants(element);
    return element;
  }

  return {
    register,
    unregister,
    elementOf,
    cellContaining,
    refreshWidgets,
    retrackTabindex,
    syncTabStop,
    focusTargetOf,
    enteredElement,
    enterCell,
    exitCell,
  };
}

/** Token for the focus registry of the nearest `ngpTable` host. */
export const NGP_TABLE_FOCUS_REGISTRY = new InjectionToken<FocusRegistry>(
  'NGP_TABLE_FOCUS_REGISTRY',
);
