import { Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { NgpTableTreeToggleDirective } from './ngp-table-tree-toggle.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withGrouping } from '../api/features/with-grouping/feature';
import { withTree } from '../api/features/with-tree/feature';
import {
  mockGroupingRows,
  mockGroupingTrackBy,
  mockTaskTreeRows,
  noData,
  type GroupingMockRow,
  type TaskTreeMockRow,
} from '../table.mock';

const US_HEADER_ID = 'group:>region:string:US';

const TOGGLE_TABLE_TEMPLATE = `
  <table [ngpTable]="table">
    <tbody>
      @for (row of table.renderRows(); track row.id) {
        <tr [ngpTableRow]="row" (click)="rowClicks.push($event)">
          <td><button ngpTableTreeToggle [attr.aria-label]="'Toggle ' + row.id"></button></td>
          <td>{{ row.id }}</td>
        </tr>
      }
    </tbody>
  </table>
`;

@Component({
  imports: [NgpTableDirective, NgpTableRowDirective, NgpTableTreeToggleDirective],
  template: TOGGLE_TABLE_TEMPLATE,
})
class TreeHost {
  readonly rowClicks: MouseEvent[] = [];
  protected readonly table = createTable(
    signal<TaskTreeMockRow[]>(mockTaskTreeRows),
    {
      trackBy: 'id',
      columns: createColumns(noData<TaskTreeMockRow>(), (col) => [col('status')]),
    },
    withTree({ parentId: (row) => row.parentId }),
  );
}

@Component({
  imports: [NgpTableDirective, NgpTableRowDirective, NgpTableTreeToggleDirective],
  template: TOGGLE_TABLE_TEMPLATE,
})
class GroupedHost {
  readonly rowClicks: MouseEvent[] = [];
  protected readonly table = createTable(
    signal<GroupingMockRow[]>(mockGroupingRows),
    {
      trackBy: mockGroupingTrackBy,
      columns: createColumns(noData<GroupingMockRow>(), (col) => [col('region')]),
    },
    withGrouping({ initial: ['region'] }),
    withTree(),
  );
}

interface Host {
  readonly rowClicks: MouseEvent[];
}

interface Setup {
  fixture: ComponentFixture<Host>;
  toggle: (id: string) => HTMLButtonElement;
  clickToggle: (id: string) => void;
  visibleRowIds: () => string[];
  rowClicks: MouseEvent[];
}

function setup(hostType: Type<Host>): Setup {
  const fixture = TestBed.createComponent(hostType);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const toggle = (id: string): HTMLButtonElement => {
    const button = root.querySelector<HTMLButtonElement>(`button[aria-label="Toggle ${id}"]`);
    if (button === null) throw new Error(`no toggle for row ${id}`);
    return button;
  };
  const clickToggle = (id: string): void => {
    toggle(id).click();
    fixture.detectChanges();
  };
  const visibleRowIds = (): string[] =>
    Array.from(root.querySelectorAll('[role="row"]')).map((row) => row.textContent!.trim());
  return { fixture, toggle, clickToggle, visibleRowIds, rowClicks: fixture.componentInstance.rowClicks };
}

const CHECK_ROWS: TaskTreeMockRow[] = [
  { id: 'p1', status: 'open', parentId: null },
  { id: 'p2', status: 'open', parentId: null },
  { id: 'c1', status: 'open', parentId: 'p1' },
  { id: 'c2', status: 'open', parentId: 'p2' },
];

function checksTemplate(button: string): string {
  return `
  <table [ngpTable]="table">
    <tbody>
      @for (row of table.renderRows(); track row.id) {
        <tr [ngpTableRow]="row"><td>${button}</td></tr>
      }
    </tbody>
  </table>
`;
}

function createCheckTable(rows: TaskTreeMockRow[], tree: boolean) {
  const data = signal<TaskTreeMockRow[]>(rows);
  const config = {
    trackBy: 'id' as const,
    columns: createColumns(noData<TaskTreeMockRow>(), (col) => [col('status')]),
  };
  return tree
    ? createTable(data, config, withTree({ parentId: (row) => row.parentId }))
    : createTable(data, config);
}

const CHECK_IMPORTS = [NgpTableDirective, NgpTableRowDirective, NgpTableTreeToggleDirective];

@Component({ imports: CHECK_IMPORTS, template: checksTemplate('<button ngpTableTreeToggle></button>') })
class NoTreeHost {
  protected readonly table = createCheckTable(CHECK_ROWS, false);
}

function renderChecks(hostType: Type<unknown>): ComponentFixture<unknown> {
  const fixture = TestBed.createComponent(hostType);
  fixture.detectChanges();
  return fixture;
}

describe('NgpTableTreeToggleDirective dev checks', () => {
  it('throws on first render when the table has no withTree()', () => {
    expect(() => renderChecks(NoTreeHost)).toThrow(/ngpTableTreeToggle[\s\S]*withTree\(\)/);
  });
});

describe('NgpTableTreeToggleDirective', () => {
  it('opens a collapsed parent on click: the child row renders and aria-expanded becomes "true"', () => {
    const { toggle, clickToggle, visibleRowIds } = setup(TreeHost);
    expect(visibleRowIds()).toEqual(['t1', 't2']);

    clickToggle('t1');

    expect(visibleRowIds()).toEqual(['t1', 't1a', 't2']);
    expect(toggle('t1').getAttribute('aria-expanded')).toBe('true');
    expect(toggle('t1').getAttribute('data-expanded')).toBe('');
  });

  it('closes an open parent on a second click: the child row is removed, aria-expanded is "false" and data-expanded is gone', () => {
    const { toggle, clickToggle, visibleRowIds } = setup(TreeHost);

    clickToggle('t1');
    clickToggle('t1');

    expect(visibleRowIds()).toEqual(['t1', 't2']);
    expect(toggle('t1').getAttribute('aria-expanded')).toBe('false');
    expect(toggle('t1').hasAttribute('data-expanded')).toBe(false);
  });

  it('disables and hides the toggle on a row without children, with no aria-expanded', () => {
    const { toggle } = setup(TreeHost);
    const leaf = toggle('t2');
    const parent = toggle('t1');

    expect(leaf.disabled).toBe(true);
    expect(leaf.getAttribute('aria-hidden')).toBe('true');
    expect(leaf.getAttribute('data-disabled')).toBe('');
    expect(leaf.hasAttribute('aria-expanded')).toBe(false);
    expect(leaf.hasAttribute('data-expanded')).toBe(false);

    expect(parent.disabled).toBe(false);
    expect(parent.hasAttribute('aria-hidden')).toBe(false);
    expect(parent.hasAttribute('data-disabled')).toBe(false);
  });

  it('opens and collapses a group header under withGrouping() + withTree()', () => {
    const { toggle, clickToggle, visibleRowIds } = setup(GroupedHost);
    const memberIds = ['1', '2', '3'];
    expect(visibleRowIds()).toHaveLength(2);
    expect(visibleRowIds()).not.toEqual(expect.arrayContaining(memberIds));

    clickToggle(US_HEADER_ID);

    expect(visibleRowIds()).toEqual(expect.arrayContaining(memberIds));
    expect(toggle(US_HEADER_ID).getAttribute('aria-expanded')).toBe('true');

    clickToggle(US_HEADER_ID);

    for (const id of memberIds) expect(visibleRowIds()).not.toContain(id);
    expect(toggle(US_HEADER_ID).getAttribute('aria-expanded')).toBe('false');
  });

  it('lets the click bubble to the row without preventing default', () => {
    const { clickToggle, rowClicks } = setup(TreeHost);

    clickToggle('t1');

    expect(rowClicks).toHaveLength(1);
    expect(rowClicks[0].defaultPrevented).toBe(false);
  });
});
