import type { CellWidgetKind } from './cell-widgets.types';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

const COMPOSITE_ROLE_SELECTOR = [
  '[role="grid"]',
  '[role="treegrid"]',
  '[role="listbox"]',
  '[role="tree"]',
].join(',');

// Note: a WeakMap value of `null` means the element had no tabindex attribute.
const originalTabindex = new WeakMap<Element, string | null>();

/**
 * Finds what a body cell holds: nothing, one simple widget, or something needing its own keys.
 *
 * @remarks
 * Reads each element's saved original tabindex, so the result is the same before and after
 * `removeFromTabOrder`.
 */
export function classifyCellWidgets(cell: HTMLElement): CellWidgetKind {
  const hasCompositeRole = cell.querySelector(COMPOSITE_ROLE_SELECTOR) !== null;
  if (hasCompositeRole) return 'composite';

  const widgets = Array.from(cell.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isCountedWidget);
  if (widgets.length === 0) return 'none';
  if (widgets.length > 1) return 'composite';
  return isSimpleWidget(widgets[0]) ? 'single' : 'composite';
}

/** The first counted widget in `cell` in document order, or `null` when it has none. */
export function findFirstWidget(cell: HTMLElement): HTMLElement | null {
  const widget = Array.from(cell.querySelectorAll(FOCUSABLE_SELECTOR)).find(isCountedWidget);
  return widget instanceof HTMLElement ? widget : null;
}

const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image']);

/**
 * Whether keys typed on `target` belong to the user typing: a text input, textarea, select or
 * contenteditable element.
 *
 * @remarks
 * Checks the `contenteditable` attribute rather than `isContentEditable`, which a test DOM may
 * not implement.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/** The one counted widget in `cell` when it is a `single` cell, else `null`. */
export function findSingleWidget(cell: HTMLElement): HTMLElement | null {
  if (classifyCellWidgets(cell) !== 'single') return null;
  const widget = Array.from(cell.querySelectorAll(FOCUSABLE_SELECTOR)).find(isCountedWidget);
  return widget instanceof HTMLElement ? widget : null;
}

/**
 * Sets `tabindex="-1"` on `root` if it is focusable and on every focusable descendant.
 *
 * @remarks
 * Saves each element's original tabindex the first time it is marked, so marking twice keeps
 * the first original.
 */
export function removeFromTabOrder(root: Node): void {
  if (!(root instanceof Element)) return;

  const targets = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
  if (root.matches(FOCUSABLE_SELECTOR)) targets.unshift(root);

  for (const element of targets) {
    if (!originalTabindex.has(element)) {
      originalTabindex.set(element, element.getAttribute('tabindex'));
    }
    writeTabindex(element, '-1');
  }
}

/** Puts back every tabindex `removeFromTabOrder` saved under `cell`; a missing one stays missing. */
export function restoreTabOrder(cell: HTMLElement): void {
  for (const element of Array.from(cell.querySelectorAll('[tabindex]'))) {
    if (!originalTabindex.has(element)) continue;

    const original = originalTabindex.get(element);
    originalTabindex.delete(element);
    writeTabindex(element, original ?? null);
  }
}

// Note: counts the writes this module made per element, so the attribute observer can tell its own
// `tabindex` writes from a binding's. A record is judged once and the verdict kept, so every
// observer watching the same element agrees on it.
const pendingOwnWrites = new WeakMap<Element, number>();
const ownWriteVerdicts = new WeakMap<MutationRecord, boolean>();
const retrackedRecords = new WeakSet<MutationRecord>();

/** Writes `tabindex` (`null` removes it) only when the value differs, and counts the write as ours. */
export function writeTabindex(element: Element, value: string | null): void {
  if (element.getAttribute('tabindex') === value) return;
  if (value === null) element.removeAttribute('tabindex');
  else element.setAttribute('tabindex', value);
  pendingOwnWrites.set(element, (pendingOwnWrites.get(element) ?? 0) + 1);
}

/** Whether `element` was taken out of the Tab order and its original is still saved. */
export function isTakenOutOfTabOrder(element: Element): boolean {
  return originalTabindex.has(element);
}

/** Replaces the saved original of an element taken out of the Tab order; no DOM write. */
export function setSavedTabindex(element: Element, value: string | null): void {
  originalTabindex.set(element, value);
}

/**
 * Whether a `tabindex` attribute record came from `writeTabindex`.
 *
 * @remarks
 * Call it for every record: it settles the record's verdict once, however many observers ask.
 */
export function isOwnTabindexWrite(record: MutationRecord): boolean {
  const known = ownWriteVerdicts.get(record);
  if (known !== undefined) return known;

  const target = record.target;
  const pending = target instanceof Element ? (pendingOwnWrites.get(target) ?? 0) : 0;
  const isOwn = pending > 0;
  if (isOwn && target instanceof Element) pendingOwnWrites.set(target, pending - 1);
  ownWriteVerdicts.set(record, isOwn);
  return isOwn;
}

/**
 * Records a binding's new `tabindex` on `element` as its original, then marks it `-1`.
 *
 * @remarks
 * Handles each record once, so two observers watching the same element do not both save it.
 */
export function retrackTabindex(element: Element, record: MutationRecord): void {
  if (retrackedRecords.has(record)) return;
  retrackedRecords.add(record);

  if (!element.matches(FOCUSABLE_SELECTOR)) {
    originalTabindex.delete(element);
    return;
  }
  originalTabindex.set(element, element.getAttribute('tabindex'));
  writeTabindex(element, '-1');
}

function savedOrLiveTabindex(element: Element): string | null {
  return originalTabindex.has(element)
    ? (originalTabindex.get(element) ?? null)
    : element.getAttribute('tabindex');
}

function isCountedWidget(element: Element): boolean {
  const isDisabled = element.hasAttribute('disabled');
  const isHiddenInput = element instanceof HTMLInputElement && element.type === 'hidden';
  const isAriaHidden = element.closest('[aria-hidden="true"]') !== null;
  const isOutOfTabOrder = savedOrLiveTabindex(element) === '-1';
  return !isDisabled && !isHiddenInput && !isAriaHidden && !isOutOfTabOrder;
}

function isSimpleWidget(element: Element): boolean {
  if (element.closest('[contenteditable]:not([contenteditable="false"])') !== null) return false;
  if (element instanceof HTMLButtonElement) return true;
  if (element instanceof HTMLAnchorElement) return true;
  if (element instanceof HTMLInputElement) {
    return element.type === 'checkbox' || element.type === 'radio';
  }
  return false;
}
