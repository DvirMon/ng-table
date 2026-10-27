import { Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTableCellDirective } from './ngp-table-cell.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withGrouping } from '../api/features/with-grouping/feature';
import { mockGroupingRows, mockGroupingTrackBy, noData, type GroupingMockRow } from '../table.mock';

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

  it.each([
    ['no data rows', EmptyHost],
    ['every column hidden', AllHiddenHost],
  ] as const)('reports a null activeTarget when the table has %s', (_name, hostType) => {
    const { directive } = setup<EmptyHost | AllHiddenHost>(hostType);

    expect(directive().activeTarget()).toBeNull();
  });
});
