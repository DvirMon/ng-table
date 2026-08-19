# Step 3 — NgpTableRowDirective

**PR scope:** `ngp-table-row.directive.ts` — row identity anchor directive.

**Task type:** code
**Stack:** angular

**Depends on:** Step 1

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Files:**
- `libs/shared/design-system/src/ui/table/ngp-table-row.directive.ts` (new)

## Why This Step Exists

Row-scoped feature directives (selection, expansion, drag-drop — later issues) need the row's identity without each taking a duplicate input. `NgpTableRowDirective` carries the `RenderRow` and republishes it under `NGP_TABLE_ROW`, so descendants inject the row directive instead of binding it again. Unblocks all row-scoped feature directives per the issue.

## What To Do

Implement per `core.md`'s `ngpTableRow` spec, verbatim:

```ts
import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { NGP_TABLE_ROW } from './table.tokens';
import type { RenderRow, RowId } from './table.types';

@Directive({
  selector: 'tr[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    '[attr.data-row-kind]': 'renderRow().kind',
    '[attr.data-depth]': 'renderRow().depth',
  },
})
export class NgpTableRowDirective {
  readonly renderRow: InputSignal<RenderRow<unknown>> = input.required<RenderRow<unknown>>({
    alias: 'ngpTableRow',
  });

  readonly rowId: Signal<RowId> = computed(() => this.renderRow().id);
  readonly isGroupHeader: Signal<boolean> = computed(() => this.renderRow().kind === 'group');
}
```

## Implementation Notes

- Binds `RenderRow<TRow>`, not raw `TRow` and not a bare `RowId` — `RenderRow` is the only shape that can represent synthetic group-header rows (`id` synthesized, `data: null`). See `core.md` — "Why `RenderRow` and not the row object".
- `unknown` row type at the boundary, same rationale as Step 2's `NgpTableDirective`.
- `data-row-kind` / `data-depth` host bindings follow `styling-tokens.md`'s state-as-`data-*` convention — do not add a CSS class binding instead.
- `isGroupHeader` is in the architecture spec even though the issue checklist doesn't list it by name — it's part of the same computed block and feeds `grouping.md`'s (future) group-row rendering. Include it now rather than adding it as a later patch.
- Header `<tr>` (inside `<thead>`) carries no `ngpTableRow` at all — nothing to implement for that case, just don't add a sentinel/optional `RenderRow` to accommodate it.

## Risks / Watchouts

- Do not make `renderRow` optional or give it a default — header rows simply omit the directive entirely; a sentinel value would be a lie the type system can't catch (explicit architecture rejection).
- Keep `rowId` / `isGroupHeader` as `computed`, not plain getters — they must stay reactive to `renderRow` changes (e.g. CDK virtual scroll recycling `<tr>` nodes with a new `renderRow` input).

## Non-Goals

- No `ngpTableColumn` (Issue 02) or `ngpTableCell` (Issue 03).
- No grouping-specific rendering logic — `isGroupHeader` is exposed here only; consuming it is `grouping.md`'s concern, not this issue's.

## Acceptance Checks

- [ ] Selector is `tr[ngpTableRow]`
- [ ] `renderRow` input is required, aliased to `ngpTableRow`, typed `RenderRow<unknown>`
- [ ] `rowId` computed from `renderRow().id`
- [ ] `isGroupHeader` computed from `renderRow().kind === 'group'`
- [ ] Host bindings `data-row-kind` / `data-depth` present
- [ ] Self-provides via `useExisting` under `NGP_TABLE_ROW`
- [ ] No `any` at the injection boundary
- [ ] Typecheck passes

---
← [Step 2: NgpTableDirective](step-2-ngp-table-directive.plan.md) | [Step 4: Barrel exports](step-4-barrel-exports.plan.md) →
