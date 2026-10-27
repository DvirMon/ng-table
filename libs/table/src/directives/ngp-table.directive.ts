import {
  afterNextRender,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { createFocusRegistry, NGP_TABLE_FOCUS_REGISTRY } from './focus-registry';
import { nextBodyTarget } from './keyboard-nav';
import type { BodyCell } from './keyboard-nav.types';
import { createPanelRegistry, NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
import { NGP_TABLE_STORE } from './table.tokens';
import type { ColumnValueMap, FocusTarget, TableStore } from '../api/types';

/**
 * Binds a `createTable()` store to a native `<table>` or `<div>` grid host.
 *
 * @remarks
 * Provides the store, a panel registry and a focus registry to the row, cell and panel
 * directives inside it. Sets `role="grid"`, `aria-rowcount` and `aria-colcount`, and moves
 * cell focus with the arrow, Home and End keys.
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
    role: 'grid',
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
    '(keydown)': 'navigateBodyOnKeydown($event)',
    '(focusin)': 'followFocusIn($event)',
    '(focusout)': 'trackFocusOut($event)',
  },
})
export class NgpTableDirective<TRow = unknown, TValues extends ColumnValueMap = ColumnValueMap> {
  /** The table store this host renders. */
  readonly ngpTable: InputSignal<TableStore<TRow, TValues>> =
    input.required<TableStore<TRow, TValues>>();

  /** The total row count bound to `aria-rowcount`. */
  readonly ariaRowCount: Signal<number> = computed(() => this.ngpTable().totalRowCount());

  /** The column count bound to `aria-colcount`. */
  readonly ariaColCount: Signal<number> = computed(() => this.ngpTable().columns().length);

  /** The grid position the single Tab stop sits on, or `null` when the grid has none. */
  readonly activeTarget: Signal<FocusTarget | null> = computed((): FocusTarget | null => {
    const table = this.ngpTable();
    const focused = table.focus();
    if (focused !== null) return focused;

    const firstDataRow = table.renderRows().find((row) => row.kind !== 'group');
    const firstColumn = table.renderColumns()[0];
    if (firstDataRow === undefined || firstColumn === undefined) return null;

    return { area: 'body', rowId: firstDataRow.id, columnId: firstColumn.id };
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly focusRegistry = inject(NGP_TABLE_FOCUS_REGISTRY);

  // Note: remembered rather than read from `document.activeElement`, because removing the
  // focused cell drops focus to `<body>` without a `focusout` inside the host.
  private hasFocusWithin = false;
  private lastSeenFocusRequests: number | null = null;

  constructor() {
    // Moves DOM focus to the stored position: always on a new `focusElement` request, otherwise
    // only while focus is already inside the grid. Else only the tabindex moves.
    effect(() => {
      const table = this.ngpTable();
      const focused = table.focus();
      const requests = table.focus.focusRequests();

      // Never treat the first read as a request: no focus steal on load.
      const previous = this.lastSeenFocusRequests;
      const hasNewRequest = previous !== null && requests > previous;
      this.lastSeenFocusRequests = requests;

      const shouldMoveDomFocus = hasNewRequest || this.hasFocusWithin;
      if (!shouldMoveDomFocus) return;
      if (focused?.area !== 'body' || focused.columnId === null) return;

      const cell: BodyCell = { rowId: focused.rowId, columnId: focused.columnId };
      afterNextRender(() => this.focusCellElement(cell), { injector: this.injector });
    });
  }

  protected navigateBodyOnKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.defaultPrevented) return;

    const current = this.activeBodyCell();
    if (current === null) return;

    const table = this.ngpTable();
    const order = {
      rowIds: table
        .renderRows()
        .filter((row) => row.kind !== 'group')
        .map((row) => row.id),
      columnIds: table.renderColumns().map((column) => column.id),
    };
    const next = nextBodyTarget(order, current, event);
    if (next === null) return;

    table.focus.moveTo({ area: 'body', rowId: next.rowId, columnId: next.columnId });
    event.preventDefault();
  }

  protected followFocusIn(event: Event): void {
    this.hasFocusWithin = true;
    if (!(event.target instanceof Node)) return;

    const cell = this.focusRegistry.cellContaining(event.target, this.host);
    if (cell === null) return;

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
  }

  private activeBodyCell(): BodyCell | null {
    const target = this.activeTarget();
    if (target?.area !== 'body' || target.columnId === null) return null;
    return { rowId: target.rowId, columnId: target.columnId };
  }

  private focusCellElement(cell: BodyCell): void {
    const element = this.focusRegistry.elementOf(cell);
    if (element === null) return;

    const isFocusAlreadyInCell = element.contains(document.activeElement);
    if (isFocusAlreadyInCell) return;
    element.focus();
  }
}
