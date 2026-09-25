---
title: Columns Schema — Signal Forms Techniques to Adopt
type: architecture
version: 0.1
date: 2026-07-24
status: drafted — some are open decisions (flagged)
audience: developers
parent: ../architecture.md
---

# Signal Forms Techniques to Adopt

Seven techniques mined from fetched `angular/angular` Signal Forms source
(`packages/forms/signals/src/`), each portable to the schema argument. Two (§1, §2) are
**architectural and reverse a settled decision** — written as open decisions. The rest (§3, §6, §7)
are cheap correctness/ergonomic wins to adopt regardless; §4, §5 are power features to defer.

---

## 1 — Generic `metadata()` + reducer, instead of N bespoke `apply*` ✅ decided 2026-07-25 — hybrid

Signal Forms does **not** hand-code a function per field property. One primitive
`metadata(path, KEY, value)` (`api/rules/metadata.ts:33`), where each `MetadataKey` carries a
**reducer** defining how multiple contributions to the same key combine (`metadata.ts:72-131`):

```ts
MetadataReducer = { list, min, max, or, and, latest }   // metadata.ts:72-131
```

The [Feature Catalog](../architecture.md#feature-catalog) is ~12 bespoke `apply*`. Signal
Forms' model would be ~12 `MetadataKey`s sharing **one** `metadata()` primitive. Reducers give
behavior for free:

- `min`/`max` → column width clamp (`applyWidth` `opts.min/max` fall out of this).
- `or`/`and` → visibility combine.
- `latest` → last-wins (the current `patchState` overwrite semantics).
- `list` → accumulate multiple filter predicates.

**Decided: hybrid.** Bespoke typed `apply*` stays the public surface (better DX, discoverable,
type-narrowed per property). Internally, every `apply*` is a thin wrapper over one generic
`applyMeta(path, KEY, value)` + reducer **core**, so Tier 2/3 additions need no new resolution
machinery per property — only a new `MetadataKey` + reducer registration. This is also how Signal
Forms itself is built: `disabled()`/`hidden()`/`readonly()` are typed wrapper functions over the one
generic `LogicNode`/reducer mechanism (`schema/logic_node.ts`, `api/rules/metadata.ts`) — not
independent implementations. Implementation touches `schema/column-rules.ts` (the shared
`applyMeta` core) and each `apply*` in the tier files (becomes a wrapper call).

---

## 2 — Reducers replace conflict-rejection ✅ decided 2026-07-25 — reducer-combine (reverses the earlier settled decision)

The hub's Decisions say: *throw at build time on two `visible` rules for one column.* Signal Forms
does the opposite — rules **accumulate** into an array and combine
(`schema/logic_node.ts:105` `all: [...]`, `:245-250` `logic.hidden.push(...)`). Multiple `hidden`
rules coexist, reduced (visibility = OR: hidden if any rule hides).

So the real choice is **not** "reject conflicts" — it's "pick a reducer." `or` for visibility is
arguably more useful than throwing: two independent permission checks, hide if either fails, no
authoring error. 

**Decided: reducer-combine, superseding the hub's "conflicting `visible` rules rejected at build
time" decision.** Made cheap by §1's generic reducer core landing — no separate conflict-rejection
code path needed, each `MetadataKey`'s reducer *is* the conflict resolution. Default reducer per
property: `visible` → `and` (visible only if every rule says visible — a permission check hiding a
column should always win over a rule that shows it, the safer default for gating sensitive data);
revisit per-property if a real case wants `or` instead. Build-time rejection is dropped entirely —
no property in Tier 1–3 keeps throw-on-conflict.

---

## 3 — `{ when }` object form, not bare `fn` ✅ adopt

`hidden(path, { when: fn })` — and Signal Forms **deprecated passing a raw function**
(`api/rules/hidden.ts:45-50`) because the `boolean | fn` overload is ambiguous. The early
`visible(path, boolean | fn)` draft had exactly that ambiguity. Adopt `{ when }` for the
reactive shape, bare `boolean`/value for static — no overload guessing. Already reflected in the
[Ownership model](ownership-model.md) and tier files.

---

## 4 — `applyEach` / wildcard path — "apply to every column" ⏳ defer

`applyEach` targets a special `DYNAMIC` child key that matches all elements
(`api/structure.ts:288` → `getChild(DYNAMIC)`). Column analog: a wildcard handle to set defaults
across **all** columns at once — `applyEnableSorting(path.$all, true)`, a default min-width. No
per-column repetition. Defer until a real consumer needs cross-column defaults.

---

## 5 — `apply(path, schema)` + `schema()` reuse ⏳ defer — revisits "no composability"

`schema<T>(fn)` packages reusable rule bundles; `apply(path, schema)` merges one onto a path
(`api/structure.ts:315-323`, `:509`). The hub's Grounding declined this ("no reusable cross-form
schemas"). But for columns it enables reusable archetypes — a `moneyColumn` (width + right-align +
formatter) applied to many columns/tables:

```ts
const moneyColumn = columnSchema<Product>((c) => { applyWidth(c, 120); applyAlign(c, 'right'); });
apply(path.price, moneyColumn);
```

`applyWhen(path, predicate, schema)` (`api/structure.ts:338-347`) extends this to conditional
bundles (e.g. a compact schema when viewport is small — predicate-gated whole group). Defer until an
archetype need is real; revisit the hub's "no composability" grounding then.

---

## 6 — `assertPathIsCurrent` — guard stale path handles ✅ adopt

Every rule call asserts the path belongs to the *currently running* schema fn
(`api/rules/hidden.ts:58`, `api/structure.ts:286,319`). Catches a `path.x` captured and reused
outside its `schemaFn`. Cheap correctness win — `columnSchema()` should assert the same, since its
`path` proxy is the same structural design.

---

## 7 — `NoInfer` on schema args — typing hygiene ✅ adopt

Schema value args are wrapped in `NoInfer<...>` (`api/structure.ts:276,317,341`) so the rule value
can't widen `TRow`. Portable directly to the `apply*` signatures.

---

## Adoption summary

| # | Technique | Verdict | Touches |
|---|---|---|---|
| 3 | `{ when }` object form | ✅ adopt now | all `apply*` signatures |
| 6 | `assertPathIsCurrent` | ✅ adopt now | `create-columns.ts` |
| 7 | `NoInfer` args | ✅ adopt now | `schema/column-rules.ts` |
| 1 | metadata + reducer core | ✅ decided — hybrid (bespoke public, generic internal) | `schema/column-rules.ts` core + each tier's `apply*` |
| 2 | reducer vs reject | ✅ decided — reducer-combine (`and` default for `visible`) | hub Decisions, supersedes build-time rejection |
| 4 | `applyEach` wildcard | ⏳ defer | future |
| 5 | `apply`/`schema` reuse | ⏳ defer (revisits grounding) | future |
