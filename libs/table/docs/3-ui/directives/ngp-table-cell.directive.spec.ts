import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgpTableCellDirective } from '../../../directives/ngp-table-cell.directive';

@Component({
  imports: [NgpTableCellDirective],
  template: `<table>
    <tr>
      <td ngpTableCell [ngpTableCellColIndex]="colIndex">Ada</td>
    </tr>
  </table>`,
})
class HostComponent {
  colIndex = 0;
}

function getCellElement(fixture: ReturnType<typeof TestBed.createComponent>): HTMLElement {
  const nativeElement: unknown = fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(NgpTableCellDirective, null) !== null,
  ).nativeElement;
  if (!(nativeElement instanceof HTMLElement)) {
    throw new Error('Expected an HTMLElement');
  }
  return nativeElement;
}

describe('NgpTableCellDirective', () => {
  it('sets role="cell" and derives aria-colindex from colIndex (ADR-0005)', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.colIndex = 2;
    fixture.detectChanges();

    const cellElement = getCellElement(fixture);
    expect(cellElement.getAttribute('role')).toBe('cell');
    // aria-colindex is 1-based; colIndex is the 0-based column position.
    expect(cellElement.getAttribute('aria-colindex')).toBe('3');
  });
});
