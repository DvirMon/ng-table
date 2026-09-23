import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTableRowAnimationDirective } from './ngp-table-row-animation.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createMockTableStore } from '../table.mock';
import type { RenderRow, RowId, TableStore } from '../api/types';

function rowElementAt(top: number): HTMLElement {
  const element = document.createElement('tr');
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
  return element;
}

function mockRenderRow(id: RowId, index: number): RenderRow<unknown> {
  return { id, depth: 0, kind: 'row', data: null, index, cells: {} };
}

function createControllableStore(): {
  store: TableStore<unknown>;
  renderRows: WritableSignal<RenderRow<unknown>[]>;
} {
  const renderRows = signal<RenderRow<unknown>[]>([]);
  return { store: { ...createMockTableStore(), renderRows }, renderRows };
}

function tick(): void {
  TestBed.tick();
  TestBed.tick();
}

@Component({
  imports: [NgpTableDirective, NgpTableRowAnimationDirective],
  template: `<table [ngpTable]="store" ngpTableRowAnimation></table>`,
})
class HostComponent {
  store!: TableStore<unknown>;
}

function setup(): {
  directive: NgpTableRowAnimationDirective<unknown>;
  renderRows: WritableSignal<RenderRow<unknown>[]>;
} {
  const { store, renderRows } = createControllableStore();
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.store = store;
  fixture.detectChanges();

  const directive = fixture.debugElement
    .query(By.directive(NgpTableRowAnimationDirective))
    .injector.get(NgpTableRowAnimationDirective) as NgpTableRowAnimationDirective<unknown>;

  return { directive, renderRows };
}

describe('NgpTableRowAnimationDirective — row-position measurement (FLIP)', () => {
  it('does not let a DOM element still registered for a row no longer in renderRows() shift the measured tops of the rows after it', () => {
    const { directive, renderRows } = setup();

    const rowA = rowElementAt(0);
    const rowB = rowElementAt(40); // about to leave
    const rowC = rowElementAt(80);
    directive.registerRowElement('a', rowA);
    directive.registerRowElement('b', rowB);
    directive.registerRowElement('c', rowC);

    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1), mockRenderRow('c', 2)]);
    tick(); // baseline capture: previousRowTops = {a:0, b:40, c:80}; first run, no deltas

    Object.defineProperty(rowB, 'offsetTop', { value: -1000, configurable: true });
    Object.defineProperty(rowC, 'offsetTop', { value: 40, configurable: true });

    renderRows.set([mockRenderRow('a', 0), mockRenderRow('c', 1)]);
    tick();

    expect(directive.flipOffsetFor('a')).toBe(0); // unmoved
    expect(directive.flipOffsetFor('c')).toBe(40);
  });

  it('skips a row id with no registered element instead of misattributing a neighboring one', () => {
    const { directive, renderRows } = setup();

    const rowA = rowElementAt(0);
    directive.registerRowElement('a', rowA);

    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1)]);
    tick();

    Object.defineProperty(rowA, 'offsetTop', { value: 50, configurable: true });
    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1)]);
    tick();

    expect(directive.flipOffsetFor('a')).toBe(-50);
    expect(directive.flipOffsetFor('b')).toBe(0);
  });

  it('unregisterRowElement is a no-op when the given element is no longer the current one for that id', () => {
    const { directive, renderRows } = setup();

    const oldElement = rowElementAt(0);
    directive.registerRowElement('a', oldElement);
    renderRows.set([mockRenderRow('a', 0)]);
    tick();

    const newElement = rowElementAt(10);
    directive.registerRowElement('a', newElement);
    directive.unregisterRowElement('a', oldElement);

    renderRows.set([mockRenderRow('a', 0)]);
    tick();

    expect(directive.flipOffsetFor('a')).toBe(-10);
  });
});

@Component({
  imports: [NgpTableDirective, NgpTableRowDirective],
  template: `
    <table [ngpTable]="store">
      <tr [ngpTableRow]="row"></tr>
    </table>
  `,
})
class HostWithoutAnimationComponent {
  store!: TableStore<unknown>;
  row!: RenderRow<unknown>;
}

describe('NgpTableRowDirective — no ngpTableRowAnimation on the host', () => {
  it('binds no data-row-flipping attribute and no --ngp-table-row-flip-offset style when the host table has no NgpTableRowAnimationDirective', () => {
    const { store } = createControllableStore();
    TestBed.configureTestingModule({ imports: [HostWithoutAnimationComponent] });
    const fixture = TestBed.createComponent(HostWithoutAnimationComponent);
    fixture.componentInstance.store = store;
    fixture.componentInstance.row = mockRenderRow('a', 0);
    fixture.detectChanges();

    const rowElement = fixture.debugElement.query(By.css('tr')).nativeElement as HTMLElement;

    expect(rowElement.getAttribute('data-row-flipping')).toBeNull();
    expect(rowElement.style.getPropertyValue('--ngp-table-row-flip-offset')).toBe('');
  });
});
