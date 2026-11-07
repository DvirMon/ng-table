import { Component, computed, signal, type Type, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgpTableDirective } from './ngp-table.directive';
import { NGP_TABLE_STORE } from './table.tokens';
import { NgpTableCellDirective } from './ngp-table-cell.directive';
import { NgpTableHeaderCellDirective } from './ngp-table-header-cell.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { NgpTableTreeRowDirective } from './ngp-table-tree-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withGrouping } from '../api/features/with-grouping/feature';
import {
  createMockRows,
  createTaskTreeTable,
  mockGroupingRows,
  mockGroupingTrackBy,
  mockRows,
  mockTrackBy,
  noData,
  type GroupingMockRow,
  type MockRow,
} from '../table.mock';

const US_HEADER_ID = 'group:>region:string:US';

const IMPORTS = [NgpTableDirective, NgpTableRowDirective, NgpTableCellDirective];

const NATIVE_TEMPLATE = `
  <table [ngpTable]="table">
    <tbody>
      @for (row of table.renderRows(); track row.id) {
        <tr [ngpTableRow]="row">
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <td [ngpTableCell]="i">{{ column.id }}</td>
          }
        </tr>
      }
    </tbody>
  </table>
`;

const DIV_TEMPLATE = `
  <div [ngpTable]="table">
    @for (row of table.renderRows(); track row.id) {
      <div [ngpTableRow]="row">
        @for (column of table.renderColumns(); track column.id; let i = $index) {
          <div [ngpTableCell]="i">{{ column.id }}</div>
        }
      </div>
    }
  </div>
`;

const BARE_CELL_TEMPLATE = `
  <table [ngpTable]="table">
    <tbody>
      <tr><td [ngpTableCell]="0">bare</td></tr>
    </tbody>
  </table>
`;

function createFlatTable(
  rows: GroupingMockRow[],
  columnIds: { id: 'region' | 'category' | 'amount'; visible?: boolean }[],
) {
  return createTable(signal<GroupingMockRow[]>(rows), {
    trackBy: mockGroupingTrackBy,
    columns: createColumns(noData<GroupingMockRow>(), (col) =>
      columnIds.map(({ id, visible }) => col(id, { visible })),
    ),
  });
}

const ALL_COLUMNS = [
  { id: 'region' as const },
  { id: 'category' as const },
  { id: 'amount' as const },
];

@Component({ imports: IMPORTS, template: NATIVE_TEMPLATE })
class FlatHost {
  readonly table = createFlatTable(mockGroupingRows, ALL_COLUMNS);
}

@Component({ imports: IMPORTS, template: DIV_TEMPLATE })
class DivHost {
  readonly table = createFlatTable(mockGroupingRows, ALL_COLUMNS);
}

@Component({ imports: IMPORTS, template: NATIVE_TEMPLATE })
class HiddenFirstColumnHost {
  readonly table = createFlatTable(mockGroupingRows, [
    { id: 'region', visible: false },
    { id: 'category' },
    { id: 'amount' },
  ]);
}

@Component({ imports: IMPORTS, template: NATIVE_TEMPLATE })
class GroupedHost {
  readonly table = createTable(
    signal<GroupingMockRow[]>(mockGroupingRows),
    {
      trackBy: mockGroupingTrackBy,
      columns: createColumns(noData<GroupingMockRow>(), (col) => [
        col('region'),
        col('category'),
        col('amount'),
      ]),
    },
    withGrouping({ initial: ['region'] }),
  );
}

@Component({ imports: IMPORTS, template: NATIVE_TEMPLATE })
class EmptyHost {
  readonly table = createFlatTable([], ALL_COLUMNS);
}

@Component({ imports: IMPORTS, template: NATIVE_TEMPLATE })
class AllHiddenHost {
  readonly table = createFlatTable(
    mockGroupingRows,
    ALL_COLUMNS.map(({ id }) => ({ id, visible: false })),
  );
}

@Component({ imports: IMPORTS, template: BARE_CELL_TEMPLATE })
class BareCellHost {
  readonly table = createFlatTable(mockGroupingRows, ALL_COLUMNS);
}

@Component({
  imports: [NgpTableCellDirective],
  template: '<table><tbody><tr><td [ngpTableCell]="0">x</td></tr></tbody></table>',
})
class RegistrylessCellHost {}

interface Setup<THost> {
  fixture: ComponentFixture<THost>;
  root: HTMLElement;
  host: THost;
  tabStops: () => HTMLElement[];
  directive: () => NgpTableDirective;
}

function setup<THost>(hostType: Type<THost>): Setup<THost> {
  const fixture = TestBed.createComponent(hostType);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    root,
    host: fixture.componentInstance,
    tabStops: () => Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]')),
    directive: () =>
      fixture.debugElement.query(By.directive(NgpTableDirective)).injector.get(NgpTableDirective),
  };
}

function rowIndexOf(cell: HTMLElement): string | null | undefined {
  return cell.closest('[role="row"]')?.getAttribute('aria-rowindex');
}

describe('NgpTableDirective roles', () => {
  it.each([
    ['native table', FlatHost],
    ['div grid', DivHost],
  ] as const)(
    'sets role="grid" on the %s host and role="gridcell" on its cells',
    (_name, hostType) => {
      const { root } = setup<FlatHost | DivHost>(hostType);
      const tableHost = root.firstElementChild;
      const cells = Array.from(root.querySelectorAll<HTMLElement>('[aria-colindex]'));

      expect(tableHost?.getAttribute('role')).toBe('grid');
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) expect(cell.getAttribute('role')).toBe('gridcell');
      expect(root.querySelector('[role="table"]')).toBeNull();
      expect(root.querySelector('[role="cell"]')).toBeNull();
    },
  );
});

describe('NgpTableDirective roving tabindex', () => {
  it('puts the only tabindex="0" on the first data row\'s first cell when nothing is focused yet', () => {
    const { root, tabStops } = setup(FlatHost);
    const stops = tabStops();

    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('aria-colindex')).toBe('1');
    expect(rowIndexOf(stops[0])).toBe('1');
    const others = Array.from(root.querySelectorAll<HTMLElement>('td')).filter(
      (cell) => cell !== stops[0],
    );
    expect(others.length).toBeGreaterThan(0);
    for (const cell of others) expect(cell.getAttribute('tabindex')).toBe('-1');
  });

  it("resolves a cell's column through renderColumns() when the first declared column is hidden", () => {
    const { tabStops } = setup(HiddenFirstColumnHost);
    const stops = tabStops();

    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute('aria-colindex')).toBe('1');
    expect(stops[0].textContent?.trim()).toBe('category');
    expect(rowIndexOf(stops[0])).toBe('1');
  });

  it('skips group header rows when choosing the first-entry cell', () => {
    const { root, tabStops } = setup(GroupedHost);
    const stops = tabStops();
    const firstDataRow = root.querySelector<HTMLElement>(
      '[role="row"]:not([data-row-kind="group"])',
    );

    expect(stops).toHaveLength(1);
    expect(stops[0].closest('[role="row"]')?.getAttribute('data-row-kind')).not.toBe('group');
    expect(stops[0].closest('[role="row"]')).toBe(firstDataRow);
    expect(stops[0].getAttribute('aria-colindex')).toBe('1');
  });

  it('moves the single tabindex="0" to the cell named by focus.moveTo', () => {
    const { fixture, host, root, tabStops } = setup(FlatHost);
    const defaultCell = tabStops()[0];

    host.table.focus.moveTo({ area: 'body', rowId: 3, columnId: 'amount' });
    fixture.detectChanges();

    const stops = tabStops();
    expect(stops).toHaveLength(1);
    expect(stops[0].textContent?.trim()).toBe('amount');
    expect(rowIndexOf(stops[0])).toBe('3');
    expect(defaultCell.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('binds no tabindex on group header cells, even when focus() names the group row', () => {
    const { fixture, host, root } = setup(GroupedHost);

    host.table.focus.moveTo({ area: 'body', rowId: US_HEADER_ID, columnId: 'category' });
    fixture.detectChanges();

    const groupCells = Array.from(
      root.querySelectorAll<HTMLElement>('[data-row-kind="group"] [role="gridcell"]'),
    );
    expect(groupCells.length).toBeGreaterThan(0);
    for (const cell of groupCells) expect(cell.hasAttribute('tabindex')).toBe(false);
  });

  it('renders a cell outside ngpTableRow without throwing and without a tabindex', () => {
    const fixture = TestBed.createComponent(BareCellHost);

    expect(() => fixture.detectChanges()).not.toThrow();
    const cell = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('td');
    expect(cell?.getAttribute('role')).toBe('gridcell');
    expect(cell?.hasAttribute('tabindex')).toBe(false);
  });

  it('renders a cell that has no focus registry without throwing', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NGP_TABLE_STORE,
          useValue: { ngpTable: () => ({ renderColumns: () => [] }), activeTarget: () => null },
        },
      ],
    });
    const fixture = TestBed.createComponent(RegistrylessCellHost);

    expect(() => fixture.detectChanges()).not.toThrow();
    const cell = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('td');
    expect(cell?.getAttribute('role')).toBe('gridcell');
  });

  it('reports a null activeTarget when every column is hidden', () => {
    const { directive } = setup<AllHiddenHost>(AllHiddenHost);

    expect(directive().activeTarget()).toBeNull();
  });

  it('reports the first header as the activeTarget when the table has no data rows', () => {
    const { directive } = setup<EmptyHost>(EmptyHost);

    expect(directive().activeTarget()).toEqual({ area: 'header', columnId: 'region' });
  });
});

const GRID_HEAD = `
  <button type="button" id="outside">Outside</button>
  <table [ngpTable]="table">
    <tbody>
`;

const GRID_ROW = `
        <tr [ngpTableRow]="row">
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <td [ngpTableCell]="i">
              {{ column.id }}
              @if (row.id === 2 && column.id === 'name') {
                <button type="button">Act</button>
              }
            </td>
          }
        </tr>
`;

const GRID_TAIL = `
    </tbody>
  </table>
`;

const GRID_TEMPLATE = `${GRID_HEAD}
      @for (row of table.renderRows(); track row.id) {${GRID_ROW}      }${GRID_TAIL}`;

const REVERSED_GRID_TEMPLATE = `${GRID_HEAD}
      @for (row of reversedRows(); track row.id) {${GRID_ROW}      }${GRID_TAIL}`;

function createGridTable(data: WritableSignal<MockRow[]>) {
  return createTable(data, {
    trackBy: mockTrackBy,
    columns: createColumns(noData<MockRow>(), (col) => [col('id'), col('name')]),
  });
}

@Component({ imports: IMPORTS, template: GRID_TEMPLATE })
class GridHost {
  readonly data = signal<MockRow[]>([...mockRows]);
  readonly table = createGridTable(this.data);
}

@Component({ imports: IMPORTS, template: REVERSED_GRID_TEMPLATE })
class ReversedRowsHost {
  readonly data = signal<MockRow[]>([...mockRows]);
  readonly table = createGridTable(this.data);
  protected readonly reversedRows = computed(() => [...this.table.renderRows()].reverse());
}

@Component({
  imports: IMPORTS,
  template: `
    <button type="button" id="outside">Outside</button>
    <table [ngpTable]="table()">
      <tbody>
        @for (row of table().renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table().renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">{{ column.id }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class SwappableStoreHost {
  readonly table = signal(createGridTable(signal<MockRow[]>([...mockRows])));
}

describe('NgpTableDirective keyboard and DOM focus', () => {
  type GridColumn = 'id' | 'name';

  function setupGrid<THost extends GridHost | ReversedRowsHost>(hostType: Type<THost>) {
    const fixture = TestBed.createComponent(hostType);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();

    const cell = (rowId: number, columnId: GridColumn): HTMLElement => {
      const colIndex = columnId === 'id' ? '1' : '2';
      const found = root.querySelector<HTMLElement>(
        `[aria-rowindex="${rowId}"] [aria-colindex="${colIndex}"]`,
      );
      if (found === null) throw new Error(`no cell ${rowId}/${columnId}`);
      return found;
    };
    const outside = (): HTMLElement => {
      const found = root.querySelector<HTMLElement>('#outside');
      if (found === null) throw new Error('no outside button');
      return found;
    };
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));

    return { fixture, host: fixture.componentInstance, flush, cell, outside, press, tabStops };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([
    ['ArrowDown', { key: 'ArrowDown' }, 2, 'id'],
    ['ArrowRight', { key: 'ArrowRight' }, 1, 'name'],
    ['End', { key: 'End' }, 1, 'name'],
    ['Ctrl+End', { key: 'End', ctrlKey: true }, 3, 'name'],
  ] as const)('moves to the next cell on %s', (_name, init, rowId, columnId) => {
    const { host, flush, cell, press, tabStops } = setupGrid(GridHost);
    cell(1, 'id').focus();
    flush();

    const event = press(cell(1, 'id'), init);
    flush();

    expect(host.table.focus()).toEqual({ area: 'body', rowId, columnId });
    expect(document.activeElement).toBe(cell(rowId, columnId));
    expect(tabStops()).toEqual([cell(rowId, columnId)]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores a key event a consumer already prevented', () => {
    const { host, flush, cell, press } = setupGrid(GridHost);
    cell(1, 'id').focus();
    flush();

    const prevented = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    cell(1, 'id').dispatchEvent(prevented);
    flush();

    expect(host.table.focus()).toBeNull();
    expect(document.activeElement).toBe(cell(1, 'id'));

    press(cell(1, 'id'), { key: 'ArrowDown' });
    flush();
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'id' });
  });

  it.each(['Tab', 'a'])('leaves an unhandled %s key alone', (key) => {
    const { host, flush, cell, press } = setupGrid(GridHost);
    cell(1, 'id').focus();
    flush();

    const event = press(cell(1, 'id'), { key });
    flush();

    expect(event.defaultPrevented).toBe(false);
    expect(host.table.focus()).toBeNull();

    press(cell(1, 'id'), { key: 'ArrowDown' });
    flush();
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'id' });
  });

  it('takes the next row from renderRows() order, not DOM order', () => {
    const { host, flush, cell, press } = setupGrid(ReversedRowsHost);
    cell(1, 'id').focus();
    flush();

    press(cell(1, 'id'), { key: 'ArrowDown' });
    flush();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'id' });
    expect(document.activeElement).toBe(cell(2, 'id'));
  });

  it.each([
    ['the cell itself', false],
    ['a button inside the cell', true],
  ] as const)('writes the focused cell to the store on focusin (%s)', (_name, useButton) => {
    const { host, flush, cell, tabStops } = setupGrid(GridHost);
    const button = cell(2, 'name').querySelector<HTMLElement>('button');
    const target = useButton ? button : cell(2, 'name');
    if (target === null) throw new Error('no focus target');

    target.focus();
    flush();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'name' });
    // K34: row 2 `name` holds one button, so the button is the cell's Tab stop either way.
    expect(tabStops()).toEqual([button]);
    expect(document.activeElement).toBe(target);
  });

  it('moves DOM focus with a moveTo while focus is inside the grid', () => {
    const { host, flush, cell } = setupGrid(GridHost);
    cell(1, 'id').focus();
    flush();

    host.table.focus.moveTo({ area: 'body', rowId: 3, columnId: 'name' });
    flush();

    expect(document.activeElement).toBe(cell(3, 'name'));
  });

  it('still moves DOM focus after the focused cell was removed from the DOM', () => {
    const { host, flush, cell } = setupGrid(GridHost);
    // Looked up before removal: aria-rowindex shifts once row 2 is gone, the element does not.
    const rowOneCell = cell(1, 'id');
    cell(2, 'id').focus();
    flush();

    host.data.update((rows) => rows.filter((row) => row.id !== 2));
    flush();
    // K9d: recovery moves DOM focus into the grid while focus was inside it, so it is not <body>.
    const recovered = document.activeElement;
    expect(recovered?.getAttribute('role')).toBe('gridcell');
    expect(recovered?.closest('[role="grid"], [role="treegrid"]')).not.toBeNull();
    expect(recovered).not.toBe(rowOneCell);

    host.table.focus.moveTo({ area: 'body', rowId: 1, columnId: 'id' });
    flush();

    expect(document.activeElement).toBe(rowOneCell);
  });

  it('stops following focus once it moved outside after the focused cell was removed', () => {
    const { host, flush, cell, outside } = setupGrid(GridHost);
    cell(2, 'id').focus();
    flush();

    host.data.update((rows) => rows.filter((row) => row.id !== 2));
    flush();
    // Focus left the grid with no `focusout` inside it: the removed cell had already lost focus.
    outside().focus();
    flush();

    host.table.focus.moveTo({ area: 'body', rowId: 3, columnId: 'id' });
    flush();

    expect(document.activeElement).toBe(outside());
  });

  it('does not treat a swapped-in store with a higher request count as a request', () => {
    const fixture = TestBed.createComponent(SwappableStoreHost);
    document.body.appendChild(fixture.nativeElement);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();
    const host = fixture.componentInstance;
    const next = TestBed.runInInjectionContext(() =>
      createGridTable(signal<MockRow[]>([...mockRows])),
    );
    next.focus.moveTo({ area: 'body', rowId: 2, columnId: 'name' }, { focusElement: true });
    next.focus.moveTo({ area: 'body', rowId: 3, columnId: 'name' }, { focusElement: true });
    const outside = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('#outside');
    outside?.focus();

    host.table.set(next);
    flush();

    expect(document.activeElement).toBe(outside);
  });

  it('focuses a just-added row on a focusElement request once it renders', () => {
    const { host, flush, cell, outside } = setupGrid(GridHost);
    outside().focus();
    flush();

    host.data.update((rows) => [...rows, { id: 4, name: 'Dee' }]);
    host.table.focus.moveTo({ area: 'body', rowId: 4, columnId: 'name' }, { focusElement: true });
    flush();

    expect(document.activeElement).toBe(cell(4, 'name'));
  });

  it('never moves DOM focus from outside the grid without a focusElement request', () => {
    const { host, flush, cell, outside, tabStops } = setupGrid(GridHost);
    expect(document.activeElement).toBe(document.body);

    outside().focus();
    host.table.focus.moveTo({ area: 'body', rowId: 3, columnId: 'name' });
    flush();
    expect(document.activeElement).toBe(outside());
    expect(tabStops()).toEqual([cell(3, 'name')]);

    host.table.focus.moveTo({ area: 'body', rowId: 2, columnId: 'name' }, { focusElement: true });
    flush();
    // K34: row 2 `name` is a single-widget cell, so DOM focus lands on its button.
    expect(document.activeElement).toBe(cell(2, 'name').querySelector('button'));

    outside().focus();
    host.table.focus.moveTo({ area: 'body', rowId: 1, columnId: 'id' });
    flush();
    expect(document.activeElement).toBe(outside());
  });
});

@Component({
  imports: IMPORTS,
  template: `
    <button type="button" id="outside">Outside</button>
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table.renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">
                @if (column.id === 'name') {
                  @if (showCheckbox()) {
                    <input type="checkbox" [attr.aria-label]="'Select ' + row.id" />
                  }
                } @else if (row.id === 3) {
                  <button type="button">Edit 3</button>
                  <button type="button">Delete 3</button>
                } @else {
                  {{ column.id }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class WidgetGridHost {
  readonly data = signal<MockRow[]>([...mockRows]);
  readonly table = createGridTable(this.data);
  readonly showCheckbox = signal(true);
}

describe('NgpTableDirective single-widget cells', () => {
  function setupWidgetGrid() {
    const fixture = TestBed.createComponent(WidgetGridHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();

    const cell = (rowId: number, columnId: 'id' | 'name'): HTMLElement => {
      const colIndex = columnId === 'id' ? '1' : '2';
      const found = root.querySelector<HTMLElement>(
        `[aria-rowindex="${rowId}"] [aria-colindex="${colIndex}"]`,
      );
      if (found === null) throw new Error(`no cell ${rowId}/${columnId}`);
      return found;
    };
    const widget = (label: string): HTMLElement => {
      const found = Array.from(root.querySelectorAll<HTMLElement>('input, button')).find(
        (el) => (el.getAttribute('aria-label') ?? el.textContent?.trim()) === label,
      );
      if (found === undefined) throw new Error(`no widget ${label}`);
      return found;
    };
    const outside = (): HTMLElement => {
      const found = root.querySelector<HTMLElement>('#outside');
      if (found === null) throw new Error('no outside button');
      return found;
    };
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));

    return { host: fixture.componentInstance, flush, cell, widget, outside, press, tabStops };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('puts the only tabindex="0" on the widget of a single-widget active cell', () => {
    const { host, flush, cell, widget, outside, tabStops } = setupWidgetGrid();

    outside().focus();
    host.table.focus.moveTo({ area: 'body', rowId: 2, columnId: 'name' });
    flush();

    expect(widget('Select 2').getAttribute('tabindex')).toBe('0');
    expect(cell(2, 'name').getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([widget('Select 2')]);
    expect(document.activeElement).toBe(outside());
  });

  it('focuses the widget when arrowing onto a single-widget cell', () => {
    const { host, flush, cell, widget, press, tabStops } = setupWidgetGrid();
    cell(1, 'id').focus();
    flush();

    const event = press(cell(1, 'id'), { key: 'ArrowRight' });
    flush();

    expect(document.activeElement).toBe(widget('Select 1'));
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });
    expect(tabStops()).toEqual([widget('Select 1')]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('focuses a multi-widget cell itself when arrowed onto', () => {
    const { flush, cell, widget, press, tabStops } = setupWidgetGrid();
    cell(2, 'id').focus();
    flush();

    press(cell(2, 'id'), { key: 'ArrowDown' });
    flush();

    expect(document.activeElement).toBe(cell(3, 'id'));
    expect(widget('Edit 3').getAttribute('tabindex')).toBe('-1');
    expect(widget('Delete 3').getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([cell(3, 'id')]);
  });

  it('navigates from a focused widget and returns it to tabindex="-1"', () => {
    const { flush, cell, widget, press, tabStops } = setupWidgetGrid();
    cell(1, 'id').focus();
    flush();
    press(cell(1, 'id'), { key: 'ArrowRight' });
    flush();
    expect(document.activeElement).toBe(widget('Select 1'));

    press(widget('Select 1'), { key: 'ArrowLeft' });
    flush();

    expect(document.activeElement).toBe(cell(1, 'id'));
    expect(widget('Select 1').getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([cell(1, 'id')]);
  });

  it('moves the Tab stop back to the cell when its only widget is removed', () => {
    const { host, flush, cell, outside, tabStops } = setupWidgetGrid();
    outside().focus();
    host.table.focus.moveTo({ area: 'body', rowId: 2, columnId: 'name' });
    flush();

    host.showCheckbox.set(false);
    flush();

    expect(tabStops()).toEqual([cell(2, 'name')]);
  });
});

@Component({
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table.renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">
                @if (i === 0) {
                  <button type="button">b</button>
                  <a href="#">l</a>
                  <input />
                  <span tabindex="0">s</span>
                } @else {
                  {{ column.id }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class WidgetCellsHost {
  readonly table = createFlatTable(mockGroupingRows, ALL_COLUMNS);
}

@Component({
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table.renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">
                @if (i === 0 && edit()) {
                  <button type="button" class="added">b</button>
                  <div><input class="nested" /></div>
                } @else {
                  {{ column.id }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class SwapCellsHost {
  readonly edit = signal(false);
  readonly table = createFlatTable(mockGroupingRows, ALL_COLUMNS);
}

@Component({
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <thead>
        <tr>
          <th>
            @if (show()) {
              <button type="button" id="head-btn">sort</button>
            }
          </th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table.renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">
                @if (i === 1 && show()) {
                  <button type="button" class="cell-btn">b</button>
                } @else {
                  {{ column.id }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class HeaderAndCellHost {
  readonly show = signal(false);
  readonly table = createFlatTable(mockGroupingRows, ALL_COLUMNS);
}

describe('NgpTableDirective cell widgets tab order', () => {
  const flushObserver = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve));

  it('marks every focusable already inside a cell as tabindex="-1" when the cell registers', () => {
    const { root, tabStops } = setup(WidgetCellsHost);
    const widgets = Array.from(
      root.querySelectorAll<HTMLElement>('td button, td a, td input, td span'),
    );

    expect(widgets.length).toBeGreaterThan(0);
    for (const widget of widgets) expect(widget.getAttribute('tabindex')).toBe('-1');
    const stops = tabStops();
    expect(stops).toHaveLength(1);
    expect(stops[0].tagName).toBe('TD');
    expect(stops[0].getAttribute('aria-colindex')).toBe('1');
    expect(rowIndexOf(stops[0])).toBe('1');
  });

  it('marks a control added or swapped into a registered cell after the observer flushes', async () => {
    const { fixture, root, host, tabStops } = setup(SwapCellsHost);

    host.edit.set(true);
    fixture.detectChanges();
    await flushObserver();

    const added = Array.from(root.querySelectorAll<HTMLElement>('.added, .nested'));
    expect(added.length).toBeGreaterThan(0);
    for (const el of added) expect(el.getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toHaveLength(1);
  });

  it('leaves focusables outside registered cells untouched while marking the ones inside', async () => {
    const { fixture, root, host } = setup(HeaderAndCellHost);

    host.show.set(true);
    fixture.detectChanges();
    await flushObserver();

    expect(root.querySelector('#head-btn')?.hasAttribute('tabindex')).toBe(false);
    expect(root.querySelector('.cell-btn')?.getAttribute('tabindex')).toBe('-1');
  });
});

@Component({
  imports: IMPORTS,
  template: `
    <button type="button" id="outside">Outside</button>
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table.renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">
                @if (row.id === 1 && column.id === 'name') {
                  @switch (editor()) {
                    @case ('input') {
                      <input aria-label="Name" />
                      <button type="button" tabindex="0">Save</button>
                    }
                    @case ('textarea') {
                      <textarea aria-label="Name"></textarea>
                    }
                    @case ('select') {
                      <select aria-label="Name">
                        <option>a</option>
                      </select>
                    }
                    @case ('contenteditable') {
                      <div contenteditable="true" aria-label="Name">x</div>
                    }
                  }
                } @else if (row.id === 2 && column.id === 'name') {
                  <button type="button">Act</button>
                } @else {
                  {{ column.id }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class CompositeCellHost {
  readonly data = signal<MockRow[]>([...mockRows]);
  readonly table = createGridTable(this.data);
  readonly editor = signal<'input' | 'textarea' | 'select' | 'contenteditable'>('input');
}

describe('NgpTableDirective composite cell modes', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function setupComposite() {
    const grid = TestBed.createComponent(CompositeCellHost);
    const root: HTMLElement = grid.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      grid.detectChanges();
    };
    flush();
    const host = grid.componentInstance;

    const cell = (rowId: number, columnId: 'id' | 'name'): HTMLElement => {
      const colIndex = columnId === 'id' ? '1' : '2';
      const found = root.querySelector<HTMLElement>(
        `[aria-rowindex="${rowId}"] [aria-colindex="${colIndex}"]`,
      );
      if (found === null) throw new Error(`no cell ${rowId}/${columnId}`);
      return found;
    };
    const query = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    const outside = (): HTMLElement => query('#outside');
    const input = (): HTMLElement => query('input');
    const saveButton = (): HTMLElement => query('td button');
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));

    const arrowOntoCell = (): void => {
      cell(1, 'id').focus();
      flush();
      press(cell(1, 'id'), { key: 'ArrowRight' });
      flush();
    };
    const enterCell = (): void => {
      arrowOntoCell();
      press(cell(1, 'name'), { key: 'Enter' });
      flush();
    };

    return {
      host,
      flush,
      cell,
      query,
      outside,
      input,
      saveButton,
      press,
      tabStops,
      arrowOntoCell,
      enterCell,
    };
  }

  it.each(['Enter', 'F2'])('enters a composite cell on %s', (key) => {
    const { host, flush, cell, input, saveButton, press, arrowOntoCell } = setupComposite();
    arrowOntoCell();
    expect(document.activeElement).toBe(cell(1, 'name'));

    const event = press(cell(1, 'name'), { key });
    flush();

    expect(document.activeElement).toBe(input());
    expect(input().hasAttribute('tabindex')).toBe(false);
    expect(saveButton().getAttribute('tabindex')).toBe('0');
    expect(event.defaultPrevented).toBe(true);
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });
  });

  it.each(['Escape', 'F2'])('leaves an entered cell on %s and focuses the cell', (key) => {
    const { flush, cell, input, saveButton, press, tabStops, enterCell } = setupComposite();
    enterCell();

    const event = press(input(), { key });
    flush();

    expect(document.activeElement).toBe(cell(1, 'name'));
    expect(input().getAttribute('tabindex')).toBe('-1');
    expect(saveButton().getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([cell(1, 'name')]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves Enter on a single-widget cell button to the button', () => {
    const { host, flush, cell, press, tabStops } = setupComposite();
    cell(2, 'id').focus();
    flush();
    press(cell(2, 'id'), { key: 'ArrowRight' });
    flush();
    const act = cell(2, 'name').querySelector('button');
    if (act === null) throw new Error('no Act button');
    expect(document.activeElement).toBe(act);

    const event = press(act, { key: 'Enter' });
    flush();

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(act);
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'name' });
    expect(tabStops()).toEqual([act]);
  });

  it('keeps focus in the input when the consumer prevented Escape', () => {
    const { flush, cell, input, saveButton, press, enterCell } = setupComposite();
    enterCell();

    const prevented = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    input().dispatchEvent(prevented);
    flush();

    expect(document.activeElement).toBe(input());
    expect(saveButton().getAttribute('tabindex')).toBe('0');

    press(input(), { key: 'Escape' });
    flush();
    expect(document.activeElement).toBe(cell(1, 'name'));
  });

  it.each(['input', 'textarea', 'select', 'contenteditable'] as const)(
    'never moves the grid on an arrow key typed in a %s',
    (editor) => {
      const { host, flush, cell, query, press, arrowOntoCell } = setupComposite();
      host.editor.set(editor);
      flush();
      arrowOntoCell();
      const before = host.table.focus();
      expect(document.activeElement).toBe(cell(1, 'name'));
      const target = query(editor === 'contenteditable' ? '[contenteditable]' : editor);

      for (const key of ['ArrowDown', 'Home']) {
        const event = press(target, { key });
        flush();

        expect(event.defaultPrevented).toBe(false);
        expect(host.table.focus()).toEqual(before);
        expect(document.activeElement).toBe(cell(1, 'name'));
      }
    },
  );

  it.each(['Enter', 'ArrowDown'])(
    'leaves %s on a widget inside an entered cell to the widget',
    (key) => {
      const { host, flush, saveButton, press, enterCell } = setupComposite();
      enterCell();
      saveButton().focus();
      flush();

      const event = press(saveButton(), { key });
      flush();

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(saveButton());
      expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });
    },
  );

  it('enters a composite cell when focus lands on its widget from a pointer click', () => {
    const { host, flush, cell, input, saveButton, press } = setupComposite();

    input().focus();
    flush();

    expect(saveButton().getAttribute('tabindex')).toBe('0');
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });

    press(input(), { key: 'Escape' });
    flush();
    expect(document.activeElement).toBe(cell(1, 'name'));
  });

  it('returns an entered cell to navigation mode when focus leaves it', () => {
    const { flush, cell, input, saveButton, outside, tabStops, enterCell } = setupComposite();
    enterCell();

    outside().focus();
    flush();

    expect(input().getAttribute('tabindex')).toBe('-1');
    expect(saveButton().getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([cell(1, 'name')]);
  });
});

@Component({
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            @for (column of table.renderColumns(); track column.id; let i = $index) {
              <td [ngpTableCell]="i">
                @if (showInner() && row.id === 2 && column.id === 'name') {
                  <table id="inner" [ngpTable]="inner">
                    <tbody>
                      @for (innerRow of inner.renderRows(); track innerRow.id) {
                        <tr [ngpTableRow]="innerRow">
                          @for (
                            innerColumn of inner.renderColumns();
                            track innerColumn.id;
                            let j = $index
                          ) {
                            <td [ngpTableCell]="j">{{ innerColumn.id }}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  {{ column.id }}
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
class NestedInCellHost {
  readonly data = signal<MockRow[]>([...mockRows]);
  readonly table = createGridTable(this.data);
  readonly inner = createGridTable(signal<MockRow[]>([...mockRows]));
  readonly showInner = signal(true);
}

describe('NgpTableDirective nested grid in a cell', () => {
  type GridColumn = 'id' | 'name';

  afterEach(() => {
    document.body.replaceChildren();
  });

  function setupNested() {
    const fixture = TestBed.createComponent(NestedInCellHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();
    const host = fixture.componentInstance;

    const colIndex = (columnId: GridColumn): string => (columnId === 'id' ? '1' : '2');
    const outerCell = (rowId: number, columnId: GridColumn): HTMLElement => {
      const found = root.querySelector<HTMLElement>(
        `:scope > table > tbody > [aria-rowindex="${rowId}"] > [aria-colindex="${colIndex(columnId)}"]`,
      );
      if (found === null) throw new Error(`no outer cell ${rowId}/${columnId}`);
      return found;
    };
    const innerHost = (): HTMLElement => {
      const found = root.querySelector<HTMLElement>('#inner');
      if (found === null) throw new Error('no inner grid');
      return found;
    };
    const innerCell = (rowId: number, columnId: GridColumn): HTMLElement => {
      const found = innerHost().querySelector<HTMLElement>(
        `[aria-rowindex="${rowId}"] [aria-colindex="${colIndex(columnId)}"]`,
      );
      if (found === null) throw new Error(`no inner cell ${rowId}/${columnId}`);
      return found;
    };
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));
    const innerTabStops = (): HTMLElement[] =>
      Array.from(innerHost().querySelectorAll<HTMLElement>('[tabindex="0"]'));
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      await Promise.resolve();
      flush();
    };

    return {
      host,
      flush,
      outerCell,
      innerHost,
      innerCell,
      press,
      tabStops,
      innerTabStops,
      settle,
    };
  }

  it('treats a nested grid as the widgets of a multi-widget cell', async () => {
    const { flush, settle, outerCell, innerHost, innerCell, press, tabStops, innerTabStops } =
      setupNested();
    await settle();
    outerCell(2, 'id').focus();
    flush();

    press(outerCell(2, 'id'), { key: 'ArrowRight' });
    flush();
    await settle();

    expect(document.activeElement).toBe(outerCell(2, 'name'));
    expect(tabStops()).toEqual([outerCell(2, 'name')]);

    press(outerCell(2, 'name'), { key: 'Enter' });
    flush();
    await settle();

    expect(innerHost().contains(document.activeElement)).toBe(true);
    expect(innerTabStops()).toEqual([innerCell(1, 'id')]);
  });

  it('keeps one tab stop when the nested grid moves its own tab stop while the outer cell is not entered', async () => {
    const { host, flush, settle, outerCell, innerCell, tabStops } = setupNested();
    await settle();

    host.inner.focus.moveTo({ area: 'body', rowId: 2, columnId: 'id' });
    flush();
    await settle();

    expect(tabStops()).toEqual([outerCell(1, 'id')]);
    expect(innerCell(2, 'id').getAttribute('tabindex')).toBe('-1');
  });

  it("restores the nested grid's latest tab stop when the outer cell is entered", async () => {
    const { host, flush, settle, outerCell, innerCell, press, innerTabStops } = setupNested();
    await settle();
    host.inner.focus.moveTo({ area: 'body', rowId: 2, columnId: 'id' });
    flush();
    await settle();

    outerCell(2, 'name').focus();
    flush();
    press(outerCell(2, 'name'), { key: 'Enter' });
    flush();
    await settle();

    expect(innerTabStops()).toEqual([innerCell(2, 'id')]);
    expect(innerCell(1, 'id').getAttribute('tabindex')).toBe('-1');
  });

  it('enters the outer cell when focus lands inside the nested grid', async () => {
    const { host, flush, settle, innerCell, innerTabStops } = setupNested();
    await settle();

    innerCell(2, 'name').focus();
    flush();
    await settle();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'name' });
    expect(document.activeElement).toBe(innerCell(2, 'name'));
    expect(innerTabStops()).toEqual([innerCell(2, 'name')]);
  });

  it('re-marks the nested grid on exit and restores its last tab stop on re-entry', async () => {
    const { host, flush, settle, outerCell, innerCell, press, tabStops, innerTabStops } =
      setupNested();
    await settle();
    outerCell(2, 'name').focus();
    flush();
    press(outerCell(2, 'name'), { key: 'Enter' });
    flush();
    await settle();

    press(innerCell(1, 'id'), { key: 'ArrowDown' });
    flush();
    await settle();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 2, columnId: 'name' });
    expect(innerTabStops()).toEqual([innerCell(2, 'id')]);

    press(innerCell(2, 'id'), { key: 'Escape' });
    flush();
    await settle();

    expect(document.activeElement).toBe(outerCell(2, 'name'));
    expect(tabStops()).toEqual([outerCell(2, 'name')]);

    press(outerCell(2, 'name'), { key: 'Enter' });
    flush();
    await settle();

    expect(innerTabStops()).toEqual([innerCell(2, 'id')]);
  });
});

describe('NgpTableDirective entered cell recovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  function setupEntered() {
    const grid = TestBed.createComponent(CompositeCellHost);
    const root: HTMLElement = grid.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      grid.detectChanges();
    };
    flush();
    const cell = (rowId: number, colIndex: number): HTMLElement => {
      const found = root.querySelector<HTMLElement>(
        `[aria-rowindex="${rowId}"] [aria-colindex="${colIndex}"]`,
      );
      if (found === null) throw new Error(`no cell ${rowId}/${colIndex}`);
      return found;
    };
    const query = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    cell(1, 1).focus();
    flush();
    press(cell(1, 1), { key: 'ArrowRight' });
    flush();
    press(cell(1, 2), { key: 'Enter' });
    flush();
    return { grid, flush, cell, query, press };
  }

  it('navigates again after the focused widget is removed and focus returns to the cell', () => {
    const { grid, flush, cell, query, press } = setupEntered();
    expect(document.activeElement).toBe(query('input'));

    query('input').remove();
    query('td button').remove();
    cell(1, 2).focus();
    flush();
    const event = press(cell(1, 2), { key: 'ArrowDown' });
    flush();

    expect(event.defaultPrevented).toBe(true);
    expect(grid.componentInstance.table.focus()).toEqual({
      area: 'body',
      rowId: 2,
      columnId: 'name',
    });
  });

  it('leaves the entered cell when focus moves from its first widget onto the cell itself', () => {
    const { grid, flush, cell, query, press } = setupEntered();

    cell(1, 2).focus();
    flush();
    const event = press(cell(1, 2), { key: 'ArrowDown' });
    flush();

    expect(event.defaultPrevented).toBe(true);
    expect(grid.componentInstance.table.focus()).toEqual({
      area: 'body',
      rowId: 2,
      columnId: 'name',
    });
    expect(query('input').getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the cell entered when focusout has no related target and the document lost focus', () => {
    const { flush, query } = setupEntered();
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    query('input').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    flush();

    expect(query('td button').getAttribute('tabindex')).toBe('0');
  });

  it('leaves the cell when focusout has no related target and the document has focus', () => {
    const { flush, query } = setupEntered();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    query('input').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    flush();

    expect(query('td button').getAttribute('tabindex')).toBe('-1');
  });
});

const HEADER_IMPORTS = [...IMPORTS, NgpTableHeaderCellDirective];

const HEADER_TEMPLATE = `
  <table [ngpTable]="table">
    <thead>
      <tr>
        @for (column of table.renderColumns(); track column.id; let i = $index) {
          <th [ngpTableHeaderCell]="i">
            {{ column.id }}
            <button type="button">Sort</button>
          </th>
        }
      </tr>
    </thead>
    <tbody>
      @for (row of table.renderRows(); track row.id) {
        <tr [ngpTableRow]="row">
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <td [ngpTableCell]="i">{{ column.id }}</td>
          }
        </tr>
      }
    </tbody>
  </table>
`;

@Component({ imports: HEADER_IMPORTS, template: HEADER_TEMPLATE })
class HeaderGridHost {
  readonly table = createGridTable(signal<MockRow[]>([...mockRows]));
}

@Component({ imports: HEADER_IMPORTS, template: HEADER_TEMPLATE })
class HiddenFirstColumnHeaderHost {
  readonly table = createFlatTable(mockGroupingRows, [
    { id: 'region', visible: false },
    { id: 'category' },
    { id: 'amount' },
  ]);
}

describe('NgpTableDirective header cells', () => {
  function setupHeader<THost extends HeaderGridHost | HiddenFirstColumnHeaderHost>(
    hostType: Type<THost>,
  ) {
    const fixture = TestBed.createComponent(hostType);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();

    const query = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    // 1-based column position, as in `aria-colindex`.
    const headerCell = (colIndex: number): HTMLElement => query(`th[aria-colindex="${colIndex}"]`);
    const headerButton = (colIndex: number): HTMLElement =>
      query(`th[aria-colindex="${colIndex}"] button`);
    const bodyCell = (rowId: number, colIndex: number): HTMLElement =>
      query(`[aria-rowindex="${rowId}"] [aria-colindex="${colIndex}"]`);
    const headerCells = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('th[role="columnheader"]'));
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));

    return {
      host: fixture.componentInstance,
      flush,
      headerCell,
      headerButton,
      headerCells,
      bodyCell,
      tabStops,
    };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps header cells out of the tab order while a body cell of the same column is active', () => {
    const { host, flush, headerCells, bodyCell, tabStops } = setupHeader(HeaderGridHost);

    // Nothing focused: the first-entry default stays the first data row.
    expect(tabStops()).toEqual([bodyCell(1, 1)]);
    expect(headerCells().map((cell) => cell.getAttribute('tabindex'))).toEqual(['-1', '-1']);

    host.table.focus.moveTo({ area: 'body', rowId: 1, columnId: 'name' });
    flush();

    expect(headerCells().map((cell) => cell.getAttribute('tabindex'))).toEqual(['-1', '-1']);
    expect(tabStops()).toEqual([bodyCell(1, 2)]);
  });

  it('moves the single tabindex="0" to the header cell named by focus.moveTo', () => {
    const { host, flush, headerButton, headerCells, tabStops } = setupHeader(HeaderGridHost);

    host.table.focus.moveTo({ area: 'header', columnId: 'name' });
    flush();

    // Note: each header cell holds one Sort button, so the button carries the Tab stop (K34).
    expect(tabStops()).toEqual([headerButton(2)]);
    expect(headerCells().map((cell) => cell.getAttribute('tabindex'))).toEqual(['-1', '-1']);
  });

  it("resolves a header cell's column through renderColumns() when the first declared column is hidden", () => {
    const { host, flush, headerCell, headerButton, tabStops } = setupHeader(
      HiddenFirstColumnHeaderHost,
    );

    host.table.focus.moveTo({ area: 'header', columnId: 'category' });
    flush();

    expect(tabStops()).toEqual([headerButton(1)]);
    expect(headerCell(1).getAttribute('aria-colindex')).toBe('1');
  });

  it.each([
    ['the header cell itself', false],
    ['a button inside the header cell', true],
  ])('writes the focused header cell to the store on focusin (%s)', (_name, isInnerButton) => {
    const { host, flush, headerCell, headerButton, bodyCell, tabStops } =
      setupHeader(HeaderGridHost);
    host.table.focus.moveTo({ area: 'body', rowId: 1, columnId: 'name' });
    flush();
    bodyCell(1, 2).focus();
    flush();
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });

    const target = isInnerButton ? headerButton(2) : headerCell(2);
    target.focus();
    flush();

    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'name' });
    expect(tabStops()).toEqual([headerButton(2)]);
    expect(document.activeElement).toBe(target);
  });
});

const NAV_BODY = `
    <tbody>
      @for (row of table.renderRows(); track row.id) {
        <tr [ngpTableRow]="row">
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <td [ngpTableCell]="i">{{ column.id }}</td>
          }
        </tr>
      }
    </tbody>
`;

const NAV_HEADER_TEMPLATE = `
  <button type="button" id="outside">Outside</button>
  <table [ngpTable]="table">
    <thead>
      <tr>
        @for (column of table.renderColumns(); track column.id; let i = $index) {
          <th [ngpTableHeaderCell]="i">{{ column.id }}</th>
        }
      </tr>
    </thead>${NAV_BODY}
  </table>
`;

const NAV_PAGING_TEMPLATE = `
  <table [ngpTable]="table">${NAV_BODY}
  </table>
`;

@Component({ imports: HEADER_IMPORTS, template: NAV_HEADER_TEMPLATE })
class NavHeaderHost {
  readonly table = createGridTable(signal<MockRow[]>([...mockRows]));
}

@Component({ imports: IMPORTS, template: NAV_PAGING_TEMPLATE })
class NavPagingHost {
  readonly table = createGridTable(signal<MockRow[]>(createMockRows(25)));
}

describe('NgpTableDirective header, paging and RTL keys', () => {
  type NavColumn = 'id' | 'name';

  function setupNav<THost extends NavHeaderHost | NavPagingHost | GridHost>(hostType: Type<THost>) {
    const fixture = TestBed.createComponent(hostType);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();

    const query = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    const colIndexOf = (columnId: NavColumn): string => (columnId === 'id' ? '1' : '2');
    // `position` is the 1-based `aria-rowindex` of the body row.
    const cell = (position: number, columnId: NavColumn): HTMLElement =>
      query(`[aria-rowindex="${position}"] [aria-colindex="${colIndexOf(columnId)}"]`);
    const headerCell = (columnId: NavColumn): HTMLElement =>
      query(`[role="columnheader"][aria-colindex="${colIndexOf(columnId)}"]`);
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      flush();
      return event;
    };
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));

    return { host: fixture.componentInstance, flush, query, cell, headerCell, press, tabStops };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('moves to the first header cell on ArrowUp from the first data row', () => {
    const { host, flush, cell, headerCell, press, tabStops } = setupNav(NavHeaderHost);
    cell(1, 'id').focus();
    flush();

    const event = press(cell(1, 'id'), { key: 'ArrowUp' });

    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'id' });
    expect(document.activeElement).toBe(headerCell('id'));
    expect(tabStops()).toEqual([headerCell('id')]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('moves across header cells with ArrowRight and stops at the last one', () => {
    const { host, flush, cell, headerCell, press } = setupNav(NavHeaderHost);
    cell(1, 'id').focus();
    flush();
    press(cell(1, 'id'), { key: 'ArrowUp' });

    press(headerCell('id'), { key: 'ArrowRight' });
    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'name' });
    expect(document.activeElement).toBe(headerCell('name'));

    const edge = press(headerCell('name'), { key: 'ArrowRight' });
    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'name' });
    expect(document.activeElement).toBe(headerCell('name'));
    expect(edge.defaultPrevented).toBe(true);
  });

  it('returns to the first data row in the same column on ArrowDown from a header cell', () => {
    const { host, flush, cell, headerCell, press } = setupNav(NavHeaderHost);
    cell(1, 'id').focus();
    flush();
    press(cell(1, 'id'), { key: 'ArrowUp' });
    press(headerCell('id'), { key: 'ArrowRight' });

    press(headerCell('name'), { key: 'ArrowDown' });

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });
    expect(document.activeElement).toBe(cell(1, 'name'));
  });

  it('focuses a header cell from outside the grid only on a focusElement request', () => {
    const { host, flush, query, headerCell, tabStops } = setupNav(NavHeaderHost);
    const outside = query('#outside');
    outside.focus();
    flush();

    host.table.focus.moveTo({ area: 'header', columnId: 'name' });
    flush();
    expect(document.activeElement).toBe(outside);
    expect(tabStops()).toEqual([headerCell('name')]);

    host.table.focus.moveTo({ area: 'header', columnId: 'name' }, { focusElement: true });
    flush();
    expect(document.activeElement).toBe(headerCell('name'));
  });

  it('moves PageDown by the fallback step of 10 rows when nothing can be measured', () => {
    const { host, flush, cell, press } = setupNav(NavPagingHost);
    cell(1, 'name').focus();
    flush();

    const event = press(cell(1, 'name'), { key: 'PageDown' });

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 10, columnId: 'name' });
    expect(document.activeElement).toBe(cell(11, 'name'));
    expect(event.defaultPrevented).toBe(true);
  });

  it('reads the host direction at keypress, so ArrowRight follows RTL once the host switches', () => {
    const { host, flush, query, cell, press } = setupNav(NavHeaderHost);
    cell(1, 'id').focus();
    flush();

    press(cell(1, 'id'), { key: 'ArrowRight' });
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });

    query('table').style.direction = 'rtl';
    press(cell(1, 'name'), { key: 'ArrowRight' });
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'id' });

    press(cell(1, 'id'), { key: 'ArrowLeft' });
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'name' });
  });

  it('moves PageDown by the measured number of visible rows', () => {
    const { host, flush, query, cell, press } = setupNav(NavPagingHost);
    const tableHost = query('table');
    tableHost.style.overflowY = 'auto';
    Object.defineProperty(tableHost, 'clientHeight', { configurable: true, value: 200 });
    const focused = cell(1, 'name');
    Object.defineProperty(focused, 'offsetHeight', { configurable: true, value: 40 });
    focused.focus();
    flush();

    press(focused, { key: 'PageDown' });

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 5, columnId: 'name' });
    expect(document.activeElement).toBe(cell(6, 'name'));
  });

  it('stays on the first row on ArrowUp when the table has no header cell', () => {
    const { host, flush, cell, press } = setupNav(GridHost);
    cell(1, 'id').focus();
    flush();

    const event = press(cell(1, 'id'), { key: 'ArrowUp' });

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 1, columnId: 'id' });
    expect(document.activeElement).toBe(cell(1, 'id'));
    expect(event.defaultPrevented).toBe(true);
  });
});

const HEADER_WIDGETS_TEMPLATE = `
  <table [ngpTable]="table">
    <thead>
      <tr>
        @for (column of table.renderColumns(); track column.id; let i = $index) {
          <th [ngpTableHeaderCell]="i">
            @if (column.id === 'id') {
              <input type="text" aria-label="Filter id" />
            } @else {
              <button type="button">Sort name</button>
            }
          </th>
        }
      </tr>
    </thead>
    <tbody>
      @for (row of table.renderRows(); track row.id) {${GRID_ROW}      }
    </tbody>
  </table>
`;

@Component({ imports: HEADER_IMPORTS, template: HEADER_WIDGETS_TEMPLATE })
class HeaderWidgetsHost {
  readonly table = createGridTable(signal<MockRow[]>([...mockRows]));
}

const HEADER_COMPOSITE_TEMPLATE = `
  <table [ngpTable]="table">
    <thead>
      <tr>
        @for (column of table.renderColumns(); track column.id; let i = $index) {
          <th [ngpTableHeaderCell]="i">
            @if (column.id === 'name') {
              <button type="button" id="first-action">First</button>
              <button type="button" id="second-action">Second</button>
            } @else {
              {{ column.id }}
            }
          </th>
        }
      </tr>
    </thead>
    <tbody>
      @for (row of table.renderRows(); track row.id) {${GRID_ROW}      }
    </tbody>
  </table>
`;

@Component({ imports: HEADER_IMPORTS, template: HEADER_COMPOSITE_TEMPLATE })
class HeaderCompositeHost {
  readonly table = createGridTable(signal<MockRow[]>([...mockRows]));
}

describe('NgpTableDirective header widgets', () => {
  type HeaderColumn = 'id' | 'name';

  function setupHeaderWidgets() {
    const fixture = TestBed.createComponent(HeaderWidgetsHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();

    const query = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    const colIndexOf = (columnId: HeaderColumn): string => (columnId === 'id' ? '1' : '2');
    const cell = (position: number, columnId: HeaderColumn): HTMLElement =>
      query(`[aria-rowindex="${position}"] [aria-colindex="${colIndexOf(columnId)}"]`);
    const headerCell = (columnId: HeaderColumn): HTMLElement =>
      query(`[role="columnheader"][aria-colindex="${colIndexOf(columnId)}"]`);
    const filterInput = (): HTMLElement => query('input[aria-label="Filter id"]');
    const sortButton = (): HTMLElement => query('th button');
    const press = (target: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      flush();
      return event;
    };
    const tabStops = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]'));

    return {
      host: fixture.componentInstance,
      flush,
      cell,
      headerCell,
      filterInput,
      sortButton,
      press,
      tabStops,
    };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('focuses the single button of a header cell when arrowing onto it', () => {
    const { host, flush, cell, sortButton, press } = setupHeaderWidgets();
    cell(1, 'name').focus();
    flush();

    const event = press(cell(1, 'name'), { key: 'ArrowUp' });

    expect(document.activeElement).toBe(sortButton());
    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'name' });
    expect(event.defaultPrevented).toBe(true);
  });

  it.each(['Enter', 'F2'])('enters the filter input of a header cell on %s', (key) => {
    const { host, flush, cell, headerCell, filterInput, press } = setupHeaderWidgets();
    cell(1, 'id').focus();
    flush();
    press(cell(1, 'id'), { key: 'ArrowUp' });

    expect(document.activeElement).toBe(headerCell('id'));
    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'id' });

    const event = press(headerCell('id'), { key });

    expect(document.activeElement).toBe(filterInput());
    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'id' });
    expect(event.defaultPrevented).toBe(true);
  });

  it.each(['ArrowDown', 'ArrowLeft'])(
    'leaves %s typed in a header filter input to the caret',
    (key) => {
      const { host, flush, cell, headerCell, filterInput, press } = setupHeaderWidgets();
      cell(1, 'id').focus();
      flush();
      press(cell(1, 'id'), { key: 'ArrowUp' });
      press(headerCell('id'), { key: 'Enter' });

      const event = press(filterInput(), { key });

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(filterInput());
      expect(host.table.focus()).toEqual({ area: 'header', columnId: 'id' });
    },
  );

  it('keeps widgets inside header cells out of the tab order', () => {
    const { flush, cell, filterInput, sortButton, tabStops } = setupHeaderWidgets();
    cell(1, 'id').focus();
    flush();

    expect(filterInput().getAttribute('tabindex')).toBe('-1');
    expect(sortButton().getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([cell(1, 'id')]);
  });

  it('gives the lone widget of the active header cell the roving tab stop', () => {
    const { host, flush, cell, headerCell, sortButton, press, tabStops } = setupHeaderWidgets();
    cell(1, 'name').focus();
    flush();
    press(cell(1, 'name'), { key: 'ArrowUp' });

    expect(host.table.focus()).toEqual({ area: 'header', columnId: 'name' });
    expect(sortButton().getAttribute('tabindex')).toBe('0');
    expect(headerCell('name').getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([sortButton()]);
  });

  it('enters a composite header cell when focus lands on one of its widgets', () => {
    const fixture = TestBed.createComponent(HeaderCompositeHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    TestBed.tick();
    fixture.detectChanges();

    const first = root.querySelector<HTMLElement>('#first-action');
    const second = root.querySelector<HTMLElement>('#second-action');
    if (first === null || second === null) throw new Error('no header widgets');
    expect(first.getAttribute('tabindex')).toBe('-1');

    first.focus();
    TestBed.tick();
    fixture.detectChanges();

    expect(first.getAttribute('tabindex')).not.toBe('-1');
    expect(second.getAttribute('tabindex')).not.toBe('-1');
    expect(fixture.componentInstance.table.focus()).toEqual({ area: 'header', columnId: 'name' });
  });
});

@Component({ imports: HEADER_IMPORTS, template: HEADER_WIDGETS_TEMPLATE })
class HeaderWidgetsEmptyHost {
  readonly data = signal<MockRow[]>([]);
  readonly table = createGridTable(this.data);
}

describe('NgpTableDirective header Tab stop without data rows', () => {
  function setupHeaders<THost extends { table: ReturnType<typeof createGridTable> }>(
    hostType: Type<THost>,
  ) {
    const fixture = TestBed.createComponent(hostType);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();

    const query = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    return {
      fixture,
      host: fixture.componentInstance,
      flush,
      headerCell: (colIndex: 1 | 2): HTMLElement =>
        query(`[role="columnheader"][aria-colindex="${colIndex}"]`),
      firstBodyCell: (): HTMLElement => query('[aria-rowindex="1"] [aria-colindex="1"]'),
      sortButton: (): HTMLElement => query('th button'),
      filterInput: (): HTMLElement => query('input[aria-label="Filter id"]'),
      tabStops: (): HTMLElement[] =>
        Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]')),
      directive: (): NgpTableDirective =>
        fixture.debugElement.query(By.directive(NgpTableDirective)).injector.get(NgpTableDirective),
    };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('falls back to the first rendered column header when the table has no data row', () => {
    const { directive } = setupHeaders(HeaderWidgetsEmptyHost);

    expect(directive().activeTarget()).toEqual({ area: 'header', columnId: 'id' });
  });

  it('leaves exactly one Tab stop on the first header when the table is empty', () => {
    const { headerCell, sortButton, filterInput, tabStops } = setupHeaders(HeaderWidgetsEmptyHost);

    expect(tabStops()).toEqual([headerCell(1)]);
    expect(filterInput().getAttribute('tabindex')).toBe('-1');
    expect(headerCell(2).getAttribute('tabindex')).toBe('-1');
    expect(sortButton().getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the lone Sort button as the Tab stop of an explicitly focused header when the table is empty', () => {
    const { host, flush, headerCell, sortButton, tabStops } = setupHeaders(HeaderWidgetsEmptyHost);
    host.table.focus.moveTo({ area: 'header', columnId: 'name' });
    flush();
    expect(tabStops()).toEqual([sortButton()]);
    expect(headerCell(2).getAttribute('tabindex')).toBe('-1');
  });

  it('lets an explicit focus win over the header fallback when the table is empty', () => {
    const { host, flush, directive, headerCell, tabStops } = setupHeaders(HeaderWidgetsEmptyHost);
    host.table.focus.moveTo({ area: 'header', columnId: 'name' });
    flush();

    expect(directive().activeTarget()).toEqual({ area: 'header', columnId: 'name' });
    expect(headerCell(1).getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toHaveLength(1);
  });

  it('keeps the first body cell as the Tab stop when rows exist and nothing is focused', () => {
    const { directive, firstBodyCell, headerCell, tabStops } = setupHeaders(HeaderWidgetsHost);

    expect(directive().activeTarget()).toEqual({ area: 'body', rowId: 1, columnId: 'id' });
    expect(tabStops()).toEqual([firstBodyCell()]);
    expect(headerCell(1).getAttribute('tabindex')).toBe('-1');
  });

  it('moves the Tab stop from the header to the first body cell once rows arrive', () => {
    const { host, flush, headerCell, firstBodyCell, tabStops } =
      setupHeaders(HeaderWidgetsEmptyHost);
    expect(tabStops()).toEqual([headerCell(1)]);

    host.data.set([...mockRows]);
    flush();

    expect(tabStops()).toEqual([firstBodyCell()]);
    expect(headerCell(1).getAttribute('tabindex')).toBe('-1');
  });
});

@Component({
  imports: [
    NgpTableDirective,
    NgpTableRowDirective,
    NgpTableTreeRowDirective,
    NgpTableCellDirective,
  ],
  template: `
    <div [ngpTable]="table">
      @for (row of table.renderRows(); track row.id) {
        <div [ngpTableRow]="row" ngpTableTreeRow>
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <div [ngpTableCell]="i">{{ row.id }}</div>
          }
        </div>
      }
    </div>
  `,
})
class TreeKeysHost {
  readonly table = createTaskTreeTable();
}

describe('NgpTableDirective treegrid row keys', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('moves DOM focus to the parent row on ArrowLeft from a focused tree row', () => {
    const fixture = TestBed.createComponent(TreeKeysHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();
    fixture.componentInstance.table.tree.expand(['t1', 't1a']);
    flush();
    const rowOf = (id: string): HTMLElement => {
      const found = Array.from(root.querySelectorAll<HTMLElement>('[role="row"]')).find(
        (candidate) => candidate.querySelector('[role="gridcell"]')?.textContent === id,
      );
      if (found === undefined) throw new Error(`no row ${id}`);
      return found;
    };

    rowOf('t1a1').focus();
    flush();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    rowOf('t1a1').dispatchEvent(event);
    flush();

    expect(fixture.componentInstance.table.focus()).toEqual({
      area: 'body',
      rowId: 't1a',
      columnId: null,
    });
    expect(document.activeElement).toBe(rowOf('t1a'));
    expect(event.defaultPrevented).toBe(true);
  });
});

const TREE_IMPORTS = [...IMPORTS, NgpTableTreeRowDirective];

type RowExtra = 'none' | 'toggle' | 'aria-hidden' | 'hidden' | 'disabled';

@Component({
  imports: TREE_IMPORTS,
  template: `
    <button type="button" id="outside">Outside</button>
    <div id="grid" [ngpTable]="table">
      @for (row of table.renderRows(); track row.id) {
        <div [ngpTableRow]="row" ngpTableTreeRow [attr.data-row]="row.id">
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <div [ngpTableCell]="i" [attr.data-col]="column.id">
              @if (column.id === 'id') {
                <button type="button" class="plain">Plain</button>
                <button type="button" class="zero" tabindex="0">Zero</button>
              } @else {
                <input type="checkbox" class="check" aria-label="Done" />
                @if (row.id === 't1') {
                  @switch (extra()) {
                    @case ('toggle') {
                      <button type="button" class="extra" tabindex="-1" aria-hidden="true">
                        T
                      </button>
                    }
                    @case ('aria-hidden') {
                      <button type="button" class="extra" aria-hidden="true">A</button>
                    }
                    @case ('hidden') {
                      <button type="button" class="extra" hidden>H</button>
                    }
                    @case ('disabled') {
                      <button type="button" class="extra" disabled>D</button>
                    }
                  }
                }
                @if (added()) {
                  <button type="button" class="added">Added</button>
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
class TreeRowWidgetsHost {
  readonly extra = signal<RowExtra>('none');
  readonly added = signal(false);
  readonly table = createTaskTreeTable();
}

@Component({
  imports: TREE_IMPORTS,
  template: `
    <div id="grid" [ngpTable]="table">
      @for (row of table.renderRows(); track row.id) {
        <div [ngpTableRow]="row" ngpTableTreeRow [attr.data-row]="row.id">
          @for (column of table.renderColumns(); track column.id; let i = $index) {
            <div [ngpTableCell]="i" [attr.data-col]="column.id">
              @if (row.id === 't2' && column.id === 'id') {
                <button type="button" class="plain">Plain</button>
              } @else if (row.id === 't2' && column.id === 'status') {
                <table id="inner" [ngpTable]="inner">
                  <tbody>
                    @for (innerRow of inner.renderRows(); track innerRow.id) {
                      <tr [ngpTableRow]="innerRow">
                        @for (
                          innerColumn of inner.renderColumns();
                          track innerColumn.id;
                          let j = $index
                        ) {
                          <td [ngpTableCell]="j">{{ innerColumn.id }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                {{ column.id }}
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
class TreeRowNestedHost {
  readonly table = createTaskTreeTable();
  readonly inner = createGridTable(signal<MockRow[]>([...mockRows]));
}

describe('NgpTableDirective treegrid row Tab walk', () => {
  const flushObserver = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve));

  afterEach(() => {
    document.body.replaceChildren();
  });

  async function setupWalk(extra: RowExtra = 'none') {
    const fixture = TestBed.createComponent(TreeRowWidgetsHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const host = fixture.componentInstance;
    host.extra.set(extra);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      await flushObserver();
      flush();
    };
    flush();
    await settle();

    const q = (selector: string): HTMLElement => {
      const found = root.querySelector<HTMLElement>(selector);
      if (found === null) throw new Error(`no element ${selector}`);
      return found;
    };
    const row = (id: string): HTMLElement => q(`[data-row="${id}"]`);
    const cell = (id: string, columnId: string): HTMLElement =>
      q(`[data-row="${id}"] [data-col="${columnId}"]`);
    const within = (id: string, selector: string): HTMLElement =>
      q(`[data-row="${id}"] ${selector}`);
    const widgetsOf = (id: string): HTMLElement[] =>
      Array.from(
        root.querySelectorAll<HTMLElement>(`[data-row="${id}"] button, [data-row="${id}"] input`),
      );
    const tabStops = (): HTMLElement[] =>
      Array.from(q('#grid').querySelectorAll<HTMLElement>('[tabindex="0"]'));
    const toRow = async (id: string): Promise<void> => {
      host.table.focus.moveTo({ area: 'body', rowId: id, columnId: null });
      flush();
      await settle();
    };

    return { host, root, flush, settle, q, row, cell, within, widgetsOf, tabStops, toRow };
  }

  it('restores the widgets of the focused row and keeps its cells out of the tab order', async () => {
    const { toRow, row, cell, within, widgetsOf } = await setupWalk();

    await toRow('t1');

    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);
    expect(within('t1', '.zero').getAttribute('tabindex')).toBe('0');
    expect(within('t1', '.check').hasAttribute('tabindex')).toBe(false);
    expect(cell('t1', 'id').getAttribute('tabindex')).toBe('-1');
    expect(cell('t1', 'status').getAttribute('tabindex')).toBe('-1');
    expect(row('t1').getAttribute('tabindex')).toBe('0');
    for (const widget of widgetsOf('t2')) expect(widget.getAttribute('tabindex')).toBe('-1');
  });

  it.each<[string, RowExtra]>([
    ['tree toggle stand-in', 'toggle'],
    ['aria-hidden', 'aria-hidden'],
    ['hidden', 'hidden'],
    ['disabled', 'disabled'],
  ])('keeps a %s control out of the tab order while its row is focused', async (_name, extra) => {
    const { toRow, within } = await setupWalk(extra);

    await toRow('t1');

    expect(within('t1', '.extra').getAttribute('tabindex')).toBe('-1');
    expect(within('t1', '.check').hasAttribute('tabindex')).toBe(false);
  });

  it('keeps the row active while Tab walks onto its widgets', async () => {
    const { host, toRow, settle, within } = await setupWalk();
    await toRow('t1');

    within('t1', '.plain').focus();
    await settle();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 't1', columnId: null });
    expect(within('t1', '.check').hasAttribute('tabindex')).toBe(false);

    within('t1', '.zero').focus();
    await settle();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 't1', columnId: null });
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);
    expect(within('t1', '.zero').getAttribute('tabindex')).toBe('0');
    expect(within('t1', '.check').hasAttribute('tabindex')).toBe(false);
  });

  it('returns the row widgets to tabindex="-1" when focus moves to a cell', async () => {
    const { host, flush, settle, toRow, within, widgetsOf, tabStops } = await setupWalk();
    await toRow('t1');
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);

    host.table.focus.moveTo({ area: 'body', rowId: 't1', columnId: 'status' });
    flush();
    await settle();

    expect(within('t1', '.plain').getAttribute('tabindex')).toBe('-1');
    expect(within('t1', '.zero').getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([within('t1', '.check')]);
    for (const widget of widgetsOf('t2')) expect(widget.getAttribute('tabindex')).toBe('-1');
  });

  it('switches the restored widgets to the newly focused row', async () => {
    const { toRow, within, widgetsOf, row } = await setupWalk();
    await toRow('t1');
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);

    await toRow('t2');

    for (const widget of widgetsOf('t1')) expect(widget.getAttribute('tabindex')).toBe('-1');
    expect(within('t2', '.plain').hasAttribute('tabindex')).toBe(false);
    expect(within('t2', '.zero').getAttribute('tabindex')).toBe('0');
    expect(within('t2', '.check').hasAttribute('tabindex')).toBe(false);
    expect(row('t2').getAttribute('tabindex')).toBe('0');
    expect(row('t1').getAttribute('tabindex')).toBe('-1');
  });

  it('puts the row widgets back to tabindex="-1" when focus leaves the grid', async () => {
    const { host, q, settle, toRow, within, widgetsOf, tabStops, row } = await setupWalk();
    await toRow('t1');
    within('t1', '.plain').focus();
    await settle();
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);

    const outside = q('#outside');
    outside.focus();
    within('t1', '.plain').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }),
    );
    await settle();

    for (const widget of widgetsOf('t1')) expect(widget.getAttribute('tabindex')).toBe('-1');
    expect(tabStops()).toEqual([row('t1')]);
    expect(host.table.focus()).toEqual({ area: 'body', rowId: 't1', columnId: null });
  });

  it('restores the row widgets when focus returns to the same row after leaving the grid', async () => {
    const { host, q, settle, toRow, row, within, widgetsOf } = await setupWalk();
    await toRow('t1');
    row('t1').focus();
    await settle();
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);

    const outside = q('#outside');
    outside.focus();
    row('t1').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    await settle();
    for (const widget of widgetsOf('t1')) expect(widget.getAttribute('tabindex')).toBe('-1');

    row('t1').focus();
    await settle();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 't1', columnId: null });
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);
    expect(within('t1', '.zero').getAttribute('tabindex')).toBe('0');
    expect(within('t1', '.check').hasAttribute('tabindex')).toBe(false);
  });

  it('does not enter a leaf row with several widgets on Enter or F2', async () => {
    const { toRow, row, settle, within } = await setupWalk();
    await toRow('t2');
    row('t2').focus();
    await settle();

    for (const key of ['Enter', 'F2']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      row('t2').dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(false);
      expect(within('t2', '.plain').hasAttribute('tabindex')).toBe(false);
      expect(within('t2', '.zero').getAttribute('tabindex')).toBe('0');
    }
  });

  it('keeps the row widgets restored after the host observer runs', async () => {
    const { toRow, settle, within } = await setupWalk();
    await toRow('t1');
    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);

    await flushObserver();
    await settle();

    expect(within('t1', '.plain').hasAttribute('tabindex')).toBe(false);
    expect(within('t1', '.zero').getAttribute('tabindex')).toBe('0');
    expect(within('t1', '.check').hasAttribute('tabindex')).toBe(false);
  });

  it('leaves a control added to the focused row in the tab order', async () => {
    const { host, toRow, settle, flush, within } = await setupWalk();
    await toRow('t1');

    host.added.set(true);
    flush();
    await settle();

    expect(within('t1', '.added').hasAttribute('tabindex')).toBe(false);
    expect(within('t2', '.added').getAttribute('tabindex')).toBe('-1');
  });

  it("keeps a nested grid's roving tabindex at -1 while the row is in row mode", async () => {
    const fixture = TestBed.createComponent(TreeRowNestedHost);
    const root: HTMLElement = fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      fixture.detectChanges();
    };
    flush();
    await fixture.whenStable();
    await flushObserver();
    flush();

    fixture.componentInstance.table.focus.moveTo({ area: 'body', rowId: 't2', columnId: null });
    flush();
    await fixture.whenStable();
    await flushObserver();
    flush();

    const button = root.querySelector<HTMLElement>('[data-row="t2"] .plain');
    const innerActive = root.querySelector<HTMLElement>(
      '#inner [aria-rowindex="1"] [aria-colindex="1"]',
    );
    if (button === null || innerActive === null) throw new Error('fixture not rendered');
    expect(button.hasAttribute('tabindex')).toBe(false);
    expect(innerActive.getAttribute('tabindex')).toBe('-1');
  });
});
