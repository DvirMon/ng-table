import { Component, inject, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { mockDataRenderRow, mockGroupRenderRow } from '../../../table.mock';
import { NGP_TABLE_ROW } from '../../../directives/table.tokens';
import type { RenderRow } from '../../../api/types';

@Component({
  selector: '[host-probe]',
  template: '',
})
class HostProbeComponent {
  readonly resolvedRow = inject(NGP_TABLE_ROW);
}

function isHostProbeComponent(value: unknown): value is HostProbeComponent {
  return value instanceof HostProbeComponent;
}

@Component({
  imports: [NgpTableRowDirective, HostProbeComponent],
  template: `
    <table>
      <tbody>
        <tr [ngpTableRow]="renderRow()" host-probe></tr>
      </tbody>
    </table>
  `,
})
class HostComponent {
  readonly renderRow: WritableSignal<RenderRow<unknown>> = signal(mockDataRenderRow());
}

function getDirective(fixture: ReturnType<typeof TestBed.createComponent>): NgpTableRowDirective {
  return fixture.debugElement
    .query((debugEl) => debugEl.injector.get(NgpTableRowDirective, null) !== null)
    .injector.get(NgpTableRowDirective);
}

function getProbe(fixture: ReturnType<typeof TestBed.createComponent>): HostProbeComponent {
  const componentInstance: unknown = fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(HostProbeComponent, null) !== null,
  ).componentInstance;
  if (!isHostProbeComponent(componentInstance)) {
    throw new Error('Expected HostProbeComponent instance');
  }
  return componentInstance;
}

function getRowElement(fixture: ReturnType<typeof TestBed.createComponent>): HTMLElement {
  const nativeElement: unknown = fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(NgpTableRowDirective, null) !== null,
  ).nativeElement;
  if (!(nativeElement instanceof HTMLElement)) {
    throw new Error('Expected an HTMLElement');
  }
  return nativeElement;
}

describe('NgpTableRowDirective', () => {
  it('rowId computed returns renderRow().id for a data row', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow({ id: 'row-42' }));
    fixture.detectChanges();

    expect(getDirective(fixture).rowId()).toBe('row-42');
  });

  it('isGroupHeader computed returns false for a data row and true for a group row', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow());
    fixture.detectChanges();

    expect(getDirective(fixture).isGroupHeader()).toBe(false);

    fixture.componentInstance.renderRow.set(mockGroupRenderRow());
    fixture.detectChanges();

    expect(getDirective(fixture).isGroupHeader()).toBe(true);
  });

  it('renders data-row-kind and data-depth host attributes matching renderRow()', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow({ kind: 'row', depth: 2 }));
    fixture.detectChanges();

    const rowElement = getRowElement(fixture);
    expect(rowElement.getAttribute('data-row-kind')).toBe('row');
    expect(rowElement.getAttribute('data-depth')).toBe('2');
  });

  it('keeps computeds and host bindings reactive when renderRow is updated post-init', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(
      mockDataRenderRow({ id: 'row-1', kind: 'row', depth: 0 }),
    );
    fixture.detectChanges();

    const directive = getDirective(fixture);
    const rowElement = getRowElement(fixture);

    expect(directive.rowId()).toBe('row-1');
    expect(directive.isGroupHeader()).toBe(false);
    expect(rowElement.getAttribute('data-row-kind')).toBe('row');
    expect(rowElement.getAttribute('data-depth')).toBe('0');

    // Simulates CDK virtual scroll recycling the <tr> with a new renderRow input
    // rather than creating a fresh directive instance.
    fixture.componentInstance.renderRow.set(mockGroupRenderRow({ id: 'group-9', depth: 3 }));
    fixture.detectChanges();

    expect(directive.rowId()).toBe('group-9');
    expect(directive.isGroupHeader()).toBe(true);
    expect(rowElement.getAttribute('data-row-kind')).toBe('group');
    expect(rowElement.getAttribute('data-depth')).toBe('3');
  });

  it('sets role="row" and derives aria-rowindex from renderRow().index (ADR-0005)', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow({ index: 2 }));
    fixture.detectChanges();

    const rowElement = getRowElement(fixture);
    expect(rowElement.getAttribute('role')).toBe('row');
    // aria-rowindex is 1-based; renderRow().index is the 0-based array position.
    expect(rowElement.getAttribute('aria-rowindex')).toBe('3');
  });

  it('sets --ngp-table-row-depth to depth and follows a depth change on the same row', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow({ id: 'row-1', depth: 2 }));
    fixture.detectChanges();

    const rowElement = getRowElement(fixture);
    expect(rowElement.style.getPropertyValue('--ngp-table-row-depth')).toBe('2');

    fixture.componentInstance.renderRow.set(mockDataRenderRow({ id: 'row-1', depth: 5 }));
    fixture.detectChanges();

    expect(rowElement.style.getPropertyValue('--ngp-table-row-depth')).toBe('5');
    expect(rowElement.getAttribute('data-depth')).toBe('5');
  });

  it.each([true, false, undefined])('never sets aria-expanded (isExpanded: %s)', (isExpanded) => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow({ isExpanded }));
    fixture.detectChanges();

    expect(getRowElement(fixture).hasAttribute('aria-expanded')).toBe(false);
  });

  it('resolves NGP_TABLE_ROW to the host directive instance for descendants', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockDataRenderRow());
    fixture.detectChanges();

    const directive = getDirective(fixture);
    const probe = getProbe(fixture);

    expect(probe.resolvedRow).toBe(directive);
    expect(probe.resolvedRow.rowId()).toBe(directive.rowId());
  });
});
