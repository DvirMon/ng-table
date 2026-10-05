# Step 2 — Difference statistics (CI + three-way verdict)

**PR scope:** A pure module that turns two sample arrays into a confidence interval on their
difference and a pass / fail / unsure verdict against a limit. No I/O.
**Parallel-safe with:** Step 1, Step 3.
**Task type:** `code`
**Skills used:** —
**Scaffolding agent:** `general-purpose`

## Files

| File                                    | Action               |
| --------------------------------------- | -------------------- |
| `apps/table-bench/driver/stats.ts`      | create               |
| `apps/table-bench/driver/stats.test.ts` | create — `node:test` |

## Why This Step Exists

The old bench gated one number (median, then minimum) against 16.7 ms while its spread was
larger than the result. Every surveyed suite tests the _difference_ and treats "can't tell" as
its own outcome (discovery § Synthesis › Noise; tachometer `computeDifference` [S10]).

## What To Do

- Port tachometer's `computeDifference` shape [S10]:
  - `mean`, sample variance, Welch standard error of the difference.
  - Student's t quantile at `min(nA, nB) − 1` degrees of freedom (conservative), 95 % two-sided.
  - A small hard-coded t table (df 1…30, then 40, 60, 120, ∞) with linear interpolation — no
    `jstat` dependency.
- API:
  ```ts
  interface DifferenceInterval {
    low: number;
    high: number;
    mean: number;
  }
  type Verdict = 'pass' | 'fail' | 'unsure';
  function differenceInterval(a: readonly number[], b: readonly number[]): DifferenceInterval; // a − b
  function verdictAgainst(interval: DifferenceInterval, limitMs: number): Verdict;
  function isResolved(interval: DifferenceInterval, limitMs: number): boolean; // !straddles
  ```
- `verdictAgainst`: `high < limit` → pass; `low > limit` → fail; else unsure.
- Explicit return types; no `any`; named booleans per the repo conventions.

## Acceptance Checks

- [ ] `node --experimental-strip-types --test apps/table-bench/driver/stats.test.ts` passes
      (user runs it). Cases: identical samples → interval contains 0; clearly separated samples →
      resolved; t quantile at df=9 ≈ 2.262; verdict boundaries.
- [ ] Type-checked by Step 5's driver `tsconfig`.
