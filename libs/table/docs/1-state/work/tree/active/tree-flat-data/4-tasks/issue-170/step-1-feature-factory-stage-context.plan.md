---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/types.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/api/features/compose-features.ts
  - libs/table/src/api/create-table-feature.ts
  - libs/table/src/engine/compose-table.spec.ts
  - libs/table/src/api/features/compose-features.spec.ts
  - libs/table/src/api/create-table.spec.ts
  - libs/table/src/engine/types.types.spec.ts (new)
  - libs/table/src/api/create-table-feature.types.spec.ts (new)
---
# Step 1 — Feature factories receive the stage context

This step passes the stage context to every feature factory as a required second argument.
It leaves `withGrouping()` reading that context for step 4.

Decisions: [D13](../../1-decisions.md) (planning decisions P1 and P2 are recorded by step 6), [ADR-0028](../../../../../../../adr/0028-tree-parent-link-slot.md).

## Do

- In `engine/types.ts`, the `Feature<In, Out>` call signature takes a required `ctx`:
  ```ts
  (input: In, ctx: StageContext<RowOf<In>>): TableFeatureSpec<RowOf<In>, Out>
  ```
- In `engine/compose-table.ts`, build one lazy context and pass it where the engine calls `feature(store)`:
  ```ts
  const ctx: StageContext<TRow> = { get parentOf() { return handle.parentLink.value; } };
  ```
- In `api/features/compose-features.ts`, forward the same `ctx` to every inner feature: `feature(innerStore, ctx)`.
- In `api/create-table-feature.ts`, both overloads type `factory` as `(input, ctx)`.
  The derive wrapper forwards `ctx` to both `factory` and `derive`.
- Internal features (`feature(handle.core)`) stay as they are.
  Nothing is added to the store or the table instance.

## Watch out

- Read `ctx.parentOf` inside stages, methods or computeds, never in the factory body.
  A feature that folds later, such as `withTree`, has not contributed its link when the factory body runs.
- One-argument factories must keep compiling.
- The stage call sites in `core.ts` do not change.

## Out of scope

- `withGrouping()` reading `ctx` (step 4).
- `core.ts`, `InternalFeature` and `withComputed`.

## Done when

- [ ] No `not implemented:` placeholder remains at the two call sites.
- [ ] One-argument factories across `src` still compile.

---
[Step 2: Cluster by root value in the group stages](step-2-cluster-by-root-value.plan.md) →
