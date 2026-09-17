# Architecture — effect-free column reactivity

Consumed by `/to-tasks`. Grounded against the current source at the paths cited; decisions are
settled in `2-decisions.md` (D1–D10) and not open for relitigation here.

## Settled decisions, as they land in code

### 1. `createTableCore()` splits `columns` into base + fold + derived

`engine/core.ts:35` today:

```ts
const columns = signal<ColumnDef<TRow>[]>(resolveColumnDefs(config.columns));
```

becomes three members — a writable base, a mutable rule registry read at evaluation time, and
the derived public signal:

```ts
const baseColumns = signal<ColumnDef<TRow>[]>(resolveColumnDefs(config.columns));
const columnRules: ColumnRuleRegistry<TRow> = { visible: [] };
const columns = computed(() => foldColumnRules(baseColumns(), columnRules));
```

`TableCoreHandle` (`engine/core.ts:18-23`) gains `baseColumns` and `columnRules` alongside the
existing `stages` / `setRenderRowsBuilder`, for the same reason those are already there — see the
handle's own doc comment at `engine/core.ts:12-17`.

### 2. `TableCore.columns` becomes a readonly `Signal`

`engine/types.ts:28`:

```ts
readonly columns: WritableSignal<ColumnDef<TRow>[]>;   // before
readonly columns: Signal<ColumnDef<TRow>[]>;           // after
readonly baseColumns: WritableSignal<ColumnDef<TRow>[]>;  // new, engine-internal
```

`baseColumns` gets the same "engine-internal only" annotation `data` already carries at
`engine/types.ts:31-35`.

`api/types.ts`'s public `TableStore` already types `columns` as a readonly `Signal`, so **no
public type changes.**

### 3. `updateColumns()` retargets `baseColumns`

`api/update-columns.ts:23-40` keeps both overloads and its signature. The cast at line 37 changes
which member it recovers write capability on — `baseColumns` instead of `columns`. The structural
overload at line 28 changes to `{ baseColumns: WritableSignal<ColumnDef<TRow>[]> }`.

`setColumns` / `reorderColumns` / `toggleColumnVisibility` (lines 43-57) are pure updater
factories and are **unchanged**.

`ColumnsSchemaStore` (`api/column-schema.types.ts:81-83`) changes correspondingly — the wiring no
longer writes at all, so this interface narrows to what the rules actually read.

### 4. `foldColumnRules()` — new pure transform in `engine/columns.ts`

Joins `resolveColumnDefs` / `applyColumnOrder` / `setColumnVisible` / `toggleColumnVisible`, all
pure `ColumnDef[] → ColumnDef[]` (see the file's header comment, `engine/columns.ts:3-6`).

```ts
export interface ColumnRuleRegistry<TRow> {
  readonly visible: ColumnRuleEntry[];
}

interface ColumnRuleEntry {
  readonly columnId: string;
  /** `undefined` = this rule abstains; the base value stands. */
  readonly result: Signal<boolean | undefined>;
}

export function foldColumnRules<TRow>(
  columns: ColumnDef<TRow>[],
  registry: ColumnRuleRegistry<TRow>
): ColumnDef<TRow>[];
```

Semantics: group `visible` entries by `columnId`; reduce each group with logical AND over the
defined results (D4's reducer, matching today's `columnRules.every(...)` at `wiring.ts:61`); a
group whose results are all `undefined` contributes nothing and the base `visible` stands;
`columnId`s absent from `columns` are skipped (D9); columns with no rules pass through by
identity.

**Registry keys are the extension point (D4).** A future rule kind adds a key here; the fold
gains a branch. `visible` is the only key today.

**Reads the registry object, not a snapshot** — same evaluation-time contract as
`PipelineStages` in `engine/core.ts:40`.

### 5. `wiring.ts` loses both `effect()`s

`api/features/with-columns-schema/wiring.ts` — current effects at lines 59-64 and 82-99, and
`patchColumnVisible` at 42-48, are deleted. The two wiring functions return rule entries instead
of performing writes:

```ts
export function buildReactiveVisibleEntries<TRow>(
  ctx: ColumnRuleContext<TRow>,
  rules: readonly VisibleReactiveRule<TRow>[]
): ColumnRuleEntry[];   // one entry per rule; result = computed(() => rule.when(ctx))

export function buildAsyncVisibleEntry<TRow>(
  ctx: ColumnRuleContext<TRow>,
  rule: VisibleAsyncRule<TRow>
): ColumnRuleEntry;      // constructs the resource; result = the D5 linkedSignal
```

`groupRulesByColumnId` (lines 30-40) is no longer needed here — grouping moves into
`foldColumnRules`, which is where the reducer lives.

The D5 retention cell:

```ts
const result = linkedSignal<ResourceStatus, boolean | undefined>({
  source: () => resourceRef.status(),
  computation: (status, previous) => {
    if (status === 'resolved' || status === 'local') {
      const value = resourceRef.value();
      return value === undefined ? previous?.value : rule.onSuccess(value);
    }
    if (status === 'error') return rule.onError(resourceRef.error());
    return previous?.value;          // loading / reloading / idle → hold
  },
});
```

Resource construction still requires an injection context, so `buildAsyncVisibleEntry` is still
called from `onInit` (D3).

### 6. `TableFeatureSpec` gains `columnRules` — additive, not single-occupancy

`engine/types.ts:43-60`:

```ts
/** Column rule entries contributed by this feature. Additive: every feature's entries merge. */
columnRules?: ColumnRuleRegistry<TRow>;
```

**This refines D6.** D6 said "claimed through `SlotRegistry`". That is wrong on reflection:
`SlotRegistry` (`engine/slots.ts:13-39`) exists for *single-occupancy* slots, where a second
claimant would silently win by array order. Column rules are **additive** — two `applyVisible`
calls on the same column already merge via the AND reducer (`feature.spec.ts:91`), so a second
feature contributing rules must merge for the same reason. `columnRules` therefore behaves like
`members` in `foldFeatures()` (`engine/compose-table.ts:47`): concatenated, never claimed.
`SlotRegistry` is untouched.

### 7. `ColumnRuleContext` resolves to `baseColumns` (D8)

`api/column-schema.types.ts:9-11` keeps its shape. What changes is what the wiring passes:

```ts
const ctx: ColumnRuleContext<TRow> = { columns: () => core.baseColumns() };
```

Today `wiring.ts:60` and `wiring.ts:79` both pass `store.columns()`. Once `columns` derives from
rule results that closes `columns → ruleResults → params → resource → ruleResults`. Passing
`baseColumns` breaks it by construction.

Consequence to document on the interface: rules observe declared and imperatively-updated column
state, never another rule's output.

### 8. `applyVisibleAsync`: `onError` becomes required (D5)

`api/column-rules.ts:36`:

```ts
onError?: (error: unknown) => boolean;   // before
onError: (error: unknown) => boolean;    // after
```

`VisibleAsyncRule.onError` (`api/column-schema.types.ts:68`) loses its `?` to match.

Callers: `apps/demo/src/app/table-demo/table-demo.store.ts:28-32` must add an `onError`.

## File layout

| File | Change |
|---|---|
| `engine/core.ts` | Split `columns` into `baseColumns` + `columns` computed; add `columnRules` registry to `TableCoreHandle` |
| `engine/types.ts` | `TableCore.columns` → readonly `Signal`; add `baseColumns`; add `columnRules` to `TableFeatureSpec` |
| `engine/columns.ts` | Add `foldColumnRules` + `ColumnRuleRegistry` / `ColumnRuleEntry` types |
| `engine/columns.spec.ts` | Add `foldColumnRules` cases (plain vitest, no `TestBed`) |
| `engine/compose-table.ts` | Merge each feature's `columnRules` into the handle registry in `foldFeatures()` |
| `api/update-columns.ts` | Retarget the cast + structural overload at `baseColumns` |
| `api/column-rules.ts` | `onError` required; correct the JSDoc at lines 12-13 and 28-31 |
| `api/column-schema.types.ts` | `VisibleAsyncRule.onError` required; narrow `ColumnsSchemaStore`; document the `baseColumns` contract on `ColumnRuleContext` |
| `api/features/with-columns-schema/wiring.ts` | Delete both `effect()`s and `patchColumnVisible`; return rule entries; add the D5 `linkedSignal` |
| `api/features/with-columns-schema/feature.ts` | Return `columnRules` from the spec; keep resource construction in `onInit` |
| `api/features/with-columns-schema/feature.spec.ts` | Rewrite the no-`onError` case; add D2/D5/D8/D9 cases |
| `apps/demo/src/app/table-demo/table-demo.store.ts` | Add the now-required `onError` |
| `src/ui/table/CLAUDE.md` | Correct the `engine/core.ts` row and the `api/update-columns.ts` row |
| `libs/shared/design-system/docs/adr/` | Consider an ADR amendment — `TableFeatureSpec` is a documented contract (ADR-0003) |

Untouched: `api/types.ts` (public types already correct), `api/update-columns.spec.ts`
(regression evidence), `engine/slots.ts`, `engine/pipeline.ts`, `directives/`.

## Open questions

1. **Does this need its own ADR, or an amendment to ADR-0003?** `TableFeatureSpec` is the
   documented feature contract and this adds a key to it. Leaning amendment — the contract's
   shape and rationale are unchanged, one declaration kind is added.
2. **Should `foldColumnRules` live in `engine/columns.ts` or its own module?** Placed in
   `columns.ts` above because it is a pure `ColumnDef[] → ColumnDef[]` transform like its
   siblings. If the registry grows a second rule kind it likely earns
   `engine/column-rules.ts`. Not worth pre-splitting for one kind.
3. **Should `foldColumnRules` short-circuit when the registry is empty?** The legacy
   no-`columnsSchema` path (`feature.spec.ts:65`) must stay zero-cost. Returning `columns` by
   identity when every key is empty preserves referential equality for downstream computeds;
   confirm nothing depends on a fresh array.
4. **Does the demo's `onError` want a real behavior or a placeholder?** It is a permission check
   (`table-demo.store.ts:28-32`) — `() => false` (fail closed) is the defensible default, but it
   is a product call, not a mechanical one.
