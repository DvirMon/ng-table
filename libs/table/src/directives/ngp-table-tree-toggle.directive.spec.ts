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
  return {
    fixture,
    toggle,
    clickToggle,
    visibleRowIds,
    rowClicks: fixture.componentInstance.rowClicks,
  };
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

@Component({
  imports: CHECK_IMPORTS,
  template: checksTemplate('<button ngpTableTreeToggle></button>'),
})
class NoTreeHost {
  protected readonly table = createCheckTable(CHECK_ROWS, false);
}

@Component({
  imports: CHECK_IMPORTS,
  template: checksTemplate(
    '<button ngpTableTreeToggle aria-label="Toggle row" type="submit"></button>',
  ),
})
class SubmitTypeHost {
  protected readonly table = createCheckTable(CHECK_ROWS, true);
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
  it('opens a collapsed parent on click: the child row renders and data-expanded is set', () => {
    const { toggle, clickToggle, visibleRowIds } = setup(TreeHost);
    expect(visibleRowIds()).toEqual(['t1', 't2']);

    clickToggle('t1');

    expect(visibleRowIds()).toEqual(['t1', 't1a', 't2']);
    expect(toggle('t1').getAttribute('data-expanded')).toBe('');
  });

  it('closes an open parent on a second click: the child row is removed and data-expanded is gone', () => {
    const { toggle, clickToggle, visibleRowIds } = setup(TreeHost);

    clickToggle('t1');
    clickToggle('t1');

    expect(visibleRowIds()).toEqual(['t1', 't2']);
    expect(toggle('t1').hasAttribute('data-expanded')).toBe(false);
  });

  it('renders the toggle as type="button" when the template sets no type', () => {
    const { toggle } = setup(TreeHost);

    expect(toggle('t1').getAttribute('type')).toBe('button');
    expect(toggle('t2').getAttribute('type')).toBe('button');
  });

  it('forces type="button" even when the template sets type="submit"', () => {
    const fixture = renderChecks(SubmitTypeHost);
    const buttons: HTMLButtonElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );

    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button.getAttribute('type')).toBe('button');
  });

  it('disables the toggle on a row without children', () => {
    const { toggle } = setup(TreeHost);
    const leaf = toggle('t2');
    const parent = toggle('t1');

    expect(leaf.disabled).toBe(true);
    expect(leaf.getAttribute('data-disabled')).toBe('');
    expect(leaf.hasAttribute('data-expanded')).toBe(false);

    expect(parent.disabled).toBe(false);
    expect(parent.hasAttribute('data-disabled')).toBe(false);
  });

  it('opens and collapses a group header under withGrouping() + withTree()', () => {
    const { clickToggle, visibleRowIds } = setup(GroupedHost);
    const memberIds = ['1', '2', '3'];
    expect(visibleRowIds()).toHaveLength(2);
    expect(visibleRowIds()).not.toEqual(expect.arrayContaining(memberIds));

    clickToggle(US_HEADER_ID);

    expect(visibleRowIds()).toEqual(expect.arrayContaining(memberIds));

    clickToggle(US_HEADER_ID);

    for (const id of memberIds) expect(visibleRowIds()).not.toContain(id);
  });

  it('leaves exactly one tabindex="0" in the grid after toggling a group header', () => {
    const { fixture, clickToggle } = setup(GroupedHost);

    clickToggle(US_HEADER_ID);

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('lets the click bubble to the row without preventing default', () => {
    const { clickToggle, rowClicks } = setup(TreeHost);

    clickToggle('t1');

    expect(rowClicks).toHaveLength(1);
    expect(rowClicks[0].defaultPrevented).toBe(false);
  });
});

describe('NgpTableTreeToggleDirective pointer-only contract', () => {
  function setupAttached() {
    const base = setup(TreeHost);
    const root: HTMLElement = base.fixture.nativeElement;
    document.body.appendChild(root);
    const flush = (): void => {
      TestBed.tick();
      base.fixture.detectChanges();
    };
    flush();
    const row = (id: string): HTMLElement => {
      const found = Array.from(root.querySelectorAll<HTMLElement>('[role="row"]')).find(
        (candidate) => candidate.textContent!.trim() === id,
      );
      if (found === undefined) throw new Error(`no row ${id}`);
      return found;
    };
    return { ...base, flush, row };
  }

  it('binds no aria-expanded on the tree toggle, collapsed, open or leaf, while data-expanded follows the row', () => {
    const { toggle, clickToggle } = setup(TreeHost);

    expect(toggle('t1').hasAttribute('aria-expanded')).toBe(false);
    expect(toggle('t2').hasAttribute('aria-expanded')).toBe(false);

    clickToggle('t1');

    expect(toggle('t1').hasAttribute('aria-expanded')).toBe(false);
    expect(toggle('t1').getAttribute('data-expanded')).toBe('');
  });

  it('binds tabindex="-1" and aria-hidden="true" on parent and leaf toggles, and keeps the leaf disabled', () => {
    const { toggle } = setup(TreeHost);
    const parent = toggle('t1');
    const leaf = toggle('t2');

    for (const button of [parent, leaf]) {
      expect(button.getAttribute('tabindex')).toBe('-1');
      expect(button.getAttribute('aria-hidden')).toBe('true');
    }
    expect(leaf.disabled).toBe(true);
    expect(leaf.getAttribute('data-disabled')).toBe('');
    expect(parent.disabled).toBe(false);
  });

  it('moves focus to its row when the toggle is clicked, even with focus outside the grid', () => {
    const { toggle, flush, row, visibleRowIds } = setupAttached();
    expect(document.activeElement).toBe(document.body);

    toggle('t1').click();
    flush();

    expect(visibleRowIds()).toContain('t1a');
    expect(document.activeElement).toBe(row('t1'));
  });
});
