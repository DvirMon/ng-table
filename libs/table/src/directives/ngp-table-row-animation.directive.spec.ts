import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTableRowAnimationDirective } from './ngp-table-row-animation.directive';
import { createMockTableStore } from '../table.mock';
import type { RenderRow, RowId, TableStore } from '../api/types';

// jsdom computes no layout and implements no Web Animations: `offsetTop` is pinned, and
// `animate()` is a stub whose calls are the observable FLIP.
function rowElementAt(top: number): HTMLElement {
  const element = document.createElement('tr');
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
  Object.defineProperty(element, 'animate', { value: vi.fn() });
  return element;
}

function moveTo(element: HTMLElement, top: number): void {
  Object.defineProperty(element, 'offsetTop', { value: top, configurable: true });
}

function animatedKeyframesOf(element: HTMLElement): Keyframe[][] {
  return vi.mocked(element.animate).mock.calls.map(([keyframes]) => keyframes as Keyframe[]);
}

function glideFrom(delta: number): Keyframe[] {
  return [{ transform: `translateY(${delta}px)` }, { transform: 'none' }];
}

function stubReducedMotion(prefersReducedMotion: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches: prefersReducedMotion }));
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
  beforeEach(() => stubReducedMotion(false));
  afterEach(() => vi.unstubAllGlobals());

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

    moveTo(rowB, -1000);
    moveTo(rowC, 40);
    renderRows.set([mockRenderRow('a', 0), mockRenderRow('c', 1)]);
    tick();

    expect(animatedKeyframesOf(rowA)).toEqual([]); // unmoved
    expect(animatedKeyframesOf(rowC)).toEqual([glideFrom(40)]);
  });

  it('moves rows without animating when the user prefers reduced motion', () => {
    stubReducedMotion(true);
    const { directive, renderRows } = setup();

    const rowA = rowElementAt(0);
    directive.registerRowElement('a', rowA);
    renderRows.set([mockRenderRow('a', 0)]);
    tick();

    moveTo(rowA, 30);
    renderRows.set([mockRenderRow('a', 0)]);
    tick();

    expect(animatedKeyframesOf(rowA)).toEqual([]);
  });

  it('skips a row id with no registered element instead of misattributing a neighboring one', () => {
    const { directive, renderRows } = setup();

    const rowA = rowElementAt(0);
    directive.registerRowElement('a', rowA);

    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1)]);
    tick();

    moveTo(rowA, 50);
    renderRows.set([mockRenderRow('a', 0), mockRenderRow('b', 1)]);
    tick();

    expect(animatedKeyframesOf(rowA)).toEqual([glideFrom(-50)]);
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

    expect(animatedKeyframesOf(newElement)).toEqual([glideFrom(-10)]);
  });
});
