# ADR-0018 — `when` vs `enable` predicate naming on feature rules

**Status:** accepted — decided 2026-09-17.
**Related:** [ADR-0017](0017-engine-owned-descendant-prune.md) (prune stage that admission applies to), [issue #86](https://github.com/DvirMon/ng-table/issues/86). Research: `docs/1-state/work/grouping/active/column-group-index/2-decisions.md`.

`when` is the default naming for any dynamically-toggled conditional on a feature's rule — whether driven by row/cluster data or external component state (signal, resource, toggle). On grouping rules, `enable: () => boolean | undefined` is the narrow exception: level *activation* (external-state driven, pre-clustering), paired with `when: (cluster) => boolean` for *admission* (data-driven, post-clustering). The two orthogonal predicates on one rule object cannot share a name because they fire at different pipeline moments with different failure semantics. `GroupingAsyncRule` has no `enable` — its activation is already `onSuccess`/`onError`.

Table-wide `WithGroupingConfig.groupWhen` renames to `when` (unifies with per-column admission naming); the two scopes AND-combine as the same kind of predicate. One feature with this shape today; a future feature should default to plain `when` unless it needs the same data/external-state split.

## Alternatives considered

- **Collapse into one arity-dispatched field.** Activation runs *before* any cluster tree exists (it determines level order); admission runs *after* clustering, per resulting cluster. No single call site serves both, so this isn't an ergonomics fix.
- **Keep `groupWhen` as admission, rename only the column one.** The `groupWhen` substring keeps the confusion alive — the two fields would still read as interchangeable despite being unrelated in cardinality (once-per-column vs. once-per-cluster) and timing (pre- vs. post-clustering).
- **Different names at different scopes.** Admission is one concept at two scopes by design — they AND-combine. Naming them differently would break that symmetry.

## Consequences

- `applyVisible({ when: ... })` and `FilterOptions.when` are unaffected — each has only one conditional, so plain `when` was always correct.
- Renaming table-wide `groupWhen` → `when` on `WithGroupingConfig` breaks #85's already-merged public API. Accepted: pre-1.0, single in-repo consumer, no deprecation window.
- Type and helper function names (`GroupWhen<TRow>`, `evaluateGroupWhen`, `reportGroupWhenError`, fixtures) keep their existing names — only field/parameter identifiers renamed.
