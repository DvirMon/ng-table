# Research — the callable-slice shape, and what Signal Forms actually does

**For:** [ADR-0015](../../../adr/0015-feature-member-namespacing.md) (proposed — feature member
namespacing). **Date:** 2026-09-11. **Verified against:** `@angular/core` / `@angular/forms`
22.1.2, installed in `node_modules/` — not from an unreleased branch, not from memory.

## Why this file exists

ADR-0015 lists a callable slice object as Option 4 and dismisses the Angular Signal Forms analogy
that prompted it:

> Note the Angular Signal Forms analogy that prompted this is **not** precedent: `field.errors()`
> is state hanging off a callable, not a function of an argument.

**That dismissal is factually wrong**, and it is the load-bearing sentence keeping Option 4
un-weighed. This file replaces it with what the shipped types say.

## Finding 1 — Signal Forms *does* put functions-of-an-argument on a callable slice

`FieldTree` (`node_modules/@angular/forms/types/_structure-chunk.d.ts:1153`), trimmed:

```ts
type FieldTree<TModel, TKey, TMode> =
    (() => FieldStateByMode<TModel, TKey, TMode>)                // call  → the state object
  & (TModel extends Record<string, any> ? Subfields<TModel, TMode> : object);  // props → child fields
```

`FieldState` (`:1375`) — the thing `field()` returns — carries **both** state signals and behavior
functions that take arguments:

| Member | Kind |
|---|---|
| `value: WritableSignal<TValue>`, `errors`, `valid`, `pending`, `touched` | state |
| `getError(kind: string)` | **function of an argument** |
| `metadata<M>(key: MetadataKey<M>)`, `hasMetadata(key)` | **function of an argument** |
| `markAsTouched(options?)`, `focusBoundControl(options?)` | behavior |

So the analogy holds. `field().getError('required')` and `field().metadata(key)` are exactly the
class of member ADR-0015 says the precedent does not cover. The ADR's objection should be struck
and replaced with the disagreement below, which is the real one.

## Finding 2 — but Signal Forms puts behavior on the *called result*, and acme puts it on the *callable*

The two conventions are mirror images, and only one of them is acme's:

| | Call `x()` returns | Behavior lives on |
|---|---|---|
| Signal Forms `FieldTree` | a **state object** (`FieldState`) | the called result — `field().getError(k)` |
| acme `WritableView` (D30) | the **raw value** (`string[]`) | the **callable** — `table.grouping.update(u)` |
| | property access = child-field navigation | property access = behavior |

`engine/writable-view.ts`:

```ts
export interface WritableView<T, Updater> {
  (): T;
  update(updater: Updater): void;
}
// Object.assign(computed(read), { update: applyUpdater })
```

Signal Forms' layout is driven by a constraint acme does not have: a form field is a **tree**, so
property access is reserved for navigating to children (`field.address.street`), which forces state
and behavior together onto the called result. A table slice has no children to navigate to, so
property access is free — and D30 already spent it on `update()`.

**Consequence: do not import Signal Forms' layout.** Cite it as precedent for *a slice being a
callable that carries functions of an argument* — which it is — and nothing further. Where those
functions go is already answered by `.update()`.

## Finding 2b — the callable-with-methods shape is Angular's *mainline* convention, not a Forms quirk

`signal()` itself is built this way (`node_modules/@angular/core/fesm2022/_pending_tasks-chunk.mjs:2769`):

```js
function signal(initialValue, options) {
  const [get, set, update] = createSignal(initialValue, options?.equal);
  const signalFn = get;                                   // a plain function
  signalFn.set = set;                                     // ...with methods bolted on
  signalFn.update = update;
  signalFn.asReadonly = signalAsReadonlyFn.bind(signalFn);
  return signalFn;
}
```

Same shape, three more times in the same package:

| Primitive | Call `x()` returns | Members on the callable |
|---|---|---|
| `signal()` | the value | `set`, `update`, `asReadonly`, `[SIGNAL]` |
| `model()` (`core.mjs:186`) | the value | `set`, `update`, `asReadonly`, **`subscribe`**, **`destroyRef`** |
| `input()` (`core.mjs:181`) | n/a — `input` is itself a fn | **`required`** |
| acme `WritableView` | the value | `update` |

**`model()` is the decisive precedent.** Its callable carries `subscribe` and `destroyRef` —
members that are not "write the value" and not even state. Angular already treats the callable as a
general namespace for everything belonging to that reactive cell, not strictly a write surface. So
`table.grouping.rowIdsOf(g)` is not an extension of the convention; it is the convention.

This also re-ranks Finding 2. Signal Forms' `FieldTree` layout (behavior on the *called result*) is
the **exception**, forced by needing property access for child navigation. Mainline Angular —
`signal`, `model`, `input` — puts members on the **callable**, which is what acme already does. The
`writable-view.ts` JSDoc says so explicitly:

> Built the same way Angular's own `signal()` is built — `Object.assign` onto a real `computed()`.

## Finding 3 — `table.grouping` is already a callable slice; Option 4 is not a new shape

`api/features/with-grouping.ts:16` ships today as:

```ts
readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
```

`table.grouping()` already returns state. `table.grouping.update(...)` already writes. Adding
`rowIdsOf` is one more key in the same `Object.assign` — no new mechanism, no new concept for a
consumer to learn, and it reuses the shape four shipped members already use (`value`, `columns`,
`editing`, `grouping`).

That reframes ADR-0015's cost table. Option 4 is not "adopt a callable slice"; it is **"stop
treating `.update()` as the only thing allowed on the slice acme already ships."**

## Finding 4 — the D37 objection dissolves, because the namespace is the *slice*, not the *feature*

ADR-0015 frames the obstacle as:

> Under namespacing, `table.rowEdit.editing` and `table.optimistic.editing` are different doors,
> and the consumer must know which feature is underneath.

That is true of **feature** namespacing (Options 2 and 3). It is not true of Option 4, because the
callable slice is keyed by **state slice**, and D37 already guarantees one slice per concern:

> Both expose the same member, `table.editing` — one door for the consumer regardless of which
> feature is composed. `withRowEdit` does not re-expose a second `table.optimistic` slice.

So `table.editing.captureEdit(id)` is reached through the same single door `table.editing()` is,
whether the consumer composed `withOptimistic()` or `withRowEdit()`. **Option 4 does not have to
overturn D37; D37's guarantee is what makes it work.** The ADR's "the objection that must be
answered" section applies to Options 2 and 3 only, and should say so.

This also inverts the migration story. Options 2/3 break four shipped features. Option 4 breaks
none — a flat `table.toggleSort()` and a sliced `table.sorting.toggle()` can coexist indefinitely,
because they are different member keys and ADR-0007's claim registry already prevents them from
colliding.

## Finding 5 — there is no cross-slice verb, and that is structural

Raised as an open question, then closed: *which slice owns a verb needing two features?* No such
verb exists, because **every slice's currency is a core type**.

Group selection is the case that looked hardest, and it is already solved in shipped code
(`api/features/with-selection.ts:34`):

```ts
selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all';
```

Tri-state group-header checkbox, both directions, with no library verb spanning two features:

```ts
table.selectionStateOf(table.grouping.rowIdsOf(group));   // read  — 'none' | 'some' | 'all'
table.select(table.grouping.rowIdsOf(group));             // write
```

Grouping emits `RowId[]`; selection consumes `RowId[]`; neither imports the other. The consumer
owns the cascade — which is what `rowIdsOf` was designed for
(`0-product/grouping.md` §X-G1, OQ-1).

**The invariant that makes this hold.** Every public verb takes and returns a type from
`api/types.ts` — `RowId`, `RenderRow<TRow>`, `ColumnId<TRow>`. Feature-declared types are confined
to their own slice's own operations and are never a handoff between features:

| Feature-declared type | Used as |
|---|---|
| `SelectionWriteOptions`, `ExpansionWriteOptions` | that slice's own write options |
| `EditingUpdater<TRow>`, `GroupingUpdater<TRow>` | that slice's own `update()` argument |
| `PendingOp`, `RowSnapshot<TRow>` | that slice's own read shape |

So slice A's output is always expressible as slice B's input, and any "cross-slice" behavior
decomposes into two single-slice calls at the consumer's call site.

**State this in ADR-0015 as a consequence, not implicitly.** It breaks the moment a feature wants
a *feature-private* type as another feature's argument — then no handoff exists and the ownership
question returns. Nothing does that today; keeping it that way is the condition under which
single-slice namespacing is sufficient.

## What is still genuinely open

Finding 4 removes the stated obstacle; Finding 5 closes the first open question. Two remain:

1. **What does a feature with no callable slice hang verbs on?** Sharpened by Finding 5, because
   selection is exactly that case: `selectedRows` is a bare `Signal`, not a `WritableView`, so
   `table.selection` does not exist. `selectionStateOf(ids)` is flat-named and reads as a core
   capability — ADR-0015's original complaint, already in shipped code. Option 4 wants
   `table.selection.stateOf(ids)`, which means promoting `selectedRows` to a callable slice first.
2. **Is the flat surface deprecated or grandfathered?** D30 already grandfathers `withSorting()`'s
   bare `toggleSort`/`setSorting`/`clearSorting` as pre-D30. Permanent grandfathering is a stable
   two-convention surface; deprecation is the migration Option 3 was rejected for.

## Corrections ADR-0015 needs regardless of which option wins

- Strike the Signal Forms dismissal in Option 4 (Finding 1) — replace with Finding 2's real
  distinction.
- Move "The objection that must be answered" under Options 2/3 (Finding 4).
- Option 4 currently reads as speculative; it is the shape four members already ship (Finding 3).
