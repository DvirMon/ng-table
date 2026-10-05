import { Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTablePanelToggleDirective } from './ngp-table-panel-toggle.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withExpansion } from '../api/features/with-expansion';
import { mockTaskTreeRows, noData, type TaskTreeMockRow } from '../table.mock';

const TOGGLE_TABLE_TEMPLATE = `
  <table [ngpTable]="table">
    <tbody>
      @for (row of table.renderRows(); track row.id) {
        <tr [ngpTableRow]="row">
          <td><button ngpTablePanelToggle [attr.aria-label]="'Toggle ' + row.id"></button></td>
        </tr>
      }
    </tbody>
  </table>
`;

const IMPORTS = [NgpTableDirective, NgpTableRowDirective, NgpTablePanelToggleDirective];

function createToggleConfig() {
  return {
    trackBy: 'id' as const,
    columns: createColumns(noData<TaskTreeMockRow>(), (col) => [col('status')]),
  };
}

function createExpandableTable() {
  return createTable(
    signal<TaskTreeMockRow[]>(mockTaskTreeRows),
    createToggleConfig(),
    withExpansion(),
  );
}

@Component({
  selector: 'ngp-expansion-host',
  imports: IMPORTS,
  template: TOGGLE_TABLE_TEMPLATE,
})
class ExpansionHost {
  readonly table = createExpandableTable();
}

@Component({
  selector: 'ngp-no-expansion-host',
  imports: IMPORTS,
  template: TOGGLE_TABLE_TEMPLATE,
})
class NoExpansionHost {
  readonly table = createTable(signal<TaskTreeMockRow[]>(mockTaskTreeRows), createToggleConfig());
}

interface Setup {
  fixture: ComponentFixture<ExpansionHost>;
  host: ExpansionHost;
  toggle: (id: string) => HTMLButtonElement;
  clickToggle: (id: string) => void;
}

function setup(hostType: Type<ExpansionHost>): Setup {
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
  return { fixture, host: fixture.componentInstance, toggle, clickToggle };
}

describe('NgpTablePanelToggleDirective dev checks', () => {
  it('throws on first render when the table has no withExpansion()', () => {
    const render = (): unknown => {
      const fixture = TestBed.createComponent(NoExpansionHost);
      fixture.detectChanges();
      return fixture;
    };

    expect(render).toThrow(/ngpTablePanelToggle[\s\S]*withExpansion\(\)/);
  });
});

describe('NgpTablePanelToggleDirective', () => {
  it('opens its row on click: the store holds the row id', () => {
    const { host, toggle, clickToggle } = setup(ExpansionHost);
    expect(toggle('t1').getAttribute('aria-expanded')).toBe('false');
    expect(toggle('t1').hasAttribute('data-expanded')).toBe(false);

    clickToggle('t1');

    expect(host.table.expansion().has('t1')).toBe(true);
  });

  it('closes its row on a second click: the store drops the row id, aria-expanded is "false" and data-expanded is gone', () => {
    const { host, toggle, clickToggle } = setup(ExpansionHost);

    clickToggle('t1');
    clickToggle('t1');

    expect(host.table.expansion().has('t1')).toBe(false);
    expect(toggle('t1').getAttribute('aria-expanded')).toBe('false');
    expect(toggle('t1').hasAttribute('data-expanded')).toBe(false);
  });

  it("opens only its own row: another row's toggle stays closed", () => {
    const { host, toggle, clickToggle } = setup(ExpansionHost);

    clickToggle('t1');

    expect(host.table.expansion().has('t2')).toBe(false);
    expect(toggle('t2').getAttribute('aria-expanded')).toBe('false');
    expect(toggle('t2').hasAttribute('data-expanded')).toBe(false);
  });

  it('reflects the store when the row is opened by something other than the toggle', () => {
    const { fixture, host, toggle } = setup(ExpansionHost);

    host.table.expansion.expand(['t1']);
    fixture.detectChanges();

    expect(toggle('t1').getAttribute('aria-expanded')).toBe('true');
    expect(toggle('t1').getAttribute('data-expanded')).toBe('');
  });
});
