# Research — config object vs. functional extension for consumer-facing options

**Date:** 2026-09-15 · **Status:** §6's recommendation (D + C) **shipped 2026-09-16** via
[#116](https://github.com/DvirMon/acme/issues/116); the rest is research, not yet grilled ·
**Trigger:** [D4](../filters-inferred-state/docs/tasks/issue-111-call-sites/decisions.md) ·
**Feeds:** `filters/types.ts` `FilterOptions`, `filters/rules.ts` `resolveEmptiness`

> **Evidence discipline.** Every library claim below names the URL or package path it was read
> from, and quotes the declaration. Nothing is from recollection.
>
> **§5 is now compiled.** The four `⚠ needs a probe` claims were run on 2026-09-15 against the
> repo's own TypeScript (6.0.3) under `tsconfig.lib.json`, using an exact-match `Equal<X, Y>` helper
> — a pass means structurally identical, not merely assignable. Results are inline against each
> claim and summarised in §5.6. Three held; **one was wrong in the direction that matters**, and
> candidate B is worse than §6 originally argued. The scratch probe file
> (`src/filters/__probes__/empty-value-shapes.probe.ts`) has been deleted, per the precedent set by
> [research-typescript-inference-probes.md](../filters-inferred-state/research-typescript-inference-probes.md).
> §6's runtime and API-shape reasoning remains uncompiled.

## 1. Verdict

**The functional shape does not win as a general default, and it loses outright in this slot.**
The central claim — *a callback is more flexible because the consumer can compose with the default
instead of replacing it* — mistakes the symptom for the mechanism. What the consumer actually
needs is **additive combination semantics**. A callback is one way to deliver those, and it is the
expensive way: it buys composition by paying in inference, serializability and inspectability. When
the option's value is *data*, the cheap fix is to change how the library **combines** the
consumer's data with its own, leaving the shape alone.

The decision rule, applied to any option, in order — first line that matches decides:

| # | Test | Shape |
|---|---|---|
| 1 | The option's own type is already a function (predicate, comparator, transform, reducer) | **Pass the default back.** Composition is free — no inference or serializability to lose, you had neither. |
| 2 | The library's default is **not expressible as data** of the option's own type (it depends on runtime context the consumer cannot name — the previous value, the environment, the other options) | **Function.** There is no value to write down. |
| 3 | The option **drives a generic something downstream infers** | **Value.** A callback return type is a strictly weaker inference channel than a literal property under `const` — §5. Disqualifying here. |
| 4 | Otherwise (plain data, default expressible, nothing inferred from it) | **Value — and decide `extend` vs. `replace` explicitly, defaulting to extend.** Ship a separate total-override slot for consumers who need to subtract. |

`emptyValue` is line 3, then line 4. Both say value. The three exceptions where a function earns
its place are line 1 (`isEmpty`, `sortFn`, `accessor` — already functions), line 2 (TanStack
Query's `placeholderData: (previousData, previousQuery) => …`, Vite's
`defineConfig(({ command, mode }) => …)` — the default is a *runtime* value), and the case where
the consumer must *decline* per invocation (Zod's error map returning `undefined`).

**Ship:** make `emptyValue` **additive** at both levels — runtime `fallback.isEmpty(v) || equalsCriterion(v, override)`,
type-level `TRow[K] | null | TEmpty` with `TEmpty = never` — and promote `isEmpty` from `filter()`
to every rule as the explicit total override. Candidates **D + C** in §6. No callback in the
`emptyValue` slot.

## 2. Comparison table

Rated for an option carrying **data** (the case in hand). For an option that is already a function,
rows 4–6 are vacuous and the functional column wins by default.

| Axis | Config object (value) | Functional (`(default) => next`) | Hybrid (`T \| ((d) => T)`) |
|---|---|---|---|
| Extensibility — reaching a case the author did not anticipate | ✗ only what was enumerated | ✓ arbitrary | ✓ arbitrary |
| Composability with the library default | ✗ **unless the library combines additively — the real variable, not the shape** | ✓ default is in hand | ✓ on the function branch |
| Discoverability / autocomplete | ✓ the value's type lists the options | ✗ an opaque arrow; the default's shape is discoverable only by reading the lib | ~ value branch discoverable, function branch not |
| Type inference into surrounding generics | ✓ literal property + `const` modifier infers exactly | ✗ return-type inference widens literals; a declined or absent branch gives no inference site at all | ✗ **worse than either** — a union with a function member splits the site; the value branch stops being the sole source of `TEmpty` |
| Serializability (persist, URL, snapshot, SSR) | ✓ | ✗ | ~ unserializable the moment a consumer takes the hatch, which is the moment you cannot detect statically |
| Testability / inspectability (devtools, `expect(...).toEqual`) | ✓ compare values | ✗ compare behaviour only | ~ two shapes to assert per test |
| Migration cost from today's code | ~ a semantics change, call sites unchanged | ✗ every consumer re-learns the slot | ✗ two documented semantics forever |
| Cost of getting it wrong later | low — widen a value type | high — a callback signature is permanent public surface | high |

The row that decides this file is **inference**, and the column that loses it is **hybrid**, not
functional. A union escape hatch is usually sold as "free — the 90% case is unaffected". It is not
free when the value branch is an inference site: adding a function member to the union changes
inference on the *value* branch too.

## 3. Library survey

### TanStack Table — verified: `unpkg.com/@tanstack/table-core@8.21.3/src/*`

The most directly relevant precedent, because TanStack solved **this exact problem** — "which
filter values mean *no filter*" — and did not solve it with a value.

`src/features/ColumnFiltering.ts`:

```ts
export interface FilterFn<TData extends RowData> {
  (row: Row<TData>, columnId: string, filterValue: any, addMeta: (meta: FilterMeta) => void): boolean
  autoRemove?: ColumnFilterAutoRemoveTestFn<TData>
  resolveFilterValue?: TransformFilterValueFn<TData>
}

export type FilterFnOption<TData extends RowData> =
  | 'auto' | BuiltInFilterFn | keyof FilterFns | FilterFn<TData>
```

Three things to take:

1. **Emptiness is a predicate, co-located with the rule that owns it** — `autoRemove` hangs off the
   filter function, not off the column config. That is candidate **C** below, shipped.
2. **The default empty set is a union, in every built-in.** `src/filterFns.ts`:
   ```ts
   function testFalsey(val: any) { return val === undefined || val === null || val === '' }
   equalsString.autoRemove    = (val: any) => testFalsey(val)
   arrIncludesSome.autoRemove = (val: any) => testFalsey(val) || !val?.length
   inNumberRange.autoRemove   = (val: any) => testFalsey(val) || (testFalsey(val[0]) && testFalsey(val[1]))
   ```
   `undefined || null || ''` is precisely the set our consumer had to ask for by hand. TanStack
   never shipped a single-value `emptyValue`, so it never created the "and also" problem. The
   `||` chains inside its own defaults are what `resolveEmptiness` is missing.
3. **`FilterFnOption` is a string-or-function union** — the named-registry escape hatch (a key into
   a consumer-supplied `filterFns` record, or the function inline). That is a better hybrid than
   `T | ((…) => T)`, because the two branches have *different* types (`string` vs. function), so
   neither poisons the other's inference, and the string branch stays serializable.

Elsewhere in the same package, "pass the default back" appears twice, both at **construction/merge**
granularity rather than per-option — `src/core/table.ts`:

```ts
mergeOptions?: (defaultOptions: TableOptions<TData>, options: Partial<TableOptions<TData>>) => TableOptions<TData>
getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string
```

and `src/types.ts`:

```ts
export type Updater<T> = T | ((old: T) => T)
export type OnChangeFn<T> = (updaterOrValue: Updater<T>) => void
```

`Updater<T>` is the canonical hybrid — and note *where* it lives: state **writes**, where nothing is
inferred from the argument (`T` is already fixed by the state slice) and nothing is persisted. The
hybrid in its correct habitat.

### TanStack Query — verified: `unpkg.com/@tanstack/query-core@5.90.2/src/types.ts`

```ts
structuralSharing?: boolean | ((oldData: unknown | undefined, newData: unknown) => unknown)
placeholderData?: NonFunctionGuard<TQueryData> | PlaceholderDataFunction<…>
initialData?: TData | InitialDataFunction<TData>
initialDataUpdatedAt?: number | (() => number | undefined)
select?: (data: TQueryData) => TData
```

Four hybrids in one options interface — the strongest case *for* the union escape hatch, and worth
reading for why it works there and not here:

- The callback argument is **runtime context the consumer could not have written down**:
  `(previousData, previousQuery)`
  ([placeholder-query-data guide](https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data),
  verbatim: `placeholderData: (previousData, previousQuery) => previousData`), `(oldData, newData)`,
  "the time at which I am called". This is rule **2** of §1 — there is no default value to hand
  back, because the default *is* a value that does not exist until the query runs.
- `NonFunctionGuard<TQueryData>` exists because the union is **ambiguous whenever `TData` may itself
  be a function**. That is the tax on `T | (() => T)` in a generic slot, paid in a conditional type,
  and a warning shot for anyone adding the same union to an option whose `T` is open.
- None of the four hybrids drives a generic that a downstream mapped type folds over. `select` does
  change `TData` — and note that `select` is the **only** one of the five that is a bare function
  with *no* value branch. The one whose return type must be inferred was not given a union.

### Zod — verified: [zod.dev/error-customization](https://zod.dev/error-customization)

v4 collapsed v3's enumerated bag (`message`, `invalid_type_error`, `required_error`, `errorMap`)
into **one slot with two shapes**:

```ts
z.string("Not a string!");
z.string({ error: (iss) => iss.input === undefined ? "Field is required." : "Invalid input." });
```

The option-explosion failure mode, observed in the wild and then fixed: four declarative options,
each anticipating one occasion an error could arise, replaced by one function that receives the
occasion (`iss.code`, `iss.input`, `iss.inst`, `iss.schema`, `iss.path`, plus per-check members such
as `minimum`/`inclusive`). Two lessons:

- The fix was **not** "add a fifth option" — it was to find the one thing the four were instances
  of, per `general-mechanism-over-enumerated-cases`.
- The documented escape valve: *"Return undefined to avoid customizing the error message and fall
  back to the default message."* **The callback may decline.** That is the missing half of most
  hand-rolled `(default) => next` designs: composing with the default is one half; being able to say
  "not this one, you take it" is the other. A value-shaped option gets that for free by being
  absent.

### Angular Signal Forms — verified: [schemas](https://angular.dev/guide/forms/signals/schemas), [validation](https://angular.dev/guide/forms/signals/validation)

The closest analogue to `createFilters`, and it takes a **third** shape — neither config object nor
`(default) => next`:

```ts
const nameSchema = schema<{first: string; last: string}>((name) => {
  required(name.first);
  minLength(name.first, 2);
});

profileForm = form(this.profileModel, (schemaPath) => { apply(schemaPath.name, nameSchema); });
applyEach(schemaPath.items, (item) => { required(item.name); min(item.quantity, 1); });
```

Composition is **N declarative calls against one path, union of effects**. The docs are explicit
that rules accumulate rather than replace — *"All validation rules run — validation doesn't stop
after the first failure"* — and multiple schema applications to the same path layer together. The
customization that *is* a config object is scoped to the part with no composition question, the
message: `required(path.username, {message: 'Username is required'})`,
`min(path.age, 18, {message: …})`. Only the inherently-functional part is a function:

```ts
validate(schemaPath.website, ({value}) =>
  value().startsWith('https://') ? null : { kind: 'https', message: 'URL must start with https://' });
```

Read against our filters domain, this says the "and also" a consumer wants is expressible as a
second *declaration* — the same mechanism as `anyOf`, not a new option shape. §6 candidate **E**
follows that thread and is rejected on cost, not on principle.

### Tailwind — verified: [v3 theme docs](https://v3.tailwindcss.com/docs/theme), [v4 theme docs](https://tailwindcss.com/docs/theme)

The clearest instance of "override vs. extend is an API decision, and the default was wrong."

**v3** made replace the default and extend the opt-in, via a whole extra nesting level:

```js
theme: { extend: { fontFamily: { display: 'Oswald, ui-serif' } } }  // merged with defaults
theme: { opacity: { '0': '0', '20': '0.2' } }                       // replaces the section entirely
```

It also shipped the exact "pass the defaults back" callback under discussion:

```js
backgroundSize: ({ theme }) => ({ auto: 'auto', ...theme('spacing') })
```

— and the documented limit is instructive: this technique *only works at the top-level theme key
level, not for individual values within sections*. A callback escape hatch lives at whatever
granularity the library grants it, and that granularity is rarely the one the consumer's actual edge
case sits at. Ours would be per-rule; the consumer's problem ("also `null`") is per-value.

**v4 inverted the default.** `@theme { --font-script: … }` extends. Replacement became the explicit,
scoped opt-out:

```css
@theme { --color-*: initial; --color-white: #fff; --color-midnight: #121063; }
@theme { --*: initial; --spacing: 4px; }
```

and per the v4 docs there is **no `theme.extend` equivalent, because extend is now what `@theme`
does**. One whole nesting level of API deleted by changing a combination rule. That is candidate
**D**: additive by default, total replacement as a named, separate act.

### Vite / Rollup — verified: [vite.dev/config](https://vite.dev/config/), [vite.dev/guide/api-javascript](https://vite.dev/guide/api-javascript)

```js
export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => { … })
```

The function form exists for rule **2** — *"conditionally determine options based on the command …
the mode … if it's an SSR build"*. The callback receives **environment**, never the default config.
Vite's answer to "compose with the default" is a separate utility:

```ts
function mergeConfig(defaults: Record<string, any>, overrides: Record<string, any>, isRoot = true): Record<string, any>
```

with the documented boundary: *"`mergeConfig` accepts only config in object form. If you have a
config in callback form, you should call it before passing into `mergeConfig`."* The functional form
and the mergeable form are **mutually exclusive**, and the functional one must be collapsed back to
data before it can be composed — the composability cost of a callback, stated by a library that
ships both. Also *"null and undefined values in `overrides` are skipped and not merged"*: no way to
subtract through the merge, the same gap candidate D has and the same reason C exists alongside it.
(Vitest re-exports the same `mergeConfig` for the identical purpose.)

### webpack-merge — verified: [github.com/survivejs/webpack-merge](https://github.com/survivejs/webpack-merge)

The third answer in its purest form: neither replace nor compose-by-callback, but an explicit merge
utility with a **named strategy vocabulary**. `merge` "concatenates arrays and merges objects";
`mergeWithCustomize({ customizeArray, customizeObject })` takes `(a, b, key)` callbacks that may
**return `undefined` to fall back to default behaviour** (Zod's decline again — twice
independently is a pattern, not a coincidence); `CustomizeRule` names `append | prepend | replace |
merge` plus `match`; `unique()` handles "only one of these plugins"; `mergeWithRules` reaches inside
loader arrays.

Take: when composition genuinely has more than two modes, the modes deserve **names**
(`append`/`prepend`/`replace`), not a callback that re-implements one of them at every call site. If
`emptyValue` ever needs more than extend-vs-replace, that is the shape, not a lambda.

### ESLint flat config — verified: [configuration-files](https://eslint.org/docs/latest/use/configure/configuration-files), [configure/rules](https://eslint.org/docs/latest/use/configure/rules)

An array of config objects where *"the configuration objects are merged with later objects
overriding previous objects when there is a conflict"*, plus `extends` (v9.x) for inheritance and
`defineConfig`/`globalIgnores` helpers. The detail that earns its place here is the **partial
override**:

```js
{ rules: { semi: ["error", "never"] } },
{ rules: { semi: "warn" } }          // → ["warn", "never"]
```

Severity alone refines and keeps the inherited options; severity-plus-options replaces wholesale.
**The shape of the value the consumer writes decides replace-vs-refine** — no callback, no second
option, no flag. The cheapest mechanism in the survey, and the one worth stealing whenever an
option's value space has room to encode intent.

### Radix — verified: [primitives/docs/guides/composition](https://www.radix-ui.com/primitives/docs/guides/composition)

`asChild` — *"Radix will not render a default DOM element, instead cloning the part's child and
passing it the props and behavior required to make it functional"*, and *"`asChild` can be used as
deeply as you need to … a great way to compose multiple primitive's behavior together."* The
composition-over-config precedent at the one granularity a config object genuinely cannot reach:
arbitrary consumer render output. Not applicable to `emptyValue`; included because it marks the
boundary — when the extension point's output is *user code*, stop configuring.

### Cross-library pattern index

| Pattern | Who | Mechanism |
|---|---|---|
| Pass the runtime default back | TanStack Query `placeholderData`, `structuralSharing` | callback receives previous/new value |
| Pass the config default back | TanStack Table `mergeOptions`, Tailwind v3 `({ theme }) => …` | callback receives the default bag |
| Callback may **decline** | Zod `error` → `undefined`, webpack-merge `customizeArray` → `undefined` | falls back to library default |
| Value-or-function union | `Updater<T>`, `initialData`, `filterFn`, `structuralSharing` | escape hatch in the same slot |
| Named registry + inline function | TanStack `FilterFnOption` (`keyof FilterFns \| FilterFn`) | keeps a serializable branch |
| Additive by default, explicit total reset | Tailwind v4 `@theme` / `--*: initial` | combination rule, not shape |
| Value shape encodes replace-vs-refine | ESLint severity-only rule config | no extra API at all |
| Accumulating declarations | Signal Forms `validate` / `apply` / `applyEach` | N calls, union of effects |
| External merge utility, named strategies | webpack-merge, Vite/Vitest `mergeConfig` | third-party combination step |

## 4. Where each shape actually breaks

**Config object breaks when** (a) an option can only *replace* a default that is conceptually a
**set** or a **list** — the "and also" gap, our bug exactly; (b) the options interact, so N options
imply N² documented interactions (`emptyValue` × `isEmpty` × `source` is already three pairwise
rules in `resolveEmptiness`'s JSDoc); (c) the author must enumerate *occasions* — Zod v3's four
error options; (d) the default depends on runtime context. **(a) and (b) are fixed by changing
combination semantics, not shape.** Only (c) and (d) need a function.

**Functional breaks when** (a) the value must survive `JSON.stringify` — state persistence is a
shipped spec here (`docs/1-state/state-persistence.md`) and a filter's empty value participates in
`reset()` and snapshot restore; (b) something downstream infers a generic from it (§5); (c) the
default handed back **becomes public API** — `(ruleDefault: Emptiness) => Emptiness` freezes
`Emptiness` into the consumer contract, and `Emptiness` is today a private interface in `rules.ts`
typed `(criterion: unknown) => boolean`, useless to a consumer wanting type safety and impossible to
narrow later without a break; (d) the consumer cannot discover what the default *is* without reading
the library source.

**Hybrid is right when** the two branches carry **distinct types that do not compete for the same
inference** (`string | FilterFn`, `boolean | fn`, `number | fn`), the slot is a write/callback
boundary rather than a declaration types flow out of, and the value branch is not the sole source of
a type parameter. It is a **smell** when the union is `T | ((…) => T)` with `T` open (hence
`NonFunctionGuard`), when the value branch is an inference site, or when it is added *because a
reviewer asked "what if someone needs X"* rather than because a consumer hit X. `emptyValue` fails
all three.

## 5. Type-inference consequences

This is where the general question becomes a local one, because `#111` just made the criterion map
inferred and `StateOf<S>` folds `CriterionOf<R>` out of each rule's return type. A shape that
degrades `TEmpty` degrades the public state type of every consumer.

Today's channel (`rules.ts:77-85`) is a **literal property under a `const` type parameter**:

```ts
const TEmpty = null
options?: FilterOptions<TRow[K] | TEmpty, TAs> & { readonly emptyValue?: TEmpty }
```

`emptyValue: ''` infers `TEmpty = ''` exactly — `const` preserves the literal. Four claims about
what the alternatives do to that channel. **All four were compiled on 2026-09-15**; each verdict
is recorded against its claim.

Baseline first, confirming the shipped behaviour everything else is measured against:

```ts
const baseDefault  = equals(path.status);
const baseOverride = equals(path.status, { emptyValue: '' });

Equal<CriterionOf<typeof baseDefault>,  string | null>   // PASS
Equal<CriterionOf<typeof baseOverride>, string>          // PASS — the subtraction, confirmed
```

1. **A function's return type is a weaker channel than a literal property.** The `const` modifier
   applies to inference from the *argument expression*; the return type of an arrow argument is
   inferred from its body, where literals widen unless the body itself says `as const`. So
   `emptyValue: (d) => ({ ...d, emptyValue: '' })` should yield `string`, not `''`.
   *Assert:* `Equal<CriterionOf<typeof rule>, 'x' | null>` for both the literal and the arrow form;
   expect the literal to pass and the arrow to widen.
   **PASS — and the literal branch survives the union.** `equalsB(path.status, { emptyValue: '' })`
   still yields `string`. Adding a function member to the union does not damage the value branch;
   all the damage lands on the function branch. See claim 2.
2. **A union with a function member splits the inference site.** With
   `emptyValue?: TEmpty | ((d: Emptiness) => Emptiness)`, `TEmpty` has a candidate only on the value
   branch; on the function branch it falls back to its default. The same call site then yields
   `TRow[K] | null` or `TRow[K] | ''` depending on *which syntax the consumer used* — exactly the
   coupling `#111` removed. *Assert:* both branches against `Equal<…>`; expect divergence.
   **FAIL — understated, twice over.**

   *(a) In the real signature shape it does not compile at all.* `emptyValue` is declared in **both**
   intersection members (`FilterOptions<TRow[K] | TEmpty, TAs>` already declares it), so its type is
   `(TRow[K] | TEmpty) & (TEmpty | fn)` and the arrow satisfies neither half:

   ```
   TS2322: Type '(d: Emptiness) => { emptyValue: string; isEmpty: (criterion: unknown) => boolean; }'
     is not assignable to type 'string & ((ruleDefault: Emptiness) => Emptiness)'.
   ```

   *(b) Lift `emptyValue` out of `FilterOptions` so the union is its sole declaration and it does
   compile — but `TEmpty` takes the **callback itself** as its inference candidate. It does not fall
   back to the `null` default as predicted. The criterion type absorbs a function member:*

   ```ts
   CriterionOf<typeof bpArrow>
   //  = string | ((d: Emptiness) => { emptyValue: string; isEmpty: (criterion: unknown) => boolean })
   ```

   `StateOf<S>` would publish that to every consumer — `filters.status().value` becomes a signal
   that accepts a function. Not divergence, **contamination**. B is disqualified on inference alone,
   before any of its runtime or serializability costs are weighed.
3. **A callback parameter is an inference site, but low-priority and contravariant.**
   `isEmpty?: (criterion: TCriterion) => boolean` adds a second site for `TCriterion`. `filter()`
   already has two (`predicate`'s second parameter and `options.isEmpty`) and its JSDoc records a
   **compiled** result (2026-09-14): the predicate site is inferred first and wins, and a mismatch
   is a hard `TS2322` at the `options` argument, not a silent widening. On `equals`, `TCriterion` is
   *already fixed* by `path` and `emptyValue`, so `isEmpty`'s parameter should be contextually typed
   **from** the rule rather than contributing to it. That is the desired direction and why C is
   cheap. *Assert:* in `equals(path.status, { emptyValue: '', isEmpty: (v) => … })`, `v` is
   `string | null` and no inference flows back out of it.
   **PASS on the mechanism, with one correction to the assertion's own wording.** `v` is
   contextually typed from the rule and contributes nothing back, exactly as claimed. But under
   *today's* subtractive `TEmpty`, `v` is `string`, not `string | null` — the override has already
   removed `null` by the time `isEmpty` is typed. With no `emptyValue`, `v` is `string | null`:

   ```ts
   equalsC(path.status, { emptyValue: '', isEmpty: (v) => … })   // v: string         PASS
   equalsC(path.status, {                 isEmpty: (v) => … })   // v: string | null  PASS
   ```

   So C inherits whatever D decides about the domain; it does not widen it on its own. That is an
   argument for shipping C together with D, not for either alone.
4. **Widening the declared union is inference-neutral.** `TRow[K] | null | TEmpty` with
   `TEmpty = never` adds a member to the *result*, not a new inference site; `TEmpty` is still
   inferred solely from the literal `emptyValue` property. Candidate D therefore costs nothing at
   the inference layer. *Assert:* default call `Equal<…, string | null>` (unchanged from today) and
   override call `Equal<…, string | null>` (today: `string`).
   **PASS on every count — five assertions, all green:**

   ```ts
   Equal<CriterionOf<typeof equalsD(path.status)>,                    string | null>  // unchanged
   Equal<CriterionOf<typeof equalsD(path.status, {emptyValue: ''})>,  string | null>  // was `string`
   Equal<CriterionOf<typeof equalsD(path.amount, {emptyValue: -1})>,  number | null>  // non-null empty
   dNode.value.set(null);   // compiles with NO suppression — this is D4's test line
   dNode.value.set(42);     // still rejected — D widens by `null` only, not toward `unknown`
   ```

   D costs nothing at the inference layer, restores `null` to the criterion domain under an
   override, leaves the default untouched, and does **not** loosen the type in any other direction.
   The `@ts-expect-error` at `create-filters.spec.ts:~218` comes off.

Short version: **in this codebase the criterion type is data-derived, so the option that declares it
must stay data.** A callback in that slot is disqualified by (1) and (2) before the runtime argument
is reached.

### 5.6 Probe results, summarised

Compiled 2026-09-15, TypeScript 6.0.3, `tsconfig.lib.json`, exact-match `Equal<X, Y>`.

| # | Claim | Verdict |
|---|---|---|
| — | Baseline: `equals` yields `string \| null`, narrowing to `string` under `emptyValue: ''` | **PASS** |
| 1 | A function's return type is a weaker inference channel than a literal property | **PASS** — and the literal branch is undamaged by the union |
| 2 | A union with a function member splits the inference site, causing divergence | **FAIL, understated** — hard `TS2322` in the real shape; with the intersection lifted, `TEmpty` absorbs the callback and the criterion type gains a function member |
| 3 | A callback parameter is contextually typed from the rule, contributing nothing back | **PASS** on the mechanism — but `v` follows whatever `TEmpty` resolves to, so C alone does not widen the domain |
| 4 | Widening the declared union (`TRow[K] \| null \| TEmpty`) is inference-neutral | **PASS**, 5/5 including D4's suppressed line |

The one wrong claim strengthens the recommendation rather than weakening it: B was the runner-up,
and it is now disqualified by a compiler error rather than by a judgement call. **D + C stands.**

## 6. `emptyValue`, worked out

Against the real signatures. The runtime site is `resolveEmptiness` (`rules.ts:66`); the type site
is each rule's `TEmpty`; the three consumers of the resolved pair are `state.ts:75`
(`signal(emptyValue)` — the seed), `state.ts:83` (`reset(null)` → `value.set(emptyValue)`) and
`state.ts:89` (`isEmpty(value()) ? undefined : value()` — the gate).

**Root cause: one option carries two jobs.** `emptyValue` is simultaneously a *value* (the seed and
reset target — necessarily exactly one) and a *set membership test* (which criteria deactivate the
filter — naturally many). Replacing is correct for the first job and wrong for the second. Every
candidate below is a different way of splitting or reconciling those two jobs.

### A — status quo: `emptyValue: T` replaces both

```ts
function resolveEmptiness(options, fallback: Emptiness): Emptiness {
  const override = options?.emptyValue;
  if (override === undefined) return fallback;
  return { emptyValue: override, isEmpty: (v: unknown) => equalsCriterion(v, override) };
}
```

Discoverable, serializable, inferable, one option. Cannot express "and also", and the type-level
half *subtracts*: `TRow[K] | TEmpty` with `TEmpty` inferred as `''` drops `null` from the criterion
domain — which is why the third case in `describe('createFilters — emptyValue override')`
(`create-filters.spec.ts:~218`) needs a `@ts-expect-error` to write `null` at all. **The suppression
is the bug report.** Reject.

### B — union escape hatch

```ts
readonly emptyValue?: TEmpty | ((ruleDefault: Emptiness) => Emptiness);
```

```ts
equals(path.status, {
  emptyValue: (rule) => ({ emptyValue: '', isEmpty: (v) => v === '' || rule.isEmpty(v) }),
})
```

Maximally flexible, and every other problem in §2's table at once. It promotes the private
`Emptiness` interface (`(criterion: unknown) => boolean`) to public API, so the consumer composes
against an `unknown`-typed predicate and gets no type safety in the very callback meant to give them
control. It breaks the criterion channel per §5.2 — **and the compiled probe is worse than that
sentence: in the real signature the arrow is a hard `TS2322`, because `emptyValue` is declared in
both intersection members; lift the intersection and `filters.status().value` becomes a signal whose
accepted type includes the callback itself**. It defeats `state-persistence.md`'s snapshot story for any filter that takes the
hatch. And it names a slot `emptyValue` that may contain neither a value nor an empty. Note that
TanStack Query's four hybrids all pass *runtime* context and none is an inference site; this one is
neither. Reject.

### C — promote `isEmpty` to every rule

```ts
options?: FilterOptions<TRow[K] | null | TEmpty, TAs> & {
  readonly emptyValue?: TEmpty;
  readonly isEmpty?: (criterion: TRow[K] | null | TEmpty) => boolean;
}
```

`filter()` already has this and already documents the precedence — *an explicit `isEmpty` wins over
both* — with a passing test. This is TanStack's `autoRemove` shape and rule **1** of §1: the
option's type is already a function, so composition is free and costs no inference (§5.3). It is the
**only** candidate that can *subtract* — make `null` a meaningful, non-empty criterion value.

On its own it does not fix the reported bug: the consumer must restate the rule's own check by hand
(`v === '' || v == null`), which is the duplication D4 complained about, and the criterion type
still narrows via `TEmpty` unless D lands with it. Ship it as the escape hatch, not the answer.

### D — make `emptyValue` additive (**recommended**, with C)

Two one-line changes.

```ts
function resolveEmptiness(
  options: { readonly emptyValue?: unknown; readonly isEmpty?: unknown } | undefined,
  fallback: Emptiness
): Emptiness {
  const explicit = options?.isEmpty as ((v: unknown) => boolean) | undefined;
  const override = options?.emptyValue;
  if (explicit) {
    return { emptyValue: override === undefined ? fallback.emptyValue : override, isEmpty: explicit };
  }
  if (override === undefined) {
    return fallback;
  }
  return {
    emptyValue: override,
    isEmpty: (v: unknown) => fallback.isEmpty(v) || equalsCriterion(v, override),
  };
}
```

```ts
export function equals<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never,
  const TEmpty = never                                   // was: = null
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<TRow[K] | null | TEmpty, TAs> & { readonly emptyValue?: TEmpty }
): FilterRule<RuleKey<K, TAs>, TRow[K] | null | TEmpty, TRow>;
```

The rule's declared empty (`null` for `equals`, `''` for `contains`, the null range for
`inRange`/`inDateRange`, `[]` for `hasAny`/`hasNone`) moves from *a default `TEmpty` an override
displaces* to *a fixed union member an override joins*. `TEmpty` defaults to `never`, so the
no-options criterion type is `TRow[K] | null` — byte-identical to today. With `emptyValue: ''` it
becomes `string | null`: what the consumer meant, and what the deleted hand-written map used to say.

- **Runtime:** `''` **and** `null` both deactivate. The reported bug closes.
- **Types:** the `@ts-expect-error` comes off the third spec case — it stops being an
  untyped-caller backstop and becomes a real assertion. D4's cost line is retired.
- **Inference:** neutral (§5.4). Nothing new is inferred; one more union member is emitted.
- **Serializable, autocompleted, diffable, `toEqual`-assertable:** unchanged.
- **Precedent:** Tailwind v4's inversion; TanStack's `||`-chained `autoRemove` defaults.

**Cost — the honest one.** This is a **behaviour change to a shipped option**, and one existing test
inverts: `it("no longer treats the rule's own empty value as empty once overridden")` becomes
`it("keeps the rule's own empty value empty alongside the declared one")`. A consumer relying on an
override to *narrow* the empty set loses that and gets it back only through `isEmpty` (C). The JSDoc
on `FilterOptions.emptyValue` ("replacing the rule's own") and on `resolveEmptiness` ("rather than
the rule's — `equals` declaring `v == null` cannot speak for a caller who chose `''`") both assert
the substitutive semantics verbatim and are the spec; they must be rewritten in the same commit.
That old sentence is worth answering directly: the caller who chose `''` is not contradicting the
rule's `null`, they are adding to it — which is why the additive reading is the right default and
why the subtractive reading needs its own slot.

Precedence after D+C, one line: **`isEmpty` replaces; `emptyValue` extends and seeds; with neither,
the rule's own holds.**

### E — additive set: `emptyValue?: TEmpty | readonly [TEmpty, ...TEmpty[]]`

```ts
equals(path.status, { emptyValue: ['', null] })   // first element seeds; all count as empty
```

Tempting: one slot, still data, and `const TEmpty` should infer `'' | null` straight into the
criterion union — fixing types and runtime together *without* changing an existing option's meaning
(no behaviour break, no test inversion). Rejected on two counts. It is ambiguous exactly where it
must not be: `hasAny`/`hasNone` have array criteria, so `emptyValue: []` cannot be told apart from
"an empty set of empty values", and disambiguating needs a conditional type keyed on whether
`TCriterion` is an array — machinery of the kind `simplest-type-signature-first` rules out. And it
still leaves the rule's own empty out of the set unless the consumer retypes it, so it solves "and
also `null`" only by making the consumer write `null`; the duplication stays. D reaches the same
outcome with less at the call site. Revisit only if D's behaviour change breaks a real consumer.

### Recommendation

**D + C.** D is the default and the fix; C is the named, separate act of total replacement — already
half-shipped on `filter()`, already precedented by TanStack's `autoRemove`. No callback enters the
`emptyValue` slot. Scope: `rules.ts` (`resolveEmptiness` + the six rule signatures), `types.ts`
(`FilterOptions.emptyValue` JSDoc), the spec block at `create-filters.spec.ts:197`, and the "Empty
criteria" section of `docs/1-state/filters.md`.

> **Shipped 2026-09-16 — [#116](https://github.com/DvirMon/acme/issues/116).** Two deltas against
> the scope above, both found at implementation:
>
> - **C landed on `FilterOptions`, not on six rule signatures.** `isEmpty?: (criterion:
>   NoInfer<TSource>) => boolean` on the shared interface reaches every rule at once, and `NoInfer`
>   is what stops the callback typing the criterion a second time. `filter()`'s own local
>   declaration was deleted as redundant. That also closes open question 2 in
>   [`filters-inferred-state/architecture.md`](../filters-inferred-state/architecture.md).
> - **One in-repo consumer paid D's stated cost.** All three filtering story hosts bound a native
>   `<select>` to `equals(path.status, { emptyValue: '' })` and relied on the *narrowing* D
>   removes. They now declare `filter(path.status, matchesStatus, { emptyValue: '' })` — an
>   explicit `string` criterion — which keeps `[formField]` binding with no accessor. #97 stays
>   closed; only the mechanism moved. Worth noting for §7: a shape that widens a public type
>   relocates work to call sites that were relying on the narrow one.

### 6.1 `reset(null)` — folded in, decided: keep the sentinel

D changes what `reset`'s parameter type can express, so this belongs to the same job rather than
a follow-up.

`FilterNode.reset` is declared `reset(value?: TCriterion | null): void` with three modes
(`state.ts:79`): `undefined` → back to the source, `null` → back to `emptyValue`, any other value
→ set it. Today, under `emptyValue: ''`, the criterion is `string`, so `null` in that position is
unambiguously the sentinel. **Under D the criterion becomes `string | null`, so `TCriterion | null`
collapses to `TCriterion` and the type no longer separates "clear me" from the literal `null`.**
After D that applies to every rule, because every rule's declared empty joins its criterion union.

**Decision (2026-09-15): keep the sentinel, document it.** No new method, no exported token, no
change at any call site. A consumer who wants to write the literal `null` uses `value.set(null)`;
`reset(null)` keeps meaning *clear*.

What makes this cheap rather than a deferred bug — and the reason the decision is defensible in a
way it would not have been before D: under D, `null` **is** an empty criterion whenever the rule
declares it, so both readings deactivate the filter. The two paths differ only in what `value()`
holds afterwards (`''` vs `null`) and therefore in `dirty()`. Before D the same ambiguity would have
produced two genuinely different outcomes — one active filter, one inert.

Rejected: a separate `clear()` method (correct, but a breaking change at every `reset(null)` call
site for an ambiguity that D itself defuses); an exported `EMPTY` token (unambiguous, but an
imported constant for the same reason); and deferring to a new issue (the type-level collapse is
caused *by* D, so it is not separable from it).

**Carries into the implementation:** `FilterNode.reset`'s JSDoc in `types.ts` must state the
sentinel explicitly and point at `value.set(null)` for the literal — the type cannot. The same
applies to the root `Filters.reset(value?: Partial<TState> | null)` (`state.ts:203`), where `null`
means *clear every node*.

## 7. Generalized heuristic — for the next option

Apply in order; first match decides. None of it is about "flexibility" in the abstract.

1. **Name the option's job: a *value* or a *test*.** A value has exactly one instance (a seed, a
   default, a target). A test is a *set*, and a set always eventually attracts "and also". An option
   doing both jobs is the bug — split it. That is `emptyValue`'s entire story and the
   highest-yield question on this list.
2. **If the option's type is already a function, hand back the default.** Zero cost — there was no
   serializability or inference to lose. And give the callback a way to **decline** (return
   `undefined` → library default), per Zod and webpack-merge. A callback that can only override is
   half an API.
3. **If it is data, do not reach for a callback. Decide the combination rule, default it to
   additive.** Extend-by-default with an explicit, separately-named total reset (Tailwind v4) beats
   replace-by-default with an `extend:` nesting level (Tailwind v3), and both beat a lambda. Write
   the precedence as one sentence of JSDoc; if it takes three, the options are interacting and
   there are too many.
4. **Before adding an option, check whether the value's own shape can encode the intent.** ESLint's
   severity-only refinement adds zero API surface. A tuple, a sentinel, an optional second member —
   cheaper than a flag or a callback, and still serializable.
5. **Check the inference ledger before the ergonomics.** If anything downstream infers a generic
   from this slot, it must stay data — a callback return type widens literals, and an absent branch
   infers nothing. In this library: **any option feeding `StateOf`/`CriterionOf` is value-only, full
   stop.**
6. **A union escape hatch is a decision, not a hedge.** Add `T | ((…) => T)` only when the branches
   carry different types (so neither poisons the other's inference), the slot is a write/callback
   boundary rather than a declaration types flow out of, and a real consumer has hit the wall.
   "Someone might want X" is not the wall. If you need both a serializable and a functional branch,
   prefer a **named registry** (`keyof Fns | Fn`) over `T | ((…) => T)`.
7. **When three or more combination modes appear, name them.** `append`/`prepend`/`replace`
   (webpack-merge) beats a lambda that re-implements one of the three at every call site.
8. **When the extension point's output is consumer *code* rather than consumer *data*, stop
   configuring** — `asChild` / render-prop territory, which no options bag reaches.

The one-line test, if only one survives: **does the consumer need to compose with something the
library cannot write down?** If yes, a function. If the default is a value you could have typed into
the docs, the answer is a better combination rule, not a lambda.
