/**
 * Settled outcome of a clipboard write. `idle` is both the initial state and the state the
 * directive reverts to after the confirmation hold elapses.
 *
 * Moved here from `icon-button.types.ts` (`IconButtonState`) — the state belongs to the copy
 * behavior, not to the button chrome (ADR-0005 § Corollary).
 */
export type CopyConfirmState = 'idle' | 'copied' | 'failed';

/** The two states a clipboard attempt can settle on. `idle` is never settled *into*. */
export type CopyConfirmOutcome = Exclude<CopyConfirmState, 'idle'>;
