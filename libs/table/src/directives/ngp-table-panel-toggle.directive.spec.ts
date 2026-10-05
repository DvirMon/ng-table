import { Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTablePanelDirective } from './ngp-table-panel.directive';
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
const PANEL_IMPORTS = [...IMPORTS, NgpTablePanelDirective];

function panelTableTemplate(panelGate: string, track = 'row.id'): string {
  return `
  <table [ngpTable]="table">
    <tbody>
      @for (row of table.renderRows(); track ${track}) {
        <tr [ngpTableRow]="row">
          <td><button ngpTablePanelToggle [attr.aria-label]="'Toggle ' + row.id"></button></td>
        </tr>
        @if (${panelGate}) {
          <tr><td><div [ngpTablePanel]="row.id" role="region" [attr.aria-label]="'Details ' + row.id"></div></td></tr>
        }
      }
    </tbody>
  </table>
`;
}

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

@Component({
  selector: 'ngp-default-panel-host',
  imports: PANEL_IMPORTS,
  template: panelTableTemplate('table.expansion().has(row.id)'),
})
class DefaultPanelHost {
  readonly table = createExpandableTable();
}

@Component({
  selector: 'ngp-kept-mounted-panel-host',
  imports: PANEL_IMPORTS,
  template: panelTableTemplate('table.expansion.everExpanded().has(row.id)'),
})
class KeptMountedHost {
  readonly table = createExpandableTable();
}

@Component({
  selector: 'ngp-reused-view-panel-host',
  imports: PANEL_IMPORTS,
  template: panelTableTemplate('table.expansion().has(row.id)', '$index'),
})
class ReusedViewHost {
  readonly data = signal<TaskTreeMockRow[]>([mockTaskTreeRows[0], mockTaskTreeRows[1]]);
  readonly table = createTable(
    this.data,
    createToggleConfig(),
    withExpansion({ initial: ['t1'] }),
  );
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

describe('NgpTablePanelToggleDirective aria-controls', () => {
  function setupPanels<T extends DefaultPanelHost | KeptMountedHost | ReusedViewHost>(
    hostType: Type<T>,
  ) {
    const fixture = TestBed.createComponent(hostType);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const find = (label: string): HTMLElement => {
      const el = root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
      if (el === null) throw new Error(`no element labelled ${label}`);
      return el;
    };
    return {
      fixture,
      host: fixture.componentInstance,
      toggle: (id: string): HTMLElement => find(`Toggle ${id}`),
      panel: (id: string): HTMLElement => find(`Details ${id}`),
    };
  }

  it('points aria-controls at its row panel id once the panel mounts', () => {
    const { fixture, host, toggle, panel } = setupPanels(DefaultPanelHost);

    host.table.expansion.expand(['t1']);
    fixture.detectChanges();

    const controls = toggle('t1').getAttribute('aria-controls');
    expect(controls).not.toBeNull();
    expect(controls).not.toBe('');
    expect(controls).toBe(panel('t1').id);
  });

  it('removes aria-controls when its row panel unmounts', () => {
    const { fixture, host, toggle } = setupPanels(DefaultPanelHost);
    host.table.expansion.expand(['t1']);
    fixture.detectChanges();
    expect(toggle('t1').hasAttribute('aria-controls')).toBe(true);

    host.table.expansion.collapse(['t1']);
    fixture.detectChanges();

    expect(toggle('t1').hasAttribute('aria-controls')).toBe(false);
  });

  it('leaves aria-controls off a toggle whose own row has no panel while another row does', () => {
    const { fixture, host, toggle, panel } = setupPanels(DefaultPanelHost);

    host.table.expansion.expand(['t1']);
    fixture.detectChanges();

    expect(toggle('t1').getAttribute('aria-controls')).toBe(panel('t1').id);
    expect(toggle('t1').hasAttribute('aria-controls')).toBe(true);
    expect(toggle('t2').hasAttribute('aria-controls')).toBe(false);
  });

  it('keeps aria-controls while a closed panel stays mounted', () => {
    const { fixture, host, toggle, panel } = setupPanels(KeptMountedHost);
    host.table.expansion.expand(['t1']);
    fixture.detectChanges();

    host.table.expansion.collapse(['t1']);
    fixture.detectChanges();

    expect(panel('t1').isConnected).toBe(true);
    expect(toggle('t1').hasAttribute('aria-controls')).toBe(true);
    expect(toggle('t1').getAttribute('aria-controls')).toBe(panel('t1').id);
  });

  it('follows its row id when a reused view is moved to another row', () => {
    const { fixture, host, toggle, panel } = setupPanels(ReusedViewHost);
    expect(toggle('t1').getAttribute('aria-controls')).toBe(panel('t1').id);

    host.data.set([mockTaskTreeRows[1], mockTaskTreeRows[0]]);
    fixture.detectChanges();

    expect(toggle('t1').hasAttribute('aria-controls')).toBe(true);
    expect(toggle('t1').getAttribute('aria-controls')).toBe(panel('t1').id);
    expect(toggle('t2').hasAttribute('aria-controls')).toBe(false);
  });
});
