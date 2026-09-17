# Step 7 — Client-filtering host takes the owned model

**PR scope:** PR 1 of 1 (`#125`). **Parallel-safe with: Step 8, Step 9, Step 10.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/table/src/stories/filtering/client-filtering/client-filtering.filters.ts` | `:1-53` | rewrite — hoisted schema `const`, no `createFilters` |
| `libs/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.ts` | `:93-103`, `:113-131`, `:155` | edit — `table.filters`, prose |
| `libs/table/src/stories/filtering/client-filtering/filter-report-log.ts` | `:8`, `:20` | edit — report prefix is `[withFiltering]` |
| `libs/table/src/stories/filtering/client-filtering/client-filtering.stories.ts` | `:18` | edit — prose only |
| `libs/table/src/stories/filtering/fixtures/schema.ts` | `:24` | edit — comment names the composition that no longer exists |
| `libs/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.html` | — | edit — only if a binding names `filters` off the host |
| `libs/table/src/stories/filtering/client-filtering/client-filtering-toolbar.component.ts` | — | edit — only if its `Filters<…>` input type import moves |

## Why This Step Exists

This is the story a reader opens first, and it is the one that carries **R55** — the spec's claim
that a hoisted arrow annotated `(path: FiltersPath<Row>)` composes by spread and needs no
`filterSchema()` helper. Nothing proves that today; `createClientFilters` is a *function taking a
data signal*, which is the shape R52 deletes.

It also carries a **live bug this step must fix, not just migrate around**. `filter-report-log.ts`
matches console messages beginning `'[createFilters]'`. `evaluator.ts:29` now emits
`'[withFiltering]'` — renamed by `#124`'s Step 4. The story's degradation panel therefore matches
nothing and renders empty, while the "Break the tags filter" toggle still appears to work. A reader
would read that as ADR-0014 not reporting. It is a one-string fix and it belongs here, with the
story that owns the panel.

## What To Do

1. **`client-filtering.filters.ts` — hoist to a `const`.**

   ```ts
   export const clientInvoiceFilters = (path: FiltersPath<InvoiceRow>) => ({
     status: filter(path.status, matchesStatus, { emptyValue: '' }),
     customer: contains(path.customer),
     amount: inRange(path.amount, { source: () => DEFAULT_AMOUNT_RANGE }),
     issuedAt: inDateRange(path.issuedAt),
     tags: filter(path.tags, matchesTagCriterion, {
       isEmpty: isEmptyTagCriterion,
       emptyValue: EMPTY_TAG_CRITERION,
     }),
     search: anyOf([contains(path.note), filter(path.id, matchesInvoiceNumber)]),
   });
   ```

   The annotation is the point — **do not** let it infer, and do not add a return-type annotation
   (that would restate `S` and defeat `StateOf`).

2. **The `tagsPredicateIsBroken` closure has to move.** The old signature took
   `tagsPredicateIsBroken: Signal<boolean>` and closed the throwing predicate over it. A hoisted
   `const` has no such parameter. The toggle is a story control, so read it from a module-scope
   signal the host writes, declared in this file beside the schema:

   ```ts
   /** Story control, not filter state — the "Break the tags filter" toggle. Module-scope because
    * a hoisted schema takes only `path`, and this is the one input that is not a criterion. */
   export const tagsPredicateIsBroken = signal(false);
   ```

   The host's `toggleTagsPredicate()` then writes this instead of a field. If that reads as too
   sharp an edge for a story, the alternative is to keep a factory
   (`createClientFilters(broken) => (path) => ({…})`) — but then **say so in the PR**, because the
   step no longer proves R55 and Step 8 has to.

3. **`ClientCriteria` derives from the schema, not the root.**
   `type ClientCriteria = StateOf<ReturnType<typeof clientInvoiceFilters>>`, importing `StateOf`
   from `../../../filters/types`. It is not on the barrel — that is deliberate and settled by
   `#124` Step 5; stories already reach into `filters/types` for `FilterNode`.

4. **Host: the table owns the model.**

   ```ts
   protected readonly table = createTable(
     this.data,
     clientInvoiceConfig,
     withFiltering({ schema: clientInvoiceFilters }),
   );
   protected readonly filters = this.table.filters;
   ```

   `filters` must be declared **after** `table`. Keep it as a plain alias field only if the template
   and `activeCriteria` genuinely read it in several places; a single-use read should just say
   `this.table.filters`. Note the memory rule: aliasing a *nested signal* (`= this.x.signal`) is
   banned — `table.filters` is the member itself, not a signal read off one, so a direct alias is
   fine here. Do not write `= this.table.filters()`.

5. **`filterForm`** becomes `form(this.table.filters().value)` and likewise moves after `table`.

6. **Fix `filter-report-log.ts`.** `'[createFilters]'` → `'[withFiltering]'` at both the JSDoc and
   the `startsWith` guard. Verify against `src/filters/evaluator.ts:29` rather than trusting this
   file — if `#124` left a different prefix, that is the string.

7. **Prose.** The host's class JSDoc, `client-filtering.stories.ts:18` and
   `fixtures/schema.ts:24` all describe "`createFilters()` feeds `withFiltering()` as one matcher
   term". That composition no longer exists. Say what it is now: the table owns the model, and the
   criteria narrow the `filter` stage directly.

## Implementation Notes

- `withFiltering`'s shipped signature nests `schema` **inside config** — `withFiltering({ schema })`,
  not `withFiltering(config, schema)`. Issue `#125`'s body shows the second form; it is stale, and
  `src/api/features/with-filtering.ts:7-19` is the truth.
- `anyOf` no longer takes a key. `anyOf('search', [...])` → `search: anyOf([...])` — the object key
  is the name now (R51).
- `CLIENT_FILTER_KEYS` in `client-filtering.types.ts` stays as-is; it is a hand-written tuple over
  the same six keys and the per-key access `this.filters[key]()` is unchanged.
- `loadSavedFilterRaw()`'s deliberate `as Partial<ClientCriteria>` escape stays. It is the story's
  stated finding, not an oversight — leave the JSDoc's framing intact, only fix the sentence naming
  `createFilters` as what inferred the map.

## Risks / Watchouts

- **Field-order trap.** `filters` and `filterForm` currently precede `table`. Angular field
  initializers run top-down; reading `this.table` before it is assigned is `undefined` at runtime
  with no type error. Move all three, in order.
- **`activeCriteria` degrading to `string`.** It maps `CLIENT_FILTER_KEYS` over `this.filters[key]`.
  If `filters` ends up typed as the wide `Filters<InvoiceRow, Record<string, unknown>>` rather than
  `StateOf<…>`, this still compiles and silently loses the key union. Check the hover type, not just
  the build.
- The degradation panel is the only visible proof of ADR-0014 in the library. Confirm the prefix fix
  by reading the evaluator, since a wrong string fails silently in exactly the same way.

## Non-Goals

- `filtering.mdx` — Step 11 owns it; four steps editing one file is a conflict, not a graph edge.
- Any change to rule semantics, `emptyValue`/`isEmpty`, or the null-cell policy. Unchanged by this
  work, per the spec's "Behaviour that must not change".
- Putting `StateOf` on the public barrel.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating under
      `src/stories/filtering/client-filtering/` or `src/stories/filtering/fixtures/`. Errors in
      other story folders remain expected until Steps 8–9 land. Run twice — a `.ts` error aborts
      `ngc` before the template phase, so only the second, source-clean run says anything about
      `client-filtering-story-host.component.html`.
- [ ] `clientInvoiceFilters` is a `const` annotated `(path: FiltersPath<InvoiceRow>)` with no
      return-type annotation.
- [ ] No `createFilters`, `rowOf`, `applyWhen`, `as:` or `predicates` under
      `src/stories/filtering/client-filtering/`.
- [ ] `filter-report-log.ts`'s prefix matches `src/filters/evaluator.ts` exactly.
- [ ] `ClientCriteria` still names the six keys — a renamed schema key still breaks
      `clearCriterion()`, as the original JSDoc promises.

---
← [Step 6: Rewrite the compile-time probe](step-6-inference-probe.plan.md) | [Step 8: Server-filtering host](step-8-server-filtering-host.plan.md) →
