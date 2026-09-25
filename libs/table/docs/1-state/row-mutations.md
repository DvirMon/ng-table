---
title: State Layer Reference — Row Mutations
type: architecture
version: 1.1
date: 2026-09-09
status: shipped — issue #12; `moveRow` and selection-gated bulk (`removeRow`/`patchRow`) deferred
  (D19/D32). `insertRow`/`createRow` widened arity (bulk-add) shipped 2026-09-05.
audience: developers
parent: ./architecture.md
---

# Row Mutations

## Executive Summary

How rows in a table change. **Core API, not a `with-*()` feature** (D8) — every table can
mutate its rows, because `createTable()` already requires a writable source (D4), so a feature
flag would gate nothing.

One generic write plus pure updater factories (D5): `table.value.update(updater)`. Three
updaters ship — `insertRow`, `removeRow`, `patchRow` — and a raw lambda is always accepted, so an
unshipped updater costs a consumer one inline function.

Consumers who never edit still use this: a Delete button (D18, editing decisions), a server
push, a bulk action. Editing builds on top of it and is specced separately in
[`features/row-editing.md`](./features/row-editing.md).

Decision log: [`work/row-editing/archive/with-mutations/2-decisions.md`](./work/row-editing/archive/with-mutations/2-decisions.md).

## Data Contract

```ts
const data  = signal<Person[]>(people);          // WritableSignal — required (D4)
const table = createTable(data, { trackBy: 'id', columns });
```

`data` is the **single source of truth** (D3/D11). The engine keeps no internal row copy, so
there is nothing to drift and no re-emit that can silently overwrite a local mutation. The
pipeline reads it directly: `rows = computed(() => runPipeline(data(), stages))`.

`WritableSignal<TRow[]>` is required **unconditionally** — one data shape for every table,
read-only or editable (D4). A read-only table fed by `computed()`, `resource()`, or
`httpResource()` cannot pass that source directly; copy into a writable signal first.

Two write paths, split by scope:

| Scope | Call |
|---|---|
| whole set | `data.set(rows)` — the consumer's own signal (D7) |
| rows within it | `table.value.update(updater)` (D30) |

There is no `setData()`. With no internal row set, there is nothing for it to write.

## The Write Surface

`table.value` is a `WritableView<TRow[], RowUpdater<TRow>>` (D30) — `()` to read, `.update()`
to write, the shape of a `WritableSignal`:

```ts
table.value.update(insertRow(newRow, { at: 0 }));
table.value.update(patchRow('42', { status: 'done' }));
table.value.update(removeRow('42'));
table.value.update((rows) => rows.filter((r) => !r.stale));   // raw lambda, always allowed
```

Named `value`, not `data`: `data` is the input parameter's name (`createTable(data, config)`),
`value` is the store member — matching Signal Forms, where `field().value` is the write surface
and the model variable keeps its own name. `columns` and `editing` are sibling slices, not
sub-paths of `value`.

### `RowUpdater<TRow>`

```ts
type RowUpdater<TRow> = (rows: TRow[], ctx: { trackBy: TrackByFn<TRow> }) => TRow[];
```

Whole-array in, whole-array out. Updaters are free, pure functions — tree-shakeable and
unit-testable without a store (D6). `.update()` supplies `trackBy` so id-based updaters resolve
identity without holding a store reference.

Two consequences worth carrying: single-row updaters are the *narrow* case of this type, not the
general one (which is why bulk is arity, not new verbs — D32); and a raw lambda satisfies it by
ignoring `ctx`.

## Shipped Updaters

| Updater | Signature | Notes |
|---|---|---|
| `insertRow` | `insertRow(row \| row[], { at?: number })` | splice semantics, never throws — see below. Array overload (D32, shipped 2026-09-05) inserts every row as one contiguous block in one write |
| `removeRow` | `removeRow(id: RowId)` | filters by `trackBy` |
| `patchRow` | `patchRow(id: RowId, partial: Partial<TRow>)` | shallow spread over the matched row |

**Why exactly these three** (D19): the bar for shipping an updater is *error-proneness*, not
convenience — it earns its place when hand-rolling it needs `trackBy` resolution or index math.
All three clear it, and all three have a real caller: `patchRow` is the save path and the
row-actions path, `removeRow` is delete, `insertRow({ at: 0 })` is the add-blank-row flow.

### `at` — splice semantics (D27)

`insertRow(row, { at })` behaves exactly as `Array.prototype.splice(at, 0, row)`.

| `at` | Behavior |
|---|---|
| omitted | append |
| in range | insert **before** the row currently at that index |
| `>= length` | clamped to append |
| negative | counts from the end — `-1` inserts before the last row |
| `< -length` | clamped to prepend |

**Never throws.** An index computed from an async result can legitimately go stale; clamping
degrades to a cosmetic misplacement instead of a crash.

**Do not call this "`at()` semantics" in consumer docs.** `at(-1)` *returns* the last element;
`splice(-1, 0, x)` inserts *before* it. They disagree, and insertion follows `splice`.

The add-blank-row flow passes `{ at: 0 }` explicitly rather than relying on the default —
append puts the new row off-screen in a long table.

### Storage position is not display position

All writes land in `data`. The pipeline reads `data` and produces `renderRows()`. Under an
active sort these are unrelated orderings, and sort *replaces* storage order rather than
adjusting it — so **no value of `at` can place a row at a chosen display position.** This is not
a mapping waiting to be solved; it is unrepresentable in storage coordinates.

| Caller intent | Mechanism it actually needs |
|---|---|
| index into the underlying array | `at` — well defined always, rarely what a user means |
| "top of what I'm looking at" | pinning — sort exemption plus a held position |

The second intent is the editing cluster's "don't move the row I'm editing", resolved there by
D24's commit boundary rather than by pipeline exemption. See
[`features/row-editing.md`](./features/row-editing.md).

**Related concern, not a mutation concern — closed:** where a *blank* row lands under an active
sort is decided by how the comparator treats `""`/`null`. That position used to flip with sort
direction; the null-ordering contract shipped 2026-08-27 (`nulls: 'last'` by default, `''`
treated as a real value unless opted out via `sortNulls`), so a blank row now holds a
predictable position in both directions. See
[`features/sorting.md`](./features/sorting.md) ("Null / Empty Value Ordering").

## Row Identity and the Temp-Id Swap (D26)

A row added before the server assigns an id carries a **consumer-supplied** temporary id. The
library never fabricates one:

```ts
table.value.update(insertRow({ id: crypto.randomUUID(), name: '', dept: '' }, { at: 0 }));
```

The library *cannot* fabricate one: `trackBy` is `keyof TRow | ((row) => RowId)`, and when it is
a function there is no field the engine knows how to write, so a generated id has nowhere to
live. Fabricating would mean the engine owning row identity — which `trackBy` explicitly
delegates.

When the server's id replaces the temp id, everything keyed by `RowId` is affected:

| Keyed by `RowId` | Effect of the swap |
|---|---|
| `editing` / `pending` maps | entry orphaned under the old key — the row silently leaves edit mode |
| `@for (… track row.id)` | Angular destroys and recreates the `<tr>`; focus inside it is lost |
| expansion, future selection | same orphaning |
| `sourceIndex` | self-correcting — `indexById` is a `computed` over `data` |

**Recommended save order**, which makes the orphaning harmless:

```ts
const saved = await this.service.save(row);
table.editing.update(endEdit(row.id));         // exit edit under the OLD id first
table.value.update(patchRow(row.id, saved));   // then swap in the server's id
```

Nothing is keyed by the temp id when it disappears, and the `<tr>` teardown happens on a row
that no longer holds focus.

**Not enforced.** Whether the table should detect an orphaned key and migrate it is **O20**,
open. This order is documentation, not a guarantee — and the optimistic-save path (D31) does not
follow it, which is [G3 in the gap register](./work/row-editing/active/with-row-editing/5-gaps.md).

## Mutation Meets the Pipeline (D9)

`table.value.update(...)` writes to `data`, which is the pipeline's input. A row added while a
filter is active can be filtered straight back out; under an active sort it can land off-screen.
From the user's seat: "I clicked Add and nothing appeared."

**No special handling in the write path.** The pipeline stays authoritative and the fixed stage
order is untouched. Pinning belongs with editing, where the add-a-blank-row-then-fill-it flow
actually lives — resolved there as D24/D25.

## Not Shipped

| Deferred | Reason | Shape already settled |
|---|---|---|
| `moveRow(id, to)` | no v1 caller — sorting owns order, `withDragDrop()` is unshipped | no |
| `batch(...updaters)` | no v1 flow batches two row writes | yes — D32 |
| bulk `removeRow(id[])` / `patchRow(id[], partial)` | unblocked by `withSelection()` (shipped), not yet built | yes — D32 |

**Bulk is widened arity plus `batch()`; "bulk" never enters the API** (D32). It is a product
word for the UI affordance, not an API word. Plural verbs (`removeRows`) were rejected — the
shape falls out of `RowUpdater` already being whole-array.

**`insertRow`'s and `createRow`'s widened arity shipped 2026-09-05** — the create side of D32,
answering the bulk-add question: a consumer opens N new rows in one call
(`createRow([{ id, row }, …], { at })`, `mutations/row-edit-mutations.ts`) instead of looping N
single-row `createRow` calls, and it resolves in one `data` write / one `{ snapshots, open }`
transition, not N. `removeRow`/`patchRow` stay unshipped — they're the bulk-*edit*/bulk-*delete*
half, unblocked by `withSelection()` (shipped) but not yet built, as tabled above.

`batch()` earns its place beyond tidiness: one `data` emission means one pipeline run, one
`indexById` rebuild, and one undo step, instead of N of each.

Whoever builds bulk *edit* resolves D31.2 first — it implies `multiple: true`, which combined
with optimistic save is explicitly undesigned.

## Open Questions

- [ ] **O6** — does a `rowsChanged` event fire, or is the signal the only notification? Decide
      together with O11 (editing).
- [x] ~~**O8** — compile-time feature dependencies have no mechanism post-migration~~ —
      **closed by #33.** A feature's input is `Feature<In extends Shape, Out>`, so a dependency is
      expressed as an F-bounded input slice (`Pick<TableStore<RowOf<In>>, 'columns'> & Shape`) and
      is typed by argument order. `Record<string, unknown>` survives only as the engine-internal
      folding store, which no feature signature sees. There is still no *runtime* dependency
      assertion. Engine-wide, not specific to mutations.
- [ ] **O20** — on an id swap, does the table enforce the end-edit-first order, detect an
      orphaned key and migrate it, or just document the sequence? See G3 in the gap register.

---

## Competitive position

**Verdict: ahead** — TanStack, Material React Table and PrimeNG ship no transaction or patch API
at all (mutation is consumer-owned there), and while the updater verbs plus ADR-0006 removal
reconciliation are comparable in intent to AG Grid's `applyTransaction`, they are narrower in scope
— no batch or async variant yet.

Full reasoning: [gap-analysis.md](./work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
