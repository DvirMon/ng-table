---
title: Columns Schema — Column Metadata (`createColumnMetaKey` / `metadata` / `readColumnMeta`)
type: architecture
version: 0.1
date: 2026-08-19
status: implemented
audience: developers
parent: ../architecture.md
---

# Column Metadata

A consumer-facing side channel for attaching arbitrary data to a column, modeled directly on
Angular Signal Forms' `createMetadataKey()` / `metadata()` / `field().metadata(key)`
(https://angular.dev/guide/forms/signals/field-metadata).

## Not the same thing as `signal-forms-techniques.md` §1's _generic per-key reducer_

[signal-forms-techniques.md §1](signal-forms-techniques.md#1--generic-metadata--reducer-instead-of-n-bespoke-apply--decided-2026-07-25--hybrid)
sketches an _internal_ generic `metadata()` + reducer core, where every rule function (`visible`,
`applyWidth`, ...) routes through this mechanism and each key declares its own reducer
(`and`/`or`/`min`/`max`/...). That generic-reducer system is still **not implemented** — only
one key was actually wired up this way: `visible`/`visibleAsync` now call this doc's
`metadata()`/`metadataAsync()` targeting the internal `VISIBLE` key (`engine/columns.ts`), with
AND-combine hardcoded for that one key in `foldColumnRules`, not a general per-key reducer
table. `applyWidth`/`applyFlex`/`applyPinned` etc. are untouched — still plain seed fields, not
routed through metadata at all. Do not conflate "one key got a hardcoded exemption" with "the
generic reducer core landed":

|                    | §1's generic reducer core                                                      | This doc's mechanism                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Who calls it       | Every rule function would route through it                                     | Consumer code directly, plus `visible`/`visibleAsync` (→ `VISIBLE`)                                                                         |
| Engine involvement | Would drive every `ColumnDef` field the engine reads (`visible`, `width`, ...) | Only `visible`, via the one `VISIBLE`-key exemption; everything else lands in `ColumnDef.meta` and the engine never looks at it again       |
| Conflict handling  | Per-key declared reducer (`and`/`or`/`min`/`max`/...)                          | Single-writer by default — a second registration for the same `(column, key)` throws; `VISIBLE` is the sole hardcoded AND-combine exception |
| Status             | Drafted, not implemented                                                       | Implemented (including the `VISIBLE` wrapper)                                                                                               |

## API

```ts
function createColumnMetaKey<T>(): ColumnMetaKey<T>;

function metadata<TRow, K extends Extract<keyof TRow, string>, T>(
  path: ColumnHandle<TRow, K>,
  key: ColumnMetaKey<T>,
  logic: T | ((ctx: ColumnRuleContext<TRow>) => T),
): void;

function readColumnMeta<T>(column: ColumnDef<unknown>, key: ColumnMetaKey<T>): T | undefined;
```

- `createColumnMetaKey<T>()` mints a key whose **object identity** is the actual key — call it
  once per logical key and share the returned value (module-level constant), the same as Signal
  Forms' `createMetadataKey()`.
- `metadata(path.col, KEY, logic)` is called inside a `columnSchema()` / inline schema
  fn, alongside `visible`/`visibleAsync`. `logic` is either a plain value or a closure
  over the same `ColumnRuleContext<TRow>` those two rules read (`ctx.columns()` — reactive,
  resolves to `baseColumns`, never the derived `columns`, same D8 rationale). Both forms are
  supported and resolved the same way — a plain value doesn't need wrapping.
- `readColumnMeta(column, KEY)` reads a registered value back off a resolved `ColumnDef`.
  Returns `undefined` if nothing was registered for that `(column, key)` pair.

### `ctx.stateOf(path)` — reading one other column's config (#117)

`ColumnRuleContext<TRow>` gained a second member alongside `columns`:

```ts
interface ColumnRuleContext<TRow> {
  readonly columns: () => ColumnDef<TRow>[];
  stateOf<K extends string>(
    handle: ColumnHandle<TRow, K, unknown>,
  ): Pick<ColumnDef<TRow>, 'visible' | 'label' | 'meta'>;
}
```

`stateOf(path.other)` is the bound-tier resolver from
[ADR-0027 Rule 3](../../adr/0027-schema-declaration-surface.md#rule-3--resolvers-come-in-two-tiers-and-the-tier-decides-the-arity)
for "how is this column configured?" — it reads a declaration, not data, so it takes only a path,
no subject. It replaces a `ctx.columns().find((c) => c.id === 'other')` string-keyed lookup with a
typed, path-checked read. No `order` field — `ColumnDef.order` is a separate concern this resolver
does not expose. `columns` is unchanged and stays available for anything reading the raw array
(counting, filtering across every column) rather than one other column's state. Resolves against
`baseColumns`, same as `columns` — never the derived, folded `columns` signal, for the same
cycle-avoidance reason. Naming an undeclared column id through `stateOf` throws
`[createColumns] Unknown column id "…"`, dev-gated, at the same construction check `metadata`'s
own column ids already use — not a separate one.

## Deliberate scope cut: single-writer only (except the internal `VISIBLE` key)

`metadata()` has **no reducer** for consumer keys. Two `metadata()` calls targeting the same
`(columnId, key)` pair throw synchronously at `resolveColumnsConfig()` time
(`assertMetadataKeysAreUnique` in `engine/columns-schema/resolve.ts`) — the same
build-time-throw posture `resolveColumnsConfig()` already uses for an unknown `columnId`.

This is a scope cut, not an oversight: the table has no scenario yet where two independent
sources need to contribute to the same _consumer_ metadata key. Revisit only if a real
multi-writer need surfaces — the fix is adding a reducer to `ColumnMetaKey` itself, the same
`MetadataReducer`-shaped extension §1 describes, not a redesign of the recording/resolution
path.

The one existing exception is `VISIBLE`, the unexported internal key `visible()`/
`visibleAsync()` (`schema/column-rules.ts`) write to — see "Column visibility is now a
`metadata()` convenience wrapper" below. It's exempted from the single-writer check
and AND-combined instead (`engine/columns.ts`'s `foldColumnRules`), because
multiple `visible()` calls on one column has always been legal and combines that way.
This is the table's one deliberate multi-writer key, mirroring how Signal Forms' `required()`/
`minLength()` sit on top of its own internal metadata + reducer core while consumer
`metadata()` stays single-writer.

## Column visibility is now a `metadata()` convenience wrapper

`visible(path, { when })` and `visibleAsync(path, opts)` (`schema/column-rules.ts`) are
no longer a separately-resolved rule kind — they're convenience wrappers that call
`metadata(path, VISIBLE, when)` (sync) / an internal `metadataAsync(path, VISIBLE, opts)`
(resource-backed) under the hood, where `VISIBLE: ColumnMetaKey<boolean>` lives in
`engine/columns.ts` and is never exported from `index.ts`. Public signatures are unchanged —
this is purely an internal implementation swap. `engine/columns.ts`'s `foldColumnRules` derives
`column.visible` by reading the `VISIBLE` key's AND-combined resolved value instead of
switching on a `visible`-vs-`meta` rule kind, so there is exactly one resolution path
(the metadata fold) for both visibility and consumer metadata.

## Static-or-reactive: both supported by default

`logic` accepts a plain `T` or `(ctx: ColumnRuleContext<TRow>) => T`, discriminated at wiring
time (`typeof rule.logic === 'function'`) in
`engine/columns-schema/wiring.ts`'s `buildMetadataEntries`. Both forms are wrapped in
the same `computed()` — a static value just never changes. This matches Signal Forms' own
`metadata()`, where a plain value "just works" without an explicit wrapper.

## `ColumnDef` extension: a `meta` bag + free reader function, not a `.metadata()` method

Signal Forms' `field().metadata(key)` is a method on a field _handle_ — a class-shaped object
with its own identity and lifecycle. `ColumnDef<TRow>` in this table is the opposite: a plain,
flat interface, always a fresh object produced by `resolveColumnDefs`/`foldColumnRules`, never a
class or handle (`table/CLAUDE.md`'s locked invariants — `rows()` and, by the same logic,
`columns()` never return wrapper objects).

Given that, `.metadata(key)` as an instance method doesn't fit naturally — it would require
turning `ColumnDef` into a class, which conflicts with every other place in the engine that
treats `columns` as plain data (`foldColumnRules`, `applyColumnOrder`, `setColumnVisible`, all
pure `ColumnDef[] → ColumnDef[]` transforms with no methods).

**Resolution:** `ColumnDef.meta?: ReadonlyMap<ColumnMetaKey<unknown>, unknown>` is a plain bag
field (`api/types.ts`), populated by `foldColumnRules` (`engine/columns.ts`) the same fold pass
that already writes `visible`. Reading is a **free function**, `readColumnMeta(column, key)`
(`schema/column-metadata.ts`) — not a method — consistent with `updateColumns`/`updateRows`
already being free functions that take their target as the first argument rather than store
methods. One fact ("how do you read/write column state"), one convention, no exception carved
out for metadata.

## Wiring — one recorder → resolve → wiring → fold path, no `visible`/`meta` split

`metadata()` records a `MetadataRule<TRow>` (`kind: 'metadata'`); `visible`/
`visibleAsync` record the same `MetadataRule` (sync) or a `MetadataAsyncRule<TRow>`
(`kind: 'metadata-async'`, resource-backed) — all three go onto the same
`ColumnSchemaRecorder` (`schema/column-schema.types.ts`'s `ColumnRule` union).
`createColumns()`'s resolution validates every rule
the same way (`columnId` known, plus the single-writer check, `VISIBLE`-exempted).
`wireColumnsSchemaAsync` (`engine/columns-schema/wire-columns-schema.ts`) builds a
`ColumnRuleEntry<TRow>` — `{ columnId, key, result }`, one shape, no discriminant — per rule
via `buildMetadataEntries`/`buildAsyncMetadataEntry` (`wiring.ts`) and contributes them to the
same flat `columnRules` registry `foldColumnRules` (`engine/columns.ts`) folds every render:
group by `(columnId, key)`, AND-combine `VISIBLE` groups into `column.visible`, single-value
every other key into `column.meta`. `engine/core.ts`'s
`columns = computed(() => foldColumnRules(baseColumns(), columnRules))` stays single-pass with
zero new call sites.
