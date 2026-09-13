import type { EditRow } from './types';

const SAVE_LATENCY_MS = 700;
const FOCUSABLE_SELECTOR =
  'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';

/** Pessimistic-save stand-in (S2, S5): the row stays open for the whole round trip. Rejects a
 * blank name so the failure path is reachable without an external mock. */
export function saveRowPessimistic(row: EditRow): Promise<EditRow> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (row.name.trim() === '') {
        reject(new Error(`Rejected: "${row.dept}" row needs a name.`));
        return;
      }
      resolve(row);
    }, SAVE_LATENCY_MS);
  });
}

/** Keeps Tab/Shift+Tab inside `container`'s focusable elements while an editing row's `<tr>` has
 * focus (§1.6) — wraps from the last element back to the first (and vice versa) instead of
 * fighting Angular's default tab order. Simplest-correct: it does not trap focus that enters via
 * a click, only Tab/Shift+Tab at the row's boundary. */
export function containFocusTab(event: KeyboardEvent, container: HTMLElement): void {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((element) => !element.hasAttribute('disabled'));
  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = container.ownerDocument.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
