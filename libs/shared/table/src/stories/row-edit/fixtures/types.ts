export interface EditRow {
  id: string;
  name: string;
  dept: string;
}

/** Which round-trip shape `gated-edit/`'s Save follows — pessimistic keeps the row open through
 * `saveRowPessimistic`; optimistic closes it immediately (`endEdit`) and reconciles after a real
 * `fetch` (D31/S4). Shared between the story host and `.stories.ts`' argTypes. */
export type SaveMode = 'pessimistic' | 'optimistic';
