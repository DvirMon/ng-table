# Step 5 test plan — tree-row directive (`ngpTableTreeRow`)

Step: [step-5-tree-row-directive.plan.md](step-5-tree-row-directive.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-row.directive.spec.ts`

## Stubs (red phase)
- `libs/table/src/directives/ngp-table-tree-row.directive.ts`:
  `@Directive({ selector: 'tr[ngpTableRow][ngpTableTreeRow], div[ngpTableRow][ngpTableTreeRow]', host: { '[attr.data-context-row]': 'isContextRow() ? "" : null' } }) export class NgpTableTreeRowDirective { protected readonly isContextRow: Signal<boolean> = computed((): boolean => { throw new Error('not implemented: isContextRow'); }); }`.
  The only thing that throws is the `computed` body. The selector and the host binding are in the stub, so green writes only the read of the row.
- Green writes `private readonly row = inject(NGP_TABLE_ROW, { self: true });` and `isContextRow = computed(() => this.row.ngpTableRow().isContextRow === true)`.
  - The selector already requires `ngpTableRow` on the same element, so the token always resolves.
  - Core already provides `NGP_TABLE_ROW` with `useExisting` (ngp-table-row.directive.ts:21), and nothing in `src/` reads it today.
  - A second input would let the two directives disagree about which row the element shows.
  - The class is not generic. The token erases `TRow` to `unknown`, and `isContextRow` does not depend on `TRow`.
- Add `export * from './directives/ngp-table-tree-row.directive';` to `libs/table/src/index.ts`, next to the other directive exports. This is not a stub; red can add it.

## Seams — in red-green order

Host: a test component with `<table><tbody><tr [ngpTableRow]="row()" ngpTableTreeRow>`. `row` is a `WritableSignal<RenderRow<unknown>>` built from `mockDataRenderRow()` in `table.mock.ts`, with overrides only. A `setup(overrides)` factory sets the signal and calls `detectChanges`. The query is `[role="row"]`, which the core directive sets.

### A. Row with `isContextRow: true` → `data-context-row` present with value `''`
- Test: `it('marks a context row with an empty data-context-row attribute')`
- Asserts: `rowEl.hasAttribute('data-context-row')` is `true`, and `rowEl.getAttribute('data-context-row')` is `''`.
- Why this seam: catches the directive not reading `isContextRow` from the co-located row. It also catches a truthy string such as `"true"` being written where ADR-0026 rule 1 (D18/D21) requires a presence attribute.
- Order reason: independent. It is the base case and forces the injection plus the read.

### B. Row with `isContextRow` `false` or absent → no `data-context-row`
- Test: `it.each([false, undefined])('omits data-context-row when isContextRow is %s')`
- Asserts: `rowEl.hasAttribute('data-context-row')` is `false`.
- Why this seam: catches `String(isContextRow)` or `isContextRow ?? false` reaching the attribute. Either one writes `"false"`, which is still a present attribute, so every `[data-context-row]` CSS selector would match every row. `undefined` is the value on every table without `withFiltering()`, so it must also give "absent", not `''`. Both values are one seam, parameterized.
- Order reason: builds on A.

### C. Same directive instance, row flips from context to non-context → attribute removed
- Test: `it('removes data-context-row when the same row stops being a context row')`
- Asserts:
  1. Start with `{ id: 'row-1', isContextRow: true }`; the attribute is present.
  2. `row.set({ ...same id, isContextRow: false })`, then `detectChanges`.
  3. `hasAttribute('data-context-row')` is `false`.
- Why this seam: `@for` tracks by id, so when a filter clears, the same directive instance gets a new `RenderRow` with the same id. This catches a read that takes the value once, such as `untracked`, a value saved in the constructor or a one-time `setAttribute`, instead of a reactive read through `ngpTableRow()`.
- Order reason: builds on A and B.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step. (`RenderRow.isContextRow?` belongs to step 1. The directive is not generic.)

## Not tested
- The selector does not match without `ngpTableRow` — that is Angular's selector matching.
- `role`, `data-depth`, `aria-expanded` and the other core attributes — core `ngpTableRow` is unchanged in this step, and those are not this domain's assertions.
- The `div[ngpTableRow][ngpTableTreeRow]` tag variant — same class, same binding, only a different selector branch.
- Group rows (`kind: 'group'`) — the directive has no `kind`-specific logic.
- The `index.ts` export — a re-export with no logic. The typecheck covers it.
- Styling of context rows — consumer-owned. The library only ships the attribute (D18).

## Resolved
- Inject with `{ self: true }`.
- `isContextRow` is `protected` — the attribute is the only public contract.
