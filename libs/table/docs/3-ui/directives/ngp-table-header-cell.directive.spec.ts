import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgpTableHeaderCellDirective } from '../../../directives/ngp-table-header-cell.directive';

@Component({
  imports: [NgpTableHeaderCellDirective],
  template: `<table>
    <tr>
      <th ngpTableHeaderCell [ngpTableHeaderCellColIndex]="colIndex">Name</th>
    </tr>
  </table>`,
})
class HostComponent {
  colIndex = 0;
}

function getHeaderCellElement(fixture: ReturnType<typeof TestBed.createComponent>): HTMLElement {
  const nativeElement: unknown = fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(NgpTableHeaderCellDirective, null) !== null,
  ).nativeElement;
  if (!(nativeElement instanceof HTMLElement)) {
    throw new Error('Expected an HTMLElement');
  }
  return nativeElement;
}

describe('NgpTableHeaderCellDirective', () => {
  it('sets role="columnheader" and derives aria-colindex from colIndex (ADR-0005)', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.colIndex = 1;
    fixture.detectChanges();

    const cellElement = getHeaderCellElement(fixture);
    expect(cellElement.getAttribute('role')).toBe('columnheader');
    // aria-colindex is 1-based; colIndex is the 0-based column position.
    expect(cellElement.getAttribute('aria-colindex')).toBe('2');
  });
});
