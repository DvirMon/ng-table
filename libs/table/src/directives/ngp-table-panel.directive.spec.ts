import { Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTablePanelDirective } from './ngp-table-panel.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withExpansion } from '../api/features/with-expansion';
import {
  mockSpacedIdRow,
  mockTaskTreeRows,
  noData,
  type TaskTreeMockRow,
} from '../table.mock';

const ROWS: TaskTreeMockRow[] = [...mockTaskTreeRows, mockSpacedIdRow];

function createPanelConfig() {
  return {
    trackBy: 'id' as const,
    columns: createColumns(noData<TaskTreeMockRow>(), (col) => [col('status')]),
  };
}

function createExpandableTable() {
  return createTable(signal<TaskTreeMockRow[]>(ROWS), createPanelConfig(), withExpansion());
}

function createPlainTable() {
  return createTable(signal<TaskTreeMockRow[]>(ROWS), createPanelConfig());
}

const PANEL =
  '<div [ngpTablePanel]="row.id" role="region" [attr.aria-label]="\'Details \' + row.id"></div>';
const IMPORTS = [NgpTableDirective, NgpTablePanelDirective];

@Component({
  selector: 'ngp-default-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.rows(); track row.id) {
          @if (table.expansion().has(row.id)) {
            <tr><td>${PANEL}</td></tr>
          }
        }
      </tbody>
    </table>
  `,
})
class DefaultHost {
  readonly table = createExpandableTable();
}

@Component({
  selector: 'ngp-kept-mounted-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.rows(); track row.id) {
          @if (table.expansion.everExpanded().has(row.id)) {
            <tr><td>${PANEL}</td></tr>
          }
        }
      </tbody>
    </table>
  `,
})
class KeptMountedHost {
  readonly table = createExpandableTable();
}

@Component({
  selector: 'ngp-no-expansion-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.rows(); track row.id) {
          <tr><td>${PANEL}</td></tr>
        }
      </tbody>
    </table>
  `,
})
class NoExpansionHost {
  readonly table = createPlainTable();
}

@Component({
  selector: 'ngp-duplicate-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.rows(); track row.id) {
          <tr><td>${PANEL}${PANEL}</td></tr>
        }
      </tbody>
    </table>
  `,
})
class DuplicatePanelHost {
  readonly table = createExpandableTable();
}

interface ExpansionHost {
  readonly table: {
    readonly expansion: {
      expand(ids?: readonly string[]): void;
      collapse(ids?: readonly string[]): void;
    };
  };
}

function hasExpansionWriter(host: unknown): host is ExpansionHost {
  if (typeof host !== 'object' || host === null || !('table' in host)) return false;
  const table = host.table;
  if (typeof table !== 'object' || table === null || !('expansion' in table)) return false;
  return typeof table.expansion === 'function' && 'expand' in table.expansion;
}

interface Setup {
  fixture: ComponentFixture<unknown>;
  panel: (id: string) => HTMLElement;
  expand: (id: string) => void;
  collapse: (id: string) => void;
}

function setup(hostType: Type<unknown>): Setup {
  const fixture = TestBed.createComponent(hostType);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  const panel = (id: string): HTMLElement => {
    const el = root.querySelector<HTMLElement>(`[aria-label="Details ${id}"]`);
    if (el === null) throw new Error(`no panel for row ${id}`);
    return el;
  };
  const writer = (): ExpansionHost['table']['expansion'] => {
    const host = fixture.componentInstance;
    if (!hasExpansionWriter(host)) throw new Error('host has no withExpansion()');
    return host.table.expansion;
  };
  const expand = (id: string): void => {
    writer().expand([id]);
    fixture.detectChanges();
  };
  const collapse = (id: string): void => {
    writer().collapse([id]);
    fixture.detectChanges();
  };
  return { fixture, panel, expand, collapse };
}

describe('NgpTablePanelDirective', () => {
  it('gives the panel a table-scoped id that stays the same across close and reopen', () => {
    const { panel, expand, collapse } = setup(DefaultHost);

    expand('t1');
    const firstId = panel('t1').id;
    expect(firstId).toMatch(/^ngp-t\d+-panel-t1$/);

    collapse('t1');
    expect(() => expand('t1')).not.toThrow();
    expect(panel('t1').id).toBe(firstId);

    expand(mockSpacedIdRow.id);
    const spacedId = panel(mockSpacedIdRow.id).id;
    expect(spacedId).not.toMatch(/\s/);
    expect(spacedId.endsWith(encodeURIComponent(mockSpacedIdRow.id))).toBe(true);
  });

  it('marks a kept-mounted panel inert while its row is closed, and not while it is open', () => {
    const { panel, expand, collapse } = setup(KeptMountedHost);

    expand('t1');
    const el = panel('t1');
    expect(el.hasAttribute('inert')).toBe(false);

    collapse('t1');
    expect(el.isConnected).toBe(true);
    expect(el.hasAttribute('inert')).toBe(true);
  });

  it('throws on first render when the table has no withExpansion()', () => {
    expect(() => setup(NoExpansionHost)).toThrow(/ngpTablePanel[\s\S]*withExpansion\(\)/);
  });

  it('throws when a second panel registers for a row that already has one, naming the row id', () => {
    expect(() => setup(DuplicatePanelHost)).toThrow(/t1/);
  });
});
