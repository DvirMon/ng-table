import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, type FieldTree } from '@angular/forms/signals';

import { NgpTableRowFieldDirective } from './ngp-table-row-field.directive';
import type { MockRow } from '../table.mock';
import type { RenderRow } from '../api/types';

/**
 * `mockDataRenderRow`/`mockGroupRenderRow` (`table.mock.ts`) are typed `RenderRow<unknown>` —
 * reused across directive specs with unrelated row shapes. This spec is the one place that
 * needs a concrete `RenderRow<MockRow>`, so it builds fixtures directly rather than casting
 * the shared mock.
 */
function mockRow(overrides: Partial<RenderRow<MockRow>> = {}): RenderRow<MockRow> {
  return {
    id: 'row-1',
    depth: 0,
    kind: 'row',
    data: { id: 1, name: 'Ada' },
    index: 0,
    cells: {},
    ...overrides,
  };
}

function mockGroupRow(overrides: Partial<RenderRow<MockRow>> = {}): RenderRow<MockRow> {
  return {
    id: 'group-1',
    depth: 1,
    kind: 'group',
    data: null,
    index: 0,
    cells: {},
    ...overrides,
  };
}

@Component({
  imports: [NgpTableRowFieldDirective],
  template: `
    <table>
      <tbody>
        <tr
          *ngpTableRowField="renderRow(); from: rowsForm; let field"
          [attr.data-name]="field.name().value()"
        >
          field-rendered
        </tr>
      </tbody>
    </table>
  `,
})
class HostComponent {
  readonly rows: WritableSignal<MockRow[]> = signal<MockRow[]>([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bea' },
  ]);
  readonly rowsForm: FieldTree<MockRow[]> = form(this.rows);
  readonly renderRow: WritableSignal<RenderRow<MockRow>> = signal(mockRow({ sourceIndex: 0 }));
}

function queryRowElement(fixture: ReturnType<typeof TestBed.createComponent>): HTMLElement | null {
  return fixture.nativeElement.querySelector('tr');
}

describe('NgpTableRowFieldDirective', () => {
  it('renders the embedded view and resolves the FieldTree node when sourceIndex is defined', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const rowElement = queryRowElement(fixture);
    expect(rowElement).not.toBeNull();
    expect(rowElement?.getAttribute('data-name')).toBe('Ada');
  });

  it('renders nothing when sourceIndex is undefined (a synthesized group row)', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.renderRow.set(mockGroupRow());
    fixture.detectChanges();

    expect(queryRowElement(fixture)).toBeNull();
  });

  it('re-resolves to the new field node when sourceIndex changes', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(queryRowElement(fixture)?.getAttribute('data-name')).toBe('Ada');

    fixture.componentInstance.renderRow.set(mockRow({ sourceIndex: 1 }));
    fixture.detectChanges();

    expect(queryRowElement(fixture)?.getAttribute('data-name')).toBe('Bea');
  });

  it('tears down the view when sourceIndex transitions from defined to undefined', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect(queryRowElement(fixture)).not.toBeNull();

    fixture.componentInstance.renderRow.set(mockGroupRow());
    fixture.detectChanges();

    expect(queryRowElement(fixture)).toBeNull();
  });
});
