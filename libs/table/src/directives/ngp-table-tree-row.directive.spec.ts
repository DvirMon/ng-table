import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableCellDirective } from './ngp-table-cell.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { NgpTableTreeRowDirective } from './ngp-table-tree-row.directive';
import { NgpTableDirective } from './ngp-table.directive';
import { createTaskTreeTable, mockDataRenderRow } from '../table.mock';
import type { RenderRow } from '../api/types';

@Component({
  imports: [NgpTableRowDirective, NgpTableTreeRowDirective],
  template: `
    <table>
      <tbody>
        <tr [ngpTableRow]="row()" ngpTableTreeRow></tr>
      </tbody>
    </table>
  `,
})
class HostComponent {
  readonly row: WritableSignal<RenderRow<unknown>> = signal(mockDataRenderRow());
}

interface Setup {
  fixture: ComponentFixture<HostComponent>;
  rowEl: () => HTMLElement;
  update: (next: Partial<RenderRow<unknown>>) => void;
}

function setup(overrides: Partial<RenderRow<unknown>> = {}): Setup {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.row.set(mockDataRenderRow(overrides));
  fixture.detectChanges();
  const rowEl = (): HTMLElement => fixture.nativeElement.querySelector('[role="row"]');
  const update = (next: Partial<RenderRow<unknown>>): void => {
    fixture.componentInstance.row.set(mockDataRenderRow(next));
    fixture.detectChanges();
  };
  return { fixture, rowEl, update };
}

describe('NgpTableTreeRowDirective', () => {
  it('marks a context row with an empty data-context-row attribute', () => {
    const { rowEl } = setup({ isContextRow: true });

    expect(rowEl().hasAttribute('data-context-row')).toBe(true);
    expect(rowEl().getAttribute('data-context-row')).toBe('');
  });

  it.each([false, undefined])('omits data-context-row when isContextRow is %s', (value) => {
    const { rowEl } = setup({ isContextRow: value });

    expect(rowEl().hasAttribute('data-context-row')).toBe(false);
  });

  it('removes data-context-row when the same row stops being a context row', () => {
    const { rowEl, update } = setup({ id: 'row-1', isContextRow: true });
    expect(rowEl().hasAttribute('data-context-row')).toBe(true);

    update({ id: 'row-1', isContextRow: false });

    expect(rowEl().hasAttribute('data-context-row')).toBe(false);
  });

  it('marks an expandable row with an empty data-expandable attribute', () => {
    const { rowEl } = setup({ hasChildren: true });

    expect(rowEl().hasAttribute('data-expandable')).toBe(true);
    expect(rowEl().getAttribute('data-expandable')).toBe('');
  });

  it.each([false, undefined])('omits data-expandable when hasChildren is %s', (value) => {
    const { rowEl } = setup({ hasChildren: value });

    expect(rowEl().hasAttribute('data-expandable')).toBe(false);
  });

  it('marks an expanded row with an empty data-expanded attribute', () => {
    const { rowEl } = setup({ hasChildren: true, isExpanded: true });

    expect(rowEl().hasAttribute('data-expanded')).toBe(true);
    expect(rowEl().getAttribute('data-expanded')).toBe('');
  });

  it.each([false, undefined])(
    'omits data-expanded on an expandable row when isExpanded is %s',
    (value) => {
      const { rowEl } = setup({ hasChildren: true, isExpanded: value });

      expect(rowEl().hasAttribute('data-expandable')).toBe(true);
      expect(rowEl().hasAttribute('data-expanded')).toBe(false);
    },
  );

  it.each(['data-expandable', 'data-expanded'])(
    'removes %s when the same row stops matching',
    (attribute) => {
      const { rowEl, update } = setup({ id: 'row-1', hasChildren: true, isExpanded: true });
      expect(rowEl().hasAttribute(attribute)).toBe(true);

      update({
        id: 'row-1',
        hasChildren: attribute === 'data-expanded',
        isExpanded: false,
      });

      expect(rowEl().hasAttribute(attribute)).toBe(false);
    },
  );
});

describe('NgpTableTreeRowDirective ARIA', () => {
  it.each([
    [0, '1'],
    [2, '3'],
  ])('binds aria-level for depth %s as "%s"', (depth, expected) => {
    const { rowEl } = setup({ depth });

    expect(rowEl().getAttribute('aria-level')).toBe(expected);
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
    [undefined, 'false'],
  ])(
    'binds aria-expanded on an expandable row when isExpanded is %s as "%s"',
    (isExpanded, expected) => {
      const { rowEl } = setup({ hasChildren: true, isExpanded });

      expect(rowEl().getAttribute('aria-expanded')).toBe(expected);
    },
  );

  it.each([false, undefined])(
    'omits aria-expanded on a leaf row when hasChildren is %s',
    (value) => {
      const { rowEl } = setup({ hasChildren: value, isExpanded: true });

      expect(rowEl().hasAttribute('aria-expanded')).toBe(false);
    },
  );
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
          <div [ngpTableCell]="0"><button type="button">act</button></div>
          <div [ngpTableCell]="1">{{ row.id }}</div>
        </div>
      }
    </div>
  `,
})
class KeysHostComponent {
  readonly table = createTaskTreeTable();
}

interface KeysSetup {
  host: KeysHostComponent;
  flush: () => void;
  rowIds: () => string[];
  rowEl: (id: string) => HTMLElement;
  press: (target: HTMLElement, key: string) => void;
  probe: (id: string) => () => boolean;
}

function setupKeys(options: { rtl?: boolean } = {}): KeysSetup {
  const fixture = TestBed.createComponent(KeysHostComponent);
  const root: HTMLElement = fixture.nativeElement;
  document.body.appendChild(root);
  const flush = (): void => {
    TestBed.tick();
    fixture.detectChanges();
  };
  flush();
  if (options.rtl === true) {
    const tableEl = root.firstElementChild;
    if (!(tableEl instanceof HTMLElement)) throw new Error('no table host');
    tableEl.style.direction = 'rtl';
  }
  const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('[role="row"]'));
  const idOf = (row: HTMLElement): string =>
    (row.querySelectorAll('[role="gridcell"]')[1].textContent ?? '').trim();
  const rowIds = (): string[] => rows().map(idOf);
  const rowEl = (id: string): HTMLElement => {
    const found = rows().find((row) => idOf(row) === id);
    if (found === undefined) throw new Error(`no row ${id}`);
    return found;
  };
  const press = (target: HTMLElement, key: string): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    flush();
  };
  const probe = (id: string): (() => boolean) => {
    let prevented = false;
    rowEl(id).addEventListener('keydown', (event) => {
      prevented = event.defaultPrevented;
    });
    return () => prevented;
  };
  return { host: fixture.componentInstance, flush, rowIds, rowEl, press, probe };
}

describe('NgpTableTreeRowDirective keys', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('expands a collapsed row on ArrowRight and prevents default', () => {
    const { rowIds, rowEl, press, probe } = setupKeys();
    const prevented = probe('t1');

    press(rowEl('t1'), 'ArrowRight');

    expect(rowIds()).toContain('t1a');
    expect(rowEl('t1').getAttribute('aria-expanded')).toBe('true');
    expect(prevented()).toBe(true);
  });

  it('collapses an expanded row on ArrowLeft and prevents default', () => {
    const { host, flush, rowIds, rowEl, press, probe } = setupKeys();
    host.table.tree.expand(['t1']);
    flush();
    expect(rowIds()).toContain('t1a');
    const prevented = probe('t1');

    press(rowEl('t1'), 'ArrowLeft');

    expect(rowIds()).not.toContain('t1a');
    expect(rowEl('t1').getAttribute('aria-expanded')).toBe('false');
    expect(prevented()).toBe(true);
  });

  it('toggles an expandable row open and closed on Enter and prevents default', () => {
    const { rowIds, rowEl, press, probe } = setupKeys();
    const prevented = probe('t1');

    press(rowEl('t1'), 'Enter');
    expect(rowIds()).toContain('t1a');
    expect(prevented()).toBe(true);

    press(rowEl('t1'), 'Enter');
    expect(rowIds()).not.toContain('t1a');
    expect(prevented()).toBe(true);
  });

  it.each([
    ['ArrowRight', 't1', true],
    ['ArrowLeft', 't1', false],
    ['ArrowRight', 't2', false],
    ['ArrowLeft', 't2', false],
    ['Enter', 't2', false],
  ])('leaves %s unhandled on row %s (expanded: %s)', (key, id, expanded) => {
    const { host, flush, rowIds, rowEl, press, probe } = setupKeys();
    if (expanded) {
      host.table.tree.expand(['t1']);
      flush();
    }
    const before = rowIds();
    const prevented = probe(id);

    press(rowEl(id), key);

    expect(prevented()).toBe(false);
    expect(rowIds()).toEqual(before);
  });

  it.each(['cell', 'button'])(
    'ignores Enter and ArrowRight whose target is a %s inside the row',
    (kind) => {
      const { rowIds, rowEl, press, probe } = setupKeys();
      const prevented = probe('t1');
      const inner =
        kind === 'button'
          ? rowEl('t1').querySelector<HTMLElement>('button')
          : rowEl('t1').querySelectorAll<HTMLElement>('[role="gridcell"]')[1];
      if (inner === null) throw new Error('no inner target');

      press(inner, 'Enter');
      press(inner, 'ArrowRight');

      expect(rowIds()).not.toContain('t1a');
      expect(prevented()).toBe(false);
    },
  );

  it('expands on ArrowLeft and collapses on ArrowRight under RTL', () => {
    const { rowIds, rowEl, press, probe } = setupKeys({ rtl: true });
    const prevented = probe('t1');

    press(rowEl('t1'), 'ArrowLeft');
    expect(rowIds()).toContain('t1a');
    expect(prevented()).toBe(true);

    press(rowEl('t1'), 'ArrowRight');
    expect(rowIds()).not.toContain('t1a');
    expect(prevented()).toBe(true);
  });
});
