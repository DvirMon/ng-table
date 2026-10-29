---
step: 2
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/page-step.ts (new)
  - libs/table/src/directives/page-step.spec.ts (new)
---

# Step 2 — Page step and direction readers

Adds two small DOM readers: how many rows fit in the scroll container, and the host's direction.
Using them in the key handler is left to step 4.

Decisions: K4, K4b, K40

## Do

Add `page-step.ts` with two functions. Not exported from `index.ts`.

```ts
function pageStepOf(host: HTMLElement, cell: HTMLElement): number;
function isRtlAt(host: HTMLElement): boolean;
```

`pageStepOf`:

- Find the nearest scrollable ancestor of `host`, `host` included: computed `overflow-y` is `auto` or `scroll`.
- Result is `floor(container.clientHeight / cell.offsetHeight)`, at least 1.
- No scroll container, or either height is 0: return the fallback `10`.

`isRtlAt`: `getComputedStyle(host).direction === 'rtl'`, read on each call. Never cache it.

## Watch out

A measured container shorter than one row gives `1`. A height of `0` means unmeasurable and gives `10`. Keep the two apart.

No viewport fallback: a page that scrolls the document gets `10`. `withVirtualScroll()` does not exist, so there is no visible-range branch.

## Out of scope

- Using the results (step 4).
- `dir` attribute on an ancestor: the browser resolves it into the computed `direction`.

## Done when

- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
- `page-step.spec.ts` passes.
