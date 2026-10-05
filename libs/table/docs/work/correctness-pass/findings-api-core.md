# Correctness pass — API core

**Date:** 2026-09-24 · Scope: `libs/table/src/api/*.ts`
(`create-table.ts`, `create-table.overloads.ts`, `types.ts`,
`create-columns.ts`, `create-table-feature.ts`),
`api/features/compose-features.ts` (+ its generated overloads),
`api/features/with-computed.ts`, the editing state model — which lives
at `api/features/editing/state.ts`, **not** `api/features/editing-state.ts`
as `CLAUDE.md` says — and `libs/table/src/index.ts`. Criteria:
`libs/table/CLAUDE.md`, ADR-0003, ADR-0007, ADR-0014 incl. its
2026-09-24 amendment.

---

## 1. `withComputed` types a returned `WritableSignal` as writable, but hands back a read-only `computed`

`api/features/with-computed.ts:48` (declared signature), `:49-55`
(implementation), `:79`.

`wrapDerivedMembers<D extends DerivedDict>(declared: D): D` declares
that the returned dictionary keeps `D`'s element types. The
implementation replaces every value with a fresh `computed()`
(`wrapDerivedSignal`, `:31-40`), which has no `set`, `update` or
`asReadonly`. `DerivedDict` is `Record<string, Signal<unknown>>`, and
`WritableSignal<T>` is assignable to `Signal<unknown>`, so `D` infers
with the writable type intact and it reaches the store member type
through `Feature<In, D>` → `O1` in `create-table.overloads.ts`.

```ts
protected readonly table = createTable(
  this.data,
  { trackBy: 'id', columns },
  withComputed(() => ({ query: signal('') })),
);

this.table.query.set('abc');
// compiles — table.query is typed WritableSignal<string>
// runtime: TypeError — table.query.set is not a function
```

The same crash arrives through the two shapes most likely in a derive
block: `linkedSignal(...)` and `resource(...).value`, both
`WritableSignal`. Every _read_ works, so it only surfaces at the first
write.

The intent isn't in dispute — the file's JSDoc (`:59-62`) and ADR-0014's
amendment both say the members reaching the store are read-only. The
type is what doesn't say so: it returns `D` where the runtime produces
`{ [K in keyof D]: Signal<ReturnType<D[K]>> }`. Not covered by
`with-computed.spec.ts`, which never declares a writable signal in a
block.

---

## 2. A non-object return from a `withComputed` block throws a bare `TypeError`, outside the ADR-0014 construction message

`api/features/with-computed.ts:17` (`Object.entries(dict)`), reached
from `:77`.

`assertDerivedSignals` exists specifically for "a JavaScript consumer
defeats the `DerivedDict` constraint" (`:14-15`). It calls
`Object.entries` before testing that it got an object, and it runs
_outside_ the `try` at `:67-75` that produces the
`[createTable] withComputed block threw while declaring its members`
error.

```js
createTable(
  data,
  config,
  withComputed(() => {
    if (!somethingReady) return; // undefined
    return { total: computed(() => 1) };
  }),
);
```

Result: `TypeError: Cannot convert undefined or null to object`, no
`[createTable]` prefix, no `cause`, thrown from inside `composeTable`'s
fold. ADR-0014's amendment names both construction messages this path
should produce; neither fires.

Second, narrower hole on the same line: `Object.entries` reads own
enumerable string keys only, so a block returning an object whose
signals sit on the prototype passes the check and then contributes zero
members — `wrapDerivedMembers` rebuilds from the same `Object.entries`,
so the declared members vanish silently rather than being rejected.

---

## 3. `withComputed`'s construction checks are not gated to dev builds

`api/features/with-computed.ts:18-22` and `:70-74`.

ADR-0014's 2026-09-24 amendment rules construction-time checks are gated
to dev and stripped from production; `engine/columns.ts:17,51`
implements that pattern. `withComputed`'s two construction throws run
unconditionally. Conformance, not a crash — no consumer-visible wrong
answer follows. Recorded because the amendment names these two checks by
their message text. The same gap exists at `create-table-feature.ts:115`
and `engine/slots.ts:73` (out of scope), so this is a repo-wide
un-implemented ADR rather than an api-core defect.

---

## 4. Adjacent, out of scope: `removeEdit` arms a `'delete'` restore point with a stale position

`mutations/optimistic-mutations.ts:142-152`. Included because it breaks
an invariant the editing state model documents
(`api/features/editing/state.ts:27-30`: `at` is the index "at capture
time … read only when the row is missing at revert"), and the brief
asked for restore points that revive at the wrong position.

`removeEdit` resolves the row's _current_ index into `at` (`:142`), then
discards it when a restore point is already held, keeping `held.at`
instead (`:150-152`). `revertEdit` re-inserts at that index because the
row is missing (`:99`).

```ts
// r5 sits at index 5 of a 10-row table
table.editing.update(captureEdit('r5')); // snapshot at: 5
table.value.update(removeRow('r0')); // r5 is now index 4
table.editing.update(removeEdit('r5')); // snapshot keeps at: 5
table.editing.update(revertEdit('r5')); // re-inserts at index 5
```

`r5` reappears one slot below where it was removed from.
`clampSpliceIndex` (`mutations/row-mutations.ts:6-10`) keeps it from
throwing, so the only symptom is a row in the wrong place after a failed
delete.

---

## Files checked and clean

**`api/create-table.ts`** — `config.injector ?? inject(Injector)`
short-circuits correctly, so the `inject()` assertion fires only on the
in-context path. `resolveColumnsConfig` is the one call made outside
`runInInjectionContext`, and it reaches no DI
(`engine/columns-schema/resolve.ts` is pure); `wireColumnsSchemaAsync`
is evaluated inside the context arrow, which its `resource()` wiring
needs. Internal features go on the separate `internalFeatures` channel,
so consumer argument positions in collision messages are not shifted.

**`api/create-table.overloads.ts`** — matches
`tools/generate-overloads.ts` exactly (`ARITY = 15`,
`includeZeroFeature: true` → 16 signatures, slot _k_ typed against
base ∩ O1…O(k-1)). No generator/output divergence.

**`api/features/compose-features.overloads.ts`** — same generator,
`includeZeroFeature: false`, so `composeFeatures()` with no arguments
matches no overload; the runtime accepts it and returns an inert
`{ members: {} }`.

**`api/types.ts`** — `TableStore`'s key set matches `CORE_MEMBER_KEYS`
under `exhaustiveCoreMemberKeys`, with `totalRowCount` the single
excluded override point. `ReadonlyStore`'s
`WritableView<infer T, any>` arm also matches a bare `WritableSignal`
(it satisfies `{ (): T; update(u: any): void }`), so `withRowEdit()`'s
`draft` reads as `Signal<TRow[]>` inside a derive block — stricter than
runtime, the safe direction.

**`api/create-columns.ts`** — clean.

**`api/create-table-feature.ts`** — `mergeMembers` throws on a
feature/derive-block key clash before the merged object reaches the
fold, keeping `SlotRegistry` the single collision authority (ADR-0007's
amendment). `mergeDerivedSpec` sets the four pipeline-behaviour keys
explicitly, including to `undefined`, and every consumer tests
truthiness or `!== undefined`, so a feature built _with_ a derive block
can itself serve _as_ one without a false throw.

**`api/features/compose-features.ts`** — clean on collisions, checked in
both directions: inner-vs-inner via the private per-fold `SlotRegistry`
with `claimCoreMembers()` (labelled `composeFeatures inner feature N`);
inner-vs-outer in either order, because the composite re-declares the
merged `members`/`stages`/`renderStages` and the outer fold claims them
again; `withOptimistic()` + `withRowEdit()` collide on
`editing`/`pending`/`pendingOps`/`unconfirmed` in either order and with
either nested. Keys with no content are omitted rather than emitted as
`{}` (`:124-155`), which is what lets a composite of `withComputed()`
blocks pass `mergeDerivedSpec`'s guard. A composite is safe to reuse —
fresh registry and fresh `innerStore` per call. The `Object.create(input)`
inner store keeps the documented seam: own properties are earlier inner
features, prototype is the outer store, so a deferred read still sees
later top-level slots.

**`api/features/editing/state.ts`** — each `createEditingStore` call
builds its own signal, views and computeds; the only module-level shared
values are the immutable `NO_IDS`/`NO_OPS` sentinels, so the two
features share nothing. `onRowsRemoved` (`:244-260`) keeps the
`op: 'delete'` exemption on `snapshots` and carries the same exemption
to `unconfirmed` by reading the already-pruned `nextSnapshots`, so the
two cannot disagree; `pruneByIds`' overloads resolve as intended (value
predicate for the Map, id predicate for the Set) and return the same
reference when nothing changed, so the guard at `:253-259` suppresses a
no-op write. `open ⊆ snapshots` survives every path: `open` only
shrinks, and an id kept by the delete exemption is never open
(`removeEdit` clears it); `closeAll` drops only open rows' restore
points. The delete-rollback ordering also holds — an updater's
`writeData` runs synchronously inside `editing.update`, but
`compose-table.ts`'s removal-diff `effect` is scheduled, so the
`'delete'` snapshot is applied before the prune runs.

**`index.ts`** — nothing `CLAUDE.md` marks internal is exported: no
`createEditingStore`, no `composeTable`, no `SlotRegistry`, no
`TableCore`. The `api/types.ts` ↔ `engine/types.ts` cycle is
`import type` on both sides (`api/types.ts:3`, `engine/types.ts:2`), as
is `api/types.ts` → `engine/writable-view.ts` — the build-breaking
value-import form has not appeared. `export * from './api/features/with-sorting'`
and the `with-filtering` barrel surface only their feature function and
public config/member types.

One nameability note, not a defect: the publicly exported
`AnyTableFeature` is `Feature<any, any>` and `TableStore.value` is a
`WritableView<…>`, but neither `Feature` nor `WritableView` is
re-exported from `index.ts`. Both resolve in emitted `.d.ts` (the engine
files ship), so nothing breaks — a consumer simply cannot write the
annotation by name.
