import {
  classifyCellWidgets,
  isOwnTabindexWrite,
  removeFromTabOrder,
  restoreTabOrder,
  writeTabindex,
} from './cell-widgets';
import type { CellWidgetKind } from './cell-widgets.types';

function cellWith(html: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.innerHTML = html;
  return td;
}

describe('removeFromTabOrder / restoreTabOrder', () => {
  it("restores each descendant's original tabindex after it was marked twice", () => {
    const td = cellWith('<button></button><span tabindex="0"></span><input tabindex="2">');
    const button = td.querySelector('button')!;
    const span = td.querySelector('span')!;
    const input = td.querySelector('input')!;

    removeFromTabOrder(td);
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(span.getAttribute('tabindex')).toBe('-1');
    expect(input.getAttribute('tabindex')).toBe('-1');

    removeFromTabOrder(td);
    restoreTabOrder(td);

    expect(button.hasAttribute('tabindex')).toBe(false);
    expect(span.getAttribute('tabindex')).toBe('0');
    expect(input.getAttribute('tabindex')).toBe('2');
    expect(td.hasAttribute('tabindex')).toBe(false);
  });
});

describe('classifyCellWidgets', () => {
  it.each([
    ['plain text', 'just text', 'none'],
    ['a lone disabled button', '<button disabled>x</button>', 'none'],
    ['a button', '<button>x</button>', 'single'],
    ['a checkbox', '<input type="checkbox">', 'single'],
    ['a radio', '<input type="radio">', 'single'],
    ['a switch', '<button role="switch">x</button>', 'single'],
    ['a link', '<a href="#">x</a>', 'single'],
    [
      'a tree toggle plus a checkbox',
      '<button tabindex="-1" aria-hidden="true">+</button><input type="checkbox">',
      'single',
    ],
    ['a hidden input plus a button', '<input type="hidden"><button>x</button>', 'single'],
    [
      'an aria-hidden link plus a button',
      '<a href="#" aria-hidden="true">x</a><button>x</button>',
      'single',
    ],
  ] as [string, string, CellWidgetKind][])(
    'classifies a cell holding %s as %s',
    (_name, html, kind) => {
      const td = cellWith(html);

      expect(classifyCellWidgets(td)).toBe(kind);

      removeFromTabOrder(td);
      expect(classifyCellWidgets(td)).toBe(kind);
    },
  );

  it.each([
    ['a text input', '<input type="text">'],
    ['an input with no type', '<input>'],
    ['a textarea', '<textarea></textarea>'],
    ['a select', '<select><option>a</option></select>'],
    ['a contenteditable div', '<div contenteditable="true">x</div>'],
    ['a button and a checkbox', '<button>x</button><input type="checkbox">'],
    [
      'a nested grid',
      '<table role="grid"><tbody><tr><td tabindex="0">a</td><td tabindex="-1">b</td></tr></tbody></table>',
    ],
    ['a focusable listbox', '<div role="listbox" tabindex="0">x</div>'],
  ])('classifies a cell holding %s as composite', (_name, html) => {
    expect(classifyCellWidgets(cellWith(html))).toBe('composite');
  });
});

describe('classifyCellWidgets with hidden controls', () => {
  it.each([
    ['a hidden-attribute button', '<button hidden>x</button>'],
    ['a display:none button', '<button style="display:none">x</button>'],
    ['a hidden-attribute checkbox', '<input type="checkbox" hidden>'],
    ['a button inside a hidden wrapper', '<span hidden><button>x</button></span>'],
  ])('ignores %s next to a visible checkbox', (_name, hiddenHtml) => {
    const td = cellWith(`<input type="checkbox">${hiddenHtml}`);

    expect(classifyCellWidgets(td)).toBe('single');
  });
});

describe('isOwnTabindexWrite with writes that produce no record', () => {
  it('does not mistake a later binding write for an own write', async () => {
    const button = document.createElement('button');
    writeTabindex(button, '-1');

    const observer = new MutationObserver(() => undefined);
    observer.observe(button, { attributes: true, attributeFilter: ['tabindex'] });
    button.setAttribute('tabindex', '3');
    const records = observer.takeRecords();
    observer.disconnect();

    expect(records).toHaveLength(1);
    expect(isOwnTabindexWrite(records[0])).toBe(false);
  });
});
