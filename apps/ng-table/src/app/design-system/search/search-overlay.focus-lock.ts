/**
 * Body-scroll lock + focus save/restore pair for `search-overlay`'s open/close lifecycle.
 * `openFocusLock` captures the currently-focused element and locks scroll; `closeFocusLock`
 * restores both. Caller owns when to invoke each (the overlay's `open()` effect).
 */
export interface FocusLockState {
  previouslyFocused: HTMLElement | null;
  previousBodyOverflow: string;
}

export function openFocusLock(): FocusLockState {
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return { previouslyFocused, previousBodyOverflow };
}

export function closeFocusLock(state: FocusLockState): void {
  document.body.style.overflow = state.previousBodyOverflow;
  state.previouslyFocused?.focus();
}
