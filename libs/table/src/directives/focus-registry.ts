import { InjectionToken } from '@angular/core';

import {
  findFirstWidget,
  findSingleWidget,
  hasCompositeRole,
  isOwnTabindexWrite,
  isTakenOutOfTabOrder,
  removeFromTabOrder,
  restoreCountedWidgets,
  restoreTabOrder,
  retrackTabindex as saveBindingTabindex,
  setSavedTabindex,
  writeTabindex,
} from './cell-widgets';
import type { RegistryCell, RowTarget } from './keyboard-nav.types';

/** One table's lookup between body cells and their rendered elements. */
export interface FocusRegistry {
  register(cell: RegistryCell, element: HTMLElement): void;
  unregister(element: HTMLElement): void;
  elementOf(cell: RegistryCell): HTMLElement | null;
  /** The registered cell at or above `node`, stopping at `boundary`. */
  cellContaining(node: Node, boundary: HTMLElement): RegistryCell | null;
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
  syncTabStop(active: RegistryCell | null): void;
  /** The element focus should land on for `cell`: its lone widget, else the cell itself. */
  focusTargetOf(cell: RegistryCell): HTMLElement | null;
  /** The element of the cell currently in entered mode, or `null` in navigation mode. */
  enteredElement(): HTMLElement | null;
  /**
   * Puts `cell`'s widgets back in the Tab order so Tab walks them natively.
   * Returns the first widget, for the caller to focus; `null` when there is none.
   */
  enterCell(cell: RegistryCell): HTMLElement | null;
  /**
   * Returns the entered cell to navigation mode and takes its widgets out of the Tab order again.
   * Returns the cell's element, or `null` when no cell was entered.
   */
  exitCell(): HTMLElement | null;
  /**
   * Puts the operable widgets in `row`'s cells back in the Tab order so Tab walks them, then
   * leaves the grid. Switches from any other row; does nothing when `row` is already entered.
   */
  enterRow(row: RowTarget): void;
  /** Takes the entered row's widgets out of the Tab order again. Does nothing outside row mode. */
  exitRow(): void;
  /**
   * Whether `target` is a control inside a cell of the entered row, so focus landing on it is the
   * row's Tab walk and not a move to that cell. A nested composite cell is not part of the walk.
   */
  isRowWalkTarget(target: Node, boundary: HTMLElement): boolean;
}

/** Creates the registry one `ngpTable` host provides to its cells. */
export function createFocusRegistry(): FocusRegistry {
  const elementByKey = new Map<string, HTMLElement>();
  const cellByElement = new Map<HTMLElement, RegistryCell>();
  let tabStopWidget: HTMLElement | null = null;
  let entered: HTMLElement | null = null;
  let rowEntered: HTMLElement | null = null;

  // Note: a row has its own `row|` prefix, so a column whose id is `'null'` cannot collide with it.
  function isRow(cell: RegistryCell): cell is RowTarget {
    return 'area' in cell && cell.area === 'body';
  }

  // Note: the key carries the id's type so row `1` and row `'1'` stay distinct. Header keys start
  // with `header|`, which no body key can (those start with a `typeof` name and `:`).
  function keyOf(cell: RegistryCell): string {
    if (isRow(cell)) return `row|${typeof cell.rowId}:${String(cell.rowId)}`;
    if ('area' in cell) return `header|${cell.columnId}`;
    return `${typeof cell.rowId}:${String(cell.rowId)}|${cell.columnId}`;
  }

  function register(cell: RegistryCell, element: HTMLElement): void {
    unregister(element);
    elementByKey.set(keyOf(cell), element);
    cellByElement.set(element, cell);
    // Note: a row's children are cells with their own bindings; marking them would strip the
    // active cell's tabindex.
    if (!isRow(cell)) markDescendants(element);
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
    if (rowEntered === element) rowEntered = null;
    const key = keyOf(cell);
    const isRegisteredElement = elementByKey.get(key) === element;
    if (isRegisteredElement) elementByKey.delete(key);
  }

  function elementOf(cell: RegistryCell): HTMLElement | null {
    return elementByKey.get(keyOf(cell)) ?? null;
  }

  function cellContaining(node: Node, boundary: HTMLElement): RegistryCell | null {
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
    if (cell === null || isRow(cell)) return;
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return;

    // Note: an entered cell, or a cell of the entered row, keeps its controls in the Tab order;
    // exit re-marks them.
    const isEnteredCell = element === entered;
    if (isEnteredCell || isWalkedCell(element)) return;
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
    if (cell === null || isRow(cell)) return;
    const cellElement = elementByKey.get(keyOf(cell));
    // Note: the cell element carries the roving tabindex; an entered cell keeps its controls live.
    const isIgnored =
      cellElement === undefined ||
      cellElement === target ||
      cellElement === entered ||
      isWalkedCell(cellElement);
    if (isIgnored) return;

    saveBindingTabindex(target, record);
  }

  // Note: a nested composite cell is never walked; its own grid owns its Tab stop.
  function isWalkedCell(cellElement: HTMLElement): boolean {
    return (
      rowEntered !== null && rowEntered.contains(cellElement) && !hasCompositeRole(cellElement)
    );
  }

  function focusTargetOf(cell: RegistryCell): HTMLElement | null {
    const element = elementByKey.get(keyOf(cell));
    if (element === undefined) return null;
    if (isRow(cell)) return element;
    return findSingleWidget(element) ?? element;
  }

  function syncTabStop(active: RegistryCell | null): void {
    const element = active === null ? undefined : elementByKey.get(keyOf(active));
    const isRowStop = active !== null && isRow(active);
    const widget = element === undefined || isRowStop ? null : findSingleWidget(element);

    const previousWidget = tabStopWidget;
    // Note: a widget the row walk restored keeps its restored value.
    const isWalked = previousWidget !== null && rowEntered?.contains(previousWidget) === true;
    const hasStaleTabStop = previousWidget !== null && previousWidget !== widget && !isWalked;
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

  function enterCell(cell: RegistryCell): HTMLElement | null {
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

  function cellElementsOf(row: HTMLElement): HTMLElement[] {
    const cellElements: HTMLElement[] = [];
    for (const [cellElement, cell] of cellByElement) {
      if (!isRow(cell) && row.contains(cellElement)) cellElements.push(cellElement);
    }
    return cellElements;
  }

  function enterRow(row: RowTarget): void {
    const element = elementByKey.get(keyOf(row));
    if (element !== undefined && element === rowEntered) return;
    exitRow();
    if (element === undefined) return;
    rowEntered = element;
    for (const cellElement of cellElementsOf(element)) restoreCountedWidgets(cellElement);
  }

  function exitRow(): void {
    const element = rowEntered;
    if (element === null) return;
    rowEntered = null;
    for (const cellElement of cellElementsOf(element)) markDescendants(cellElement);
  }

  function isRowWalkTarget(target: Node, boundary: HTMLElement): boolean {
    if (rowEntered === null) return false;
    const cell = cellContaining(target, boundary);
    if (cell === null || isRow(cell)) return false;
    const cellElement = elementByKey.get(keyOf(cell));
    if (cellElement === undefined || cellElement === target) return false;
    return isWalkedCell(cellElement);
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
    enterRow,
    exitRow,
    isRowWalkTarget,
  };
}

/** Token for the focus registry of the nearest `ngpTable` host. */
export const NGP_TABLE_FOCUS_REGISTRY = new InjectionToken<FocusRegistry>(
  'NGP_TABLE_FOCUS_REGISTRY',
);
