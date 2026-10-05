# Step 5: NgpTableDirective spec

## PR scope

`ngp-table.directive.spec.ts` — unit tests for the store-anchor directive.

## Task type

test

## Depends on: Step 2

## Skills used

unit-test

## Scaffolding agent

test-implementer

## Files

- `libs/shared/design-system/src/ui/table/docs/3-ui/directives/ngp-table.directive.spec.ts` (new)

Per `table/CLAUDE.md` — structural/directive tests live under `docs/3-ui/directives/`, not colocated with the directive source (unlike store/feature logic specs, which stay flat next to their source file).

## Why This Step Exists

`NgpTableDirective` is the sole mechanism getting the store instance into DI — a DI-wiring bug here breaks every descendant directive silently (they'd get `null`/throw on inject, not a type error). Worth locking down directly rather than relying on downstream directive tests to catch it indirectly.

## What To Do

Cover, per the `unit-test` skill's selection policy — behavior, not structure:

- `store` input receives the bound `TableStore` instance and is readable via the input signal.
- A descendant that injects `NGP_TABLE_STORE` resolves to the host `NgpTableDirective` instance (`useExisting` wiring works), and `.store()` on it returns the same instance that was bound.

Use a minimal host test component with `<table [ngpTable]="table">` and a nested element injecting `NGP_TABLE_STORE`, per Angular directive-testing convention (`TestBed.createComponent` + a test host, not `TestBed.runInInjectionContext` in isolation — this directive's whole job is DI wiring, which needs a real component tree to exercise).

## Implementation Notes

- Mock/stub `TableStore<unknown>` minimally — this test does not need a real `createTable()` instance, just an object shape satisfying the type for identity checks.

## Risks / Watchouts

- Don't assert on `TableStore` internals (e.g. `columns()`/`rows()` values) — that's `table.store.spec.ts`'s job, not this directive's.

## Non-Goals

- No test for `ngpTableRow` (Step 6) or feature directives from later issues.

## Acceptance Checks

- [ ] Test confirms `store` input is bound and readable
- [ ] Test confirms `NGP_TABLE_STORE` resolves to the directive instance via DI
- [ ] `nx test shared-design-system` passes for this spec

---

← [Step 4: Barrel exports](step-4-barrel-exports.plan.md) | [Step 6: NgpTableRowDirective spec](step-6-ngp-table-row-directive-spec.plan.md) →
