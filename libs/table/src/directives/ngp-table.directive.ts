import {
  afterEveryRender,
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { classifyCellWidgets, isEditableTarget } from './cell-widgets';
import { createFocusRegistry, NGP_TABLE_FOCUS_REGISTRY } from './focus-registry';
import { nextGridTarget, nextTreegridTarget } from './keyboard-nav';
import type { BodyCell, GridCell, RegistryCell, RowTarget } from './keyboard-nav.types';
import { isRtlAt, pageStepOf } from './page-step';
import { createPanelRegistry, NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
import { NGP_TABLE_STORE } from './table.tokens';
import type { ColumnValueMap, FocusTarget, TableStore } from '../api/types';

/**
 * Binds a `createTable()` store to a native `<table>` or `<div>` grid host.
 *
 * @remarks
 * Provides the store, a panel registry and a focus registry to the row, cell and panel
 * directives inside it. Sets `role="grid"` (`treegrid` when the store composes `withTree()`),
 * `aria-rowcount` and `aria-colcount`, and moves focus with the arrow, Home, End and page keys.
 * In a treegrid a whole row is a focus target.
 *
 * @example
 * <table [ngpTable]="table"></table>
 */
@Directive({
  selector: 'table[ngpTable], div[ngpTable]',
  providers: [
    { provide: NGP_TABLE_STORE, useExisting: NgpTableDirective },
    { provide: NGP_TABLE_PANEL_REGISTRY, useFactory: createPanelRegistry },
    { provide: NGP_TABLE_FOCUS_REGISTRY, useFactory: createFocusRegistry },
  ],
  host: {
    // Note: set even on native `<table>`. An explicit role matching the implicit native one is a
    // documented no-op, so one directive serves both host tags.
    '[attr.role]': "isTreegrid() ? 'treegrid' : 'grid'",
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
    '(keydown)': 'navigateGridOnKeydown($event)',
    '(focusin)': 'followFocusIn($event)',
    '(focusout)': 'trackFocusOut($event)',
  },
})
export class NgpTableDirective<TRow = unknown, TValues extends ColumnValueMap = ColumnValueMap> {
  /** The table store this host renders. */
  readonly ngpTable: InputSignal<TableStore<TRow, TValues>> =
    input.required<TableStore<TRow, TValues>>();

  /** Whether the current store composes `withTree()`. Read from the store, never from row data. */
  readonly isTreegrid: Signal<boolean> = computed(() => 'tree' in this.ngpTable());

  /** The total row count bound to `aria-rowcount`. */
  readonly ariaRowCount: Signal<number> = computed(() => this.ngpTable().totalRowCount());

  /** The column count bound to `aria-colcount`. */
  readonly ariaColCount: Signal<number> = computed(() => this.ngpTable().columns().length);

  /** The grid position the single Tab stop sits on, or `null` when the grid has no column. */
  readonly activeTarget: Signal<FocusTarget | null> = computed((): FocusTarget | null => {
    const table = this.ngpTable();
    const focused = table.focus();
    if (focused !== null) return focused;

    const firstDataRow = table.renderRows().find((row) => row.kind !== 'group');
    const firstColumn = table.renderColumns()[0];
    if (firstColumn === undefined) return null;

    // Note: with no data row the header is the only place for the Tab stop; without it the grid
    // (and any sort control in the header) could not be reached by keyboard.
    if (firstDataRow === undefined) return { area: 'header', columnId: firstColumn.id };

    // Note: in a treegrid the first entry is the row itself, not its first cell.
    if (this.isTreegrid()) return { area: 'body', rowId: firstDataRow.id, columnId: null };

    return { area: 'body', rowId: firstDataRow.id, columnId: firstColumn.id };
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly focusRegistry = inject(NGP_TABLE_FOCUS_REGISTRY);
  private readonly destroyRef = inject(DestroyRef);

  // Note: remembered rather than read from `document.activeElement`, because removing the
  // focused cell drops focus to `<body>` without a `focusout` inside the host.
  private hasFocusWithin = false;
  private lastSeenFocusRequests: number | null = null;
  private lastSeenTable: TableStore<TRow, TValues> | null = null;
  // Note: set when focus leaves the grid; the row stays the Tab stop but its widgets go back to
  // `-1` until focus returns.
  private isRowWalkSuspended = false;

  constructor() {
    const flushAddedWidgets = this.keepAddedWidgetsOutOfTabOrder();

    // Cell bindings write the roving tabindex on the cell; this moves it onto a lone widget.
    // Runs after every render because a widget can appear or vanish without any signal change.
    // Controls the observer has not delivered yet are marked first, so the render never ends with
    // a stray Tab stop.
    afterEveryRender(() => {
      flushAddedWidgets();
      this.syncRowWalk();
      this.focusRegistry.syncTabStop(this.activeRegistryCell());
    });

    // Moves DOM focus to the stored position: always on a new `focusElement` request, otherwise
    // only while focus is already inside the grid. Else only the tabindex moves.
    effect(() => {
      const table = this.ngpTable();
      const focused = table.focus();
      const requests = table.focus.focusRequests();

      // A swapped store starts a new count, so its first read is not a request either.
      if (table !== this.lastSeenTable) {
        this.lastSeenTable = table;
        this.lastSeenFocusRequests = null;
      }

      // Never treat the first read as a request: no focus steal on load.
      const previous = this.lastSeenFocusRequests;
      const hasNewRequest = previous !== null && requests > previous;
      this.lastSeenFocusRequests = requests;

      // Focus lost to <body> (focused cell removed) still counts as inside; focus elsewhere does not.
      if (!this.isFocusInsideOrLost()) this.hasFocusWithin = false;

      const shouldMoveDomFocus = hasNewRequest || this.hasFocusWithin;
      if (!shouldMoveDomFocus) return;
      const cell = this.toFocusableCell(focused);
      if (cell === null) return;

      afterNextRender(() => this.focusCellElement(cell), { injector: this.injector });
    });
  }

  // Controls rendered into a cell after it registered (an edit mode, a swapped widget) must not
  // become Tab stops either.
  // Returns a function that handles the records the observer has queued but not yet delivered.
  private keepAddedWidgetsOutOfTabOrder(): () => void {
    if (typeof MutationObserver === 'undefined') return () => undefined;

    const markAdded = (records: MutationRecord[]): void => {
      // Note: a node touched by several records is refreshed once per batch.
      const touched = new Set<Node>();
      for (const record of records) {
        if (record.type === 'attributes') {
          this.focusRegistry.retrackTabindex(record, this.host);
          continue;
        }
        for (const added of Array.from(record.addedNodes)) touched.add(added);
        touched.add(record.target);
      }
      for (const node of touched) this.focusRegistry.refreshWidgets(node, this.host);
    };
    const observer = new MutationObserver((records) => {
      markAdded(records);
      this.syncRowWalk();
      this.focusRegistry.syncTabStop(this.activeRegistryCell());
    });
    observer.observe(this.host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex'],
    });
    this.destroyRef.onDestroy(() => observer.disconnect());
    return () => markAdded(observer.takeRecords());
  }

  // A focused row lets Tab walk its widgets; any other target puts them back to `-1`.
  private syncRowWalk(): void {
    const target = this.toFocusableCell(this.activeTarget());
    const isRowActive = target?.area === 'body' && target.columnId === null;
    if (isRowActive && !this.isRowWalkSuspended) this.focusRegistry.enterRow(target);
    else this.focusRegistry.exitRow();
  }

  /** Whether the host reads right-to-left now. Read per call, so a direction change is followed. */
  isRtl(): boolean {
    return isRtlAt(this.host);
  }

  protected navigateGridOnKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.defaultPrevented) return;

    const isTreegrid = this.isTreegrid();
    const current = isTreegrid
      ? this.toFocusableCell(this.activeTarget())
      : this.toGridCell(this.activeTarget());
    if (current === null) return;

    if (this.handleCompositeCellKey(event)) return;
    if (isEditableTarget(event.target)) return;

    const table = this.ngpTable();
    const dataRows = table.renderRows().filter((row) => row.kind !== 'group');
    const order = {
      rowIds: dataRows.map((row) => row.id),
      columnIds: table.renderColumns().map((column) => column.id),
    };
    // Note: direction and page step are read here, per keypress, so a host that changes either
    // between presses is followed.
    const focusedElement = this.elementOfGridCell(current) ?? this.host;
    const options = {
      isRtl: isRtlAt(this.host),
      pageSize: pageStepOf(this.host, focusedElement),
    };
    const next = isTreegrid
      ? nextTreegridTarget(
          { ...order, rowDepths: dataRows.map((row) => row.depth) },
          current,
          event,
          options,
        )
      : current.columnId === null
        ? null
        : nextGridTarget(order, current, event, options);
    if (next === null) return;

    // A header target with no registered header cell has no element to hold focus: stay put.
    const hasNoHeaderElement = next.area === 'header' && this.elementOfGridCell(next) === null;
    if (hasNoHeaderElement) {
      table.focus.moveTo(current);
      event.preventDefault();
      return;
    }

    table.focus.moveTo(next);
    event.preventDefault();
  }

  // Returns true when the key is settled here: handled as enter/exit, or left to an entered
  // cell's widgets. Esc/F2 exit runs before the widget and editable skips.
  private handleCompositeCellKey(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof Node)) return false;

    const entered = this.focusRegistry.enteredElement();
    // Note: focus on the entered cell itself is not inside it; it ends the entered state.
    const isTargetEnteredCell = entered !== null && entered === target;
    if (isTargetEnteredCell) this.focusRegistry.exitCell();
    const isInsideEntered = entered !== null && entered !== target && entered.contains(target);
    if (isInsideEntered) {
      const isExitKey = event.key === 'Escape' || event.key === 'F2';
      if (isExitKey) {
        this.focusRegistry.exitCell()?.focus();
        event.preventDefault();
      }
      return true;
    }

    const isEnterKey = event.key === 'Enter' || event.key === 'F2';
    if (!isEnterKey) return false;
    const cell = this.focusRegistry.cellContaining(target, this.host);
    if (cell === null) return false;
    const element = this.focusRegistry.elementOf(cell);
    const isCellItself = element !== null && element === target;
    const isCompositeCell = isCellItself && classifyCellWidgets(element) === 'composite';
    if (!isCompositeCell) return false;

    this.focusRegistry.enterCell(cell)?.focus();
    event.preventDefault();
    return true;
  }

  protected followFocusIn(event: Event): void {
    this.hasFocusWithin = true;
    this.isRowWalkSuspended = false;
    if (!(event.target instanceof Node)) return;

    // Tab landing on a widget of the focused row is the row's walk, not a move to its cell.
    if (this.focusRegistry.isRowWalkTarget(event.target, this.host)) return;

    // Focus back on the entered cell itself (Shift+Tab from its first widget, or its focused
    // widget removed) restores navigation.
    if (event.target === this.focusRegistry.enteredElement()) this.focusRegistry.exitCell();

    const cell = this.focusRegistry.cellContaining(event.target, this.host);
    if (cell === null) return;

    if ('area' in cell && cell.area === 'body') {
      this.writeRowTarget(cell);
      return;
    }

    // A pointer click straight into a composite cell's widget enters the cell.
    const cellElement = this.focusRegistry.elementOf(cell);
    const isWidgetOfComposite =
      cellElement !== null &&
      cellElement !== event.target &&
      classifyCellWidgets(cellElement) === 'composite';
    const isCellNotYetEntered = this.focusRegistry.enteredElement() !== cellElement;
    if (isWidgetOfComposite && isCellNotYetEntered) {
      this.focusRegistry.enterCell(cell);
    }

    if ('area' in cell) {
      // Compares `area` too: a body cell and a header cell share column ids.
      const target = this.activeTarget();
      const isHeaderAlreadyActive = target?.area === 'header' && target.columnId === cell.columnId;
      if (isHeaderAlreadyActive) return;

      this.ngpTable().focus.moveTo({ area: 'header', columnId: cell.columnId });
      return;
    }

    // Focus landing on the cell the store already points at writes nothing.
    const active = this.activeBodyCell();
    const isAlreadyActive =
      active !== null && active.rowId === cell.rowId && active.columnId === cell.columnId;
    if (isAlreadyActive) return;

    this.ngpTable().focus.moveTo({ area: 'body', rowId: cell.rowId, columnId: cell.columnId });
  }

  protected trackFocusOut(event: Event): void {
    if (!(event instanceof FocusEvent)) return;
    const next = event.relatedTarget;
    const isStillInside = next instanceof Node && this.host.contains(next);
    if (!isStillInside) this.hasFocusWithin = false;

    const isGridBlur = next === null && !document.hasFocus();
    if (!isStillInside && !isGridBlur) {
      this.isRowWalkSuspended = true;
      this.focusRegistry.exitRow();
    }

    const entered = this.focusRegistry.enteredElement();
    // Note: a null `relatedTarget` with the document unfocused is a window blur, not a focus move.
    const isWindowBlur = next === null && !document.hasFocus();
    const isFocusInsideEntered = next instanceof Node && entered?.contains(next) === true;
    const hasLeftEnteredCell = entered !== null && !isWindowBlur && !isFocusInsideEntered;
    if (hasLeftEnteredCell) this.focusRegistry.exitCell();
  }

  private isFocusInsideOrLost(): boolean {
    const active = document.activeElement;
    const isLost = active === null || active === document.body;
    return isLost || this.host.contains(active);
  }

  private activeRegistryCell(): RegistryCell | null {
    const cell = this.toFocusableCell(this.activeTarget());
    return cell === null ? null : this.registryCellOf(cell);
  }

  private activeBodyCell(): BodyCell | null {
    const target = this.activeTarget();
    if (target?.area !== 'body' || target.columnId === null) return null;
    return { rowId: target.rowId, columnId: target.columnId };
  }

  private toGridCell(target: FocusTarget | null): GridCell | null {
    if (target?.area === 'header') return { area: 'header', columnId: target.columnId };
    if (target?.area !== 'body' || target.columnId === null) return null;
    return { area: 'body', rowId: target.rowId, columnId: target.columnId };
  }

  // Focus landing on the row the store already points at writes nothing.
  private writeRowTarget(row: RowTarget): void {
    const target = this.activeTarget();
    const isAlreadyActive =
      target?.area === 'body' && target.columnId === null && target.rowId === row.rowId;
    if (isAlreadyActive) return;

    this.ngpTable().focus.moveTo({ area: 'body', rowId: row.rowId, columnId: null });
  }

  // Like `toGridCell`, but a body target with no column resolves to its row.
  private toFocusableCell(target: FocusTarget | null): GridCell | RowTarget | null {
    if (target?.area === 'body' && target.columnId === null) {
      return { area: 'body', rowId: target.rowId, columnId: null };
    }
    return this.toGridCell(target);
  }

  // Note: the registry tells header from body by an `area` key, so a body cell is passed without it.
  private registryCellOf(cell: GridCell | RowTarget): RegistryCell {
    if (cell.area === 'header' || cell.columnId === null) return cell;
    return { rowId: cell.rowId, columnId: cell.columnId };
  }

  private elementOfGridCell(cell: GridCell | RowTarget): HTMLElement | null {
    return this.focusRegistry.elementOf(this.registryCellOf(cell));
  }

  private focusCellElement(cell: GridCell | RowTarget): void {
    const element = this.focusRegistry.elementOf(this.registryCellOf(cell));
    if (element === null) return;

    // Note: a row contains its cells, so only the row itself counts as focus already there.
    const isRow = cell.area === 'body' && cell.columnId === null;
    const isFocusAlreadyInCell = isRow
      ? element === document.activeElement
      : element.contains(document.activeElement);
    if (isFocusAlreadyInCell) return;
    (this.focusRegistry.focusTargetOf(this.registryCellOf(cell)) ?? element).focus();
  }
}
