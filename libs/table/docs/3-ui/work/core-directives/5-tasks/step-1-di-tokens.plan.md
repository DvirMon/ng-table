# Step 1: DI tokens

## PR scope

`table.tokens.ts` — `NGP_TABLE_STORE` and `NGP_TABLE_ROW` injection tokens.

## Task type

code

## Skills used

angular-developer

## Scaffolding agent

angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/table.tokens.ts` (new)

## Why This Step Exists

Both `NgpTableDirective` and `NgpTableRowDirective` (Steps 2, 3) self-provide under these tokens and every descendant directive injects them. Tokens must exist before either directive can reference them, and splitting them into their own file avoids a circular import between the two directive files.

## What To Do

Create `table.tokens.ts` with two `InjectionToken`s, typed against the directive classes that will provide them:

```ts
import { InjectionToken } from '@angular/core';

import type { NgpTableDirective } from './ngp-table.directive';
import type { NgpTableRowDirective } from './ngp-table-row.directive';

export const NGP_TABLE_STORE = new InjectionToken<NgpTableDirective>('NGP_TABLE_STORE');
export const NGP_TABLE_ROW = new InjectionToken<NgpTableRowDirective>('NGP_TABLE_ROW');
```

Use `import type` for the directive class references — this file only needs the types, not the runtime classes, which keeps the token file free of a circular runtime dependency with Steps 2/3.

## Implementation Notes

- Per `docs/3-ui/directives/core.md`, the token generic is the **directive class**, not `TableStore<TRow>` / `RenderRow<TRow>` directly — descendants inject the directive and call `.store()` / read `.renderRow()` off it.
- No `any`/`unknown` here — the tokens are typed against concrete directive classes.

## Risks / Watchouts

- `import type` only — a value import here would create a real circular dependency once Steps 2/3 import these tokens back.

## Non-Goals

- No directive logic in this file — tokens only.

## Acceptance Checks

- [ ] `table.tokens.ts` exports `NGP_TABLE_STORE: InjectionToken<NgpTableDirective>`
- [ ] `table.tokens.ts` exports `NGP_TABLE_ROW: InjectionToken<NgpTableRowDirective>`
- [ ] Both directive imports use `import type`
- [ ] `nx typecheck shared-design-system` passes

---

[Step 2: NgpTableDirective](step-2-ngp-table-directive.plan.md) →
