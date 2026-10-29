import { Component, computed, signal, type Type, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgpTableDirective } from './ngp-table.directive';
import { NGP_TABLE_STORE } from './table.tokens';
import { NgpTableCellDirective } from './ngp-table-cell.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withGrouping } from '../api/features/with-grouping/feature';
import {
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

  it.each([
    ['no data rows', EmptyHost],
    ['every column hidden', AllHiddenHost],
  ] as const)('reports a null activeTarget when the table has %s', (_name, hostType) => {
    const { directive } = setup<EmptyHost | AllHiddenHost>(hostType);

    expect(directive().activeTarget()).toBeNull();
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
    expect(tabStops()).toEqual([cell(2, 'name')]);
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
    expect(document.activeElement).toBe(cell(2, 'name'));

    outside().focus();
    host.table.focus.moveTo({ area: 'body', rowId: 1, columnId: 'id' });
    flush();
    expect(document.activeElement).toBe(outside());
  });
});
