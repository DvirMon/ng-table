# Step 2 test plan — Page step and direction readers

Step: [step-2-page-step-and-direction.plan.md](step-2-page-step-and-direction.plan.md)
Spec file: `libs/table/src/directives/page-step.spec.ts`

## Behaviour coverage

| Id  | Behaviour                                                                       | Source                           | Tested by                                                                          |
| --- | ------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| AC1 | Page Up/Down move by the visible row count, same column, stop at first/last row | issue #236 AC; spec story 10     | A, B, E for the visible-row-count part; the move and edge stop are owned by step 1 |
| AC2 | Page step falls back to 10 when no scroll container can be measured             | issue #236 AC; spec Key handling | C, D                                                                               |
| AC3 | Under RTL, ← moves toward the end of the row and → toward the start             | issue #236 AC; K4b               | Not owned. The arrow swap is in step 1; this step supplies `isRtlAt` (F)           |
| AC4 | Direction is read from the host's computed `direction` at keypress              | issue #236 AC; spec Key handling | F                                                                                  |

## Stubs (red phase)

- `export function pageStepOf(host: HTMLElement, cell: HTMLElement): number` in `libs/table/src/directives/page-step.ts`; throws `not implemented: pageStepOf`.
- `export function isRtlAt(host: HTMLElement): boolean` in the same file; throws `not implemented: isRtlAt`.

## Test environment notes (for red)

- The `test` target is `@nx/angular:unit-test` with no `browsers` option, so tests run in jsdom. jsdom computes no layout, so `clientHeight` and `offsetHeight` are always 0. Pin them per element with `Object.defineProperty(el, 'clientHeight', { value, configurable: true })`, the pattern in `ngp-table-row-move.directive.spec.ts`.
- Set overflow and direction as inline styles (`el.style.overflowY = 'auto'`, `host.style.direction = 'rtl'`). jsdom's `getComputedStyle` reports inline declarations.
- Attach the fixture tree to `document.body` and remove it in `afterEach`.
- No TestBed is needed; these are plain DOM functions.

## Seams — in red-green order

### A. Scrollable host, clientHeight 300, row offsetHeight 40 → 7

- Test: `it('returns the number of whole rows that fit in the scrollable host')`
- Asserts: `pageStepOf(host, cell)` is `7`. Host has `overflowY: 'auto'`, clientHeight 300. Cell is a descendant with offsetHeight 40.
- Covers: AC1
- Risk: damage low, likelihood high
- Why this seam: catches a wrong division (inverted operands), rounding up or not rounding (7.5), and returning the fallback on the common path. 300/40 is used because 400/40 = 10 would equal the fallback.
- Order reason: independent. Base case.

### B. Host not scrollable, nested scrollable ancestors → the nearest one wins

- Test: `it('measures the nearest scrollable ancestor of the host')`
- Asserts: result is `5`. Fixture: outer wrapper `overflowY: 'auto'`, clientHeight 1000; inner wrapper `overflowY: 'scroll'`, clientHeight 200; host with no overflow, clientHeight 900; cell 40. Wrong answers are 25 (outer) and 22 (host).
- Covers: AC1
- Risk: damage low, likelihood high
- Why this seam: catches measuring the host without checking that it scrolls; walking to the outermost container instead of the nearest; accepting `auto` but not `scroll` (inner uses `scroll`, outer uses `auto`).
- Order reason: builds on A (same arithmetic, adds the ancestor lookup).

### C. No scrollable element anywhere → 10

- Test: `it('falls back to 10 when no scroll container exists')`
- Asserts: `pageStepOf(host, cell)` is `10`. No element has overflow set; host clientHeight 300, cell 40.
- Covers: AC2
- Risk: damage low, likelihood high
- Why this seam: catches a lookup that falls back to the host or `document.body` and computes 7, and a lookup returning `null` that lets NaN or a throw escape into the key handler.
- Order reason: builds on B (the lookup finds nothing).

### D. Container or row height is 0 → 10

- Test: `it.each` → `it('falls back to 10 when the %s height is 0')` with rows `container` (clientHeight 0, cell 40) and `row` (clientHeight 300, cell 0)
- Asserts: both return `10`.
- Covers: AC2
- Risk: damage high, likelihood low
- Why this seam: an unguarded row height of 0 gives `Infinity` and PageDown jumps to the last row; an unguarded container height of 0 lets the minimum-1 clamp turn `0` into `1` instead of 10. Both rows are one "unmeasurable" guard.
- Order reason: builds on A (adds the measurement guard before the division).

### E. Container shorter than one row → 1

- Test: `it('returns at least 1 when the container is shorter than a row')`
- Asserts: clientHeight 30 and cell 40 return `1`.
- Covers: AC1
- Risk: damage low, likelihood low
- Why this seam: catches a missing minimum clamp. `floor(0.75) = 0` makes Page Up/Down a no-op. Kept apart from D, where 0 means unmeasurable and returns 10, while here a measured short container returns 1.
- Order reason: builds on A (adds the clamp). Run after D; both touch the low end.

### F. Direction is read on each call

- Test: `it('reads the host direction at call time')`
- Asserts: with no direction set, `isRtlAt(host)` is `false`; after `host.style.direction = 'rtl'` it is `true`; after switching back to `'ltr'` it is `false`. All three calls use the same host.
- Covers: AC4
- Risk: damage low, likelihood low
- Why this seam: catches an inverted check, a cached value (a runtime direction switch would be ignored), and reading the `dir` attribute instead of the computed style (the fixture sets only the style).
- Order reason: independent.

## Types phase (after green)

None — no public type surface. `page-step.ts` is internal, not exported from `index.ts`, and has no generics.

## Not tested

- `isRtlAt` inheriting `rtl` from an ancestor's `dir="rtl"`: jsdom does not map `dir` to computed `direction` or inherit it. Only a browser story or e2e test can show it.
- Overflow `hidden`/`clip` not counting as a scroll container: low likelihood; B shows the accept list is checked.
- Horizontal-only scrolling (`overflowX: auto`, `overflowY` visible): same lookup branch as C.
- Mixed row heights: the focused cell is measured only; a documented approximation.
- The Page Up/Down move, first/last-row stop and RTL ←/→ swap: owned by step 1.
- That the host listener calls `pageStepOf` and `isRtlAt` at keypress: step 4.
- The nearest-ancestor-only rule (no viewport fallback, K40): a page that scrolls the document gets 10 by design; C covers it.
