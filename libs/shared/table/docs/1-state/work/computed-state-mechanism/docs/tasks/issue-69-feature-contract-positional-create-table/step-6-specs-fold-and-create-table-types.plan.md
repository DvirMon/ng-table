---
title: "Step 6 — compose-table.spec.ts + create-table.spec.ts: fold runtime, positional runtime, type assertions"
type: task-step
issue: 69
---

# Step 6 — `compose-table.spec.ts` + `create-table.spec.ts`: fold runtime, positional runtime, type assertions

**PR scope:** The two seams the spec names ("Testing Decisions"), both existing files. Runtime
cases plus the new-in-kind type-assertion cases. Every feature composed in these specs is a
**synthetic** one built with `createTableFeature()` — the shipped `with-*` features are not
converted until #72–#74, so real-feature composition is asserted at #77.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 4, Step 5 (Step 3 transitively)
**Parallel-safe with:** —

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/compose-table.spec.ts` (edit)
- `libs/shared/table/src/api/create-table.spec.ts` (edit — rewrite the thunk-form fixtures;
  add positional runtime + type cases)

## Why This Step Exists

Spec "Testing Decisions": assert what a consumer observes — members exposed, values produced,
errors thrown at construction — never how the fold is implemented. The payload of #69 is
type-level, so the type seam is where most new assertions land; the three silent-`any` traps
each need a regression assertion that fails loudly if a future edit reintroduces one.

## What To Do

### `compose-table.spec.ts` — fold runtime (issue AC, last bullet)

Adapt/add, all with one-argument factories:

1. Several features fold in order, each seeing prior members on the store it is handed
   (factory-time read of an earlier member is defined; of a later member is `undefined`).
2. A deferred read (inside a member function) of a *later* feature's member is defined —
   runtime "types are stricter" truth (D25).
3. `setup` hooks run after the whole composition (existing case — keep).
4. ADR-0006 removal reconciliation still prunes ids after the fold rewrite (existing describe —
   keep, verify it still passes with the new call shape).
5. `onDestroy` hooks unchanged (existing — keep).
6. `store.indexById` is present at factory time and maps id → position.
7. Internal features still receive the core handle: an internal feature reading
   `core.baseColumns` gets a signal (regression for the split in Step 3).

### `create-table.spec.ts` — runtime

Rewrite `makeStore()` to the positional form. Then:

8. `createTable(data, { trackBy: 'id', columns })` — existing trackBy/rows/renderRows cases
   ported 1:1.
9. `config.injector` — construct **outside** `TestBed.runInInjectionContext` with
   `injector: TestBed.inject(Injector)`; store composes.
10. `columnsSchema` inline function and standalone `columnSchema()` value both apply (a
    `applyVisible` rule is enough to observe).
11. Two synthetic features: second reads the first's member; composed store exposes both.
12. Synthetic feature built with `createTableFeature(factory, block)`: the store exposes the
    block's member; the block observed the feature's own member at construction.
13. A member-less synthetic feature composes and adds nothing.

### `create-table.spec.ts` — types (`expectTypeOf` from `vitest`)

Fixtures: `interface Invoice { id: string; total: number; status: 'paid' | 'open' }`, two or
three synthetic features via `createTableFeature` with distinct members (`a: Signal<number>`,
`b(): void`, a config callback typed `(row: RowOf<In>) => boolean`).

14. **Zero type args**: `createTable(data, config, fA(), fB())` — `expectTypeOf(table).toMatchTypeOf<TableStore<Invoice>>()`, members `a`, `b` present with their exact types.
15. **Row type flows**: a synthetic feature's `(row) => row.status === 'open'` callback compiles
    with `row: Invoice` — assert via `expectTypeOf(row).toEqualTypeOf<Invoice>()` inside the
    callback.
16. **Not `any`**: `expectTypeOf(table).not.toBeAny()` on the multi-feature composition — the
    umbrella regression for all three traps.
17. **Trap 1** (wildcard in constraint's derived slot): compose a feature declared with
    `Feature<any, any>` next to a typed one; assert the typed one's member is still exactly
    typed (not `any`).
18. **Trap 2** (omitted optional callback → constraint): `createTableFeature(factory)` with no
    block — `expectTypeOf(table).not.toHaveProperty('__index')`; stricter:
    `expectTypeOf<keyof typeof table>().toEqualTypeOf<'a' | keyof TableStore<Invoice>>()`.
19. **Trap 3** (intersection return): asserted at #70 where `withComputed` exists; leave a
    one-line `it.todo` naming it so the seam is visible.
20. **Later-slot read is a compile error**: `// @ts-expect-error` on a slot-1 feature reading
    slot-2's member.
21. **Uncomposed member absent**: `expectTypeOf(table).not.toHaveProperty('c')`.
22. **16th feature**: `// @ts-expect-error` on a 16-argument call (build the 15 with a loop of
    identical synthetic features is not possible positionally — write them out; it is one
    test).
23. **`{}` not `object`**: member-less feature composed — `expectTypeOf(table).toEqualTypeOf<TableStore<Invoice> & { a: Signal<number> }>()` (an `& object` would fail `toEqualTypeOf`).
24. **`indexById` read-only**: `// @ts-expect-error` on `table.indexById = ...`; type is
    `Signal<ReadonlyMap<RowId, number>>`.
25. **`ReadonlyStore`**: `expectTypeOf<ReadonlyStore<TableStore<Invoice>>['value']>().toEqualTypeOf<Signal<Invoice[]>>()` — `.update` gone; a method member passes through unchanged.

## Implementation Notes

- **The vitest executor does not typecheck.** `expectTypeOf` and `@ts-expect-error` are only
  enforced by `tsc -p libs/shared/table/tsconfig.spec.json --noEmit`. State this in a comment
  at the top of the type `describe` block, and list that command in the PR as the verification
  step. Do not add a vitest `typecheck` mode in this step.
- `@ts-expect-error` lines must sit immediately above the offending expression; a
  multi-line call needs the directive on the line before the argument that errs.
- Synthetic features live in the spec file (fixtures), not in `*.mock.ts` — they are
  test-only shapes with no demo value.
- Existing `compose-table.spec.ts` "base store before the fold" describe (#68) stays as-is
  apart from factory arity.

## Risks / Watchouts

- Shipped feature specs (`with-*.spec.ts`) stay red until #72–#74 — do not touch them here.
- `expectTypeOf(...).toEqualTypeOf` on intersections can be order-sensitive in error output
  but not in pass/fail; if a case flakes on intersection ordering, switch to
  `toMatchTypeOf` + a `keyof` equality assertion.

## Non-Goals

- No real-feature composition tests (#77). No `withComputed`/`composeFeatures` cases (#70,
  #71). No story updates (#75).

## Acceptance Checks

- [ ] Every runtime case above passes under the lib's `test` target for these two files.
- [ ] `tsc -p libs/shared/table/tsconfig.spec.json --noEmit` passes for the two spec files
      (other red files excluded or acknowledged in the PR).
- [ ] Removing the `IsAny` guard in Step 5 makes case 18 fail; restoring it passes.
- [ ] Case 22 fails to compile if `ARITY` is raised to 16 and the output regenerated
      (documented, not automated).

---
← [Step 5: create-table-feature.ts — derive plumbing](step-5-create-table-feature-derive-plumbing.plan.md)
