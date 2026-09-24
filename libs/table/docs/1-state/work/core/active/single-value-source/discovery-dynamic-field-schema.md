# How does a field that did not exist at declaration time come into being in Angular Signal Forms, and how does its schema get resolved?

**Date:** 2026-09-22 · **Depth:** standard

## Answer

**Verdict: no surveyed library lets a new field carry its own new schema while keeping literal
key typing. `setColumns` being unable to add a column is a structural wall, not a gap.** Signal
Forms does materialize nodes for runtime-added keys — the field tree is derived from the data's
shape, there is no "add field" API [R1][R2]. But the *logic* tree is compiled exactly once at
`form()` and thereafter only **indexed by key**; a key with no compile-time declaration gets an
empty logic node [R3][R4][R5]. The one mechanism that does cover unknown keys is the `DYNAMIC`
slot written by `applyEach` — and it is **one shared schema for every key**, not a per-key one
[R6][R7]. Types force the same either/or: literal keys come from `keyof TModel`, so a model that
can grow is a `Record<string, T>` whose keys are all `string` and all one value type [R8][R9].
TanStack Form and React Hook Form derive their path unions from the model type the same way
[S1][S2]; Zod `.extend()` preserves literal keys but produces a **new schema object**, never
mutating one already in use [R10][R11].

## Method

- `@angular/forms@22.1.2` — read from `node_modules` (installed), **not** registry latest
  (`22.1.7`). Runtime claims come from `fesm2022/_validation_errors-chunk.mjs` (unminified),
  type claims from `types/_structure-chunk.d.ts`. Per the anchors file, both files are required:
  `types/signals.d.ts` re-exports and declares almost nothing.
- `zod@4.4.3` — installed, read from `node_modules` (it is a direct dependency of
  `@angular/forms`).
- `react-hook-form@7.88.0` and `@tanstack/form-core@1.33.5` — pinned from
  `registry.npmjs.org/<pkg>/latest`, read as published `.d.ts` on unpkg.
- **Reliability:** the angular.dev guide and the source disagree about `applyEach` scope — see
  Evidence. `react-hook-form.com/docs` returned HTTP 403 to fetch; the RHF claim rests on the
  published type file only.

## Evidence

### (a) A node appears because the data grew — there is no add-field API

- `FieldNodeStructure.computeChildrenMap(value, prevData, forceMaterialize)` iterates
  `for (const key of Object.keys(value))` and calls `this.createChildNode(key, …)` for any key
  not already in `prevData.byPropertyKey` — writing a new key into the model materializes a node
  [R1].
- Materialization is lazy and cached: `createChildrenMap()` is a `linkedSignal({ source: this.value, … })`,
  and the map returns `undefined` outright when `!this.logic.anyChildHasLogic()` and nothing forced
  it — a subtree with no rules never builds nodes at all [R2].
- The reverse direction exists too: a key whose value becomes `undefined` is **deleted** from
  `byPropertyKey`, and stale keys are swept by `maybeRemoveStaleObjectFields` /
  `maybeRemoveStaleArrayFields` [R1]. A removed node's `keyInParent` computed throws
  `Orphan field` (RuntimeError 1902/1904) if read [R12].
- Array elements are tracked by an injected identity `Symbol` (`childValue[this.identitySymbol] ??= Symbol(…)`),
  so reordering an array moves the existing node rather than rebuilding it [R1].
- No exported function adds a field. The public structure API is the model write; `getChild(key)`
  only reads the map, falling back to `createReader(strKey)` [R13].

### (b) Rules are fixed at `form()` and merely indexed by path — with one shared dynamic slot

- `FieldNode.newChild(key, trackingId, isArray)`: `childLogic = this.structure.logic.getChild(key)`,
  or `getChild(DYNAMIC)` when the parent is an array [R3].
- `LeafLogicNode.getChild(key)` calls `getAllChildBuilders(this.builder, key)`; **zero matching
  builders returns `new LeafLogicNode(undefined, [], depth+1)`** — an empty `LogicContainer`. A
  runtime key nobody declared gets no validation, no metadata, no hidden/disabled/readonly [R4].
- `getAllChildBuilders` on a `NonMergeableLogicNodeBuilder` returns the `DYNAMIC` child builder
  **in addition to** the `key` child builder, for any `key !== DYNAMIC` [R5]. So `applyEach`'s
  schema does reach runtime-added keys of a plain object, not only array elements.
- Per node, not per evaluation: `createLogic()` runs once in the `LeafLogicNode` constructor, and
  `newChild` is called once per key from `computeChildrenMap`'s not-already-present branch, with
  the node retained in the `linkedSignal` map across later value changes [R1][R4].
- `applyEach(path, schema)` = `unwrapFieldPath(path).getChild(DYNAMIC)` then `apply(…)` — one
  schema at one symbol key, standing for every element/key under that parent [R6].

### (c) One-shot compile — composition is closed the moment `form()` returns

- `form()` calls `SchemaImpl.rootCompile(schema)` exactly **once**, eagerly, in the function body —
  not inside a `computed`, `effect` or `linkedSignal` [R7]. **The repo's phrase "structural … like
  `form()`'s single `rootCompile`" is accurate as written.**
- `rootCompile` clears the `compiledSchemas` memo before and after, so each `form()` gets a fresh
  `FieldPathNode` root; within one compile, a reused `SchemaImpl` is memoized [R14].
- `apply`, `applyWhen`, `applyWhenValue` and `applyEach` all begin with `assertPathIsCurrent(path)`,
  which throws RuntimeError 1908 — *"A FieldPath can only be used directly within the Schema that
  owns it"* — unless `currentCompilingNode === path.root` [R6][R15]. `currentCompilingNode` is set
  only inside `SchemaImpl.compile()`'s `try` block [R14]. **Calling `apply()` after `form()`
  returns throws.** There is no `extend`/`addRule`/`recompile` export.
- The docs agree: *"The schema function runs ONCE during form creation … The condition controls
  whether those rules are active, not whether they exist."* [S3]

### (d) Literal keys come from `keyof TModel`, so a growable model has none

- `Subfields<TModel>` is `{ readonly [K in keyof TModel as TModel[K] extends Function ? never : K]: … }`
  [R8]. `SchemaPathTree<TModel>` is `{ [K in keyof TModel]: MaybeSchemaPathTree<TModel[K], PathKind.Child> }`,
  with arrays explicitly excluded from the mapping [R9].
- Consequence, not stated in any doc: for `TModel = Record<string, T>`, `keyof TModel` is `string`,
  so every subfield is `T` under an index signature. For `TModel = { a: A; b: B }` the keys are
  literal but the set cannot grow. **The two properties are mutually exclusive by construction.**
- There *is* a typed path for dynamically-keyed records, and it is `applyEach`'s second overload:
  `applyEach<TValue extends Object>(path, schema: NoInfer<SchemaOrSchemaFn<ItemType<TValue>, PathKind.Child>>)`,
  where `ItemType<T> = T extends ReadonlyArray<any> ? T[number] : T[keyof T]` [R16][R17]. It types
  the schema against the **union of value types**, never against one key.
- The type system does not guard the runtime: `FIELD_PATH_PROXY_HANDLER` is a bare
  `get(node, property) { return node.getChild(property).fieldPathProxy }` — the schema-path proxy
  mints a child for any property name at all [R18]. The `keyof` restriction is type-only.

### Cross-check — the same wall elsewhere

- **TanStack Form** derives paths from the model type, and its record accessor is
  `UnknownAccessor<TParent> = TParent['key'] extends never ? string : \`${TParent['key']}.${string}\``
  — a template, not a literal union. Arrays use `[${number}]` [S1].
- **React Hook Form** `FieldPath<TFieldValues> = Path<TFieldValues>`, "eagerly collects all paths
  through a type". A name outside that union is a type error; there is no runtime widening except
  the `IsAny<V> extends true ? string` escape in `ArrayPathImpl` [S2]. `register` declares no new
  *schema* — validation rules are re-passed per call site.
- **Zod** `.extend<U extends $ZodLooseShape>(shape: U): ZodObject<util.Extend<Shape, U>, Config>`,
  with `Extend<A, B>` a mapped merge that preserves literal keys [R10][R11]. It **returns a new
  schema**; the original is untouched, so nothing already constructed against it changes.
  `.catchall<T>()` / `.loose()` / `.passthrough()` go the other way — they add
  `{ [k: string]: T }`, which is exactly the index-signature collapse [R10].

## Comparison

| Axis | Signal Forms 22.1.2 | TanStack Form 1.33.5 | RHF 7.88.0 | Zod 4.4.3 |
|---|---|---|---|---|
| Node appears from data shape | yes — `Object.keys(value)` [R1] | yes — value-driven [S1] | yes — value-driven [S2] | n/a |
| Explicit add-field API | no [R1][R13] | no [S1] | no [S2] | n/a |
| Rules for an undeclared key | empty logic node [R4] | none [S1] | none [S2] | n/a |
| One schema covering unknown keys | `applyEach` → `DYNAMIC` [R5][R6] | per-element validators | resolver schema | `.catchall` [R10] |
| Schema mutable after construction | no — throws 1908 [R15] | no [S1] | no [S2] | no — `.extend` returns new [R11] |
| Literal keys survive growth | no — `keyof TModel` [R8][R9] | no — `${string}` [S1] | no [S2] | no — `.catchall` erases [R10] |

## Synthesis

The four libraries disagree about almost nothing, which is itself the finding: this is a
type-system limit, not a design taste. **A literal key union is a function of a type written at
declaration time.** Anything that can grow at runtime has to be reachable by a key the type
already admits — which means either a symbol slot standing for "all of them" (Signal Forms'
`DYNAMIC`), a template pattern (`${string}`, TanStack), or an index signature (Zod `.catchall`).
All three erase per-key identity.

Where they *do* differ is in how much they let you get away with dynamically. Signal Forms is the
most permissive: `getAllChildBuilders` genuinely merges the `DYNAMIC` builder into every key
lookup, including for a plain object, so an `applyEach`-declared schema reaches keys that did not
exist at `form()` [R5]. The angular.dev guide describes `applyEach` as an array facility only
[S3] — the source and the second type overload both go further [R16]. That is a real, shipped,
undocumented capability. It is still one schema for all keys.

**Against the repo's G65/G66/G67 hypothesis — verified, then split in two.** The recorded claim
that "Signal Forms' paths name instances while ours name columns" is **half wrong**. Signal Forms
has *two* structures, and they name different things:

- The **schema path** (`FieldPathNode` / `SchemaPathTree`) names a **type-level slot in the
  model** — mapped over `keyof TModel`, with every array element collapsed onto one `DYNAMIC`
  symbol [R6][R9]. It names a cross-section, exactly like `ColumnsPath`. G65's own framing
  ("a column-keyed path names a cross-section, not an instance") is the *same* shape Signal Forms
  uses, not a departure from it.
- The **field tree** (`FieldNode` / `childrenMap`) names **instances** — one node per array
  element, identity-tracked by injected `Symbol` [R1].

ng-table has no equivalent of the second structure, and the analogy should be drawn against the
first. So the G65 rationale survives; its comparison sentence should be corrected.

### What this means for `setColumns`

The constraint's analogy holds, and the source strengthens it rather than weakening it. For a new
column to arrive with *its own* rules, ng-table would need what Signal Forms also does not have:
a way to compile rules after declaration. Porting the one mechanism Signal Forms *does* have —
`applyEach`'s `DYNAMIC` slot — to a column-keyed path would mean **one schema applied to every
column, including columns added later**, keyed by nothing. Its cost, read off the structures
above: `ColumnsPath<TRow, TId>` would need a symbol member alongside its `TId` keys, the
`ColumnRule` shape would need a `columnId: typeof DYNAMIC` variant, `assertDeclarationsAreKnown`
would have to exempt it (`resolve.ts:19-28`), and `foldColumnRules` would have to resolve
`DYNAMIC` ∪ per-id at fold time rather than at compile. That buys "rules that cover unknown
columns" — not "a new column with its own rules", which nobody ships.

## Against

- The wall is about *literal typing*, not about adding columns. A separate `addColumn` verb typed
  `ColumnsUpdater<TRow, string>` — widening the id union rather than preserving it — is buildable
  and is what every other vendor effectively does. This discovery does not argue against that; it
  argues only that the widened result cannot be typed back down.
- `applyEach`-on-objects is real in source but undocumented [R5][S3]. Building on it would mean
  depending on behavior Angular has not promised.

## Not researched

- Valibot (the brief offered "Zod **or** Valibot"; only Zod was read).
- `@angular/forms/signals/compat` and the `FieldAdapter` extension seam — a custom adapter
  overrides `newChild`/`newRoot` [R3], and whether that is a supported hook for custom logic
  resolution was not investigated.
- RHF `useFieldArray` source; only the path-type file was read.
- TanStack Form validator attachment (the guide page was silent, and `form-core`'s validator
  source was not opened).

## Unverified

- That `applyEach`'s object overload behaves at runtime as `getAllChildBuilders` implies. The
  control-flow read is unambiguous [R5], but no probe was compiled and no doc confirms it. A
  minimal `form(signal({} as Record<string, string>), (p) => applyEach(p, required))` plus a
  runtime key write would confirm it.
- Whether a `DYNAMIC` rule and a literal-key rule both matching one key compose or conflict.
  `getAllChildBuilders` returns both and `CompositeLogicNode` merges them [R4][R5], so composition
  is the reasonable inference — not a doc-confirmed fact.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| R1 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1146-1210` (`computeChildrenMap`) | 22.1.2 | yes — source read; this is the whole of (a) |
| R2 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1140-1145` (`createChildrenMap` / `linkedSignal`) | 22.1.2 | yes — source read |
| R3 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1592-1611` (`FieldNode.newChild`) | 22.1.2 | yes — source read; the array/object branch |
| R4 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:340-404` (`LeafLogicNode`, `CompositeLogicNode`) | 22.1.2 | yes — source read; empty-node fallback at :353-354 |
| R5 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:405-434` (`getAllChildBuilders`) | 22.1.2 | yes — source read; **corrects the guide**, which scopes `applyEach` to arrays |
| R6 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1811-1828` (`applyEach`, `apply`, `applyWhen`) | 22.1.2 | yes — source read |
| R7 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1783-1810` (`form`) | 22.1.2 | yes — source read; confirmed the repo's "single rootCompile" phrasing |
| R8 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1169-1173` (`Subfields`) | 22.1.2 | yes — type read |
| R9 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1555-1559` (`SchemaPathTree`) | 22.1.2 | yes — type read; arrays excluded from the mapping |
| R10 | `node_modules/zod/v4/classic/schemas.d.cts:459-468` (`catchall`, `passthrough`, `extend`) | 4.4.3 | yes — type read |
| R11 | `node_modules/zod/v4/core/util.d.cts:60-64` (`Extend<A, B>`) | 4.4.3 | yes — type read; literal keys preserved |
| R12 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1094-1139` (orphan `keyInParent`) | 22.1.2 | yes — source read |
| R13 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1059-1067` (`FieldNodeStructure.getChild`) | 22.1.2 | yes — source read |
| R14 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:511-551` (`SchemaImpl.compile` / `rootCompile`) | 22.1.2 | yes — source read |
| R15 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:555-559` (`assertPathIsCurrent`, RuntimeError 1908) | 22.1.2 | yes — source read; this is what makes it one-shot |
| R16 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1980-1981` (`applyEach` overloads) | 22.1.2 | yes — type read; the object overload the guide omits |
| R17 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1765` (`ItemType`) | 22.1.2 | yes — type read |
| R18 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:500-507` (`FIELD_PATH_PROXY_HANDLER`) | 22.1.2 | yes — source read |
| R19 | `libs/table/docs/decisions/grouping.md:106-108` (G65, G66, G67) | — | yes — read; comparison sentence in G65 corrected above |
| R20 | `libs/table/src/engine/columns-schema/resolve.ts:19-28` (`assertRuleColumnIdsAreKnown`) | — | yes — read |
| R21 | `libs/table/src/schema/path-proxy.ts:78-100` (`createPathProxy`) | — | yes — read; same bare-proxy shape as R18 |
| R22 | `libs/table/src/api/types.ts:117` (`ColumnIdIn`), `:190-192` (`ColumnsUpdater`) | — | yes — read |
| S1 | https://unpkg.com/@tanstack/form-core@1.33.5/dist/esm/util-types.d.ts | 1.33.5 | yes — published types read (`UnknownAccessor`, `ArrayAccessor`) |
| S2 | https://unpkg.com/react-hook-form@7.88.0/dist/types/path/eager.d.ts | 7.88.0 | yes — published types read (`Path`, `FieldPath`, `ArrayPathImpl`) |
| S3 | https://angular.dev/guide/forms/signals/schemas | unversioned | yes — page read; "schema function runs ONCE during form creation". **Understates `applyEach`** — see R5/R16 |
| S4 | https://registry.npmjs.org/react-hook-form/latest | 7.88.0 | yes — pin source |
| S5 | https://registry.npmjs.org/@tanstack/form-core/latest | 1.33.5 | yes — pin source |
| S6 | https://react-hook-form.com/docs/useform/register | — | no — HTTP 403; S2 used instead |
| S7 | https://tanstack.com/form/latest/docs/framework/react/guides/arrays | — | yes — read; silent on validator attachment, so S1 carries the claim |
