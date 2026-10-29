import { isRtlAt, pageStepOf } from './page-step';

function pin(el: HTMLElement, prop: 'clientHeight' | 'offsetHeight', value: number): void {
  Object.defineProperty(el, prop, { value, configurable: true });
}

function box(overflowY: string | null, clientHeight: number): HTMLElement {
  const el = document.createElement('div');
  if (overflowY) el.style.overflowY = overflowY;
  pin(el, 'clientHeight', clientHeight);
  return el;
}

function cellOf(offsetHeight: number): HTMLElement {
  const el = document.createElement('div');
  pin(el, 'offsetHeight', offsetHeight);
  return el;
}

describe('pageStepOf', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('returns the number of whole rows that fit in the scrollable host', () => {
    const host = box('auto', 300);
    const cell = cellOf(40);
    host.append(cell);
    document.body.append(host);

    expect(pageStepOf(host, cell)).toBe(7);
  });

  it('measures the nearest scrollable ancestor of the host', () => {
    const outer = box('auto', 1000);
    const inner = box('scroll', 200);
    const host = box(null, 900);
    const cell = cellOf(40);
    host.append(cell);
    inner.append(host);
    outer.append(inner);
    document.body.append(outer);

    expect(pageStepOf(host, cell)).toBe(5);
  });

  it('falls back to 10 when no scroll container exists', () => {
    const host = box(null, 300);
    const cell = cellOf(40);
    host.append(cell);
    document.body.append(host);

    expect(pageStepOf(host, cell)).toBe(10);
  });

  it.each([
    ['container', 0, 40],
    ['row', 300, 0],
  ])('falls back to 10 when the %s height is 0', (_name, containerHeight, rowHeight) => {
    const host = box('auto', containerHeight);
    const cell = cellOf(rowHeight);
    host.append(cell);
    document.body.append(host);

    expect(pageStepOf(host, cell)).toBe(10);
  });

  it('returns at least 1 when the container is shorter than a row', () => {
    const host = box('auto', 30);
    const cell = cellOf(40);
    host.append(cell);
    document.body.append(host);

    expect(pageStepOf(host, cell)).toBe(1);
  });
});

describe('isRtlAt', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('reads the host direction at call time', () => {
    const host = document.createElement('div');
    document.body.append(host);

    expect(isRtlAt(host)).toBe(false);
    host.style.direction = 'rtl';
    expect(isRtlAt(host)).toBe(true);
    host.style.direction = 'ltr';
    expect(isRtlAt(host)).toBe(false);
  });
});
