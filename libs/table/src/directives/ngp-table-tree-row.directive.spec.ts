import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableRowDirective } from './ngp-table-row.directive';
import { NgpTableTreeRowDirective } from './ngp-table-tree-row.directive';
import { mockDataRenderRow } from '../table.mock';
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
});
