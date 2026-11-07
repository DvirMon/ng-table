import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';

import { NgpTableCellDirective } from './ngp-table-cell.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { NgpTableDirective } from './ngp-table.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import { withExpansion } from '../api/features/with-expansion';
import { withTree } from '../api/features/with-tree/feature';
import {
  mockGroupingRows,
  mockGroupingTrackBy,
  mockTaskTreeRows,
  noData,
  type GroupingMockRow,
  type TaskTreeMockRow,
} from '../table.mock';

const IMPORTS = [NgpTableDirective, NgpTableRowDirective, NgpTableCellDirective];

function templateFor(tableExpr: string): string {
  return `
    <button type="button" id="outside">Outside</button>
    <div [ngpTable]="${tableExpr}">
      @for (row of ${tableExpr}.renderRows(); track row.id) {
        <div [ngpTableRow]="row">
          @for (column of ${tableExpr}.renderColumns(); track column.id; let i = $index) {
            <div [ngpTableCell]="i">{{ text(row, column.id) }}</div>
          }
        </div>
      }
    </div>
  `;
}

function textOf(row: { data: unknown }, columnId: string): string {
  const data = row.data;
  if (data === null || typeof data !== 'object') return '';
  return String(Reflect.get(data, columnId) ?? '');
}

function createTaskColumns() {
  return createColumns(noData<TaskTreeMockRow>(), (col) => [col('id'), col('status')]);
}

function createTreeTable() {
  return createTable(
    signal<TaskTreeMockRow[]>([...mockTaskTreeRows]),
    { trackBy: 'id', columns: createTaskColumns() },
    withTree({ parentId: (row) => row.parentId }),
  );
}

function createPlainTable() {
  return createTable(signal<TaskTreeMockRow[]>([...mockTaskTreeRows]), {
    trackBy: 'id',
    columns: createTaskColumns(),
  });
}

@Component({ imports: IMPORTS, template: templateFor('table') })
class TreeHost {
  readonly table = createTreeTable();
  protected readonly text = textOf;
}

@Component({ imports: IMPORTS, template: templateFor('table') })
class GridHost {
  readonly table = createPlainTable();
  protected readonly text = textOf;
}

@Component({ imports: IMPORTS, template: templateFor('table') })
class LeafOnlyTreeHost {
  readonly table = createTable(
    signal<GroupingMockRow[]>([...mockGroupingRows]),
    {
      trackBy: mockGroupingTrackBy,
      columns: createColumns(noData<GroupingMockRow>(), (col) => [
        col('region'),
        col('category'),
        col('amount'),
      ]),
    },
    withTree(),
  );
  protected readonly text = textOf;
}

@Component({ imports: IMPORTS, template: templateFor('table') })
class ExpansionOnlyHost {
  readonly table = createTable(
    signal<TaskTreeMockRow[]>([...mockTaskTreeRows]),
    { trackBy: 'id', columns: createTaskColumns() },
    withExpansion(),
  );
  protected readonly text = textOf;
}

@Component({ imports: IMPORTS, template: templateFor('table()') })
class SwappableHost {
  readonly table = signal<ReturnType<typeof createTreeTable> | ReturnType<typeof createPlainTable>>(
    createTreeTable(),
  );
  protected readonly text = textOf;
}

interface NullIdRow {
  id: string;
  null: string;
}

@Component({ imports: IMPORTS, template: templateFor('table') })
class NullColumnHost {
  readonly table = createTable(
    signal<NullIdRow[]>([{ id: 'a', null: 'x' }]),
    {
      trackBy: 'id',
      columns: createColumns(noData<NullIdRow>(), (col) => [col('id'), col('null')]),
    },
    withTree(),
  );
  protected readonly text = textOf;
}

interface Setup<THost> {
  fixture: ComponentFixture<THost>;
  root: HTMLElement;
  host: THost;
  flush: () => void;
  tabStops: () => HTMLElement[];
  rows: () => HTMLElement[];
  cell: (rowText: string, colIndex: number) => HTMLElement;
  directive: () => NgpTableDirective;
}

function setup<THost>(hostType: new () => THost): Setup<THost> {
  const fixture = TestBed.createComponent(hostType);
  const root: HTMLElement = fixture.nativeElement;
  document.body.appendChild(root);
  const flush = (): void => {
    TestBed.tick();
    fixture.detectChanges();
  };
  flush();

  const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('[role="row"]'));
  return {
    fixture,
    root,
    host: fixture.componentInstance,
    flush,
    tabStops: () => Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]')),
    rows,
    cell: (rowText, colIndex) => {
      const row = rows().find((r) => r.textContent?.includes(rowText) === true);
      const found = row?.querySelector<HTMLElement>(`[aria-colindex="${colIndex}"]`);
      if (found === null || found === undefined) throw new Error(`no cell ${rowText}/${colIndex}`);
      return found;
    },
    directive: () =>
      fixture.debugElement.query(By.directive(NgpTableDirective)).injector.get(NgpTableDirective),
  };
}

function gridElement(root: HTMLElement): HTMLElement {
  const found = root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]');
  if (found === null) throw new Error('no grid host');
  return found;
}

function rowOfText(rows: HTMLElement[], text: string): HTMLElement {
  const found = rows.find((row) => row.querySelector('[role="gridcell"]')?.textContent === text);
  if (found === undefined) throw new Error(`no row ${text}`);
  return found;
}

describe('NgpTableDirective treegrid role', () => {
  it('sets role="treegrid" when withTree() is composed, even when no row has children', () => {
    const { root } = setup(LeafOnlyTreeHost);

    expect(gridElement(root).getAttribute('role')).toBe('treegrid');
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[aria-colindex]'));
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.getAttribute('role')).toBe('gridcell');
  });

  it('keeps role="grid" when withExpansion() is composed without withTree()', () => {
    const { root } = setup(ExpansionOnlyHost);

    expect(gridElement(root).getAttribute('role')).toBe('grid');
  });

  it('switches role from treegrid to grid when the ngpTable input is swapped to a store without withTree()', () => {
    const { host, root, flush, rows } = setup(SwappableHost);
    expect(gridElement(root).getAttribute('role')).toBe('treegrid');

    host.table.set(TestBed.runInInjectionContext(() => createPlainTable()));
    flush();

    expect(gridElement(root).getAttribute('role')).toBe('grid');
    expect(rows().length).toBeGreaterThan(0);
    for (const row of rows()) expect(row.hasAttribute('tabindex')).toBe(false);
  });
});

describe('NgpTableDirective treegrid row focus targets', () => {
  it('puts the only tabindex="0" on the first data row itself in a treegrid when nothing is focused', () => {
    const { root, tabStops, rows, directive } = setup(TreeHost);

    expect(directive().activeTarget()).toEqual({ area: 'body', rowId: 't1', columnId: null });
    const stops = tabStops();
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(rows()[0]);
    const cells = Array.from(root.querySelectorAll<HTMLElement>('[role="gridcell"]'));
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.getAttribute('tabindex')).toBe('-1');
  });

  it('moves the single tabindex="0" to the row named by focus.moveTo with columnId null', () => {
    const { host, flush, tabStops, rows } = setup(TreeHost);
    const firstRow = rows()[0];

    host.table.focus.moveTo({ area: 'body', rowId: 't2', columnId: null });
    flush();

    const stops = tabStops();
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(rowOfText(rows(), 't2'));
    expect(firstRow.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the row at tabindex="-1" while a cell in it is the active target', () => {
    const { host, flush, tabStops, cell, rows } = setup(TreeHost);

    host.table.focus.moveTo({ area: 'body', rowId: 't1', columnId: 'status' });
    flush();

    const stops = tabStops();
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(cell('t1', 2));
    expect(rowOfText(rows(), 't1').getAttribute('tabindex')).toBe('-1');
  });

  it('writes { area: body, rowId, columnId: null } when focus lands on a row', () => {
    const { host, flush, rows } = setup(TreeHost);

    rowOfText(rows(), 't2').focus();
    flush();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 't2', columnId: null });
  });

  it('writes the cell target, not the row, when focus lands on a cell inside a treegrid row', () => {
    const { host, flush, cell } = setup(TreeHost);

    cell('t1', 2).focus();
    flush();

    expect(host.table.focus()).toEqual({ area: 'body', rowId: 't1', columnId: 'status' });
  });

  it('focuses the row element on a focusElement request for a row target', () => {
    const { host, root, flush, rows } = setup(TreeHost);
    const outside = root.querySelector<HTMLElement>('#outside');
    outside?.focus();
    flush();

    host.table.focus.moveTo({ area: 'body', rowId: 't2', columnId: null }, { focusElement: true });
    flush();

    expect(document.activeElement).toBe(rowOfText(rows(), 't2'));
  });

  it('keeps a row target and a column with id "null" apart in the registry', () => {
    const { host, root, flush, tabStops, cell, rows } = setup(NullColumnHost);
    const outside = root.querySelector<HTMLElement>('#outside');
    outside?.focus();
    flush();

    host.table.focus.moveTo({ area: 'body', rowId: 'a', columnId: 'null' }, { focusElement: true });
    flush();
    expect(document.activeElement).toBe(cell('a', 2));
    expect(tabStops()).toEqual([cell('a', 2)]);

    host.table.focus.moveTo({ area: 'body', rowId: 'a', columnId: null }, { focusElement: true });
    flush();
    expect(document.activeElement).toBe(rows()[0]);
    expect(tabStops()).toEqual([rows()[0]]);
  });
});

describe('NgpTableDirective grid rows', () => {
  it('binds no tabindex on a grid row and writes no row target when its padding is clicked', () => {
    const { host, flush, rows } = setup(GridHost);
    const before = host.table.focus();

    for (const row of rows()) expect(row.hasAttribute('tabindex')).toBe(false);
    const row = rows()[0];
    row.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    row.click();
    flush();

    const after = host.table.focus();
    expect(after).toEqual(before);
    const isRowTarget = after !== null && 'columnId' in after && after.columnId === null;
    expect(isRowTarget).toBe(false);
  });
});
