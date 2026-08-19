---
status: accepted
supersedes: "ARCHITECTURE_Overview.md §Store Lifecycle & Scope (class + DI-provider factory)"
---

# `createTable()` returns a store instance, not an injectable class

## Context

The first `createTable()` returned an `@Injectable`-compatible **class** (an `@ngrx/signals`
signal store). Consuming it took three steps: register it in a component's `providers: []`,
`inject()` it, then push rows with `store.setData()`. It also could not be created at the
component field level with the data already in hand — data always arrived after injection.

## Decision

`createTable(data, optsFn, options?)` now returns a live store **instance**, created at the
call site inside an Angular injection context. Modeled on Angular Signal Forms'
`form(model, schemaFn)` and TanStack Table's `injectTable(() => options)`:

```ts
protected readonly data  = signal(people);
protected readonly table = createTable(this.data, () => ({
  trackBy: 'id',
  columns,
  features: [withSorting<Person>()],
}));
```

- **Single API.** The class-returning factory is removed, not kept alongside — no dual surface
  to maintain at the store or (future) UI layer.
- **Engine unchanged.** `@ngrx/signals` still composes the store internally
  (`buildStoreClass()`); only the outer wrapper changed. The internal implementation stays
  swappable without a breaking change. *(Superseded 2026-08-11 by
  [ADR-0003](0003-in-house-table-store-engine.md): the engine is now the in-house
  `composeTable()` and `buildStoreClass()` is gone. The swappability claim held — the swap
  landed with zero consumer diff. The instance-factory decision this ADR records still stands.)*
- **`optsFn()` runs once** at construction — `trackBy` / `columns` / `features` are structural,
  mirroring `form()`'s single `rootCompile`. Only `data` is reactive: an internal `effect()`
  re-runs `setData()` whenever the source emits.
- **`setData()` stays public** as an imperative escape hatch (server-driven pushes, tests).
- **DI wiring is internal.** A child `Injector.create({ providers: [StoreClass], parent })`
  gives the signal store the context its constructor needs, so the consumer never touches
  `providers: []`. An optional `options.injector` supports use outside an injection context
  (services, tests), the same escape hatch `form()` exposes. *(Superseded 2026-08-11 by
  ADR-0003: there is no store class, so the child injector is gone —
  `runInInjectionContext(injector, …)` supplies the context instead. `options.injector` is
  unchanged.)*

## Consequences

- **Ownership = the calling context.** A component field ⇒ component-scoped, torn down with the
  component via that injector's `DestroyRef`. This is the already-recommended default.
- **Trade accepted: no route/`root` DI-provider scoping.** There is no DI token to place at a
  route or provide in `root`, so table state is no longer shareable across components through
  DI. Component-scoped is the only built-in scope. Accepted as low-value versus the DX win.
- **UI/directive-to-store connection** (how UI-layer directives reach the instance) is left to
  the separate UI-directive spec — an instance has no DI token, so directives will receive it
  by input/host-directive rather than injecting it.
- Consumers construct via `createTable(data, optsFn)` in a field initializer / constructor;
  tests via `TestBed.runInInjectionContext(() => createTable(...))`.
