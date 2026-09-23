import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgpTableDirective } from './ngp-table.directive';
import { createMockTableStore } from '../table.mock';
import type { RenderRow, RowId, TableStore } from '../api/types';

/**
 * jsdom never computes real layout, so `offsetTop` is pinned directly rather than produced by
 * actual positioning — the directive under test never queries the DOM for position, so this is
 * enough to drive its id-keyed lookup.
 */
function rowElementAt(top: number): HTMLElement {
  const element = document.createElement('tr');
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
  return element;
}

function mockRenderRow(id: RowId, index: number): RenderRow<unknown> {
  return { id, depth: 0, kind: 'row', data: null, index, cells: {} };
}

/** `createMockTableStore()`'s `renderRows` is typed `Signal` (read-only) on `TableStore`; this
 * spec needs the underlying `WritableSignal` to drive row-list changes and trigger the FLIP
 * effect, so it overrides that one field and keeps a direct reference to it. */
function createControllableStore(): {
  store: TableStore<unknown>;
  renderRows: WritableSignal<RenderRow<unknown>[]>;
} {
  const renderRows = signal<RenderRow<unknown>[]>([]);
  return { store: { ...createMockTableStore(), renderRows }, renderRows };
}

@Component({
  imports: [NgpTableDirective],
  template: `<table [ngpTable]="store"></table>`,
})
class HostComponent {
  store!: TableStore<unknown>;
}

function setup(): {
  directive: NgpTableDirective<unknown>;
  renderRows: WritableSignal<RenderRow<unknown>[]>;
} {
  const { store, renderRows } = createControllableStore();
  TestBed.configureTestingModule({ imports: [HostComponent] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.store = store;
  fixture.detectChanges();

  const directive = fixture.debugElement
    .query(By.directive(NgpTableDirective))
    .injector.get(NgpTableDirective) as NgpTableDirective<unknown>;

  return { directive, renderRows };
}

/** Flushes the FLIP effect (registered by the last `renderRows.set(...)`) and the
 * `afterNextRender` measurement it schedules. Two ticks because the second tick may be needed
 * to run a render hook registered during the first — see `ngp-table.directive.ts`'s
 * constructor. Calling `tick()` extra times is harmless once nothing is pending. */
function tick(): void {
  TestBed.tick();
  TestBed.tick();
}

describe('NgpTableDirective — row-position measurement (FLIP)', () => {
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

    // 'b' leaves renderRows(), but `animate.leave` keeps its `<tr>` mounted past removal (D2),
    // so it is still registered. Poison its offsetTop: if measurement still paired elements by
    // DOM/list position instead of by row id, this value would leak into whatever slot a
    // position-based lookup read next (here, where 'c' would land).
    Object.defineProperty(rowB, 'offsetTop', { value: -1000, configurable: true });

    // 'c' itself really did move — its own element's offsetTop changes.
    Object.defineProperty(rowC, 'offsetTop', { value: 40, configurable: true });

    renderRows.set([mockRenderRow('a', 0), mockRenderRow('c', 1)]);
    tick();

    expect(directive.flipOffsetFor('a')).toBe(0); // unmoved
    // 80 (old) - 40 (new) = 40 — 'c' measured off its own registered element, not 'b's
    // leftover/poisoned one (which would give 80 - (-1000) = 1080).
    expect(directive.flipOffsetFor('c')).toBe(40);
  });

  it('skips a row id with no registered element instead of misattributing a neighboring one', () => {
    const { directive, renderRows } = setup();

    const rowA = rowElementAt(0);
    directive.registerRowElement('a', rowA);
    // 'b' is never registered — e.g. its ngpTableRow directive has not run its registration
    // effect yet.

    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1)]);
    tick();

    Object.defineProperty(rowA, 'offsetTop', { value: 50, configurable: true });
    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1)]);
    tick();

    expect(directive.flipOffsetFor('a')).toBe(-50); // 0 (old) - 50 (new) = -50
    expect(directive.flipOffsetFor('b')).toBe(0); // never had a captured top to diff against
  });

  it('unregisterRowElement is a no-op when the given element is no longer the current one for that id', () => {
    const { directive, renderRows } = setup();

    const oldElement = rowElementAt(0);
    directive.registerRowElement('a', oldElement);
    renderRows.set([mockRenderRow('a', 0)]);
    tick(); // baseline: previousRowTops = {a: 0}

    // A re-entering row with the same id registers its own element...
    const newElement = rowElementAt(10);
    directive.registerRowElement('a', newElement);
    // ...before the old (leaving) instance's destroy cleanup runs. That cleanup must not clobber
    // the new registration.
    directive.unregisterRowElement('a', oldElement);

    renderRows.set([mockRenderRow('a', 0)]);
    tick();

    // 0 (old) - 10 (new element's top) = -10. If unregister had wrongly deleted the entry, 'a'
    // would be skipped entirely (see the previous test) and this would read 0 instead.
    expect(directive.flipOffsetFor('a')).toBe(-10);
  });
});
