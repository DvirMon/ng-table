---
title: Coupling review — createFilters ↔ withFiltering
type: review
date: 2026-09-14
status: open — awaiting decision on bridge shape
---

# Coupling review: `createFilters()` ↔ `withFiltering()`

Question asked: can `createFilters` stand alone (future standalone lib), and can
`withFiltering` work for a consumer who never calls `createFilters`? Requirement stated:
**`withFiltering` must import no typing from the filters library.**

## Verdict

| Direction | State |
|---|---|
| `createFilters` → table | **Already clean.** Nothing to fix. |
| `withFiltering` → `createFilters` | **Coupled, hard.** Type import *and* a private-symbol runtime channel. |

## Direction A — `createFilters` is already standalone

Import closure of `api/create-filters.ts`, `api/filters/*.ts`, `api/filters.types.ts`:

```
@angular/core
./filters.types  ./filters/{evaluator,recorder,state,validate}  ./matchers  ./recorder  ./validate
```

Zero imports from `engine/`, `directives/`, `schema/`, `mutations/`, or `api/types.ts`. It is
extractable as-is. Two residual (non-blocking) notes:

- **Placement implies a coupling that doesn't exist.** `filters.types.ts` sits at `api/` root,
  next to the table's own `api/types.ts`; `create-filters.ts` sits next to `create-table.ts`.
  If standalone is a real trajectory, move the closure to `src/filters/` — a sibling of `api/`,
  `engine/`, `directives/` — so the seam is visible before it is cut.
- **Angular DI, not framework-free.** `inject(Injector)` + `runInInjectionContext` mean
  "standalone lib" = standalone *Angular* lib. Fine, just scope the ambition accordingly.
- Shared barrel: `index.ts` currently exports `createFilters`, `rules`, `matchers`, `Filters`,
  `FilterNode`, `FilterOptions`. That block is the future package's public surface — it splits
  cleanly, but the table barrel's "only definition of the consumer surface" comment needs a
  carve-out once it does.

## Direction B — `withFiltering` is coupled two ways

[with-filtering.ts:2-4](../../../../src/api/features/with-filtering.ts:2)

```ts
import { createFilterEvaluator } from '../create-filters';   // runtime
import type { Filters } from '../filters.types';             // typing  ← the stated violation
```

1. **Type import.** `WithFilteringConfig.filters: Filters<TRow, TState>` makes the filters model
   the feature's contract. A consumer with their own filter UI/model cannot satisfy it.
2. **Private side channel — the harder one.** `createFilterEvaluator` reads `FILTERS_INTERNAL`,
   a `unique symbol` stamped onto the object by `createFilters()` itself
   ([evaluator.ts:6](../../../../src/api/filters/evaluator.ts:6)). So it is not merely "typed to
   `Filters`" — it *only works* on an object `createFilters` built. No structural escape hatch
   exists today.
3. **Knock-on complexity.** The whole `TState` generic apparatus on `WithFilteringConfig` — plus
   the two documented call-site landmines (`TState` must be a `type` not an `interface`; never
   pass `In` explicitly) — exists solely because `Filters<TRow, TState>` is invariant through
   `WritableSignal`. Decoupling deletes all of it.

## What the feature actually needs

The `filter` stage needs exactly one thing, re-derived per pass:

```ts
(row: TRow) => boolean
```

Everything else — criteria, keys, `active()`, `dirty()`, `reset()`, empty-skipping, anyOf OR
semantics, the ADR-0014 per-evaluation dedup — belongs to whoever owns the filter model, and
already lives there.

## Proposed bridge (one general mechanism)

**Table side** — `withFiltering` owns no filter typing at all:

```ts
export interface WithFilteringConfig<TRow> {
  /** Called once per filtering pass; returns the row predicate for that pass. */
  predicate: () => (row: TRow) => boolean;
  manual?: boolean;
}
```

`TRow` still comes contextually from `createTable()`. No `TState`, no `Filters`, no import.

**Filters side** — promote the evaluator from an internal symbol read to a public method on the
filters object, e.g. `filters().matcher(): (row: TRow) => boolean`. `FILTERS_INTERNAL` and
`createFilterEvaluator`'s "@internal, for with-filtering only" note both go away.

**Consumer wires the two:**

```ts
withFiltering({ predicate: () => this.filters().matcher() })   // createFilters user
withFiltering({ predicate: () => (row) => row.status === this.status() })  // anyone else
```

Cost: one lambda vs. today's `{ filters }`. Bridge direction becomes consumer → both libs,
which is the only direction that leaves neither library importing the other.

### Rejected alternative

A table-owned structural port (`interface RowFilterSource<TRow> { matcher(): ... }`, accepted as
a union alongside the function) restores `{ filters }` ergonomics with no import either way —
but it is a second signature for one operation, and the ergonomic delta is a single arrow
function. Add it later only if the boilerplate actually bites.

## Follow-on work the change implies

- **Error policy moves, and a new one appears.** ADR-0014's per-filter/per-evaluation dedup
  follows the predicates into the filters lib (correct — it owns them). But a *raw consumer*
  predicate can now throw, and nothing catches it. `withFiltering` must degrade at the stage
  level: catch around the pass, report once, return rows unnarrowed. Do **not** wrap per row —
  that yields a half-filtered set and puts a `try` in the hot loop.
- **`manual` gets thinner.** R23 already conceded it is symmetry-only (server mode doesn't
  compose the feature). With a consumer-supplied predicate, "skip the stage" is also expressible
  as "don't compose the feature". Keeping it for `withSorting` parity is still defensible — just
  note the rationale shrank.
- **Docs.** `features/filtering.md` is written as "the adapter that makes a table honour a
  `createFilters()` object" — Config table, the `TState` section, and Compile-Time Dependencies
  all need rewriting. `filters.md` gains the `matcher()` contract.
- **Tests.** `with-filtering.spec.ts` builds every fixture through `createFilters`. Most cases
  should become plain predicates; keep one integration case proving the two compose.
- **Stories.** `stories/grouping/fixtures/schema.ts` imports the `Filters` type — consumer-level,
  legitimate, leave it.

## Open decision

Public name and shape on the filters side: `filters().matcher()` vs. a standalone
`createFilterEvaluator(filters)` kept as a public export. The method form is preferred (keeps the
object self-contained, kills the symbol); the function form preserves the existing call shape.
