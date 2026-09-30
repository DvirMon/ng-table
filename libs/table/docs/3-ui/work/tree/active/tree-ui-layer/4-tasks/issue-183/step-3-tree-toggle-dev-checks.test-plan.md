# Step 3 test plan — tree-toggle dev checks (D7, D8, D13)

Step: [step-3-tree-toggle-dev-checks.plan.md](step-3-tree-toggle-dev-checks.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts` (extends the step-2 file)

## Stubs (red phase)
- None. `NgpTableTreeToggleDirective` already exists from step 2.
  Red fails on missing behaviour: no throw and no `console.warn`.

Harness notes:
- Reuse step 2's real `createTable(...)` + `ngpTable` host. Add
  a variant without `withTree()`.
- Name sources are host-template variants on the `<button>`.
- Warnings: `vi.spyOn(console, 'warn').mockImplementation(() => {})`,
  restored in `afterEach` with `vi.restoreAllMocks()`.
- Do not touch `ngDevMode`. The Angular test env already runs in
  dev mode; `getNgDevMode`/`setNgDevMode` would only serve the
  untested prod path.
- Clicks use native `button.click()` + `fixture.detectChanges()`.

## Seams — in red-green order

### A. Table without `withTree()` → first render throws, naming both parties
- Test: `it('throws on first render when the table has no withTree()')`
- Asserts: `expect(() => setup({ tree: false })).toThrow(/ngpTableTreeToggle[\s\S]*withTree\(\)/)`.
  `setup` runs `createComponent` + `detectChanges`. The regex
  pins the two names and their order, not the full wording.
- Why this seam: catches a missing guard, where the toggle stays
  silently inert in dev — the bug ADR-0014 says a wiring error
  must not become. Also catches a message without the fix
  (`withTree()`).
- Order reason: independent. The base guard.

### C. Two nameless toggles → exactly two warnings
- Test: `it('warns once per toggle whose button has no accessible name')`
- Asserts: host with two collapsed root parents (both toggles
  enabled, no leaves rendered) and a button with no
  `aria-label`, `aria-labelledby` or text. After first render,
  `console.warn` has been called 2 times. Each call's first
  argument contains `ngpTableTreeToggle`.
- Why this seam: catches a missing check, a global once-only
  flag (1 call), and a double-fired hook (4 calls).
- Order reason: independent. The base case for D7.

### D. Re-rendering an already-checked toggle → no second warning
- Test: `it('does not warn again when an existing toggle re-renders')`
- Asserts: same nameless host. Click parent P (children appear),
  record the `console.warn` call count, click P again. The count
  is unchanged.
- Why this seam: catches a check wired to every render
  (`afterEveryRender`, an `effect` on row state,
  `ngAfterViewChecked`) instead of the first.
- Order reason: builds on C.

### E. A named button, or a disabled leaf → no warning
- Test: `it.each(['aria-label', 'aria-labelledby', 'interpolated text', 'disabled leaf toggle'])('does not warn when %s')`
- Asserts: `console.warn` is not called after first render for
  each variant. The text variant is interpolated
  (`{{ row.data.name }}`), so it exists only once the button's
  view has rendered. The leaf variant renders a nameless toggle
  on a row without children only.
- Why this seam: catches a name check that misses a source; the
  text row catches a check that runs in the constructor or
  `ngOnInit`, before content renders ("late-rendered text
  counts", D7). The leaf row catches a check that ignores D13:
  a disabled leaf toggle is `aria-hidden`, so no assistive tech
  reaches it.
- Order reason: builds on C. The negative branch of the same
  check.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- Production stripping of both checks, and the toggle being
  inert in prod (spec, Not tested).
- Exact wording of the throw and the warning. A and C pin only
  the names.
- A throw per toggle vs. once per table: after the first throw
  the render has already failed.
- Warning after a toggle is destroyed and re-created: a new
  instance is a new toggle, covered by C.
- A `<tr>` without `ngpTableTreeRow` is not an error (D8):
  covered by step 2 A, whose host has no `ngpTableTreeRow`.

Trimmed: B ("row without `ngpTableTreeRow` → no error, toggle
works") — duplicate of step 2 A.

Settled: whitespace-only text counts as no name
(`textContent.trim()`). Where the D8 throw fires is the
implementer's choice; A holds either way (TestBed rethrows
application errors by default).
