# Step 2 — Add the row-type token

**PR scope:** PR 1 of 2 (`#110`). **Parallel-safe with: Step 1.** **Blocks Step 4, Step 6.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `typescript-conventions`, `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/filters/row-of.ts` | **create** |

One concern, one file. It imports nothing from the domain and nothing imports it until Step 4.

## Why This Step Exists

Server mode declares filters before any rows exist, so there is no data to infer the row type from.
Naming the row type as a type argument is not an option — partial type-argument inference does not
exist in TypeScript, so naming one parameter would force the other, which is the whole problem this
issue removes.

`rowOf<Row>()` is the escape hatch: a phantom value carrying only a row type, accepted in the same
argument slot as real data. It is self-contained and depends on nothing else in the change, which
is why it runs beside Step 1 rather than after it.

## What To Do

```ts
declare const ROW_TOKEN: unique symbol;

export interface RowToken<TRow> {
  readonly [ROW_TOKEN]: TRow;
}

export function rowOf<TRow>(): RowToken<TRow>;
```

1. The symbol is `declare const` — it must not exist at runtime.
2. `rowOf()` returns a value the carrier slot accepts and nothing ever reads. Give it a body that
   cannot be mistaken for data.
3. Doc comment, terse: what it stands in for, and that it is never read. No decision-number
   citations.

## Implementation Notes

- The name near-collides with `RowOf<S>` in `engine/types.ts`, which runs the opposite direction —
  that one extracts a row type from a source, this one injects one. The collision is accepted and
  casing separates them. Do not rename either.
- `TRow` appears only in the interface's value position, which is what makes `RowToken<Invoice>`
  and `RowToken<Deal>` mutually unassignable. Do not make the member optional.
- No `RowEvidence` constraint type, no recursive `RowOf<E>` conditional. Step 4's carrier union
  covers the same ground with less machinery.

## Risks / Watchouts

- A `unique symbol` in an `interface` key position requires the symbol to be `const`-declared in the
  same file. Declaring it inside a function or exporting it breaks the uniqueness the token relies
  on.
- Returning a plain object literal cast to `RowToken<TRow>` is fine; returning `undefined` cast to
  it is not — Step 4's carrier union has a callable member, and a nullish token makes a misuse
  harder to diagnose at runtime than it needs to be.

## Non-Goals

- Exporting it from the domain barrel — Step 6.
- Accepting it in `createFilters`' first argument — Step 4.
- Any story or doc that demonstrates it — `#111` and `#113`.

## Acceptance Checks

- [ ] `src/filters/row-of.ts` exists and exports `rowOf` and `RowToken`
- [ ] The symbol is `declare const` and is not exported
- [ ] `RowToken<A>` is not assignable to `RowToken<B>` for unrelated `A`, `B`
- [ ] The file imports nothing
- [ ] `nx run shared-table:typecheck` is clean

---
← [Step 1: Add the rule types and the `StateOf` fold](step-1-rule-types-and-stateof.plan.md) | [Step 3: Rules return their records](step-3-rules-return-records.plan.md) →
