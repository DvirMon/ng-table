# Mechanisms — explored one by one

Moved verbatim from [`plan.md`](plan.md) on 2026-09-25. Written 2026-09-17/18, before #106
(`'paginate'` dropped) and ADR-0023 (`'prune'` deleted). Mentions of `'prune'`, `'paginate'` and
`preservesEmissionOrder` below are historical; the current design is in `plan.md`.

Running example throughout: a third-party `withRowPinning()` that must run **after `'tree'`
and before `'prune'`** (pinned rows hoisted to the top, children must stay under parents), and
a `withVirtualWindow()` that must run **after `'paginate'`**. Today neither compiles.

Each option shows: (A) what the feature author writes, (B) what the consumer writes,
(C) how the engine resolves order, (D) what fails and when, (E) verdict against R1–R10.

---

### M1 — Angular DI: `provideTableStages()`

**(A) Author**
```ts
export function withRowPinning<In extends PinningInput<In>>() {
  return createTableFeature((store: In) => ({
    members: { pinnedIds, pinRow, unpinRow },
    renderStages: { pin: hoistPinned(pinnedIds) },   // 'pin' is not in RENDER_ORDER → author
  }));                                               // must document "add 'pin' to your order"
}
```
**(B) Consumer** — app level or component `providers: [...]`
```ts
provideTableStages({
  render:   ['group', 'tree', 'pin', 'prune', 'paginate', 'virtualWindow'],
  pipeline: ['filter', 'group', 'sort', 'expand'],
});
```
**(C) Engine** — `createTable()` reads the token via `config.injector ?? inject(Injector)`,
passes the arrays into `composeTable()` → `createTableCore()` as parameters (engine stays
Angular-free). `foldFeatures` iterates the injected list instead of the const.
**(D) Failures**
- Consumer forgets `'pin'` → stage silently dropped unless a new cross-check ("every declared
  key must appear in the order") is added. Add it; then it throws at construction.
- Two consumers' component-level providers with different orders → each table resolves its own;
  fine, but a feature package can never assume a position.
- Types: `RenderStage` is `typeof RENDER_ORDER[number]`; a runtime array cannot widen it. The
  key on `renderStages` degrades to `string`. `'prune'` must be re-validated at runtime as
  present-exactly-once.
**(E)** R1 ✓ (hidden) · R2 ✗ · R3 partial · R4 ✗ · R5 ✓ · R6 partial (composite has no injector;
must defer) · **R7 ✓ (only option that wins here)** · R8 ✗ · R9 ✓ · R10 config, not authoring.

---

### M2 — Anchors declared in the spec

**(A) Author**
```ts
renderStages: {
  extra: [{
    name: 'pin',
    after: 'tree',                 // or before: 'prune' — exactly one
    preservesEmissionOrder: true,  // required when placed before the prune boundary
    run: hoistPinned(pinnedIds),
  }],
}
```
**(B) Consumer**
```ts
createTable(data, cfg, withExpansion(), withRowPinning(), withVirtualWindow());
```
Nothing else. Argument order still irrelevant.
**(C) Engine** — built-ins stay at fixed anchors `['group','tree','paginate']` (`'prune'` is a
boundary, not an anchor). At end of fold: collect all `extra` declarations, build a DAG
(anchor edges + declared edges), topological sort; two extras that both say `after: 'tree'`
with no edge between them = **ambiguous tie → throw** (or: sort by name as a documented
deterministic tiebreak — decision for the ADR). Pure function, vitest-testable.
**(D) Failures** — all at construction, naming both parties: unknown anchor, cycle, duplicate
name (existing `SlotRegistry.claim<TKey>` already generic), ambiguous tie,
`preservesEmissionOrder: false` on the pre-prune side.
**(E)** R1 ✓ · R2 ✓ · R3 ✓ · R4 partial (`PipelineStage | (string & {})`) · R5 ✓ · R6 ✓ ·
R7 ✗ · R8 ✓ · R9 ✓ · R10 ✓.

---

### M3 — Numeric priority / `enforce: 'pre' | 'post'` (Vite/Rollup/tapable)

**(A) Author**
```ts
renderStages: { extra: [{ name: 'pin', priority: 250, run }] }   // built-ins at 100/200/300/400
```
**(C) Engine** — sort by priority; ties by... registration order (every surveyed system) or
throw.
**(D)** Author must know the built-ins' numbers; two third parties picking 250 tie. A number
carries no *meaning* ("after tree" does), so an engine refactor renumbering built-ins breaks
every third party silently.
**(E)** R1 ✗ (ties positional) · R2 ✓ · R3 ✗ · R4 ✓ · R5 ✓ · R6 ✓ · R7 ✗ · R8 ✗ · R9 ✓ ·
R10 ✓. tapable itself lets `before` override `stage` — evidence that named beats numeric.

---

### M4 — Whole-order override on `createTable` config

```ts
createTable(data, { trackBy, columns, stageOrder: { render: [...] } }, ...features)
```
Same as M1 without DI: per-table only, no app-level default, same R2/R3/R4 losses, and R7 only
partially. Strictly dominated by M1 (M1 can do this with a component-level provider). Drop.

---

### M5 — Fixed pre/post multi-claim hook slots

```ts
renderStages: { beforePrune: [run], afterPaginate: [run] }
```
**(C)** Each slot is an array; run in fold order.
**(D)** Order within a slot = composition order → R1 ✗, which is the exact behaviour
ADR-0011 rejected. Enumerated slots → R10 ✗. Two features in `beforePrune` needing an order
between *them* have no way to say so.
**(E)** R1 ✗ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R7 ✗ · R8 partial · R9 ✓ · R10 ✗. Drop.

---

### M6 — Hybrid: M2 as definition site + M1 as edit-function override

**(A) Author** — exactly M2.
**(B) Consumer default** — exactly M2 (nothing).
**(B') Consumer who must reposition a library stage**
```ts
provideTableStages({
  render: (resolved) => moveBefore(resolved, 'pin', 'tree'),   // edit fn over the RESOLVED order
});
```
**(C)** Engine resolves M2's DAG first; if a token is present, applies the edit function to the
resolved list; re-validates (prune once, all names present, emission-order rule) → throw on
violation.
**(D)** M2's failures + "edit function removed/duplicated a stage" → throw.
**(E)** All of M2 plus R7 ✓. Cost: two mechanisms to document; the override must be rare and
clearly the escape hatch, never the tutorial path.

---

### M7 — MUI-style processor groups

```ts
apiRef.registerPipeProcessor('hydrateRows', id, fn)   // accumulate; Map insertion order
```
**(C)** Accumulate model: every processor in a group runs, in registration order. No single
owner, no ordering primitive.
**(D)** Collision undetectable by design (random ids); order = hook-call order.
**(E)** R1 ✗ · R2 partial · R3 ✗ · R4 **✓ via interface registry** · R5 n/a · R6 n/a · R7 ✗ ·
R8 ✗ · R9 ✓ · R10 ✓.
**Take only the typing trick:**
```ts
// engine/render-stages.ts
export interface RenderStageRegistry { group: true; tree: true; paginate: true }
export type RenderStage = keyof RenderStageRegistry;

// third-party package
declare module '@ngp/table' {
  interface RenderStageRegistry { pin: true }
}
```
Now `name: 'pin'` is a checked literal; `name: 'pinn'` is a compile error. Applies to M2/M6.
Unverified: survives `ngc` + barrel + overload generator (needs a compile probe).

---

### Side-by-side

| | M1 DI | M2 Anchors | M3 Priority | M4 Config | M5 Slots | M6 Hybrid | M7 MUI |
|---|---|---|---|---|---|---|---|
| Who knows placement | consumer | author | author | consumer | author | author (+consumer override) | nobody |
| Order = arg order? | no | no | ties yes | no | within slot yes | no | yes |
| Typo in stage name | silent/runtime | runtime (compile w/ M7 trick) | n/a | silent/runtime | compile | runtime (compile w/ M7 trick) | silent |
| Per-app override | ✓ | ✗ | ✗ | per-table | ✗ | ✓ | ✗ |
| Prune invariant declared | ✗ | ✓ | ✗ | ✗ | partial | ✓ | ✗ |
| Engine Angular-free | ✓ if inject in api/ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| ADRs touched | 0011 | 0011, 0017, new | 0011, new | 0011 | 0011 | 0011, 0017, 0004, new | — |
| Verdict | override layer only | **core** | reject | reject (⊂ M1) | reject | **recommended** | steal typing only |

### Open sub-decisions inside M2/M6 (for the ADR, not blocking the choice)
1. Ambiguous tie between two extras with the same anchor: throw, or deterministic
   name-sort tiebreak? (Throw is stricter and matches ADR-0007's spirit.)
2. Is `'prune'` an anchor target (`before: 'prune'`) or only a boundary reached via
   `after: 'tree'`? Discovery says boundary; `preservesEmissionOrder` gates the pre-prune side.
3. Can a third party anchor on *another third party's* stage (`after: 'pin'`)? Yes under a
   DAG; document that a missing dependency feature = unknown-anchor throw.
4. Pipeline layer gets the same `extra` shape, or render layer only in v1? Both are
   non-commutative; same mechanism, do both.
