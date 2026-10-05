# Step 1 — Composition: the derived-state story host

**PR scope:** PR 2 of 2 (`#77`). **Parallel-safe with: Steps 2, 3, 4, 5, 6, 7, 8.** **Blocks Step 9.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                                                                            | Action                                          |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `libs/shared/table/src/stories/composition/derived-state/derived-state-story-host.component.ts` | edit — array schema, row carrier, field reorder |
| `libs/shared/table/src/stories/composition/fixtures/types.ts`                                   | edit — delete `CompositionFilterState`          |

The smallest of the five story sites: one rule, one criterion. Done first so the shape of the
rewrite is settled on a site where nothing else is going on.

## Why This Step Exists

`#76` changed `createFilters()`'s signature. This host still calls the previous one:

```ts
createFilters<CompositionRow, CompositionFilterState>((path) => {
  equals(path.dept);
});
```

Two explicit type arguments, a statement-body schema, no row carrier — three separate errors under
the new signature. `CompositionFilterState` restates exactly what `equals(path.dept)` already says,
which is the duplication the epic removes.

## What To Do

1. Rewrite the declaration:

   ```ts
   protected readonly data = signal<CompositionRow[]>(COMPOSITION_ROWS_MOCK);

   protected readonly filters = createFilters(this.data, (path) => [equals(path.dept)]);
   ```

2. **Move `data` above `filters`.** It currently sits below. A field initializer reading
   `this.data` before it is assigned yields `undefined`; `createFilters` never reads the carrier
   (`void rows`), so nothing breaks at runtime — but a reader cannot tell that from the call, and
   the next person to pass a carrier that _is_ read inherits the trap. Order the fields so the
   carrier is real by the time it is passed.
3. Drop the `CompositionFilterState` import; keep `CompositionRow`.
4. Delete `CompositionFilterState` from `composition/fixtures/types.ts`, and with it the
   `type`-not-`interface` comment above it — that comment exists only to explain a
   `Record<string, unknown>` constraint that no longer exists.

## Implementation Notes

- `activeDept` (`this.filters.dept().value()`) and `setDeptFilter` are unchanged. The key `dept` is
  borrowed from the path either way, so every read in the class and the template keeps working.
- No `as` rename, no group, no gate here — one rule, returned in a one-element array.
- The row type now comes from `this.data`, a `WritableSignal<CompositionRow[]>`. That is one of the
  carrier shapes `#76` accepts; do not wrap it in an accessor.

## Risks / Watchouts

- **A silent `{}` fold.** If `StateOf<S>` stops resolving, `filters.dept` is a property access on
  `{}` and fails to compile — loudly. But if the array is typed as `unknown[]` (for example by
  annotating the schema callback's return), the fold yields `{}` _and_ compiles. Never annotate the
  schema's return type.
- The template binds nothing filter-shaped beyond what the class exposes; leave the `.html`
  untouched.

## Non-Goals

- Any other story host — Steps 2–5.
- Any spec file — Steps 6–8.
- `docs/1-state/filters.md` and the design record — `#79`.

## Acceptance Checks

- [ ] `createFilters` at this site names no type argument
- [ ] `this.data` is declared before `this.filters`
- [ ] The schema returns an array; no rule is called as a statement
- [ ] `CompositionFilterState` is gone from `composition/fixtures/types.ts` and grep finds no
      remaining reference to it
- [ ] `filters.dept().value()` still reads as `string | null`, not `unknown`
- [ ] `nx run shared-table:typecheck` reports no error in either file this step touched (the run as
      a whole is still red until Step 9 — check the paths, not the exit code)

---

[Step 2: The client filtering host](step-2-client-filtering-host.plan.md) →
