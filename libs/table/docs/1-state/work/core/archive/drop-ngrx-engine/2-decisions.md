# Decisions — drop the `@ngrx/signals` engine

**Landed:** 2026-08-11. Outcome recorded permanently in
[ADR-0003](../../../../../adr/0003-in-house-table-store-engine.md).

## Open questions from `1-ticket.md`

**1. Is publishing as a standalone library actually planned?**
Not answered, and it didn't need to be — driver 1 (Angular upgrades gated on ngrx releases)
carried the decision on its own. The engine is internal either way: not exported from
`index.ts`, no public surface.

**2. Rebuild compile-time feature-input checking, or drop it?**
Neither — the premise was wrong. See "Corrections" below. Each feature annotates its own
factory parameter (`Pick<TableCore<TRow>, 'rows' | 'trackBy'>`), which is exactly the checking
that was actually in force. A typed fold over the `Features` tuple was considered and declined:
it would catch a feature depending on another feature that isn't composed, and zero features
have such a dependency.

**3. Does this need its own ADR?**
Yes. ADR-0003.

## Additional decisions taken during planning

| Decision | Choice |
|---|---|
| Engine API shape | Clean-slate, not a 1:1 ngrx mirror |
| Composition mechanism | Features **declare** `{ members, stages, renderRows, onInit, onDestroy }`; the engine wires them. Not shared-object mutation |
| Composition directions | Both kept — `core` (feature-to-core) and `composed` (feature-to-feature, untyped, unused today) |
| Engine scope | Table-specific, not a general-purpose signal store |
| `<TRow>` repetition fix | Deferred to a follow-up |
| `features: (ctx) => [...]` | Deferred — see ADR-0003, "Deferred" |

The `(ctx) => [...]` shape was the closest call. It is now *possible* (the phantom-placeholder
blocker recorded in `1-state/architecture.md` dissolved with the class-based engine), and its
gains are DX plus one real correctness win — a mismatched `withExpansion<Person>()` on a
`Department` table currently compiles. It was declined because it half-closes the
feature-to-feature seam: with every spec built inside one expression, `composed` is always empty
at factory time. Tree-shaking is identical either way; the belief that the `features` array was
required for tree-shaking was mistaken — the array was required by ngrx's composition model.

## Corrections to `1-ticket.md`

1. **"Spec files also use these and will need the same treatment" — false.** All five spec files
   drive the store only through the public `createTable()`. They passed **unmodified** (61 tests),
   which became the migration's acceptance gate.
2. **"Compile-time feature-input checking… the single piece most likely to be underestimated" —
   it was not in force.** `table.store.ts:172-188` cast every feature to
   `SignalStoreFeature<any, any>` to fold a dynamic-length array, erasing the declared Input.
   Nothing was lost.
3. **"Prototype the engine against `withExpansion()` only" — skipped.** It would have required the
   in-house engine and ngrx to interoperate mid-migration. Four files; migrated together.
4. **"`_buildRenderRows` … verify before removing it" — removed.** The engine passes one stable
   store object and keeps the builder as a closure variable, so both the `.current` container and
   the `_buildRenderRows` store member are gone.

## Definition of done — result

| Criterion | Result |
|---|---|
| No `@ngrx/signals` import under `src/ui/table/` | ✅ (remaining mentions are historical prose in comments/docs) |
| `@ngrx/signals` removed from `package.json` | ✅ |
| `npx tsc -p apps/demo/tsconfig.app.json --noEmit` clean | ✅ |
| Existing specs pass unmodified | ✅ 61 passing, zero spec edits; 73 total with `table.engine.spec.ts` added |
| Demo apps unchanged | ✅ `git diff apps/demo` empty |

`npx nx build demo` fails, but on a **pre-existing, unrelated** misconfiguration: the
`shared-design-system` library declares `"projectType": "library"` while its build target uses
`@angular/build:application`, which demands an `index.html` that has never existed in git history.
Reproduced identically on a clean tree.
