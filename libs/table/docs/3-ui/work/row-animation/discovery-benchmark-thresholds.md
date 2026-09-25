# Row-reorder (FLIP) animation benchmark: thresholds, baselines, and methodology

**Date:** 2026-09-24 · **Depth:** standard

Question as asked: what thresholds and baselines should a real-browser benchmark use to judge
whether a table row-reorder (FLIP) animation performs well, how do grid/table libraries
benchmark this, and what methodology should this library adopt.

## Answer

- **Reframe:** "click sort → rows glide" is two measurements with different budgets.
  (1) The **reorder frame** (click → first paint) is an INP/RAIL budget: ≤ 50 ms of main-thread
  work, ≤ 100 ms response, INP good ≤ 200 ms [S1][S3][S4].
  (2) The **glide** is compositor-driven when it is a transform animation, so "smooth" means
  *no main-thread long animation frames after the first frame*. It does not mean "rAF deltas
  < 50 ms" [S5][S7][S10].
- **No surveyed grid library uses absolute ms thresholds in CI.** AG Grid gates on a live
  control-vs-variant comparison (z > 1.96 and ≥ 5 %) [S26]. Handsontable gates at 15 % against
  the median of the 5 newest stored baselines [S35]. Angular compares two commits on request
  [S42]. Absolute budgets come from web-platform guidance, not from any library.
- **Recommendation (§ Proposed methodology):**
  - Hard gates only on deterministic facts: animation counts, and zero animations after settle.
  - Timing gates are relative: in-run plain-vs-animated overhead plus a scaling-exponent check.
  - A single absolute budget: the reorder frame at N=1000 stays under the 50 ms long-frame line.
  - Stored-baseline regression is report-only until the run-to-run spread is measured.
- **N values:** 100 / 1000 are the gated sizes. 5000 / 10000 are report-only scaling probes.
  Grid vendors never animate rows beyond the viewport because they virtualize [S31]. That
  leaves no published baseline for this directive's cost, which grows with N.
- **Blocker found:** the `bench` target cannot run as the repo stands.
  `@vitest/browser-playwright` and `playwright` are not installed, and Angular's builder needs
  them for browser mode [R4][R5][S57].

## Method

- Versions pinned:
  - Installed: `vitest@4.1.9` and `@angular/build@22.1.2`, from `package.json` [R4].
  - Registry: `ag-grid-community@36.2.0`, `playwright@1.63.0`, `tachometer@0.7.2`,
    `@formkit/auto-animate@0.10.0`.
  - Git refs (no npm package): js-framework-benchmark `f2df01a` (2026-09-20), Handsontable
    `develop@bd508b7` (2026-09-15), TanStack Virtual `main@78371e8`,
    KevinVandy/tanstack-table-benchmarks `1c50441`, hckhanh/benchmark-table-libraries `446a382`.
- How each class of source was read:
  - Chromium source was read from `main` on the GitHub mirror, so it is **unpinned**.
  - Harness code (AG Grid, js-framework-benchmark, Handsontable) was fetched raw at the refs above.
  - web.dev and developer.chrome.com pages were fetched on 2026-09-24. Their dates are listed
    in Sources.
- Reliability:
  - The same number means different things across harnesses:
    - js-framework-benchmark "duration": click → last Commit trace event, under 4× CPU
      throttle [S20][S18].
    - AG Grid: the last `long-animation-frame` or a named entry [S26].
    - TanStack Virtual: render → rAF [S34].
    - 1771 Technologies: average FPS [S46].
  - None of these equals this repo's `TestBed.tick()` duration [R1].
  - Vitest docs default to **v5.0.1**, but the repo runs **4.1.9**. The docs' `toBeFasterThan`
    and interleaving claims are v5 only. v4 marks `bench` "experimental and does not follow
    SemVer" [S55][S56].

## Evidence

### 1 · Published budgets

- INP good ≤ 200 ms, needs-improvement ≤ 500 ms, poor > 500 ms. It is the p75 of page views and
  ignores 1 outlier per 50 interactions [S1].
- INP latency = input delay + processing + presentation delay, up to the next frame. It counts
  click, tap, and key press only [S1].
- Style, layout, and paint after the handler count toward presentation delay. Rendering cost
  scales with DOM size [S2].
- RAIL (2020): respond within 100 ms with a 50 ms handler budget. Produce an animation frame in
  ≤ 10 ms, because the 16 ms budget minus about 6 ms of browser work leaves 10 ms [S3].
- A long task is > 50 ms. Rationale: a 50 ms task plus 50 ms of input handling still fits
  RAIL's 100 ms [S4].
- A LoAF is a rendering update delayed > 50 ms. It measures whole frames, not single tasks.
  Fields: `duration`, `blockingDuration`, `renderStart`, `styleAndLayoutStart`, `scripts`.
  Shipped in Chrome 123 [S5].
- Event Timing `duration` runs from input to the next rendering update, at **8 ms granularity**.
  The minimum threshold is 16 ms [S6]. It is too coarse to measure overhead deltas.
- A 60 Hz frame is 16.7 ms and a 120 Hz frame is 8.3 ms. This is arithmetic from RAIL's
  1000/60 [S3], not a published 120 Hz budget.
- Lighthouse warns above 800 DOM nodes and flags "excessive" above 1,400 [S16]. A 1000-row
  single-cell table already exceeds that.

### 2 · Does `element.animate()` on transform run on the compositor (Chromium)

- Blink sends both CSS and Web Animations through `PendingAnimations`. Each accelerable one gets
  a `cc::Animation`. The compositor-mutable properties are transform, opacity, filter, and
  backdrop-filter [S10].
- An accelerated animation also keeps ticking on the main thread to update computed style
  [S10]. The main thread is not idle during a glide, only unblocked for visuals.
- Failure reasons that force the main thread:
  - `kAcceleratedAnimationsDisabled`: forced reduced motion, or compositing/threaded
    animation turned off [S12].
  - `kEffectHasUnsupportedTimingParameters`: e.g. a non-zero end delay [S12].
  - `kEffectHasNonReplaceCompositeMode` [S12].
  - `kTargetHasIncompatibleAnimations`: another running or pending animation on the same
    property [S12].
  - `kTargetHasInvalidCompositingState`: a fragmented box or no layout object [S12].
  - `kTransformRelatedPropertyCannotBeAcceleratedOnTarget`: `!IsTransformApplicable()` [S11][S12].
- `IsTransformApplicable()` = `IsBox() || IsSVG()` [S14]. CSS Transforms makes table-row boxes
  transformable; only table-column and column-group boxes are excluded [S15].
- `kActiveTransformAnimation` is a *direct* compositing reason [S13]. Every animating `<tr>`
  therefore gets its own compositing property node.
- A composited animation stays smooth while the main thread janks. The proposed smoothness
  metric is **percent dropped frames**: average, plus worst and p95 over 1 s sliding windows [S7].
- web.dev and Chrome both list transform and opacity as the compositor-safe properties [S8][S9].

### 3 · How others benchmark

- **js-framework-benchmark**
  - Nine operations. "swap rows" = *swap 2 rows of a 1,000-row table*, with 5 warm-ups and 4× CPU
    throttle [S18].
  - Other sizes: create 1k and create 10k. The README and the code disagree on partial-update
    size (10k vs 1k) [S17][S18].
  - 15 CPU iterations; dropping the slowest is supported but set to 0; driven by Puppeteer
    [S19].
  - Duration = `commit.end − click.ts` from a Chrome trace. It is split into script time and
    paint time (layout, paint, commit, layerize) [S20].
  - Ranked by a weighted geometric mean since Chrome 118 [S17].
  - It has 4 keyed Angular entries: `angular-cf`, `-signals`, `-signals-nozone`, `-new-nozone`
    [S22]. `angular-cf-signals` is on `@angular/core@22.0.0` [S21].
  - Results are published per Chrome release; the latest is Chrome 152 (2026-09-01) [S23].
- **AG Grid** (`testing/performance/` at `b36.2.0`)
  - Playwright on Chromium, 1 worker, headless when `CI` is set, no custom launch args [S27].
  - Metric: the last `long-animation-frame` entry by default, or a named entry [S26].
  - Warm-ups: 3 by default. Iterations: at least 10, at most 3 × the minimum. IQR outlier
    removal, 95 % margin of error [S26].
  - Always a **live A/B**: `control` vs `variant` (prod, staging, local, or a version), with no
    stored baseline. The run fails when control is faster with |z| > 1.96 **and** the percent
    difference minus the error margin is ≥ 5 % [S26].
  - Example: `setData.spec.ts` uses 5 warm-ups and 100–300 iterations [S29].
  - CDP is used for heap only (`HeapProfiler.collectGarbage`, `Performance.getMetrics`). There is
    **no CPU throttling** [S28].
  - The docs call row animation "a performance bottleneck" but publish no row count or ms figure
    [S30].
  - Rows are virtualized: `rowBuffer` defaults to 10 [S31].
- **Handsontable** (`performance-tests/`)
  - Playwright plus CDP tracing. The window is bracketed by `performance.mark`. Time is split
    into DevTools categories [S35].
  - 1 discarded warm-up and 3 measured runs (5 for sort, filter, and load), with a forced GC
    before each [S35].
  - Goldens with provenance (commit, Chromium build, CPU) are stored on GitHub Pages at each
    `develop` push [S35].
  - Pull requests are compared against the **median of the 5 newest compatible goldens**, with a
    **15 % timing / 5 % heap** threshold. The 15 % matches the observed 11–19 % spread [S35].
  - Sort runs on 100,000 × 100 [S35]. Config: headless, 1 worker, 1400×720, no throttling [S36].
  - The suite moved from `ubuntu-latest` to a **self-hosted runner** in commit `bd508b7` [S37].
- **TanStack Virtual** (`benchmarks/`)
  - Playwright against a production Vite build. Mount 1k/10k/100k; 1.5 s rAF-paced scroll [S34].
  - Frame gaps > 32 ms are counted; frames > 50 ms are summed as "jank" [S34].
  - Median of 5 runs, `--expose-gc`, timestamped JSON plus `LATEST.md`, **no gate** [S34].
- **TanStack Table**
  - Playwright plus CDP, heap-focused. 5 iterations; 4× throttle in the React Compiler suite.
    Results are local JSON with no documented CI or thresholds [S32][S33].
- **Angular framework**
  - benchpress under Bazel, until `scriptTime` stops decreasing by linear regression; 20 samples
    by default [S41].
  - `/benchmark-compare <sha>` pull-request comment workflow: A/B against a reference commit,
    posted as a comment, not a gate [S42].
  - A removal pull request (unused, security issue) was closed unmerged [S43].
- **Angular components (CDK table, drag-drop, virtual scroll):** there is no `benchmarks/`
  directory at the repo root on `main` [S44].
- **@formkit/auto-animate:** Playwright e2e tests only. `memory.spec.ts` gates heap growth
  < 10 MB (1 MB in strict mode) and has **no timing or frame benchmark** [S39][S40].
- **Third-party grid shoot-outs**
  - hckhanh: render and scroll only, no sort; M2 Pro, Chrome 147, 120 Hz [S45].
  - 1771 Technologies (vendor, and its own grid wins): sort 10k/50k/100k × 300 columns. CDP
    tracing, 50 round-robin iterations, 5 % trimmed mean, M4, Chrome 149 [S46].
- **Tachometer:** round-robin variants, 95 % CI, auto-sample to ≥ 50 samples / 3 min, and
  `performance.measure` support [S47].

### 4 · Reliability in headless Chromium / CI

- GitHub-hosted runners show a **2.66 % coefficient of variation** on CPU benchmarks. At that
  noise, a 2 % gate gives 45 % false positives; a 1 % false-positive rate needs a 7 % gate [S48].
- Browser timing spread is wider: Handsontable measured 11–19 % between baselines [S35].
- `github-action-benchmark` defaults to a **200 %** alert threshold, stores data in
  `gh-pages/dev/bench/data.js`, and alerts or fails only when opted in [S49].
- CDP `Emulation.setCPUThrottlingRate(rate)` is "a slowdown factor". It is relative to the host,
  which is why DevTools calibrates presets per machine [S50][S51].
- Vitest exposes `cdp()` with the **Playwright provider and Chromium only** [S52][S53][S54].
- Playwright headless uses **chromium-headless-shell** by default. The `'chromium'` channel opts
  into new headless, "the real Chrome browser" [S58].
- The shell is the old `//content`-based headless, "in some ways more performant" [S59][S60].

### Repo facts

- `ROW_COUNTS` is `[100, 1000, 5000]`, not 10000 [R1].
- 5 samples, no discarded warm-up. All plain samples run before all animated ones (not
  interleaved). `frameStats` is taken from the last sample only [R1].
- The overhead window is `TestBed.tick()` plus forced layout. It excludes the next rendering
  update, where the style work and compositor setup for N new animations happen [R1][R2]. This
  is an inference from Blink's pending-animation lifecycle [S10]; it has not been traced.
- `bench` target: `@nx/angular:unit-test`, `browsers: ["ChromiumHeadless"]`, `cache: false`
  [R3].

## Comparison — harness methodology

| Axis | js-framework-benchmark | AG Grid | Handsontable | TanStack Virtual | Angular | This repo today |
|---|---|---|---|---|---|---|
| Driver | Puppeteer [S19] | Playwright [S27] | Playwright [S36] | Playwright [S34] | benchpress/Bazel [S41] | Vitest browser mode [R3] |
| Metric source | trace click→commit [S20] | LoAF / named entry [S26] | CDP trace between marks [S35] | rAF / perf.now [S34] | scriptTime [S41] | `performance.measure` around tick [R1] |
| Warm-up | 5 [S18] | 3 default [S26] | 1 [S35] | not stated [S34] | regression-stopped [S41] | none [R1] |
| Samples | 15 [S19] | 10–30 default [S26] | 3–5 [S35] | 5 [S34] | 20 [S41] | 5 [R1] |
| Statistic | mean/median, geo-mean rank [S17] | mean, IQR-trimmed, MoE [S26] | mean + CV [S35] | median [S34] | regression [S41] | median [R1] |
| CPU throttle | 4× (swap) [S18] | none [S28] | none [S36] | not stated [S34] | not stated [S41] | none [R1] |
| Baseline | none — cross-framework table [S17] | live control build [S26] | 5 stored goldens [S35] | none [S34] | ref commit on demand [S42] | none [R1] |
| Gate | none | z>1.96 ∧ ≥5 % [S26] | 15 % time / 5 % heap [S35] | none [S34] | none (comment) [S42] | absolute 16 ms @1000 [R1] |

## Comparison — can a published number be compared to "reverse N + FLIP"?

| Published number | Metric definition | Comparable? |
|---|---|---|
| jfb "swap rows" [S18][S20] | 2 rows moved of 1k; click→last commit; 4× throttle | **No** — reversal moves N rows, not 2; includes paint; throttled |
| jfb "create 1k / 10k rows" [S18] | row creation click→commit, 4× throttle | **No** — creation, not a move; useful only as an order-of-magnitude band for the *plain* host |
| AG Grid set-data [S29] | live A/B duration | **No** — relative only, no absolute published |
| 1771 sort FPS [S46] | average FPS during sort, virtualized grids, M4/Chrome 149 | **No** — FPS not ms, virtualized (≤ viewport rows animate), vendor-run |
| TanStack Virtual mount / jank [S34] | render→commit; frames >32 ms / >50 ms | **Partly** — its jank definition (>50 ms summed) is reusable as a metric, not its values |
| Handsontable sort 100k×100 [S35] | CDP-trace categories between marks | **No** — virtualized, different window |

## Synthesis

- **Absolute vs relative.** The web platform publishes absolute budgets [S1][S3][S4][S5].
  Every library that gates in CI uses relative ones instead: live A/B [S26], stored-golden
  median [S35], or A/B on demand [S42]. The disagreement is about hardware. An absolute budget
  is a statement about a *user's* device, and CI is not that device. Use absolutes only as a
  coarse ceiling that stays true on any reasonable runner; gate everything else relatively.
- **Where the budget lives.** js-framework-benchmark counts through paint [S20], AG Grid counts
  whole frames (LoAF) [S26], and this repo counts only the tick [R1]. The frame-level window
  matches INP's presentation delay [S1][S2]. The tick window undercounts, because N
  `animate()` calls pay their style and compositor setup in the next rendering update [S10].
  Move the absolute budget to the LoAF, or to a tick → double-rAF window.
- **Smoothness.** A rAF-delta sampler measures the *main* thread. A composited glide can be
  visually smooth while rAF stutters, and the reverse can also happen [S7][S10]. So a rAF or
  LoAF gate is a gate on the main thread staying free. That is the right thing to gate: the
  reorder is when a user clicks again. Visual smoothness needs compositor frame data from a
  trace. Keep it report-only.
- **Scale.** Virtualized grids bound animated rows at the viewport plus buffer [S31][S34], so
  none benchmarks N = 5000 animations. This directive's cost is O(N) in `animate()` calls and
  compositing nodes [R2][S13], with no published baseline. The general mechanism that works
  on any machine is a **scaling-exponent check**: cost(5000) / cost(1000) should be about 5.
  Superlinear growth is a bug class; a slow runner is not.
- **Split budget.** INP good is 200 ms [S1]. Reserve about 100 ms for field input delay and
  device spread, following RAIL's 100 ms response. That leaves the table render plus the
  directive under **one 50 ms long-frame** at N=1000 on the bench machine [S3][S4]. Within
  that frame, the directive's share should stay under one 60 Hz frame (16.7 ms): the user can
  never perceive more than a single dropped frame from the directive [S3]. This is a derived
  proposal, not a published split.

## Against

- LoAF and Event Timing are the principled windows, but they are coarse. Event Timing has 8 ms
  granularity [S6], and LoAF only fires above 50 ms [S5]. Small overhead deltas still need
  `performance.measure` around a forced rendering boundary.
- Handsontable left shared runners for a self-hosted one [S37]. That suggests even a 15 %
  stored-baseline gate is unreliable on `ubuntu-latest`. The case for keeping baseline
  regression report-only follows from this.
- 4× CPU throttling (js-framework-benchmark [S18], TanStack Table [S33]) multiplies host noise.
  It does not normalize across hosts [S50][S51]. AG Grid and Handsontable skip it [S28][S36].

## Proposed methodology — PROPOSAL, not adopted

**Environment**

| Item | Proposal | Basis |
|---|---|---|
| Runner | Vitest browser mode, Playwright provider, Chromium — install `@vitest/browser-playwright` + `playwright` first | [S57][R4][R5] |
| Headless flavour | pin one and record it; prefer `channel: 'chromium'` (new headless) for authenticity | [S58][S60] |
| Workers | 1 | [S27][S36] |
| Viewport | fixed, e.g. 1400×720 | [S36] |
| GC | `HeapProfiler.collectGarbage` via `cdp()` before each measured sample | [S28][S35][S53] |
| Throttle | two passes: 1× (gated) and 4× via `Emulation.setCPUThrottlingRate` (report-only) | [S18][S50] |
| Provenance | record Chromium build, Playwright version, CPU model, commit with every result | [S35] |

**Sampling**

- 3 discarded warm-ups, then at least 10 measured samples [S26][S18].
- Interleave plain and animated per sample, as AG Grid and Tachometer do with their variants
  [S26][S47].
- Gate on the **median**. Report the IQR and CV [S26][S35].
- Collect `frameStats` over every sample, not just the last one [R1].

**Scenarios:** the reverse-N reorder (as today), a mid-glide re-reorder (as today), and
reduced-motion as a no-op control [R1][R2]. Add a partial move, e.g. swapping 2 rows of 1k, to
line up with js-framework-benchmark `05_swap1k` [S18].

**Metrics and pass/fail**

| Metric | How measured | N=100 | N=1000 | N=5000 | N=10000 | Basis |
|---|---|---|---|---|---|---|
| animations started | `document.getAnimations().length` | = moved | = moved | = moved | = moved | deterministic [R1] |
| animations after settle | same, after `finished` + 1 frame | = 0 | = 0 | = 0 | = 0 | leak check, deterministic |
| mid-glide peak / after first | as today | ≤ 2×moved / ≤ moved | same | same | same | [R1] |
| overhead (animated − plain) | median of interleaved `performance.measure` samples, window = tick → double-rAF | report | **< 16.7 ms** | report | report | 1 × 60 Hz frame [S3] |
| overhead scaling | overhead(5000) / overhead(1000) | — | — | **≤ 7.5** (5× linear × 1.5 noise) | report | general mechanism, machine-independent |
| reorder frame | LoAF entry covering the reorder, else tick → double-rAF | report | **< 50 ms** at 1× | report | report | LoAF/long-task line [S4][S5] |
| reorder frame, 4× throttle | same | report | report (≤ 100 ms target) | report | report | RAIL response [S3] |
| main-thread free during glide | LoAF entries after the first frame | **0** | **0** | report | report | [S5][S7] |
| percent dropped rAF frames | delta > 1.5 × median interval, first frame excluded | report | report | report | report | [S7]; headless pacing unverified |
| regression vs stored baseline | median of the 5 newest compatible baselines | report at > 15 % | same | same | same | [S35]; gate only on a dedicated runner [S37] |

**Plain host was detached (fixed 2026-09-25).** `TestBed.createComponent` removes every earlier
root (`[id^=root]`) before adding its own, so mounting the animated host detached the plain one:
every plain sample measured a table that never laid out or painted, and the paired overhead
charged the whole reorder's style + layout to the directive (226 ms at N=1000). The bench now
re-attaches the plain host and asserts both are connected. Both variants also force layout
(`document.documentElement.offsetHeight`) inside the timed tick, so layout lands in
`overheadTickMs` for both. Overheads before this fix are not comparable with later runs.

**Timing gates use the fastest sample (changed 2026-09-25).** The N=1000 gates now check
`overheadMinMs` and `reorderFrameMinMs` (minimum of the 10 measured samples) instead of the
median; the table reports both. Load from other processes only adds time — the same code swung
~5× between two runs (plain tick 215 ms vs 38 ms) while the page itself was lean (6 CSS rules,
~4000 elements) — so the minimum is the closest estimate of the real cost. Thresholds (16.7 ms,
50 ms) are unchanged.

**Row counts**

- 100 is a paged table.
- 1000 matches js-framework-benchmark's standard size and is already past Lighthouse's
  1,400-node line [S18][S16].
- 5000 and 10000 match js-framework-benchmark's 10k, and are report-only scaling probes
  [S18].
- Put 10000 back into `ROW_COUNTS` if the caller intended it [R1].

**Baselines**

- Commit JSON baselines under the domain, for example
  `libs/table/src/directives/bench-baselines/`, keyed by provenance [S35].
- Update them only by an explicit command on the reference machine. Never auto-update them from
  a pull request.
- The format follows `customSmallerIsBetter` if `github-action-benchmark` is ever adopted [S49].

**Comparison against published results:** none as a gate (see the table above). Use the
js-framework-benchmark Angular create-1k entries only as an order-of-magnitude sanity band for
the *plain* host [S21][S18].

## Not researched

- Glide Data Grid (canvas, so no DOM FLIP), SlickGrid, and Tabulator in-repo perf suites.
- MUI X perf tests.
- Material CDK drag-drop perf, beyond the missing `benchmarks/` directory.
- Chromium tracing categories for compositor frame drops (`cc`, `benchmark`,
  `PipelineReporter`).
- Whether AG Grid or Handsontable run their suites on a schedule (`cron.spec.ts` exists but was
  not opened).

## Unverified

- js-framework-benchmark Angular and vanillajs numbers:
  - `current.html` and `2026/chrome150.html` render client-side, so WebFetch got no data.
  - `results.ts` is index-encoded, and the index → framework/benchmark map could not be
    fetched. One decoded row gave an implausible 28 ms "create 10k".
  - To confirm: clone the repo at `f2df01a` and read the `frameworks` / `benchmarks` arrays.
- Whether chromium-headless-shell paces rAF at a real 60 Hz and runs threaded compositor
  animations. The bench spec's own comment assumes "no real display refresh" [R1]. To
  confirm: log rAF deltas at N=0, and trace `cc` events.
- Whether `long-animation-frame` entries are emitted in headless shell. Inference: they ship in
  Chrome 123 core [S5], but this was not probed.
- A `<tr>` is a `LayoutBox`, so `IsTransformApplicable()` is true. This is an inference from
  [S14][S15], not read from `layout_table_row.h`.
- The claim that a mid-glide re-reorder's second `animate()` falls back to the main thread via
  `kTargetHasIncompatibleAnimations` is an inference from [S12]. Chromium may cancel the
  first one instead. To confirm: DevTools Animations panel, or a trace.
- AG Grid control/variant interleaving order within an iteration: two reads of
  `benchmarking.ts` disagreed.
- Chromium source reads are from `main`, not the Chromium build Playwright 1.63 ships.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://web.dev/articles/inp | page, fetched 2026-09-24 | yes — page read |
| S2 | https://web.dev/articles/optimize-inp | updated 2025-09-02 | yes — page read |
| S3 | https://web.dev/articles/rail | updated 2020-06-10 | yes — page read; old, still unmarked |
| S4 | https://w3c.github.io/longtasks/ | ED | yes — spec read |
| S5 | https://developer.chrome.com/docs/web-platform/long-animation-frames | Chrome 123 | yes — page read; silent on compositor animations |
| S6 | https://w3c.github.io/event-timing/ | ED | yes — spec read; 8 ms granularity changed the "use Event Timing" idea |
| S7 | https://web.dev/articles/smoothness | 2021-11-03 | yes — page read |
| S8 | https://web.dev/articles/animations-guide | 2020-10-06 | yes — page read |
| S9 | https://developer.chrome.com/blog/hardware-accelerated-animations | 2021-02-22 | yes — page read; silent on WAAPI, so S10 needed |
| S10 | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/animation/README.md | main (unpinned) | yes — source read; showed main thread still ticks |
| S11 | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/animation/compositor_animations.h | main (unpinned) | yes — enum read |
| S12 | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/animation/compositor_animations.cc | main (unpinned) | yes — conditions read |
| S13 | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/platform/graphics/compositing_reasons.h | main (unpinned) | yes — read |
| S14 | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/layout/layout_object.h | main (unpinned) | yes — `IsTransformApplicable` read |
| S15 | https://raw.githubusercontent.com/w3c/csswg-drafts/main/css-transforms-1/Overview.bs | main (unpinned) | yes — dfn read |
| S16 | https://web.dev/articles/dom-size-and-interactivity | 2023-05-09 | yes — page read |
| S17 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/README.md | master ≈ f2df01a | yes — read; row sizes contradict S18 |
| S18 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/webdriver-ts/src/benchmarksCommon.ts | master ≈ f2df01a | yes — source read; corrected README sizes |
| S19 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/webdriver-ts/src/common.ts | master ≈ f2df01a | yes — config read |
| S20 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/webdriver-ts/src/timeline.ts | master ≈ f2df01a | yes — source read |
| S21 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/frameworks/keyed/angular-cf-signals/package.json | f2df01a | yes — read |
| S22 | https://api.github.com/repos/krausest/js-framework-benchmark/contents/frameworks/keyed?ref=f2df01a8679de05225c32714ca8cecbea3d78c5d | f2df01a | yes — listing read |
| S23 | https://github.com/krausest/js-framework-benchmark/releases | Chrome 152 run, 2026-09-01 | yes — page read |
| S24 | https://krausest.github.io/js-framework-benchmark/2026/chrome150.html | Chrome 150 | no — JS-rendered, no data |
| S25 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/webdriver-ts-results/src/results.ts | master | partial — structure read, mapping not |
| S26 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/testing/performance/benchmarking.ts | b36.2.0 | yes — source read; gate logic quoted |
| S27 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/testing/performance/playwright.config.ts | b36.2.0 | yes — read |
| S28 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/testing/performance/cdp.utils.ts | b36.2.0 | yes — read; no throttling |
| S29 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/testing/performance/e2e/setData.spec.ts | b36.2.0 | yes — read |
| S30 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/row-animation/index.mdoc | b36.2.0 | yes — read; no numbers |
| S31 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/scrolling-performance/index.mdoc | b36.2.0 | yes — read (`rowBuffer` default 10) |
| S32 | https://tanstack.com/blog/tanstack-table-v9-memory-performance | 2026-06-22 | yes — page read |
| S33 | https://github.com/KevinVandy/tanstack-table-benchmarks | 1c50441 | yes — README read |
| S34 | https://raw.githubusercontent.com/TanStack/virtual/main/benchmarks/README.md | main ≈ 78371e8 | yes — read |
| S35 | https://raw.githubusercontent.com/handsontable/handsontable/develop/performance-tests/README.md | develop ≈ bd508b7 | yes — read |
| S36 | https://raw.githubusercontent.com/handsontable/handsontable/develop/performance-tests/playwright.config.ts | develop ≈ bd508b7 | yes — read |
| S37 | https://api.github.com/repos/handsontable/handsontable/commits?sha=develop&path=performance-tests&per_page=1 | bd508b7 | yes — commit message read |
| S38 | https://handsontable.com/docs/javascript-data-grid/performance/ | unversioned | yes — pointed to `performance-tests/` |
| S39 | https://api.github.com/repos/formkit/auto-animate/contents/tests/e2e | default branch | yes — listing read |
| S40 | https://raw.githubusercontent.com/formkit/auto-animate/master/tests/e2e/memory.spec.ts | master (unpinned) | yes — read |
| S41 | https://raw.githubusercontent.com/angular/angular/main/modules/benchmarks/README.md | main | yes — read |
| S42 | https://raw.githubusercontent.com/angular/angular/main/.github/workflows/benchmark-compare.yml | main | yes — read; still present |
| S43 | https://api.github.com/repos/angular/angular/pulls/58760 | — | yes — closed unmerged; changed "removed" to "still present" |
| S44 | https://api.github.com/repos/angular/components/contents/ | main | yes — no `benchmarks/` at root |
| S45 | https://github.com/hckhanh/benchmark-table-libraries | 446a382 | yes — README read |
| S46 | https://www.1771technologies.com/blog/performance-benchmarks | 2026-06 | yes — page read; vendor-run |
| S47 | https://raw.githubusercontent.com/google/tachometer/main/README.md | tachometer 0.7.2 (registry) | yes — read |
| S48 | https://codspeed.io/blog/benchmarks-in-ci-without-noise | 2025-07-30 | yes — read; CPU workloads, not browser |
| S49 | https://raw.githubusercontent.com/benchmark-action/github-action-benchmark/master/README.md | v1.22.2 | yes — read |
| S50 | https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl | master | yes — read |
| S51 | https://developer.chrome.com/docs/devtools/settings/throttling | unversioned | yes — calibration read |
| S52 | https://unpkg.com/@vitest/browser@4.1.9/context.d.ts | 4.1.9 | yes — `cdp` declared |
| S53 | https://vitest.dev/api/browser/context | docs v5.0.1 | yes — "playwright + chromium only" |
| S54 | https://unpkg.com/vitest@4.1.9/browser/context.d.ts | 4.1.9 | yes — re-exports provider contexts |
| S55 | https://v4.vitest.dev/api/#bench | v4 docs | yes — "experimental"; no `toBeFasterThan` |
| S56 | https://vitest.dev/guide/benchmarking | docs v5.0.1 | yes — v5 only, does not apply to 4.1.9 |
| S57 | https://angular.dev/guide/testing/migrating-to-vitest | Angular 22 docs | yes — install `@vitest/browser-playwright` |
| S58 | https://playwright.dev/docs/browsers | playwright 1.63.0 (registry) | yes — headless shell default |
| S59 | https://developer.chrome.com/docs/chromium/headless | unversioned | yes — read |
| S60 | https://developer.chrome.com/blog/chrome-headless-shell | unversioned | yes — read |
| R1 | libs/table/src/directives/ngp-table-row-animation.bench.spec.ts:17 | working tree | yes — read (`ROW_COUNTS`, samples, frame sampler) |
| R2 | libs/table/src/directives/ngp-table-row-animation.directive.ts:41 | working tree | yes — read (`afterRenderEffect` earlyRead/write) |
| R3 | libs/table/project.json:63 | working tree | yes — `bench` target read |
| R4 | package.json:36 | working tree | yes — no `@vitest/browser-playwright`/`playwright` |
| R5 | node_modules/@vitest/ | installed | yes — no `browser*` package present |
