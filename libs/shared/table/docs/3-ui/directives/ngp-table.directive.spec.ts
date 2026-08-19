import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { createMockTableStore } from '../../../table.mock';
import { NGP_TABLE_STORE } from '../../../directives/tokens';
import type { TableStore } from '../../../api/types';

@Component({
  selector: '[host-probe]',
  template: '',
})
class HostProbeComponent {
  readonly resolvedStore = inject(NGP_TABLE_STORE);
}

function isHostProbeComponent(value: unknown): value is HostProbeComponent {
  return value instanceof HostProbeComponent;
}

@Component({
  imports: [NgpTableDirective, HostProbeComponent],
  template: `<table [ngpTable]="store"><tbody><tr host-probe></tr></tbody></table>`,
})
class HostComponent {
  store!: TableStore<unknown>;
}

function getDirective(fixture: ReturnType<typeof TestBed.createComponent>): NgpTableDirective {
  return fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(NgpTableDirective, null) !== null
  ).injector.get(NgpTableDirective);
}

function getProbe(fixture: ReturnType<typeof TestBed.createComponent>): HostProbeComponent {
  const componentInstance: unknown = fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(HostProbeComponent, null) !== null
  ).componentInstance;
  if (!isHostProbeComponent(componentInstance)) {
    throw new Error('Expected HostProbeComponent instance');
  }
  return componentInstance;
}

function getTableElement(fixture: ReturnType<typeof TestBed.createComponent>): HTMLElement {
  const nativeElement: unknown = fixture.debugElement.query(
    (debugEl) => debugEl.injector.get(NgpTableDirective, null) !== null
  ).nativeElement;
  if (!(nativeElement instanceof HTMLElement)) {
    throw new Error('Expected an HTMLElement');
  }
  return nativeElement;
}

describe('NgpTableDirective', () => {
  it('exposes the bound store instance via the store input', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const store = createMockTableStore();
    fixture.componentInstance.store = store;
    fixture.detectChanges();

    expect(getDirective(fixture).store()).toBe(store);
  });

  it('resolves NGP_TABLE_STORE to the host directive instance for descendants', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const store = createMockTableStore();
    fixture.componentInstance.store = store;
    fixture.detectChanges();

    const directive = getDirective(fixture);
    const probe = getProbe(fixture);

    expect(probe.resolvedStore).toBe(directive);
    expect(probe.resolvedStore.store()).toBe(store);
  });

  it('sets role="table" and derives aria-rowcount/aria-colcount from the store (ADR-0005)', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
    });
    const fixture = TestBed.createComponent(HostComponent);
    const store = createMockTableStore();
    fixture.componentInstance.store = store;
    fixture.detectChanges();

    const tableElement = getTableElement(fixture);
    expect(tableElement.getAttribute('role')).toBe('table');
    expect(tableElement.getAttribute('aria-rowcount')).toBe('0');
    expect(tableElement.getAttribute('aria-colcount')).toBe('0');
  });
});
