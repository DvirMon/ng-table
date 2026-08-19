# Step 2 — NgpTableDirective

**PR scope:** `ngp-table.directive.ts` — root store-anchor directive.

**Task type:** code
**Stack:** angular

**Depends on:** Step 1

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Files:**
- `libs/shared/design-system/src/ui/table/ngp-table.directive.ts` (new)

## Why This Step Exists

`createTable()` returns a live store *instance*, not a class — there is no DI token for consumers to provide. `NgpTableDirective` is the mechanism that gets the instance into DI: it takes the instance as a required input and self-provides itself under `NGP_TABLE_STORE`, so every descendant directive can inject the token without the consumer writing any provider wiring. See `core.md` — "Store Connection Pattern".

## What To Do

Implement per `core.md`'s `ngpTable` spec, verbatim:

```ts
import { Directive, input, type InputSignal } from '@angular/core';

import { NGP_TABLE_STORE } from './table.tokens';
import type { TableStore } from './table.types';

@Directive({
  selector: 'table[ngpTable]',
  providers: [{ provide: NGP_TABLE_STORE, useExisting: NgpTableDirective }],
})
export class NgpTableDirective {
  readonly store: InputSignal<TableStore<unknown>> = input.required<TableStore<unknown>>({
    alias: 'ngpTable',
  });
}
```

## Implementation Notes

- `TableStore<unknown>` at the directive boundary is deliberate, not a gap to "fix" — directives never touch row shape, only `columns()` / `rows()` identity. Consumers keep their own narrow type on the instance they hold (see `core.md` and the ticket's deferred-questions list — do not widen this to a generic type param).
- `providers: [{ provide: NGP_TABLE_STORE, useExisting: NgpTableDirective }]` is the whole store-connection mechanism — no factory, no separate provider function.
- Explicit return type on `store` per repo TypeScript conventions (`InputSignal<TableStore<unknown>>`).

## Risks / Watchouts

- Do not add a `providers` array to any consumer `@Component` — the architecture doc explicitly rejects consumer-authored `useValue` providers as the wrong approach; the directive is the anchor, not the component.
- Do not template the store type param on the directive (e.g. `NgpTableDirective<TRow>`) — `unknown` is the committed boundary type, not a placeholder for a later generic.

## Non-Goals

- No `ngpTableCell` (Issue 03) or `ngpTableColumn` (Issue 02) — this step is `ngpTable` only.

## Acceptance Checks

- [ ] Selector is `table[ngpTable]`
- [ ] `store` input is required, aliased to `ngpTable`, typed `TableStore<unknown>`
- [ ] Self-provides via `useExisting` under `NGP_TABLE_STORE`
- [ ] No `any` at the injection boundary
- [ ] Typecheck passes

---
← [Step 1: DI tokens](step-1-di-tokens.plan.md) | [Step 3: NgpTableRowDirective](step-3-ngp-table-row-directive.plan.md) →
