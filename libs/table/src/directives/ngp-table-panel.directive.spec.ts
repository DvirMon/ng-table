import { Component, computed, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTablePanelDirective } from './ngp-table-panel.directive';
import { NgpTablePanelToggleDirective } from './ngp-table-panel-toggle.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withExpansion } from '../api/features/with-expansion';
import { mockSpacedIdRow, mockTaskTreeRows, noData, type TaskTreeMockRow } from '../table.mock';

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

const IMPORTS = [
  NgpTableDirective,
  NgpTablePanelDirective,
  NgpTableRowDirective,
  NgpTablePanelToggleDirective,
];

@Component({
  selector: 'ngp-default-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.rows(); track row.id) {
          @if (table.expansion().has(row.id)) {
            <tr>
              <td>
                <div
                  [ngpTablePanel]="row.id"
                  role="region"
                  [attr.aria-label]="'Details ' + row.id"
                ></div>
              </td>
            </tr>
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
            <tr>
              <td>
                <div
                  [ngpTablePanel]="row.id"
                  role="region"
                  [attr.aria-label]="'Details ' + row.id"
                ></div>
              </td>
            </tr>
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
          <tr>
            <td>
              <div
                [ngpTablePanel]="row.id"
                role="region"
                [attr.aria-label]="'Details ' + row.id"
              ></div>
            </td>
          </tr>
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
          <tr>
            <td>
              <div
                [ngpTablePanel]="row.id"
                role="region"
                [attr.aria-label]="'Details ' + row.id"
              ></div>
              <div
                [ngpTablePanel]="row.id"
                role="region"
                [attr.aria-label]="'Details ' + row.id"
              ></div>
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
class DuplicatePanelHost {
  readonly table = createExpandableTable();
}

@Component({
  selector: 'ngp-close-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of table.renderRows(); track row.id) {
          <tr [ngpTableRow]="row">
            <td><button type="button" ngpTablePanelToggle>Toggle {{ row.id }}</button></td>
          </tr>
          @if (table.expansion().has(row.id)) {
            <tr>
              <td>
                <div
                  [ngpTablePanel]="row.id"
                  #p="ngpTablePanel"
                  role="region"
                  [attr.aria-label]="'Details ' + row.id"
                  animate.leave="panel--leave"
                >
                  <button type="button" (click)="p.close()">Close {{ row.id }}</button>
                  <button type="button" (keydown.escape)="$event.preventDefault()">
                    Handles Esc {{ row.id }}
                  </button>
                </div>
              </td>
            </tr>
          }
        }
      </tbody>
    </table>
  `,
})
class ClosePanelHost {
  readonly table = createTable(
    signal<TaskTreeMockRow[]>(ROWS),
    createPanelConfig(),
    withExpansion({ initial: ['t1', 't2'] }),
  );
}

@Component({
  selector: 'ngp-reused-toggle-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (row of orderedRows(); track $index) {
          <tr [ngpTableRow]="row">
            <td><button type="button" ngpTablePanelToggle>Toggle {{ row.id }}</button></td>
          </tr>
          @if (table.expansion().has(row.id)) {
            <tr>
              <td>
                <div
                  [ngpTablePanel]="row.id"
                  #p="ngpTablePanel"
                  role="region"
                  [attr.aria-label]="'Details ' + row.id"
                >
                  <button type="button" (click)="p.close()">Close {{ row.id }}</button>
                </div>
              </td>
            </tr>
          }
        }
      </tbody>
    </table>
  `,
})
class ReusedToggleHost {
  readonly reversed = signal(false);
  readonly table = createTable(
    signal<TaskTreeMockRow[]>(ROWS),
    createPanelConfig(),
    withExpansion({ initial: ['t1', 't2'] }),
  );
  readonly orderedRows = computed(() =>
    this.reversed() ? [...this.table.renderRows()].reverse() : this.table.renderRows(),
  );
}

@Component({
  selector: 'ngp-reordered-panel-host',
  imports: IMPORTS,
  template: `
    <table [ngpTable]="table">
      <tbody>
        @for (id of ids(); track $index) {
          @if (table.expansion.everExpanded().has(id)) {
            <tr>
              <td>
                <div [ngpTablePanel]="id" role="region" [attr.aria-label]="'Details ' + id"></div>
              </td>
            </tr>
          }
        }
      </tbody>
    </table>
  `,
})
class ReorderedPanelHost {
  readonly ids = signal<string[]>(['t1', 't2']);
  readonly table = createTable(
    signal<TaskTreeMockRow[]>(ROWS),
    createPanelConfig(),
    withExpansion({ initial: ['t1', 't2'] }),
  );
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

  describe('close paths', () => {
    function setupClose() {
      const base = setup(ClosePanelHost);
      const root: HTMLElement = base.fixture.nativeElement;
      const host = base.fixture.componentInstance;
      if (!(host instanceof ClosePanelHost)) throw new Error('unexpected host');
      const button = (name: string): HTMLButtonElement => {
        const found = Array.from(root.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === name,
        );
        if (found === undefined) throw new Error(`no button named ${name}`);
        return found;
      };
      return { ...base, button, table: host.table };
    }

    function pressEscape(target: HTMLElement): KeyboardEvent {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    }

    it('close() collapses only its own row', () => {
      const { fixture, button, table } = setupClose();

      button('Close t1').focus();
      button('Close t1').click();
      fixture.detectChanges();

      expect([...table.expansion()]).toEqual(['t2']);
      expect(document.activeElement).toBe(button('Toggle t1'));
    });

    it('Esc inside a panel collapses only that row', () => {
      const { fixture, button, table } = setupClose();

      button('Close t1').focus();
      const event = pressEscape(button('Close t1'));
      fixture.detectChanges();

      expect([...table.expansion()]).toEqual(['t2']);
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(button('Toggle t1'));
    });

    it('close() returns focus to the toggle when focus is on <body>', () => {
      const { fixture, button } = setupClose();
      const close = button('Close t1');
      const toggle = button('Toggle t1');
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement).toBe(document.body);

      close.click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(toggle);
    });

    it('close() returns focus to the toggle when no element has focus', () => {
      const { fixture, button } = setupClose();
      const close = button('Close t1');
      const focus = vi.spyOn(button('Toggle t1'), 'focus');
      Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null });
      try {
        close.click();
        fixture.detectChanges();
      } finally {
        delete (document as { activeElement?: unknown }).activeElement;
      }

      expect(focus).toHaveBeenCalledTimes(1);
    });

    it('close() leaves focus alone when it was outside the panel', () => {
      const { fixture, button } = setupClose();
      const other = button('Toggle t2');
      other.focus();

      button('Close t1').click();
      fixture.detectChanges();

      expect(document.activeElement).toBe(other);
    });

    it('returns focus to the toggle now rendering the row after reused views swap rows', () => {
      const fixture = TestBed.createComponent(ReusedToggleHost);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const button = (name: string): HTMLButtonElement => {
        const found = Array.from(root.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === name,
        );
        if (found === undefined) throw new Error(`no button named ${name}`);
        return found;
      };

      fixture.componentInstance.reversed.set(true);
      fixture.detectChanges();

      button('Close t2').focus();
      button('Close t2').click();
      fixture.detectChanges();
      expect(document.activeElement?.textContent?.trim()).toBe('Toggle t2');

      button('Close t1').focus();
      button('Close t1').click();
      fixture.detectChanges();
      expect(document.activeElement?.textContent?.trim()).toBe('Toggle t1');
    });

    it('ignores Esc when an inner element already prevented it', () => {
      const { fixture, button, table } = setupClose();
      expect([...table.expansion()]).toEqual(['t1', 't2']);

      pressEscape(button('Handles Esc t1'));
      fixture.detectChanges();

      expect([...table.expansion()]).toEqual(['t1', 't2']);
    });

    it('marks a leaving panel inert immediately after the closing change detection', () => {
      const { fixture, panel, table } = setupClose();
      const leaving = panel('t1');
      expect(leaving.hasAttribute('inert')).toBe(false);

      table.expansion.collapse(['t1']);
      fixture.detectChanges();

      expect(leaving.hasAttribute('inert')).toBe(true);
      expect(panel('t2').hasAttribute('inert')).toBe(false);
    });
  });

  it('keeps each panel id and inert state on its own row when views are reused for swapped rows', () => {
    const { fixture, panel, expand, collapse } = setup(ReorderedPanelHost);
    const host = fixture.componentInstance;
    if (!(host instanceof ReorderedPanelHost)) throw new Error('unexpected host');
    const idOf = (row: string): string => panel(row).id;
    const initialT1 = idOf('t1');
    const initialT2 = idOf('t2');

    expect(() => {
      host.ids.set(['t2', 't1']);
      fixture.detectChanges();
    }).not.toThrow();
    expect(idOf('t1')).toBe(initialT1);
    expect(idOf('t2')).toBe(initialT2);

    collapse('t1');
    expect(panel('t1').hasAttribute('inert')).toBe(true);
    expect(panel('t2').hasAttribute('inert')).toBe(false);

    expect(() => expand('t1')).not.toThrow();
    expect(idOf('t1')).toBe(initialT1);
    expect(panel('t1').hasAttribute('inert')).toBe(false);

    host.ids.set([]);
    fixture.detectChanges();
    expect(() => {
      host.ids.set(['t1', 't2']);
      fixture.detectChanges();
    }).not.toThrow();
    expect(idOf('t1')).toBe(initialT1);
    expect(idOf('t2')).toBe(initialT2);
  });

  it('throws on first render when the table has no withExpansion()', () => {
    expect(() => setup(NoExpansionHost)).toThrow(/ngpTablePanel[\s\S]*withExpansion\(\)/);
  });

  it('throws when a second panel registers for a row that already has one, naming the row id', () => {
    expect(() => setup(DuplicatePanelHost)).toThrow(/t1/);
  });
});
