# Architecture — shared collapsible core (#209)

Spec: [`2-spec.md`](2-spec.md). Decisions: [`1-decisions.md`](1-decisions.md).
Evidence: [`discovery-core-composition.md`](discovery-core-composition.md),
[`discovery-shared-directive-prior-art.md`](discovery-shared-directive-prior-art.md).

## Settled — not open for relitigation

| # | Decision | Source |
|---|---|---|
| 1 | Core holds only logic identical in both features; branching stays in the feature | D1 |
| 2 | Core contract: `isOpen: Signal<boolean>` + `toggle(): void`, supplied by the feature; core reaches no store | D2, D4 |
| 3 | Core binds `type="button"` (dynamic, wins over consumer `type`), `(click)`, `aria-expanded` `'true'/'false'`, `data-expanded` `''/null` | D2, D7, D11 |
| 4 | Mechanism: selectorless abstract `@Directive()`, one level deep, feature toggles `extends` it (CDK `CdkMenuTriggerBase` shape) | D10 |
| 5 | Core is not exported from `libs/table/src/index.ts` | D10, ADR-0004 |
| 6 | Tree toggle keeps disabled branch + `withTree()` dev throw; loses leaf `aria-expanded` omission and nameless warning | D9, TR47, TR48 |
| 7 | Whole-row click, `until-found`, label text: out | D5, D0, D8 |

## Current source (grounding)

- `libs/table/src/directives/ngp-table-tree-toggle.directive.ts` —
  host block binds `(click)`, `aria-expanded` (null on leaf),
  `data-expanded`, `disabled`, `aria-hidden`, `data-disabled`;
  `isLeaf`/`isOpen`/`ariaExpanded` computeds from
  `NGP_TABLE_ROW.ngpTableRow()`; constructor runs
  `assertTreeComposed` and `warnWhenNameless` (`afterNextRender` +
  `console.warn`).
- `libs/table/src/directives/table.tokens.ts` — `NGP_TABLE_STORE`,
  `NGP_TABLE_ROW` (types erased to `unknown`).
- `libs/table/src/index.ts` — the only barrel; exports each
  `directives/*.directive.ts` file explicitly (`export *`).
- `libs/table/project.json` — project `shared-table`; `build` uses
  `@angular/build:application`; no `ng-package.json`, so NG3001 /
  flat-module checks do not run today.
- No `hostDirectives`, `abstract class` or directive `extends` exists
  in `libs/table/src` yet — this is the first.

## Types and contracts

New file `libs/table/src/directives/ngp-table-collapsible-trigger.directive.ts`:

```ts
import { Directive, type Signal } from '@angular/core';

// Internal — not in index.ts. Shared by every row toggle
// (#209 D1): only bindings identical across features live here.
@Directive({
  host: {
    // Dynamic, not static: a static host attr loses to the
    // consumer's own `type` (#209 D11).
    '[attr.type]': '"button"',
    '(click)': 'toggle()',
    '[attr.aria-expanded]': 'isOpen() ? "true" : "false"',
    '[attr.data-expanded]': 'isOpen() ? "" : null',
  },
})
export abstract class NgpTableCollapsibleTrigger {
  protected abstract readonly isOpen: Signal<boolean>;
  protected abstract toggle(): void;
}
```

Tree toggle after the retrofit (shape, not final code):

```ts
@Directive({
  selector: 'button[ngpTableTreeToggle]',
  host: {
    '[attr.disabled]': 'isLeaf() ? "" : null',
    '[attr.aria-hidden]': 'isLeaf() ? "true" : null',
    '[attr.data-disabled]': 'isLeaf() ? "" : null',
  },
})
export class NgpTableTreeToggleDirective extends NgpTableCollapsibleTrigger {
  // row/table injection, isLeaf, isOpen as today
  protected override toggle(): void { /* table.tree.toggle(id) */ }
  constructor() { super(); assertTreeComposed(() => this.table.ngpTable()); }
}
```

Removed from the tree toggle: `ariaExpanded` computed, the
`(click)`/`aria-expanded`/`data-expanded` host entries,
`hasAccessibleName`, `warnWhenNameless`, the `ElementRef` injection
if nothing else uses it.

## File layout

| File | Change |
|---|---|
| `libs/table/src/directives/ngp-table-collapsible-trigger.directive.ts` | **new** — the abstract core above |
| `libs/table/src/directives/ngp-table-tree-toggle.directive.ts` | extend the core; drop moved bindings, `ariaExpanded`, name warning; update JSDoc |
| `libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts` | add `type` cases; leaf `aria-expanded="false"`; delete warning cases |
| `libs/table/src/index.ts` | **unchanged** — core stays out |
| `libs/table/docs/3-ui/directives/tree.md` | toggle section: type forced, leaf `aria-expanded="false"`, no warning; drop the warning test-list lines |
| `libs/table/src/stories/tree/**/*.html`, `stories/grouping/grouping-collapsible/*.html` | drop manual `type="button"` on `ngpTableTreeToggle` |

## Acceptance checks

- [ ] `nx run shared-table:typecheck` clean — proves host bindings
  calling `protected abstract` members typecheck in the base, and the
  subclass compiles. Re-run after any `.ts` error (ngc stops before
  templates).
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] Tree-toggle spec passes with the add/change/delete set in
  `2-spec.md` § Testing Decisions.
- [ ] `index.ts` has no export for the core.
- [ ] `npm run llms:check` clean.

## Traps

- **Static vs dynamic `type`.** `type: 'button'` (static host attr)
  is overridden by a consumer's `type="submit"`; it must be
  `'[attr.type]': '"button"'`.
- **Two writers.** The subclass must not re-bind `type`, `(click)`,
  `aria-expanded` or `data-expanded`; Angular lets the subclass win
  silently (CDK `CdkContextMenuTrigger` does it on purpose) — TR37 is
  a review rule, nothing enforces it.
- **`override` keyword.** Subclass members implementing abstract ones
  need `override` if `noImplicitOverride` is on.

## Open questions

- **Packaged `.d.ts`.** Whether an abstract base exported from its
  own file but absent from `index.ts` emits a clean declaration
  (no TS4020 "private name") can only be proven by an ng-packagr
  build, which the lib does not have. Not a #209 blocker; revisit
  when the lib moves to ng-packagr.
