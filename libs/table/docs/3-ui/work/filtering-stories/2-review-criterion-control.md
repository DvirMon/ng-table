---
title: "Review — filtering stories: CriterionControl, host-level declaration, Signal Forms"
type: review
plan: ./1-gap-analysis.md
date: 2026-09-13
---

# Review — filtering stories

Three defects raised on the shipped filtering stories. Two of them share one root cause: a
**library gap**, not a story mistake.

## D1 — `createFilters()` is hidden behind fixture factories

`fixtures/filters.ts` exports `createClientInvoiceFilters()` / `createServerInvoiceFilters()` /
`createSelectionInvoiceFilters()`; each host calls the factory in a field initializer.

`createTable()` is declared at the host (`client-filtering-story-host.component.ts:96`), with only
its *config* in `fixtures/schema.ts`. `createFilters()` should read the same way — the schema
callback is the thing a consumer writes, and hiding it one file away is the opposite of what a
story is for.

The factory layout came from `docs/tasks/step-1-filtering-fixtures-filters.plan.md`, justified as
"`createFilters()` needs an injection context (R24)". That justification does not hold: a host
field initializer **is** an injection context. The factory adds nothing an inline declaration
lacks — it only moves the declaration out of sight.

**Fix:** `createFilters<InvoiceRow, …>((path) => { … })` inline in each host. Fixtures keep rows,
option lists, table config, transport — not the filter declaration.

## D2 — `CriterionControl` re-implements a form control

`fixtures/utils.ts` defines `CriterionControl<T>` = `{ value, isActive, isDirty, set, reset }` plus
`criterionControl()`, and each factory wraps every node in one. Around it: `asText`, `asStatus`,
`asRange`, `asDateRange`, `asTagCriterion`, `asTagList`, and the five type guards they need.

That is a hand-rolled control object with dirty/active metadata, over a library that already
ships `FilterNode<TCriterion>` (`value: WritableSignal`, `active()`, `reset()`, `dirty()`).

The stated reason (`utils.ts:17-19`) is real but misdiagnosed: nodes read back as `unknown`
because the stories call `createFilters<InvoiceRow>(…)` and leave `TState` at its
`Record<string, unknown>` default. `createFilters<TRow, TState>` takes `TState` explicitly —
supply it and `filters.status()` is `FilterNode<InvoiceStatus | null>` directly. The entire
narrowing layer and the wrapper go away.

**Resolved (L2, landed).** `withFiltering()` declared `filters: Filters<TRow>` — default
`TState` only. A probe confirmed the suspected failure rather than assuming it:

```
error TS2322: Type 'Filters<Row, State>' is not assignable to type 'Filters<Row>'.
```

`WithFilteringConfig` and both `withFiltering()` overloads now carry
`TState extends Record<string, unknown> = Record<string, unknown>`. Verified by probe: typed
filters pass, `D` still infers on the derive overload, default-`TState` sets still pass
(back-compat), and `typed.status().value()` reads back as `string | null` rather than `unknown`
— which is what makes D2's deletion possible.

Two call-site constraints found while probing, both worth knowing before S1:

- **`TState` must be a `type`, not an `interface`.** An interface has no implicit index
  signature, so it fails the `Record<string, unknown>` constraint outright
  (`error TS2344: Type 'State' does not satisfy the constraint`).
- **Never pass `In` explicitly.** `withFiltering<Store>({…})` fixes `TState` to its default and
  the assignment fails again. `In` is meant to come contextually from `createTable()`, which is
  how every real call site already reads.

`keepValidCriteria()` / `STALE_SAVED_FILTER` in the client host are a *different* thing and stay:
they narrow genuinely untrusted persisted JSON, which is the story's point.

## D3 — no Signal Forms binding anywhere, and a sync effect where the docs forbid one

Client and selection hosts bind nothing through Signal Forms: every input is a template ref +
`(input)`/`(change)` calling a host method that calls `set()`, read back via `.value()` in
`[selected]`/`[value]`. The server host carries exactly one Signal Forms binding
(`[formField]="searchForm.search"`) — and it sits on a duplicate model, not on a filter node.

`filters.md` §Forms (R18) makes one form over the filter model the documented integration:

```ts
readonly filterForm = form(this.filters().value, (path) => { debounce(path.search, 300); });
```
```html
<input [formField]="filterForm.search" />
```

The server host instead holds a **second** model and syncs it:

```ts
protected readonly searchModel = signal<InvoiceFilterForm>({ search: '' });
protected readonly searchForm  = form(this.searchModel, filterFormSchema);
// …
private pushSearchFieldIntoFilters(): void {
  effect(() => { const typed = this.searchModel().search; untracked(() => this.invoiceFilters.search.set(typed)); });
}
```

Duplicated state plus a sync effect — exactly the three things R18 says the design removes
("no adapter, no sync effect, no duplicated state").

### Root cause: `filters().value` was not a `WritableSignal` — **fixed**

`buildFiltersRoot()` (`api/filters/state.ts:96`) builds it as a plain getter:

```ts
value: (): TState => { /* reads each node, returns a fresh object */ }
```

No `set`, no `update`, not a signal node. So `form(this.filters().value, …)` — the documented
call — **cannot be constructed**. The story's workarounds are downstream of that.

The spec assumed otherwise, and the task plan explicitly declined to build anything for it:

> `step-4-create-filters-core.plan.md:165` — "No `Forms`/Signal Forms integration code —
> `filters().value` being a real `WritableSignal` is what makes that free (filters.md §Forms);
> nothing extra to build for it here."

Per-node `value` **is** a real `WritableSignal`, so the gap is the root only.

**Resolution (L1, landed).** `createRootValueSignal()` in `api/filters/state.ts` builds root
`value` as a `WritableSignal<TState>`: a read composes every node, a write fans back out per key.
Nodes stay the single storage location, so nothing is copied. `FiltersRoot.value` changed from
`value(): TState` to `value: WritableSignal<TState>` — reading is still `filters().value()`, so
no existing call site moved.

Shape taken from Angular's own Signal Forms, which builds exactly this in `deepSignal`
(`Object.assign` onto a `computed()`, plus `set`/`update`/`asReadonly`) — proof that `form()`
accepts a synthesized model. `WritableSignal`'s `ɵWRITABLE_SIGNAL` brand is a type-only symbol
with no runtime counterpart, so the type is claimed by assertion; Angular is untyped at the same
spot.

`docs/1-state/filters.md` §Forms corrected: it specified the inverse structure (one root signal,
nodes as views onto its keys) on the false premise that `form()` cannot take a synthesized
object. Node-first also keeps each node's `source`/`dirty` reconciliation local to the node that
owns it instead of becoming a per-key merge the root arbitrates.

Typechecks clean on both `tsconfig.lib.json` and `tsconfig.spec.json`. **Not yet exercised at
runtime** — no spec covers a root write or a `form()` over the model.

## Sequence

```
L1 (library) root value → WritableSignal ──┐
                                           ├──> S1 hosts: inline createFilters<TRow, TState>,
L2 (library) withFiltering TState param ───┘        typed nodes, form() + [formField], drop the
                                                    sync effect
                                                 S2 delete CriterionControl + as* narrowers
```

- **L1** — ✅ done (root `value` writable).
- **L2** — ✅ done (`withFiltering()` carries `TState`).
- **S1** — ✅ done.
- **S2** — ✅ done.
- **D1** — ✅ done.

## What landed in the stories

- `fixtures/filters.ts` **deleted**. Each host declares its own
  `createFilters<InvoiceRow, …FilterState>((path) => …)` in a field initializer, directly above
  its `createTable()`. The three `.mdx` files lost the now-dead source tab.
- `CriterionControl`, `criterionControl()` and all six `as*` narrowers **deleted** from
  `fixtures/utils.ts`. Typed `TState` makes them redundant — the guards stay, because
  `keepValidCriteria()` and `formatCriterion()` narrow genuinely untrusted input.
- Three `TState` types added to `fixtures/types.ts`, as `type` aliases (an `interface` fails the
  `Record<string, unknown>` constraint).
- **Signal Forms over the criterion model.** Each host runs `form(this.filters().value)`; text,
  number and date inputs bind with `[formField]`. The server host's duplicate `searchModel` and
  its sync `effect` are gone — `serverFilterFormSchema` debounces `path.search` on the filter
  model itself, so the typing pause *is* the criterion write.

### One control stays hand-wired

Originally two. The status select was the other, and #63 closed it: the mismatch was that
`equals` declares `null` as its empty criterion while a native `<select>` can only express empty
as `''`, so a bound select wrote a value `isEmpty` did not treat as empty and the filter sat
permanently active while matching nothing. `FilterOptions.emptyValue` now lets a filter declare
what empty means — `equals(path.status, { emptyValue: '' })` — and all three hosts bind status
through plain `[formField]` with an `<option value="">`. No accessor, no adapter.

> **Mechanism changed 2026-09-16 by [#82](https://github.com/DvirMon/ng-table/issues/82); the
> outcome did not.** `emptyValue` became *additive*, so an `equals` criterion always carries the
> rule's own `null` alongside any declared empty — which a `<select>`'s `string` control value
> cannot hold. All three hosts now declare the status filter as
> `filter(path.status, matchesStatus, { emptyValue: '' })` (`matchesStatus` in
> `stories/filtering/fixtures/utils.ts`): an explicit `string` criterion, with `emptyValue: ''`
> still doing the deactivating. Plain `[formField]`, still no accessor and no adapter.

The tag multi-select stays hand-wired, and that is a property of the control, not a library gap:
a checkbox group is several elements rather than one control value, so no criterion-side choice
makes `[formField]` bind it. It writes through `filters.tags().value`.

## Follow-on found while fixing: `reset()` typed too narrowly

Typing `TState` exposed that `FiltersRoot.reset(value?)` accepted only a **complete** `TState`,
while the runtime has always applied it per key — a missing key arrives as `undefined`, which is
`reset()`, back to source. `filters.md` already documented that ("a partial load is still a
complete state"); only the type disagreed.

Widened to `reset(value?: Partial<TState> | null)`, which also removed an internal
`as Record<string, unknown>` in `buildFiltersRoot()`.

The client story's **raw** stale-snapshot button still needs one assertion, and that is left
visible on purpose: an unvalidated snapshot is not filter state, and being unable to write it
type-safely is exactly what that button demonstrates. The guarded button beside it is the
supported route and needs no assertion.

## Tracked follow-ups

| Issue | What |
|---|---|
| [#63](https://github.com/DvirMon/ng-table/issues/63) | **Closed** by `FilterOptions.emptyValue` — the status select binds through `[formField]`; the tag multi-select stays hand-wired by the control's own shape. Still closed after [#82](https://github.com/DvirMon/ng-table/issues/82), which moved the mechanism to `filter(path.status, matchesStatus, { emptyValue: '' })` — see "One control stays hand-wired" |
| [#64](https://github.com/DvirMon/ng-table/issues/64) | No runtime coverage for the writable root or `form()` over the criterion model |
| [#65](https://github.com/DvirMon/ng-table/issues/65) | Restoring a persisted snapshot has no typed entry point |
| [#66](https://github.com/DvirMon/ng-table/issues/66) | `.storybook/preview.ts` implicit-any errors |
| [#56](https://github.com/DvirMon/ng-table/issues/56) | **Closed** by L2 — typed `createFilters()` state now reaches `withFiltering()` |
| [#57](https://github.com/DvirMon/ng-table/issues/57) | Partially addressed — typed `TState` fixes property access; the `composition/derived-state` story has not adopted it |
| [#60](https://github.com/DvirMon/ng-table/issues/60) | Plain `tsc` misses template errors — hit twice in this review |

## Not verified

No runtime coverage for any of this — no spec writes through root `value`, puts a `form()` over
the filter model, or renders a host. Typechecks pass on `tsconfig.lib.json` and
`tsconfig.spec.json`; the stories have not been opened in Storybook.

D1 alone is independent of everything and can land any time.
