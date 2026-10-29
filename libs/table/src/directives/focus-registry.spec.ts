import { createFocusRegistry } from './focus-registry';

describe('createFocusRegistry header cells', () => {
  it('keeps a header cell and a body cell of the same column apart', () => {
    const registry = createFocusRegistry();
    const boundary = document.createElement('table');
    const bodyEl = document.createElement('td');
    const headerEl = document.createElement('th');
    const headerChild = document.createElement('button');
    headerEl.appendChild(headerChild);
    boundary.append(bodyEl, headerEl);

    const bodyCell = { rowId: 1, columnId: 'name' };
    const headerCell = { area: 'header', columnId: 'name' } as const;
    registry.register(bodyCell, bodyEl);
    registry.register(headerCell, headerEl);

    expect(registry.elementOf(bodyCell)).toBe(bodyEl);
    expect(registry.elementOf(headerCell)).toBe(headerEl);
    expect(registry.cellContaining(headerChild, boundary)).toEqual(headerCell);
    expect(registry.cellContaining(bodyEl, boundary)).toEqual(bodyCell);
  });
});
